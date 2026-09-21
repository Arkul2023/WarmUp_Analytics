import client from './apiClient'

export interface MailwizzDbConfig {
  id?: string
  _id?: string
  name?: string
  // Server SSH
  sshHost?: string
  ssh_host?: string
  sshPort?: number | string
  ssh_port?: number | string
  sshUser?: string
  ssh_user?: string
  sshPassword?: string
  ssh_password?: string

  // DB Details
  host: string
  port: number | string
  database: string
  user: string
  password?: string

  status?: 'connected' | 'disconnected' | 'error'
  lastError?: string
}

export async function getMailwizzConnections() {
  const res = await client.get('/api/mailwizz/db/connections')
  return res.data
}

export async function saveMailwizzConnection(config: MailwizzDbConfig) {
  const res = await client.post('/api/mailwizz/db/connections', config)
  return res.data
}

export async function deleteMailwizzConnection(id: string) {
  const res = await client.delete(`/api/mailwizz/db/connections/${id}`)
  return res.data
}

export async function testMailwizzDb(config: MailwizzDbConfig) {
  const res = await client.post('/api/mailwizz/db/test', config)
  return res.data
}

export async function syncMailwizzDb(config: MailwizzDbConfig) {
  const res = await client.post('/api/mailwizz/db/sync', config)
  return res.data
}

export async function getMailwizzDbTables(config?: Partial<MailwizzDbConfig>) {
  const res = await client.post('/api/mailwizz/db/tables', config)
  return res.data
}

export async function getMailwizzDeliveryServers(config?: Partial<MailwizzDbConfig>) {
  const res = await client.post('/api/mailwizz/db/delivery-servers', config || {})
  return res.data
}

export async function getMailwizzWorkspaceAccounts(config?: Partial<MailwizzDbConfig>) {
  const res = await client.post('/api/mailwizz/db/workspace-accounts', config || {})
  return res.data
}

export async function getMailwizzSeedAccounts(config?: Partial<MailwizzDbConfig>) {
  const res = await client.post('/api/mailwizz/db/seed-accounts', config || {})
  return res.data
}

export async function getMailwizzServerStatus() {
  const res = await client.get('/api/mailwizz/db/server/status')
  return res.data
}

export async function connectMailwizzServer(forceReconnect = false) {
  const res = await client.post('/api/mailwizz/db/server/connect', { forceReconnect })
  return res.data
}

export async function disconnectMailwizzServer() {
  const res = await client.post('/api/mailwizz/db/server/disconnect')
  return res.data
}
