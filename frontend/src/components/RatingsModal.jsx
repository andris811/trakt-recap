import { useState, useMemo } from 'react';
import { proxyPoster } from '../utils';

function PosterFallback({ title }) {
  const initial = title ? title.charAt(0).toUpperCase() : '?';
  const colors = ['bg-emerald-800', 'bg-violet-800', 'bg-amber-800', 'bg-blue-800', 'bg-rose-800'];
  const colorIndex = title ? title.charCodeAt(0) % colors.length : 0;
  return (
    <div className={`w-full h-full ${colors[colorIndex]} flex items-center justify-center text-zinc-400 font-bold text-sm`}>
      {initial}
    </div>
  );
}

function PosterImage({ src, title }) {
  const [failed, setFailed] = useState(false);
  const proxiedSrc = proxyPoster(src);

  if (!proxiedSrc || failed) {
    return <PosterFallback title={title} />;
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

function RatingsModal({ rating, stats, onClose, onItemClick, onOpenSeries }) {
  const ratedItems = useMemo(() => {
    const items = stats?.personalBehavior?.ratedItemsByRating?.[rating] || [];
    return [...items].sort((a, b) => {
      const titleA = (a.title || '').toLowerCase();
      const titleB = (b.title || '').toLowerCase();
      return titleA.localeCompare(titleB);
    });
  }, [rating, stats]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-800 w-full max-w-2xl max-h-[80vh] flex flex-col mx-2 sm:mx-0">
        <div className="p-4 sm:p-6 border-b border-zinc-800">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <h2 className="text-lg sm:text-xl font-bold text-white">Rated &#9733; {rating}</h2>
              <p className="text-zinc-400 text-xs sm:text-sm mt-1">
                {ratedItems.length} titles
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-zinc-400 hover:text-white hover:scale-110 text-2xl leading-none transition-all cursor-pointer shrink-0"
            >
              &times;
            </button>
          </div>
        </div>

        <div className="overflow-y-auto flex-1 p-3 sm:p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
             {ratedItems.map((item, idx) => (
              <div
                key={`${item.type}_${item.traktId}_${idx}`}
                onClick={() => {
                  onClose();
                  onOpenSeries({
                    type: item.type,
                    traktId: item.traktId,
                    title: item.title,
                    poster: item.poster,
                    genres: item.genres || []
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
                    &#9733; {item.rating}
                  </div>
                </div>
                <span className={`px-2 py-0.5 rounded text-xs shrink-0 ${
                  item.type === 'movie'
                    ? 'bg-emerald-900/50 text-emerald-400'
                    : 'bg-violet-900/50 text-violet-400'
                }`}>
                  {item.type === 'movie' ? 'Movie' : 'Show'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default RatingsModal;
