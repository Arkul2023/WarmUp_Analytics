import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5000'

const client = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
})

client.interceptors.request.use((cfg)=>{
  const token = localStorage.getItem('token')
  if (token) cfg.headers.set('authorization', `Bearer ${token}`)
  return cfg
})

export default client
