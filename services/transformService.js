function normalizeHistory(rawHistory) {
  return rawHistory.map((item) => {
    const isMovie = item.movie !== undefined;
    const media = isMovie ? item.movie : item.show;

    const event = {
      id: `${isMovie ? 'm' : 'e'}-${media.ids.trakt}-${item.watched_at}`,
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

module.exports = { normalizeHistory };
