import React from 'react'

function arcPath(cx: number, cy: number, r: number, start: number, end: number) {
  const large = end - start > Math.PI ? 1 : 0
  const x1 = cx + r * Math.cos(start)
  const y1 = cy + r * Math.sin(start)
  const x2 = cx + r * Math.cos(end)
  const y2 = cy + r * Math.sin(end)
  return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`
}

export default function DonutChart({
  data = [],
  colors = [],
  size = 220,
  inner = 70,
}: {
  data?: number[]
  colors?: string[]
  size?: number
  inner?: number
}) {
  const safeData = Array.isArray(data) ? data : []
  const total = safeData.reduce((a, b) => a + (Number(b) || 0), 0)
  let angle = -Math.PI / 2
  const cx = size / 2
  const cy = size / 2
  const r = size / 2 - 8

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {total === 0 ? (
        <circle
          cx={cx}
          cy={cy}
          r={(r + inner) / 2}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={r - inner}
        />
      ) : (
        safeData.map((v, i) => {
          if (!v) return null
          const portion = v / total
          const next = angle + portion * Math.PI * 2
          const path = arcPath(cx, cy, r, angle, next)
          const el = (
            <path
              key={i}
              d={path}
              fill={colors[i] || '#3b82f6'}
              stroke="var(--card,#0e1a30)"
              strokeWidth={2}
            />
          )
          angle = next
          return el
        })
      )}
      <circle cx={cx} cy={cy} r={inner} fill="#071427" stroke="#0b2a45" />
    </svg>
  )
}
