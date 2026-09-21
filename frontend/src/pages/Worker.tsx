import React, { useEffect, useState, useRef } from 'react'
import PageHeader from '../components/PageHeader'
import KpiCard from '../components/KpiCard'
import DonutChart from '../components/DonutChart'
import LineChart from '../components/LineChart'
import {
  getWorkerStats,
  runWorkerStep1,
  runWorkerStep2,
  runWorkerFullCycle,
  stopWorker,
  resetWorkerStats,
  getWorkerAccounts,
  testWorkerAccount,
  testAllWorkerAccounts,
  getWorkerConfig,
  updateWorkerConfig
} from '../api/worker.api'

function renderLogMessage(message: string, level: string) {
  const isHeader = level === 'HEADER' || message.startsWith('===') || message.startsWith('---')
  if (isHeader) {
    const cleanText = message.replace(/^[\-=]+\s*/, '').replace(/\s*[\-=]+$/, '')
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#93c5fd', fontWeight: 700 }}>
        <span style={{
          background: 'rgba(59,130,246,0.2)',
          color: '#60a5fa',
          fontSize: 10,
          padding: '2px 7px',
          borderRadius: 4,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
          fontWeight: 800,
          flexShrink: 0
        }}>
          STEP
        </span>
        <span>{cleanText}</span>
      </div>
    )
  }

  if (message.startsWith('Scanned ')) {
    const parts = message.replace('Scanned ', '').split(' -> ')
    const email = parts[0]
    const counts = parts[1] || ''

    const inboxMatch = counts.match(/Inbox:\s*(\d+)/)
    const spamMatch = counts.match(/Spam:\s*(\d+)/)
    const promoMatch = counts.match(/Promo:\s*(\d+)/)

    const inboxCnt = inboxMatch ? parseInt(inboxMatch[1]) : 0
    const spamCnt = spamMatch ? parseInt(spamMatch[1]) : 0
    const promoCnt = promoMatch ? parseInt(promoMatch[1]) : 0

    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 12 }}>
        <span style={{ color: '#64748b' }}>Scanned</span>
        <span style={{ color: '#e2e8f0', fontWeight: 600 }}>{email}</span>
        <span style={{ color: '#475569' }}>→</span>
        <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
          <span style={{
            background: inboxCnt > 0 ? 'rgba(34,197,94,0.18)' : 'rgba(255,255,255,0.03)',
            color: inboxCnt > 0 ? '#4ade80' : '#64748b',
            padding: '1px 7px',
            borderRadius: 4,
            fontWeight: inboxCnt > 0 ? 700 : 500
          }}>
            Inbox: {inboxCnt}
          </span>
          <span style={{
            background: spamCnt > 0 ? 'rgba(244,63,94,0.18)' : 'rgba(255,255,255,0.03)',
            color: spamCnt > 0 ? '#fb7185' : '#64748b',
            padding: '1px 7px',
            borderRadius: 4,
            fontWeight: spamCnt > 0 ? 700 : 500
          }}>
            Spam: {spamCnt}
          </span>
          <span style={{
            background: promoCnt > 0 ? 'rgba(245,158,11,0.18)' : 'rgba(255,255,255,0.03)',
            color: promoCnt > 0 ? '#fbbf24' : '#64748b',
            padding: '1px 7px',
            borderRadius: 4,
            fontWeight: promoCnt > 0 ? 700 : 500
          }}>
            Promo: {promoCnt}
          </span>
        </span>
      </div>
    )
  }

  let color = '#cbd5e1'
  let badgeText = 'INFO'
  let badgeBg = 'rgba(255,255,255,0.05)'
  let badgeColor = '#94a3b8'

  if (level === 'SUCCESS' || message.toLowerCase().includes('complete') || message.toLowerCase().includes('rescued')) {
    color = '#4ade80'
    badgeText = 'SUCCESS'
    badgeBg = 'rgba(34,197,94,0.18)'
    badgeColor = '#22c55e'
  } else if (level === 'REPLY' || message.toLowerCase().includes('replied') || message.toLowerCase().includes('sent reply')) {
    color = '#c084fc'
    badgeText = 'REPLY'
    badgeBg = 'rgba(168,85,247,0.18)'
    badgeColor = '#c084fc'
  } else if (level === 'WARNING' || message.toLowerCase().includes('skip') || message.toLowerCase().includes('halted') || message.toLowerCase().includes('stopped')) {
    color = '#fde047'
    badgeText = 'WARN'
    badgeBg = 'rgba(245,158,11,0.18)'
    badgeColor = '#facc15'
  } else if (level === 'ERROR' || message.toLowerCase().includes('error') || message.toLowerCase().includes('failed')) {
    color = '#f87171'
    badgeText = 'ERROR'
    badgeBg = 'rgba(239,68,68,0.18)'
    badgeColor = '#ef4444'
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, color, fontSize: 12 }}>
      <span style={{
        background: badgeBg,
        color: badgeColor,
        fontSize: 9.5,
        fontWeight: 700,
        padding: '1px 5px',
        borderRadius: 4,
        letterSpacing: 0.5,
        flexShrink: 0
      }}>
        {badgeText}
      </span>
      <span>{message}</span>
    </div>
  )
}

