import client from './apiClient'

export async function getWorkerStats() {
  const res = await client.get('/api/worker/stats')
  return res.data
}

export async function getDashboardMetrics(scope: 'all' | 'recent' = 'recent') {
  const res = await client.get(`/api/dashboard?scope=${scope}`)
  return res.data
}

export async function getWorkerStatus() {
  const res = await client.get('/api/worker/status')
  return res.data
}

export async function getWorkerScans() {
  const res = await client.get('/api/worker/scans')
  return res.data
}

export async function runWorkerStep1(data: {
  target_senders?: string[]
  lookback_from?: string
  lookback_to?: string
}) {
  const res = await client.post('/api/worker/step1', data)
  return res.data
}

export async function runWorkerStep2(data: {
  target_senders?: string[]
  lookback_from?: string
  lookback_to?: string
  scan_id?: string
}) {
  const res = await client.post('/api/worker/step2', data)
  return res.data
}

export async function stopWorker() {
  const res = await client.post('/api/worker/stop')
  return res.data
}

export async function resetDashboard() {
  const res = await client.post('/api/worker/reset')
  return res.data
}

export async function resetWorkerStats() {
  const res = await client.post('/api/worker/reset')
  return res.data
}

export async function getWorkerAccounts() {
  try {
    const res = await client.get('/api/worker/accounts')
    if (res.data) {
      if (Array.isArray(res.data)) return res.data
      if (Array.isArray(res.data.data)) return res.data.data
      if (Array.isArray(res.data.accounts)) return res.data.accounts
      return res.data
    }
  } catch (err) {
    console.warn('Proxy /api/worker/accounts failed, trying direct 8000 port fallback:', err)
    try {
      const direct = await fetch('http://127.0.0.1:8000/api/accounts')
      const d = await direct.json()
      if (Array.isArray(d)) return d
      if (d && Array.isArray(d.data)) return d.data
      return d || []
    } catch (e2) {
      console.error('All worker accounts fetch attempts failed:', e2)
    }
  }
  return []
}


export async function addWorkerAccount(data: any) {
  try {
    const res = await client.post('/api/worker/accounts', data)
    return res.data
  } catch (err) {
    console.warn('Proxy /api/worker/accounts failed, trying direct 8000 fallback:', err)
    try {
      const direct = await fetch('http://127.0.0.1:8000/api/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
      return await direct.json()
    } catch (e2) {
      console.error('Direct fallback failed:', e2)
      throw err
    }
  }
}


export async function deleteWorkerAccounts(emails: string[]) {
  const res = await client.post('/api/worker/accounts/bulk-delete', { emails })
  return res.data
}

export async function testWorkerAccount(email: string) {
  const res = await client.post('/api/worker/accounts/test', { email })
  return res.data
}

export async function testAllWorkerAccounts() {
  const res = await client.post('/api/worker/accounts/test-all')
  return res.data
}

export async function getWarmupReplies() {
  const res = await client.get('/api/worker/replies')
  return res.data
}

export async function addWarmupReply(text: string) {
  const res = await client.post('/api/worker/replies', { text })
  return res.data
}

export async function updateWarmupReply(index: number, text: string) {
  const res = await client.post('/api/worker/replies/update', { index, text })
  return res.data
}

export async function deleteWarmupReply(index: number) {
  const res = await client.delete(`/api/worker/replies/${index}`)
  return res.data
}

export async function runWorkerScan() {
  const res = await client.post('/api/worker/step1', {})
  return res.data
}

export async function runWorkerEngage() {
  const res = await client.post('/api/worker/step2', {})
  return res.data
}

export async function runWorkerFullCycle(data: any = {}) {
  const res = await client.post('/api/worker/full_cycle', data)
  return res.data
}

export async function getWorkerConfig() {
  const res = await client.get('/api/worker/config')
  return res.data
}

export async function updateWorkerConfig(data: any) {
  const res = await client.post('/api/worker/config', data)
  return res.data
}
