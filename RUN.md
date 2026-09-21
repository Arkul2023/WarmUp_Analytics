# Deliverability & Warmup Engine

## 1. Directory Navigation

If your PowerShell terminal opens in `C:\Windows\system32` (or anywhere else), navigate to the folder using the **full path**:

```powershell
cd "C:\Users\rohit\Downloads\Warmup_Analytics (5)\Warmup_Analytics\backend\python-worker"
```

Or from the `Warmup_Analytics` root directory:

```powershell
cd "backend\python-worker"
```

## 2. Start Command

```powershell
pip install -r requirements.txt
python app.py
```

## 3. Access the Dashboard

Open your web browser at:
👉 **[http://127.0.0.1:5000](http://127.0.0.1:5000)**

---

## What is in this folder:

- **`app.py`**: Full self-contained Flask app with embedded Tailwind UI and background deliverability engine.
- **`accounts.json` / `account.json`**: 10 real mailboxes (5 Workspace + 5 Seeds) with credentials.
- **`warmup_replies.txt`**: 100 conversational warmup reply templates.
- **`warmup_telemetry.db`**: SQLite database tracking all scanned messages and actions.
- **`requirements.txt`**: Python dependencies (`flask`).

---

## Features & Controls:

- **Dashboard**:
  - Recent Scan Analysis (Current Run)
  - All-Time Telemetry from SQLite
  - Reset Current Run (`POST /api/reset_recent`)
  - Inboxing vs Spam Donut Chart + Reply Activity Graph
- **Deliverability Matrix**:
  - Per-mailbox real-time breakdown (Inbox, Spam, Promotions, Rescued, Replied, Connection status)
- **Execution Controls**:
  - **Step 1: Scan & Count** (`POST /api/step1_scan`)
  - **Step 2: Rescue & Reply** (`POST /api/step2_engage`)
  - **Run Full Cycle (1 + 2)**
  - **Emergency Stop** (`POST /api/stop`)
  - Target Sender Keywords (interactive tag manager, saves via `POST /api/config`)
  - Scanning Lookback Window (saves via `POST /api/config`)
  - Live activity and event stream terminal
- **Accounts**:
  - Multi-select account deletion
  - Connection test (single & bulk)
  - Add / edit mailbox modal
- **Warmup Replies**:
  - Add / Edit / Delete rotational reply templates
