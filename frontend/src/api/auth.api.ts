import client from './apiClient'

export async function login(email:string,password:string){
  const res = await client.post('/api/auth/login',{email,password})
  return res.data
}

export async function me(){
  const res = await client.get('/api/auth/me')
  return res.data
}
