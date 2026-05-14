const express = require('express');
const fs = require('fs');
const path = require('path');
const TraktService = require('../services/traktService');
const EnrichmentService = require('../services/enrichmentService');
const RatingsService = require('../services/ratingsService');
const { normalizeHistory, deduplicateEvents } = require('../services/transformService');
const supabase = require('../services/supabaseClient');

const router = express.Router();

const DATA_DIR = path.join(__dirname, '..', 'data');
const DATA_FILE = path.join(DATA_DIR, 'watch-history.json');

const traktService = new TraktService(
  process.env.TRAKT_CLIENT_ID,
  process.env.TRAKT_ACCESS_TOKEN,
  process.env.TRAKT_CLIENT_SECRET,
  process.env.TRAKT_REFRESH_TOKEN
);

const enrichmentService = new EnrichmentService(
  process.env.TRAKT_CLIENT_ID,
  process.env.TRAKT_ACCESS_TOKEN
);

const ratingsService = new RatingsService(
  process.env.TRAKT_CLIENT_ID,
  process.env.TRAKT_ACCESS_TOKEN
);

// Fallback to file storage if Supabase not configured
async function saveHistory(data) {
  if (supabase) {
    // Deduplicate by id
    const seen = new Set();
    const deduped = data.filter(item => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
    
    console.log(`Data: ${data.length} items, after dedup: ${deduped.length} items`);
    
    try {
      // Try to use upsert
      const { error } = await supabase
        .from('watch_history')
        .upsert(
          deduped.map(item => ({
            id: item.id,
            trakt_id: item.traktId,
            type: item.type,
            title: item.title,
            show_title: item.showTitle,
            season: item.season,
            episode: item.episode,
            runtime: item.runtime,
            genres: item.genres,
            poster: item.poster,
            watched_at: item.watchedAt,
            rating: item.rating
          })),
          { onConflict: 'id', ignoreDuplicates: false }
        );
      
      if (error) {
        console.error('Upsert error:', error);
        throw error;
      }
    } catch (err) {
      console.error('Failed to save to Supabase:', err.message);
      throw err;
    }
  } else {
    // Fallback to file
    await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
  }
}

async function loadHistory() {
  let history = [];
  
  // First: Load from Trakt export files (full history)
  const EXPORT_DIR = path.join(DATA_DIR, 'trakt-export-andris811');
  for (let i = 1; i <= 7; i++) {
    const exportFile = path.join(EXPORT_DIR, `watched-history-${i}.json`);
    try {
      const content = fs.readFileSync(exportFile, 'utf-8');
      const exportData = JSON.parse(content);
      const normalized = normalizeHistory(exportData);
      history = history.concat(normalized);
      console.log(`Loaded ${normalized.length} items from export ${i}`);
    } catch {
      // File doesn't exist or can't be read, skip
    }
  }
  
  if (history.length > 0) {
    console.log(`Total from exports: ${history.length} items`);
  }
  
  // Second: Load from local JSON file (backup)
  if (history.length === 0) {
    try {
      const localData = fs.readFileSync(DATA_FILE, 'utf-8');
      const localHistory = JSON.parse(localData);
      console.log(`Loaded ${localHistory.length} items from local JSON file`);
      history = localHistory;
    } catch (err) {
      console.log('No local JSON file found');
    }
  }
  
  // Third: Load from Supabase (recent data)
  if (supabase) {
    console.log('Loading recent history from Supabase...');
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
      console.log(`Loaded ${data.length} items from Supabase, total: ${allData.length}`);
      
      if (data.length < pageSize) break;
      page++;
    }
    
    if (allData.length > 0) {
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
      
      // Merge: Add Supabase items that aren't in history yet
      const existingIds = new Set(history.map(h => h.id));
      for (const item of supabaseHistory) {
        if (!existingIds.has(item.id)) {
          history.push(item);
        }
      }
      console.log(`Merged: ${history.length} total items`);
    }
  }
  
  // Sort by watchedAt descending
  history.sort((a, b) => new Date(b.watchedAt) - new Date(a.watchedAt));
  console.log(`Final history: ${history.length} items`);
  
  // Apply enrichment from content cache (posters, genres, runtime)
  try {
    const cachePath = path.join(DATA_DIR, 'content-cache.json');
    const cache = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
    let enriched = 0;
    
    for (const item of history) {
      const key = item.type === 'movie' ? `movie_${item.traktId}` : `show_${item.traktId}`;
      const data = cache[key];
      if (data) {
        if (!item.poster && data.poster) {
          item.poster = data.poster;
          enriched++;
        }
        if (!item.genres || item.genres.length === 0) {
          item.genres = data.genres || [];
          if (data.genres && data.genres.length > 0) enriched++;
        }
        if (!item.runtime && data.runtime) {
          item.runtime = data.runtime;
          enriched++;
        }
      }
    }
    console.log(`Enriched ${enriched} items from content cache`);
  } catch (e) {
    console.log('Content cache not available:', e.message);
  }
  
  history = deduplicateEvents(history, 72);
  console.log(`After dedup: ${history.length} items`);
  
  return history;
}

