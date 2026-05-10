function normalizeHistory(rawHistory) {
  return rawHistory.map((item) => {
    const isMovie = item.movie !== undefined;
    const media = isMovie ? item.movie : item.show;

    const event = {
      id: String(item.id),
      watchedAt: item.watched_at,
      type: isMovie ? 'movie' : 'episode',
      title: isMovie ? media.title : item.show.title,
      traktId: media.ids.trakt,
      runtime: media.runtime || 0,
      genres: media.genres || [],
      poster: null,
      rating: item.rating || undefined
    };

    if (!isMovie) {
      const ep = item.episode;
      event.showTitle = item.show.title;
      event.season = ep ? ep.season : undefined;
      event.episode = ep ? ep.number : undefined;
      event.title = ep
        ? `S${String(ep.season).padStart(2, '0')}E${String(ep.number).padStart(2, '0')} - ${ep.title || ''}`.trim()
        : item.show.title;
    }

    return event;
  });
}

function contentKey(event) {
  if (event.type === 'movie') return `movie_${event.traktId}`;
  return `episode_${event.traktId}_${event.season}_${event.episode}`;
}

function deduplicateEvents(events, windowHours = 72) {
  const windowMs = windowHours * 60 * 60 * 1000;
  const groups = {};

  for (const e of events) {
    const key = contentKey(e);
    if (!groups[key]) groups[key] = [];
    groups[key].push(e);
  }

  const kept = [];
  for (const key of Object.keys(groups)) {
    const sorted = groups[key].sort((a, b) => new Date(a.watchedAt) - new Date(b.watchedAt));
    let lastKept = null;
    for (const e of sorted) {
      if (!lastKept || new Date(e.watchedAt) - new Date(lastKept.watchedAt) > windowMs) {
        kept.push(e);
        lastKept = e;
      }
    }
  }

  return kept.sort((a, b) => new Date(b.watchedAt) - new Date(a.watchedAt));
}

module.exports = { normalizeHistory, deduplicateEvents };
