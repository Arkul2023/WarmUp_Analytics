import React from 'react'

export default function AccountStatusBadge({ status }: { status: string }) {
  const s = String(status || '').toLowerCase()
  let cls = 'info'
  if (s === 'active' || s === 'healthy' || s === 'connected' || s === 'running' || s === 'good' || s === 'clean') cls = 'success'
  else if (s === 'paused' || s === 'warning' || s === 'delayed') cls = 'warn'
  else if (s === 'dropped' || s === 'error' || s === 'suspended' || s === 'blacklisted' || s === 'poor') cls = 'danger'
  return <span className={'badge ' + cls}><span className={'status-dot ' + s} />{status || 'N/A'}</span>
}
