import { useMemo, useState, useRef, useEffect } from 'react';

const DARK_COLORS = ['bg-zinc-800', 'bg-emerald-900', 'bg-emerald-700', 'bg-emerald-500', 'bg-emerald-400'];
const LIGHT_COLORS = ['bg-zinc-200', 'bg-emerald-300', 'bg-emerald-400', 'bg-emerald-500', 'bg-emerald-600'];

function Heatmap({ heatmap, theme }) {
  const [tooltip, setTooltip] = useState(null);
  const containerRef = useRef(null);
  const [cellSize, setCellSize] = useState(14);
  const [cellGap, setCellGap] = useState(3);
  const isLight = theme === 'light';
  const LEVEL_COLORS = isLight ? LIGHT_COLORS : DARK_COLORS;

  const { weeks } = useMemo(() => {
    const today = new Date();
    const sixMonthsAgo = new Date(today);
    sixMonthsAgo.setMonth(today.getMonth() - 6);
    const cutoffDate = sixMonthsAgo.toISOString().split('T')[0];

    const sortedDates = Object.keys(heatmap)
      .filter(d => d >= cutoffDate)
      .sort();

    if (sortedDates.length === 0) return { weeks: [] };

    const startDate = new Date(sortedDates[0] + 'T00:00:00');
    const endDate = new Date(sortedDates[sortedDates.length - 1] + 'T00:00:00');

    const startDay = startDate.getDay();
    const firstMonday = new Date(startDate);
    firstMonday.setDate(startDate.getDate() - ((startDay + 6) % 7));

    const weeks = [];
    let current = new Date(firstMonday);

    while (current <= endDate) {
      const week = [];
      for (let day = 0; day < 7; day++) {
        const dateStr = current.toISOString().split('T')[0];
        const count = heatmap[dateStr] || 0;
        const level = count === 0 ? 0 : count <= 2 ? 1 : count <= 5 ? 2 : count <= 10 ? 3 : 4;
        week.push({ date: dateStr, count, level });
        current.setDate(current.getDate() + 1);
      }
      weeks.push(week);
    }

    return { weeks };
  }, [heatmap]);

  useEffect(() => {
    if (containerRef.current && weeks.length > 0) {
      const containerWidth = containerRef.current.clientWidth - 48;
      const calculatedSize = Math.floor((containerWidth - (weeks.length - 1) * 3) / weeks.length);
      const size = Math.max(10, Math.min(18, calculatedSize));
      setCellSize(size);
      setCellGap(size > 14 ? 4 : 3);
    }
  }, [weeks.length]);

  if (weeks.length === 0) {
    return (
      <div className="bg-zinc-900 rounded-xl p-6 shadow-lg border border-zinc-800">
        <h3 className="text-lg font-semibold text-white mb-4">Activity Heatmap</h3>
        <p className="text-zinc-500">No activity data</p>
      </div>
    );
  }

  const formatDate = (dateStr) => {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="bg-zinc-900 rounded-xl p-6 shadow-lg border border-zinc-800 relative">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">Activity Heatmap</h3>
        <span className="text-xs text-zinc-500 bg-zinc-800 px-2 py-1 rounded">Last 6 months</span>
      </div>
      <div ref={containerRef} className="w-full">
        <div className="flex gap-1 justify-center">
          {weeks.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-1 shrink-0">
              {week.map((day) => (
                <div
                  key={day.date}
                  className={`rounded-sm ${LEVEL_COLORS[day.level]} cursor-pointer transition-transform hover:scale-150`}
                  style={{ width: `${cellSize}px`, height: `${cellSize}px` }}
                  onMouseEnter={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    setTooltip({
                      date: formatDate(day.date),
                      count: day.count,
                      x: rect.left + rect.width / 2,
                      y: rect.top - 8
                    });
                  }}
                  onMouseLeave={() => setTooltip(null)}
                />
              ))}
            </div>
          ))}
        </div>
        <div className="flex items-center justify-center gap-2 mt-4 text-xs text-zinc-500">
          <span>Less</span>
          {LEVEL_COLORS.map((color, i) => (
            <div key={i} className={`w-3 h-3 rounded-sm ${color}`} />
          ))}
          <span>More</span>
        </div>
      </div>

      {tooltip && (
        <div
          className={`fixed z-50 pointer-events-none ${isLight ? 'bg-white text-zinc-900 border-zinc-300' : 'bg-zinc-800 text-white border-zinc-700'} text-xs px-3 py-2 rounded-lg shadow-xl border whitespace-nowrap`}
          style={{
            left: tooltip.x,
            top: tooltip.y,
            transform: 'translate(-50%, -100%)'
          }}
        >
          <div className="font-medium">{tooltip.date}</div>
          <div className={isLight ? 'text-zinc-500' : 'text-zinc-400'}>{tooltip.count} {tooltip.count === 1 ? 'watch' : 'watches'}</div>
        </div>
      )}
    </div>
  );
}

export default Heatmap;
