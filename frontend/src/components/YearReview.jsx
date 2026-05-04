import { useMemo, useState } from 'react';
import { formatDuration } from '../utils';
import YearListModal from './YearListModal';

export default function YearReview({ events, onOpenSeries, onOpenEpisode }) {
  const years = useMemo(() => {
    const yearSet = new Set();
    for (const e of events) {
      yearSet.add(new Date(e.watchedAt).getFullYear());
    }
    return [...yearSet].sort((a, b) => b - a);
  }, [events]);

  const [selectedYear, setSelectedYear] = useState(years[0] || new Date().getFullYear());
  const [listModal, setListModal] = useState(null);

  const yearData = useMemo(() => {
    const yearEvents = events.filter(e => new Date(e.watchedAt).getFullYear() === selectedYear);
    const movies = yearEvents.filter(e => e.type === 'movie');
    const episodes = yearEvents.filter(e => e.type === 'episode');
    const totalMinutes = yearEvents.reduce((sum, e) => sum + (e.runtime || 0), 0);
    const totalHours = totalMinutes / 60;

    const showCounts = {};
    for (const e of episodes) {
      if (e.showTitle) {
        showCounts[e.showTitle] = (showCounts[e.showTitle] || 0) + 1;
      }
    }
    const topShows = Object.entries(showCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([title, count]) => ({ title, count }));

    const genreCounts = {};
    for (const e of yearEvents) {
      for (const g of (e.genres || [])) {
        genreCounts[g] = (genreCounts[g] || 0) + 1;
      }
    }
    const topGenres = Object.entries(genreCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([genre, count]) => ({ genre, count }));

    return { movies, episodes, totalHours, topShows, topGenres };
  }, [events, selectedYear]);

  const handleItemClick = (item) => {
    if (item.type === 'movie') {
      onOpenSeries({ type: 'movie', traktId: item.traktId, title: item.title, poster: item.poster, genres: item.genres || [] });
    } else {
      onOpenEpisode(item);
    }
  };

  if (years.length === 0) return null;

  return (
    <div className="bg-zinc-900 rounded-xl p-6 shadow-lg border border-zinc-800">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-white">Year Review</h3>
        <select
          value={selectedYear}
          onChange={e => setSelectedYear(parseInt(e.target.value))}
          className="bg-zinc-800 text-white border border-zinc-700 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-zinc-500"
        >
          {years.map(y => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <button
          onClick={() => setListModal({ type: 'movies', items: yearData.movies })}
          className="bg-zinc-800/50 rounded-lg p-4 hover:bg-zinc-800 transition-all cursor-pointer text-left hover:scale-[1.02]"
        >
          <div className="text-2xl font-bold text-white">{yearData.movies.length}</div>
          <div className="text-zinc-400 text-sm">Movies</div>
        </button>
        <button
          onClick={() => setListModal({ type: 'episodes', items: yearData.episodes })}
          className="bg-zinc-800/50 rounded-lg p-4 hover:bg-zinc-800 transition-all cursor-pointer text-left hover:scale-[1.02]"
        >
          <div className="text-2xl font-bold text-white">{yearData.episodes.length}</div>
          <div className="text-zinc-400 text-sm">Episodes</div>
        </button>
        <div className="bg-zinc-800/50 rounded-lg p-4">
          <div className="text-2xl font-bold text-white">{formatDuration(yearData.totalHours)}</div>
          <div className="text-zinc-400 text-sm">Watch Time</div>
        </div>
      </div>

      {yearData.topShows.length > 0 && (
        <div className="mb-6">
          <h4 className="text-sm font-semibold text-zinc-300 uppercase tracking-wide mb-3">Top Shows</h4>
          <div className="space-y-2">
            {yearData.topShows.map((show, i) => (
              <button
                key={show.title}
                onClick={() => onOpenSeries({ type: 'episode', traktId: yearData.episodes.find(e => e.showTitle === show.title)?.traktId, title: show.title, poster: yearData.episodes.find(e => e.showTitle === show.title)?.poster, genres: [] })}
                className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-zinc-800/50 transition-all cursor-pointer text-left"
              >
                <div className="flex items-center gap-3">
                  <span className="text-zinc-500 text-sm w-5">{i + 1}</span>
                  <span className="text-zinc-300 text-sm">{show.title}</span>
                </div>
                <span className="text-zinc-500 text-sm">{show.count} episodes</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {yearData.topGenres.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-zinc-300 uppercase tracking-wide mb-3">Top Genres</h4>
          <div className="flex flex-wrap gap-2">
            {yearData.topGenres.map(g => (
              <span key={g.genre} className="px-3 py-1.5 rounded-full text-xs font-medium bg-zinc-800 text-zinc-300 capitalize">
                {g.genre} ({g.count})
              </span>
            ))}
          </div>
        </div>
      )}

      {listModal && (
        <YearListModal
          title={listModal.type === 'movies' ? `Movies in ${selectedYear}` : `Episodes in ${selectedYear}`}
          items={listModal.items}
          onClose={() => setListModal(null)}
          onItemClick={handleItemClick}
        />
      )}
    </div>
  );
}
