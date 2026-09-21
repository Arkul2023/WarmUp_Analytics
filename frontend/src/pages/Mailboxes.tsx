import React, { useEffect, useState } from 'react'
import PageHeader from '../components/PageHeader'
import { listMailboxes } from '../api/mailboxes.api'
import LoadingState from '../components/LoadingState'
import EmptyState from '../components/EmptyState'
import { Link } from 'react-router-dom'

export default function Mailboxes(){
  const [loading,setLoading] = useState(true)
  const [data,setData] = useState<any>(null)

  useEffect(()=>{
    setLoading(true)
    listMailboxes().then(r=>setData(r)).catch(()=>setData(null)).finally(()=>setLoading(false))
  },[])

  if (loading) return <LoadingState />
  if (!data || !Array.isArray(data.items) || data.items.length===0) return <EmptyState title="No mailboxes" description="No mailboxes found in MailWizz." />

  return (
    <div>
      <PageHeader title="Email Accounts" subtitle="Discovered from MailWizz" />
      <div className="card">
        <table className="table">
          <thead>
            <tr><th>Email</th><th>Provider</th><th>Status</th><th>Sent Today</th></tr>
          </thead>
          <tbody>
            {data.items.map((m:any)=> (
              <tr key={m._id}>
                <td><Link to={`/mailboxes/${m._id}`}>{m.email || m.address || 'N/A'}</Link></td>
                <td>{m.provider || 'N/A'}</td>
                <td className="muted">{m.status || 'N/A'}</td>
                <td className="muted">{m.sentToday ?? 'N/A'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
