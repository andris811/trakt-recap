import { useState, useEffect } from 'react';
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
import YearReview from './components/YearReview';

function App() {
  const [stats, setStats] = useState(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedGenre, setSelectedGenre] = useState(null);
  const [selectedSeries, setSelectedSeries] = useState(null);
  const [selectedEpisode, setSelectedEpisode] = useState(null);
  const [selectedRating, setSelectedRating] = useState(null);

  useEffect(() => {
    Promise.all([
      axios.get('/api/stats'),
      axios.get('/api/events')
    ])
      .then(([statsRes, eventsRes]) => {
        setStats(statsRes.data);
        setEvents(eventsRes.data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  const openSeries = (item) => {
    setSelectedEpisode(null);
    setSelectedSeries(item);
  };

  const openEpisode = (item) => {
    setSelectedSeries(null);
    setSelectedEpisode(item);
  };

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

  return (
    <div className="min-h-screen bg-zinc-950 p-6 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-white">Trakt Recap</h1>
          <p className="text-zinc-400 mt-1">Your personal watch analytics</p>
        </header>

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
          <Heatmap heatmap={stats.activity.heatmap} />
          <PeakHoursChart peakHours={stats.activity.peakHours} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <GenreChart
            genreDistribution={stats.contentInsights.genreDistribution}
            onGenreClick={setSelectedGenre}
          />
          <RatingsChart
            ratingsDistribution={stats.personalBehavior.ratingsDistribution}
            onRatingClick={setSelectedRating}
          />
        </div>

        <Timeline
          timeline={stats.activity.timeline}
          events={events}
          onItemClick={openEpisode}
        />

        <YearReview events={events} onOpenSeries={openSeries} onOpenEpisode={openEpisode} />
      </div>

      {selectedGenre && (
        <GenreModal
          genre={selectedGenre}
          events={events}
          onClose={() => setSelectedGenre(null)}
          onItemClick={openEpisode}
          onOpenSeries={openSeries}
        />
      )}

      {selectedRating && (
        <RatingsModal
          rating={selectedRating}
          events={events}
          onClose={() => setSelectedRating(null)}
          onItemClick={openEpisode}
        />
      )}

      {selectedSeries && (
        <SeriesModal
          item={selectedSeries}
          events={events}
          showRatings={stats.showRatings || {}}
          onClose={() => setSelectedSeries(null)}
          onOpenEpisode={openEpisode}
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
    </div>
  );
}

export default App;
