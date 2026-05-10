import { useMemo, useState, useEffect } from 'react';
import axios from 'axios';
import { proxyPoster } from '../utils';

const scrollbarStyles = `
  .custom-scrollbar::-webkit-scrollbar {
    height: 6px;
  }
  .custom-scrollbar::-webkit-scrollbar-track {
    background: #27272a;
    border-radius: 3px;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: #4c1f7a;
    border-radius: 3px;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background: #6d28d9;
  }
`;

function ShowCard({ show, progress, onClick }) {
  const [failed, setFailed] = useState(false);
  const initial = show.title ? show.title.charAt(0).toUpperCase() : '?';

  return (
    <button
      onClick={() => onClick(show)}
      className="shrink-0 w-36 flex flex-col items-center gap-3 p-4 rounded-xl bg-gradient-to-b from-zinc-800/80 to-zinc-900/80 hover:from-zinc-700/80 hover:to-zinc-800/80 transition-all cursor-pointer border border-zinc-700/50 hover:border-violet-500/30"
    >
      <div className="w-32 h-44 rounded-xl overflow-hidden bg-zinc-700 shadow-lg shadow-black/50">
        {!failed && show.poster ? (
          <img src={proxyPoster(show.poster)} alt="" className="w-full h-full object-cover" loading="lazy" onError={() => setFailed(true)} />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-zinc-400 text-3xl font-bold bg-gradient-to-br from-zinc-700 to-zinc-800">
            {initial}
          </div>
        )}
      </div>
      <div className="w-full text-center">
        <div className="text-white text-sm font-semibold truncate">{show.title}</div>
        {progress && progress.totalEpisodes > 0 ? (
          <div className="mt-2">
            <div className="text-zinc-400 text-xs mb-1.5">
              {progress.left === 0 ? (
                <span className="text-emerald-400">✓ Completed</span>
              ) : (
                <span>{progress.left} episode{progress.left !== 1 ? 's' : ''} left</span>
              )}
            </div>
            <div className="w-full h-1.5 bg-zinc-800/80 rounded-full overflow-hidden backdrop-blur-sm">
              <div
                className="h-full bg-gradient-to-r from-violet-500 via-purple-500 to-fuchsia-500 rounded-full transition-all duration-700 ease-out shadow-lg shadow-violet-500/20"
                style={{ width: `${Math.min(progress.percentage, 100)}%` }}
              />
            </div>
            <div className="text-zinc-500 text-xs mt-1">
              {progress.watchedEpisodes}/{progress.totalEpisodes}
            </div>
          </div>
        ) : (
          <div className="text-zinc-500 text-xs mt-2">Loading...</div>
        )}
      </div>
    </button>
  );
}

export default function ProgressCard({ events, onOpenSeries }) {
  const recentShows = useMemo(() => {
    const seen = new Set();
    const shows = [];
    for (const e of events) {
      if (e.type === 'episode' && e.traktId && !seen.has(e.traktId)) {
        seen.add(e.traktId);
        shows.push({
          traktId: e.traktId,
          title: e.showTitle,
          poster: e.poster,
        });
      }
      if (shows.length >= 10) break;
    }
    return shows;
  }, [events]);

  const [progressData, setProgressData] = useState({});

  useEffect(() => {
    const fetchProgress = async () => {
      const data = {};
      for (const show of recentShows) {
        try {
          const res = await axios.get(`/api/events/seasons/${show.traktId}`);
          const seasons = res.data.seasons || [];
          const totalEpisodes = seasons.reduce((sum, s) => sum + s.episodeCount, 0);
          const watchedSet = new Set();
          for (const e of events) {
            if (e.traktId === show.traktId && e.type === 'episode' && e.season > 0) {
              watchedSet.add(`${e.season}x${e.episode}`);
            }
          }
          const watchedEpisodes = watchedSet.size;
          data[show.traktId] = {
            totalEpisodes,
            watchedEpisodes,
            left: totalEpisodes - watchedEpisodes,
            percentage: totalEpisodes > 0 ? (watchedEpisodes / totalEpisodes) * 100 : 0
          };
        } catch {
          data[show.traktId] = { totalEpisodes: 0, watchedEpisodes: 0, left: 0, percentage: 0 };
        }
      }
      setProgressData(data);
    };
    if (recentShows.length > 0) fetchProgress();
  }, [recentShows, events]);

  if (recentShows.length === 0) return null;

  return (
    <div className="bg-zinc-900 rounded-xl p-6 shadow-lg border border-zinc-800">
      <style>{scrollbarStyles}</style>
      <h3 className="text-lg font-semibold text-white mb-4">Recent Shows Progress</h3>
      <div className="flex gap-4 overflow-x-auto pb-4 custom-scrollbar" style={{ scrollbarWidth: 'thin', scrollbarColor: '#4c1f7a #27272a' }}>
        {recentShows.map(show => (
          <ShowCard
            key={show.traktId}
            show={show}
            progress={progressData[show.traktId]}
            onClick={() => onOpenSeries({ type: 'episode', traktId: show.traktId, title: show.title, poster: show.poster, genres: [] })}
          />
        ))}
      </div>
    </div>
  );
}
