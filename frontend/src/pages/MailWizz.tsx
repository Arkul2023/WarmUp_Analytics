import React, { useState, useEffect } from 'react'
import PageHeader from '../components/PageHeader'
import {
  getMailwizzConnections,
  saveMailwizzConnection,
  deleteMailwizzConnection,
  testMailwizzDb,
  MailwizzDbConfig,
} from '../api/mailwizz.api'

export interface ConnectionState extends MailwizzDbConfig {
  name: string
  sshHost: string
  sshPort: number | string
  sshUser: string
  sshPassword: string
  host: string
  port: number | string
  database: string
  user: string
  password: string
  status: 'connected' | 'disconnected' | 'error' | 'testing'
  lastError?: string
  showSshPassword?: boolean
  showDbPassword?: boolean
}

export default function MailWizz() {
  const [connections, setConnections] = useState<ConnectionState[]>([])
  const [loading, setLoading] = useState(true)
  const [alert, setAlert] = useState<{ type: 'success' | 'error' | 'info'; text: string; details?: string } | null>(null)

  // Load existing connections from backend
  const loadConnections = async () => {
    setLoading(true)
    try {
      const res = await getMailwizzConnections()
      if (res?.success && Array.isArray(res.data) && res.data.length > 0) {
        const mapped: ConnectionState[] = res.data.map((item: any, idx: number) => ({
          id: item.id || item._id,
          _id: item._id || item.id,
          name: item.name || `MailWizz Server #${idx + 1}`,
          sshHost: item.sshHost || item.ssh_host || '',
          sshPort: item.sshPort || item.ssh_port || 22,
          sshUser: item.sshUser || item.ssh_user || '',
          sshPassword: item.sshPassword || item.ssh_password || '',
          host: item.host || '127.0.0.1',
          port: item.port || 3307,
          database: item.database || 'mailwizz',
          user: item.user || 'root',
          password: item.password || '',
          status: item.status || 'disconnected',
          lastError: item.lastError,
          showSshPassword: false,
          showDbPassword: false,
        }))
        setConnections(mapped)
      } else {
        setConnections([getDefaultConnection1()])
      }
    } catch (err) {
      setConnections([getDefaultConnection1()])
    } finally {
      setLoading(false)
    }
  }

  const getDefaultConnection1 = (): ConnectionState => ({
    name: 'MailWizz Server #1 (Default)',
    sshHost: '15.235.163.118',
    sshPort: 22,
    sshUser: 'ubuntu',
    sshPassword: '',
    host: '127.0.0.1',
    port: 3307,
    database: 'mailwizz',
    user: 'mailwizzadmin',
    password: '',
    status: 'disconnected',
    showSshPassword: false,
    showDbPassword: false,
  })

  useEffect(() => {
    loadConnections()
  }, [])

  const handleAddConnection = () => {
    const newIdx = connections.length + 1
    const newConn: ConnectionState = {
      name: `MailWizz Server #${newIdx}`,
      sshHost: '',
      sshPort: 22,
      sshUser: '',
      sshPassword: '',
      host: '127.0.0.1',
      port: 3306,
      database: 'mailwizz',
      user: '',
      password: '',
      status: 'disconnected',
      showSshPassword: false,
      showDbPassword: false,
    }
    setConnections(prev => [...prev, newConn])
  }

  const handleFieldChange = (index: number, field: keyof ConnectionState, value: any) => {
    setConnections(prev => {
      const next = [...prev]
      next[index] = { ...next[index], [field]: value }
      return next
    })
  }

  const handleConnectCard = async (index: number) => {
    const conn = connections[index]
    
    // Update card status to testing
    handleFieldChange(index, 'status', 'testing')
    handleFieldChange(index, 'lastError', undefined)
    setAlert(null)

    try {
      const saveRes = await saveMailwizzConnection({
        id: conn.id,
        _id: conn._id,
        name: conn.name,
        sshHost: conn.sshHost,
        sshPort: conn.sshPort,
        sshUser: conn.sshUser,
        sshPassword: conn.sshPassword,
        host: conn.host,
        port: conn.port,
        database: conn.database,
        user: conn.user,
        password: conn.password,
      })

      if (saveRes?.success) {
        const updatedDoc = saveRes.data
        setConnections(prev => {
          const next = [...prev]
          next[index] = {
            ...next[index],
            id: updatedDoc?.id || updatedDoc?._id || next[index].id,
            _id: updatedDoc?._id || updatedDoc?.id || next[index]._id,
            status: 'connected',
            lastError: undefined,
          }
          return next
        })
        setAlert({
          type: 'success',
          text: `${conn.name} connected successfully! Credentials saved and verified.`,
        })
      } else {
        throw new Error(saveRes?.message || 'Failed to connect')
      }
    } catch (err: any) {
      const errMsg = err?.response?.data?.message || err?.message || 'Connection failed'
      setConnections(prev => {
        const next = [...prev]
        next[index] = {
          ...next[index],
          status: 'error',
          lastError: errMsg,
        }
        return next
      })
      setAlert({
        type: 'error',
        text: `Connection failed for ${conn.name}: ${errMsg}`,
      })
    }
  }

  const handleDeleteCard = async (index: number) => {
    const conn = connections[index]
    if (conn.id || conn._id) {
      try {
        await deleteMailwizzConnection(conn.id || conn._id || '')
      } catch (err) {}
    }
    setConnections(prev => prev.filter((_, idx) => idx !== index))
  }

  const totalConnections = connections.length
  const connectedCount = connections.filter(c => c.status === 'connected').length
  const disconnectedCount = connections.filter(c => c.status === 'disconnected').length
  const errorCount = connections.filter(c => c.status === 'error').length

  const getStatusBadge = (status: ConnectionState['status']) => {
    switch (status) {
      case 'connected':
        return (
          <span className="badge" style={{ background: 'rgba(34,197,94,0.15)', color: '#4ade80', fontSize: 11 }}>
            ● Connected
          </span>
        )
      case 'testing':
        return (
          <span className="badge" style={{ background: 'rgba(234,179,8,0.15)', color: '#facc15', fontSize: 11 }}>
            ⟳ Testing...
          </span>
        )
      case 'error':
        return (
          <span className="badge" style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171', fontSize: 11 }}>
            ⚠ Error
          </span>
        )
      case 'disconnected':
      default:
        return (
          <span className="badge" style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--muted)', fontSize: 11 }}>
            ○ Disconnected
          </span>
        )
    }
  }

  return (
    <div className="fade-in">
      <PageHeader
        title="MailWizz Integration"
        subtitle="Manage multiple MailWizz database connections and server infrastructure."
        actions={
          <button
            className="btn-primary"
            onClick={handleAddConnection}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', fontWeight: 600 }}
          >
            <span>+</span> Add Connection
          </button>
        }
      />

      {/* Global Alert Banner */}
      {alert && (
        <div
          className="card fade-in"
          style={{
            marginBottom: 16,
            padding: '12px 16px',
            border: `1px solid ${alert.type === 'success' ? 'rgba(34,197,94,0.3)' : 'rgba(240,71,71,0.3)'}`,
            background: alert.type === 'success' ? 'rgba(34,197,94,0.08)' : 'rgba(240,71,71,0.08)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 13, color: alert.type === 'success' ? 'var(--success)' : 'var(--danger)' }}>
                {alert.type === 'success' ? '✓ ' : '⚠ '} {alert.text}
              </div>
              {alert.details && (
                <div className="muted" style={{ fontSize: 12, marginTop: 4, whiteSpace: 'pre-wrap' }}>
                  {alert.details}
                </div>
              )}
            </div>
            <button
              className="btn-ghost btn-sm"
              onClick={() => setAlert(null)}
              style={{ padding: '2px 8px', fontSize: 11 }}
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Overview Stats Bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 20 }}>
        <div className="card" style={{ padding: 14 }}>
          <div className="muted" style={{ fontSize: 11, textTransform: 'uppercase', fontWeight: 700, letterSpacing: '.03em' }}>
            Total Connections
          </div>
          <div style={{ fontWeight: 800, fontSize: 24, marginTop: 4 }}>{totalConnections}</div>
        </div>
        <div className="card" style={{ padding: 14 }}>
          <div className="muted" style={{ fontSize: 11, textTransform: 'uppercase', fontWeight: 700, letterSpacing: '.03em' }}>
            Active / Connected
          </div>
          <div style={{ fontWeight: 800, fontSize: 24, marginTop: 4, color: 'var(--success)' }}>{connectedCount}</div>
        </div>
        <div className="card" style={{ padding: 14 }}>
          <div className="muted" style={{ fontSize: 11, textTransform: 'uppercase', fontWeight: 700, letterSpacing: '.03em' }}>
            Disconnected
          </div>
          <div style={{ fontWeight: 800, fontSize: 24, marginTop: 4, color: 'var(--muted)' }}>{disconnectedCount}</div>
        </div>
        <div className="card" style={{ padding: 14 }}>
          <div className="muted" style={{ fontSize: 11, textTransform: 'uppercase', fontWeight: 700, letterSpacing: '.03em' }}>
            Connection Errors
          </div>
          <div style={{ fontWeight: 800, fontSize: 24, marginTop: 4, color: errorCount > 0 ? 'var(--danger)' : 'var(--text)' }}>
            {errorCount}
          </div>
        </div>
      </div>

      {/* Connection Cards Stack */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {connections.map((conn, idx) => (
          <div className="card fade-in" key={conn.id || conn._id || `conn_${idx}`}>
            {/* Card Header */}
            <div
              className="card-head"
              style={{
                marginBottom: 16,
                paddingBottom: 12,
                borderBottom: '1px solid var(--border-soft)',
                display: 'flex',
                alignItems: 'center',
                justify: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <input
                  type="text"
                  value={conn.name}
                  onChange={e => handleFieldChange(idx, 'name', e.target.value)}
                  style={{
                    fontSize: 15,
                    fontWeight: 700,
                    background: 'transparent',
                    border: '1px solid transparent',
                    color: 'var(--text)',
                    padding: '2px 6px',
                    borderRadius: 4,
                  }}
                  onFocus={e => (e.target.style.border = '1px solid var(--border)')}
                  onBlur={e => (e.target.style.border = '1px solid transparent')}
                />
                {getStatusBadge(conn.status)}
              </div>

              {idx > 0 && (
                <button
                  type="button"
                  className="btn-ghost btn-sm"
                  onClick={() => handleDeleteCard(idx)}
                  style={{ color: 'var(--danger)', padding: '4px 10px', fontSize: 12 }}
                >
                  🗑 Remove
                </button>
              )}
            </div>

            {/* Error detail if present */}
            {conn.lastError && (
              <div
                style={{
                  background: 'rgba(239,68,68,0.1)',
                  border: '1px solid rgba(239,68,68,0.25)',
                  borderRadius: 6,
                  padding: '8px 12px',
                  marginBottom: 16,
                  fontSize: 12,
                  color: '#f87171',
                }}
              >
                <strong>Error:</strong> {conn.lastError}
              </div>
            )}

            {/* Card Body - Credentials Form */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
              {/* Section 1: Server SSH Credentials */}
              <div
                style={{
                  background: 'var(--surface-2)',
                  padding: 16,
                  borderRadius: 8,
                  border: '1px solid var(--border-soft)',
                }}
              >
                <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 12, color: 'var(--cyan)' }}>
                  🖥 Server / SSH Settings
                </div>

                <div className="field" style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: 11, fontWeight: 600 }}>Server IP / Host</label>
                  <input
                    type="text"
                    value={conn.sshHost}
                    onChange={e => handleFieldChange(idx, 'sshHost', e.target.value)}
                    placeholder="e.g. 15.235.163.118"
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                  <div className="field">
                    <label style={{ fontSize: 11, fontWeight: 600 }}>Server Username</label>
                    <input
                      type="text"
                      value={conn.sshUser}
                      onChange={e => handleFieldChange(idx, 'sshUser', e.target.value)}
                      placeholder="e.g. ubuntu"
                    />
                  </div>

                  <div className="field">
                    <label style={{ fontSize: 11, fontWeight: 600 }}>SSH Port</label>
                    <input
                      type="number"
                      value={conn.sshPort}
                      onChange={e => handleFieldChange(idx, 'sshPort', e.target.value)}
                      placeholder="22"
                    />
                  </div>
                </div>

                <div className="field">
                  <label style={{ fontSize: 11, fontWeight: 600 }}>Server Password</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={conn.showSshPassword ? 'text' : 'password'}
                      value={conn.sshPassword}
                      onChange={e => handleFieldChange(idx, 'sshPassword', e.target.value)}
                      placeholder="Enter server SSH password"
                      style={{ width: '100%', paddingRight: 60 }}
                    />
                    <button
                      type="button"
                      className="btn-ghost btn-sm"
                      onClick={() => handleFieldChange(idx, 'showSshPassword', !conn.showSshPassword)}
                      style={{
                        position: 'absolute',
                        right: 6,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        padding: '3px 8px',
                        fontSize: 11,
                        border: 'none',
                      }}
                    >
                      {conn.showSshPassword ? 'Hide' : 'Show'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Section 2: Database Credentials */}
              <div
                style={{
                  background: 'var(--surface-2)',
                  padding: 16,
                  borderRadius: 8,
                  border: '1px solid var(--border-soft)',
                }}
              >
                <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 12, color: 'var(--accent)' }}>
                  🗄 Database Credentials
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12, marginBottom: 12 }}>
                  <div className="field">
                    <label style={{ fontSize: 11, fontWeight: 600 }}>Database Host</label>
                    <input
                      type="text"
                      value={conn.host}
                      onChange={e => handleFieldChange(idx, 'host', e.target.value)}
                      placeholder="127.0.0.1"
                    />
                  </div>

                  <div className="field">
                    <label style={{ fontSize: 11, fontWeight: 600 }}>DB Port</label>
                    <input
                      type="number"
                      value={conn.port}
                      onChange={e => handleFieldChange(idx, 'port', Number(e.target.value))}
                      placeholder="3307"
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                  <div className="field">
                    <label style={{ fontSize: 11, fontWeight: 600 }}>Database Name</label>
                    <input
                      type="text"
                      value={conn.database}
                      onChange={e => handleFieldChange(idx, 'database', e.target.value)}
                      placeholder="mailwizz"
                    />
                  </div>

                  <div className="field">
                    <label style={{ fontSize: 11, fontWeight: 600 }}>Database Username</label>
                    <input
                      type="text"
                      value={conn.user}
                      onChange={e => handleFieldChange(idx, 'user', e.target.value)}
                      placeholder="mailwizzadmin"
                    />
                  </div>
                </div>

                <div className="field">
                  <label style={{ fontSize: 11, fontWeight: 600 }}>Database Password</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={conn.showDbPassword ? 'text' : 'password'}
                      value={conn.password}
                      onChange={e => handleFieldChange(idx, 'password', e.target.value)}
                      placeholder="Enter database password"
                      style={{ width: '100%', paddingRight: 60 }}
                    />
                    <button
                      type="button"
                      className="btn-ghost btn-sm"
                      onClick={() => handleFieldChange(idx, 'showDbPassword', !conn.showDbPassword)}
                      style={{
                        position: 'absolute',
                        right: 6,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        padding: '3px 8px',
                        fontSize: 11,
                        border: 'none',
                      }}
                    >
                      {conn.showDbPassword ? 'Hide' : 'Show'}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Card Action Bar */}
            <div
              style={{
                marginTop: 16,
                paddingTop: 12,
                borderTop: '1px solid var(--border-soft)',
                display: 'flex',
                justify: 'flex-end',
                gap: 12,
              }}
            >
              <button
                type="button"
                className="btn-primary"
                onClick={() => handleConnectCard(idx)}
                disabled={conn.status === 'testing'}
                style={{ padding: '8px 20px', fontWeight: 600 }}
              >
                {conn.status === 'testing' ? '⟳ Testing Connection...' : '⚡ Connect & Verify'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
