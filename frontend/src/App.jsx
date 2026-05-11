import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import axios from 'axios';
import SummaryCards from './components/SummaryCards';
import Heatmap from './components/Heatmap';
import PeakHoursChart from './components/PeakHoursChart';
import GenreChart from './components/GenreChart';
import RatingsChart from './components/RatingsChart';
import Timeline from './components/Timeline';
import GenreModal from './components/GenreModal';
import SeriesModal from './components/SeriesModal';
import EpisodeModal from './components/EpisodeModal';
import RatingsModal from './components/RatingsModal';
import ActorModal from './components/ActorModal';
import YearReview from './components/YearReview';
import ProgressCard from './components/ProgressCard';
import Login from './components/Login';

function App() {
  const [stats, setStats] = useState(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedGenre, setSelectedGenre] = useState(null);
  const [selectedGenreYear, setSelectedGenreYear] = useState(null);
  const [selectedSeries, setSelectedSeries] = useState(null);
  const [selectedEpisode, setSelectedEpisode] = useState(null);
  const [selectedRating, setSelectedRating] = useState(null);
  const [selectedActor, setSelectedActor] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const searchTimeout = useRef(null);
  const [syncing, setSyncing] = useState(false);
  const passwordRef = useRef('');
  const [loginError, setLoginError] = useState(false);
  const [authenticated, setAuthenticated] = useState(null);
  const [theme, setTheme] = useState(() => localStorage.getItem('trakt_theme') || 'dark');

  useEffect(() => {
    document.documentElement.classList.toggle('light', theme === 'light');
    localStorage.setItem('trakt_theme', theme);
  }, [theme]);

  // Set up axios interceptor to send password header
  useEffect(() => {
    const interceptor = axios.interceptors.request.use(config => {
      if (passwordRef.current) {
        config.headers['x-app-password'] = passwordRef.current;
      }
      return config;
    });
    return () => axios.interceptors.request.eject(interceptor);
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [statsRes, eventsRes] = await Promise.all([
        axios.get('/api/stats'),
        axios.get('/api/events')
      ]);
      setStats(statsRes.data);
      setEvents(eventsRes.data);
      setAuthenticated(true);
      return true;
    } catch (err) {
      if (err.response?.status === 401) {
        setAuthenticated(false);
      } else {
        setError(err.message);
      }
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem('trakt_password') || sessionStorage.getItem('trakt_password');
    if (saved) {
      passwordRef.current = saved;
    }
    loadData();
  }, [loadData]);

  const handleLogin = async (password, remember) => {
    passwordRef.current = password;
    sessionStorage.setItem('trakt_password', password);
    if (remember) {
      localStorage.setItem('trakt_password', password);
    } else {
      localStorage.removeItem('trakt_password');
    }
    setLoginError(false);
    const success = await loadData();
    if (!success && passwordRef.current) setLoginError(true);
  };

  const handleSearchChange = useCallback((e) => {
    const value = e.target.value;
    setSearchTerm(value);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => setDebouncedSearch(value), 300);
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    try {
      await axios.get('/api/events/sync');
      await loadData();
    } catch (err) {
      setError(err.message);
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    return () => { if (searchTimeout.current) clearTimeout(searchTimeout.current); };
  }, []);

  const openSeries = (item) => {
    setSelectedEpisode(null);
    setSelectedSeries(item);
  };

  const openEpisode = (item) => {
    setSelectedSeries(null);
    setSelectedEpisode(item);
  };

  const openActor = (personId) => {
    setSelectedSeries(null);
    setSelectedEpisode(null);
    setSelectedActor(personId);
  };

  const openItemFromActor = (item) => {
    setSelectedActor(null);
    if (item.type === 'movie' || item.type === 'episode') {
      setSelectedSeries(item);
    }
  };

  const filteredEvents = useMemo(() => {
    if (!debouncedSearch.trim()) return events;
    const term = debouncedSearch.toLowerCase();
    const result = [];
    const seriesAdded = new Set();
    const episodeResults = [];
    const seriesPosters = {};

    // First pass: collect all posters for each series
    for (const event of events) {
      if (event.type === 'episode' && event.showTitle && event.poster) {
        if (!seriesPosters[event.traktId]) {
          seriesPosters[event.traktId] = event.poster;
        }
      }
    }

    for (const event of events) {
      const isEpisode = event.type === 'episode' || event.season !== undefined;
      if (isEpisode) {
        const showTitle = (event.showTitle || '').toLowerCase();
        const episodeTitle = (event.title || '').toLowerCase();
        if (showTitle.includes(term) && !seriesAdded.has(event.traktId)) {
          result.push({
            id: `series-${event.traktId}`,
            title: event.showTitle,
            traktId: event.traktId,
            poster: seriesPosters[event.traktId] || event.poster,
            type: 'show',
            watchedAt: event.watchedAt
          });
          seriesAdded.add(event.traktId);
        }
        if (episodeTitle.includes(term)) {
          episodeResults.push(event);
        }
      } else {
        if ((event.title || '').toLowerCase().includes(term)) {
          result.push(event);
        }
      }
    }
    return [...result, ...episodeResults];
  }, [events, debouncedSearch]);

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-zinc-400 text-lg">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-red-400 text-lg">Error: {error}</div>
      </div>
    );
  }

  if (authenticated === false) {
    return <Login onLogin={handleLogin} error={loginError} />;
  }

  const showSearch = debouncedSearch.trim().length > 0;

  return (
    <div className="min-h-screen bg-zinc-950 p-6 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <header className="mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <img src="/icon.png" alt="Trakt Recap icon" className="w-8 h-8" />
              <h1 className="text-3xl font-bold text-white">Trakt Recap</h1>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
                className="p-2 bg-zinc-800/50 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer"
                title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
              >
                {theme === 'dark' ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                  </svg>
                )}
              </button>
              <button
                onClick={handleSync}
                disabled={syncing}
                className="px-4 py-2 bg-violet-900/50 text-violet-300 rounded-lg hover:bg-violet-900/70 transition-colors disabled:opacity-50 cursor-pointer"
              >
                {syncing ? 'Syncing...' : 'Sync'}
              </button>
            </div>
          </div>
          <p className="text-zinc-400 mt-1">Your personal watch analytics</p>
          <div className="mt-4 relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="w-5 h-5 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              value={searchTerm}
              onChange={handleSearchChange}
              placeholder="Search movies, shows, episodes..."
              className="w-full pl-10 pr-10 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-700"
            />
            {searchTerm && (
              <button
                onClick={() => { setSearchTerm(''); setDebouncedSearch(''); }}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-zinc-400 hover:text-white"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </header>

        {showSearch && (
          <div className="bg-zinc-900 rounded-xl p-6 shadow-lg border border-zinc-800">
            <h3 className="text-lg font-semibold text-white mb-4">Search Results ({filteredEvents.length})</h3>
            {filteredEvents.length === 0 ? (
              <p className="text-zinc-500">No results found for "{debouncedSearch}"</p>
            ) : (
              <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2">
                {filteredEvents.map((event) => {
                  const date = new Date(event.watchedAt);
                  const dateStr = date.toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                  });
                  const displayName = event.showTitle
                    ? `${event.showTitle} - ${event.title}`
                    : event.title;
                  const isEpisode = event.type === 'episode' || event.season;

                  return (
                    <div
                      key={event.id}
                      onClick={() => isEpisode ? openEpisode(event) : openSeries(event)}
                      className="flex items-center gap-3 p-3 rounded-lg bg-zinc-800/50 hover:bg-zinc-800 transition-all cursor-pointer group"
                    >
                      <div className="w-10 h-14 flex-shrink-0 rounded overflow-hidden bg-zinc-700">
                        {event.poster ? (
                          <img src={event.poster} alt={displayName} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-zinc-400 font-bold text-xs">
                            {displayName.charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-white font-medium truncate">{displayName}</div>
                        <div className="flex items-center gap-2 text-sm text-zinc-400">
                          <span>{isEpisode ? 'Episode' : 'Movie'}</span>
                          <span>•</span>
                          <span>{dateStr}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {!showSearch && (
          <>
            <SummaryCards stats={stats} onShowClick={(show) => {
            openSeries({
              type: 'episode',
              traktId: show.traktId,
              title: show.title,
              poster: show.poster,
              genres: []
            });
          }} />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Heatmap heatmap={stats.activity.heatmap} theme={theme} />
            <PeakHoursChart peakHours={stats.activity.peakHours} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <GenreChart
              genreDistribution={stats.contentInsights.genreDistribution}
              onGenreClick={setSelectedGenre}
              theme={theme}
            />
            <RatingsChart
              ratingsDistribution={stats.personalBehavior.ratingsDistribution}
              onRatingClick={setSelectedRating}
            />
          </div>

          <Timeline
            timeline={stats.activity.timeline}
            events={filteredEvents}
            onItemClick={(item) => item.type === 'movie' ? openSeries(item) : openEpisode(item)}
          />

          <ProgressCard events={events} onOpenSeries={openSeries} />

          <YearReview events={filteredEvents} onOpenSeries={openSeries} onOpenEpisode={openEpisode} onGenreClick={(genre, year) => { setSelectedGenre(genre); setSelectedGenreYear(year || null); }} />
          </>
        )}
      </div>

      {selectedGenre && (
         <GenreModal
           genre={selectedGenre}
           events={filteredEvents}
           onClose={() => { setSelectedGenre(null); setSelectedGenreYear(null); }}
           onItemClick={openEpisode}
           onOpenSeries={openSeries}
           year={selectedGenreYear}
         />
      )}

{selectedRating && (
          <RatingsModal
            rating={selectedRating}
            stats={stats}
            onClose={() => setSelectedRating(null)}
            onItemClick={openEpisode}
            onOpenSeries={openSeries}
          />
        )}

      {selectedSeries && (
         <SeriesModal
           item={selectedSeries}
           events={events}
           showRatings={stats.showRatings || {}}
           onClose={() => setSelectedSeries(null)}
           onOpenEpisode={openEpisode}
           onOpenActor={openActor}
         />
      )}

      {selectedEpisode && (
         <EpisodeModal
           item={selectedEpisode}
           events={events}
           onClose={() => setSelectedEpisode(null)}
           onOpenSeries={openSeries}
           onNavigateEpisode={(ep) => setSelectedEpisode(ep)}
         />
      )}

      {selectedActor && (
        <ActorModal
          personId={selectedActor}
          onClose={() => setSelectedActor(null)}
          onOpenItem={openItemFromActor}
        />
      )}
    </div>
  );
}

export default App;
