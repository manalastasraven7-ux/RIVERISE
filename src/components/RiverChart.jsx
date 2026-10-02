import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';

export default function RiverChart({ data = [] }) {
  if (!data || data.length === 0) {
    return <div className="empty-state">Waiting for real sensor data.</div>;
  }

  return (
    <div style={{ width: '100%', height: 260 }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 12, right: 16, left: 0, bottom: 12 }}>
          <defs>
            <linearGradient id="waterLevelFill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.8} />
              <stop offset="95%" stopColor="#38bdf8" stopOpacity={0.1} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="rgba(148,163,184,0.25)" vertical={false} />
          <XAxis dataKey="label" tick={{ fill: '#cbd5e1', fontSize: 11 }} minTickGap={20} />
          <YAxis tick={{ fill: '#cbd5e1', fontSize: 11 }} />
          <Tooltip
            contentStyle={{ background: '#07141d', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12 }}
            formatter={(value) => [`${value} m`, 'Water level']}
          />
          <Area type="monotone" dataKey="water_level" stroke="#38bdf8" fill="url(#waterLevelFill)" strokeWidth={2.5} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
