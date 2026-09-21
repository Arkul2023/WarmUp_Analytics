<USER_REQUEST>
import imaplib
import smtplib
import ssl
import email
from email.message import EmailMessage
from email.utils import parsedate_to_datetime, parseaddr, formataddr, make_msgid, format_datetime
import datetime
import time
import random
import os
import re
import json
import traceback
import html  # safe HTML escaping
import sys
from email.header import decode_header
from email.errors import HeaderParseError

# ---------- CONFIG ----------
GMAIL_APPS = None
if os.getenv("GMAIL_APPS"):
    try:
        GMAIL_APPS = json.loads(os.getenv("GMAIL_APPS"))
    except Exception:
        GMAIL_APPS = None

if not GMAIL_APPS:
    GMAIL_APPS = [
        ["albert.william@vasetebazar.com", "oyov hxyt javp hdcy"],
        ["allen.jones@modzlab.com", "kimp neyf ypzw yfat"],
        ["austin.davis@segatravelmauritius.com", "gxte lgcg ttbc lvcl"],
        ["bradley.moore@rfolympic.com", "kljv ceix ddax yxxv"],
        ["brent.taylor@rhinogallery.com", "lrfl kkds ipyl eguq"],
        ["maureenfergu54@gmail.com", "vdxo dcul ohyv kbgr"],
        ["genevascott1945@gmail.com", "iaxv dasd awhb rcow"],
        ["ettagardner19@gmail.com", "fysn yfzh ghvg xgtn"],
        ["janieadams1953@gmail.com", "bliz nazn zdrf axbe"],
        ["shawnarhodes148@gmail.com", "nflj kttj pjwo jqid"],
    ]

# accounts to skip
exception_account = []

# mapping for per-sender regards/signature (plain text)
custom_regards = {
        "albert.william@vasetebazar.com": "\n\nRegards,\nAlbert\nFinance Associate\n",
        "allen.jones@modzlab.com": "\n\nRegards,\nAllen\nProduct Advisor\n",
        "austin.davis@segatravelmauritius.com": "\n\nRegards,\nAustin\nSales Manager\n",
        "bradley.moore@rfolympic.com": "\n\nRegards,\nBradley\nOperations Manager\n",
        "brent.taylor@rhinogallery.com": "\n\nRegards,\nBrent\nBusiness Consultant\n",
        "maureenfergu54@gmail.com": "\n\nRegards,\nMaureen\nHR Executive\n",
        "genevascott1945@gmail.com": "\n\nRegards,\nGeneva\nProject Coordinator\n",
        "ettagardner19@gmail.com": "\n\nRegards,\nEtta\nMarketing Specialist\n",
        "janieadams1953@gmail.com": "\n\nRegards,\nJanie\nAdministrative Assistant\n",
        "shawnarhodes148@gmail.com": "\n\nRegards,\nShawna\nTeam Lead\n",
}

# optional mapping to a display name for the From header (to look like Gmail UI)
SENDER_DISPLAY_NAMES = {
        "albert.william@vasetebazar.com": "Albert",
        "allen.jones@modzlab.com": "Allen",
        "austin.davis@segatravelmauritius.com": "Austin",
        "bradley.moore@rfolympic.com": "Bradley",
        "brent.taylor@rhinogallery.com": "Brent",
        "maureenfergu54@gmail.com": "Maureen",
        "genevascott1945@gmail.com": "Geneva",
        "ettagardner19@gmail.com": "Etta",
        "janieadams1953@gmail.com": "Janie",
        "shawnarhodes148@gmail.com": "Shawna",
}

REPLIES_FILE = "warmup_replies.txt"
CAMPAIGN_SENDER_TOKENS = [
    "cloud",
]
DAYS_AGO = 0

CAMPAIGN_SENDER_TOKENS = [
    "cloud",
]

