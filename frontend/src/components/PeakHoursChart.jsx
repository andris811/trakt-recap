import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

function PeakHoursChart({ peakHours }) {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const timezoneShort = timezone.split('/').pop().replace(/_/g, ' ');

  const now = new Date();
  const offsetMinutes = now.getTimezoneOffset();
  const offsetHours = -offsetMinutes / 60;
  const gmtSign = offsetHours >= 0 ? '+' : '';
  const gmtLabel = `GMT${gmtSign}${offsetHours}`;

  const data = Object.entries(peakHours).map(([hour, count]) => ({
    hour: `${hour}:00`,
    count
  }));

  return (
    <div className="bg-zinc-900 rounded-xl p-6 shadow-lg border border-zinc-800 hover:border-zinc-700 transition-all">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">Peak Watching Hours</h3>
        <span className="text-xs text-zinc-500 bg-zinc-800 px-2 py-1 rounded">{timezoneShort} ({gmtLabel})</span>
      </div>
      <ResponsiveContainer width="100%" height={250}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
          <XAxis
            dataKey="hour"
            stroke="#71717a"
            tick={{ fontSize: 11 }}
            interval={2}
          />
          <YAxis stroke="#71717a" tick={{ fontSize: 11 }} allowDecimals={false} />
          <Tooltip
            contentStyle={{
              backgroundColor: '#18181b',
              border: '1px solid #27272a',
              borderRadius: '8px',
              color: '#e5e5e5'
            }}
            formatter={(value) => [`${value} watches`, 'Count']}
          />
          <Bar
            dataKey="count"
            fill="#10b981"
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default PeakHoursChart;
