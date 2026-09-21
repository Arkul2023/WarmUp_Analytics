import client from './apiClient'

export async function listMailboxes(params?:any){
  const res = await client.get('/api/mailboxes',{params})
  // Normalize responses from different endpoints
  // /api/mailboxes -> { success:true, data: { items: [], total, ... } }
  // /api/mailwizz/mailboxes -> { mailboxes: [] }
  if (res.data) {
    if (res.data.data && Array.isArray(res.data.data.items)) {
      return { items: res.data.data.items, meta: res.data.data.meta }
    }
    if (Array.isArray(res.data.mailboxes)) {
      return { items: res.data.mailboxes }
    }
  }
  return { items: [] }
}

export async function getMailbox(id:string){
  const res = await client.get(`/api/mailboxes/${id}`)
  // controller returns { success:true, data: mailbox }
  if (res.data && res.data.data) return { data: res.data.data }
  if (res.data && res.data.mailbox) return { data: res.data.mailbox }
  return { data: null }
}
