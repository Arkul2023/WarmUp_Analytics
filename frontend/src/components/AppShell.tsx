import React from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import Sidebar from './Sidebar'
import Topbar from './Topbar'

export default function AppShell() {
  const location = useLocation()
  const navigate = useNavigate()

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Sidebar onNavigate={(p) => navigate(p)} active={location.pathname} />
      </aside>
      <div className="content">
        <header className="topbar">
          <Topbar />
        </header>
        <main className="main">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
