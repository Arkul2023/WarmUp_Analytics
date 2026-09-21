import React, { useState } from 'react'
import PageHeader from '../components/PageHeader'

const TABS = [
  { id: 'general', label: 'General' },
  { id: 'mailwizz', label: 'MailWizz' },
  { id: 'worker', label: 'Inbox / Worker' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'advanced', label: 'Advanced' },
]

function Toggle({ on }: { on: boolean }) {
  const [v, setV] = useState(on)
  return <div className={'toggle ' + (v ? 'on' : '')} onClick={() => setV(x => !x)}><div className="knob" /></div>
}

export default function Settings() {
  const [tab, setTab] = useState('general')

  return (
    <div className="fade-in">
      <PageHeader title="Settings" subtitle="Manage your application settings." />

      <div className="tabs">
        {TABS.map(t => (
          <div key={t.id} className={'tab ' + (tab === t.id ? 'active' : '')} onClick={() => setTab(t.id)}>{t.label}</div>
        ))}
      </div>

      {tab === 'general' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14 }}>
            <div className="card fade-in">
              <div className="card-title">Application Settings</div>
              <div className="col" style={{ gap: 12, marginTop: 10 }}>
                <div className="field"><label>Application Name</label><input defaultValue="Warmup Control Center" /></div>
                <div className="field"><label>Timezone</label><select defaultValue="ist"><option value="ist">(UTC+05:30) Asia/Kolkata</option><option value="utc">UTC</option></select></div>
                <div className="field"><label>Date Format</label><select defaultValue="dmy"><option value="dmy">DD MMM YYYY</option><option value="mdy">MMM DD, YYYY</option></select></div>
                <div className="field"><label>Time Format</label><select defaultValue="12"><option value="12">12 Hour (hh:mm A)</option><option value="24">24 Hour</option></select></div>
                <div className="field"><label>Language</label><select defaultValue="en"><option value="en">English</option></select></div>
              </div>
            </div>

            <div className="card fade-in">
              <div className="card-title">Data &amp; Sync</div>
              <div className="col" style={{ gap: 14, marginTop: 10 }}>
                <div className="kv"><span className="kv-label">Auto Sync</span><Toggle on /></div>
                <div className="field"><label>Sync Interval</label><select defaultValue="15"><option value="15">15 minutes</option><option value="30">30 minutes</option><option value="60">1 hour</option></select></div>
                <div className="field"><label>Data Retention</label><select defaultValue="365"><option value="90">90 days</option><option value="365">365 days</option></select></div>
                <div className="field"><label>Clear Old Logs</label><button className="btn-danger">Clear Now</button></div>
              </div>
            </div>

            <div className="card fade-in">
              <div className="card-title">Appearance</div>
              <div className="col" style={{ gap: 12, marginTop: 10 }}>
                <div className="field"><label>Theme</label><select defaultValue="dark"><option value="dark">Dark</option><option value="light">Light</option></select></div>
                <div className="field"><label>Primary Color</label><div style={{ width: 34, height: 22, borderRadius: 6, background: '#3b82f6', border: '1px solid var(--border)' }} /></div>
                <div className="field"><label>Sidebar Style</label><select defaultValue="compact"><option value="compact">Compact</option><option value="comfortable">Comfortable</option></select></div>
                <div className="field"><label>Font Size</label><select defaultValue="medium"><option value="small">Small</option><option value="medium">Medium</option><option value="large">Large</option></select></div>
              </div>
            </div>
          </div>

          <div className="row" style={{ marginTop: 16, justifyContent: 'space-between' }}>
            <button className="btn-primary">Save Changes</button>
            <button className="btn-ghost">Reset to Defaults</button>
          </div>
        </>
      )}

      {tab === 'mailwizz' && (
        <div className="card fade-in">
          <div className="card-title">MailWizz Sync Settings</div>
          <div className="muted" style={{ fontSize: 12.3 }}>Configure default sync behavior for MailWizz connections. Connect to backend endpoints to make these controls live.</div>
        </div>
      )}

      {tab === 'worker' && (
        <div className="card fade-in">
          <div className="card-title">Inbox / Worker Settings</div>
          <div className="muted" style={{ fontSize: 12.3 }}>Configure the Python worker's check interval and retry behavior. See the Python Worker page for live status.</div>
        </div>
      )}

      {tab === 'notifications' && (
        <div className="card fade-in">
          <div className="card-title">Notifications</div>
          <div className="col" style={{ gap: 14, marginTop: 6, maxWidth: 420 }}>
            <div className="kv"><span className="kv-label">Email alerts for blacklisting</span><Toggle on /></div>
            <div className="kv"><span className="kv-label">High spam-rate alerts</span><Toggle on /></div>
            <div className="kv"><span className="kv-label">Daily summary email</span><Toggle on={false} /></div>
          </div>
        </div>
      )}

      {tab === 'advanced' && (
        <div className="card fade-in">
          <div className="card-title">Advanced</div>
          <div className="muted" style={{ fontSize: 12.3 }}>Advanced configuration options for this application.</div>
        </div>
      )}
    </div>
  )
}
