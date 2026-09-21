import React, { useEffect, useMemo, useState } from 'react'
import { listMailboxes } from '../api/mailboxes.api'
import LoadingState from './LoadingState'
import EmptyState from './EmptyState'
import AccountStatusBadge from './AccountStatusBadge'
import { emailAccounts as mockAccounts, Account } from '../mock/dashboard.mock'

function DotsIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="12" cy="19" r="1.6" /></svg>
}
function EyeIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" /><circle cx="12" cy="12" r="3" /></svg>
}
function EditIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" /></svg>
}

export default function AccountTable({ filter, search, onSelect, selectedId }: {
  filter?: { type?: 'Workspace' | 'SMTP' | 'Seed / Test' },
  search?: string,
  onSelect?: (a: Account) => void,
  selectedId?: string,
}) {
  const [loading, setLoading] = useState(true)
  const [apiItems, setApiItems] = useState<any[] | null>(null)

  useEffect(() => {
    setLoading(true)
    const params: any = { limit: 200 }
    if (filter?.type) params.type = filter.type
    listMailboxes(params).then(r => setApiItems(Array.isArray(r?.items) && r.items.length ? r.items : null)).catch(() => setApiItems(null)).finally(() => setLoading(false))
  }, [filter?.type])

  const items: Account[] = useMemo(() => {
    if (apiItems) return apiItems as Account[]
    let base = mockAccounts
    if (filter?.type) base = base.filter(a => a.type === filter.type)
    if (search) {
      const q = search.toLowerCase()
      base = base.filter(a => a.email.toLowerCase().includes(q) || a.domain.toLowerCase().includes(q))
    }
    return base
  }, [apiItems, filter?.type, search])

  if (loading) return <LoadingState />
  if (!items.length) return <EmptyState title="No accounts" description="No mailboxes match the current filters." />

  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>Status</th><th>Email Account</th><th>Type</th><th>Domain</th><th>Provider / IP</th>
            <th>Customer</th><th>Warmup Stage</th><th>Sent</th><th>Delivered</th><th>Inbox %</th><th>Spam %</th>
            <th>Replies</th><th>Last Activity</th><th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {items.map((a: any) => (
            <tr key={a.id || a._id} onClick={() => onSelect?.(a)} style={{ background: selectedId === (a.id || a._id) ? 'rgba(59,130,246,0.08)' : undefined }}>
              <td><AccountStatusBadge status={a.status} /></td>
              <td className="email-link">{a.email}</td>
              <td>{a.type}</td>
              <td>{a.domain}</td>
              <td className="muted">{a.provider || a.ipAddress || 'N/A'}</td>
              <td>{a.customer || 'N/A'}</td>
              <td><span className="stage-pill">{a.warmupStage || 'N/A'}</span></td>
              <td>{a.sent ?? 'N/A'}</td>
              <td>{a.delivered ?? 'N/A'}</td>
              <td>{a.inboxPct != null ? `${a.inboxPct}%` : 'N/A'}</td>
              <td>{a.spamPct != null ? `${a.spamPct}%` : 'N/A'}</td>
              <td>{a.replies ?? 'N/A'}</td>
              <td className="muted">{a.lastActivity || 'N/A'}</td>
              <td>
                <div className="row-actions" onClick={(e) => e.stopPropagation()}>
                  <span className="icon-action" title="View"><EyeIcon /></span>
                  <span className="icon-action" title="Edit"><EditIcon /></span>
                  <span className="icon-action" title="More"><DotsIcon /></span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
