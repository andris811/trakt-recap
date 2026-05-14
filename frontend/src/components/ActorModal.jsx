import { useState, useEffect } from 'react';
import axios from 'axios';
import { proxyPoster } from '../utils';

function HeadshotImage({ src, name }) {
  const [failed, setFailed] = useState(false);
  const initial = name ? name.charAt(0).toUpperCase() : '?';
  if (!src || failed) {
    return (
      <div className="w-24 h-24 rounded-full bg-zinc-700 flex items-center justify-center text-zinc-400 font-bold text-2xl shrink-0">
        {initial}
      </div>
    );
  }
  return (
    <img src={src} alt="" className="w-24 h-24 rounded-full object-cover shrink-0" loading="lazy" onError={() => setFailed(true)} />
  );
}

function FilmItem({ item, onClick }) {
  return (
    <button
      onClick={() => onClick(item)}
      className="flex items-center gap-3 p-3 bg-zinc-800/50 hover:bg-zinc-800 rounded-lg transition-colors text-left cursor-pointer w-full"
    >
      <div className="w-10 h-14 bg-zinc-700 rounded overflow-hidden shrink-0">
        {item.poster && (
          <img src={proxyPoster(item.poster)} alt="" className="w-full h-full object-cover" loading="lazy" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-zinc-300 text-sm font-medium truncate">{item.title}</div>
        <div className="text-zinc-500 text-xs">
          {item.year || ''} {item.character && `as ${item.character}`}
        </div>
        {item.rating && (
          <div className="text-amber-400 text-xs">&#9733; {item.rating.toFixed(1)}</div>
        )}
      </div>
    </button>
  );
}

export default function ActorModal({ personId, onClose, onOpenItem }) {
  const [details, setDetails] = useState(null);
  const [movies, setMovies] = useState([]);
  const [shows, setShows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('movies');

  useEffect(() => {
    if (movies.length > 0) {
      setActiveTab('movies');
    } else if (shows.length > 0) {
      setActiveTab('shows');
    }
  }, [movies, shows]);

  useEffect(() => {
    axios.get(`/api/events/person/${personId}`)
      .then(res => {
        setDetails(res.data.details);
        setMovies(res.data.movies || []);
        setShows(res.data.shows || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [personId]);

  const formatDate = (dateStr) => {
    if (!dateStr) return null;
    return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-800 w-full max-w-lg overflow-hidden max-h-[90vh] flex flex-col mx-2 sm:mx-0">
        <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 overflow-y-auto flex-1">
          {loading ? (
            <div className="text-zinc-400 text-center py-8">Loading...</div>
          ) : details ? (
            <>
              <div className="flex items-center gap-4">
                <HeadshotImage src={details.headshot} name={details.name} />
                <div>
                  <h2 className="text-2xl font-bold text-white">{details.name}</h2>
                  {details.birthday && (
                    <div className="text-zinc-400 text-sm">
                      Born: {formatDate(details.birthday)}
                      {details.birthplace && ` in ${details.birthplace}`}
                    </div>
                  )}
                  {details.death && (
                    <div className="text-zinc-500 text-sm">Died: {formatDate(details.death)}</div>
                  )}
                </div>
              </div>

              {details.biography && (
                <div>
                  <div className="text-zinc-500 text-sm mb-2">Biography</div>
                  <p className="text-zinc-300 text-sm leading-relaxed">{details.biography}</p>
                </div>
              )}

              {(movies.length > 0 || shows.length > 0) && (
                <div>
                  <div className="flex gap-2 mb-3">
                    <button
                      onClick={() => setActiveTab('movies')}
                      className={`px-4 py-2 rounded-lg text-sm transition-colors cursor-pointer ${
                        activeTab === 'movies'
                          ? 'bg-violet-900/50 text-violet-300'
                          : 'bg-zinc-800 text-zinc-400 hover:text-white'
                      }`}
                    >
                      Movies ({movies.length})
                    </button>
                    <button
                      onClick={() => setActiveTab('shows')}
                      className={`px-4 py-2 rounded-lg text-sm transition-colors cursor-pointer ${
                        activeTab === 'shows'
                          ? 'bg-violet-900/50 text-violet-300'
                          : 'bg-zinc-800 text-zinc-400 hover:text-white'
                      }`}
                    >
                      TV Shows ({shows.length})
                    </button>
                  </div>

                  <div className="space-y-2">
                    {(activeTab === 'movies' ? movies : shows).map((item, idx) => (
                      <FilmItem
                        key={`${item.traktId}_${idx}`}
                        item={item}
                        onClick={(item) => {
                          onOpenItem({
                            type: activeTab === 'movies' ? 'movie' : 'episode',
                            traktId: item.traktId,
                            title: item.title,
                            poster: item.poster,
                            genres: []
                          });
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-red-400 text-center py-8">Failed to load actor details</div>
          )}
        </div>
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-zinc-400 hover:text-white hover:scale-110 text-2xl leading-none transition-all cursor-pointer"
        >
          &times;
        </button>
      </div>
    </div>
  );
}
