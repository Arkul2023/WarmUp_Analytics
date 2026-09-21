import React from 'react'

export default function LineChart({labels, series, colors, height=120}:{labels:string[],series:{name:string,data:number[]}[],colors?:string[],height?:number}){
  const width = Math.max(300, labels.length * 40)
  const max = Math.max(...series.flatMap(s=>s.data), 1)
  const points = (data:number[])=> data.map((v,i)=> `${(i/(labels.length-1))*100},${100-(v/max)*100}`)

  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      <rect x={0} y={0} width="100%" height="100%" fill="transparent" />
      {series.map((s,idx)=> (
        <polyline key={s.name} points={points(s.data).join(' ')} fill="none" stroke={colors?.[idx]||'#4ade80'} strokeWidth={2} />
      ))}
    </svg>
  )
}