// Load ratings from Trakt export files
function loadRatingsFromExport() {
  const ratingsMap = {};
  
  try {
    const movies = require('../data/trakt-export-andris811/ratings-movies.json');
    for (const item of movies) {
      if (item.movie && item.movie.ids && item.movie.ids.trakt) {
        ratingsMap[`movie_${item.movie.ids.trakt}`] = item.rating;
      }
    }
    console.log(`Loaded ${movies.length} movie ratings from export`);
  } catch (e) {}
  
  try {
    const shows = require('../data/trakt-export-andris811/ratings-shows.json');
    for (const item of shows) {
      if (item.show && item.show.ids && item.show.ids.trakt) {
        ratingsMap[`show_${item.show.ids.trakt}`] = item.rating;
      }
    }
    console.log(`Loaded ${shows.length} show ratings from export`);
  } catch (e) {}
  
  try {
    const episodes = require('../data/trakt-export-andris811/ratings-episodes.json');
    for (const item of episodes) {
      if (item.episode && item.show && item.show.ids && item.episode.season !== undefined && item.episode.number !== undefined) {
        ratingsMap[`episode_${item.show.ids.trakt}_${item.episode.season}_${item.episode.number}`] = item.rating;
      }
    }
    console.log(`Loaded ${episodes.length} episode ratings from export`);
  } catch (e) {}
  
  console.log(`Total ratings loaded from export: ${Object.keys(ratingsMap).length}`);
  return ratingsMap;
}

async function saveTraktStats(data) {
  if (supabase) {
    await supabase.from('trakt_stats').delete().neq('id', '');
    const { error } = await supabase
      .from('trakt_stats')
      .insert({ stats: data });
    if (error) throw error;
  }
}

async function loadTraktStats() {
  if (supabase) {
    const { data, error } = await supabase
      .from('trakt_stats')
      .select('stats')
      .single();
    if (error && error.code !== 'PGRST116') throw error;
    return (data && data.stats) || null;
  }
  return null;
}

