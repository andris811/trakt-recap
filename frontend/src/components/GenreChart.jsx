import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const COLORS = [
  '#10b981', '#8b5cf6', '#f59e0b', '#ef4444', '#3b82f6',
  '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#84cc16',
  '#06b6d4', '#a855f7', '#e11d48', '#0ea5e9', '#d946ef'
];

function GenreChart({ genreDistribution, onGenreClick }) {
  const data = Object.entries(genreDistribution)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);

  if (data.length === 0) {
    return (
      <div className="bg-zinc-900 rounded-xl p-6 shadow-lg border border-zinc-800">
        <h3 className="text-lg font-semibold text-white mb-4">Genre Distribution</h3>
        <p className="text-zinc-500">No genre data available</p>
      </div>
    );
  }

  return (
    <div className="bg-zinc-900 rounded-xl p-6 shadow-lg border border-zinc-800 hover:border-zinc-700 transition-all">
      <h3 className="text-lg font-semibold text-white mb-4">Genre Distribution</h3>
      <p className="text-zinc-500 text-xs mb-2">Click a genre to explore</p>
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={100}
            paddingAngle={2}
            dataKey="value"
            onClick={(entry) => onGenreClick(entry.name)}
            style={{ cursor: 'pointer' }}
          >
            {data.map((_, index) => (
              <Cell key={index} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: '#18181b',
              border: '1px solid #27272a',
              borderRadius: '8px',
              color: '#e5e5e5'
            }}
            formatter={(value, name, props) => [`${value} watches`, props.payload.name.charAt(0).toUpperCase() + props.payload.name.slice(1)]}
          />
          <Legend
            wrapperStyle={{ fontSize: '12px', cursor: 'pointer' }}
            onClick={(entry) => onGenreClick(entry.value)}
            formatter={(value) => value.charAt(0).toUpperCase() + value.slice(1)}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export default GenreChart;
