import React, { useEffect, useState } from 'react'
import PageHeader from '../components/PageHeader'
import KpiCard from '../components/KpiCard'
import LoadingState from '../components/LoadingState'
import EmptyState from '../components/EmptyState'
import { getMailwizzDeliveryServers, MailwizzDbConfig } from '../api/mailwizz.api'
import { getWorkerAccounts, testWorkerAccount, testAllWorkerAccounts } from '../api/worker.api'

const STORAGE_KEY = 'mailwizz_db_config'

export default function SmtpAccounts() {
  const [accounts, setAccounts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [testing, setTesting] = useState('')
  const [source, setSource] = useState<'mailwizz_db' | 'worker_local'>('mailwizz_db')
  const [page, setPage] = useState(1)
  const pageSize = 50

  const load = async () => {
    setLoading(true)
    let savedConfig: Partial<MailwizzDbConfig> | undefined = undefined
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) savedConfig = JSON.parse(saved)
    } catch {}

    try {
      // 1. Fetch from MailWizz direct database delivery servers
      const res = await getMailwizzDeliveryServers(savedConfig)
      if (res && res.success && Array.isArray(res.data) && res.data.length > 0) {
        const seen = new Set<string>()
        const deduped = res.data.filter((s: any) => {
          const key = (s.email || `server_${s.server_id}`).toLowerCase()
          if (!seen.has(key)) {
            seen.add(key)
            return true
          }
          return false
        })
        setAccounts(deduped)
        setSource('mailwizz_db')
        setLoading(false)
        return
      }
    } catch (e) {
      console.warn('Direct MailWizz delivery servers fetch fallback to worker accounts:', e)
    }

    // 2. Fallback: fetch SMTP accounts from worker account.json
    try {
      const workerAccs = await getWorkerAccounts()
      const list = Array.isArray(workerAccs) ? workerAccs : []
      const seen = new Set<string>()
      const smtpOnly = list.filter((a: any) => {
        const isSmtp = (a.account_type || '').toLowerCase() === 'smtp'
        const email = (a.email || '').toLowerCase()
        if (isSmtp && email && !seen.has(email)) {
          seen.add(email)
          return true
        }
        return false
      })
      setAccounts(smtpOnly)
      setSource('worker_local')
    } catch {
      setAccounts([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const handleTest = async (email: string) => {
    setTesting(email)
    try {
      await testWorkerAccount(email)
      load()
    } catch {}
    setTesting('')
  }

  const handleTestAll = async () => {
    setTesting('all')
    try {
      await testAllWorkerAccounts()
      load()
    } catch {}
    setTesting('')
  }

  const filtered = accounts.filter(a => {
    if (search) {
      const q = search.toLowerCase()
      const matchEmail = a.email?.toLowerCase().includes(q)
      const matchHost = a.smtp_host?.toLowerCase().includes(q) || a.hostname?.toLowerCase().includes(q)
      const matchName = a.name?.toLowerCase().includes(q) || a.display_name?.toLowerCase().includes(q)
      const matchDomain = a.domain?.toLowerCase().includes(q)
      if (!matchEmail && !matchHost && !matchName && !matchDomain) return false
    }
    if (statusFilter !== 'all') {
      const isConn = a.status === 'Active' || a.status_info?.status === 'Connected' || a.status === 'active'
      if (statusFilter === 'active' && !isConn) return false
      if (statusFilter === 'inactive' && isConn) return false
    }
    return true
  })

  const total = accounts.length
  const connected = accounts.filter(a => a.status === 'Active' || a.status_info?.status === 'Connected' || a.status === 'active').length
  const uniqueDomains = new Set(accounts.map(a => a.domain || a.email?.split('@')[1] || a.hostname)).size
  const totalHourlyQuota = accounts.reduce((acc, curr) => acc + (Number(curr.hourly_quota) || 0), 0)

  // Pagination for large sets (e.g. 545 delivery servers)
  const totalPages = Math.ceil(filtered.length / pageSize) || 1
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize)

  return (
    <div className="fade-in">
      <PageHeader
        title="Email Accounts — SMTP Delivery Servers"
        subtitle={`All SMTP sending accounts fetched from MailWizz database (${total} delivery servers).`}
        actions={
          <div className="row" style={{ gap: 8 }}>
            <span
              className="badge"
              style={{
                background: source === 'mailwizz_db' ? 'var(--success-bg)' : 'var(--surface-2)',
                color: source === 'mailwizz_db' ? 'var(--success)' : 'var(--muted)',
                fontSize: 11,
              }}
            >
              ● {source === 'mailwizz_db' ? 'MailWizz DB Synced' : 'Local Fallback'}
            </span>
            <button className="btn-ghost btn-sm" onClick={load} disabled={loading}>
              ⟳ Refresh
            </button>
            <button className="btn-ghost btn-sm" onClick={handleTestAll} disabled={!!testing}>
              {testing === 'all' ? 'Testing...' : '⚡ Test All'}
            </button>
          </div>
        }
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 14 }}>
        <KpiCard title="SMTP Delivery Servers" value={total} accent="blue" icon="server" />
        <KpiCard
          title="Active / Connected"
          value={connected}
          sub={`${total > 0 ? ((connected / total) * 100).toFixed(0) : 0}%`}
          accent="green"
          icon="check"
        />
        <KpiCard title="Sending Domains" value={uniqueDomains} accent="purple" icon="mail" />
        <KpiCard
          title="Total Hourly Quota"
          value={totalHourlyQuota > 0 ? `${totalHourlyQuota.toLocaleString()}/hr` : `${total} servers`}
          accent="cyan"
          icon="shield"
        />
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <div className="filters-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="row" style={{ gap: 8 }}>
            <input
              className="search-input"
              placeholder="Search SMTP email, host, display name, domain…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ width: 320 }}
            />
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="all">All Statuses ({total})</option>
              <option value="active">Active ({connected})</option>
              <option value="inactive">Inactive ({total - connected})</option>
            </select>
          </div>
          <div className="muted" style={{ fontSize: 12 }}>
            Showing {filtered.length === 0 ? 0 : (page - 1) * pageSize + 1}–
            {Math.min(page * pageSize, filtered.length)} of {filtered.length}
          </div>
        </div>
      </div>

      {loading ? (
        <LoadingState />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No SMTP delivery servers found"
          description="No delivery servers match your current search and filter criteria."
        />
      ) : (
        <div className="card slide-up">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: 70 }}>ID</th>
                  <th>Delivery Server / Email</th>
                  <th>Domain</th>
                  <th>Hostname / Provider</th>
                  <th>Port</th>
                  <th>Hourly Quota</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map(a => {
                  const isConn = a.status === 'Active' || a.status_info?.status === 'Connected' || a.status === 'active'
                  const serverId = a.server_id || a.id || '—'
                  const domain = a.domain || (a.email && a.email.includes('@') ? a.email.split('@')[1] : a.hostname)
                  return (
                    <tr key={a.id || a.server_id || a.email}>
                      <td className="muted" style={{ fontFamily: 'monospace', fontSize: 11 }}>
                        #{serverId}
                      </td>
                      <td style={{ fontWeight: 600 }}>
                        <span className={'status-dot ' + (isConn ? 'active' : 'inactive')} />
                        {a.email}
                      </td>
                      <td>{domain}</td>
                      <td>
                        <span style={{ fontFamily: 'monospace', fontSize: 11.5 }}>
                          {a.smtp_host || a.hostname || '—'}
                        </span>
                      </td>
                      <td className="muted" style={{ fontSize: 11.5 }}>
                        {a.smtp_port || 587} ({a.protocol || 'tls'})
                      </td>
                      <td>
                        {a.hourly_quota ? (
                          <span className="badge" style={{ background: 'var(--surface-2)', color: 'var(--text)' }}>
                            {a.hourly_quota.toLocaleString()}/hr
                          </span>
                        ) : (
                          <span className="muted">Unlimited</span>
                        )}
                      </td>
                      <td>
                        <span className="badge" style={{ textTransform: 'uppercase', fontSize: 10 }}>
                          {a.type || 'SMTP'}
                        </span>
                      </td>
                      <td>
                        <span className={'badge ' + (isConn ? 'success' : 'muted')}>
                          {isConn ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          className="btn-ghost btn-sm"
                          onClick={() => handleTest(a.email)}
                          disabled={testing === a.email}
                          style={{ padding: '3px 8px', fontSize: 11 }}
                        >
                          {testing === a.email ? 'Testing…' : 'Test'}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 16px',
                borderTop: '1px solid var(--border-soft)',
                fontSize: 12,
              }}
            >
              <span className="muted">
                Page {page} of {totalPages} ({filtered.length} total delivery servers)
              </span>
              <div className="row" style={{ gap: 6 }}>
                <button
                  className="btn-ghost btn-sm"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  style={{ padding: '4px 10px' }}
                >
                  ◀ Prev
                </button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pNum = i + 1
                  if (totalPages > 5) {
                    if (page > 3) pNum = page - 2 + i
                    if (pNum > totalPages) pNum = totalPages - 4 + i
                  }
                  return (
                    <button
                      key={pNum}
                      className={page === pNum ? 'btn-primary btn-sm' : 'btn-ghost btn-sm'}
                      onClick={() => setPage(pNum)}
                      style={{ padding: '4px 10px', minWidth: 28 }}
                    >
                      {pNum}
                    </button>
                  )
                })}
                <button
                  className="btn-ghost btn-sm"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  style={{ padding: '4px 10px' }}
                >
                  Next ▶
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
