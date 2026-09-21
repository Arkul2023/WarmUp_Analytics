import React from 'react'

export default function EmptyState({ title, description }: { title: string, description?: string }) {
  return (
    <div className="empty-state">
      <div style={{ fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>{title}</div>
      {description && <div className="muted">{description}</div>}
    </div>
  )
}
