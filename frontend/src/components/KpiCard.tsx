import React from 'react'

type Accent = 'blue' | 'green' | 'orange' | 'red' | 'purple' | 'cyan'

const ACCENTS: Record<Accent, { color: string, bg: string }> = {
  blue: { color: '#3b82f6', bg: 'rgba(59,130,246,0.14)' },
  green: { color: '#22c55e', bg: 'rgba(34,197,94,0.14)' },
  orange: { color: '#f5a623', bg: 'rgba(245,166,35,0.14)' },
  red: { color: '#f04747', bg: 'rgba(240,71,71,0.14)' },
  purple: { color: '#a78bfa', bg: 'rgba(167,139,250,0.14)' },
  cyan: { color: '#38bdf8', bg: 'rgba(56,189,248,0.14)' },
}

const ICONS: Record<string, React.ReactNode> = {
  mail: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></svg>,
  check: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="9" /><path d="M8 12.5l2.5 2.5L16 9" /></svg>,
  inbox: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M21 12h-6l-2 3h-2l-2-3H3" /><path d="M5 5h14l2 7v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7l2-7z" /></svg>,
  alert: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><path d="M12 9v4" /><path d="M12 17h.01" /></svg>,
  reply: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M9 17 4 12l5-5" /><path d="M4 12h11a5 5 0 0 1 5 5v1" /></svg>,
  users: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>,
  pause: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></svg>,
  x: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="9" /><path d="m15 9-6 6M9 9l6 6" /></svg>,
  server: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="4" width="18" height="6" rx="1.5" /><rect x="3" y="14" width="18" height="6" rx="1.5" /><path d="M7 7h.01M7 17h.01" /></svg>,
  send: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>,
}

export default function KpiCard({
  title, value, sub, accent = 'blue', icon, up, horizontal,
}: {
  title: string, value: string | number, sub?: string, accent?: Accent, icon?: keyof typeof ICONS, up?: boolean, horizontal?: boolean
}) {
  const a = ACCENTS[accent]
  
  if (horizontal) {
    return (
      <div
        className="kpi-card fade-in"
        style={{
          ['--kpi-accent' as any]: a.color,
          ['--kpi-accent-bg' as any]: a.bg,
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          padding: '12px 12px',
          background: 'var(--card)',
          borderRadius: 12,
          border: '1px solid rgba(255,255,255,0.07)',
          boxShadow: '0 4px 14px rgba(0,0,0,0.25)',
          overflow: 'hidden',
          minWidth: 0,
          height: '100%',
          boxSizing: 'border-box'
        }}
      >
        {icon && (
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: a.bg,
              color: a.color,
              flexShrink: 0
            }}
          >
            {ICONS[icon]}
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: a.color, marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {title}
          </div>
          <div style={{ fontSize: 19, fontWeight: 800, color: '#fff', lineHeight: 1.15 }}>
            {value}
          </div>
          {sub && (
            <div style={{ fontSize: 10.5, color: 'var(--muted)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {typeof sub === 'string' && sub.startsWith('↑') ? (
                <>
                  <span style={{ color: 'var(--success)', fontWeight: 700 }}>↑ {sub.replace('↑', '').trim().split(' ')[0]}</span>{' '}
                  <span>{sub.replace('↑', '').trim().split(' ').slice(1).join(' ')}</span>
                </>
              ) : sub}
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="kpi-card fade-in" style={{ ['--kpi-accent' as any]: a.color, ['--kpi-accent-bg' as any]: a.bg }}>
      <div className="kpi-top">
        <div className="kpi-title">{title}</div>
        {icon && <div className="kpi-icon">{ICONS[icon]}</div>}
      </div>
      <div className="kpi-value">{value}</div>
      {sub && <div className={'kpi-sub ' + (up === true ? 'up' : up === false ? 'down' : '')}>{up === true ? '↑' : up === false ? '↓' : ''} {sub}</div>}
    </div>
  )
}
