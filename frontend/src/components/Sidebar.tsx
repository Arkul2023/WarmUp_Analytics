import React, { useState } from 'react'

function Icon({ name }: { name: string }) {
  const common = { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  switch (name) {
    case 'dashboard':
      return <svg {...common}><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></svg>
    case 'mail':
      return <svg {...common}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></svg>
    case 'mailwizz':
      return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M8 12.5l2.5 2.5L16 9" /></svg>
    case 'worker':
      return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
    case 'replies':
      return <svg {...common}><path d="M9 17H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5" /><path d="M2 5l10 7 10-7" /><path d="M15 17l3 3 5-5" /></svg>
    case 'settings':
      return <svg {...common}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06A2 2 0 1 1 7.04 4.3l.06.06A1.65 1.65 0 0 0 8.92 4.7 1.65 1.65 0 0 0 9.93 3.2V3a2 2 0 1 1 4 0v.09c0 .68.39 1.3 1 1.51.63.26 1.37.13 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06c-.46.46-.59 1.19-.33 1.82.21.61.83 1 1.51 1H21a2 2 0 1 1 0 4h-.09c-.68 0-1.3.39-1.51 1z" /></svg>
    default:
      return null
  }
}

const EMAIL_SUBLINKS = [
  { path: '/mailboxes', label: 'All Accounts' },
  { path: '/mailboxes/smtp', label: 'SMTP Accounts' },
  { path: '/mailboxes/workspace', label: 'Workspace Accounts' },
  { path: '/mailboxes/seed-test', label: 'Seed / Test Accounts' },
]

export default function Sidebar({ onNavigate, active }: { onNavigate: (p: string) => void, active: string }) {
  const [emailOpen, setEmailOpen] = useState(active.startsWith('/mailboxes'))
  const [workerOpen, setWorkerOpen] = useState(active === '/worker' || active === '/warmup-replies' || active.startsWith('/worker'))
  const isActive = (path: string) => active === path || (path !== '/' && active.startsWith(path))

  return (
    <>
      <div className="brand">
        <div className="brand-mark">W</div>
        <div>
          <div className="brand-title">Warmup Control Center</div>
          <div className="brand-sub">CONTROL CENTER</div>
        </div>
      </div>

      <div className="nav-section">
        <div className={'nav-item ' + (isActive('/dashboard') ? 'active' : '')} onClick={() => onNavigate('/dashboard')}>
          <span className="nav-icon"><Icon name="dashboard" /></span>
          <span>Dashboard</span>
        </div>

        <div>
          <div className={'nav-item ' + (isActive('/mailboxes') ? 'active' : '')} onClick={() => setEmailOpen(o => !o)}>
            <span className="nav-icon"><Icon name="mail" /></span>
            <span>Email Accounts</span>
            <span className={'nav-caret ' + (emailOpen ? 'open' : '')}>&#9656;</span>
          </div>
          <div className={'submenu ' + (emailOpen ? 'open' : '')}>
            {EMAIL_SUBLINKS.map(l => (
              <div key={l.path} className={'nav-item ' + (active === l.path ? 'active' : '')} onClick={() => onNavigate(l.path)}>
                <span>{l.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className={'nav-item ' + (isActive('/mailwizz') ? 'active' : '')} onClick={() => onNavigate('/mailwizz')}>
          <span className="nav-icon"><Icon name="mailwizz" /></span>
          <span>MailWizz</span>
        </div>

        <div>
          <div className={'nav-item ' + (isActive('/worker') || isActive('/warmup-replies') ? 'active' : '')} onClick={() => setWorkerOpen(o => !o)}>
            <span className="nav-icon"><Icon name="worker" /></span>
            <span>Python Worker</span>
            <span className={'nav-caret ' + (workerOpen ? 'open' : '')}>&#9656;</span>
          </div>
          <div className={'submenu ' + (workerOpen ? 'open' : '')}>
            <div className={'nav-item ' + (active === '/worker' ? 'active' : '')} onClick={() => onNavigate('/worker')}>
              <span>Execution Control</span>
            </div>
            <div className={'nav-item ' + (active === '/warmup-replies' ? 'active' : '')} onClick={() => onNavigate('/warmup-replies')}>
              <span>Warmup Replies</span>
            </div>
          </div>
        </div>

        <div className="nav-divider" />

        <div className={'nav-item ' + (isActive('/settings') ? 'active' : '')} onClick={() => onNavigate('/settings')}>
          <span className="nav-icon"><Icon name="settings" /></span>
          <span>Settings</span>
        </div>
      </div>

      <div className="sidebar-footer">
        <div className="user-chip">
          <div className="user-avatar" />
          <div>
            <div className="user-name">Admin</div>
            <div className="user-role">Super Admin</div>
          </div>
        </div>
      </div>
    </>
  )
}
