import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

function RatingsChart({ ratingsDistribution, onRatingClick }) {
  const data = Object.entries(ratingsDistribution)
    .map(([rating, count]) => ({ rating: `★ ${rating}`, count, rawRating: parseInt(rating) }))
    .sort((a, b) => a.rawRating - b.rawRating);

  return (
    <div className="bg-zinc-900 rounded-xl p-6 shadow-lg border border-zinc-800 hover:border-zinc-700 transition-all">
      <h3 className="text-lg font-semibold text-white mb-4">Ratings Distribution</h3>
      <ResponsiveContainer width="100%" height={250}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
          <XAxis
            dataKey="rating"
            stroke="#71717a"
            tick={{ fontSize: 12 }}
          />
          <YAxis
            stroke="#71717a"
            tick={{ fontSize: 11 }}
            allowDecimals={false}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#18181b',
              border: '1px solid #27272a',
              borderRadius: '8px',
              color: '#e5e5e5'
            }}
            formatter={(value) => [`${value} items`, '']}
          />
          <Bar
            dataKey="count"
            fill="#8b5cf6"
            radius={[4, 4, 0, 0]}
            onClick={(entry) => onRatingClick && onRatingClick(entry.rawRating)}
            style={{ cursor: 'pointer' }}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default RatingsChart;