router.get('/sync', async (req, res) => {
  try {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Keep-Alive', 'timeout=120');
    
    if (!process.env.TRAKT_ACCESS_TOKEN) {
      return res.status(400).json({ error: 'TRAKT_ACCESS_TOKEN not set. Complete OAuth flow via /callback first.' });
    }
    
    console.log('Starting sync - fetching history from Trakt...');
    
    const [rawHistory, traktStats] = await Promise.all([
      traktService.fetchHistory(),
      traktService.fetchStats()
    ]);
    
    console.log(`Fetched ${rawHistory.length} history items from Trakt (should be ~6296)`);
    
    // Safety threshold: abort if Trakt returned too few items to prevent data loss
    if (rawHistory.length < 100) {
      console.error(`ABORT: Only ${rawHistory.length} items fetched. Expected ~6296.`);
      return res.status(400).json({
        error: 'Sync aborted',
        details: `Only fetched ${rawHistory.length} items from Trakt. Expected ~6296. Try again later.`
      });
    }
    
    if (rawHistory.length < 1000) {
      console.warn(`WARNING: Only fetched ${rawHistory.length} items. Trakt may be rate-limiting.`);
      console.warn('Expected ~6296 items. Try again in a few minutes.');
    }
    const normalized = normalizeHistory(rawHistory);
    
    if (supabase) {
      // Collect new IDs, deduplicate
      const seen = new Set();
      const deduped = normalized.filter(item => {
        if (seen.has(item.id)) return false;
        seen.add(item.id);
        return true;
      });
      
      console.log(`Data: ${normalized.length} items, after dedup: ${deduped.length} items`);
      
      const newItems = deduped.map(item => ({
        id: item.id,
        trakt_id: item.traktId,
        type: item.type,
        title: item.title,
        show_title: item.showTitle,
        season: item.season,
        episode: item.episode,
        runtime: item.runtime,
        genres: item.genres,
        poster: item.poster,
        watched_at: item.watchedAt,
        rating: item.rating
      }));
      
      // Upsert new data first, then delete old IDs not in the new batch
      // This prevents data loss if the insert fails
      const { error: upsertError } = await supabase
        .from('watch_history')
        .upsert(newItems, { onConflict: 'id', ignoreDuplicates: false });
      
      if (upsertError) {
        console.error('Upsert error:', upsertError);
        throw upsertError;
      }
      
      console.log(`Upserted ${deduped.length} items to Supabase`);
      
      // Delete items that no longer exist in the new data
      const newIds = new Set(deduped.map(item => item.id));
      const { data: existing } = await supabase.from('watch_history').select('id');
      const toDelete = (existing || []).map(r => r.id).filter(id => !newIds.has(id));
      
      if (toDelete.length > 0) {
        const batchSize = 100;
        for (let i = 0; i < toDelete.length; i += batchSize) {
          await supabase.from('watch_history').delete().in('id', toDelete.slice(i, i + batchSize));
        }
        console.log(`Removed ${toDelete.length} stale items from Supabase`);
      }
      
      if (traktStats) {
        await supabase.from('trakt_stats').delete().neq('id', '');
        await supabase.from('trakt_stats').insert({ stats: traktStats });
      }
    } else {
      // Fallback to file
      const DATA_DIR = path.join(__dirname, '..', 'data');
      await fs.mkdir(DATA_DIR, { recursive: true });
      await fs.writeFile(path.join(DATA_DIR, 'watch-history.json'), JSON.stringify(normalized, null, 2));
      if (traktStats) {
        await fs.writeFile(path.join(DATA_DIR, 'trakt-stats.json'), JSON.stringify(traktStats, null, 2));
      }
    }
    
    // Don't wait for enrichment - just save the data and return immediately
    res.json({ count: normalized.length, message: 'Sync complete. Enrichment will run in background.' });

    // Run enrichment in background (don't wait for it)
    enrichmentService.enrichEvents(normalized, async (events) => {
      console.log('Saving enriched data to Supabase...');
      await saveHistory(events);
    })
      .then(() => ratingsService.syncAndApply(normalized))
      .then(() => saveHistory(normalized))
      .catch(err => console.error('Background task failed:', err.message));
  } catch (error) {
    console.error('Sync error:', error.response?.data || error.message);
    if (error.statusCode === 401) {
      return res.status(401).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to sync history', details: error.message, traktError: error.response?.data });
  }
});

router.post('/enrich', async (req, res) => {
  try {
    const events = await loadHistory();
    
    const needsEnrichment = events.filter(e => !e.poster || !e.genres || e.genres.length === 0);
    console.log(`Items needing enrichment: ${needsEnrichment.length} out of ${events.length}`);
    
    const result = await enrichmentService.enrichEvents(events, async (enrichedEvents) => {
      await saveHistory(enrichedEvents);
    }, 50);
    
    await ratingsService.syncAndApply(events);
    await saveHistory(events);
    
    console.log(`Enrichment complete: ${result.enriched} items enriched, ${result.wasCached} were cached`);
    res.json({
      message: 'Enrichment complete',
      total: result.total,
      enriched: result.enriched,
      wasCached: result.wasCached
    });
  } catch (error) {
    console.error('Enrichment error:', error.message);
    res.status(500).json({ error: 'Failed to enrich data', details: error.message });
  }
});

// Import full history from Trakt export JSON
router.post('/import', async (req, res) => {
  try {
    const { history, traktStats } = req.body;
    
    if (!history || !Array.isArray(history)) {
      return res.status(400).json({ error: 'Invalid request. Provide { history: [...] }' });
    }
    
    console.log(`Importing ${history.length} items from JSON export...`);
    
    // Normalize the history
    const normalized = history.map(normalizeHistory);
    console.log(`Normalized ${normalized.length} items`);
    
    // Save to local JSON file
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(DATA_FILE, JSON.stringify(normalized, null, 2), 'utf-8');
    console.log(`Saved ${normalized.length} items to local JSON file`);
    
    if (traktStats) {
      await fs.writeFile(path.join(DATA_DIR, 'trakt-stats.json'), JSON.stringify(traktStats, null, 2), 'utf-8');
      console.log('Saved trakt stats to local file');
    }
    
    // Also save to Supabase
    if (supabase) {
      await supabase.from('watch_history').delete().neq('id', '');
      
      const { error } = await supabase
        .from('watch_history')
        .insert(normalized.map(item => ({
          id: item.id,
          trakt_id: item.traktId,
          type: item.type,
          title: item.title,
          show_title: item.showTitle,
          season: item.season,
          episode: item.episode,
          runtime: item.runtime,
          genres: item.genres,
          poster: item.poster,
          watched_at: item.watchedAt,
          rating: item.rating
        })));
      
      if (error) {
        console.error('Supabase insert error:', error);
      } else {
        console.log(`Saved ${normalized.length} items to Supabase`);
      }
      
      if (traktStats) {
        await supabase.from('trakt_stats').delete().neq('id', '');
        await supabase.from('trakt_stats').insert({ stats: traktStats });
      }
    }
    
    res.json({
      message: 'Import complete',
      count: normalized.length,
      source: 'json_export'
    });
  } catch (error) {
    console.error('Import error:', error.message);
    res.status(500).json({ error: 'Failed to import data', details: error.message });
  }
});

router.get('/enrich', (req, res) => {
  res.json({
    message: 'Enrichment endpoint - use POST to trigger enrichment',
    instructions: 'Send a POST request to this endpoint to run enrichment on existing watch history'
  });
});

router.get('/ratings/refresh', async (req, res) => {
  try {
    console.log('Fetching fresh ratings from Trakt...');
    await ratingsService.fetchRatings();
    console.log(`Ratings refreshed: ${Object.keys(ratingsService.ratingsMap).length} entries`);
    res.json({
      message: 'Ratings refreshed',
      count: Object.keys(ratingsService.ratingsMap).length
    });
  } catch (error) {
    console.error('Failed to refresh ratings:', error.message);
    res.status(500).json({ error: 'Failed to refresh ratings', details: error.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const history = await loadHistory();
    res.json(history);
  } catch (error) {
    res.status(500).json({ error: 'Failed to load history', details: error.message });
  }
});

router.get('/content/:type/:traktId', async (req, res) => {
  try {
    const { type } = req.params;
    const traktId = parseInt(req.params.traktId);
    
    // Load content details from cache or API
    let details;
    const cachePath = path.join(__dirname, '..', 'data', 'content-cache.json');
    try {
      const cache = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
      const key = `${type}_${traktId}`;
      if (cache[key]) {
        details = cache[key];
      }
    } catch (e) {}
    
    if (!details) {
      details = await enrichmentService.getContentDetails(type, traktId);
    }
    
    // Always fetch comments live
    const comments = await enrichmentService.getComments(type, traktId);
    
    res.json({ ...details, comments });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch content details', details: error.message });
  }
});

router.get('/episode/:showId/:season/:number', async (req, res) => {
  try {
    const { showId, season, number } = req.params;
    const [details, comments] = await Promise.all([
      enrichmentService.getEpisodeDetails(parseInt(showId), parseInt(season), parseInt(number)),
      enrichmentService.getEpisodeComments(parseInt(showId), parseInt(season), parseInt(number))
    ]);
    res.json({ ...details, comments });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch episode details', details: error.message });
  }
});

router.get('/season/:showId/:season', async (req, res) => {
  try {
    const { showId, season } = req.params;
    const episodes = await enrichmentService.getSeasonEpisodes(parseInt(showId), parseInt(season));
    res.json({ episodes });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch season episodes', details: error.message });
  }
});

router.get('/seasons/:showId', async (req, res) => {
  try {
    const { showId } = req.params;
    const [seasons, airedEpisodes] = await Promise.all([
      enrichmentService.getShowSeasons(parseInt(showId)),
      enrichmentService.getShowAiredEpisodes(parseInt(showId))
    ]);
    res.json({ seasons, airedEpisodes });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch show seasons', details: error.message });
  }
});

router.get('/content/:type/:traktId/people', async (req, res) => {
  try {
    const { type, traktId } = req.params;
    const cast = await enrichmentService.getContentPeople(type, parseInt(traktId));
    res.json({ cast });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch cast', details: error.message });
  }
});

router.get('/person/:personId', async (req, res) => {
  try {
    const { personId } = req.params;
    const [details, movies, shows] = await Promise.all([
      enrichmentService.getPersonDetails(parseInt(personId)),
      enrichmentService.getPersonMovies(parseInt(personId)),
      enrichmentService.getPersonShows(parseInt(personId))
    ]);
    res.json({ details, movies, shows });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch person details', details: error.message });
  }
});

module.exports = router;
