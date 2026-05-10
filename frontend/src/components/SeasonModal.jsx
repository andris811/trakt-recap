import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';

export default function SeasonModal({ showId, showTitle, season, episodes, watchedEpisodes, onClose, onOpenEpisode }) {
  const [epDetails, setEpDetails] = useState({});
  const [loading, setLoading] = useState(true);

  const watchedSet = useMemo(() => new Set(watchedEpisodes.map(e => `${e.season}x${e.episode}`)), [watchedEpisodes]);

  useEffect(() => {
    const fetchAll = async () => {
      const details = {};
      await Promise.all(
        episodes.map(async (ep) => {
          try {
            const res = await axios.get(`/api/events/episode/${showId}/${season.number}/${ep.number}`);
            details[ep.number] = res.data;
          } catch {
            details[ep.number] = null;
          }
        })
      );
      setEpDetails(details);
      setLoading(false);
    };
    fetchAll();
  }, [showId, season.number, episodes]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-800 w-full max-w-lg max-h-[80vh] flex flex-col">
        <div className="p-6 border-b border-zinc-800">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-white">{showTitle}</h2>
              <p className="text-zinc-400 text-sm mt-1">Season {season.number} &middot; {episodes.length} episodes</p>
            </div>
            <button onClick={onClose} className="text-zinc-400 hover:text-white hover:scale-110 text-2xl leading-none transition-all cursor-pointer">&times;</button>
          </div>
        </div>
        <div className="overflow-y-auto flex-1 p-4">
          {loading ? (
            <div className="text-zinc-500 text-sm text-center py-8">Loading episodes...</div>
          ) : (
            <div className="space-y-2">
              {episodes.map((ep) => {
                const isWatched = watchedSet.has(`${season.number}x${ep.number}`);
                const detail = epDetails[ep.number];
                return (
                  <button
                    key={ep.number}
                    onClick={() => {
                      onClose();
                      onOpenEpisode({ type: 'episode', traktId: showId, showTitle, title: ep.title, season: season.number, episode: ep.number, poster: null, genres: [] });
                    }}
                    className="w-full flex items-center gap-3 p-3 rounded-lg bg-zinc-800/50 hover:bg-zinc-800 hover:translate-x-1 transition-all cursor-pointer group"
                  >
                    <div className={`w-6 h-6 rounded-full shrink-0 flex items-center justify-center transition-colors ${isWatched ? 'bg-emerald-500' : 'bg-zinc-700 group-hover:bg-zinc-600'}`}>
                      {isWatched && <span className="text-white text-xs">&#10003;</span>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-zinc-300 text-sm font-medium truncate group-hover:text-white transition-colors">E{ep.number} - {ep.title}</div>
                      <div className="text-zinc-500 text-xs group-hover:text-zinc-400 transition-colors">
                        {ep.runtime}m
                        {detail?.rating && <span className="ml-2 text-amber-400">&#9733; {detail.rating.toFixed(1)}</span>}
                      </div>
                    </div>
                    <span className="text-zinc-600 group-hover:text-zinc-400 transition-colors text-sm opacity-0 group-hover:opacity-100">&rarr;</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
