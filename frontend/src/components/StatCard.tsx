import React from 'react'

export default function StatCard({title, value}:{title:string,value:string|number}){
  return (
    <div className="card">
      <div style={{fontSize:12,color:'#9aa4b2'}}>{title}</div>
      <div style={{fontSize:20,fontWeight:700}}>{value}</div>
    </div>
  )
}
