import { useMemo, useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { formatDuration, formatDurationFromMinutes } from '../utils';

export default function EpisodeModal({ item, events, onClose, onOpenSeries, onNavigateEpisode }) {
  const [epDetails, setEpDetails] = useState(null);
  const [loadingEp, setLoadingEp] = useState(true);
  const [visibleComments, setVisibleComments] = useState(10);
  const [seasonEpisodes, setSeasonEpisodes] = useState([]);
  const [loadingSeason, setLoadingSeason] = useState(true);

  useEffect(() => {
    setVisibleComments(10);
    axios.get(`/api/events/episode/${item.traktId}/${item.season}/${item.episode}`)
      .then(res => { setEpDetails(res.data); setLoadingEp(false); })
      .catch(() => setLoadingEp(false));

    axios.get(`/api/events/season/${item.traktId}/${item.season}`)
      .then(res => { setSeasonEpisodes(res.data.episodes || []); setLoadingSeason(false); })
      .catch(() => setLoadingSeason(false));
  }, [item.traktId, item.season, item.episode]);

  const userStats = useMemo(() => {
    const filtered = events.filter(
      e => e.traktId === item.traktId && e.type === 'episode' && e.season === item.season && e.episode === item.episode
    );
    const totalWatches = filtered.length;
    const totalRuntime = filtered.reduce((sum, e) => sum + (e.runtime || 0), 0);
    const totalHours = totalRuntime / 60;
    const rated = filtered.find(e => e.rating != null);
    const userRating = rated ? rated.rating : null;
    const sorted = [...filtered].sort((a, b) => new Date(a.watchedAt) - new Date(b.watchedAt));
    const firstWatch = sorted.length > 0 ? sorted[0].watchedAt : null;
    const lastWatch = sorted.length > 0 ? sorted[sorted.length - 1].watchedAt : null;
    const runtime = filtered[0]?.runtime || 0;
    return { totalWatches, totalHours, userRating, firstWatch, lastWatch, runtime };
  }, [events, item.traktId, item.season, item.episode]);

  const { totalWatches, totalHours, userRating, firstWatch, lastWatch, runtime } = userStats;
  const airDate = epDetails?.firstAired ? new Date(epDetails.firstAired).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : null;

  const currentIndex = seasonEpisodes.findIndex(ep => ep.number === item.episode);
  const prevEp = currentIndex > 0 ? seasonEpisodes[currentIndex - 1] : null;
  const nextEp = currentIndex < seasonEpisodes.length - 1 ? seasonEpisodes[currentIndex + 1] : null;

  const navigate = useCallback((direction) => {
    const target = direction === 'prev' ? prevEp : nextEp;
    if (target && onNavigateEpisode) {
      onNavigateEpisode({
        ...item,
        episode: target.number,
        title: target.title
      });
    }
  }, [prevEp, nextEp, item, onNavigateEpisode]);

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'ArrowLeft') navigate('prev');
      if (e.key === 'ArrowRight') navigate('next');
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [navigate]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="max-w-lg max-h-[90vh] flex flex-col bg-zinc-900 rounded-2xl border border-zinc-800 w-full" onClick={e => e.stopPropagation()}>
        <div className="relative h-48 bg-zinc-800">
          {epDetails?.screenshot ? (
            <img src={epDetails.screenshot} alt="" className="w-full h-full object-cover" />
          ) : null}
          <div className="absolute inset-0 bg-gradient-to-t from-zinc-900 via-zinc-900/60 to-transparent" />
          <button onClick={onClose} className="absolute top-3 right-3 text-zinc-400 hover:text-white hover:scale-110 transition-all cursor-pointer">&times;</button>
          <div className="absolute bottom-4 left-6 right-6">
            <p className="text-zinc-400 text-sm">{item.showTitle}</p>
            <h2 className="text-zinc-100 text-xl font-semibold">S{item.season}E{item.episode} - {item.title}</h2>
          </div>
        </div>

        <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-800">
          <button
            onClick={() => navigate('prev')}
            disabled={!prevEp}
            className="flex items-center gap-1 text-sm text-zinc-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer hover:scale-105"
          >
            &larr; Prev
          </button>
          <span className="text-zinc-500 text-xs">
            {loadingSeason ? '...' : `${item.episode} / ${seasonEpisodes.length}`}
          </span>
          <button
            onClick={() => navigate('next')}
            disabled={!nextEp}
            className="flex items-center gap-1 text-sm text-zinc-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer hover:scale-105"
          >
            Next &rarr;
          </button>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          <button onClick={() => onOpenSeries({ type: 'episode', traktId: item.traktId, title: item.showTitle, poster: item.poster, genres: item.genres || [] })} className="text-emerald-400 hover:text-emerald-300 hover:underline text-sm transition-all cursor-pointer">
            View {item.showTitle} details &rarr;
          </button>

          <div className="bg-zinc-800/50 rounded-lg p-4 space-y-3">
            <div className="flex justify-between">
              <span className="text-zinc-500 text-sm">Episode</span>
              <span className="text-zinc-300 text-sm">S{item.season}E{item.episode}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500 text-sm">Runtime</span>
              <span className="text-zinc-300 text-sm">{formatDurationFromMinutes(runtime)}</span>
            </div>
            {airDate && (
              <div className="flex justify-between">
                <span className="text-zinc-500 text-sm">Air date</span>
                <span className="text-zinc-300 text-sm">{airDate}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-zinc-500 text-sm">Watched</span>
              <span className="text-zinc-300 text-sm">{totalWatches} time{totalWatches !== 1 ? 's' : ''}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500 text-sm">Watch time</span>
              <span className="text-zinc-300 text-sm">{formatDuration(totalHours)}</span>
            </div>
            {userRating != null && (
              <div className="flex justify-between">
                <span className="text-zinc-500 text-sm">Your rating</span>
                <span className="text-amber-400 text-sm">&#9733; {userRating}</span>
              </div>
            )}
            {epDetails?.rating != null && (
              <div className="flex justify-between">
                <span className="text-zinc-500 text-sm">Trakt rating</span>
                <span className="text-zinc-300 text-sm">{epDetails.rating.toFixed(1)} ({epDetails.votes?.toLocaleString()} votes)</span>
              </div>
            )}
            {firstWatch && (
              <div className="flex justify-between">
                <span className="text-zinc-500 text-sm">First watched</span>
                <span className="text-zinc-300 text-sm">{new Date(firstWatch).toLocaleDateString()}</span>
              </div>
            )}
            {lastWatch && (
              <div className="flex justify-between">
                <span className="text-zinc-500 text-sm">Last watched</span>
                <span className="text-zinc-300 text-sm">{new Date(lastWatch).toLocaleDateString()}</span>
              </div>
            )}
          </div>

          {!loadingEp && epDetails?.overview && (
            <div>
              <div className="text-zinc-500 text-sm mb-2">Overview</div>
              <p className="text-zinc-300 text-sm leading-relaxed">{epDetails.overview}</p>
            </div>
          )}

          {!loadingEp && (epDetails.commentCount || 0) > 0 && (
            <div>
              <div className="text-zinc-500 text-sm mb-3">Comments ({epDetails.commentCount || 0})</div>
              <div className="space-y-3">
                {(epDetails.comments || []).slice(0, visibleComments).map((comment) => (
                  <div key={comment.id} className="bg-zinc-800/50 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-zinc-300 text-sm font-medium">{comment.user.name || comment.user.username}</span>
                      <div className="flex items-center gap-2">
                        {comment.user_rating && <span className="text-amber-400 text-xs">&#9733; {comment.user_rating}</span>}
                        <span className="text-zinc-500 text-xs">{new Date(comment.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <p className="text-zinc-400 text-sm">{comment.comment}</p>
                  </div>
                ))}
              </div>
              {visibleComments < (epDetails.comments?.length || 0) && (
                <button
                  onClick={() => setVisibleComments(c => c + 10)}
                  className="w-full mt-4 py-2 text-sm text-zinc-400 hover:text-white bg-zinc-800/50 hover:bg-zinc-800 rounded-lg transition-all cursor-pointer hover:scale-[1.02]"
                >
                  Show 10 more
                </button>
              )}
            </div>
          )}

          <div className="flex justify-center">
            <span className="bg-violet-900/50 text-violet-400 text-xs px-3 py-1 rounded-full">Episode</span>
          </div>
        </div>
      </div>
    </div>
  );
}
