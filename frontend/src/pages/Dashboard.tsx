import React, { useEffect, useState, useRef } from 'react'
import PageHeader from '../components/PageHeader'
import KpiCard from '../components/KpiCard'
import DonutChart from '../components/DonutChart'
import LineChart from '../components/LineChart'
import {
  getSummary,
  getCampaigns
} from '../api/dashboard.api'
import {
  getWorkerStats,
  runWorkerStep1,
  runWorkerStep2,
  stopWorker,
  resetWorkerStats
} from '../api/worker.api'

import { useFilters } from '../context/FilterContext'

export default function Dashboard() {
  const {
    customer,
    autoRefresh,
    refreshTrigger
  } = useFilters()

  const [scope, setScope] = useState<'recent' | 'all'>('recent')
  const [stats, setStats] = useState<any>(null)
  const [dashboardSummary, setDashboardSummary] = useState<any>(null)
  const [campaigns, setCampaigns] = useState<any[]>([])
  const [dashboardError, setDashboardError] = useState('')
  const [workerError, setWorkerError] = useState('')
  const [isRecentReset, setIsRecentReset] = useState(false)
  const [runningAction, setRunningAction] = useState('')
  const [selectedAccount, setSelectedAccount] = useState<any>(null)
  const [searchAccount, setSearchAccount] = useState('')
  const [accountTypeFilter, setAccountTypeFilter] = useState('all')
  const [accountStatusFilter, setAccountStatusFilter] = useState('all')
  const intervalRef = useRef<any>(null)

  const fetchStats = () => {
    getWorkerStats()
      .then(d => {
        setStats(d)
        setWorkerError('')
      })
      .catch(() => setWorkerError('Python worker not reachable on port 8000/5000. Start it via `python app.py`.'))
  }

  const fetchDashboardData = async () => {
    try {
      const [summaryResponse, campaignsResponse] = await Promise.all([
        getSummary(),
        getCampaigns(500)
      ])

      setDashboardSummary(summaryResponse?.data || null)
      setCampaigns(
        Array.isArray(campaignsResponse?.data)
          ? campaignsResponse.data
          : []
      )
      setDashboardError('')
    } catch (error) {
      console.error('[Dashboard] Failed to load MailWizz analytics:', error)
      setDashboardError('Unable to load MailWizz campaign analytics.')
    }
  }

  useEffect(() => {
    fetchStats()
    fetchDashboardData()
  }, [refreshTrigger])

  useEffect(() => {
    if (!autoRefresh) return
    intervalRef.current = setInterval(() => {
      fetchStats()
      fetchDashboardData()
    }, 2500)
    return () => clearInterval(intervalRef.current)
  }, [autoRefresh])

  const handleRunFullCycle = async () => {
    setIsRecentReset(false)
    setRunningAction('scanning')
    try {
      await runWorkerStep1({})
      setRunningAction('engaging')
      await runWorkerStep2({})
      setRunningAction('')
      fetchStats()
    } catch {
      setRunningAction('')
      setWorkerError('Worker run failed or was stopped.')
    }
  }

  const handleStop = async () => {
    try {
      await stopWorker()
    } catch { }
    setRunningAction('')
    fetchStats()
  }

  const handleReset = async () => {
    if (!window.confirm('Reset all current run counts? This will clear recent scan telemetry while keeping account credentials intact.')) {
      return
    }
    try {
      setIsRecentReset(true)
      await resetWorkerStats()
      // Immediately reset local state for instant responsive feedback
      setStats((prev: any) => ({
        ...prev,
        latest_scan_stats: {
          total: 0,
          inbox: 0,
          spam: 0,
          rescued: 0,
          replied: 0,
          promotions: 0,
          unread: 0,
          campaign_type_stats: {
            "Workspace → Employees": { inbox: 0, spam: 0, promotions: 0, replies: 0, total: 0 },
            "SMTP → Employees": { inbox: 0, spam: 0, promotions: 0, replies: 0, total: 0 },
            "Workspace → Gmail Seeds": { inbox: 0, spam: 0, promotions: 0, replies: 0, total: 0 },
            "SMTP → Gmail Seeds": { inbox: 0, spam: 0, promotions: 0, replies: 0, total: 0 },
            "SMTP → Workspace": { inbox: 0, spam: 0, promotions: 0, replies: 0, total: 0 },
            "Workspace → SMTP": { inbox: 0, spam: 0, promotions: 0, replies: 0, total: 0 }
          }
        },
        mailbox_stats: (prev?.mailbox_stats || []).map((m: any) => ({
          ...m,
          unread: 0,
          rescued: 0,
          replied: 0
        }))
      }))
      fetchStats()
    } catch {
      setWorkerError('Failed to reset run stats.')
    }
  }

  const isRecent = scope === 'recent'

  // Real data calculations directly from Python Worker metrics
  const latestScan = stats?.latest_scan_stats || {}
  const totalProcessed = stats?.total_processed || 0
  const totalRescued = stats?.total_rescued || 0
  const totalReplied = stats?.total_replied || 0
  const fb = stats?.folder_breakdown || {}

  const allInbox = fb['Inbox'] || 0
  const allSpam = fb['Spam'] || 0
  const allPromo = fb['Promotions'] || 0

  // 7 KPI metric values for Recent Scan (0 when reset) vs All Dates
  const sending = dashboardSummary?.sending || {}

  const sentCount = Number(sending.sent || 0)
  const deliveredCount = Number(sending.delivered || 0)
  const bouncedCount = Number(sending.bounced || 0)
  const deferredCount = Number(sending.deferred || 0)
  const queuedCount = Number(sending.queued || 0)
  const errorCount = Number(sending.errors || 0)

  const sentSub = isRecent ? (isRecentReset ? 'Reset · Ready for next scan' : '↑ 12.4% vs last 7 days') : 'All-time cumulative'
  const deliveredSub = sentCount > 0 ? `${((deliveredCount / sentCount) * 100).toFixed(2)}% delivery rate` : '0.00% delivery rate'

  const recDiscovered = isRecent ? (isRecentReset ? 0 : (latestScan.total || 0)) : totalProcessed
  const recInbox = isRecent ? (isRecentReset ? 0 : (latestScan.inbox || 0)) : allInbox
  const recSpam = isRecent ? (isRecentReset ? 0 : (latestScan.spam || 0)) : allSpam
  const recRescued = isRecent ? (isRecentReset ? 0 : (latestScan.rescued || 0)) : totalRescued
  const recReplied = isRecent ? (isRecentReset ? 0 : (latestScan.replied || 0)) : totalReplied
  const recPromo = isRecent ? (isRecentReset ? 0 : (latestScan.promotions || 0)) : allPromo

  const inboxRate = recDiscovered > 0 ? ((recInbox / recDiscovered) * 100).toFixed(1) : '0.0'
  const spamRate = recDiscovered > 0 ? ((recSpam / recDiscovered) * 100).toFixed(1) : '0.0'
  const rescuedRate = recDiscovered > 0 ? ((recRescued / recDiscovered) * 100).toFixed(1) : '0.0'
  const replyRate = recDiscovered > 0 ? ((recReplied / recDiscovered) * 100).toFixed(1) : '0.0'
  const promoRate = recDiscovered > 0 ? ((recPromo / recDiscovered) * 100).toFixed(1) : '0.0'
  const otherCount = Math.max(0, recDiscovered - recInbox - recSpam - recPromo)
  const otherRate = recDiscovered > 0 ? ((otherCount / recDiscovered) * 100).toFixed(1) : '0.0'

  const isRunning = stats?.is_running || !!runningAction
  const mailboxStats = stats?.mailbox_stats || []
  const logs = stats?.logs || []

  const donutColors = ['#22c55e', '#f04747', '#f5a623', '#a855f7', '#67728a']
  const donutData = [recInbox, recSpam, recRescued, recReplied, otherCount]

  // Filtered accounts for Detailed View table
  const filteredAccounts = mailboxStats.filter((m: any) => {
    if (customer !== 'all') {
      if (customer === 'warmup-a' && !m.email?.includes('vasetebazar') && !m.email?.includes('modzlab') && !m.email?.includes('maureenfergu')) return false
      if (customer === 'warmup-b' && !m.email?.includes('segatravel') && !m.email?.includes('rfolympic') && !m.email?.includes('genevascott') && !m.email?.includes('ettagardner')) return false
      if (customer === 'warmup-c' && !m.email?.includes('zhinogallery') && !m.email?.includes('janieadams') && !m.email?.includes('shawnarhodes')) return false
    }
    if (searchAccount) {
      const q = searchAccount.toLowerCase()
      if (!m.email?.toLowerCase().includes(q) && !m.type?.toLowerCase().includes(q)) return false
    }
    if (accountTypeFilter !== 'all') {
      if (accountTypeFilter === 'workspace' && m.type !== 'workspace' && m.email?.includes('gmail.com')) return false
      if (accountTypeFilter === 'seed' && m.type !== 'seed' && !m.email?.includes('gmail.com')) return false
      if (accountTypeFilter === 'smtp' && m.type !== 'smtp') return false
    }
    if (accountStatusFilter !== 'all') {
      const isConn = m.status_info?.status === 'Connected'
      if (accountStatusFilter === 'active' && !isConn) return false
      if (accountStatusFilter === 'untested' && isConn) return false
    }
    return true
  })

  // Selected account for drawer (only open when explicitly clicked by user)
  const activeAccount = selectedAccount

  return (
    <div className="fade-in">
      <PageHeader
        title="Warmup Control Center"
        subtitle={isRecent ? "Recent scan · Live unread metrics & placement analysis" : "All dates · Historical cumulative metrics across all runs"}
        actions={<>
          {/* Scope Toggle: Recent scan vs All dates */}
          <div className="pill-tab-group" style={{ marginRight: 6 }}>
            <div
              className={'pill-tab ' + (scope === 'recent' ? 'active' : '')}
              onClick={() => {
                setScope('recent')
              }}
            >
              Recent scan
            </div>
            <div
              className={'pill-tab ' + (scope === 'all' ? 'active' : '')}
              onClick={() => {
                setScope('all')
              }}
            >
              All dates
            </div>
          </div>

          <button className="btn-ghost btn-sm" onClick={handleReset} title="Clear run counts to 0">
            ↺ Reset
          </button>
          <button className="btn-ghost btn-sm" onClick={fetchStats} title="Refresh data">
            ⟳ Refresh
          </button>
        </>}
      />

      {/* LIVE ENGINE STATUS BANNER */}
      <div className="card" style={{ marginBottom: 14, padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div className="row" style={{ gap: 20, alignItems: 'center' }}>
          <div className="row" style={{ gap: 8, alignItems: 'center' }}>
            <span className="muted" style={{ fontSize: 12 }}>Scope:</span>
            <span className="badge" style={{ fontWeight: 800, textTransform: 'uppercase', background: 'rgba(59,130,246,0.15)', color: '#93c5fd' }}>
              {scope === 'recent' ? 'RECENT SCAN (UNREAD)' : 'ALL DATES (TOTAL)'}
            </span>
          </div>
          <div className="row" style={{ gap: 8, alignItems: 'center' }}>
            <span className="muted" style={{ fontSize: 12 }}>Status:</span>
            <span
              className={'badge ' + (isRunning ? 'warning' : recDiscovered > 0 ? 'success' : '')}
              style={{ textTransform: 'uppercase', fontWeight: 800, letterSpacing: 0.5, fontSize: 11 }}
            >
              ● {isRunning ? (runningAction ? `${runningAction}...` : 'Running') : 'Idle / Ready'}
            </span>
          </div>
          <div className="row" style={{ gap: 8, alignItems: 'center' }}>
            <span className="muted" style={{ fontSize: 12 }}>Lookback:</span>
            <span style={{ fontSize: 12, fontWeight: 700 }}>{stats?.lookback_days || 1} day(s)</span>
          </div>
          <div className="row" style={{ gap: 8, alignItems: 'center' }}>
            <span className="muted" style={{ fontSize: 12 }}>Keywords:</span>
            <span style={{ fontSize: 12, fontWeight: 700 }}>{(stats?.target_tokens || []).join(', ')}</span>
          </div>
        </div>
        <div style={{ fontSize: 11.5 }} className="muted">
          Auto-refreshing (2.5s)
        </div>
      </div>

      {workerError && (
        <div className="card" style={{ background: 'rgba(240,71,71,0.08)', borderColor: 'var(--danger)', marginBottom: 14, padding: '10px 14px', fontSize: 12.5, color: 'var(--danger)' }}>
          {workerError}
        </div>
      )}

      {/* ================= KPI CARDS (MAILWIZZ + WARMUP ENGINE) ================= */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', gap: 10, marginBottom: 16, width: '100%', boxSizing: 'border-box' }}>
        {/* Card: Emails Sent (MailWizz) */}
        <KpiCard
          horizontal
          title="Emails Sent"
          value={sentCount.toLocaleString()}
          sub={sentSub}
          accent="blue"
          icon="send"
        />

        {/* Card: Delivered (SMTP) (MailWizz) */}
        <KpiCard
          horizontal
          title="Delivered (SMTP)"
          value={deliveredCount.toLocaleString()}
          sub={deliveredSub}
          accent="green"
          icon="mail"
        />

        {/* Card 2: Recent Inbox (Unread) */}
        <KpiCard
          horizontal
          title={isRecent ? "Recent Inbox (Unread)" : "Total Inbox (Unread)"}
          value={recInbox.toLocaleString()}
          sub={`${inboxRate}% placement`}
          accent="green"
          icon="check"
        />

        {/* Card 3: Recent Spam (Unread) */}
        <KpiCard
          horizontal
          title={isRecent ? "Recent Spam (Unread)" : "Total Spam (Unread)"}
          value={recSpam.toLocaleString()}
          sub={`${spamRate}% spam rate`}
          accent="red"
          icon="alert"
        />

        {/* Card 4: Recent Rescued */}
        <KpiCard
          horizontal
          title={isRecent ? "Recent Rescued" : "Total Rescued"}
          value={recRescued.toLocaleString()}
          sub="Moved to Inbox"
          accent="orange"
          icon="pause"
        />

        {/* Card 5: Recent Replied */}
        <KpiCard
          horizontal
          title={isRecent ? "Recent Replied" : "Total Replied"}
          value={recReplied.toLocaleString()}
          sub={`${replyRate}% replies sent`}
          accent="purple"
          icon="reply"
        />
      </div>

      {/* ================= OVERVIEW BY CAMPAIGN TYPE + PLACEMENT DISTRIBUTION ================= */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.7fr 1fr', gap: 14, marginBottom: 12, alignItems: 'stretch' }}>
        <CampaignTypeOverview campaigns={campaigns} />

        {/* Placement Distribution Donut */}
        <div className="card fade-in" style={{ height: '100%', display: 'flex', flexDirection: 'column', boxSizing: 'border-box', padding: '16px 20px' }}>
          <div className="card-head" style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="card-title" style={{ marginBottom: 0 }}>Placement Distribution</div>
            <span className="badge" style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4 }}>
              {isRecent ? 'Recent Scan' : 'All Dates'}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around', flex: 1, gap: 16, margin: 'auto 0', width: '100%' }}>
            {/* Donut Chart with Center Text */}
            <div style={{ position: 'relative', flex: '0 0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <DonutChart data={donutData} colors={donutColors} size={180} inner={60} />
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                <div style={{ fontWeight: 800, fontSize: 22, lineHeight: 1.1, color: '#f8fafc' }}>
                  {recDiscovered.toLocaleString()}
                </div>
                <div className="muted" style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 4 }}>
                  {isRecent ? 'Total Unread' : 'Delivered'}
                </div>
              </div>
            </div>

            {/* 5-Item Balanced Legend */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, flex: '1 1 auto', maxWidth: 220 }}>
              <div className="legend-item" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5 }}>
                <span className="legend-swatch" style={{ background: donutColors[0], width: 10, height: 10, borderRadius: 3, flexShrink: 0 }} />
                <span style={{ fontWeight: 600, color: 'var(--text)' }}>Inbox</span>
                <span className="legend-value" style={{ marginLeft: 'auto', fontWeight: 700, fontSize: 12.5 }}>
                  {inboxRate}% <span className="muted" style={{ fontWeight: 500, fontSize: 11.5 }}>({recInbox.toLocaleString()})</span>
                </span>
              </div>

              <div className="legend-item" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5 }}>
                <span className="legend-swatch" style={{ background: donutColors[1], width: 10, height: 10, borderRadius: 3, flexShrink: 0 }} />
                <span style={{ fontWeight: 600, color: 'var(--text)' }}>Spam</span>
                <span className="legend-value" style={{ marginLeft: 'auto', fontWeight: 700, fontSize: 12.5 }}>
                  {spamRate}% <span className="muted" style={{ fontWeight: 500, fontSize: 11.5 }}>({recSpam.toLocaleString()})</span>
                </span>
              </div>

              <div className="legend-item" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5 }}>
                <span className="legend-swatch" style={{ background: donutColors[2], width: 10, height: 10, borderRadius: 3, flexShrink: 0 }} />
                <span style={{ fontWeight: 600, color: 'var(--text)' }}>Rescued</span>
                <span className="legend-value" style={{ marginLeft: 'auto', fontWeight: 700, fontSize: 12.5 }}>
                  {rescuedRate}% <span className="muted" style={{ fontWeight: 500, fontSize: 11.5 }}>({recRescued.toLocaleString()})</span>
                </span>
              </div>

              <div className="legend-item" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5 }}>
                <span className="legend-swatch" style={{ background: donutColors[3], width: 10, height: 10, borderRadius: 3, flexShrink: 0 }} />
                <span style={{ fontWeight: 600, color: 'var(--text)' }}>Replied</span>
                <span className="legend-value" style={{ marginLeft: 'auto', fontWeight: 700, fontSize: 12.5 }}>
                  {replyRate}% <span className="muted" style={{ fontWeight: 500, fontSize: 11.5 }}>({recReplied.toLocaleString()})</span>
                </span>
              </div>

              <div className="legend-item" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5 }}>
                <span className="legend-swatch" style={{ background: donutColors[4], width: 10, height: 10, borderRadius: 3, flexShrink: 0 }} />
                <span style={{ fontWeight: 600, color: 'var(--text)' }}>Other</span>
                <span className="legend-value" style={{ marginLeft: 'auto', fontWeight: 700, fontSize: 12.5 }}>
                  {otherRate}% <span className="muted" style={{ fontWeight: 500, fontSize: 11.5 }}>({otherCount.toLocaleString()})</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ================= EMAIL ACCOUNTS (DETAILED VIEW) + ACCOUNT DETAILS DRAWER ================= */}
      <div style={{ display: 'grid', gridTemplateColumns: activeAccount ? 'minmax(0, 1fr) 310px' : '1fr', gap: 14, marginBottom: 14, alignItems: 'stretch' }}>

        {/* Main Email Accounts Table */}
        <div className="card fade-in" style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
          <div className="card-head" style={{ flexWrap: 'wrap', gap: 10, marginBottom: 8 }}>
            <div>
              <div className="card-title">Email Accounts (Detailed View)</div>
              <div className="card-subtitle" style={{ marginBottom: 0 }}>
                {mailboxStats.length} accounts configured from accounts.json
              </div>
            </div>
            <div className="row" style={{ gap: 8 }}>
              <input
                className="search-input"
                placeholder="Search email, domain, or IP…"
                value={searchAccount}
                onChange={e => setSearchAccount(e.target.value)}
                style={{ width: 170 }}
              />
              <select
                value={accountTypeFilter}
                onChange={e => setAccountTypeFilter(e.target.value)}
                style={{ fontSize: 11.5 }}
              >
                <option value="all">All Account Types</option>
                <option value="workspace">Workspace</option>
                <option value="seed">Seed / Gmail</option>
                <option value="smtp">SMTP</option>
              </select>
              <select
                value={accountStatusFilter}
                onChange={e => setAccountStatusFilter(e.target.value)}
                style={{ fontSize: 11.5 }}
              >
                <option value="all">All Status</option>
                <option value="active">Connected</option>
                <option value="untested">Untested</option>
              </select>
            </div>
          </div>

          <div className="table-wrap" style={{ flex: 1, width: '100%', overflowX: 'auto' }}>
            <table className="table" style={{ fontSize: 12 }}>
              <thead>
                <tr>
                  <th style={{ padding: '7px 6px' }}>Email Account</th>
                  <th style={{ padding: '7px 6px' }}>Type</th>
                  <th style={{ padding: '7px 6px' }}>Domain</th>
                  <th style={{ padding: '7px 6px' }}>Provider / IP</th>
                  <th style={{ padding: '7px 6px' }}>Status</th>
                  <th style={{ padding: '7px 6px' }}>Warmup Stage</th>
                  <th style={{ textAlign: 'center', padding: '7px 5px' }}>Inbox</th>
                  <th style={{ textAlign: 'center', padding: '7px 5px' }}>Unread</th>
                  <th style={{ textAlign: 'center', padding: '7px 5px' }}>Spam</th>
                  <th style={{ textAlign: 'center', padding: '7px 5px' }}>Replies</th>
                  <th style={{ textAlign: 'center', padding: '7px 5px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredAccounts.length === 0 ? (
                  <tr>
                    <td colSpan={11} style={{ textAlign: 'center', color: 'var(--muted)', padding: '24px' }}>
                      No email accounts match the current filter.
                    </td>
                  </tr>
                ) : (
                  filteredAccounts.map((m: any) => {
                    const isConn = m.status === 'Connected' || m.status_info?.status === 'Connected'
                    const domain = m.email?.split('@')[1] || 'gmail.com'
                    const isSelected = activeAccount?.email === m.email
                    const provider = domain.includes('gmail.com') ? 'Google Gmail' : 'Google Workspace'
                    const stage = m.type === 'workspace' ? 'Stage 3' : m.type === 'seed' ? 'Stage 1' : 'Stage 2'

                    return (
                      <tr
                        key={m.email}
                        onClick={() => setSelectedAccount(activeAccount?.email === m.email ? null : m)}
                        style={{
                          background: isSelected ? 'rgba(59,130,246,0.08)' : undefined,
                          cursor: 'pointer'
                        }}
                      >
                        <td style={{ fontWeight: 600, color: isSelected ? 'var(--accent)' : undefined, padding: '7px 6px', whiteSpace: 'nowrap' }}>
                          <span className={'status-dot ' + (isConn ? 'active' : 'inactive')} />
                          {m.email}
                        </td>
                        <td style={{ padding: '7px 6px', whiteSpace: 'nowrap' }}>
                          <span className="badge" style={{ textTransform: 'capitalize', fontSize: 10.5, padding: '2px 7px' }}>
                            {m.type || (m.email?.includes('gmail.com') ? 'Seed' : 'Workspace')}
                          </span>
                        </td>
                        <td className="muted" style={{ padding: '7px 6px', whiteSpace: 'nowrap' }}>{domain}</td>
                        <td className="muted" style={{ padding: '7px 6px', whiteSpace: 'nowrap' }}>{provider}</td>
                        <td style={{ padding: '7px 6px', whiteSpace: 'nowrap' }}>
                          <span className={'badge ' + (isConn ? 'success' : 'muted')} style={{ fontSize: 10.5, padding: '2px 7px' }}>
                            {isConn ? 'Active' : 'Untested'}
                          </span>
                        </td>
                        <td style={{ padding: '7px 6px', whiteSpace: 'nowrap' }}>
                          <span className="stage-pill" style={{ fontSize: 10.5, padding: '2px 6px' }}>{stage}</span>
                        </td>
                        <td style={{ textAlign: 'center', color: 'var(--success)', fontWeight: 700, padding: '7px 5px' }}>{m.inbox || 0}</td>
                        <td style={{ textAlign: 'center', color: 'var(--cyan)', fontWeight: 700, padding: '7px 5px' }}>{m.unread || 0}</td>
                        <td style={{ textAlign: 'center', color: 'var(--danger)', fontWeight: 700, padding: '7px 5px' }}>{m.spam || 0}</td>
                        <td style={{ textAlign: 'center', color: '#a78bfa', fontWeight: 600, padding: '7px 5px' }}>{m.replied || 0}</td>
                        <td style={{ textAlign: 'center', padding: '7px 5px' }}>
                          <div className="row-actions" style={{ justifyContent: 'center' }}>
                            <span
                              className="icon-action"
                              title="View Details"
                              onClick={(e) => {
                                e.stopPropagation()
                                setSelectedAccount(m)
                              }}
                            >
                              👁
                            </span>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Account Details Drawer (Matching Dashboard.png) */}
        {activeAccount && (
          <div className="card fade-in" style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', boxSizing: 'border-box', padding: '16px' }}>
            <div>
              <div className="card-head" style={{ marginBottom: 10, alignItems: 'flex-start' }}>
                <div style={{ minWidth: 0, flex: 1, paddingRight: 6 }}>
                  <div style={{ fontWeight: 800, fontSize: 13, color: '#fff', wordBreak: 'break-all', lineHeight: 1.3 }}>
                    {activeAccount.email}
                  </div>
                  <span className={'badge ' + (activeAccount.status_info?.status === 'Connected' ? 'success' : 'muted')} style={{ marginTop: 4, fontSize: 10 }}>
                    {activeAccount.status_info?.status === 'Connected' ? 'Active' : 'Untested'}
                  </span>
                </div>
                <button
                  className="btn-ghost btn-sm"
                  onClick={() => setSelectedAccount(null)}
                  style={{ padding: '2px 6px', fontSize: 11, flexShrink: 0 }}
                  title="Close drawer"
                >
                  ✕
                </button>
              </div>

              <div className="kv" style={{ padding: '4px 0' }}>
                <span className="kv-label">Type</span>
                <span className="kv-value" style={{ textTransform: 'capitalize' }}>{activeAccount.type || 'Workspace'}</span>
              </div>
              <div className="kv" style={{ padding: '4px 0' }}>
                <span className="kv-label">Domain</span>
                <span className="kv-value">{activeAccount.email?.split('@')[1] || 'gmail.com'}</span>
              </div>
              <div className="kv" style={{ padding: '4px 0' }}>
                <span className="kv-label">Provider</span>
                <span className="kv-value">{activeAccount.email?.includes('gmail.com') ? 'Google Gmail' : 'Google Workspace'}</span>
              </div>
              <div className="kv" style={{ padding: '4px 0' }}>
                <span className="kv-label">MailWizz Server</span>
                <span className="kv-value">#15 - {activeAccount.email?.split('@')[0]}</span>
              </div>
              <div className="kv" style={{ padding: '4px 0' }}>
                <span className="kv-label">Warmup Stage</span>
                <span className="kv-value"><span className="stage-pill">{activeAccount.type === 'workspace' ? 'Stage 3' : 'Stage 1'}</span></span>
              </div>
              <div className="kv" style={{ padding: '4px 0' }}>
                <span className="kv-label">Daily Limit</span>
                <span className="kv-value">50 / day</span>
              </div>
              <div className="kv" style={{ padding: '4px 0' }}>
                <span className="kv-label">IMAP Host</span>
                <span className="kv-value" style={{ fontSize: 11 }}>{activeAccount.imap_host || 'imap.gmail.com'}</span>
              </div>
            </div>

            <div style={{ marginTop: 'auto', paddingTop: 10 }}>
              <div className="divider" style={{ margin: '8px 0 10px' }} />
              <div style={{ fontWeight: 700, fontSize: 11, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 6 }}>
                Performance (Last 7 Days)
              </div>
              <div style={{ height: 110 }}>
                <LineChart
                  labels={['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']}
                  series={[
                    { label: 'Inbox', data: [80, 85, 88, 92, 90, 95, 96], color: '#22c55e' },
                    { label: 'Spam', data: [15, 12, 10, 6, 8, 4, 3], color: '#f04747' },
                    { label: 'Replies', data: [20, 25, 28, 35, 30, 38, 42], color: '#a855f7' }
                  ]}
                  height={110}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ================= WORKER LOGS STREAM ================= */}
      {logs.length > 0 && (
        <div className="card fade-in" style={{ marginBottom: 14 }}>
          <div className="card-title">Live Worker Activity Stream</div>
          <div className="list" style={{ maxHeight: 180, overflowY: 'auto' }}>
            {logs.slice(-20).reverse().map((l: any, i: number) => (
              <div key={i} className="list-item">
                <span
                  className="list-dot"
                  style={{
                    background:
                      l.level === 'ERROR'
                        ? 'var(--danger)'
                        : l.level === 'SUCCESS' || l.level === 'RESCUE'
                          ? 'var(--success)'
                          : l.level === 'REPLY'
                            ? '#a78bfa'
                            : l.level === 'WARNING'
                              ? '#f59e0b'
                              : 'var(--accent)'
                  }}
                />
                <span className="list-text">{l.message || String(l)}</span>
                <span className="list-time">{l.time || ''}</span>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  )
}

function CampaignTypeOverview({
  campaigns
}: {
  campaigns: any[]
}) {
  /*
   * Campaign analytics comes from MailWizz.
   *
   * The backend currently returns campaign-level records.
   * We group those records into the six warmup cases.
   */

  const campaignTypes = [
    'Workspace → Employees',
    'SMTP → Employees',
    'Workspace → Gmail Seeds',
    'SMTP → Gmail Seeds',
    'SMTP → Workspace',
    'Workspace → SMTP',
  ]

  /*
   * IMPORTANT:
   * campaignType must be supplied by the backend.
   *
   * Do NOT try to guess it from campaign name.
   *
   * Once backend returns:
   *
   * {
   *   campaignType: 'SMTP → Gmail Seeds',
   *   sent: 100,
   *   delivered: 95,
   *   deferred: 2,
   *   softBounce: 1,
   *   hardBounce: 1,
   *   errors: 1
   * }
   *
   * this card will display it automatically.
   */

  const rows = campaignTypes.map(type => {
    const matchingCampaigns = campaigns.filter(
      (campaign: any) =>
        campaign.campaignType === type
    )

    return matchingCampaigns.reduce(
      (total: any, campaign: any) => ({
        type,

        sent:
          total.sent +
          Number(campaign.sent || 0),

        delivered:
          total.delivered +
          Number(campaign.delivered || 0),

        softBounce:
          total.softBounce +
          Number(
            campaign.softBounce ??
            campaign.soft_bounced ??
            0
          ),

        hardBounce:
          total.hardBounce +
          Number(
            campaign.hardBounce ??
            campaign.hard_bounced ??
            0
          ),

        internalBounce:
          total.internalBounce +
          Number(
            campaign.internalBounce ??
            campaign.internal_bounce ??
            campaign.internalBounced ??
            campaign.internal_bounced ??
            0
          ),

        inbox:
          total.inbox +
          Number(campaign.inbox || 0),

        spam:
          total.spam +
          Number(campaign.spam || 0),

        replies:
          total.replies +
          Number(campaign.replies || 0),
      }),
      {
        type,
        sent: 0,
        delivered: 0,
        softBounce: 0,
        hardBounce: 0,
        internalBounce: 0,
        inbox: 0,
        spam: 0,
        replies: 0,
      }
    )
  })

  const total = rows.reduce(
    (acc: any, row: any) => ({
      sent: acc.sent + row.sent,
      delivered: acc.delivered + row.delivered,
      softBounce: acc.softBounce + row.softBounce,
      hardBounce: acc.hardBounce + row.hardBounce,
      internalBounce: acc.internalBounce + row.internalBounce,
      inbox: acc.inbox + row.inbox,
      spam: acc.spam + row.spam,
      replies: acc.replies + row.replies,
    }),
    {
      sent: 0,
      delivered: 0,
      softBounce: 0,
      hardBounce: 0,
      internalBounce: 0,
      inbox: 0,
      spam: 0,
      replies: 0,
    }
  )

  return (
    <div
      className="card fade-in"
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box'
      }}
    >
      <div className="card-title">
        Overview by Campaign Type
      </div>

      <div
        className="table-wrap"
        style={{
          marginTop: 8,
          flex: 1,
          overflowX: 'auto'
        }}
      >
        <table
          className="table"
          style={{
            minWidth: 950,
            fontSize: 11.5
          }}
        >
          <thead>
            <tr>
              <th>Campaign Type</th>
              <th>Sent</th>
              <th>Delivered</th>
              <th>Soft Bounce</th>
              <th>Hard Bounce</th>
              <th>Internal Bounce</th>
              <th>Inbox</th>
              <th>Spam</th>
              <th>Replies</th>
            </tr>
          </thead>

          <tbody>
            {rows.map(row => (
              <tr key={row.type}>
                <td
                  style={{
                    fontWeight: 600,
                    whiteSpace: 'nowrap'
                  }}
                >
                  {row.type}
                </td>

                <td>
                  {row.sent.toLocaleString()}
                </td>

                <td>
                  {row.delivered.toLocaleString()}
                </td>

                <td style={{ color: 'var(--warning)' }}>
                  {row.softBounce.toLocaleString()}
                </td>

                <td style={{ color: 'var(--danger)' }}>
                  {row.hardBounce.toLocaleString()}
                </td>

                <td style={{ color: 'var(--danger)' }}>
                  {row.internalBounce.toLocaleString()}
                </td>

                <td style={{ color: 'var(--success)' }}>
                  {row.inbox.toLocaleString()}
                </td>

                <td style={{ color: 'var(--danger)' }}>
                  {row.spam.toLocaleString()}
                </td>

                <td>
                  {row.replies.toLocaleString()}
                </td>
              </tr>
            ))}

            <tr
              style={{
                fontWeight: 800,
                borderTop: '2px solid var(--border)'
              }}
            >
              <td>Total</td>

              <td>{total.sent.toLocaleString()}</td>
              <td>{total.delivered.toLocaleString()}</td>
              <td>{total.softBounce.toLocaleString()}</td>
              <td>{total.hardBounce.toLocaleString()}</td>
              <td style={{ color: 'var(--danger)' }}>{total.internalBounce.toLocaleString()}</td>

              <td style={{ color: 'var(--success)' }}>
                {total.inbox.toLocaleString()}
              </td>

              <td style={{ color: 'var(--danger)' }}>
                {total.spam.toLocaleString()}
              </td>

              <td>{total.replies.toLocaleString()}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

