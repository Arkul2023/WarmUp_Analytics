import React, { useEffect, useState } from 'react'
import PageHeader from '../components/PageHeader'
import LoadingState from '../components/LoadingState'
import EmptyState from '../components/EmptyState'
import { getWarmupReplies, addWarmupReply, updateWarmupReply, deleteWarmupReply } from '../api/worker.api'

export default function WarmupReplies() {
  const [replies, setReplies] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editIndex, setEditIndex] = useState(-1)
  const [editText, setEditText] = useState('')

  const load = () => {
    setLoading(true)
    setError('')
    getWarmupReplies()
      .then(d => setReplies(d?.replies || []))
      .catch(e => setError('Failed to load replies. Is the Python worker running?'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const openAdd = () => { setEditIndex(-1); setEditText(''); setModalOpen(true) }
  const openEdit = (i: number) => { setEditIndex(i); setEditText(replies[i]); setModalOpen(true) }

  const handleSave = async () => {
    if (!editText.trim()) return
    try {
      if (editIndex === -1) await addWarmupReply(editText.trim())
      else await updateWarmupReply(editIndex, editText.trim())
      setModalOpen(false)
      load()
    } catch { setError('Failed to save reply') }
  }

  const handleDelete = async (i: number) => {
    if (!window.confirm('Delete this reply template?')) return
    try {
      await deleteWarmupReply(i)
      load()
    } catch { setError('Failed to delete reply') }
  }

  return (
    <div className="fade-in">
      <PageHeader
        title="Warmup Replies"
        subtitle="Manage rotational reply templates used for warmup engagement."
        actions={<button className="btn-primary btn-sm" onClick={openAdd}>+ Add Reply</button>}
      />

      {error && <div className="card" style={{ background: 'rgba(240,71,71,0.1)', borderColor: 'var(--danger)', marginBottom: 14, padding: '10px 14px', fontSize: 12.5, color: 'var(--danger)' }}>{error}</div>}

      {loading ? <LoadingState /> : replies.length === 0 ? (
        <EmptyState title="No reply templates" description="Add warmup reply templates to use for engagement." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {replies.map((r, i) => (
            <div key={i} className="card" style={{ padding: '10px 14px' }}>
              <div className="row" style={{ gap: 12, alignItems: 'flex-start' }}>
                <span className="badge" style={{ flexShrink: 0, minWidth: 28, textAlign: 'center' }}>{i + 1}</span>
                <div style={{ flex: 1, fontSize: 12.5, lineHeight: 1.6, color: 'var(--text)' }}>{r}</div>
                <div className="row" style={{ gap: 6, flexShrink: 0 }}>
                  <button className="btn-ghost btn-sm" onClick={() => openEdit(i)}>Edit</button>
                  <button className="btn-danger btn-sm" onClick={() => handleDelete(i)}>Delete</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {modalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div className="card" style={{ width: 520, maxWidth: '90vw' }}>
            <div className="card-title" style={{ marginBottom: 12 }}>{editIndex === -1 ? 'Add Reply Template' : 'Edit Reply Template'}</div>
            <textarea
              value={editText}
              onChange={e => setEditText(e.target.value)}
              rows={4}
              style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', color: 'var(--text)', fontSize: 12.5, resize: 'vertical', fontFamily: 'inherit' }}
              placeholder="Type a natural warmup reply..."
              autoFocus
            />
            <div className="row" style={{ gap: 8, marginTop: 14, justifyContent: 'flex-end' }}>
              <button className="btn-ghost btn-sm" onClick={() => setModalOpen(false)}>Cancel</button>
              <button className="btn-primary btn-sm" onClick={handleSave}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