# sleep timings (seconds) - tweak these to suit your pacing
SLEEP_AFTER_MOVE_MIN = 5
SLEEP_AFTER_MOVE_MAX = 20
SLEEP_BETWEEN_REPLIES_MIN = 30
SLEEP_BETWEEN_REPLIES_MAX = 120
SLEEP_BETWEEN_ROUNDS_MIN = 20    # extra pause after finishing one round across accounts
SLEEP_BETWEEN_ROUNDS_MAX = 50
SLEEP_BETWEEN_ACCOUNTS_MIN = 20
SLEEP_BETWEEN_ACCOUNTS_MAX = 30

IMAP_HOST = "imap.gmail.com"
IMAP_PORT = 993
SMTP_HOST = "smtp.gmail.com"
SMTP_PORT = 587

# ----------------------------

EMAIL_RE = re.compile(r"([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})")

def load_reply_lines(path):
    try:
        with open(path, "r", encoding="utf-8") as f:
            lines = [line.strip() for line in f if line.strip()]
            if not lines:
                raise ValueError("No reply lines found in file.")
            return lines
    except Exception as e:
        print(f"[WARN] Could not read replies file '{path}': {e}")
        return ["Hi,\n\nThank you for your message. We'll get back to you shortly."]

def get_real_reply_address(msg):
    """
    Prefer From address.
    Use Reply-To only if From is missing or invalid.
    """
    from_hdr = msg.get("From", "")
    _, from_addr = extract_email_from_header(from_hdr)

    if from_addr:
        return from_addr

    reply_to_hdr = msg.get("Reply-To", "")
    _, reply_to_addr = extract_email_from_header(reply_to_hdr)
    return reply_to_addr


def extract_email_from_header(header_value):
    if not header_value:
        return "", ""
    name, addr = parseaddr(header_value)
    return name, (addr or "").lower()

def is_sender_matching(header_value, tokens):
    """
    Match sender if ANY token/domain appears in:
    - full header
    - email address
    """
    if not header_value or not tokens:
        return False

    header_l = str(header_value).lower()
    _, addr = extract_email_from_header(header_value)

    for token in tokens:
        token_l = token.lower()
        if token_l in header_l:
            return True
        if addr and token_l in addr:
            return True

    return False


# --- new helper: safe header decoding / sanitization ---
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
    # remove CR/LF and other control characters that break headers
    s = re.sub(r'[\r\n\x00-\x1f\x7f]', ' ', s)
    # collapse multiple whitespace into single space
    s = re.sub(r'\s+', ' ', s).strip()
    return s or fallback

# --- IMAP helpers using UID-based operations (more robust) ---
def imap_uid_search_since(imap_conn, since_date):
    """
    Return list of UIDs (strings) for messages since given date (inclusive).
    Uses UID SEARCH so results are UIDs (safer).
    """
    since_str = since_date.strftime("%d-%b-%Y")
    try:
        typ, data = imap_conn.uid('search', None, '(SINCE "{}")'.format(since_str))
    except Exception:
        # fallback to non-uid search if server doesn't accept uid search syntax
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
    """Run UID SEARCH via X-GM-RAW and return list of UIDs (strings)."""
    try:
        typ, data = imap_conn.uid('search', None, 'X-GM-RAW', raw_query)
    except Exception:
        # server may not support UID + X-GM-RAW; try non-UID search
        try:
            typ, data = imap_conn.search(None, 'X-GM-RAW', raw_query)
        except Exception:
            return []
    if typ != "OK" or not data or not data[0]:
        return []
    return data[0].decode().split()

def fetch_message_by_uid(imap_conn, uid):
    """
    Fetch RFC822 by UID and return email.message.Message (or None)
    """
    try:
        typ, data = imap_conn.uid('fetch', uid, '(RFC822 FLAGS)')
    except Exception:
        typ, data = imap_conn.fetch(uid, '(RFC822 FLAGS)')
    if typ != "OK" or not data or data[0] is None:
        return None, None
    # data format: [(b'123 (RFC822 {size}', b'rawbytes'), b')'] etc.
    raw = None
    # data can be list of tuples
    for part in data:
        if isinstance(part, tuple) and len(part) > 1:
            raw = part[1]
            break
    if not raw:
        return None, None
    msg = email.message_from_bytes(raw)
    flags = b""
    try:
        if len(data) > 1 and isinstance(data[1], tuple):
            flags = data[1]
    except Exception:
        pass
    return msg, flags

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

