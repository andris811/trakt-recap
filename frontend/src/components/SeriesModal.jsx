import { useMemo, useState, useEffect } from 'react';
import axios from 'axios';
import { proxyPoster, formatDuration } from '../utils';
import SeasonModal from './SeasonModal';

function ActorHeadshot({ src, name }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    const initial = name ? name.charAt(0).toUpperCase() : '?';
    return (
      <div className="w-12 h-12 rounded-full bg-zinc-700 flex items-center justify-center text-zinc-400 font-bold text-sm shrink-0">
        {initial}
      </div>
    );
  }
  return (
    <img src={src} alt="" className="w-12 h-12 rounded-full object-cover shrink-0" loading="lazy" onError={() => setFailed(true)} />
  );
}

const COUNTRY_NAMES = {
  us: 'United States', gb: 'United Kingdom', ca: 'Canada', au: 'Australia',
  de: 'Germany', fr: 'France', jp: 'Japan', kr: 'South Korea', cn: 'China',
  es: 'Spain', it: 'Italy', br: 'Brazil', mx: 'Mexico', in: 'India',
  se: 'Sweden', no: 'Norway', dk: 'Denmark', nl: 'Netherlands', be: 'Belgium',
  ru: 'Russia', pl: 'Poland', tr: 'Turkey', th: 'Thailand', ph: 'Philippines'
};

function PosterFallback({ title }) {
  const initial = title ? title.charAt(0).toUpperCase() : '?';
  const colors = ['bg-emerald-800', 'bg-violet-800', 'bg-amber-800', 'bg-blue-800', 'bg-rose-800'];
  const colorIndex = title ? title.charCodeAt(0) % colors.length : 0;
  return (
    <div className={`w-full h-full ${colors[colorIndex]} flex items-center justify-center text-zinc-400 font-bold text-lg`}>
      {initial}
    </div>
  );
}

function PosterImage({ src, title }) {
  const [failed, setFailed] = useState(false);
  const proxiedSrc = proxyPoster(src);
  if (!proxiedSrc || failed) return <PosterFallback title={title} />;
  return (
    <img src={proxiedSrc} alt="" className="w-full h-full object-cover" loading="lazy" onError={() => setFailed(true)} />
  );
}

