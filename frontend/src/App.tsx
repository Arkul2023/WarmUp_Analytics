import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import AppShell from './components/AppShell'
import Dashboard from './pages/Dashboard'
import MailboxDetail from './pages/MailboxDetail'
import AllAccounts from './pages/AllAccounts'
import SmtpAccounts from './pages/SmtpAccounts'
import WorkspaceAccounts from './pages/WorkspaceAccounts'
import SeedAccounts from './pages/SeedAccounts'
import MailWizz from './pages/MailWizz'
import Worker from './pages/Worker'
import WarmupReplies from './pages/WarmupReplies'
import Settings from './pages/Settings'
import Login from './pages/Login'
import NotFound from './pages/NotFound'

import { FilterProvider } from './context/FilterContext'

export default function App() {
  return (
    <FilterProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<AppShell />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="mailboxes" element={<AllAccounts />} />
          <Route path="mailboxes/smtp" element={<SmtpAccounts />} />
          <Route path="mailboxes/workspace" element={<WorkspaceAccounts />} />
          <Route path="mailboxes/seed-test" element={<SeedAccounts />} />
          <Route path="mailboxes/:id" element={<MailboxDetail />} />
          <Route path="mailwizz" element={<MailWizz />} />
          <Route path="worker" element={<Worker />} />
          <Route path="worker/execution" element={<Worker />} />
          <Route path="worker/replies" element={<WarmupReplies />} />
          <Route path="warmup-replies" element={<WarmupReplies />} />
          <Route path="settings" element={<Settings />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </FilterProvider>
  )
}
