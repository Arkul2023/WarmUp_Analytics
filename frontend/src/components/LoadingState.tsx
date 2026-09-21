import React from 'react'

export default function LoadingState({ message = 'Loading…' }: { message?: string }) {
  return <div className="empty-state muted">{message}</div>
}
