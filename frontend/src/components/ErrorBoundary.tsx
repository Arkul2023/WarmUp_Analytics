import React, { Component, ErrorInfo, ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
}

export default class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('React render error caught by ErrorBoundary:', error, errorInfo)
    this.setState({ error, errorInfo })
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 40, color: '#f04747', background: '#0a1220', minHeight: '100vh', fontFamily: 'sans-serif' }}>
          <h2 style={{ color: '#f04747', marginBottom: 16 }}>⚠️ Application Error</h2>
          <div style={{ background: 'rgba(240,71,71,0.1)', border: '1px solid #f04747', borderRadius: 8, padding: 16, marginBottom: 20 }}>
            <b style={{ fontSize: 16 }}>{this.state.error?.name}: </b>
            <span style={{ fontSize: 14 }}>{this.state.error?.message}</span>
          </div>
          <pre style={{ color: '#93a0b4', fontSize: 12, overflow: 'auto', background: '#0d1729', padding: 16, borderRadius: 8, lineHeight: 1.6 }}>
            {this.state.error?.stack}
          </pre>
          <button
            onClick={() => window.location.reload()}
            style={{ marginTop: 20, padding: '10px 20px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}
          >
            🔄 Reload Application
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
