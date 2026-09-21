import React, { useEffect, useState } from 'react'
import PageHeader from '../components/PageHeader'
import KpiCard from '../components/KpiCard'
import LoadingState from '../components/LoadingState'
import EmptyState from '../components/EmptyState'
import { getMailwizzSeedAccounts, MailwizzDbConfig } from '../api/mailwizz.api'
import { testWorkerAccount, testAllWorkerAccounts } from '../api/worker.api'

const STORAGE_KEY = 'mailwizz_db_config'

export default function SeedAccounts() {
  const [accounts, setAccounts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [testing, setTesting] = useState('')

  const load = async () => {
    setLoading(true)
    let savedConfig: Partial<MailwizzDbConfig> | undefined = undefined
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) savedConfig = JSON.parse(saved)
    } catch {}

    try {
      const res = await getMailwizzSeedAccounts(savedConfig)
      if (res && res.success && Array.isArray(res.data)) {
        const seen = new Set<string>()
        const deduped = res.data.filter((a: any) => {
          const email = (a.email || '').toLowerCase().trim()
          if (!email) return false
          if (!seen.has(email)) {
            seen.add(email)
            return true
          }
          return false
        })
        setAccounts(deduped)
      } else {
        setAccounts([])
      }
    } catch (e) {
      console.error('Failed to load seed accounts from MailWizz DB:', e)
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
    try { await testWorkerAccount(email); load() } catch {}
    setTesting('')
  }

  const handleTestAll = async () => {
    setTesting('all')
    try { await testAllWorkerAccounts(); load() } catch {}
    setTesting('')
  }

  const filtered = accounts.filter(a => !search || a.email?.toLowerCase().includes(search.toLowerCase()) || a.display_name?.toLowerCase().includes(search.toLowerCase()))
  const total = accounts.length
  const connected = accounts.filter(a => a.status === 'Active' || a.status === 'Connected' || a.status_info?.status === 'Connected').length
  const seeds = accounts.filter(a => a.email?.toLowerCase().includes('gmail.com')).length

  return (
    <div className="fade-in">
      <PageHeader
        title="Email Accounts — Seed / Test Accounts"
        subtitle={`Seed & inbox placement test accounts fetched from connected MailWizz database (${total} accounts).`}
        actions={
          <div className="row" style={{ gap: 8 }}>
            <span
              className="badge"
              style={{
                background: 'var(--success-bg)',
                color: 'var(--success)',
                fontSize: 11,
              }}
            >
              ● MailWizz DB Connected
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
        <KpiCard title="Seed Accounts" value={total} accent="blue" icon="users" />
        <KpiCard title="Seed Gmail" value={seeds} sub={`${total > 0 ? ((seeds/total)*100).toFixed(0) : 0}%`} accent="green" icon="mail" />
        <KpiCard title="Connected" value={connected} sub={`${total > 0 ? ((connected/total)*100).toFixed(0) : 0}%`} accent="cyan" icon="check" />
        <KpiCard title="Untested / Inactive" value={total - connected} accent="orange" icon="pause" />
      </div>
      <div className="card" style={{ marginBottom: 14 }}>
        <div className="filters-bar">
          <input className="search-input" placeholder="Search seed or test email, display name…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>
      {loading ? <LoadingState /> : filtered.length === 0 ? <EmptyState title="No seed/test accounts" description="No seed accounts found in MailWizz database." /> : (
        <div className="card slide-up">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: 60 }}>ID</th>
                  <th>Email Account</th>
                  <th>Type</th>
                  <th>Domain</th>
                  <th>Display Name</th>
                  <th>IMAP Server</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(a => {
                  const isConn = a.status === 'Active' || a.status === 'Connected' || a.status_info?.status === 'Connected'
                  const serverId = a.server_id || a.id || '—'
                  return (
                    <tr key={a.id || a.email}>
                      <td className="muted" style={{ fontFamily: 'monospace', fontSize: 11 }}>#{serverId}</td>
                      <td style={{ fontWeight: 600 }}>
                        <span className={'status-dot ' + (isConn ? 'active' : 'inactive')} />
                        {a.email}
                      </td>
                      <td><span className="badge" style={{ textTransform: 'capitalize' }}>{a.account_type || 'Seed'}</span></td>
                      <td>{a.domain || a.email?.split('@')[1] || 'gmail.com'}</td>
                      <td>{a.display_name || '—'}</td>
                      <td className="muted" style={{ fontSize: 11.5 }}>{a.imap_host || 'imap.gmail.com'}:{a.imap_port || 993}</td>
                      <td>
                        <span className={'badge ' + (isConn ? 'success' : 'muted')}>
                          {isConn ? 'Connected' : 'Untested'}
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
        </div>
      )}
    </div>
  )
}
