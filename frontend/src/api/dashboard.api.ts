import client from './apiClient'

export async function getSummary(){
  const res = await client.get('/api/dashboard/summary')
  return res.data
}

export async function getCampaigns(limit=10){
  const res = await client.get('/api/dashboard/campaigns',{params:{limit}})
  return res.data
}
