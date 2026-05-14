const express = require('express');
const router = express.Router();
const { calculateStats } = require('../services/statsService');
const TraktService = require('../services/traktService');
const RatingsService = require('../services/ratingsService');
const supabase = require('../services/supabaseClient');
const { normalizeHistory, deduplicateEvents } = require('../services/transformService');
const fs = require('fs');
const path = require('path');

console.log('Stats route loaded, supabase:', !!supabase);

const traktService = new TraktService(
  process.env.TRAKT_CLIENT_ID,
  process.env.TRAKT_ACCESS_TOKEN,
  process.env.TRAKT_CLIENT_SECRET,
  process.env.TRAKT_REFRESH_TOKEN
);

const ratingsService = new RatingsService(
  process.env.TRAKT_CLIENT_ID,
  process.env.TRAKT_ACCESS_TOKEN
);

const DATA_DIR = path.join(__dirname, '..', 'data');
const EXPORT_DIR = path.join(DATA_DIR, 'trakt-export-andris811');

async function loadHistory() {
  let history = [];
  
  // First: Load from Trakt export files (full history)
  for (let i = 1; i <= 7; i++) {
    const exportFile = path.join(EXPORT_DIR, `watched-history-${i}.json`);
    try {
      const content = fs.readFileSync(exportFile, 'utf-8');
      const exportData = JSON.parse(content);
      const normalized = normalizeHistory(exportData);
      history = history.concat(normalized);
    } catch {}
  }
  
  // Always merge recent data from Supabase
  if (supabase) {
    console.log('Loading recent history from Supabase (stats)...');
    let allData = [];
    let page = 0;
    const pageSize = 1000;
    
    while (true) {
      const { data, error } = await supabase
        .from('watch_history')
        .select('*')
        .order('watched_at', { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1);
      
      if (error) {
        console.error('Supabase select error:', error);
        break;
      }
      
      if (!data || data.length === 0) break;
      
      allData = allData.concat(data);
      
      if (data.length < pageSize) break;
      page++;
    }
    
    const supabaseHistory = allData.map(item => ({
      id: item.id,
      traktId: item.trakt_id,
      type: item.type,
      title: item.title,
      showTitle: item.show_title,
      season: item.season,
      episode: item.episode,
      runtime: item.runtime,
      genres: item.genres,
      poster: item.poster,
      watchedAt: item.watched_at,
      rating: item.rating
    }));
    
    // Merge: add Supabase items not already in export history
    const existingIds = new Set(history.map(h => h.id));
    for (const item of supabaseHistory) {
      if (!existingIds.has(item.id)) {
        history.push(item);
      }
    }
  }
  
  // Apply enrichment from content cache
  const cachePath = path.join(DATA_DIR, 'content-cache.json');
  try {
    const cache = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
    const movieKeys = Object.keys(cache).filter(k => k.startsWith('movie_'));
    const showKeys = Object.keys(cache).filter(k => k.startsWith('show_'));
    
    for (const key of movieKeys) {
      const data = cache[key];
      const traktId = parseInt(key.replace('movie_', ''));
      for (const item of history) {
        if (item.type === 'movie' && item.traktId === traktId) {
          if (!item.poster && data.poster) item.poster = data.poster;
          if (!item.genres || item.genres.length === 0) item.genres = data.genres || [];
          if (!item.runtime && data.runtime) item.runtime = data.runtime;
        }
      }
    }
    
    for (const key of showKeys) {
      const data = cache[key];
      const traktId = parseInt(key.replace('show_', ''));
      for (const item of history) {
        if (item.type === 'episode' && item.traktId === traktId) {
          if (!item.poster && data.poster) item.poster = data.poster;
          if (!item.genres || item.genres.length === 0) item.genres = data.genres || [];
          if (!item.runtime && data.runtime) item.runtime = data.runtime;
          // Also set runtime on show-level for series modal
          if (item.type === 'episode') {
            item.showRuntime = data.runtime; // Store show's runtime separately
          }
        }
      }
    }
  } catch (e) {}
  
  // Sort by watchedAt descending
  history.sort((a, b) => new Date(b.watchedAt) - new Date(a.watchedAt));
  
  history = deduplicateEvents(history, 72);
  
  return history;
}

async function loadTraktStats() {
  if (supabase) {
    const { data, error } = await supabase
      .from('trakt_stats')
      .select('stats')
      .single();
    if (error && error.code !== 'PGRST116') throw error;
    if (data && data.stats) {
      console.log('Loaded traktStats from Supabase');
      return data.stats;
    }
  }
  // Fetch fresh from Trakt API if not in Supabase
  console.log('Fetching traktStats from Trakt API...');
  try {
    const traktStats = await traktService.fetchStats();
    console.log('Fresh traktStats:', JSON.stringify(traktStats.movies), JSON.stringify(traktStats.episodes));
    return traktStats;
  } catch (err) {
    console.error('Failed to fetch traktStats:', err.message);
    return null;
  }
}

router.get('/', async (req, res) => {
  try {
    const [events, traktStats] = await Promise.all([
      loadHistory(),
      loadTraktStats()
    ]);
    console.log(`Calculating stats for ${events.length} events`);
    console.log('Trakt stats loaded:', !!traktStats);
    if (traktStats) {
      console.log('Trakt stats movies:', JSON.stringify(traktStats.movies));
      console.log('Trakt stats episodes:', JSON.stringify(traktStats.episodes));
    }
    
    // Check events for genres before ratings
    const eventsWithGenres = events.filter(e => e.genres && e.genres.length > 0).length;
    const eventsWithPoster = events.filter(e => e.poster).length;
    console.log(`Events with genres: ${eventsWithGenres}/${events.length}`);
    console.log(`Events with poster: ${eventsWithPoster}/${events.length}`);
    
    // Sample a few events to check structure
    if (events.length > 0) {
      const sample = events[0];
      console.log('Sample event:', JSON.stringify({
        title: sample.title,
        type: sample.type,
        traktId: sample.traktId,
        genres: sample.genres,
        poster: sample.poster ? 'yes' : 'no'
      }));
    }
    
    // Load ratings cache and apply to events
    await ratingsService.loadCache();
    console.log(`Ratings cache loaded, ${Object.keys(ratingsService.ratingsMap).length} entries`);
    
    // Also load ratings from export files for additional coverage
    const exportRatings = {};
    
    try {
      const movies = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'trakt-export-andris811', 'ratings-movies.json'), 'utf-8'));
      for (const item of movies) {
        if (item.movie && item.movie.ids && item.movie.ids.trakt) {
          exportRatings[`movie_${item.movie.ids.trakt}`] = item.rating;
        }
      }
      console.log(`Loaded ${movies.length} movie ratings from export`);
    } catch (e) {
      console.error('Failed to load movie ratings from export:', e.message);
    }
    
    try {
      const shows = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'trakt-export-andris811', 'ratings-shows.json'), 'utf-8'));
      for (const item of shows) {
        if (item.show && item.show.ids && item.show.ids.trakt) {
          exportRatings[`show_${item.show.ids.trakt}`] = item.rating;
        }
      }
      console.log(`Loaded ${shows.length} show ratings from export`);
    } catch (e) {
      console.error('Failed to load show ratings from export:', e.message);
    }
    
    try {
      const episodes = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'trakt-export-andris811', 'ratings-episodes.json'), 'utf-8'));
      for (const item of episodes) {
        if (item.episode && item.show && item.show.ids && item.episode.season !== undefined && item.episode.number !== undefined) {
          exportRatings[`episode_${item.show.ids.trakt}_${item.episode.season}_${item.episode.number}`] = item.rating;
        }
      }
      console.log(`Loaded ${episodes.length} episode ratings from export`);
    } catch (e) {
      console.error('Failed to load episode ratings from export:', e.message);
    }
    
    console.log(`Export ratings loaded: ${Object.keys(exportRatings).length}`);
    const mergedRatings = { ...ratingsService.ratingsMap, ...exportRatings };
    console.log(`Total ratings: ${Object.keys(mergedRatings).length} (${Object.keys(ratingsService.ratingsMap).length} from cache + ${Object.keys(exportRatings).length} from export)`);
    
    const stats = calculateStats(events, traktStats, mergedRatings);
    console.log('Stats calculated:', JSON.stringify(stats.coreStats));
    console.log('Ratings distribution:', JSON.stringify(stats.personalBehavior.ratingsDistribution));
    
    const totalRated = Object.values(stats.personalBehavior.ratingsDistribution).reduce((a, b) => a + b, 0);
    console.log(`Total rated items: ${totalRated}`);
    
    res.json(stats);
  } catch (error) {
    console.error('Stats error:', error.message);
    res.status(500).json({ error: 'Failed to calculate stats', details: error.message });
  }
});

module.exports = router;