function ContentInfo({ contentDetails, loadingDetails, itemType, traktId }) {
  const [visibleCount, setVisibleCount] = useState(10);

  if (loadingDetails || !contentDetails) return null;
  const countryName = contentDetails.country ? (COUNTRY_NAMES[contentDetails.country] || contentDetails.country.toUpperCase()) : null;
  const releaseDate = contentDetails.released ? new Date(contentDetails.released).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : null;

  const allComments = contentDetails.comments || [];
  const totalComments = contentDetails.commentCount || 0;
  const visibleComments = allComments.slice(0, visibleCount);
  const hasMore = visibleCount < allComments.length;

  return (
    <>
      {(countryName || releaseDate || contentDetails.traktRating) && (
        <div className="border-t border-zinc-800 pt-4 space-y-3">
          <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-wide">Info</h3>
          {releaseDate && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-zinc-500">{itemType === 'movie' ? 'Released' : 'First Aired'}</span>
              <span className="text-zinc-300">{releaseDate}</span>
            </div>
          )}
          {countryName && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-zinc-500">Country</span>
              <span className="text-zinc-300">{countryName}</span>
            </div>
          )}
          {contentDetails.traktRating && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-zinc-500">Trakt Rating</span>
              <span className="text-zinc-300">{contentDetails.traktRating.toFixed(1)} ({contentDetails.traktVotes?.toLocaleString()} votes)</span>
            </div>
          )}
          {contentDetails.imdbId && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-zinc-500">IMDb</span>
              <a href={`https://www.imdb.com/title/${contentDetails.imdbId}/`} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 transition-colors">
                {contentDetails.imdbId}
              </a>
            </div>
          )}
        </div>
      )}
      {contentDetails.overview && (
        <div>
          <div className="text-zinc-500 text-sm mb-2">Overview</div>
          <p className="text-zinc-300 text-sm leading-relaxed">{contentDetails.overview}</p>
        </div>
      )}
      {totalComments > 0 && (
        <div>
          <div className="text-zinc-500 text-sm mb-3">Comments ({totalComments})</div>
          <div className="space-y-3">
            {visibleComments.map((comment) => (
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
          {hasMore && (
            <button
              onClick={() => setVisibleCount(c => c + 10)}
              className="w-full mt-4 py-2 text-sm text-zinc-400 hover:text-white bg-zinc-800/50 hover:bg-zinc-800 rounded-lg transition-all cursor-pointer hover:scale-[1.02]"
            >
              Show 10 more
            </button>
          )}
        </div>
      )}
    </>
  );
}

export default function SeriesModal({ item, events, showRatings, onClose, onOpenEpisode, onOpenActor }) {
  const [contentDetails, setContentDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(true);
  const [seasons, setSeasons] = useState([]);
  const [loadingSeasons, setLoadingSeasons] = useState(true);
  const [seasonEpisodes, setSeasonEpisodes] = useState({});
  const [selectedSeason, setSelectedSeason] = useState(null);
  const [cast, setCast] = useState([]);
  const [loadingCast, setLoadingCast] = useState(true);

  useEffect(() => {
    const contentType = item.type === 'episode' ? 'show' : item.type;
    axios.get(`/api/events/content/${contentType}/${item.traktId}`)
      .then(res => { setContentDetails(res.data); setLoadingDetails(false); })
      .catch(() => setLoadingDetails(false));

    if (item.type !== 'movie') {
      axios.get(`/api/events/seasons/${item.traktId}`)
        .then(res => { setSeasons(res.data.seasons || []); setLoadingSeasons(false); })
        .catch(() => setLoadingSeasons(false));
    }

    axios.get(`/api/events/content/${contentType}/${item.traktId}/people`)
      .then(res => { setCast(res.data.cast || []); setLoadingCast(false); })
      .catch(() => setLoadingCast(false));
  }, [item.traktId, item.type]);

  const seriesStats = useMemo(() => {
    const relatedEvents = events.filter((e) => e.traktId === item.traktId);
    const totalWatches = relatedEvents.length;
    
    // Calculate total runtime: use episode runtime, or default 30 min per episode
    let totalRuntime = relatedEvents.reduce((sum, e) => sum + (e.runtime || 0), 0);
    if (totalRuntime === 0) {
      totalRuntime = relatedEvents.length * 30; // Default 30 min per episode
    }
    
    const totalHours = totalRuntime / 60;
    const sorted = [...relatedEvents].sort((a, b) => new Date(a.watchedAt) - new Date(b.watchedAt));
    const firstWatch = sorted[0];
    const lastWatch = sorted[sorted.length - 1];
    const seasons = new Set();
    for (const e of relatedEvents) { if (e.season !== undefined) seasons.add(e.season); }
    const showRating = showRatings[String(item.traktId)];
    const genres = item.genres?.length ? item.genres : (contentDetails?.genres || []);
    return { totalWatches, totalHours, showRating: showRating || null, firstWatch: firstWatch ? new Date(firstWatch.watchedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : null, lastWatch: lastWatch ? new Date(lastWatch.watchedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : null, seasons: [...seasons].sort((a, b) => a - b), genres, poster: item.poster };
  }, [item, events, showRatings, contentDetails]);

  const openSeason = async (season) => {
    if (!seasonEpisodes[season.number]) {
      try {
        const res = await axios.get(`/api/events/season/${item.traktId}/${season.number}`);
        setSeasonEpisodes(prev => ({ ...prev, [season.number]: res.data.episodes || [] }));
      } catch { setSeasonEpisodes(prev => ({ ...prev, [season.number]: [] })); }
    }
    setSelectedSeason(season);
  };

  const watchedEpisodes = useMemo(() => {
    return events.filter(e => e.traktId === item.traktId && e.type === 'episode').map(e => ({ season: e.season, episode: e.episode }));
  }, [events, item.traktId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-800 w-full max-w-lg overflow-hidden max-h-[90vh] flex flex-col">
          <div className="relative h-40 sm:h-48 bg-zinc-800 shrink-0">
            <PosterImage src={contentDetails?.poster || seriesStats.poster} title={item.title} />
          <div className="absolute inset-0 bg-gradient-to-t from-zinc-900 via-zinc-900/50 to-transparent" />
          <button onClick={onClose} className="absolute top-3 right-3 sm:top-4 sm:right-4 text-zinc-400 hover:text-white hover:scale-110 text-2xl leading-none transition-all cursor-pointer">&times;</button>
          <div className="absolute bottom-3 sm:bottom-4 left-4 sm:left-6 right-4 sm:right-6">
            <h2 className="text-xl sm:text-2xl font-bold text-white">{item.title}</h2>
          </div>
        </div>
        <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 overflow-y-auto flex-1">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-zinc-800/50 rounded-lg p-4">
              <div className="text-2xl font-bold text-white">{seriesStats.totalWatches}</div>
              <div className="text-zinc-400 text-sm">{item.type === 'movie' ? 'Total Watches' : 'Total Episodes Watched'}</div>
            </div>
            <div className="bg-zinc-800/50 rounded-lg p-4">
              <div className="text-2xl font-bold text-white">{formatDuration(seriesStats.totalHours)}</div>
              <div className="text-zinc-400 text-sm">Watch Time</div>
            </div>
            {seriesStats.showRating && (
              <div className="bg-zinc-800/50 rounded-lg p-4">
                <div className="text-2xl font-bold text-amber-400">&#9733; {seriesStats.showRating}</div>
                <div className="text-zinc-400 text-sm">Your Rating</div>
              </div>
            )}
            {seriesStats.seasons.length > 0 && (
              <div className="bg-zinc-800/50 rounded-lg p-4">
                <div className="text-2xl font-bold text-white">{seriesStats.seasons.length}</div>
                <div className="text-zinc-400 text-sm">Seasons Watched</div>
              </div>
            )}
          </div>
          {seriesStats.firstWatch && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-zinc-500">First watched</span>
              <span className="text-zinc-300">{seriesStats.firstWatch}</span>
            </div>
          )}
          {seriesStats.lastWatch && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-zinc-500">Last watched</span>
              <span className="text-zinc-300">{seriesStats.lastWatch}</span>
            </div>
          )}
          {seriesStats.genres.length > 0 && (
            <div>
              <div className="text-zinc-500 text-sm mb-2">Genres</div>
              <div className="flex flex-wrap gap-2">
                {seriesStats.genres.map((g) => (
                  <span key={g} className="px-3 py-1 rounded-full text-xs font-medium bg-zinc-800 text-zinc-300 capitalize">{g}</span>
                ))}
              </div>
            </div>
          )}
          {seriesStats.seasons.length > 0 && (
            <div>
              <div className="text-zinc-500 text-sm mb-2">Seasons you watched</div>
              <div className="flex flex-wrap gap-2">
                {seriesStats.seasons.map((s) => (
                  <span key={s} className="px-3 py-1 rounded-full text-xs font-medium bg-violet-900/50 text-violet-300">S{s}</span>
                ))}
              </div>
            </div>
          )}
          {item.type !== 'movie' && !loadingSeasons && seasons.length > 0 && (
            <div>
              <div className="text-zinc-500 text-sm mb-3">All Seasons</div>
              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
                {seasons.map((season) => (
                  <button
                    key={season.number}
                    onClick={() => openSeason(season)}
                    className="shrink-0 px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-colors text-left cursor-pointer"
                  >
                    <div className="text-zinc-300 text-sm font-medium">Season {season.number}</div>
                    <div className="text-zinc-500 text-xs">{season.episodeCount} episodes</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {!loadingCast && cast.length > 0 && (
            <div>
              <div className="text-zinc-500 text-sm mb-3">Cast</div>
              <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
                {cast.map((actor) => (
                  <button
                    key={actor.personId}
                    onClick={() => onOpenActor && onOpenActor(actor.personId)}
                    className="shrink-0 flex flex-col items-center gap-2 w-20 text-center cursor-pointer hover:scale-105 transition-transform"
                  >
                    <ActorHeadshot src={actor.headshot} name={actor.name} />
                    <div>
                      <div className="text-zinc-300 text-xs font-medium leading-tight">{actor.name}</div>
                      {actor.character && (
                        <div className="text-zinc-500 text-xs leading-tight">{actor.character}</div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="flex items-center justify-between text-sm pt-2 border-t border-zinc-800">
            <span className="text-zinc-500">Type</span>
            <span className={`px-2 py-1 rounded text-xs font-medium ${item.type === 'movie' ? 'bg-emerald-900/50 text-emerald-400' : 'bg-violet-900/50 text-violet-400'}`}>
              {item.type === 'movie' ? 'Movie' : 'TV Show'}
            </span>
          </div>
          <ContentInfo contentDetails={contentDetails} loadingDetails={loadingDetails} itemType={item.type} traktId={item.traktId} />
        </div>
      </div>

      {selectedSeason && seasonEpisodes[selectedSeason.number] && (
        <SeasonModal
          showId={item.traktId}
          showTitle={item.title}
          season={selectedSeason}
          episodes={seasonEpisodes[selectedSeason.number]}
          watchedEpisodes={watchedEpisodes}
          onClose={() => setSelectedSeason(null)}
          onOpenEpisode={onOpenEpisode}
        />
      )}
    </div>
  );
}
