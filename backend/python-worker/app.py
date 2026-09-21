import imaplib
import smtplib
import ssl
import email
from email.message import EmailMessage
from email.utils import parsedate_to_datetime, parseaddr, formataddr, make_msgid, format_datetime
from email.header import decode_header
from email.errors import HeaderParseError
import datetime
import time
import random
import os
import re
import json
import sqlite3
import html
import traceback
import sys
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from flask import Flask, jsonify, request, render_template_string
from flask_cors import CORS

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

@app.before_request
def handle_preflight():
    if request.method == "OPTIONS":
        res = app.make_default_options_response()
        origin = request.headers.get('Origin')
        if origin:
            res.headers['Access-Control-Allow-Origin'] = origin
            res.headers['Access-Control-Allow-Credentials'] = 'true'
        else:
            res.headers['Access-Control-Allow-Origin'] = '*'
        res.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS, PATCH'
        res.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-Requested-With'
        return res

# Prevent browser caching of UI changes and ensure CORS headers
@app.after_request
def add_header(response):
    response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
    response.headers['Pragma'] = 'no-cache'
    response.headers['Expires'] = '0'
    origin = request.headers.get('Origin')
    if origin:
        response.headers['Access-Control-Allow-Origin'] = origin
        response.headers['Access-Control-Allow-Credentials'] = 'true'
    else:
        response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS, PATCH'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-Requested-With'
    return response

# ==================== CONFIGURATION & PATHS ====================
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "warmup_telemetry.db")
ACCOUNTS_FILE = os.path.join(BASE_DIR, "account.json")
ACCOUNTS_FILE_BACKUP = os.path.join(BASE_DIR, "accounts.json")
REPLIES_FILE = os.path.join(BASE_DIR, "warmup_replies.txt")

# Global Config State (default includes 'cloud' from assignment)
target_tokens = ["cloud", "vasetebazar", "modzlab", "segatravelmauritius", "hetzner", "vps"]
reply_probability = 1.0
star_probability = 0.60
lookback_days = 2
max_threads = 8

# Sleep timings (seconds) for rescue and replies
SLEEP_AFTER_MOVE_MIN = 3
SLEEP_AFTER_MOVE_MAX = 8
SLEEP_BETWEEN_REPLIES_MIN = 5
SLEEP_BETWEEN_REPLIES_MAX = 15
SLEEP_BETWEEN_ROUNDS_MIN = 5
SLEEP_BETWEEN_ROUNDS_MAX = 10

# Per-sender regards / signatures (fallback if not defined in account.json)
CUSTOM_REGARDS = {
    "albert.william@vasetebazar.com": "\n\nRegards,\nAlbert\nFinance Associate\n",
    "allen.jones@modzlab.com": "\n\nRegards,\nAllen\nProduct Advisor\n",
    "austin.davis@segatravelmauritius.com": "\n\nRegards,\nAustin\nSales Manager\n",
    "bradley.moore@rfolympic.com": "\n\nRegards,\nBradley\nOperations Manager\n",
    "brent.taylor@rhinogallery.com": "\n\nRegards,\nBrent\nBusiness Consultant\n",
    "brent.taylor@zhinogallery.com": "\n\nRegards,\nBrent\nBusiness Consultant\n",
    "maureenfergu54@gmail.com": "\n\nRegards,\nMaureen\nHR Executive\n",
    "genevascott1945@gmail.com": "\n\nRegards,\nGeneva\nProject Coordinator\n",
    "ettagardner19@gmail.com": "\n\nRegards,\nEtta\nMarketing Specialist\n",
    "janieadams1953@gmail.com": "\n\nRegards,\nJanie\nAdministrative Assistant\n",
    "shawnarhodes148@gmail.com": "\n\nRegards,\nShawna\nTeam Lead\n",
}

# Optional mapping to a display name for the From header
SENDER_DISPLAY_NAMES = {
    "albert.william@vasetebazar.com": "Albert",
    "allen.jones@modzlab.com": "Allen",
    "austin.davis@segatravelmauritius.com": "Austin",
    "bradley.moore@rfolympic.com": "Bradley",
    "brent.taylor@rhinogallery.com": "Brent",
    "brent.taylor@zhinogallery.com": "Brent",
    "maureenfergu54@gmail.com": "Maureen",
    "genevascott1945@gmail.com": "Geneva",
    "ettagardner19@gmail.com": "Etta",
    "janieadams1953@gmail.com": "Janie",
    "shawnarhodes148@gmail.com": "Shawna",
}

# Accounts to skip
exception_account = []

# Global Execution State
execution_logs = []
cached_scan_items = []
latest_scan_stats = {"inbox": 0, "spam": 0, "promotions": 0, "total": 0, "rescued": 0, "replied": 0}
account_statuses = {}  # email -> {status: "Connected"|"Not Connected", error: "...", last_tested: "..."}
is_running = False
stop_requested = False

