const express = require('express');
const router = express.Router();
const TraktService = require('../services/traktService');
const { normalizeHistory } = require('../services/transformService');

console.log('Stats route loaded - using direct Trakt API');

const traktService = new TraktService(
  process.env.TRAKT_CLIENT_ID,
  process.env.TRAKT_ACCESS_TOKEN
);

async function fetchWatchHistory(limit = 50) {
  try {
    const history = await traktService.fetchHistory();
    console.log('fetchHistory result type:', typeof history, 'isArray:', Array.isArray(history));
    if (!Array.isArray(history)) {
      console.error('fetchHistory returned non-array:', typeof history);
      console.error('History value:', JSON.stringify(history).substring(0, 200));
      return [];
    }
    const normalized = history.map(normalizeHistory);
    return normalized.slice(0, limit);
  } catch (err) {
    console.error('Failed to fetch watch history:', err.message);
    return [];
  }
}

async function calculateStats() {
  const [traktStats, recentHistory] = await Promise.all([
    traktService.fetchStats(),
    fetchWatchHistory(50)
  ]);

  const movies = recentHistory.filter(h => h.type === 'movie');
  const episodes = recentHistory.filter(h => h.type === 'episode');

  const moviesHours = Math.round(traktStats.movies.minutes / 60);
  const episodesHours = Math.round(traktStats.episodes.minutes / 60);
  const totalHours = moviesHours + episodesHours;

  const moviesDays = Math.round(totalHours / 24 * 10) / 10;
  const episodesDays = Math.round(episodesHours / 24 * 10) / 10;
  const totalDays = Math.round((totalHours / 24) * 10) / 10;

  const avgMovieLength = Math.round(traktStats.movies.minutes / traktStats.movies.watched);
  const avgEpisodeLength = Math.round(traktStats.episodes.minutes / traktStats.episodes.watched);

  const genres = {};
  const ratingsDistribution = {};

  movies.forEach(movie => {
    if (movie.genres) {
      movie.genres.forEach(genre => {
        genres[genre] = (genres[genre] || 0) + 1;
      });
    }
    if (movie.rating) {
      ratingsDistribution[movie.rating] = (ratingsDistribution[movie.rating] || 0) + 1;
    }
  });

  episodes.forEach(episode => {
    if (episode.genres) {
      episode.genres.forEach(genre => {
        genres[genre] = (genres[genre] || 0) + 1;
      });
    }
    if (episode.rating) {
      ratingsDistribution[episode.rating] = (ratingsDistribution[episode.rating] || 0) + 1;
    }
  });

  const sortedGenres = Object.entries(genres)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, count]) => ({ name, count }));

  const ratedContent = new Set();
  const topRatedMovies = movies
    .filter(m => m.rating && !ratedContent.has(m.traktId) && ratedContent.add(m.traktId) === undefined)
    .sort((a, b) => b.rating - a.rating)
    .slice(0, 10)
    .map(m => ({
      title: m.title,
      rating: m.rating,
      year: m.year,
      poster: m.poster,
      genres: m.genres,
      type: 'movie'
    }));

  const topRatedShows = [];
  const showEps = {};

  episodes.forEach(ep => {
    if (!ep.rating) return;
    if (!showEps[ep.showTitle]) {
      showEps[ep.showTitle] = { episodes: [], title: ep.showTitle, poster: ep.poster, genres: ep.genres };
    }
    showEps[ep.showTitle].episodes.push(ep);
  });

  Object.values(showEps).forEach(show => {
    if (show.episodes.length === 0) return;
    const avgRating = show.episodes.reduce((sum, ep) => sum + ep.rating, 0) / show.episodes.length;
    topRatedShows.push({
      title: show.title,
      rating: Math.round(avgRating * 10) / 10,
      episodeCount: show.episodes.length,
      poster: show.poster,
      genres: show.genres,
      type: 'show'
    });
  });

  topRatedShows.sort((a, b) => b.rating - a.rating);
  const topRatedShowsFinal = topRatedShows.slice(0, 10);

  const peakHours = {};
  const weekDays = { Mon: 0, Tue: 0, Wed: 0, Thu: 0, Fri: 0, Sat: 0, Sun: 0 };
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  recentHistory.forEach(item => {
    if (!item.watchedAt) return;
    const date = new Date(item.watchedAt);
    const hour = date.getHours();
    const day = dayNames[date.getDay()];

    peakHours[hour] = (peakHours[hour] || 0) + 1;
    weekDays[day] = (weekDays[day] || 0) + 1;
  });

  const peakHoursArray = Array.from({ length: 24 }, (_, i) => ({
    hour: i,
    count: peakHours[i] || 0
  }));

  const weekDaysArray = Object.entries(weekDays).map(([day, count]) => ({ day, count }));

  return {
    coreStats: {
      moviesWatched: traktStats.movies.watched,
      moviesPlayed: traktStats.movies.plays,
      moviesHours,
      moviesDays,
      avgMovieLength,
      showsWatched: traktStats.shows.watched,
      episodesWatched: traktStats.episodes.watched,
      episodesPlayed: traktStats.episodes.plays,
      episodesHours,
      episodesDays,
      avgEpisodeLength,
      totalHours,
      totalDays,
      ratingsGiven: traktStats.movies.ratings + traktStats.episodes.ratings
    },
    activity: {
      recentActivity: recentHistory.slice(0, 20),
      timeline: recentHistory.slice(0, 20)
    },
    topRatedMovies,
    topRatedShows: topRatedShowsFinal,
    personalBehavior: {
      ratingsDistribution,
      genreDistribution: sortedGenres,
      peakHours: peakHoursArray,
      weekDays: weekDaysArray
    }
  };
}

router.get('/', async (req, res) => {
  try {
    console.log('Calculating stats from Trakt API...');
    const stats = await calculateStats();
    console.log('Stats:', JSON.stringify(stats.coreStats));
    res.json(stats);
  } catch (error) {
    console.error('Stats error:', error.message);
    res.status(500).json({ error: 'Failed to calculate stats', details: error.message });
  }
});

module.exports = router;
