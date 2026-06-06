export function BarChart({ data, height = 110, color = 'var(--color-accent-dark)' }) {
  const W = 300
  const H = height
  const PADDING_BOTTOM = 22
  const PADDING_TOP = 16
  const chartH = H - PADDING_BOTTOM - PADDING_TOP
  const barW = W / data.length - 6
  const max = Math.max(...data.map((d) => d.value), 0.01)

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      style={{ height: H, display: 'block' }}
      aria-label="Gráfico de barras"
    >
      {data.map((d, i) => {
        const bh = Math.max((d.value / max) * chartH, d.value > 0 ? 3 : 0)
        const x = i * (W / data.length) + 3
        const y = PADDING_TOP + chartH - bh
        return (
          <g key={i}>
            <rect
              x={x}
              y={y}
              width={barW}
              height={bh}
              rx={5}
              fill={d.value > 0 ? color : 'rgba(61,43,31,0.08)'}
            />
            {d.value > 0 && (
              <text
                x={x + barW / 2}
                y={y - 4}
                textAnchor="middle"
                fontSize="8"
                fill={color}
                fontWeight="700"
              >
                {d.label2 ?? (d.value > 0 ? d.value.toFixed(0) : '')}
              </text>
            )}
            <text
              x={x + barW / 2}
              y={H - 5}
              textAnchor="middle"
              fontSize="9"
              fill="var(--color-text)"
              opacity={0.55}
            >
              {d.label}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
