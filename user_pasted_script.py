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
        "genevascott1945@gmail.com": "\n\nRegards,\nGeneva\nProject Coordinator
<truncated 23376 bytes>
 {round_sleep}s before next round...")
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