def build_reply_message(original_msg, from_address, to_address, body_plain, signature, display_name=None):
    reply = EmailMessage()

    # safe subject decoding & threading (use safe_decode_header to prevent CRLF injection)
    try:
        raw_subject = original_msg.get("Subject", "")
        safe_subject = safe_decode_header(raw_subject, fallback="")
        if safe_subject and not safe_subject.lower().startswith("re:"):
            reply["Subject"] = "Re: " + safe_subject
        else:
            reply["Subject"] = safe_subject or "Re: "
    except Exception:
        try:
            reply["Subject"] = "Re: "
        except Exception:
            pass

    if display_name:
        reply["From"] = formataddr((display_name, from_address))
    else:
        reply["From"] = from_address
    real_to = get_real_reply_address(original_msg)
    reply["To"] = real_to or to_address
    # reply_to_hdr = original_msg.get("Reply-To") or original_msg.get("From")
    # _, reply_to_addr = extract_email_from_header(reply_to_hdr)
    # if not reply_to_addr:
    #     _, reply_to_addr = extract_email_from_header(original_msg.get("From", ""))
    # reply["To"] = reply_to_addr or to_address

    # threading: protect against malformed Message-ID/References
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
        # ignore threading if message-id/refs are malformed
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
    html_body = "<div dir='ltr'>{}</div>".format(escaped.replace("\n", "<br>\n"))

    reply.set_content(final_plain)
    reply.add_alternative(html_body, subtype="html")
    return reply

def send_via_smtp(smtp_host, smtp_port, sender_email, app_password, msg: EmailMessage):
    context = ssl.create_default_context()
    with smtplib.SMTP(smtp_host, smtp_port) as server:
        server.ehlo()
        server.starttls(context=context)
        server.ehlo()
        server.login(sender_email, app_password)
        server.send_message(msg)

