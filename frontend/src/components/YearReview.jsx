import { useMemo, useState } from 'react';
import { formatDuration } from '../utils';
import YearListModal from './YearListModal';
import GenreChart from './GenreChart';

function formatDaysHours(totalHours) {
  const days = Math.floor(totalHours / 24);
  const hours = Math.round(totalHours % 24);
  if (days === 0) return `${hours}h`;
  return `${days}d ${hours}h`;
}

export default function YearReview({ events, onOpenSeries, onOpenEpisode, onGenreClick }) {
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
    const totalMinutes = yearEvents.reduce((sum, e) => sum + (e.runtime || 0),0);
    const totalHours = totalMinutes / 60;

    const showCounts = {};
    const showPosters = {};
    for (const e of episodes) {
      if (e.showTitle) {
        showCounts[e.showTitle] = (showCounts[e.showTitle] || 0) + 1;
        if (e.poster && !showPosters[e.showTitle]) {
          showPosters[e.showTitle] = e.poster;
        }
      }
    }
    const topShows = Object.entries(showCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([title, count]) => ({ title, count, poster: showPosters[title] }));

    const genreCounts = {};
    for (const e of yearEvents) {
      for (const g of (e.genres || [])) {
        genreCounts[g] = (genreCounts[g] || 0) + 1;
      }
    }

    return { movies, episodes, totalHours, topShows, genreCounts };
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
          <div className="text-zinc-400 text-sm">Watch Time <span className="text-zinc-500">({formatDaysHours(yearData.totalHours)})</span></div>
        </div>
      </div>

      {yearData.topShows.length > 0 && (
        <div className="mb-6">
          <h4 className="text-sm font-semibold text-zinc-300 uppercase tracking-wide mb-3">Top Shows</h4>
          <div className="space-y-2">
            {yearData.topShows.map((show, i) => (
              <button
                key={show.title}
                onClick={() => onOpenSeries({ type: 'episode', traktId: yearData.episodes.find(e => e.showTitle === show.title)?.traktId, title: show.title, poster: show.poster, genres: [] })}
                className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-zinc-800/50 transition-all cursor-pointer text-left"
              >
                <div className="flex items-center gap-3">
                  <span className="text-zinc-500 text-sm w-5">{i + 1}</span>
                  <div className="w-8 h-12 rounded overflow-hidden bg-zinc-700 shrink-0">
                    {show.poster ? (
                      <img src={show.poster} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-zinc-400 text-xs font-bold">
                        {show.title.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <span className="text-zinc-300 text-sm">{show.title}</span>
                </div>
                <span className="text-zinc-500 text-sm">{show.count} episodes</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {Object.keys(yearData.genreCounts).length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-zinc-300 uppercase tracking-wide mb-3">Top Genres</h4>
          <GenreChart genreDistribution={yearData.genreCounts} onGenreClick={onGenreClick} />
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
