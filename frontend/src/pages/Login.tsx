import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { login } from '../api/auth.api'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  const submit = async (e: any) => {
    e.preventDefault()
    try {
      const res = await login(email, password)
      if (res.success && res.data?.token) {
        localStorage.setItem('token', res.data.token)
        navigate('/dashboard')
      } else {
        setError(res.message || 'Login failed')
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || String(err))
    }
  }

  return (
    <div className="login-shell">
      <div className="card login-card fade-in">
        <div className="brand" style={{ paddingBottom: 20 }}>
          <div className="brand-mark">W</div>
          <div>
            <div className="brand-title" style={{ fontSize: 15 }}>Warmup Control Center</div>
            <div className="brand-sub">SIGN IN TO CONTINUE</div>
          </div>
        </div>
        <form onSubmit={submit} className="col" style={{ gap: 12 }}>
          <div className="field"><label>Email</label><input placeholder="you@company.com" value={email} onChange={e => setEmail(e.target.value)} /></div>
          <div className="field"><label>Password</label><input placeholder="••••••••" type="password" value={password} onChange={e => setPassword(e.target.value)} /></div>
          <button type="submit" className="btn-primary" style={{ justifyContent: 'center', marginTop: 6 }}>Sign in</button>
          {error && <div style={{ color: 'var(--danger)', fontSize: 12 }}>{error}</div>}
        </form>
      </div>
    </div>
  )
}
