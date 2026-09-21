import React, { useState } from 'react'

function BellIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></svg>
}
function HelpIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="9" /><path d="M9.5 9a2.5 2.5 0 1 1 3.4 2.3c-.9.4-1.4 1-1.4 1.9" /><path d="M12 17h.01" /></svg>
}
function RefreshIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-3-6.7" /><path d="M21 3v6h-6" /></svg>
}

import { useFilters } from '../context/FilterContext'

export default function Topbar({ title = 'Warmup Control Center', alertCount = 3 }: { title?: string, alertCount?: number }) {
  const {
    customer,
    setCustomer,
    autoRefresh,
    setAutoRefresh,
    triggerRefresh
  } = useFilters()

  return (
    <div className="row" style={{ width: '100%' }}>
      <div className="tb-left">
        <select value={customer} onChange={e => setCustomer(e.target.value)}>
          <option value="all">All Customers</option>
          <option value="warmup-a">Warmup-A</option>
          <option value="warmup-b">Warmup-B</option>
          <option value="warmup-c">Warmup-C</option>
        </select>

        <button className="btn-primary btn-sm" onClick={triggerRefresh}><RefreshIcon /> Refresh</button>
        <div className="row" style={{ gap: 6, marginLeft: 4 }}>
          <span className="muted" style={{ fontSize: 11.5 }}>Auto Refresh</span>
          <div className={'toggle ' + (autoRefresh ? 'on' : '')} onClick={() => setAutoRefresh(a => !a)}>
            <div className="knob" />
          </div>
        </div>
      </div>

      <div className="tb-right" style={{ marginLeft: 'auto' }}>
        <div className="icon-btn">
          <BellIcon />
          {alertCount > 0 && <span className="dot">{alertCount}</span>}
        </div>
        <div className="icon-btn"><HelpIcon /></div>
      </div>
    </div>
  )
}
