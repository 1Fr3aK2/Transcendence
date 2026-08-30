import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

export default function PriceChart({ coin, data }) {
  if (data.length < 2) {
    return (
      <div className="price-chart">
        <div className="side-panel-title">{coin} — Last 10 Minutes</div>
        <div className="history-empty">Gathering price data…</div>
      </div>
    );
  }

  return (
    <div className="price-chart">
      <div className="side-panel-title">{coin} — Last 10 Minutes</div>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data}>
          <XAxis
            dataKey="time"
            tickFormatter={(t) => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            stroke="#4a5268"
            fontSize={10}
            minTickGap={40}
          />
          <YAxis
            domain={['auto', 'auto']}
            stroke="#4a5268"
            fontSize={10}
            tickFormatter={(v) => v.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            width={70}
          />
          <Tooltip
            contentStyle={{ background: '#13151e', border: '1px solid #1e2330', fontSize: 12 }}
            labelFormatter={(t) => new Date(t).toLocaleTimeString()}
            formatter={(v) => [`$${Number(v).toLocaleString(undefined, { maximumFractionDigits: 2 })}`, 'Price']}
          />
          <Line type="monotone" dataKey="price" stroke="#e8a020" dot={false} strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}