import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import PageHeader from '../components/PageHeader'
import { getMailbox } from '../api/mailboxes.api'
import LoadingState from '../components/LoadingState'
import EmptyState from '../components/EmptyState'

export default function MailboxDetail(){
  const { id } = useParams()
  const [loading,setLoading] = useState(true)
  const [mailbox,setMailbox] = useState<any>(null)

  useEffect(()=>{
    if (!id) return
    setLoading(true)
    getMailbox(id).then(r=>setMailbox(r.data)).catch(()=>setMailbox(null)).finally(()=>setLoading(false))
  },[id])

  if (loading) return <LoadingState />
  if (!mailbox) return <EmptyState title="Mailbox not found" />

  return (
    <div>
      <PageHeader title={mailbox.email || mailbox.address || 'Mailbox'} subtitle={mailbox.provider || ''} />
      <div className="grid">
        <div className="card">Sent: {mailbox.sent ?? 'N/A'}</div>
        <div className="card">Inbox: {mailbox.inboxPercent ?? 'N/A'}</div>
        <div className="card">Spam: {mailbox.spamPercent ?? 'N/A'}</div>
      </div>
    </div>
  )
}
