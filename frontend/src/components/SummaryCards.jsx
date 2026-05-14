import { useState } from 'react';
import { proxyPoster, formatDuration } from '../utils';

function PosterImage({ src, title }) {
  const [failed, setFailed] = useState(false);
  const proxiedSrc = proxyPoster(src);

  if (!proxiedSrc || failed) {
    const initial = title ? title.charAt(0).toUpperCase() : '?';
    const colors = ['bg-emerald-800', 'bg-violet-800', 'bg-amber-800', 'bg-blue-800', 'bg-rose-800'];
    const colorIndex = title ? title.charCodeAt(0) % colors.length : 0;
    return (
      <div className={`w-full h-full ${colors[colorIndex]} flex items-center justify-center text-zinc-400 font-bold text-sm`}>
        {initial}
      </div>
    );
  }

  return (
    <img
      src={proxiedSrc}
      alt=""
      className="w-full h-full object-cover"
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}

function SummaryCards({ stats, onShowClick }) {
  const { totalMovies, totalEpisodes, totalWatchTimeHours } = stats.coreStats;
  const { topShows } = stats.contentInsights;
  const { movieVsTvRatio } = stats.contentInsights;
  const topShow = topShows?.[0];

  const days = Math.floor(totalWatchTimeHours / 24);
  const hours = Math.floor(totalWatchTimeHours % 24);
  const minutes = Math.round((totalWatchTimeHours % 1) * 60);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <div className="bg-zinc-900 rounded-xl p-6 shadow-lg border border-zinc-800 hover:border-zinc-700 transition-all hover:shadow-emerald-500/5">
        <div className="text-2xl mb-2">⏱️</div>
        <div className="text-4xl font-bold text-white">{days}d {hours}h {minutes}m</div>
        <div className="text-zinc-500 text-xs mt-1">{formatDuration(totalWatchTimeHours)} total</div>
        <div className="text-zinc-400 text-sm mt-0.5">Watch Time</div>
      </div>

      <div className="bg-zinc-900 rounded-xl p-6 shadow-lg border border-zinc-800 hover:border-zinc-700 transition-all hover:shadow-emerald-500/5">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-2xl">🎬</span>
          <span className="text-sm font-medium text-zinc-300">Total Watched</span>
        </div>
        <div className="text-2xl sm:text-3xl font-bold text-white">{totalMovies + totalEpisodes}</div>
        <div className="text-zinc-400 text-xs sm:text-sm mt-1">{totalMovies} movies · {totalEpisodes} episodes</div>
        <div className="mt-3 flex items-center gap-3">
          <div className="flex-1">
            <div className="text-sm font-bold text-emerald-400">{movieVsTvRatio.movies}% movies</div>
          </div>
          <div className="flex-1">
            <div className="text-sm font-bold text-violet-400">{movieVsTvRatio.episodes}% episodes</div>
          </div>
        </div>
        <div className="mt-2 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-emerald-500 rounded-full"
            style={{ width: `${movieVsTvRatio.movies}%` }}
          />
        </div>
      </div>

      {topShow && (
        <div
          className="bg-zinc-900 rounded-xl p-6 shadow-lg border border-zinc-800 hover:border-zinc-700 transition-all hover:shadow-emerald-500/5 cursor-pointer"
          onClick={() => onShowClick && onShowClick(topShow)}
        >
          <div className="flex items-center gap-2 mb-3">
            <span className="text-2xl">📺</span>
            <span className="text-sm font-medium text-zinc-300">Most Watched Series</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="w-12 h-16 rounded overflow-hidden bg-zinc-700 shrink-0">
              <PosterImage src={topShow.poster} title={topShow.title} />
            </div>
            <div>
              <div className="text-lg font-bold text-white">{topShow.title}</div>
              <div className="text-zinc-400 text-sm">{topShow.count} episodes watched</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default SummaryCards;
