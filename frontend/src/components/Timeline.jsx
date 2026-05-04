import { useState } from 'react';
import { proxyPoster } from '../utils';

const VISIBLE_COUNT = 20;

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

function PosterImage({ src, alt, title }) {
  const [failed, setFailed] = useState(false);
  const proxiedSrc = proxyPoster(src);

  if (!proxiedSrc || failed) {
    return <PosterFallback title={title} />;
  }

  return (
    <img
      src={proxiedSrc}
      alt={alt}
      className="w-full h-full object-cover"
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}

function Timeline({ timeline, events, onItemClick }) {
  const [visibleCount, setVisibleCount] = useState(VISIBLE_COUNT);

  if (timeline.length === 0) {
    return (
      <div className="bg-zinc-900 rounded-xl p-6 shadow-lg border border-zinc-800">
        <h3 className="text-lg font-semibold text-white mb-4">Recent Activity</h3>
        <p className="text-zinc-500">No activity yet</p>
      </div>
    );
  }

  const eventsMap = new Map();
  for (const e of events) {
    if (!eventsMap.has(e.id)) {
      eventsMap.set(e.id, e);
    }
  }

  const visibleItems = timeline.slice(0, visibleCount);
  const hasMore = visibleCount < timeline.length;

  return (
    <div className="bg-zinc-900 rounded-xl p-6 shadow-lg border border-zinc-800">
      <h3 className="text-lg font-semibold text-white mb-4">Recent Activity</h3>
      <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2">
        {visibleItems.map((event) => {
          const fullEvent = eventsMap.get(event.id) || event;
          const date = new Date(event.watchedAt);
          const dateStr = date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
          });

          const displayName = fullEvent.showTitle
            ? `${fullEvent.showTitle} - ${fullEvent.title}`
            : fullEvent.title;

          return (
            <div
              key={event.id}
              onClick={() => onItemClick(fullEvent)}
              className="flex items-center gap-3 p-2 rounded-lg bg-zinc-800/50 hover:bg-zinc-800 transition-all cursor-pointer group"
            >
              <div className="w-10 h-14 rounded overflow-hidden bg-zinc-700 shrink-0">
                <PosterImage src={fullEvent.poster} alt="" title={fullEvent.showTitle || fullEvent.title} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-white font-medium truncate group-hover:text-emerald-400 transition-colors">
                  {displayName}
                </div>
                <div className="text-zinc-500 text-sm">{dateStr}</div>
              </div>
              <span
                className={`px-2 py-1 rounded text-xs font-medium shrink-0 ${
                  event.type === 'movie'
                    ? 'bg-emerald-900/50 text-emerald-400'
                    : 'bg-violet-900/50 text-violet-400'
                }`}
              >
                {event.type === 'movie' ? 'Movie' : 'Episode'}
              </span>
            </div>
          );
        })}
      </div>

      {hasMore && (
        <button
          onClick={() => setVisibleCount((c) => c + VISIBLE_COUNT)}
          className="w-full mt-4 py-2 text-sm text-zinc-400 hover:text-white bg-zinc-800/50 hover:bg-zinc-800 rounded-lg transition-colors"
        >
          Load more ({timeline.length - visibleCount} remaining)
        </button>
      )}
    </div>
  );
}

export default Timeline;
