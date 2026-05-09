const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const TraktService = require('../services/traktService');
const EnrichmentService = require('../services/enrichmentService');
const RatingsService = require('../services/ratingsService');
const { normalizeHistory } = require('../services/transformService');
const supabase = require('../services/supabaseClient');

const router = express.Router();

const DATA_DIR = path.join(__dirname, '..', 'data');
const DATA_FILE = path.join(DATA_DIR, 'watch-history.json');

const traktService = new TraktService(
  process.env.TRAKT_CLIENT_ID,
  process.env.TRAKT_ACCESS_TOKEN
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
  if (supabase) {
    console.log('Loading history from Supabase (events)...');
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
        throw error;
      }
      
      if (!data || data.length === 0) break;
      
      allData = allData.concat(data);
      console.log(`Loaded ${data.length} items, total: ${allData.length}`);
      
      if (data.length < pageSize) break;
      page++;
    }
    
    console.log(`Loaded ${allData.length} items from Supabase`);
    
    return allData.map(item => ({
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
  } else {
    // Fallback to file
    try {
      const content = await fs.readFile(DATA_FILE, 'utf-8');
      return JSON.parse(content);
    } catch {
      return [];
    }
  }
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
    // Prevent caching
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    
    if (!process.env.TRAKT_ACCESS_TOKEN) {
      return res.status(400).json({ error: 'TRAKT_ACCESS_TOKEN not set. Complete OAuth flow via /callback first.' });
    }
    
    const [rawHistory, traktStats] = await Promise.all([
      traktService.fetchHistory(),
      traktService.fetchStats()
    ]);
    
    console.log(`Fetched ${rawHistory.length} history items from Trakt`);
    const normalized = normalizeHistory(rawHistory);
    
    if (supabase) {
      // Clear existing data and insert fresh
      console.log('Clearing existing watch_history...');
      await supabase.from('watch_history').delete().neq('id', '');
      
      // Deduplicate by id
      const seen = new Set();
      const deduped = normalized.filter(item => {
        if (seen.has(item.id)) return false;
        seen.add(item.id);
        return true;
      });
      
      console.log(`Data: ${normalized.length} items, after dedup: ${deduped.length} items`);
      
      try {
        const { error } = await supabase
          .from('watch_history')
          .insert(
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
            }))
          );
        
        if (error) {
          console.error('Insert error:', error);
          throw error;
        }
        
        console.log('Inserted fresh watch history to Supabase');
      } catch (err) {
        console.error('Insert failed:', err.message);
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
    res.status(500).json({ error: 'Failed to sync history', details: error.message, traktError: error.response?.data });
  }
});

router.post('/enrich', async (req, res) => {
  try {
    const events = await loadHistory();
    const result = await enrichmentService.enrichEvents(events);
    await ratingsService.syncAndApply(events);
    await saveHistory(events);
    res.json({
      message: 'Enrichment complete',
      total: result.total,
      enriched: result.enriched,
      wasCached: result.cached
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to enrich data', details: error.message });
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
    const { type, traktId } = req.params;
    const [details, comments] = await Promise.all([
      enrichmentService.getContentDetails(type, parseInt(traktId)),
      enrichmentService.getComments(type, parseInt(traktId))
    ]);
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
    const seasons = await enrichmentService.getShowSeasons(parseInt(showId));
    res.json({ seasons });
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