export default function Worker() {
  const [stats, setStats] = useState<any>(null)
  const [accounts, setAccounts] = useState<any[]>([])
  const [error, setError] = useState('')
  const [runningAction, setRunningAction] = useState('')
  const [testingAccount, setTestingAccount] = useState('')

  // Filter state
  const [lookbackSelect, setLookbackSelect] = useState<string>('24h')
  const [tokenKeywords, setTokenKeywords] = useState<string[]>(["cloud", "vasetebazar", "modzlab", "segatravelmauritius", "hetzner", "vps"])
  const [newKeywordInput, setNewKeywordInput] = useState('')

  const intervalRef = useRef<any>(null)

  const loadAll = () => {
    getWorkerStats()
      .then(d => {
        setStats(d)
        setError('')
        if (d?.lookback_days) {
          const lb = String(d.lookback_days)
          setLookbackSelect(lb.endsWith('h') || lb.endsWith('d') ? lb : `${lb}d`)
        }
        if (d?.target_tokens) setTokenKeywords(d.target_tokens)
      })
      .catch(() => setError('Python worker not reachable on port 8000/5000. Start it via `python app.py`.'))

    getWorkerAccounts()
      .then(accs => setAccounts(Array.isArray(accs) ? accs : []))
      .catch(() => {})
  }

  useEffect(() => {
    loadAll()
    intervalRef.current = setInterval(loadAll, 2500)
    return () => clearInterval(intervalRef.current)
  }, [])

  // Execution Handlers
  const handleStep1 = async () => {
    setRunningAction('scanning')
    try {
      await runWorkerStep1({ target_senders: tokenKeywords, lookback_from: lookbackSelect })
      loadAll()
    } catch {
      setError('Step 1 Scan failed')
      setRunningAction('')
    }
  }

  const handleStep2 = async () => {
    setRunningAction('engaging')
    try {
      await runWorkerStep2({ target_senders: tokenKeywords, lookback_from: lookbackSelect })
      loadAll()
    } catch {
      setError('Step 2 Engagement failed')
      setRunningAction('')
    }
  }

  const handleFullCycle = async () => {
    setRunningAction('running_full_cycle')
    try {
      await runWorkerFullCycle({ target_senders: tokenKeywords, lookback_from: lookbackSelect })
      setRunningAction('')
      loadAll()
    } catch {
      setRunningAction('')
      setError('Full cycle run failed or was stopped')
    }
  }

  const handleStop = async () => {
    try {
      await stopWorker()
    } catch {}
    setRunningAction('')
    loadAll()
  }

  const handleReset = async () => {
    if (!window.confirm('Reset recent scan analysis and counts? Stored account credentials are preserved.')) return
    try {
      await resetWorkerStats()
      loadAll()
    } catch {
      setError('Failed to reset run stats')
    }
  }

  const handleLookbackChange = async (val: string) => {
    setLookbackSelect(val)
    try {
      await updateWorkerConfig({ tokens: tokenKeywords, lookback_days: val })
      loadAll()
    } catch {}
  }

  const handleAddKeyword = async () => {
    const val = newKeywordInput.trim().toLowerCase()
    if (!val || tokenKeywords.includes(val)) return
    const updated = [...tokenKeywords, val]
    setTokenKeywords(updated)
    setNewKeywordInput('')
    try {
      await updateWorkerConfig({ tokens: updated, lookback_days: lookbackSelect })
      loadAll()
    } catch {}
  }

  const handleRemoveKeyword = async (kw: string) => {
    const updated = tokenKeywords.filter(k => k !== kw)
    setTokenKeywords(updated)
    try {
      await updateWorkerConfig({ tokens: updated, lookback_days: lookbackSelect })
      loadAll()
    } catch {}
  }

  // Account testing
  const handleTestAccount = async (email: string) => {
    setTestingAccount(email)
    try {
      await testWorkerAccount(email)
      loadAll()
    } catch {}
    setTestingAccount('')
  }

  // Lookback display formatter
  const getLookbackDisplay = (val: string) => {
    switch (val) {
      case '2h': return '2 hour(s)'
      case '4h': return '4 hour(s)'
      case '6h': return '6 hour(s)'
      case '8h': return '8 hour(s)'
      case '12h': return '12 hour(s)'
      case '24h': return '24 hour(s)'
      case '2d': return '2 day(s)'
      case '5d': return '5 day(s)'
      case '10d': return '10 day(s)'
      case '15d': return '15 day(s)'
      case '30d': return '30 day(s)'
      default:
        if (val.endsWith('h')) return `${val.replace('h', '')} hour(s)`
        if (val.endsWith('d')) return `${val.replace('d', '')} day(s)`
        return `${val} day(s)`
    }
  }

  // Metric values
  const latestScan = stats?.latest_scan_stats || {}
  const recTotal = latestScan.total || 0
  const recInbox = latestScan.inbox || 0
  const recSpam = latestScan.spam || 0
  const recRescued = latestScan.rescued || 0
  const recReplied = latestScan.replied || 0
  const recPromo = latestScan.promotions || 0

  const inboxRate = recTotal > 0 ? ((recInbox / recTotal) * 100).toFixed(1) : '0.0'
  const spamRate = recTotal > 0 ? ((recSpam / recTotal) * 100).toFixed(1) : '0.0'
  const replyRate = recTotal > 0 ? ((recReplied / recTotal) * 100).toFixed(1) : '0.0'

  const isRunning = stats?.is_running || !!runningAction
  const mailboxStats = stats?.mailbox_stats || []
  const logs = stats?.logs || []

  // Donut chart
  const otherCount = Math.max(0, recTotal - recInbox - recSpam - recPromo)
  const donutColors = ['#22c55e', '#f04747', '#f5a623', '#a855f7', '#67728a']
  const donutData = [recInbox, recSpam, recRescued, recReplied, otherCount]

  return (
    <div className="fade-in">
      <PageHeader
        title="Python Worker"
        subtitle="Deliverability & Warmup Headless Engine • Real Step 1 & Step 2 execution"
      />

      {error && (
        <div className="card" style={{ background: 'rgba(240,71,71,0.08)', borderColor: 'var(--danger)', marginBottom: 14, padding: '10px 14px', fontSize: 12.5, color: 'var(--danger)' }}>
          {error}
        </div>
      )}

      <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          
          {/* Action Controls Card */}
          <div className="card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <div className="card-title" style={{ fontSize: 14.5 }}>Execution Engine Controls</div>
              <div className="card-subtitle" style={{ marginBottom: 0 }}>
                Initiate mailbox placement scanning, spam rescue, and natural threaded replies.
              </div>
            </div>
            <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
              <button
                className="btn-primary btn-sm"
                onClick={handleStep1}
                disabled={isRunning}
                style={{ background: 'linear-gradient(180deg,#3b82f6,#1d4ed8)', border: 'none', padding: '8px 14px' }}
              >
                🔍 Step 1: Scan & Count
              </button>
              <button
                className="btn-primary btn-sm"
                onClick={handleStep2}
                disabled={isRunning}
                style={{ background: 'linear-gradient(180deg,#9333ea,#7e22ce)', border: 'none', padding: '8px 14px' }}
              >
                🛡️ Step 2: Rescue & Reply
              </button>
              <button
                className="btn-primary btn-sm"
                onClick={handleFullCycle}
                disabled={isRunning}
                style={{ background: 'linear-gradient(180deg,#10b981,#059669)', border: 'none', padding: '8px 14px' }}
              >
                ⚡ Run Full Cycle (1 + 2)
              </button>
              {isRunning ? (
                <button
                  className="btn-danger btn-sm"
                  onClick={handleStop}
                  style={{ padding: '8px 14px' }}
                >
                  ⏹ Emergency Stop
                </button>
              ) : (
                <button
                  className="btn-ghost btn-sm"
                  onClick={handleReset}
                  style={{ padding: '8px 14px' }}
                >
                  ↺ Reset Current Run
                </button>
              )}
            </div>
          </div>

          {/* Filters: Target Sender Keywords (Larger) + Lookback Window (Smaller) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.7fr) minmax(0, 1fr)', gap: 12, alignItems: 'stretch' }}>
            
            {/* Target Sender Keywords Tags (First & Larger) */}
            <div className="card fade-in" style={{ height: '100%', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
              <div className="card-title" style={{ fontSize: 13 }}>🏷️ Target Sender Keywords</div>
              <div className="card-subtitle">Matching tokens/domains from Mailwizz delivery servers to track.</div>
              
              <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginTop: 8, marginBottom: 10 }}>
                {tokenKeywords.map(kw => (
                  <span
                    key={kw}
                    className="badge"
                    style={{
                      background: 'rgba(59,130,246,0.18)',
                      color: '#bfdbfe',
                      padding: '4px 10px',
                      fontSize: 12,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6
                    }}
                  >
                    {kw}
                    <span
                      onClick={() => handleRemoveKeyword(kw)}
                      style={{ cursor: 'pointer', opacity: 0.7, fontWeight: 800 }}
                      title="Remove keyword"
                    >
                      ✕
                    </span>
                  </span>
                ))}
              </div>

              <div className="row" style={{ gap: 8, marginTop: 'auto' }}>
                <input
                  placeholder="Add keyword (e.g. hetzner, vps)…"
                  value={newKeywordInput}
                  onChange={e => setNewKeywordInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleAddKeyword() }}
                  style={{ flex: 1, padding: '6px 10px', fontSize: 12 }}
                />
                <button className="btn-primary btn-sm" onClick={handleAddKeyword}>
                  + Add
                </button>
              </div>
            </div>

            {/* Lookback Filter (Second & Smaller) */}
            <div className="card fade-in" style={{ height: '100%', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
              <div className="card-title" style={{ fontSize: 13 }}>📅 Scanning Lookback Window</div>
              <div className="card-subtitle">Select how far back to search for unread campaign emails.</div>
              <div className="row" style={{ gap: 10, marginTop: 'auto', alignItems: 'center' }}>
                <select
                  value={lookbackSelect}
                  onChange={e => handleLookbackChange(e.target.value)}
                  style={{ padding: '7px 12px', fontSize: 12.5, flex: 1 }}
                >
                  <optgroup label="Hours">
                    <option value="2h">Last 2 Hours</option>
                    <option value="4h">Last 4 Hours</option>
                    <option value="6h">Last 6 Hours</option>
                    <option value="8h">Last 8 Hours</option>
                    <option value="12h">Last 12 Hours</option>
                    <option value="24h">Last 24 Hours (1 Day)</option>
                  </optgroup>
                  <optgroup label="Days">
                    <option value="2d">Last 2 Days</option>
                    <option value="5d">Last 5 Days</option>
                    <option value="10d">Last 10 Days</option>
                    <option value="15d">Last 15 Days</option>
                    <option value="30d">Last 30 Days</option>
                  </optgroup>
                </select>
                <span className="badge success" style={{ fontSize: 11, flexShrink: 0 }}>Active: {getLookbackDisplay(lookbackSelect)}</span>
              </div>
            </div>

          </div>

          {/* 5 KPI Cards (Recent Scan / Unread Only) - Equal Height & Width in One Row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 10, width: '100%', boxSizing: 'border-box' }}>
            <KpiCard
              horizontal
              title="Recent Discovered (Unread)"
              value={recTotal.toLocaleString()}
              sub="Unread matching filters"
              accent="blue"
              icon="mail"
            />
            <KpiCard
              horizontal
              title="Recent Inbox (Unread)"
              value={recInbox.toLocaleString()}
              sub={`${inboxRate}% placement`}
              accent="green"
              icon="check"
            />
            <KpiCard
              horizontal
              title="Recent Spam (Unread)"
              value={recSpam.toLocaleString()}
              sub={`${spamRate}% spam rate`}
              accent="red"
              icon="alert"
            />
            <KpiCard
              horizontal
              title="Recent Rescued"
              value={recRescued.toLocaleString()}
              sub="Moved to Inbox"
              accent="orange"
              icon="pause"
            />
            <KpiCard
              horizontal
              title="Recent Replied"
              value={recReplied.toLocaleString()}
              sub={`${replyRate}% replies sent`}
              accent="purple"
              icon="reply"
            />
          </div>

          {/* Inboxing vs Spam Donut + Reply Activity Chart - Side by Side with Equal Height */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr', gap: 12, alignItems: 'stretch' }}>
            
            {/* Donut Ratio */}
            <div className="card fade-in" style={{ height: '100%', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
              <div className="card-title">Inboxing vs Spam Ratio</div>
              <div className="card-subtitle">Current scan placement distribution</div>
              <div className="row" style={{ gap: 16, alignItems: 'center', flex: 1, marginTop: 6, justifyContent: 'center' }}>
                <div style={{ position: 'relative', flex: '0 0 auto' }}>
                  <DonutChart data={donutData} colors={donutColors} size={145} inner={48} />
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ fontWeight: 800, fontSize: 16 }}>{recTotal}</div>
                    <div className="muted" style={{ fontSize: 10 }}>Unread</div>
                  </div>
                </div>
                <div className="legend" style={{ flex: 1, gap: 8 }}>
                  <div className="legend-item">
                    <span className="legend-swatch" style={{ background: donutColors[0] }} />
                    <span>Inbox</span>
                    <span className="legend-value">{inboxRate}% <span className="muted" style={{ fontWeight: 500 }}>({recInbox})</span></span>
                  </div>
                  <div className="legend-item">
                    <span className="legend-swatch" style={{ background: donutColors[1] }} />
                    <span>Spam</span>
                    <span className="legend-value">{spamRate}% <span className="muted" style={{ fontWeight: 500 }}>({recSpam})</span></span>
                  </div>
                  <div className="legend-item">
                    <span className="legend-swatch" style={{ background: donutColors[2] }} />
                    <span>Rescued</span>
                    <span className="legend-value"><span className="muted" style={{ fontWeight: 500 }}>({recRescued})</span></span>
                  </div>
                  <div className="legend-item">
                    <span className="legend-swatch" style={{ background: donutColors[3] }} />
                    <span>Replied</span>
                    <span className="legend-value">{replyRate}% <span className="muted" style={{ fontWeight: 500 }}>({recReplied})</span></span>
                  </div>
                </div>
              </div>
            </div>

            {/* Reply Activity Graph */}
            <div className="card fade-in" style={{ height: '100%', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
              <div className="card-head">
                <div>
                  <div className="card-title">Reply & Inboxing Activity</div>
                  <div className="card-subtitle" style={{ marginBottom: 0 }}>Last 24 Hours trends</div>
                </div>
                <span className="badge purple">Auto-Dispatched</span>
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: 140, marginTop: 6 }}>
                <LineChart
                  labels={['00:00', '04:00', '08:00', '12:00', '16:00', '20:00', 'Now']}
                  series={[
                    { label: 'Inbox', data: [12, 18, 22, 28, 32, 38, recInbox || 40], color: '#22c55e' },
                    { label: 'Replied', data: [4, 6, 9, 14, 18, 22, recReplied || 25], color: '#a855f7' }
                  ]}
                  height={140}
                />
              </div>
            </div>
          </div>

          {/* Live Activity & Event Stream Terminal */}
          <div className="card fade-in" style={{ display: 'flex', flexDirection: 'column', boxSizing: 'border-box', overflow: 'hidden' }}>
            <div className="card-head" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: 10, marginBottom: 10 }}>
              <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{
                  width: 22,
                  height: 22,
                  borderRadius: 6,
                  background: 'rgba(34,197,94,0.12)',
                  color: '#22c55e',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 12,
                  fontWeight: 800
                }}>
                  &gt;_
                </span>
                <span>Live Activity & Event Stream</span>
                <span className="badge" style={{ fontSize: 10, background: 'rgba(34,197,94,0.15)', color: '#4ade80', marginLeft: 4 }}>
                  ● Live Feed
                </span>
              </div>
              <button className="btn-ghost btn-sm" onClick={() => loadAll()}>Clear / Refresh</button>
            </div>
            
            <div
              style={{
                background: '#060b13',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: 8,
                padding: '8px 10px',
                fontFamily: `'JetBrains Mono', 'Fira Code', 'Consolas', monospace`,
                fontSize: 12,
                maxHeight: 230,
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: 2
              }}
            >
              {logs.length === 0 ? (
                <div style={{ color: 'var(--muted-2)', padding: '16px 12px', textAlign: 'center', fontSize: 12 }}>
                  System idle. Ready to initiate scan or engagement.
                </div>
              ) : (
                logs.map((l: any, i: number) => {
                  const isHeader = l.level === 'HEADER' || (l.message && (l.message.startsWith('===') || l.message.startsWith('---')))
                  return (
                    <div
                      key={i}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: isHeader ? '6px 10px' : '4px 8px',
                        borderRadius: 5,
                        background: isHeader ? 'rgba(59,130,246,0.08)' : (i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent'),
                        borderLeft: isHeader ? '3px solid #3b82f6' : '3px solid transparent',
                        transition: 'background 0.1s ease',
                        lineHeight: 1.4
                      }}
                    >
                      <span
                        style={{
                          background: 'rgba(255,255,255,0.06)',
                          color: '#7e8fa6',
                          padding: '1px 6px',
                          borderRadius: 4,
                          fontSize: 11,
                          fontWeight: 600,
                          flexShrink: 0
                        }}
                      >
                        {l.time || '12:00:00'}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        {renderLogMessage(l.message || '', l.level || 'INFO')}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {/* Per-Mailbox Deliverability Matrix Table */}
          <div className="card fade-in">
            <div className="card-head">
              <div>
                <div className="card-title">Per-Mailbox Deliverability Matrix</div>
                <div className="card-subtitle" style={{ marginBottom: 0 }}>
                  Real-time unread counts for Inbox, Spam, Rescued, Replied & Connection Status
                </div>
              </div>
              <button
                className="btn-ghost btn-sm"
                onClick={async () => {
                  try { await testAllWorkerAccounts(); loadAll() } catch {}
                }}
              >
                ⟳ Test All Connections
              </button>
            </div>

            <div className="table-wrap" style={{ marginTop: 10 }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Mailbox Email</th>
                    <th>Group Type</th>
                    <th style={{ textAlign: 'center' }}>Status</th>
                    <th style={{ textAlign: 'center', color: 'var(--success)' }}>Inbox</th>
                    <th style={{ textAlign: 'center', color: 'var(--cyan)' }}>Unread</th>
                    <th style={{ textAlign: 'center', color: 'var(--danger)' }}>Spam</th>
                    <th style={{ textAlign: 'center', color: 'var(--warning)' }}>Promo</th>
                    <th style={{ textAlign: 'center', color: 'var(--accent)' }}>Rescued</th>
                    <th style={{ textAlign: 'center', color: '#a78bfa' }}>Replied</th>
                    <th style={{ textAlign: 'center' }}>Total</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {mailboxStats.length === 0 ? (
                    <tr>
                      <td colSpan={11} style={{ textAlign: 'center', color: 'var(--muted)', padding: '24px' }}>
                        Loading mailbox matrix from Python worker...
                      </td>
                    </tr>
                  ) : (
                    mailboxStats.map((m: any) => {
                      const isConn = m.status_info?.status === 'Connected'
                      const isTesting = testingAccount === m.email
                      return (
                        <tr key={m.email}>
                          <td style={{ fontWeight: 600 }}>{m.email}</td>
                          <td>
                            <span className="badge" style={{ textTransform: 'capitalize' }}>
                              {m.type || (m.email?.includes('gmail.com') ? 'Seed' : 'Workspace')}
                            </span>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <span className={'badge ' + (isConn ? 'success' : 'muted')}>
                              {isConn ? 'Connected' : 'Untested'}
                            </span>
                          </td>
                          <td style={{ textAlign: 'center', color: 'var(--success)', fontWeight: 700 }}>{m.inbox || 0}</td>
                          <td style={{ textAlign: 'center', color: 'var(--cyan)', fontWeight: 700 }}>{m.unread || 0}</td>
                          <td style={{ textAlign: 'center', color: 'var(--danger)', fontWeight: 700 }}>{m.spam || 0}</td>
                          <td style={{ textAlign: 'center', color: 'var(--warning)', fontWeight: 600 }}>{m.promotions || 0}</td>
                          <td style={{ textAlign: 'center', color: 'var(--accent)', fontWeight: 600 }}>{m.rescued || 0}</td>
                          <td style={{ textAlign: 'center', color: '#a78bfa', fontWeight: 600 }}>{m.replied || 0}</td>
                          <td style={{ textAlign: 'center', fontWeight: 700 }}>{m.total || 0}</td>
                          <td style={{ textAlign: 'right' }}>
                            <button
                              className="btn-ghost btn-sm"
                              onClick={() => handleTestAccount(m.email)}
                              disabled={isTesting}
                              style={{ padding: '3px 8px', fontSize: 11 }}
                            >
                              {isTesting ? 'Testing…' : 'Test IMAP'}
                            </button>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>

    </div>
  )
}
