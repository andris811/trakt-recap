import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const DARK_COLORS = [
  '#10b981', '#8b5cf6', '#f59e0b', '#ef4444', '#3b82f6',
  '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#84cc16',
  '#06b6d4', '#a855f7', '#e11d48', '#0ea5e9', '#d946ef'
];

const LIGHT_COLORS = [
  '#34d399', '#a78bfa', '#fbbf24', '#f87171', '#60a5fa',
  '#f472b6', '#2dd4bf', '#fb923c', '#818cf8', '#a3e635',
  '#22d3ee', '#c084fc', '#fb7185', '#38bdf8', '#e879f9'
];

function GenreChart({ genreDistribution, onGenreClick, year, theme }) {
  const isLight = theme === 'light';
  const COLORS = isLight ? LIGHT_COLORS : DARK_COLORS;
  const tooltipStyle = {
    backgroundColor: isLight ? '#ffffff' : '#18181b',
    border: isLight ? '1px solid #d4d4d8' : '1px solid #27272a',
    borderRadius: '8px',
    color: isLight ? '#18181b' : '#e5e5e5'
  };
  const data = Object.entries(genreDistribution)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);

  if (data.length === 0) {
    return (
      <div className="bg-zinc-900 rounded-xl p-6 shadow-lg border border-zinc-800">
        <h3 className="text-lg font-semibold text-white mb-4">Genre Distribution {year ? `(${year})` : ''}</h3>
        <p className="text-zinc-500">No genre data available</p>
      </div>
    );
  }

  return (
    <div className="bg-zinc-900 rounded-xl p-6 shadow-lg border border-zinc-800 hover:border-zinc-700 transition-all">
      <h3 className="text-lg font-semibold text-white mb-4">Genre Distribution {year ? `(${year})` : ''}</h3>
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
          <Tooltip contentStyle={tooltipStyle}
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