# ==================== DATABASE ====================
def init_database():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS processed_messages (
            message_id TEXT PRIMARY KEY,
            account_email TEXT,
            account_type TEXT,
            sender_email TEXT,
            subject TEXT,
            initial_folder TEXT,
            case_type TEXT,
            rescued_from_spam INTEGER DEFAULT 0,
            replied INTEGER DEFAULT 0,
            replied_at TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.commit()
    cursor.execute("PRAGMA table_info(processed_messages)")
    cols = [r[1] for r in cursor.fetchall()]
    cols_to_add = [
        ("account_email", "TEXT"),
        ("account_type", "TEXT"),
        ("sender_email", "TEXT"),
        ("subject", "TEXT"),
        ("initial_folder", "TEXT"),
        ("case_type", "TEXT"),
        ("rescued_from_spam", "INTEGER DEFAULT 0"),
        ("replied", "INTEGER DEFAULT 0"),
        ("is_unread", "INTEGER DEFAULT 0"),
        ("replied_at", "TIMESTAMP"),
        ("created_at", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP")
    ]
    for c_name, c_type in cols_to_add:
        if c_name not in cols:
            try:
                cursor.execute(f"ALTER TABLE processed_messages ADD COLUMN {c_name} {c_type}")
            except Exception:
                pass
    conn.commit()
    conn.close()

def is_message_replied(message_id, account_email=None, sender_email=None, subject=None):
    if not message_id and not (account_email and sender_email and subject):
        return False
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    if message_id:
        raw = str(message_id).strip()
        clean_id = re.sub(r'[\r\n\t\s]', '', raw)
        bare_id = clean_id.strip('<>')
        bracket_id = f"<{bare_id}>"
        cursor.execute("""
            SELECT 1 FROM processed_messages 
            WHERE (message_id = ? OR message_id = ? OR message_id = ? OR message_id = ?) AND replied = 1
        """, (raw, clean_id, bare_id, bracket_id))
        if cursor.fetchone() is not None:
            conn.close()
            return True

    # Check sender + subject fallback only if message_id was missing or synthetic
    if not message_id and account_email and sender_email and subject:
        cursor.execute("""
            SELECT 1 FROM processed_messages 
            WHERE account_email = ? AND sender_email = ? AND subject = ? AND replied = 1
        """, (account_email, sender_email, subject))
        if cursor.fetchone() is not None:
            conn.close()
            return True

    conn.close()
    return False

def is_message_processed(message_id):
    if not message_id:
        return False
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT 1 FROM processed_messages WHERE message_id = ?", (message_id,))
    exists = cursor.fetchone() is not None
    conn.close()
    return exists

def log_telemetry(msg_id, account_email, account_type, sender_email, subject, initial_folder, case_type, rescued, replied, is_unread=0):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    now = datetime.datetime.now(datetime.timezone.utc).isoformat() if replied else None
    
    cursor.execute("SELECT rescued_from_spam, replied, is_unread FROM processed_messages WHERE message_id = ?", (msg_id,))
    row = cursor.fetchone()
    if row:
        final_rescued = 1 if (rescued or row[0]) else 0
        final_replied = 1 if (replied or row[1]) else 0
        final_unread = 0 if final_replied else (int(is_unread) if is_unread is not None else (row[2] or 0))
        cursor.execute("""
            UPDATE processed_messages 
            SET rescued_from_spam = ?, replied = ?, is_unread = ?,
                replied_at = coalesce(?, replied_at),
                initial_folder = coalesce(initial_folder, ?)
            WHERE message_id = ?
        """, (final_rescued, final_replied, final_unread, now, initial_folder, msg_id))
    else:
        final_unread = 0 if replied else int(is_unread or 0)
        cursor.execute("""
            INSERT INTO processed_messages 
            (message_id, account_email, account_type, sender_email, subject, initial_folder, case_type, rescued_from_spam, replied, is_unread, replied_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (msg_id, account_email, account_type, sender_email, subject, initial_folder, case_type, int(rescued), int(replied), final_unread, now))
    conn.commit()
    conn.close()

# ==================== LOGGING & UTILS ====================
def add_log(msg, level="INFO"):
    t = datetime.datetime.now().strftime("%H:%M:%S")
    entry = {"time": t, "level": level, "message": msg}
    execution_logs.append(entry)
    if len(execution_logs) > 400:
        execution_logs.pop(0)

def safe_decode_header(value, fallback=""):
    """Decode RFC2047 and remove CR/LF and control chars so headers are safe to set."""
    if not value:
        return fallback
    try:
        parts = decode_header(value)
        out = []
        for bytes_part, enc in parts:
            if isinstance(bytes_part, bytes):
                try:
                    out.append(bytes_part.decode(enc or "utf-8", errors="replace"))
                except Exception:
                    out.append(bytes_part.decode("utf-8", errors="ignore"))
            else:
                out.append(str(bytes_part))
        s = "".join(out)
    except Exception:
        s = str(value)
    s = re.sub(r'[\r\n\x00-\x1f\x7f]', ' ', s)
    s = re.sub(r'\s+', ' ', s).strip()
    return s or fallback

def extract_email_from_header(header_value):
    if not header_value:
        return "", ""
    name, addr = parseaddr(header_value)
    return name, (addr or "").lower()

def is_sender_matching(header_value, tokens):
    """Match sender if ANY token/domain appears in full header or email address."""
    if not header_value or not tokens:
        return False
    header_l = str(header_value).lower()
    _, addr = extract_email_from_header(header_value)
    for token in tokens:
        t = token.lower().strip()
        if not t:
            continue
        if t in header_l:
            return True
        if addr and t in addr:
            return True
    return False

def get_real_reply_address(msg):
    """Prefer From address. Use Reply-To only if From is missing or invalid."""
    from_hdr = msg.get("From", "")
    _, from_addr = extract_email_from_header(from_hdr)
    if from_addr:
        return from_addr
    reply_to_hdr = msg.get("Reply-To", "")
    _, reply_to_addr = extract_email_from_header(reply_to_hdr)
    return reply_to_addr

def extract_sender_name(msg):
    from_hdr = msg.get("From", "")
    name, addr = extract_email_from_header(from_hdr)
    if name:
        parts = name.strip().split()
        if parts:
            return parts[0].strip().capitalize()
    if addr:
        local = addr.split("@")[0]
        local_clean = re.sub(r"[._\-]+", " ", local).split()[0]
        if local_clean:
            return local_clean.capitalize()
    return ""

def _make_local_date_header():
    tz = datetime.timezone(datetime.timedelta(hours=5, minutes=30))
    now = datetime.datetime.now(tz)
    return format_datetime(now)

def load_reply_templates():
    if os.path.exists(REPLIES_FILE):
        try:
            with open(REPLIES_FILE, "r", encoding="utf-8") as f:
                lines = [line.strip() for line in f if line.strip()]
                if lines:
                    return lines
        except Exception:
            pass
    return ["Hi,\n\nThank you for your message. We'll get back to you shortly."]

def save_reply_templates(templates):
    with open(REPLIES_FILE, "w", encoding="utf-8") as f:
        for t in templates:
            f.write(t.strip() + "\n")

def load_accounts():
    """Load mailboxes from account.json (or accounts.json as fallback)."""
    for fpath in [ACCOUNTS_FILE, ACCOUNTS_FILE_BACKUP]:
        if os.path.exists(fpath):
            try:
                with open(fpath, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    if data:
                        return data
            except Exception:
                pass
    return []

def save_accounts(accounts):
    """Save mailboxes to both account.json and accounts.json."""
    for fpath in [ACCOUNTS_FILE, ACCOUNTS_FILE_BACKUP]:
        try:
            with open(fpath, "w", encoding="utf-8") as f:
                json.dump(accounts, f, indent=2)
        except Exception:
            pass

def interruptible_sleep(seconds):
    global stop_requested
    for _ in range(int(seconds)):
        if stop_requested:
            break
        time.sleep(1)

# ==================== IMAP & SMTP LOW-LEVEL HELPERS ====================
def server_supports_move(imap_conn):
    try:
        typ, data = imap_conn.capability()
        if typ == 'OK' and data:
            caps = b" ".join(data).upper().decode() if isinstance(data, (list, tuple)) else str(data).upper()
            return "MOVE" in caps
    except Exception:
        pass
    return False

def try_move_uid_to_inbox_uidmode(imap_conn, uid, current_mailbox):
    """
    Move a UID from current mailbox to INBOX using UID MOVE if available,
    otherwise UID COPY + UID STORE + EXPUNGE.
    """
    try:
        if server_supports_move(imap_conn):
            typ, data = imap_conn.uid('MOVE', uid, 'INBOX')
            if typ == "OK":
                add_log(f"[INFO] UID MOVE succeeded for {uid} from {current_mailbox} to INBOX", "RESCUE")
                return True
            else:
                add_log(f"[WARN] UID MOVE failed for {uid}: {typ} {data}", "WARNING")
        typ, data = imap_conn.uid('COPY', uid, 'INBOX')
        if typ != "OK":
            add_log(f"[WARN] UID COPY to INBOX failed for uid {uid} in {current_mailbox}: {typ} {data}", "WARNING")
            return False
        try:
            imap_conn.uid('STORE', uid, '+FLAGS.SILENT', '(\\Deleted)')
            try:
                imap_conn.expunge()
            except Exception:
                pass
        except Exception as e:
            add_log(f"[WARN] Could not UID STORE \\Deleted for uid {uid}: {e}", "WARNING")
        add_log(f"[INFO] Copied UID {uid} from {current_mailbox} to INBOX and marked original deleted", "RESCUE")
        return True
    except Exception as e:
        add_log(f"[ERROR] Exception while moving uid {uid} to INBOX: {e}", "ERROR")
        return False

def imap_uid_search_since(imap_conn, since_date):
    since_str = since_date.strftime("%d-%b-%Y")
    try:
        typ, data = imap_conn.uid('search', None, '(SINCE "{}")'.format(since_str))
    except Exception:
        typ, data = imap_conn.search(None, '(SINCE "{}")'.format(since_str))
    if typ != "OK":
        return []
    uids = []
    for block in data:
        if not block:
            continue
        parts = block.decode().split()
        uids.extend(parts)
    return uids

def imap_uid_search_xgmraw(imap_conn, raw_query):
    try:
        typ, data = imap_conn.uid('search', None, 'X-GM-RAW', raw_query)
    except Exception:
        try:
            typ, data = imap_conn.search(None, 'X-GM-RAW', raw_query)
        except Exception:
            return []
    if typ != "OK" or not data or not data[0]:
        return []
    return data[0].decode().split()

def fetch_message_by_uid(imap_conn, uid):
    try:
        typ, data = imap_conn.uid('fetch', uid, '(BODY.PEEK[HEADER] FLAGS)')
    except Exception:
        typ, data = imap_conn.fetch(uid, '(BODY.PEEK[HEADER] FLAGS)')
    if typ != "OK" or not data or data[0] is None:
        return None, None, False
    raw = None
    flags_header = b""
    for part in data:
        if isinstance(part, tuple) and len(part) > 1:
            flags_header = part[0] if isinstance(part[0], bytes) else b""
            raw = part[1]
            break
    if not raw:
        return None, None, False
    msg = email.message_from_bytes(raw)
    is_seen = b"\\seen" in flags_header.lower()
    is_unread = not is_seen
    return msg, flags_header, is_unread

def build_reply_message(original_msg, from_address, to_address, body_plain, signature="", display_name=None):
    reply = EmailMessage()
    try:
        raw_subject = original_msg.get("Subject", "")
        safe_subject = safe_decode_header(raw_subject, fallback="")
        if safe_subject and not safe_subject.lower().startswith("re:"):
            reply["Subject"] = "Re: " + safe_subject
        else:
            reply["Subject"] = safe_subject or "Re: "
    except Exception:
        reply["Subject"] = "Re: "

    if display_name:
        reply["From"] = formataddr((display_name, from_address))
    else:
        reply["From"] = from_address

    real_to = get_real_reply_address(original_msg)
    reply["To"] = real_to or to_address

    try:
        msg_id = original_msg.get("Message-ID")
        if msg_id and isinstance(msg_id, str) and msg_id.strip():
            reply["In-Reply-To"] = msg_id
            refs = original_msg.get("References", "")
            if refs:
                reply["References"] = (refs + " " + msg_id).strip()
            else:
                reply["References"] = msg_id
    except Exception:
        pass

    try:
        reply["Message-ID"] = make_msgid(domain="mail.gmail.com")
    except Exception:
        reply["Message-ID"] = make_msgid()
    try:
        reply["Date"] = _make_local_date_header()
    except Exception:
        pass

    final_plain = body_plain + signature
    escaped = html.escape(final_plain)
    escaped = escaped.replace("  ", "&nbsp;&nbsp;")
    html_body = f"<div dir='ltr'>{escaped.replace(chr(10), '<br>\n')}</div>"

    reply.set_content(final_plain)
    reply.add_alternative(html_body, subtype="html")
    return reply

def send_via_smtp(smtp_host, smtp_port, sender_email, app_password, msg: EmailMessage):
    context = ssl.create_default_context()
    with smtplib.SMTP(smtp_host, smtp_port, timeout=30) as server:
        server.ehlo()
        server.starttls(context=context)
        server.ehlo()
        server.login(sender_email, app_password)
        server.send_message(msg)

def parse_lookback(lookback_val):
    """
    Parses lookback value into (cutoff_dt, cutoff_date, display_str).
    Supports hours ('2h', '4h', '6h', '8h', '12h', '24h') and days ('2d', '5d', '10d', '15d', '30d') or numeric values.
    """
    now = datetime.datetime.now(datetime.timezone.utc)
    if isinstance(lookback_val, str):
        val_s = lookback_val.strip().lower()
        if val_s.endswith('h'):
            try:
                hours = float(val_s[:-1])
                cutoff = now - datetime.timedelta(hours=hours)
                return cutoff, cutoff.date(), f"{int(hours)}h"
            except Exception:
                pass
        elif val_s.endswith('d'):
            try:
                days = float(val_s[:-1])
                cutoff = now - datetime.timedelta(days=days)
                return cutoff, cutoff.date(), f"{int(days)}d"
            except Exception:
                pass
        try:
            num = float(val_s)
            cutoff = now - datetime.timedelta(days=num)
            return cutoff, cutoff.date(), f"{int(num)}d"
        except Exception:
            pass
    elif isinstance(lookback_val, (int, float)):
        cutoff = now - datetime.timedelta(days=float(lookback_val))
        return cutoff, cutoff.date(), f"{int(lookback_val)}d"
    
    # Default 1 day / 24 hours
    cutoff = now - datetime.timedelta(days=1)
    return cutoff, cutoff.date(), "24h"

def classify_campaign_type(sender_email, recipient_email, recipient_type=""):
    s_email = (sender_email or "").lower().strip()
    r_email = (recipient_email or "").lower().strip()
    r_type = (recipient_type or "").lower().strip()

    # Sender: Workspace vs SMTP
    workspace_domains = [
        "vasetebazar.com", "modzlab.com", "segatravelmauritius.com", 
        "rfolympic.com", "zhinogallery.com", "cloudhead.ai", 
        "cloudwizz.com", "clouddeal.net", "realgrowth.com",
        "cloudlambda.store", "cloudlibrary.store", "cloudloader.store"
    ]
    is_workspace_sender = any(s_email.endswith(d) for d in workspace_domains) or ("workspace" in s_email) or ("google" in s_email)

    if r_type == "seed" or r_email.endswith("@gmail.com"):
        return "Workspace → Gmail Seeds" if is_workspace_sender else "SMTP → Gmail Seeds"
    elif r_type == "smtp":
        return "Workspace → SMTP" if is_workspace_sender else "SMTP → Workspace"
    elif r_type == "employee":
        return "Workspace → Employees" if is_workspace_sender else "SMTP → Employees"
    else: # workspace / general
        if is_workspace_sender:
            return "Workspace → Gmail Seeds"
        else:
            return "SMTP → Workspace"

# ==================== STEP 1: SCAN ENGINE (BEFORE SENDING REPLIES) ====================
def scan_single_account(account, custom_days, tokens):
    global stop_requested
    if stop_requested:
        return account, {"email": account["email"], "error": "Stopped"}, []

    email_addr = account["email"]
    account_type = account.get("account_type", "workspace").lower()
    discovered_items = []
    stats = {
        "email": email_addr,
        "type": account_type,
        "inbox": 0,
        "unread": 0,
        "spam": 0,
        "promotions": 0,
        "total": 0,
        "error": None
    }

    if email_addr in exception_account:
        add_log(f"[SKIP] Account in exception list: {email_addr}", "INFO")
        return account, stats, discovered_items

    try:
        imap_host = account.get("imap_host", "imap.gmail.com")
        imap_port = int(account.get("imap_port", 993))
        imap_conn = imaplib.IMAP4_SSL(imap_host, imap_port, timeout=25)
        imap_conn.login(email_addr, account["password"])
        account_statuses[email_addr] = {
            "status": "Connected",
            "error": None,
            "last_tested": datetime.datetime.now().strftime("%H:%M:%S")
        }
    except Exception as e:
        stats["error"] = str(e)
        account_statuses[email_addr] = {
            "status": "Not Connected",
            "error": str(e),
            "last_tested": datetime.datetime.now().strftime("%H:%M:%S")
        }
        add_log(f"Login failed for {email_addr}: {e}", "ERROR")
        return account, stats, discovered_items

    try:
        if "gmail.com" in imap_host.lower():
            folders_to_check = [
                ("INBOX", "Inbox"),
                ("[Gmail]/Spam", "Spam"),
                ("[Google Mail]/Spam", "Spam")
            ]
        else:
            folders_to_check = [
                ("INBOX", "Inbox"),
                ("Spam", "Spam"),
                ("Junk", "Spam")
            ]

        cutoff_dt, cutoff_date, _ = parse_lookback(custom_days)
        seen_msg_ids = set()

        for folder_name, folder_cat in folders_to_check:
            if stop_requested:
                break
            try:
                typ, _ = imap_conn.select(f'"{folder_name}"')
                if typ != "OK":
                    continue
                # Search directly for UNSEEN emails within lookback date
                since_str = cutoff_date.strftime("%d-%b-%Y")
                try:
                    typ, data = imap_conn.uid('search', None, f'(UNSEEN SINCE "{since_str}")')
                    uids = data[0].split() if typ == "OK" and data and data[0] else []
                except Exception:
                    uids = imap_uid_search_since(imap_conn, cutoff_date)

                if not uids:
                    continue
                for uid in uids:
                    if stop_requested:
                        break
                    try:
                        msg, flags, is_unread = fetch_message_by_uid(imap_conn, uid)
                        if not msg:
                            continue
                        
                        # Count only unread emails
                        if not is_unread:
                            continue
                        
                        date_hdr = msg.get("Date")
                        try:
                            dt = parsedate_to_datetime(date_hdr) if date_hdr else None
                            if dt:
                                if dt.tzinfo is None:
                                    dt = dt.replace(tzinfo=datetime.timezone.utc)
                                if dt < cutoff_dt:
                                    continue
                        except Exception:
                            pass

                        from_hdr = msg.get("From", "")
                        sender_hdr = msg.get("Sender", "")
                        if not (is_sender_matching(from_hdr, tokens) or is_sender_matching(sender_hdr, tokens)):
                            continue

                        _, sender_email = extract_email_from_header(from_hdr)
                        subject = safe_decode_header(msg.get("Subject", ""))

                        raw_msg_id = msg.get("Message-ID", "").strip()
                        if raw_msg_id:
                            msg_id = re.sub(r'[\r\n\t\s]', '', raw_msg_id)
                        else:
                            msg_id = f"{email_addr}:{sender_email}:{subject}:{date_hdr}"

                        # Prevent duplicate counts across multiple folders (e.g. Inbox + Promotions or Spam + Junk)
                        if msg_id in seen_msg_ids:
                            continue
                        seen_msg_ids.add(msg_id)

                        # Skip emails that were already replied to (so they are completely excluded from Recent Discovered/Inbox and run counts)
                        if is_message_replied(msg_id, email_addr, sender_email, subject):
                            continue

                        folder_type = folder_cat
                        if folder_cat == "All Mail":
                            folder_type = "Inbox"

                        if folder_type == "Inbox":
                            stats["inbox"] += 1
                            stats["unread"] += 1
                        elif folder_type == "Spam":
                            stats["spam"] += 1
                        elif folder_type == "Promotions":
                            stats["promotions"] += 1
                        stats["total"] += 1

                        # Determine case type
                        if account_type == "employee":
                            case_type = "Case 1/2 (Employee Control)"
                        elif account_type == "seed":
                            case_type = "Case 3/4 (Seed Experiment)"
                        elif account_type in ["workspace", "smtp"]:
                            case_type = "Case 5/6 (Workspace <-> SMTP Warmup)"
                        else:
                            case_type = "General"

                        # Log telemetry so DB and Dashboard have true counts immediately
                        log_telemetry(
                            msg_id=msg_id,
                            account_email=email_addr,
                            account_type=account_type,
                            sender_email=sender_email,
                            subject=subject,
                            initial_folder=folder_type,
                            case_type=case_type,
                            rescued=0,
                            replied=0,
                            is_unread=1
                        )

                        discovered_items.append({
                            "account": account,
                            "uid": uid,
                            "msg": msg,
                            "msg_id": msg_id,
                            "sender_email": sender_email,
                            "subject": subject,
                            "folder_name": folder_name,
                            "folder_type": folder_type,
                            "case_type": case_type,
                            "is_unread": True
                        })
                    except Exception:
                        pass
            except Exception:
                continue

        if not stats["error"] and not stop_requested:
            add_log(f"Scanned {email_addr} -> Inbox: {stats['inbox']}, Spam: {stats['spam']}, Promo: {stats['promotions']}", "SUCCESS")
    finally:
        try:
            imap_conn.logout()
        except Exception:
            pass

    return account, stats, discovered_items

# ==================== STEP 2: RESCUE & ROUND-ROBIN ENGAGEMENT ====================
def round_robin_engage_items(items):
    global stop_requested, latest_scan_stats
    if not items or stop_requested:
        return 0, 0

    reply_templates = load_reply_templates()
    
    # Sort items oldest first by message Date
    def _msg_date_key(item):
        try:
            d = parsedate_to_datetime(item["msg"].get("Date"))
            return d or datetime.datetime.min
        except Exception:
            return datetime.datetime.min
    items.sort(key=_msg_date_key)

    # Group into queues by account email
    account_queues = {}
    for item in items:
        em = item["account"]["email"]
        if em not in account_queues:
            account_queues[em] = {
                "account": item["account"],
                "items": []
            }
        account_queues[em]["items"].append(item)

    queues = list(account_queues.values())
    total_rescued = 0
    total_replied = 0
    round_idx = 0

    while any(len(q["items"]) > 0 for q in queues):
        if stop_requested:
            add_log("Emergency stop during engagement rounds.", "WARNING")
            break
        round_idx += 1
        
        for q in queues:
            if stop_requested:
                break
            if not q["items"]:
                continue
            
            item = q["items"].pop(0)
            account = q["account"]
            email_addr = account["email"]
            account_type = account.get("account_type", "workspace").lower()
            is_warmup = account_type in ["workspace", "smtp"]
            
            uid = item["uid"]
            msg = item["msg"]
            msg_id = item["msg_id"]
            sender_email = item["sender_email"]
            subject = item["subject"]
            folder_type = item["folder_type"]
            folder_name = item["folder_name"]
            case_type = item.get("case_type", "General")

            # 1. RESCUE FROM SPAM
            rescued = False
            if folder_type == "Spam":
                try:
                    imap_host = account.get("imap_host", "imap.gmail.com")
                    imap_port = int(account.get("imap_port", 993))
                    imap_conn = imaplib.IMAP4_SSL(imap_host, imap_port, timeout=30)
                    imap_conn.login(email_addr, account["password"])
                    imap_conn.select(f'"{folder_name}"')
                    if try_move_uid_to_inbox_uidmode(imap_conn, uid, folder_name):
                        rescued = True
                        total_rescued += 1
                        latest_scan_stats["rescued"] += 1
                        add_log(f"[RESCUE] {email_addr} moved email from {sender_email} (Spam -> INBOX)", "RESCUE")
                    try:
                        imap_conn.logout()
                    except Exception:
                        pass
                except Exception as ex:
                    add_log(f"[WARN] Rescue failed for {email_addr}: {ex}", "WARNING")

            # 2. REPLY (ONLY to UNREAD emails, never to read emails)
            will_reply = False
            is_unread = item.get("is_unread", False)
            if not is_unread:
                add_log(f"[SKIP] {email_addr} email from {sender_email} is already read in {folder_type}. Skipping reply.", "INFO")
            elif is_message_replied(msg_id, email_addr, sender_email, subject):
                add_log(f"[SKIP] {email_addr} -> {sender_email} already replied to.", "INFO")
            else:
                reply_body = random.choice(reply_templates)
                signature = account.get("signature") or CUSTOM_REGARDS.get(email_addr, "\n\nRegards,\nCloudlead Team")
                sender_name = extract_sender_name(msg)
                greeting = f"Hi {sender_name},\n\n" if sender_name else "Hi,\n\n"
                plain_snippet = greeting + reply_body + signature + "\n\n"
                display_name = account.get("display_name") or SENDER_DISPLAY_NAMES.get(email_addr)
                reply_to_addr = get_real_reply_address(msg) or sender_email

                try:
                    # 1. FIRST: Mark email as Read (\Seen) and Star some emails (\Flagged)
                    should_star = random.random() < star_probability
                    flags_to_add = '(\\Seen \\Flagged)' if should_star else '(\\Seen)'
                    star_text = " & Starred (★)" if should_star else ""
                    try:
                        imap_host = account.get("imap_host", "imap.gmail.com")
                        imap_port = int(account.get("imap_port", 993))
                        imap_conn = imaplib.IMAP4_SSL(imap_host, imap_port, timeout=20)
                        imap_conn.login(email_addr, account["password"])
                        target_box = "INBOX" if folder_type != "Promotions" else "[Gmail]/Promotions"
                        if folder_type == "Spam" and not rescued:
                            target_box = folder_name
                        imap_conn.select(f'"{target_box}"')
                        imap_conn.uid('STORE', uid, '+FLAGS', flags_to_add)
                        imap_conn.logout()
                        add_log(f"[READ] Marked email as Read{star_text} for {email_addr} (UID {uid})", "INFO")
                    except Exception as e:
                        add_log(f"[WARN] Failed to mark as Read for {email_addr}: {e}", "WARNING")

                    reply_msg = build_reply_message(
                        original_msg=msg,
                        from_address=email_addr,
                        to_address=reply_to_addr,
                        body_plain=plain_snippet,
                        signature="",
                        display_name=display_name
                    )

                    pre_sleep = random.randint(SLEEP_AFTER_MOVE_MIN, SLEEP_AFTER_MOVE_MAX)
                    add_log(f"[INFO] Waiting {pre_sleep}s before sending reply for {email_addr} -> {reply_to_addr}", "INFO")
                    interruptible_sleep(pre_sleep)

                    # 2. THEN: Send the reply via SMTP
                    if not stop_requested:
                        smtp_host = account.get("smtp_host", "smtp.gmail.com")
                        smtp_port = int(account.get("smtp_port", 587))
                        send_via_smtp(smtp_host, smtp_port, email_addr, account["password"], reply_msg)
                        will_reply = True
                        total_replied += 1
                        latest_scan_stats["replied"] += 1
                        ctype = classify_campaign_type(sender_email, email_addr, account_type)
                        if "campaign_type_stats" in latest_scan_stats and ctype in latest_scan_stats["campaign_type_stats"]:
                            latest_scan_stats["campaign_type_stats"][ctype]["replies"] += 1
                        add_log(f"[SENT] ({total_replied}) [REPLY SENT] {email_addr} -> {reply_to_addr} | Subject: {reply_msg.get('Subject')}", "REPLY")

                        between_sleep = random.randint(SLEEP_BETWEEN_REPLIES_MIN, SLEEP_BETWEEN_REPLIES_MAX)
                        add_log(f"[INFO] Sleeping {between_sleep}s between replies...", "INFO")
                        interruptible_sleep(between_sleep)
                except Exception as ex:
                    add_log(f"[ERROR] Sending failed for {email_addr} -> {reply_to_addr}: {ex}", "ERROR")

            # Update telemetry in database
            log_telemetry(msg_id, email_addr, account_type, sender_email, subject, folder_type, case_type, rescued, will_reply, is_unread=0 if will_reply else int(is_unread))

        if any(len(q["items"]) > 0 for q in queues) and not stop_requested:
            round_sleep = random.randint(SLEEP_BETWEEN_ROUNDS_MIN, SLEEP_BETWEEN_ROUNDS_MAX)
            add_log(f"[INFO] Finished round {round_idx}. Sleeping {round_sleep}s before next round...", "INFO")
            interruptible_sleep(round_sleep)

    return total_rescued, total_replied

def execute_step2_background(set_running_flag=True):
    global is_running, stop_requested, cached_scan_items
    add_log("=== STEP 2: RESCUING SPAM & SENDING REPLIES TO UNREAD ===", "HEADER")
    try:
        if not cached_scan_items:
            add_log("No active scan batch found. Running quick scan to find candidates...", "INFO")
            accounts = load_accounts()
            raw_items = []
            with ThreadPoolExecutor(max_workers=max_threads) as executor:
                futures = [executor.submit(scan_single_account, acc, lookback_days, target_tokens) for acc in accounts]
                for f in as_completed(futures):
                    acc, stats, items = f.result()
                    raw_items.extend(items)

            seen_global = set()
            deduped_items = []
            for item in raw_items:
                key = (item["account"]["email"].lower(), item["msg_id"])
                if key not in seen_global:
                    seen_global.add(key)
                    deduped_items.append(item)

            cached_scan_items = deduped_items
            tot_in = sum(1 for it in cached_scan_items if it.get("folder_type") == "Inbox")
            tot_sp = sum(1 for it in cached_scan_items if it.get("folder_type") == "Spam")
            tot_pr = sum(1 for it in cached_scan_items if it.get("folder_type") == "Promotions")
            tot_unr = sum(1 for it in cached_scan_items if it.get("is_unread"))

            ct_breakdown = {
                "Workspace → Employees": {"inbox": 0, "spam": 0, "promotions": 0, "replies": 0, "total": 0},
                "SMTP → Employees": {"inbox": 0, "spam": 0, "promotions": 0, "replies": 0, "total": 0},
                "Workspace → Gmail Seeds": {"inbox": 0, "spam": 0, "promotions": 0, "replies": 0, "total": 0},
                "SMTP → Gmail Seeds": {"inbox": 0, "spam": 0, "promotions": 0, "replies": 0, "total": 0},
                "SMTP → Workspace": {"inbox": 0, "spam": 0, "promotions": 0, "replies": 0, "total": 0},
                "Workspace → SMTP": {"inbox": 0, "spam": 0, "promotions": 0, "replies": 0, "total": 0}
            }
            for it in cached_scan_items:
                ctype = classify_campaign_type(it.get("sender_email"), it.get("account", {}).get("email"), it.get("account", {}).get("account_type"))
                if ctype in ct_breakdown:
                    ftype = it.get("folder_type")
                    if ftype == "Inbox": ct_breakdown[ctype]["inbox"] += 1
                    elif ftype == "Spam": ct_breakdown[ctype]["spam"] += 1
                    elif ftype == "Promotions": ct_breakdown[ctype]["promotions"] += 1
                    ct_breakdown[ctype]["total"] += 1

            latest_scan_stats["inbox"] = tot_in
            latest_scan_stats["unread"] = tot_unr
            latest_scan_stats["spam"] = tot_sp
            latest_scan_stats["promotions"] = tot_pr
            latest_scan_stats["total"] = len(cached_scan_items)
            latest_scan_stats["campaign_type_stats"] = ct_breakdown
            add_log(f"Scan complete. Found {len(cached_scan_items)} candidates ({tot_unr} unread).", "SUCCESS")

        if not cached_scan_items:
            add_log("No candidate emails found in mailboxes.", "WARNING")
        else:
            res_c, rep_c = round_robin_engage_items(list(cached_scan_items))
            cached_scan_items = []
            add_log(f"=== STEP 2 COMPLETE: Rescued {res_c} from Spam | Sent {rep_c} Replies ===", "HEADER")
    except Exception as e:
        add_log(f"Error in Step 2 Engage: {e}", "ERROR")
    finally:
        if set_running_flag:
            is_running = False

# ==================== FLASK API ROUTES ====================
@app.route("/")
def index():
    return render_template_string(HTML_TEMPLATE)

@app.route("/api/stats")
@app.route("/api/worker/stats")
@app.route("/api/worker/status")
@app.route("/api/dashboard")
@app.route("/api/worker/scans")
def get_stats():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    cursor.execute("SELECT count(*), coalesce(sum(rescued_from_spam), 0), coalesce(sum(replied), 0) FROM processed_messages")
    tot_row = cursor.fetchone()
    total_processed = tot_row[0] or 0
    total_rescued = tot_row[1] or 0
    total_replied = tot_row[2] or 0

    cursor.execute("SELECT coalesce(initial_folder, 'Inbox'), count(*) FROM processed_messages GROUP BY initial_folder")
    folder_breakdown = {r[0]: r[1] for r in cursor.fetchall()}

    accounts = load_accounts()
    email_to_type = {a["email"]: a.get("account_type", "workspace") for a in accounts}

    cursor.execute("""
        SELECT account_email, 
               sum(CASE WHEN initial_folder = 'Inbox' THEN 1 ELSE 0 END) as inbox_cnt,
               sum(CASE WHEN initial_folder = 'Spam' THEN 1 ELSE 0 END) as spam_cnt,
               sum(CASE WHEN initial_folder = 'Promotions' THEN 1 ELSE 0 END) as promo_cnt,
               coalesce(sum(rescued_from_spam), 0) as rescued_cnt,
               coalesce(sum(replied), 0) as replied_cnt,
               coalesce(sum(is_unread), 0) as unread_cnt,
               count(*) as total_cnt
        FROM processed_messages
        GROUP BY account_email
    """)
    db_stats = {r[0]: r for r in cursor.fetchall()}

    cursor.execute("""
        SELECT sender_email, account_email, account_type, initial_folder, rescued_from_spam, replied
        FROM processed_messages
    """)
    all_rows = cursor.fetchall()
    all_time_ct = {
        "Workspace → Employees": {"inbox": 0, "spam": 0, "promotions": 0, "replies": 0, "total": 0},
        "SMTP → Employees": {"inbox": 0, "spam": 0, "promotions": 0, "replies": 0, "total": 0},
        "Workspace → Gmail Seeds": {"inbox": 0, "spam": 0, "promotions": 0, "replies": 0, "total": 0},
        "SMTP → Gmail Seeds": {"inbox": 0, "spam": 0, "promotions": 0, "replies": 0, "total": 0},
        "SMTP → Workspace": {"inbox": 0, "spam": 0, "promotions": 0, "replies": 0, "total": 0},
        "Workspace → SMTP": {"inbox": 0, "spam": 0, "promotions": 0, "replies": 0, "total": 0}
    }
    for s_em, a_em, a_type, init_fld, res, rep in all_rows:
        ctype = classify_campaign_type(s_em, a_em, a_type)
        if ctype in all_time_ct:
            if init_fld == "Inbox":
                all_time_ct[ctype]["inbox"] += 1
            elif init_fld == "Spam":
                all_time_ct[ctype]["spam"] += 1
            elif init_fld == "Promotions":
                all_time_ct[ctype]["promotions"] += 1
            if rep:
                all_time_ct[ctype]["replies"] += 1
            all_time_ct[ctype]["total"] += 1

    conn.close()

    mailbox_stats = []
    for a in accounts:
        em = a["email"]
        r = db_stats.get(em)
        if r:
            mailbox_stats.append({
                "email": em,
                "type": email_to_type.get(em, "workspace"),
                "inbox": r[1] or 0,
                "spam": r[2] or 0,
                "promotions": r[3] or 0,
                "rescued": r[4] or 0,
                "replied": r[5] or 0,
                "unread": r[6] or 0,
                "total": r[7] or 0,
                "status_info": account_statuses.get(em, {"status": "Untested", "error": None})
            })
        else:
            mailbox_stats.append({
                "email": em,
                "type": email_to_type.get(em, "workspace"),
                "inbox": 0,
                "spam": 0,
                "promotions": 0,
                "rescued": 0,
                "replied": 0,
                "unread": 0,
                "total": 0,
                "status_info": account_statuses.get(em, {"status": "Untested", "error": None})
            })

    return jsonify({
        "total_processed": total_processed,
        "total_rescued": total_rescued,
        "total_replied": total_replied,
        "folder_breakdown": folder_breakdown,
        "mailbox_stats": mailbox_stats,
        "latest_scan_stats": latest_scan_stats,
        "all_time_campaign_type_stats": all_time_ct,
        "target_tokens": target_tokens,
        "lookback_days": lookback_days,
        "is_running": is_running,
        "logs": execution_logs[-60:]
    })

@app.route("/api/reset_recent", methods=["POST"])
@app.route("/api/dashboard/reset", methods=["POST"])
@app.route("/api/worker/reset", methods=["POST"])
def reset_recent():
    global latest_scan_stats, cached_scan_items
    latest_scan_stats = {
        "inbox": 0, "spam": 0, "promotions": 0, "total": 0, "rescued": 0, "replied": 0,
        "campaign_type_stats": {
            "Workspace → Employees": {"inbox": 0, "spam": 0, "promotions": 0, "replies": 0, "total": 0},
            "SMTP → Employees": {"inbox": 0, "spam": 0, "promotions": 0, "replies": 0, "total": 0},
            "Workspace → Gmail Seeds": {"inbox": 0, "spam": 0, "promotions": 0, "replies": 0, "total": 0},
            "SMTP → Gmail Seeds": {"inbox": 0, "spam": 0, "promotions": 0, "replies": 0, "total": 0},
            "SMTP → Workspace": {"inbox": 0, "spam": 0, "promotions": 0, "replies": 0, "total": 0},
            "Workspace → SMTP": {"inbox": 0, "spam": 0, "promotions": 0, "replies": 0, "total": 0}
        }
    }
    cached_scan_items = []
    add_log("Recent scan analysis was reset by user.", "INFO")
    return jsonify({"status": "ok", "latest_scan_stats": latest_scan_stats})

@app.route("/api/config", methods=["GET", "POST"])
@app.route("/api/worker/config", methods=["GET", "POST"])
def update_config():
    global target_tokens, lookback_days
    if request.method == "POST":
        data = request.json or {}
        if "tokens" in data:
            target_tokens = [t.strip() for t in data["tokens"] if t.strip()]
        if "lookback_days" in data:
            lookback_days = str(data["lookback_days"]).strip()
        _, _, lb_disp = parse_lookback(lookback_days)
        add_log(f"Config updated: Lookback={lb_disp}, Tokens={target_tokens}", "INFO")
    return jsonify({"status": "ok", "target_tokens": target_tokens, "lookback_days": lookback_days})

def execute_step1_background(set_running_flag=True):
    global is_running, stop_requested, cached_scan_items, latest_scan_stats
    _, _, lb_disp = parse_lookback(lookback_days)
    add_log(f"=== STEP 1: SCANNING INBOXES (Lookback: {lb_disp} | Tokens: {','.join(target_tokens)}) ===", "HEADER")
    try:
        accounts = load_accounts()
        raw_items = []

        with ThreadPoolExecutor(max_workers=max_threads) as executor:
            futures = [executor.submit(scan_single_account, acc, lookback_days, target_tokens) for acc in accounts]
            for f in as_completed(futures):
                acc, stats, items = f.result()
                raw_items.extend(items)

        # Global deduplication across thread results by (email, msg_id)
        seen_global = set()
        deduped_items = []
        for item in raw_items:
            key = (item["account"]["email"].lower(), item["msg_id"])
            if key not in seen_global:
                seen_global.add(key)
                deduped_items.append(item)

        cached_scan_items = deduped_items

        tot_in = sum(1 for it in cached_scan_items if it.get("folder_type") == "Inbox")
        tot_sp = sum(1 for it in cached_scan_items if it.get("folder_type") == "Spam")
        tot_pr = sum(1 for it in cached_scan_items if it.get("folder_type") == "Promotions")
        tot_unr = sum(1 for it in cached_scan_items if it.get("is_unread"))

        ct_breakdown = {
            "Workspace → Employees": {"inbox": 0, "spam": 0, "promotions": 0, "replies": 0, "total": 0},
            "SMTP → Employees": {"inbox": 0, "spam": 0, "promotions": 0, "replies": 0, "total": 0},
            "Workspace → Gmail Seeds": {"inbox": 0, "spam": 0, "promotions": 0, "replies": 0, "total": 0},
            "SMTP → Gmail Seeds": {"inbox": 0, "spam": 0, "promotions": 0, "replies": 0, "total": 0},
            "SMTP → Workspace": {"inbox": 0, "spam": 0, "promotions": 0, "replies": 0, "total": 0},
            "Workspace → SMTP": {"inbox": 0, "spam": 0, "promotions": 0, "replies": 0, "total": 0}
        }
        for it in cached_scan_items:
            ctype = classify_campaign_type(it.get("sender_email"), it.get("account", {}).get("email"), it.get("account", {}).get("account_type"))
            if ctype in ct_breakdown:
                ftype = it.get("folder_type")
                if ftype == "Inbox": ct_breakdown[ctype]["inbox"] += 1
                elif ftype == "Spam": ct_breakdown[ctype]["spam"] += 1
                elif ftype == "Promotions": ct_breakdown[ctype]["promotions"] += 1
                ct_breakdown[ctype]["total"] += 1

        latest_scan_stats = {
            "inbox": tot_in,
            "unread": tot_unr,
            "spam": tot_sp,
            "promotions": tot_pr,
            "total": len(cached_scan_items),
            "rescued": 0,
            "replied": 0,
            "campaign_type_stats": ct_breakdown
        }

        add_log(f"=== STEP 1 COMPLETE: Found {len(cached_scan_items)} recent unread emails matching filters (Inbox: {tot_in}, Spam: {tot_sp}, Promo: {tot_pr}) ===", "HEADER")
    except Exception as e:
        add_log(f"Error in Step 1 Scan: {e}", "ERROR")
    finally:
        if set_running_flag:
            is_running = False

def execute_full_cycle_background():
    global is_running, stop_requested
    add_log("=== RUNNING FULL CYCLE: STEP 1 (SCAN & COUNT) -> STEP 2 (RESCUE & REPLY) ===", "HEADER")
    try:
        execute_step1_background(set_running_flag=False)
        if stop_requested:
            add_log("Full cycle halted after Step 1 due to stop request.", "WARNING")
            return
        execute_step2_background(set_running_flag=False)
    except Exception as e:
        add_log(f"Error in Full Cycle: {e}", "ERROR")
    finally:
        is_running = False

@app.route("/api/step1_scan", methods=["POST"])
@app.route("/api/worker/step1", methods=["POST"])
@app.route("/api/worker/scan", methods=["POST"])
def step1_scan():
    """Step 1: Scans inboxes and records exact count of Inbox and Spam BEFORE sending replies."""
    global is_running, stop_requested, target_tokens, lookback_days
    if is_running:
        return jsonify({"status": "error", "message": "Task already running"}), 400

    data = request.json or {}
    if "target_senders" in data and data["target_senders"]:
        target_tokens = [t.strip() for t in data["target_senders"] if t.strip()]
    if "lookback_from" in data and data["lookback_from"]:
        lookback_days = str(data["lookback_from"]).strip()

    is_running = True
    stop_requested = False
    t = threading.Thread(target=execute_step1_background, daemon=True)
    t.start()
    return jsonify({"status": "ok", "message": "Scan started in background", "is_running": True})

@app.route("/api/step2_engage", methods=["POST"])
@app.route("/api/worker/step2", methods=["POST"])
@app.route("/api/worker/engage", methods=["POST"])
def step2_engage():
    """Step 2: Rescues from Spam and sends natural threaded replies across mailboxes."""
    global is_running, stop_requested, cached_scan_items, target_tokens, lookback_days
    if is_running:
        return jsonify({"status": "error", "message": "Task already running"}), 400

    data = request.json or {}
    if "target_senders" in data and data["target_senders"]:
        target_tokens = [t.strip() for t in data["target_senders"] if t.strip()]
    if "lookback_from" in data and data["lookback_from"]:
        lookback_days = str(data["lookback_from"]).strip()

    is_running = True
    stop_requested = False
    
    t = threading.Thread(target=execute_step2_background, daemon=True)
    t.start()
    return jsonify({"status": "ok", "message": "Engagement started in background", "is_running": True})

@app.route("/api/full_cycle", methods=["POST"])
@app.route("/api/worker/full_cycle", methods=["POST"])
def full_cycle_api():
    """Runs Step 1 (Scan & Count) followed by Step 2 (Rescue & Reply) seamlessly in sequence."""
    global is_running, stop_requested, target_tokens, lookback_days
    if is_running:
        return jsonify({"status": "error", "message": "Task already running"}), 400

    data = request.json or {}
    if "target_senders" in data and data["target_senders"]:
        target_tokens = [t.strip() for t in data["target_senders"] if t.strip()]
    if "lookback_from" in data and data["lookback_from"]:
        lookback_days = str(data["lookback_from"]).strip()

    is_running = True
    stop_requested = False
    t = threading.Thread(target=execute_full_cycle_background, daemon=True)
    t.start()
    return jsonify({"status": "ok", "message": "Full Cycle (Step 1 + Step 2) started in background", "is_running": True})

@app.route("/api/stop", methods=["POST"])
@app.route("/api/worker/stop", methods=["POST"])
def stop_execution():
    global stop_requested
    stop_requested = True
    add_log("⚠️ USER INITIATED EMERGENCY STOP! Halting all threads...", "WARNING")
    return jsonify({"status": "ok", "message": "Stop signal sent"})

# ==================== ACCOUNTS CRUD & TEST API ====================
@app.route("/api/accounts", methods=["GET"])
@app.route("/api/worker/accounts", methods=["GET"])
def get_accounts():
    accounts = load_accounts()
    safe_accounts = []
    for a in accounts:
        item = dict(a)
        item["status_info"] = account_statuses.get(a["email"], {"status": "Untested", "error": None})
        safe_accounts.append(item)
    return jsonify(safe_accounts)

@app.route("/api/accounts", methods=["POST"])
@app.route("/api/worker/accounts", methods=["POST"])
def add_account():
    data = request.json or {}
    email_val = data.get("email", "").strip()
    if not email_val:
        return jsonify({"status": "error", "message": "Email is required"}), 400

    accounts = load_accounts()
    existing = next((a for a in accounts if a["email"].lower() == email_val.lower()), None)
    if existing:
        if data.get("password"):
            existing["password"] = data.get("password")
        existing["account_type"] = data.get("account_type", existing.get("account_type", "workspace"))
        existing["imap_host"] = data.get("imap_host", existing.get("imap_host", "imap.gmail.com"))
        existing["imap_port"] = int(data.get("imap_port", existing.get("imap_port", 993)))
        existing["smtp_host"] = data.get("smtp_host", existing.get("smtp_host", "smtp.gmail.com"))
        existing["smtp_port"] = int(data.get("smtp_port", existing.get("smtp_port", 587)))
        existing["display_name"] = data.get("display_name", existing.get("display_name", email_val.split("@")[0]))
        if "signature" in data:
            existing["signature"] = data.get("signature")
        save_accounts(accounts)
        add_log(f"Updated account: {email_val}", "SUCCESS")
        return jsonify({"status": "ok", "action": "updated"})

    password_val = data.get("password", "")
    new_acc = {
        "email": email_val,
        "password": password_val,
        "account_type": data.get("account_type", "workspace"),
        "imap_host": data.get("imap_host", "imap.gmail.com"),
        "imap_port": int(data.get("imap_port", 993)),
        "smtp_host": data.get("smtp_host", "smtp.gmail.com"),
        "smtp_port": int(data.get("smtp_port", 587)),
        "display_name": data.get("display_name", email_val.split("@")[0]),
        "signature": data.get("signature", f"\n\nRegards,\n{email_val.split('@')[0]}")
    }
    accounts.append(new_acc)
    save_accounts(accounts)
    add_log(f"Added new mailbox: {email_val} ({new_acc['account_type']})", "SUCCESS")
    return jsonify({"status": "ok", "account": new_acc})


@app.route("/api/accounts/bulk-delete", methods=["POST"])
@app.route("/api/worker/accounts/bulk-delete", methods=["POST"])
def bulk_delete_accounts():
    data = request.json or {}
    emails_to_del = [e.lower() for e in data.get("emails", [])]
    accounts = load_accounts()
    filtered = [a for a in accounts if a["email"].lower() not in emails_to_del]
    deleted_count = len(accounts) - len(filtered)
    save_accounts(filtered)
    add_log(f"Deleted {deleted_count} selected accounts.", "WARNING")
    return jsonify({"status": "ok", "deleted_count": deleted_count})

@app.route("/api/accounts/test", methods=["POST"])
@app.route("/api/worker/accounts/test", methods=["POST"])
def test_account():
    data = request.json or {}
    email_val = data.get("email")
    accounts = load_accounts()
    acc = next((a for a in accounts if a["email"].lower() == email_val.lower()), None)
    if not acc:
        return jsonify({"status": "error", "message": "Account not found"}), 404

    try:
        imap_host = acc.get("imap_host", "imap.gmail.com")
        imap_port = int(acc.get("imap_port", 993))
        imap = imaplib.IMAP4_SSL(imap_host, imap_port, timeout=10)
        imap.login(acc["email"], acc["password"])
        imap.logout()
        account_statuses[acc["email"]] = {"status": "Connected", "error": None, "last_tested": datetime.datetime.now().strftime("%H:%M:%S")}
        return jsonify({"status": "ok", "message": "Connected"})
    except Exception as e:
        account_statuses[acc["email"]] = {"status": "Not Connected", "error": str(e), "last_tested": datetime.datetime.now().strftime("%H:%M:%S")}
        return jsonify({"status": "error", "message": str(e)}), 400

@app.route("/api/accounts/test-all", methods=["POST"])
@app.route("/api/worker/accounts/test-all", methods=["POST"])
def test_all_accounts():
    accounts = load_accounts()
    def _test(acc):
        em = acc["email"]
        try:
            imap_host = acc.get("imap_host", "imap.gmail.com")
            imap_port = int(acc.get("imap_port", 993))
            imap = imaplib.IMAP4_SSL(imap_host, imap_port, timeout=10)
            imap.login(em, acc["password"])
            imap.logout()
            account_statuses[em] = {"status": "Connected", "error": None, "last_tested": datetime.datetime.now().strftime("%H:%M:%S")}
        except Exception as e:
            account_statuses[em] = {"status": "Not Connected", "error": str(e), "last_tested": datetime.datetime.now().strftime("%H:%M:%S")}

    with ThreadPoolExecutor(max_workers=max_threads) as executor:
        list(executor.map(_test, accounts))
    return jsonify({"status": "ok", "account_statuses": account_statuses})

# ==================== WARMUP REPLIES API ====================
@app.route("/api/replies", methods=["GET"])
@app.route("/api/worker/replies", methods=["GET"])
def get_replies():
    lines = load_reply_templates()
    return jsonify({"replies": lines})

@app.route("/api/replies", methods=["POST"])
@app.route("/api/worker/replies", methods=["POST"])
def add_reply():
    data = request.json or {}
    text = data.get("text", "").strip()
    if not text:
        return jsonify({"status": "error", "message": "Reply text cannot be empty"}), 400
    lines = load_reply_templates()
    lines.append(text)
    save_reply_templates(lines)
    add_log("Added new warmup reply template", "SUCCESS")
    return jsonify({"status": "ok", "replies": lines})

@app.route("/api/replies/update", methods=["POST"])
@app.route("/api/worker/replies/update", methods=["POST"])
def update_reply():
    data = request.json or {}
    idx = data.get("index")
    text = data.get("text", "").strip()
    lines = load_reply_templates()
    if idx is None or idx < 0 or idx >= len(lines) or not text:
        return jsonify({"status": "error", "message": "Invalid index or empty text"}), 400
    lines[idx] = text
    save_reply_templates(lines)
    add_log(f"Updated reply template #{idx + 1}", "SUCCESS")
    return jsonify({"status": "ok", "replies": lines})

@app.route("/api/replies/<int:idx>", methods=["DELETE"])
@app.route("/api/worker/replies/<int:idx>", methods=["DELETE"])
def delete_reply(idx):
    lines = load_reply_templates()
    if idx < 0 or idx >= len(lines):
        return jsonify({"status": "error", "message": "Invalid index"}), 400
    deleted_text = lines.pop(idx)
    save_reply_templates(lines)
    add_log(f"Deleted reply template: {deleted_text[:30]}...", "WARNING")
    return jsonify({"status": "ok", "replies": lines})

# ==================== HTML / TAILWIND MODERN UI ====================
HTML_TEMPLATE = """
<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">
  <title>Deliverability & Warmup Engine</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
  <script>
    tailwind.config = {
      darkMode: 'class',
      theme: {
        extend: {
          colors: {
            darkbg: '#080c14',
            darkcard: '#111827',
            darkborder: '#1e293b',
            darkhover: '#1a2234'
          }
        }
      }
    }
  </script>
</head>
<body class="bg-darkbg text-slate-100 min-h-screen flex font-sans overflow-hidden">

  <!-- ==================== 1. SIDEBAR ==================== -->
  <aside class="w-72 bg-darkcard border-r border-darkborder flex flex-col justify-between shrink-0 shadow-2xl z-20">
    <div>
      <!-- Top Branding -->
      <div class="px-6 py-6 border-b border-darkborder flex items-center space-x-3.5">
        <div class="h-11 w-11 bg-gradient-to-tr from-indigo-600 to-violet-500 rounded-2xl flex items-center justify-center text-white font-black text-xl shadow-lg shadow-indigo-600/30">
          <i class="fa-solid fa-paper-plane"></i>
        </div>
        <div>
          <h1 class="text-sm font-extrabold tracking-tight text-white leading-tight">Deliverability & Warmup</h1>
          <p class="text-[11px] font-semibold text-indigo-400">Headless Engine</p>
        </div>
      </div>

      <!-- Navigation Links (5 Items in exact requested order) -->
      <nav class="p-4 space-y-1.5 text-sm font-medium">
        <button onclick="switchTab('dashboard')" id="nav-dashboard" class="nav-item w-full flex items-center gap-3.5 px-4 py-3 rounded-xl bg-indigo-600 text-white font-semibold transition-all shadow-md">
          <i class="fa-solid fa-chart-line w-5 text-center text-base"></i> Dashboard
        </button>
        <button onclick="switchTab('matrix')" id="nav-matrix" class="nav-item w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-darkhover transition-all">
          <i class="fa-solid fa-table-list w-5 text-center text-base"></i> Deliverability Matrix
        </button>
        <button onclick="switchTab('controls')" id="nav-controls" class="nav-item w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-darkhover transition-all">
          <i class="fa-solid fa-sliders w-5 text-center text-base"></i> Execution Controls
        </button>
        <button onclick="switchTab('accounts')" id="nav-accounts" class="nav-item w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-darkhover transition-all">
          <i class="fa-solid fa-users-gear w-5 text-center text-base"></i> Accounts
        </button>
        <button onclick="switchTab('replies')" id="nav-replies" class="nav-item w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-darkhover transition-all">
          <i class="fa-solid fa-reply-all w-5 text-center text-base"></i> Warmup Replies
        </button>
      </nav>
    </div>

    <!-- Status Indicator -->
    <div class="p-4 border-t border-darkborder">
      <div class="bg-darkbg border border-darkborder rounded-xl p-3.5 flex items-center justify-between">
        <div class="flex items-center space-x-2.5">
          <span id="sidebarStatusDot" class="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
          <span id="sidebarStatusText" class="text-xs font-bold text-slate-300">IDLE / READY</span>
        </div>
      </div>
    </div>
  </aside>

  <!-- ==================== 2. MAIN CONTENT AREA ==================== -->
  <div class="flex-1 flex flex-col h-screen overflow-y-auto">
    
    <!-- Top Header Bar -->
    <header class="bg-darkcard/90 backdrop-blur border-b border-darkborder px-8 py-4 flex items-center justify-between sticky top-0 z-10">
      <div>
        <h2 id="pageTitle" class="text-lg font-bold text-slate-100">Deliverability Overview & Live Telemetry</h2>
        <p id="pageSubtitle" class="text-xs text-slate-400">Pure analysis view • Inboxing ratios & engagement trends</p>
      </div>
    </header>

    <!-- ==================== 1. DASHBOARD (ANALYSIS ONLY) ==================== -->
    <section id="tab-dashboard" class="p-8 space-y-8 flex-1">
      
      <!-- Section 1: Recent Scan Analysis (Current Run) with Reset Button -->
      <div>
        <div class="flex items-center justify-between mb-3">
          <h3 class="text-xs uppercase tracking-widest font-black text-indigo-400 flex items-center gap-2">
            <i class="fa-solid fa-bolt text-indigo-400"></i> Recent Scan Analysis (Current Run)
          </h3>
          <div class="flex items-center gap-2">
            <button onclick="runStep1()" class="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition-all shadow flex items-center gap-1.5">
              <i class="fa-solid fa-magnifying-glass-chart"></i> Step 1: Scan & Count
            </button>
            <button onclick="runStep2()" class="px-3 py-1 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-bold transition-all shadow flex items-center gap-1.5">
              <i class="fa-solid fa-shield-halved"></i> Step 2: Rescue & Reply
            </button>
            <button onclick="runFullAuto()" class="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-all shadow flex items-center gap-1.5">
              <i class="fa-solid fa-bolt"></i> Run Full Cycle
            </button>
            <button onclick="resetRecentScan()" class="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-xs font-bold transition-all border border-darkborder flex items-center gap-1.5">
              <i class="fa-solid fa-rotate-left text-[10px]"></i> Reset Current Run
            </button>
          </div>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div class="bg-darkcard border border-darkborder rounded-2xl p-4 shadow-md">
            <div class="text-[11px] text-slate-400 font-bold uppercase">Recent Discovered (Unread)</div>
            <div id="recTotal" class="text-2xl font-black text-white mt-1">0</div>
            <div class="text-[10px] text-slate-500 mt-1">Unread matching filter</div>
          </div>
          <div class="bg-darkcard border border-darkborder rounded-2xl p-4 shadow-md">
            <div class="text-[11px] text-emerald-400 font-bold uppercase flex justify-between">
              <span>Recent Inbox (Unread)</span> <i class="fa-solid fa-inbox"></i>
            </div>
            <div id="recInbox" class="text-2xl font-black text-emerald-400 mt-1">0</div>
            <div id="recInboxRate" class="text-[10px] text-emerald-500 mt-1">0% placement</div>
          </div>
          <div class="bg-darkcard border border-darkborder rounded-2xl p-4 shadow-md">
            <div class="text-[11px] text-rose-400 font-bold uppercase flex justify-between">
              <span>Recent Spam (Unread)</span> <i class="fa-solid fa-ban"></i>
            </div>
            <div id="recSpam" class="text-2xl font-black text-rose-400 mt-1">0</div>
            <div id="recSpamRate" class="text-[10px] text-rose-500 mt-1">0% spam rate</div>
          </div>
          <div class="bg-darkcard border border-darkborder rounded-2xl p-4 shadow-md">
            <div class="text-[11px] text-amber-400 font-bold uppercase flex justify-between">
              <span>Recent Rescued</span> <i class="fa-solid fa-arrow-up-from-bracket"></i>
            </div>
            <div id="recRescued" class="text-2xl font-black text-amber-400 mt-1">0</div>
            <div class="text-[10px] text-amber-500 mt-1">Moved to Inbox</div>
          </div>
          <div class="bg-darkcard border border-darkborder rounded-2xl p-4 shadow-md">
            <div class="text-[11px] text-purple-400 font-bold uppercase flex justify-between">
              <span>Recent Replied</span> <i class="fa-solid fa-reply"></i>
            </div>
            <div id="recReplied" class="text-2xl font-black text-purple-400 mt-1">0</div>
            <div class="text-[10px] text-purple-500 mt-1">Unread replies sent</div>
          </div>
        </div>
      </div>

      <!-- Section 2: All-Time Telemetry & Aggregate Inboxing (Matching Screenshot) -->
      <div>
        <div class="flex items-center justify-between mb-3">
          <h3 class="text-xs uppercase tracking-widest font-black text-slate-400 flex items-center gap-2">
            <i class="fa-solid fa-database text-slate-400"></i> All-Time Telemetry & Aggregate Inboxing
          </h3>
          <span class="text-[11px] text-slate-500 font-medium">Persisted in warmup_telemetry.db</span>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div class="bg-darkcard border border-darkborder rounded-2xl p-5 shadow-md">
            <div class="text-xs text-slate-400 font-bold uppercase tracking-wider">TOTAL CAMPAIGN EMAILS</div>
            <div id="statTotal" class="text-3xl font-extrabold text-white mt-2">0</div>
            <div class="text-xs text-slate-500 mt-1">Processed across inboxes</div>
          </div>
          <div class="bg-darkcard border border-darkborder rounded-2xl p-5 shadow-md">
            <div class="text-xs text-emerald-400 font-bold uppercase tracking-wider flex justify-between">
              <span>INBOX PLACEMENT</span> <i class="fa-solid fa-inbox"></i>
            </div>
            <div id="statInbox" class="text-3xl font-extrabold text-emerald-400 mt-2">0</div>
            <div id="statInboxRate" class="text-xs text-emerald-500 mt-1">0% Deliverability</div>
          </div>
          <div class="bg-darkcard border border-darkborder rounded-2xl p-5 shadow-md">
            <div class="text-xs text-rose-400 font-bold uppercase tracking-wider flex justify-between">
              <span>SPAM FOLDER</span> <i class="fa-solid fa-ban"></i>
            </div>
            <div id="statSpam" class="text-3xl font-extrabold text-rose-400 mt-2">0</div>
            <div id="statSpamRate" class="text-xs text-rose-500 mt-1">0% Spam Rate</div>
          </div>
          <div class="bg-darkcard border border-darkborder rounded-2xl p-5 shadow-md">
            <div class="text-xs text-amber-400 font-bold uppercase tracking-wider flex justify-between">
              <span>RESCUED FROM SPAM</span> <i class="fa-solid fa-arrow-up-from-bracket"></i>
            </div>
            <div id="statRescued" class="text-3xl font-extrabold text-amber-400 mt-2">0</div>
            <div class="text-xs text-amber-500 mt-1">Moved to Inbox</div>
          </div>
          <div class="bg-darkcard border border-darkborder rounded-2xl p-5 shadow-md">
            <div class="text-xs text-purple-400 font-bold uppercase tracking-wider flex justify-between">
              <span>WARMUP REPLIES</span> <i class="fa-solid fa-reply"></i>
            </div>
            <div id="statReplied" class="text-3xl font-extrabold text-purple-400 mt-2">0</div>
            <div class="text-xs text-purple-500 mt-1">35% Threaded replies</div>
          </div>
        </div>
      </div>

      <!-- Section 3: Inboxing vs Spam Ratio + Reply Activity Graph (Side by Side) -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        <!-- Donut Chart: Inboxing vs Spam Ratio (1 Col) -->
        <div class="bg-darkcard border border-darkborder rounded-2xl p-6 shadow-md flex flex-col items-center justify-between">
          <div class="w-full flex items-center justify-between mb-2">
            <h3 class="font-bold text-slate-200 text-sm flex items-center gap-2">
              <i class="fa-solid fa-chart-pie text-emerald-400"></i> Inboxing vs Spam Ratio
            </h3>
          </div>
          <div class="h-56 w-56 relative flex items-center justify-center">
            <canvas id="placementChart"></canvas>
          </div>
          <div class="flex items-center justify-center gap-4 text-xs mt-3 w-full border-t border-darkborder pt-3">
            <span class="flex items-center gap-1.5"><span class="h-2.5 w-2.5 rounded-full bg-emerald-500"></span> Inbox</span>
            <span class="flex items-center gap-1.5"><span class="h-2.5 w-2.5 rounded-full bg-rose-500"></span> Spam</span>
            <span class="flex items-center gap-1.5"><span class="h-2.5 w-2.5 rounded-full bg-amber-500"></span> Promo</span>
          </div>
        </div>

        <!-- Line Graph: Reply Activity Graph (Matching Screenshot Style) (2 Col) -->
        <div class="lg:col-span-2 bg-darkcard border border-darkborder rounded-2xl p-6 shadow-md flex flex-col justify-between">
          <div class="flex items-center justify-between mb-2">
            <div>
              <h3 class="font-bold text-slate-100 text-base">Reply Activity</h3>
              <p class="text-xs text-slate-400 mt-0.5">Last 24 Hours</p>
            </div>
            <span class="px-3 py-1 bg-slate-800 border border-darkborder rounded-lg text-xs font-semibold text-slate-300">
              Replies <i class="fa-solid fa-chevron-down text-[10px] ml-1"></i>
            </span>
          </div>

          <!-- Purple Gradient Smooth Area Chart -->
          <div class="h-44 w-full relative">
            <canvas id="replyActivityChart"></canvas>
          </div>

          <!-- Bottom Stat Badges matching Screenshot -->
          <div class="grid grid-cols-3 gap-4 border-t border-darkborder pt-4 mt-2">
            <div class="flex items-center space-x-3">
              <div class="h-9 w-9 bg-purple-600/20 text-purple-400 rounded-xl flex items-center justify-center text-sm">
                <i class="fa-solid fa-comment-dots"></i>
              </div>
              <div>
                <div class="text-[11px] text-slate-400 font-semibold">Total Replies</div>
                <div id="graphTotalReplies" class="text-base font-bold text-white">42</div>
              </div>
            </div>
            <div class="flex items-center space-x-3">
              <div class="h-9 w-9 bg-emerald-600/20 text-emerald-400 rounded-xl flex items-center justify-center text-sm">
                <i class="fa-solid fa-arrow-trend-up"></i>
              </div>
              <div>
                <div class="text-[11px] text-slate-400 font-semibold">Positive Rate</div>
                <div class="text-base font-bold text-emerald-400">31.2%</div>
              </div>
            </div>
            <div class="flex items-center space-x-3">
              <div class="h-9 w-9 bg-blue-600/20 text-blue-400 rounded-xl flex items-center justify-center text-sm">
                <i class="fa-solid fa-clock"></i>
              </div>
              <div>
                <div class="text-[11px] text-slate-400 font-semibold">Avg. Response Time</div>
                <div class="text-base font-bold text-blue-400">22s delay</div>
              </div>
            </div>
          </div>
        </div>

      </div>

    </section>

    <!-- ==================== 2. PER-MAILBOX MATRIX ==================== -->
    <section id="tab-matrix" class="p-8 space-y-6 flex-1 hidden">
      <div class="bg-darkcard border border-darkborder rounded-2xl p-6 shadow-md">
        <div class="flex items-center justify-between mb-5">
          <div>
            <h3 class="font-bold text-slate-100 text-base flex items-center gap-2">
              <i class="fa-solid fa-table-list text-indigo-400"></i> Per-Mailbox Deliverability Matrix
            </h3>
            <p class="text-xs text-slate-400 mt-0.5">Real-time counts for Inbox, Spam, Promotions, Rescued, Replied & Connection Status</p>
          </div>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs text-slate-300">
            <thead class="bg-slate-800/80 text-slate-400 uppercase text-[10px] font-bold">
              <tr>
                <th class="py-3 px-4">Mailbox Email</th>
                <th class="py-3 px-4">Group Type</th>
                <th class="py-3 px-4 text-center">Status</th>
                <th class="py-3 px-3 text-center text-emerald-400 font-bold">Inbox</th>
                <th class="py-3 px-3 text-center text-sky-400 font-bold">Unread</th>
                <th class="py-3 px-3 text-center text-rose-400 font-bold">Spam</th>
                <th class="py-3 px-3 text-center text-amber-400 font-bold">Promo</th>
                <th class="py-3 px-3 text-center text-blue-400 font-bold">Rescued</th>
                <th class="py-3 px-3 text-center text-purple-400 font-bold">Replied</th>
                <th class="py-3 px-3 text-center text-slate-400">Total</th>
              </tr>
            </thead>
            <tbody id="matrixTableBody" class="divide-y divide-darkborder font-mono">
              <tr><td colspan="10" class="py-8 text-center text-slate-500">No telemetry recorded yet. Run Step 1 in Execution Controls.</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>

    <!-- ==================== 3. EXECUTION CONTROLS ==================== -->
    <section id="tab-controls" class="p-8 space-y-6 flex-1 hidden">
      
      <!-- Primary Action Buttons & Stop -->
      <div class="bg-darkcard border border-darkborder rounded-2xl p-6 shadow-md flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 class="text-base font-bold text-white">Execution Engine Controls</h3>
          <p class="text-xs text-slate-400 mt-1">Initiate placement scanning, spam rescue, and natural threaded replies.</p>
        </div>
        <div class="flex items-center gap-3">
          <button onclick="runStep1()" class="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow-lg transition-all flex items-center gap-2">
            <i class="fa-solid fa-magnifying-glass-chart"></i> Step 1: Scan & Count
          </button>
          <button onclick="runStep2()" class="px-5 py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-xl shadow-lg transition-all flex items-center gap-2">
            <i class="fa-solid fa-shield-halved"></i> Step 2: Rescue & Reply
          </button>
          <button onclick="runFullAuto()" class="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg transition-all flex items-center gap-2">
            <i class="fa-solid fa-bolt"></i> Run Full Cycle (1 + 2)
          </button>
          <button onclick="stopExecution()" class="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl shadow-lg transition-all flex items-center gap-2">
            <i class="fa-solid fa-stop"></i> Emergency Stop
          </button>
        </div>
      </div>

      <!-- Filters: Lookback & Interactive Tag Manager -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        <!-- Lookback Window Filter -->
        <div class="bg-darkcard border border-darkborder rounded-2xl p-6 shadow-md space-y-3">
          <h4 class="text-xs uppercase font-bold text-slate-300 flex items-center gap-2">
            <i class="fa-solid fa-calendar-days text-indigo-400"></i> Scanning Lookback Window
          </h4>
          <p class="text-xs text-slate-400">Select how far back the worker should search for received campaign emails.</p>
          <div class="flex items-center gap-3 pt-2">
            <select id="controlsLookbackSelect" onchange="updateLookbackFilter()" class="bg-darkbg border border-darkborder rounded-xl px-4 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500">
              <option value="1">Last 24 Hours</option>
              <option value="2">Last 2 Days</option>
              <option value="7">Last 7 Days</option>
              <option value="14">Last 14 Days</option>
              <option value="30">Last 30 Days</option>
            </select>
            <span class="text-xs text-emerald-400 font-semibold" id="lookbackSavedText"></span>
          </div>
        </div>

        <!-- Target Sender Tokens (Add / Delete Keywords) -->
        <div class="bg-darkcard border border-darkborder rounded-2xl p-6 shadow-md space-y-3">
          <h4 class="text-xs uppercase font-bold text-slate-300 flex items-center gap-2">
            <i class="fa-solid fa-tags text-indigo-400"></i> Target Sender Keywords
          </h4>
          <p class="text-xs text-slate-400">Matching tokens/domains from Mailwizz delivery servers to track.</p>
          
          <!-- Tag Pills Container -->
          <div id="tokenTagsContainer" class="flex flex-wrap gap-2 pt-1"></div>

          <!-- Add Token Input -->
          <div class="flex items-center gap-2 pt-2">
            <input type="text" id="newTokenInput" placeholder="Add keyword (e.g. hetzner)..." class="bg-darkbg border border-darkborder rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 flex-1">
            <button onclick="addTokenKeyword()" class="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all">
              + Add
            </button>
          </div>
        </div>

      </div>

      <!-- Live Activity & Event Stream Terminal -->
      <div class="bg-darkcard border border-darkborder rounded-2xl p-6 shadow-md flex flex-col">
        <div class="flex items-center justify-between mb-3">
          <h3 class="font-bold text-slate-200 text-sm flex items-center gap-2">
            <i class="fa-solid fa-terminal text-emerald-400"></i> Live Activity & Event Stream
          </h3>
          <button onclick="clearLogs()" class="text-xs text-slate-400 hover:text-slate-200">Clear</button>
        </div>
        <div id="logContainer" class="bg-darkbg border border-darkborder rounded-xl p-4 font-mono text-xs text-slate-300 h-64 overflow-y-auto space-y-1.5">
          <div class="text-slate-500">System idle. Ready to initiate scan or engagement.</div>
        </div>
      </div>

    </section>

    <!-- ==================== 4. ACCOUNTS MANAGEMENT ==================== -->
    <section id="tab-accounts" class="p-8 space-y-6 flex-1 hidden">
      <div class="bg-darkcard border border-darkborder rounded-2xl p-6 shadow-md">
        <div class="flex items-center justify-between mb-6">
          <div>
            <h3 class="font-bold text-slate-100 text-base flex items-center gap-2">
              <i class="fa-solid fa-users-gear text-indigo-400"></i> Accounts Inventory & Connection Health
            </h3>
            <p class="text-xs text-slate-400 mt-0.5">Google Workspace, Gmail Seeds, Employee inboxes and VPS SMTP servers</p>
          </div>
          <div class="flex items-center space-x-3">
            <button onclick="testAllAccounts()" class="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold border border-darkborder flex items-center gap-2">
              <i class="fa-solid fa-arrows-rotate"></i> Test All Connections
            </button>
            <button onclick="deleteSelectedAccounts()" class="px-4 py-2 bg-rose-600/20 hover:bg-rose-600 text-rose-400 hover:text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2">
              <i class="fa-solid fa-trash"></i> Delete Selected
            </button>
            <button onclick="openAddAccountModal()" class="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-lg">
              <i class="fa-solid fa-plus"></i> Add Mailbox
            </button>
          </div>
        </div>

        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs text-slate-300">
            <thead class="bg-slate-800/80 text-slate-400 uppercase text-[10px] font-bold">
              <tr>
                <th class="py-3 px-3 text-center"><input type="checkbox" id="selectAllAccounts" onchange="toggleSelectAll(this)" class="rounded bg-darkbg border-darkborder"></th>
                <th class="py-3 px-4">Email Address</th>
                <th class="py-3 px-4">Account Type</th>
                <th class="py-3 px-4">IMAP Host</th>
                <th class="py-3 px-4">SMTP Host</th>
                <th class="py-3 px-4 text-center">Status</th>
                <th class="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody id="accountsTableBody" class="divide-y divide-darkborder font-mono">
              <tr><td colspan="7" class="py-6 text-center text-slate-500">Loading accounts...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>

    <!-- ==================== 5. WARMUP REPLIES (NEW SECTION) ==================== -->
    <section id="tab-replies" class="p-8 space-y-6 flex-1 hidden">
      <div class="bg-darkcard border border-darkborder rounded-2xl p-6 shadow-md">
        <div class="flex items-center justify-between mb-6">
          <div>
            <h3 class="font-bold text-slate-100 text-base flex items-center gap-2">
              <i class="fa-solid fa-reply-all text-indigo-400"></i> Warmup Reply Templates
            </h3>
            <p class="text-xs text-slate-400 mt-0.5">Rotational conversational replies used for Case 5 & Case 6 warmup engagement</p>
          </div>
          <button onclick="openAddReplyModal()" class="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-lg">
            <i class="fa-solid fa-plus"></i> Add New Reply
          </button>
        </div>

        <div id="repliesListContainer" class="space-y-3 font-sans">
          <!-- Rendered via JS -->
        </div>
      </div>
    </section>

  </div>

  <!-- ADD / EDIT ACCOUNT MODAL -->
  <div id="addAccountModal" class="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 hidden flex items-center justify-center p-4">
    <div class="bg-darkcard border border-darkborder rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
      <div class="flex items-center justify-between border-b border-darkborder pb-3">
        <h3 id="accountModalTitle" class="text-sm font-bold text-white flex items-center gap-2">
          <i class="fa-solid fa-user-plus text-indigo-400"></i> Add / Edit Mailbox Account
        </h3>
        <button onclick="closeAddAccountModal()" class="text-slate-400 hover:text-slate-200"><i class="fa-solid fa-xmark"></i></button>
      </div>
      <div class="space-y-3 text-xs">
        <div>
          <label class="block text-slate-400 font-semibold mb-1">Email Address</label>
          <input type="email" id="modalEmail" class="w-full bg-darkbg border border-darkborder rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500">
        </div>
        <div>
          <label class="block text-slate-400 font-semibold mb-1">App Password / SMTP Password</label>
          <input type="password" id="modalPass" class="w-full bg-darkbg border border-darkborder rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500">
        </div>
        <div>
          <label class="block text-slate-400 font-semibold mb-1">Account Type</label>
          <select id="modalType" class="w-full bg-darkbg border border-darkborder rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500">
            <option value="workspace">Workspace (.com - Warmup Target)</option>
            <option value="smtp">SMTP (VPS / Hetzner - Warmup Target)</option>
            <option value="seed">Seed (Gmail.com - Measure Only)</option>
            <option value="employee">Employee (Test / Control - Measure Only)</option>
          </select>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-slate-400 font-semibold mb-1">IMAP Host</label>
            <input type="text" id="modalImap" value="imap.gmail.com" class="w-full bg-darkbg border border-darkborder rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500">
          </div>
          <div>
            <label class="block text-slate-400 font-semibold mb-1">SMTP Host</label>
            <input type="text" id="modalSmtp" value="smtp.gmail.com" class="w-full bg-darkbg border border-darkborder rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500">
          </div>
        </div>
      </div>
      <div class="flex justify-end gap-3 pt-3 border-t border-darkborder">
        <button onclick="closeAddAccountModal()" class="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold">Cancel</button>
        <button onclick="submitAddAccount()" class="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold">Save Account</button>
      </div>
    </div>
  </div>

  <!-- ADD / EDIT REPLY MODAL -->
  <div id="replyModal" class="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 hidden flex items-center justify-center p-4">
    <div class="bg-darkcard border border-darkborder rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-4">
      <div class="flex items-center justify-between border-b border-darkborder pb-3">
        <h3 id="replyModalTitle" class="text-sm font-bold text-white flex items-center gap-2">
          <i class="fa-solid fa-pen text-indigo-400"></i> Add Warmup Reply
        </h3>
        <button onclick="closeReplyModal()" class="text-slate-400 hover:text-slate-200"><i class="fa-solid fa-xmark"></i></button>
      </div>
      <div>
        <input type="hidden" id="replyEditIndex" value="-1">
        <label class="block text-slate-400 text-xs font-semibold mb-1">Reply Message Content</label>
        <textarea id="replyTextContent" rows="4" class="w-full bg-darkbg border border-darkborder rounded-xl p-3 text-xs text-white focus:outline-none focus:border-indigo-500" placeholder="Type natural conversation response..."></textarea>
      </div>
      <div class="flex justify-end gap-3 pt-2">
        <button onclick="closeReplyModal()" class="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold">Cancel</button>
        <button onclick="submitReply()" class="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold">Save Reply</button>
      </div>
    </div>
  </div>

  <!-- JAVASCRIPT LOGIC -->
  <script>
    let myChart = null;
    let replyChart = null;

    function switchTab(tabId) {
      document.querySelectorAll('section[id^="tab-"]').forEach(el => el.classList.add('hidden'));
      document.querySelectorAll('.nav-item').forEach(el => {
        el.className = "nav-item w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-darkhover transition-all";
      });

      document.getElementById('tab-' + tabId).classList.remove('hidden');
      const activeNav = document.getElementById('nav-' + tabId);
      activeNav.className = "nav-item w-full flex items-center gap-3.5 px-4 py-3 rounded-xl bg-indigo-600 text-white font-semibold transition-all shadow-md";

      const titles = {
        'dashboard': ['Deliverability Overview & Live Telemetry', 'Pure analysis view • Inboxing ratios & engagement trends'],
        'matrix': ['Per-Mailbox Deliverability Matrix', 'Comprehensive breakdown of Inbox vs Spam vs Rescues'],
        'controls': ['Execution Controls & Warmup Engine', 'Placement Discovery, Spam Rescues & Automated Replies'],
        'accounts': ['Accounts & Mailbox Inventory', 'Manage Google Workspace, Gmail Seeds, and VPS SMTP servers'],
        'replies': ['Warmup Replies Management', 'Rotational email responses used for thread engagement']
      };
      document.getElementById('pageTitle').innerText = titles[tabId][0];
      document.getElementById('pageSubtitle').innerText = titles[tabId][1];

      if (tabId === 'accounts') loadAccounts();
      if (tabId === 'replies') loadReplies();
      if (tabId === 'controls') renderTokenTags();
    }

    function initCharts() {
      // 1. Donut Chart
      const ctx1 = document.getElementById('placementChart').getContext('2d');
      myChart = new Chart(ctx1, {
        type: 'doughnut',
        data: {
          labels: ['Inbox', 'Spam', 'Promotions'],
          datasets: [{
            data: [0, 0, 0],
            backgroundColor: ['#10b981', '#f43f5e', '#f59e0b'],
            borderWidth: 0
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          cutout: '70%'
        }
      });

      // 2. Reply Activity Line Chart (Matching Screenshot Style)
      const ctx2 = document.getElementById('replyActivityChart').getContext('2d');
      const gradient = ctx2.createLinearGradient(0, 0, 0, 160);
      gradient.addColorStop(0, 'rgba(168, 85, 247, 0.4)');
      gradient.addColorStop(1, 'rgba(168, 85, 247, 0.0)');

      replyChart = new Chart(ctx2, {
        type: 'line',
        data: {
          labels: ['12 AM', '2 AM', '4 AM', '6 AM', '8 AM', '10 AM', '12 PM', '2 PM', '4 PM', '6 PM', '8 PM', '10 PM'],
          datasets: [{
            data: [28, 52, 70, 110, 85, 60, 115, 170, 150, 120, 90, 145],
            borderColor: '#a855f7',
            backgroundColor: gradient,
            fill: true,
            tension: 0.4,
            borderWidth: 2.5,
            pointBackgroundColor: '#ffffff',
            pointBorderColor: '#a855f7',
            pointBorderWidth: 2,
            pointRadius: 4,
            pointHoverRadius: 6
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: {
              grid: { color: 'rgba(255, 255, 255, 0.04)' },
              ticks: { color: '#64748b', font: { size: 10 } }
            },
            y: {
              grid: { color: 'rgba(255, 255, 255, 0.04)' },
              ticks: { color: '#64748b', font: { size: 10 } }
            }
          }
        }
      });
    }

    async function fetchStats() {
      try {
        const res = await fetch('/api/stats');
        const data = await res.json();

        // 1. All-Time Telemetry
        document.getElementById('statTotal').innerText = data.total_processed;
        const inCnt = data.folder_breakdown['Inbox'] || 0;
        const spCnt = data.folder_breakdown['Spam'] || 0;
        const prCnt = data.folder_breakdown['Promotions'] || 0;

        document.getElementById('statInbox').innerText = inCnt;
        document.getElementById('statSpam').innerText = spCnt;
        document.getElementById('statRescued').innerText = data.total_rescued;
        document.getElementById('statReplied').innerText = data.total_replied;
        document.getElementById('graphTotalReplies').innerText = data.total_replied;

        if (data.total_processed > 0) {
          document.getElementById('statInboxRate').innerText = `${((inCnt / data.total_processed)*100).toFixed(1)}% Deliverability`;
          document.getElementById('statSpamRate').innerText = `${((spCnt / data.total_processed)*100).toFixed(1)}% Spam Rate`;
        }

        // 2. Recent Scan Stats
        const rec = data.latest_scan_stats || {};
        document.getElementById('recTotal').innerText = rec.total || 0;
        document.getElementById('recInbox').innerText = rec.inbox || 0;
        document.getElementById('recSpam').innerText = rec.spam || 0;
        document.getElementById('recRescued').innerText = rec.rescued || 0;
        document.getElementById('recReplied').innerText = rec.replied || 0;
        if (rec.total > 0) {
          document.getElementById('recInboxRate').innerText = `${((rec.inbox / rec.total)*100).toFixed(1)}% placement`;
          document.getElementById('recSpamRate').innerText = `${((rec.spam / rec.total)*100).toFixed(1)}% spam rate`;
        }

        // 3. Donut Chart Update
        if (myChart) {
          myChart.data.datasets[0].data = [inCnt, spCnt, prCnt];
          myChart.update();
        }

        // 4. Matrix Table
        const mbody = document.getElementById('matrixTableBody');
        if (data.mailbox_stats && data.mailbox_stats.length > 0) {
          mbody.innerHTML = data.mailbox_stats.map(m => {
            const st = m.status_info || {};
            const isConn = st.status === "Connected";
            const badgeClass = isConn ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" : "bg-rose-500/20 text-rose-400 border-rose-500/30";
            return `
            <tr class="hover:bg-darkhover/50">
              <td class="py-3 px-4 font-sans font-medium text-slate-200">${m.email}</td>
              <td class="py-3 px-4"><span class="px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-slate-800 text-indigo-400 border border-slate-700">${m.type}</span></td>
              <td class="py-3 px-4 text-center"><span class="px-2 py-0.5 rounded text-[10px] font-bold border ${badgeClass}">${st.status || 'Connected'}</span></td>
              <td class="py-3 px-3 text-center text-emerald-400 font-bold">${m.inbox}</td>
              <td class="py-3 px-3 text-center text-sky-400 font-bold">${m.unread || 0}</td>
              <td class="py-3 px-3 text-center text-rose-400 font-bold">${m.spam}</td>
              <td class="py-3 px-3 text-center text-amber-400 font-bold">${m.promotions}</td>
              <td class="py-3 px-3 text-center text-blue-400 font-bold">${m.rescued}</td>
              <td class="py-3 px-3 text-center text-purple-400 font-bold">${m.replied}</td>
              <td class="py-3 px-3 text-center text-slate-400 font-bold">${m.total}</td>
            </tr>
          `}).join('');
        }

        // 5. Logs
        const logBox = document.getElementById('logContainer');
        if (data.logs && data.logs.length > 0) {
          logBox.innerHTML = data.logs.map(l => {
            let color = "text-slate-300";
            if (l.level === "ERROR") color = "text-rose-400 font-bold";
            if (l.level === "SUCCESS") color = "text-emerald-400";
            if (l.level === "RESCUE") color = "text-amber-400 font-semibold";
            if (l.level === "REPLY") color = "text-purple-400 font-semibold";
            if (l.level === "HEADER") color = "text-indigo-400 font-bold";
            if (l.level === "WARNING") color = "text-amber-300 font-bold";
            return `<div class="${color}">[${l.time}] ${l.message}</div>`;
          }).join('');
          logBox.scrollTop = logBox.scrollHeight;
        }

        // 6. Status Dot
        const dot = document.getElementById('sidebarStatusDot');
        const txt = document.getElementById('sidebarStatusText');
        if (data.is_running) {
          dot.className = "h-2.5 w-2.5 rounded-full bg-amber-400 animate-ping";
          txt.innerText = "PROCESSING";
          txt.className = "text-xs font-bold text-amber-400";
        } else {
          dot.className = "h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse";
          txt.innerText = "IDLE / READY";
          txt.className = "text-xs font-bold text-emerald-400";
        }

      } catch (e) {
        console.error(e);
      }
    }

    async function resetRecentScan() {
      await fetch('/api/reset_recent', { method: 'POST' });
      fetchStats();
    }

    async function runStep1() {
      try {
        const res = await fetch('/api/step1_scan', { method: 'POST' });
        const d = await res.json();
        if (d.status === 'error') {
          alert('Step 1 Scan Error: ' + d.message);
        }
      } catch (e) {
        console.error(e);
      } finally {
        fetchStats();
      }
    }

    async function runStep2() {
      try {
        const res = await fetch('/api/step2_engage', { method: 'POST' });
        const d = await res.json();
        if (d.status === 'error') {
          alert('Step 2 Error: ' + d.message);
        }
      } catch (e) {
        console.error(e);
      } finally {
        fetchStats();
      }
    }

    async function runFullAuto() {
      try {
        await runStep1();
        while (true) {
          await new Promise(r => setTimeout(r, 2000));
          try {
            const res = await fetch('/api/stats');
            const d = await res.json();
            if (!d.is_running) break;
          } catch (e) {}
        }
        await new Promise(r => setTimeout(r, 1500));
        await runStep2();
      } catch (e) {
        console.error(e);
      } finally {
        fetchStats();
      }
    }

    async function stopExecution() {
      await fetch('/api/stop', { method: 'POST' });
      fetchStats();
    }

    // ==================== KEYWORD TAGS & FILTER ====================
    let currentTokens = ["vasetebazar", "modzlab", "segatravelmauritius", "hetzner", "cloud", "vps"];

    function renderTokenTags() {
      const container = document.getElementById('tokenTagsContainer');
      container.innerHTML = currentTokens.map((t, idx) => `
        <span class="px-2.5 py-1 bg-slate-800 text-indigo-300 border border-slate-700 rounded-lg text-xs font-mono flex items-center gap-1.5 shadow-sm">
          ${t}
          <button onclick="deleteTokenKeyword(${idx})" class="hover:text-rose-400 font-bold">&times;</button>
        </span>
      `).join('');
    }

    async function addTokenKeyword() {
      const input = document.getElementById('newTokenInput');
      const val = input.value.trim().toLowerCase();
      if (!val || currentTokens.includes(val)) return;
      currentTokens.push(val);
      input.value = '';
      renderTokenTags();
      await syncConfig();
    }

    async function deleteTokenKeyword(idx) {
      currentTokens.splice(idx, 1);
      renderTokenTags();
      await syncConfig();
    }

    async function updateLookbackFilter() {
      await syncConfig();
      const st = document.getElementById('lookbackSavedText');
      st.innerText = "Saved!";
      setTimeout(() => st.innerText = "", 2000);
    }

    async function syncConfig() {
      const lookback = document.getElementById('controlsLookbackSelect').value;
      await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tokens: currentTokens, lookback_days: lookback })
      });
    }

    // ==================== ACCOUNTS CRUD & MULTI-SELECT ====================
    let accountsData = [];

    async function loadAccounts() {
      const res = await fetch('/api/accounts');
      accountsData = await res.json();
      const tbody = document.getElementById('accountsTableBody');
      if (accountsData.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="py-6 text-center text-slate-500">No accounts configured yet.</td></tr>`;
        return;
      }

      tbody.innerHTML = accountsData.map(a => {
        const st = a.status_info || {};
        let statusBadge = `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700">Untested</span>`;
        if (st.status === "Connected") {
          statusBadge = `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">Connected</span>`;
        } else if (st.status === "Not Connected") {
          statusBadge = `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30" title="${st.error || ''}">Not Connected</span>`;
        }

        return `
        <tr class="hover:bg-darkhover/50">
          <td class="py-3 px-3 text-center"><input type="checkbox" value="${a.email}" class="acc-checkbox rounded bg-darkbg border-darkborder"></td>
          <td class="py-3 px-4 font-sans font-medium text-slate-200">${a.email}</td>
          <td class="py-3 px-4"><span class="px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-slate-800 text-slate-300 border border-slate-700">${a.account_type}</span></td>
          <td class="py-3 px-4 text-slate-400">${a.imap_host}</td>
          <td class="py-3 px-4 text-slate-400">${a.smtp_host}</td>
          <td class="py-3 px-4 text-center">${statusBadge}</td>
          <td class="py-3 px-4 text-right space-x-2">
            <button onclick="testSingleAccount('${a.email}')" class="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-indigo-400 font-bold rounded-lg text-xs">Test Again</button>
            <button onclick="openEditAccountModal('${a.email}')" class="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-lg text-xs">Edit</button>
          </td>
        </tr>
      `}).join('');
    }

    function toggleSelectAll(master) {
      document.querySelectorAll('.acc-checkbox').forEach(cb => cb.checked = master.checked);
    }

    async function deleteSelectedAccounts() {
      const selected = Array.from(document.querySelectorAll('.acc-checkbox:checked')).map(cb => cb.value);
      if (selected.length === 0) {
        alert("Please select at least one account to delete.");
        return;
      }
      if (!confirm(`Are you sure you want to delete ${selected.length} accounts?`)) return;

      await fetch('/api/accounts/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emails: selected })
      });
      loadAccounts();
    }

    async function testSingleAccount(email) {
      await fetch('/api/accounts/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      loadAccounts();
    }

    async function testAllAccounts() {
      await fetch('/api/accounts/test-all', { method: 'POST' });
      loadAccounts();
    }

    function openAddAccountModal() {
      document.getElementById('accountModalTitle').innerText = "Add Mailbox Account";
      document.getElementById('modalEmail').value = "";
      document.getElementById('modalEmail').disabled = false;
      document.getElementById('modalPass').value = "";
      document.getElementById('addAccountModal').classList.remove('hidden');
    }

    function openEditAccountModal(email) {
      const acc = accountsData.find(a => a.email.toLowerCase() === email.toLowerCase());
      if (!acc) return;
      document.getElementById('accountModalTitle').innerText = "Edit Mailbox Account";
      document.getElementById('modalEmail').value = acc.email;
      document.getElementById('modalEmail').disabled = true;
      document.getElementById('modalPass').value = acc.password || "";
      document.getElementById('modalType').value = acc.account_type || "workspace";
      document.getElementById('modalImap').value = acc.imap_host || "imap.gmail.com";
      document.getElementById('modalSmtp').value = acc.smtp_host || "smtp.gmail.com";
      document.getElementById('addAccountModal').classList.remove('hidden');
    }

    function closeAddAccountModal() {
      document.getElementById('addAccountModal').classList.add('hidden');
    }

    async function submitAddAccount() {
      const email = document.getElementById('modalEmail').value.trim();
      const password = document.getElementById('modalPass').value.trim();
      const account_type = document.getElementById('modalType').value;
      const imap_host = document.getElementById('modalImap').value.trim();
      const smtp_host = document.getElementById('modalSmtp').value.trim();

      if (!email || !password) {
        alert("Please enter email and password");
        return;
      }

      await fetch('/api/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, account_type, imap_host, smtp_host })
      });

      closeAddAccountModal();
      loadAccounts();
    }

    // ==================== WARMUP REPLIES LOGIC ====================
    let repliesData = [];

    async function loadReplies() {
      const res = await fetch('/api/replies');
      const data = await res.json();
      repliesData = data.replies || [];
      const container = document.getElementById('repliesListContainer');
      if (repliesData.length === 0) {
        container.innerHTML = `<div class="text-slate-500 py-6 text-center">No reply templates configured.</div>`;
        return;
      }

      container.innerHTML = repliesData.map((r, idx) => `
        <div class="bg-darkbg border border-darkborder rounded-xl p-4 flex items-start justify-between gap-4">
          <div class="flex items-start gap-3">
            <span class="h-6 w-6 rounded-lg bg-indigo-600/20 text-indigo-400 text-xs font-bold flex items-center justify-center shrink-0">${idx + 1}</span>
            <p class="text-xs text-slate-200 leading-relaxed">${r}</p>
          </div>
          <div class="flex items-center space-x-2 shrink-0">
            <button onclick="openEditReplyModal(${idx})" class="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-lg">Edit</button>
            <button onclick="deleteReplyItem(${idx})" class="px-2.5 py-1 bg-rose-600/20 hover:bg-rose-600 text-rose-400 hover:text-white text-xs font-bold rounded-lg">Delete</button>
          </div>
        </div>
      `).join('');
    }

    function openAddReplyModal() {
      document.getElementById('replyModalTitle').innerText = "Add Warmup Reply Template";
      document.getElementById('replyEditIndex').value = "-1";
      document.getElementById('replyTextContent').value = "";
      document.getElementById('replyModal').classList.remove('hidden');
    }

    function openEditReplyModal(idx) {
      document.getElementById('replyModalTitle').innerText = "Edit Warmup Reply Template";
      document.getElementById('replyEditIndex').value = idx;
      document.getElementById('replyTextContent').value = repliesData[idx] || "";
      document.getElementById('replyModal').classList.remove('hidden');
    }

    function closeReplyModal() {
      document.getElementById('replyModal').classList.add('hidden');
    }

    async function submitReply() {
      const idx = parseInt(document.getElementById('replyEditIndex').value);
      const text = document.getElementById('replyTextContent').value.trim();
      if (!text) {
        alert("Please enter reply text.");
        return;
      }

      if (idx === -1) {
        // Add new
        await fetch('/api/replies', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text })
        });
      } else {
        // Update
        await fetch('/api/replies/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ index: idx, text })
        });
      }

      closeReplyModal();
      loadReplies();
    }

    async function deleteReplyItem(idx) {
      if (!confirm("Delete this reply template?")) return;
      await fetch(`/api/replies/${idx}`, { method: 'DELETE' });
      loadReplies();
    }

    function clearLogs() {
      document.getElementById('logContainer').innerHTML = '';
    }

    window.onload = async () => {
      initCharts();
      fetchStats();
      const res = await fetch('/api/stats');
      const data = await res.json();
      if (data.target_tokens) {
        currentTokens = data.target_tokens;
        renderTokenTags();
      }
      if (data.lookback_days) {
        document.getElementById('controlsLookbackSelect').value = data.lookback_days;
      }
      setInterval(fetchStats, 2000);
    };
  </script>
</body>
</html>
"""

if __name__ == "__main__":
    init_database()
    worker_port = int(os.getenv("WORKER_PORT", "8000"))
    print("\n" + "=" * 65)
    print(f"  UPGRADED DELIVERABILITY ENGINE DASHBOARD")
    print(f"  Python Worker API listening on: http://127.0.0.1:{worker_port}")
    print("=" * 65 + "\n")
    app.run(host="0.0.0.0", port=worker_port, debug=False)
