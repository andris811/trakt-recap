import { useMemo } from 'react';
import { proxyPoster, formatDurationFromMinutes } from '../utils';

function PosterImage({ src, title }) {
  const proxiedSrc = proxyPoster(src);
  if (!proxiedSrc) return (
    <div className="w-full h-full flex items-center justify-center text-zinc-400 text-xs font-bold">
      {title?.charAt(0).toUpperCase()}
    </div>
  );
  return <img src={proxiedSrc} alt="" className="w-full h-full object-cover" loading="lazy" />;
}

function RatingModal({ rating, events, onClose, onOpenSeries }) {
  const ratedEvents = useMemo(() => {
    // Filter events that have this exact rating
    const filtered = events.filter((e) => e.rating === rating);
    
    // Group by content (movie or show for episodes)
    const grouped = new Map();
    
    for (const event of filtered) {
      const key = event.type === 'movie'
        ? `movie_${event.traktId}`
        : `show_${event.traktId}`;
      
      if (!grouped.has(key)) {
        grouped.set(key, {
          id: key,
          traktId: event.traktId,
          type: event.type,
          title: event.showTitle || event.title,
          poster: event.poster,
          genres: event.genres,
          watchCount: 0,
          totalRuntime: 0,
          rating: rating
        });
      }
      
      const item = grouped.get(key);
      item.watchCount++;
      const runtime = event.type === 'movie' ? (event.runtime || 0) : (event.runtime || 30);
      item.totalRuntime += runtime;
    }
    
    return [...grouped.values()].sort((a, b) => b.watchCount - a.watchCount);
  }, [rating, events]);
  
  const totalWatches = ratedEvents.reduce((sum, e) => sum + e.watchCount, 0);
  const totalMinutes = ratedEvents.reduce((sum, e) => sum + e.totalRuntime, 0);
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-800 w-full max-w-2xl max-h-[80vh] flex flex-col">
        <div className="p-6 border-b border-zinc-800">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-white">{rating} Stars</h2>
              <p className="text-zinc-400 text-sm mt-1">
                {ratedEvents.length} titles &middot; {totalWatches} watches &middot; {formatDurationFromMinutes(totalMinutes)}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-zinc-400 hover:text-white hover:scale-110 text-2xl leading-none transition-all cursor-pointer"
            >
              &times;
            </button>
          </div>
        </div>
        
        <div className="overflow-y-auto flex-1 p-4">
          {ratedEvents.length === 0 ? (
            <p className="text-zinc-500 text-center py-8">No items rated {rating} stars</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {ratedEvents.map((item) => (
                <div
                  key={item.id}
                  onClick={() => {
                    onClose();
                    onOpenSeries({
                      type: item.type,
                      traktId: item.traktId,
                      title: item.title,
                      poster: item.poster,
                      genres: item.genres
                    });
                  }}
                  className="flex items-center gap-3 p-3 rounded-lg bg-zinc-800/50 hover:bg-zinc-800 transition-all cursor-pointer group"
                >
                  <div className="w-10 h-14 rounded overflow-hidden bg-zinc-700 shrink-0">
                    <PosterImage src={item.poster} title={item.title} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-white font-medium truncate group-hover:text-emerald-400 transition-colors">
                      {item.title}
                    </div>
                    <div className="text-zinc-500 text-sm">
                      {item.watchCount} {item.watchCount === 1 ? 'watch' : 'watches'} &middot; {formatDurationFromMinutes(item.totalRuntime)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default RatingModal;
