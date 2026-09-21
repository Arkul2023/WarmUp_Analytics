import React, { useEffect, useState } from 'react'
import PageHeader from '../components/PageHeader'
import KpiCard from '../components/KpiCard'
import LoadingState from '../components/LoadingState'
import EmptyState from '../components/EmptyState'
import { getMailwizzWorkspaceAccounts, MailwizzDbConfig } from '../api/mailwizz.api'
import { testWorkerAccount, testAllWorkerAccounts } from '../api/worker.api'

const STORAGE_KEY = 'mailwizz_db_config'

export default function WorkspaceAccounts() {
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
      const res = await getMailwizzWorkspaceAccounts(savedConfig)
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
      console.error('Failed to load workspace accounts from MailWizz DB:', e)
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

  const filtered = accounts.filter(a => !search || a.email?.toLowerCase().includes(search.toLowerCase()) || a.domain?.toLowerCase().includes(search.toLowerCase()) || a.display_name?.toLowerCase().includes(search.toLowerCase()))
  const total = accounts.length
  const connected = accounts.filter(a => a.status === 'Active' || a.status === 'Connected' || a.status_info?.status === 'Connected').length

  return (
    <div className="fade-in">
      <PageHeader
        title="Email Accounts — Workspace Accounts"
        subtitle={`Google Workspace sending accounts fetched from connected MailWizz database (${total} accounts).`}
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
        <KpiCard title="Workspace Accounts" value={total} accent="blue" icon="mail" />
        <KpiCard title="Connected" value={connected} sub={`${total > 0 ? ((connected/total)*100).toFixed(0) : 0}%`} accent="green" icon="check" />
        <KpiCard title="Untested / Inactive" value={total - connected} accent="orange" icon="pause" />
        <KpiCard title="Domains" value={new Set(accounts.map(a => a.domain || a.email?.split('@')[1])).size} accent="purple" icon="server" />
      </div>
      <div className="card" style={{ marginBottom: 14 }}>
        <div className="filters-bar">
          <input className="search-input" placeholder="Search workspace email, domain, display name…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>
      {loading ? <LoadingState /> : filtered.length === 0 ? <EmptyState title="No workspace accounts" description="No workspace accounts found in MailWizz database." /> : (
        <div className="card slide-up">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: 60 }}>ID</th>
                  <th>Email Account</th>
                  <th>Domain</th>
                  <th>Display Name</th>
                  <th>IMAP Server</th>
                  <th>SMTP Server</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(a => {
                  const isConn = a.status === 'Active' || a.status === 'Connected' || a.status_info?.status === 'Connected'
                  const serverId = a.server_id || a.id || '—'
                  const domain = a.domain || a.email?.split('@')[1] || '—'
                  return (
                    <tr key={a.id || a.email}>
                      <td className="muted" style={{ fontFamily: 'monospace', fontSize: 11 }}>#{serverId}</td>
                      <td style={{ fontWeight: 600 }}>
                        <span className={'status-dot ' + (isConn ? 'active' : 'inactive')} />
                        {a.email}
                      </td>
                      <td>{domain}</td>
                      <td>{a.display_name || '—'}</td>
                      <td className="muted" style={{ fontSize: 11.5 }}>{a.imap_host || 'imap.gmail.com'}:{a.imap_port || 993}</td>
                      <td className="muted" style={{ fontSize: 11.5 }}>{a.smtp_host || 'smtp.gmail.com'}:{a.smtp_port || 587}</td>
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