# ------------------ move helpers using UID commands ------------------
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
    Try to move a UID from currently selected mailbox to INBOX using UID MOVE if available,
    otherwise UID COPY + UID STORE + EXPUNGE.
    Returns True if copy/move reported OK (best-effort).
    """
    # prefer UID MOVE if supported
    try:
        if server_supports_move(imap_conn):
            typ, data = imap_conn.uid('MOVE', uid, 'INBOX')
            if typ == "OK":
                print(f"[INFO] UID MOVE succeeded for {uid} from {current_mailbox} to INBOX")
                return True
            else:
                print(f"[WARN] UID MOVE failed for {uid}: {typ} {data}")
        # fallback to UID COPY + UID STORE + EXPUNGE
        typ, data = imap_conn.uid('COPY', uid, 'INBOX')
        if typ != "OK":
            print(f"[WARN] UID COPY to INBOX failed for uid {uid} in {current_mailbox}: {typ} {data}")
            return False
        # mark original as deleted in current mailbox
        try:
            typ2, data2 = imap_conn.uid('STORE', uid, '+FLAGS.SILENT', '(\\Deleted)')
            # call expunge to remove from current mailbox
            try:
                imap_conn.expunge()
            except Exception:
                # some servers require selecting mailbox for expunge; caller should have selected mailbox
                pass
        except Exception as e:
            print(f"[WARN] Could not UID STORE \\Deleted for uid {uid}: {e}")
        print(f"[INFO] Copied UID {uid} from {current_mailbox} to INBOX and marked original deleted")
        return True
    except Exception as e:
        print(f"[ERROR] Exception while moving uid {uid} to INBOX: {e}")
        return False

# ------------------ Modified: fetch candidate messages for ONE account ------------------
def fetch_mails_for_account(account_email, app_password):
    """
    Connects via IMAP, scans multiple mailboxes and does Gmail X-GM-RAW searches (promotions/all mail/spam),
    moves matching messages to INBOX (UID COPY/MOVE), and returns candidate list.
    """
    mails = []
    try:
        imap_conn = imaplib.IMAP4_SSL(IMAP_HOST, IMAP_PORT)
        imap_conn.login(account_email, app_password)
    except Exception as e:
        print(f"[ERROR] IMAP login failed for {account_email}: {e}")
        return mails

    try:
        # common mailbox names to attempt selecting (including All Mail)
        folders_to_check = [
            "INBOX",
            "[Gmail]/All Mail", "All Mail", "[Gmail]/AllMail",
            "[Gmail]/Promotions", "Promotions",
            "[Gmail]/Spam", "Spam"
        ]

        cutoff_date = (datetime.date.today() - datetime.timedelta(days=DAYS_AGO))
        seen_uids = set()
        print(f"Date: {cutoff_date}")


        # First: scan selectable mailboxes (UID search per mailbox)
        for mailbox in folders_to_check:
            try:
                typ, _ = imap_conn.select(mailbox)
                if typ != "OK":
                    continue
                # search for UIDs since cutoff_date
                uids = imap_uid_search_since(imap_conn, cutoff_date)
                if not uids:
                    continue
                for uid in uids:
                    if uid in seen_uids:
                        continue
                    try:
                        msg, flags = fetch_message_by_uid(imap_conn, uid)
                        if not msg:
                            continue
                        date_hdr = msg.get("Date")
                        try:
                            dt = parsedate_to_datetime(date_hdr) if date_hdr else None
                            if dt and dt.date() < cutoff_date:
                                continue
                        except Exception:
                            pass

                        from_hdr = msg.get("From", "")
                        if not (
                            is_sender_matching(from_hdr, CAMPAIGN_SENDER_TOKENS)
                            or is_sender_matching(msg.get("Sender", ""), CAMPAIGN_SENDER_TOKENS)
                        ):
                            continue


                        # If found in mailbox other than INBOX, try to move/copy to INBOX (use UID operations)
                        if mailbox.upper() != "INBOX":
                            moved = try_move_uid_to_inbox_uidmode(imap_conn, uid, mailbox)
                            # if move succeeded, fine; if not, we still have the msg object to reply from
                        reply_to_addr = get_real_reply_address(msg)
                        # reply_to_hdr = msg.get("Reply-To") or msg.get("From")
                        # _, reply_to_addr = extract_email_from_header(reply_to_hdr)
                        if not reply_to_addr:
                            _, reply_to_addr = extract_email_from_header(msg.get("From", ""))

                        mails.append({
                            "uid": uid,
                            "msg": msg,
                            "reply_to": reply_to_addr,
                            "from_account": account_email
                        })
                        seen_uids.add(uid)
                    except Exception as ex:
                        print(f"[WARN] inspecting uid {uid} in {mailbox} for {account_email}: {ex}")
                        continue
            except Exception as e:
                # selection failed - mailbox might not exist for this account
                continue

        # Second: Gmail-specific X-GM-RAW searches to catch label-only messages (promotions / all mail / spam)
        try:
            since_str = (cutoff_date).strftime("%Y/%m/%d")
            # check Promotions category
            raw_query = f'category:promotions after:{since_str}'
            uids = imap_uid_search_xgmraw(imap_conn, raw_query)
            for uid in uids:
                if uid in seen_uids:
                    continue
                try:
                    # we don't know mailbox selected; fetch by UID
                    msg, flags = fetch_message_by_uid(imap_conn, uid)
                    if not msg:
                        continue
                    from_hdr = msg.get("From", "")
                    if not (
                        is_sender_matching(from_hdr, CAMPAIGN_SENDER_TOKENS)
                        or is_sender_matching(msg.get("Sender", ""), CAMPAIGN_SENDER_TOKENS)
                    ):
                        continue
                    # try move/copy to INBOX (we used UID commands so current selected mailbox doesn't matter)
                    try_move_uid_to_inbox_uidmode(imap_conn, uid, "X-GM-RAW:category:promotions")
                    reply_to_hdr = msg.get("Reply-To") or msg.get("From")
                    _, reply_to_addr = extract_email_from_header(reply_to_hdr)
                    mails.append({
                        "uid": uid,
                        "msg": msg,
                        "reply_to": reply_to_addr,
                        "from_account": account_email
                    })
                    seen_uids.add(uid)
                except Exception as ex:
                    print(f"[WARN] X-GM-RAW promotions processing uid {uid}: {ex}")
                    continue
        except Exception:
            pass

        # also catch spam (label/in:spam)
        try:
            since_str = (cutoff_date).strftime("%Y/%m/%d")
            raw_query_spam = f'in:spam after:{since_str}'
            uids = imap_uid_search_xgmraw(imap_conn, raw_query_spam)
            for uid in uids:
                if uid in seen_uids:
                    continue
                try:
                    msg, flags = fetch_message_by_uid(imap_conn, uid)
                    if not msg:
                        continue
                    from_hdr = msg.get("From", "")
                    if not (
                        is_sender_matching(from_hdr, CAMPAIGN_SENDER_TOKENS)
                        or is_sender_matching(msg.get("Sender", ""), CAMPAIGN_SENDER_TOKENS)
                    ):
                        continue
                    # try to move from Spam to INBOX
                    try_move_uid_to_inbox_uidmode(imap_conn, uid, "X-GM-RAW:in:spam")
                    reply_to_hdr = msg.get("Reply-To") or msg.get("From")
                    _, reply_to_addr = extract_email_from_header(reply_to_hdr)
                    mails.append({
                        "uid": uid,
                        "msg": msg,
                        "reply_to": reply_to_addr,
                        "from_account": account_email
                    })
                    seen_uids.add(uid)
                except Exception as ex:
                    print(f"[WARN] X-GM-RAW spam processing uid {uid}: {ex}")
                    continue
        except Exception:
            pass

    except Exception as e:
        print(f"[ERROR] fetching mails for {account_email}: {e}")
    finally:
        try:
            imap_conn.logout()
        except Exception:
            pass

    # Sort mails by original message Date (oldest first)
    def _msg_date_key(item):
        try:
            d = parsedate_to_datetime(item["msg"].get("Date"))
            return d or datetime.datetime.min
        except Exception:
            return datetime.datetime.min

    mails.sort(key=_msg_date_key)
    return mails

# ------------------ New: round-robin sender (unchanged except for hardened building/sending) ------------------
def round_robin_send(all_account_mails, reply_lines):
    queues = []
    for acct_email, acct_pass, mails in all_account_mails:
        q = [{
            "uid": c["uid"],
            "msg": c["msg"],
            "reply_to": c["reply_to"],
            "from_account": acct_email,
            "app_password": acct_pass
        } for c in mails]
        queues.append((acct_email, acct_pass, q))

    round_idx = 0
    total_sent = 0
    while any(len(q[2]) > 0 for q in queues):
        round_idx += 1
        for i, (acct_email, acct_pass, q) in enumerate(queues):
            if not q:
                continue
            item = q.pop(0)
            original_msg = item["msg"]
            reply_to_addr = item["reply_to"]
            from_account = item["from_account"]
            app_password = item["app_password"]

            reply_body = random.choice(reply_lines)
            signature = custom_regards.get(from_account, "\n\nRegards,\nCloudlead Team")
            sender_name = extract_sender_name(original_msg)
            greeting = f"Hi {sender_name},\n\n" if sender_name else "Hi,\n\n"
            plain_snippet = greeting + reply_body + signature + "\n\n"

            display_name = SENDER_DISPLAY_NAMES.get(from_account)

            # Build reply (guard against any unexpected error during build)
            try:
                reply_msg = build_reply_message(
                    original_msg=original_msg,
                    from_address=from_account,
                    to_address=reply_to_addr,
                    body_plain=plain_snippet,
                    signature="",
                    display_name=display_name
                )
            except Exception as e:
                print(f"[ERROR] Failed to build reply message for uid {item.get('uid')} ({from_account} -> {reply_to_addr}): {e}")
                traceback.print_exc()
                # skip this message and continue
                continue

            pre_sleep = random.randint(SLEEP_AFTER_MOVE_MIN, SLEEP_AFTER_MOVE_MAX)
            print(f"[INFO] Waiting {pre_sleep}s before sending reply for {from_account} -> {reply_to_addr}")
            time.sleep(pre_sleep)

            # Send with robust exception handling; on failure continue to next message
            try:
                send_via_smtp(SMTP_HOST, SMTP_PORT, from_account, app_password, reply_msg)
                total_sent += 1
                print(f"[SENT] ({total_sent}) {from_account} -> {reply_to_addr} | Subject: {reply_msg.get('Subject')}")
            except Exception as e:
                print(f"[ERROR] Sending failed for {from_account} -> {reply_to_addr}: {e}")
                traceback.print_exc()
                # optionally, you can record the failed uid to a file for later retry
                try:
                    with open("failed_sends.log", "a", encoding="utf-8") as fh:
                        fh.write(f"{datetime.datetime.utcnow().isoformat()} {from_account} {reply_to_addr} uid={item.get('uid')} error={repr(e)}\n")
                except Exception:
                    pass
                # continue to next message (don't re-raise)
                continue

            between_sleep = random.randint(SLEEP_BETWEEN_REPLIES_MIN, SLEEP_BETWEEN_REPLIES_MAX)
            print(f"[INFO] Sleeping {between_sleep}s between replies...")
            time.sleep(between_sleep)

        round_sleep = random.randint(SLEEP_BETWEEN_ROUNDS_MIN, SLEEP_BETWEEN_ROUNDS_MAX)
        print(f"[INFO] Finished round {round_idx}. Sleeping {round_sleep}s before next round...")
        time.sleep(round_sleep)

    print(f"[INFO] Round-robin sending complete. Total messages sent: {total_sent}")

# optional: global uncaught exception logger to avoid silent crashes
def handle_uncaught(exc_type, exc_value, exc_traceback):
    if issubclass(exc_type, KeyboardInterrupt):
        sys.__excepthook__(exc_type, exc_value, exc_traceback)
        return
    print("[FATAL] Uncaught exception", exc_type, exc_value)
    traceback.print_exception(exc_type, exc_value, exc_traceback)

sys.excepthook = handle_uncaught

# ------------------ main workflow (unchanged) ------------------
def main():
    reply_lines = load_reply_lines(REPLIES_FILE)

    all_account_mails = []
    for account_email, app_pass in GMAIL_APPS:
        if account_email in exception_account:
            print(f"[SKIP] Account in exception list: {account_email}")
            continue
        print("\n" + "=" * 60)
        print(f"[INFO] Gathering mails for {account_email}")
        try:
            mails = fetch_mails_for_account(account_email, app_pass)
            print(f"[INFO] Found {len(mails)} mails for {account_email}")
            all_account_mails.append((account_email, app_pass, mails))
        except Exception as e:
            print(f"[ERROR] Error gathering mails for {account_email}: {e}")
            traceback.print_exc()

        time.sleep(random.randint(SLEEP_BETWEEN_ACCOUNTS_MIN, SLEEP_BETWEEN_ACCOUNTS_MAX))

    for acct_email, _, mails in all_account_mails:
        print(f"[SUMMARY] {acct_email}: {len(mails)} messages queued.")

    round_robin_send(all_account_mails, reply_lines)

if __name__ == "__main__":
    main()


i want this login in my UI use this logic in my UI code if python worker
ussing this logic before sending the replies give me the count of inbox and spam in dashboard
use account from my account.json file
</USER_REQUEST>
<ADDITIONAL_METADATA>
The current local time is: 2026-08-27T14:55:33+05:30.
</ADDITIONAL_METADATA>