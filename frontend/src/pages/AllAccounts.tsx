import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

import PageHeader from '../components/PageHeader'
import KpiCard from '../components/KpiCard'
import LoadingState from '../components/LoadingState'
import EmptyState from '../components/EmptyState'
import {
  getWorkerAccounts,
  addWorkerAccount,
  deleteWorkerAccounts,
  testWorkerAccount,
  testAllWorkerAccounts
} from '../api/worker.api'
import { getMailwizzDeliveryServers, MailwizzDbConfig } from '../api/mailwizz.api'

const STORAGE_KEY = 'mailwizz_db_config'

export default function AllAccounts() {
  const [accounts, setAccounts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [testing, setTesting] = useState('')
  const [selectedEmails, setSelectedEmails] = useState<string[]>([])

  // Modal State
  const [modalOpen, setModalOpen] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [formEmail, setFormEmail] = useState('')
  const [formPassword, setFormPassword] = useState('')
  const [formType, setFormType] = useState('workspace')
  const [formImapHost, setFormImapHost] = useState('imap.gmail.com')
  const [formImapPort, setFormImapPort] = useState(993)
  const [formSmtpHost, setFormSmtpHost] = useState('smtp.gmail.com')
  const [formSmtpPort, setFormSmtpPort] = useState(587)
  const [formDisplayName, setFormDisplayName] = useState('')
  const [formSignature, setFormSignature] = useState('Best Regards,\n\nYour Name')
  const [signatureTouched, setSignatureTouched] = useState(false)
  const [modalError, setModalError] = useState('')
  const [savingAccount, setSavingAccount] = useState(false)


  const load = async () => {
    setLoading(true)
    let combined: any[] = []
    const seen = new Set<string>()

    // 1. Load worker accounts (Workspace + Seed)
    try {
      const workerData = await getWorkerAccounts()
      if (Array.isArray(workerData)) {
        workerData.forEach(a => {
          const em = (a.email || '').toLowerCase()
          if (em && !seen.has(em)) {
            seen.add(em)
            combined.push(a)
          }
        })
      }
    } catch {}

    // 2. Load MailWizz delivery servers (SMTP)
    try {
      let savedConfig: Partial<MailwizzDbConfig> | undefined = undefined
      try {
        const saved = localStorage.getItem(STORAGE_KEY)
        if (saved) savedConfig = JSON.parse(saved)
      } catch {}
      const mwRes = await getMailwizzDeliveryServers(savedConfig)
      if (mwRes && mwRes.success && Array.isArray(mwRes.data)) {
        mwRes.data.forEach((s: any) => {
          const em = (s.email || `server_${s.server_id}`).toLowerCase()
          if (em && !seen.has(em)) {
            seen.add(em)
            combined.push(s)
          }
        })
      }
    } catch {}

    setAccounts(combined)
    setError('')
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])


  const handleTestAll = async () => {
    setTesting('all')
    try { await testAllWorkerAccounts(); load() } catch {}
    setTesting('')
  }

  const handleTest = async (email: string) => {
    setTesting(email)
    try { await testWorkerAccount(email); load() } catch {}
    setTesting('')
  }

  const openAddModal = () => {
    setEditMode(false)
    setFormEmail('')
    setFormPassword('')
    setFormType('workspace')
    setFormImapHost('imap.gmail.com')
    setFormImapPort(993)
    setFormSmtpHost('smtp.gmail.com')
    setFormSmtpPort(587)
    setFormDisplayName('')
    setSignatureTouched(false)
    setFormSignature('Best Regards,\n\nYour Name')
    setModalError('')
    setModalOpen(true)
  }

  const openEditModal = (a: any) => {
    setEditMode(true)
    setFormEmail(a.email)
    setFormPassword('')
    setFormType(a.account_type || 'workspace')
    setFormImapHost(a.imap_host || 'imap.gmail.com')
    setFormImapPort(a.imap_port || 993)
    setFormSmtpHost(a.smtp_host || 'smtp.gmail.com')
    setFormSmtpPort(a.smtp_port || 587)
    setFormDisplayName(a.display_name || '')
    setSignatureTouched(true)
    setFormSignature(a.signature || `Best Regards,\n\n${a.display_name || 'Your Name'}`)
    setModalError('')
    setModalOpen(true)
  }

  const handleSaveAccount = async () => {
    setModalError('')
    const trimmedEmail = formEmail.trim()
    if (!trimmedEmail) {
      setModalError('Email address is required.')
      return
    }

    setSavingAccount(true)
    try {
      await addWorkerAccount({
        email: trimmedEmail,
        password: formPassword.trim(),
        account_type: formType,
        imap_host: formImapHost,
        imap_port: formImapPort,
        smtp_host: formSmtpHost,
        smtp_port: formSmtpPort,
        display_name: formDisplayName.trim(),
        signature: formSignature
      })
      setModalOpen(false)
      load()
    } catch (err: any) {
      console.error('Failed to save mailbox:', err)
      setModalError(err?.response?.data?.message || err?.message || 'Failed to save account')
    } finally {
      setSavingAccount(false)
    }
  }


  const handleDeleteSingle = async (email: string) => {
    if (!window.confirm(`Remove mailbox ${email}?`)) return
    try {
      await deleteWorkerAccounts([email])
      setSelectedEmails(prev => prev.filter(e => e !== email))
      load()
    } catch {
      setError('Failed to delete account')
    }
  }

  const handleBulkDelete = async () => {
    if (selectedEmails.length === 0) return
    if (!window.confirm(`Delete ${selectedEmails.length} selected mailbox(es)?`)) return
    try {
      await deleteWorkerAccounts(selectedEmails)
      setSelectedEmails([])
      load()
    } catch {
      setError('Failed to delete accounts')
    }
  }

  const toggleSelect = (email: string) => {
    setSelectedEmails(prev => prev.includes(email) ? prev.filter(e => e !== email) : [...prev, email])
  }

  const toggleSelectAll = () => {
    if (selectedEmails.length === filtered.length) {
      setSelectedEmails([])
    } else {
      setSelectedEmails(filtered.map(a => a.email))
    }
  }

  const filtered = accounts.filter(a => {
    if (search) {
      const q = search.toLowerCase()
      if (!a.email?.toLowerCase().includes(q) && !a.display_name?.toLowerCase().includes(q) && !a.account_type?.toLowerCase().includes(q)) {
        return false
      }
    }
    if (typeFilter !== 'all') {
      if (typeFilter === 'workspace' && a.account_type !== 'workspace' && a.email?.includes('gmail.com')) return false
      if (typeFilter === 'seed' && a.account_type !== 'seed' && !a.email?.includes('gmail.com')) return false
      if (typeFilter === 'smtp' && a.account_type !== 'smtp') return false
    }
    if (statusFilter !== 'all') {
      const isConn = a.status_info?.status === 'Connected'
      if (statusFilter === 'connected' && !isConn) return false
      if (statusFilter === 'untested' && isConn) return false
    }
    return true
  })

  const total = accounts.length
  const workspace = accounts.filter(a => a.account_type === 'workspace' || (!a.account_type && !a.email?.toLowerCase().includes('gmail.com'))).length
  const seed = accounts.filter(a => a.account_type === 'seed' || a.email?.toLowerCase().includes('gmail.com')).length
  const smtp = accounts.filter(a => a.account_type === 'smtp').length
  const connected = accounts.filter(a => a.status_info?.status === 'Connected').length

  return (
    <div className="fade-in">
      <PageHeader
        title="Email Accounts — All Accounts"
        subtitle="Manage and monitor all sending and receiving mailboxes across providers."
        actions={<>
          <button className="btn-primary btn-sm" onClick={openAddModal}>+ Add Mailbox</button>
          <button className="btn-ghost btn-sm" onClick={handleTestAll} disabled={!!testing}>
            {testing === 'all' ? 'Testing All...' : '⟳ Test All Connections'}
          </button>
        </>}
      />

      {error && <div className="card" style={{ background: 'rgba(240,71,71,0.08)', borderColor: 'var(--danger)', marginBottom: 14, padding: '10px 14px', fontSize: 12.5, color: 'var(--danger)' }}>{error}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 14, marginBottom: 14 }}>
        <KpiCard title="Total Accounts" value={total} sub={`${connected} connected`} accent="blue" icon="mail" />
        <KpiCard title="Workspace" value={workspace} sub={`${total > 0 ? ((workspace/total)*100).toFixed(0) : 0}%`} accent="green" icon="check" />
        <KpiCard title="Seed / Gmail" value={seed} sub={`${total > 0 ? ((seed/total)*100).toFixed(0) : 0}%`} accent="orange" icon="users" />
        <KpiCard title="SMTP" value={smtp} sub={`${total > 0 ? ((smtp/total)*100).toFixed(0) : 0}%`} accent="purple" icon="server" />
        <KpiCard title="Connected Ratio" value={`${total > 0 ? ((connected/total)*100).toFixed(0) : 0}%`} sub={`${connected} / ${total}`} accent="cyan" icon="shield" />
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <div className="filters-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="row" style={{ gap: 8 }}>
            <input
              className="search-input"
              placeholder="Search email, display name, domain…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ width: 260 }}
            />
            <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
              <option value="all">All Types</option>
              <option value="workspace">Workspace</option>
              <option value="seed">Seed / Gmail</option>
              <option value="smtp">SMTP</option>
            </select>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="all">All Statuses</option>
              <option value="connected">Connected</option>
              <option value="untested">Untested</option>
            </select>
          </div>
          {selectedEmails.length > 0 && (
            <button className="btn-danger btn-sm" onClick={handleBulkDelete}>
              Delete Selected ({selectedEmails.length})
            </button>
          )}
        </div>
      </div>

      {loading ? <LoadingState /> : filtered.length === 0 ? (
        <EmptyState title="No accounts" description="No email accounts match the current filter." />
      ) : (
        <div className="card slide-up">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: 30 }}>
                    <input
                      type="checkbox"
                      checked={selectedEmails.length === filtered.length && filtered.length > 0}
                      onChange={toggleSelectAll}
                    />
                  </th>
                  <th>Email Account</th>
                  <th>Type</th>
                  <th>Domain</th>
                  <th>IMAP Server</th>
                  <th>SMTP Server</th>
                  <th>Display Name</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(a => {
                  const domain = a.email?.split('@')[1] || ''
                  const st = a.status_info || {}
                  const isConn = st.status === 'Connected'
                  const isSel = selectedEmails.includes(a.email)
                  return (
                    <tr key={a.email} style={{ background: isSel ? 'rgba(59,130,246,0.06)' : undefined }}>
                      <td>
                        <input
                          type="checkbox"
                          checked={isSel}
                          onChange={() => toggleSelect(a.email)}
                        />
                      </td>
                      <td style={{ fontWeight: 600 }}>
                        <span className={'status-dot ' + (isConn ? 'active' : 'inactive')} />
                        {a.email}
                      </td>
                      <td>
                        <span className="badge" style={{ textTransform: 'capitalize' }}>
                          {a.account_type || (a.email?.includes('gmail.com') ? 'Seed' : 'Workspace')}
                        </span>
                      </td>
                      <td className="muted">{domain}</td>
                      <td className="muted" style={{ fontSize: 11.5 }}>{a.imap_host}:{a.imap_port || 993}</td>
                      <td className="muted" style={{ fontSize: 11.5 }}>{a.smtp_host}:{a.smtp_port || 587}</td>
                      <td>{a.display_name || '—'}</td>
                      <td>
                        <span className={'badge ' + (isConn ? 'success' : 'muted')}>
                          {isConn ? 'Connected' : 'Untested'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div className="row" style={{ justifyContent: 'flex-end', gap: 6 }}>
                          <button
                            className="btn-ghost btn-sm"
                            onClick={() => handleTest(a.email)}
                            disabled={testing === a.email}
                            style={{ padding: '3px 8px', fontSize: 11 }}
                          >
                            {testing === a.email ? 'Testing…' : 'Test'}
                          </button>
                          <button
                            className="btn-ghost btn-sm"
                            onClick={() => openEditModal(a)}
                            style={{ padding: '3px 8px', fontSize: 11 }}
                          >
                            Edit
                          </button>
                          <button
                            className="btn-danger btn-sm"
                            onClick={() => handleDeleteSingle(a.email)}
                            style={{ padding: '3px 8px', fontSize: 11 }}
                          >
                            ✕
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add / Edit Mailbox Modal */}
      {modalOpen &&
        createPortal(
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              width: '100vw',
              height: '100vh',
              background: 'rgba(0,0,0,0.7)',
              backdropFilter: 'blur(4px)',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'flex-start',
              paddingTop: '65px',
              zIndex: 99999,
              overflowY: 'auto',
            }}
            onClick={(e) => {
              if (e.target === e.currentTarget) setModalOpen(false)
            }}
          >
            <div
              className="card slide-up"
              style={{
                width: 580,
                maxWidth: '92%',
                padding: '24px',
                boxSizing: 'border-box',
                boxShadow: '0 20px 50px rgba(0,0,0,0.6)',
                border: '1px solid var(--card-border)',
                background: 'var(--card)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div
                className="card-title"
                style={{
                  fontSize: 15,
                  fontWeight: 800,
                  marginBottom: 16,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span>{editMode ? `Edit Account (${formEmail})` : 'Add New Mailbox Account'}</span>
                <button
                  className="btn-ghost btn-sm"
                  onClick={() => setModalOpen(false)}
                  style={{ padding: '2px 8px', fontSize: 13, border: 'none', cursor: 'pointer' }}
                >
                  ✕
                </button>
              </div>

              {modalError && (
                <div
                  style={{
                    background: 'rgba(240,71,71,0.12)',
                    border: '1px solid var(--danger)',
                    color: 'var(--danger)',
                    padding: '8px 12px',
                    borderRadius: 6,
                    fontSize: 12,
                    marginBottom: 14,
                  }}
                >
                  {modalError}
                </div>
              )}

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                  gap: '14px 16px',
                  width: '100%',
                }}
              >
                <div className="field" style={{ minWidth: 0 }}>
                  <label>Email Address</label>
                  <input
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    placeholder="user@domain.com"
                    disabled={editMode}
                    style={{ width: '100%', boxSizing: 'border-box' }}
                  />
                </div>

                <div className="field" style={{ minWidth: 0 }}>
                  <label>App Password / Token</label>
                  <input
                    type="password"
                    value={formPassword}
                    onChange={(e) => setFormPassword(e.target.value)}
                    placeholder={editMode ? 'Leave blank to keep existing' : 'App password'}
                    style={{ width: '100%', boxSizing: 'border-box' }}
                  />
                </div>

                <div className="field" style={{ minWidth: 0 }}>
                  <label>Account Type</label>
                  <select
                    value={formType}
                    onChange={(e) => setFormType(e.target.value)}
                    style={{ width: '100%', boxSizing: 'border-box' }}
                  >
                    <option value="workspace">Workspace</option>
                    <option value="seed">Seed / Gmail</option>
                    <option value="smtp">SMTP</option>
                    <option value="employee">Employee</option>
                  </select>
                </div>

                <div className="field" style={{ minWidth: 0 }}>
                  <label>Display Name</label>
                  <input
                    value={formDisplayName}
                    onChange={(e) => {
                      const val = e.target.value
                      setFormDisplayName(val)
                      if (!signatureTouched) {
                        setFormSignature(`Best Regards,\n\n${val.trim() || 'Your Name'}`)
                      }
                    }}
                    placeholder="e.g. Albert William"
                    style={{ width: '100%', boxSizing: 'border-box' }}
                  />
                </div>

                <div className="field" style={{ minWidth: 0 }}>
                  <label>IMAP Host & Port</label>
                  <div style={{ display: 'flex', gap: 8, width: '100%', alignItems: 'center' }}>
                    <input
                      value={formImapHost}
                      onChange={(e) => setFormImapHost(e.target.value)}
                      style={{ flex: 1, minWidth: 0, boxSizing: 'border-box' }}
                      placeholder="imap.gmail.com"
                    />
                    <input
                      type="number"
                      value={formImapPort}
                      onChange={(e) => setFormImapPort(parseInt(e.target.value) || 993)}
                      style={{ width: 68, flexShrink: 0, textAlign: 'center', boxSizing: 'border-box' }}
                    />
                  </div>
                </div>

                <div className="field" style={{ minWidth: 0 }}>
                  <label>SMTP Host & Port</label>
                  <div style={{ display: 'flex', gap: 8, width: '100%', alignItems: 'center' }}>
                    <input
                      value={formSmtpHost}
                      onChange={(e) => setFormSmtpHost(e.target.value)}
                      style={{ flex: 1, minWidth: 0, boxSizing: 'border-box' }}
                      placeholder="smtp.gmail.com"
                    />
                    <input
                      type="number"
                      value={formSmtpPort}
                      onChange={(e) => setFormSmtpPort(parseInt(e.target.value) || 587)}
                      style={{ width: 68, flexShrink: 0, textAlign: 'center', boxSizing: 'border-box' }}
                    />
                  </div>
                </div>
              </div>

              <div className="field" style={{ marginTop: 14, width: '100%', minWidth: 0 }}>
                <label>Email Signature (Optional)</label>
                <textarea
                  value={formSignature}
                  onChange={(e) => {
                    setFormSignature(e.target.value)
                    setSignatureTouched(true)
                  }}
                  rows={3}
                  placeholder="Best Regards,&#10;&#10;Your Name"
                  style={{ width: '100%', boxSizing: 'border-box', resize: 'vertical' }}
                />
              </div>

              <div className="row" style={{ justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
                <button
                  className="btn-ghost btn-sm"
                  onClick={() => setModalOpen(false)}
                  disabled={savingAccount}
                  style={{ padding: '7px 14px' }}
                >
                  Cancel
                </button>
                <button
                  className="btn-primary btn-sm"
                  onClick={handleSaveAccount}
                  disabled={savingAccount}
                  style={{ padding: '7px 16px' }}
                >
                  {savingAccount ? 'Saving…' : 'Save Account'}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}



    </div>
  )
}
