const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const TraktService = require('../services/traktService');
const EnrichmentService = require('../services/enrichmentService');
const RatingsService = require('../services/ratingsService');
const { normalizeHistory } = require('../services/transformService');

const router = express.Router();

const DATA_DIR = path.join(__dirname, '..', 'data');
const DATA_FILE = path.join(DATA_DIR, 'watch-history.json');
const STATS_FILE = path.join(DATA_DIR, 'trakt-stats.json');

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

async function ensureDataDir() {
  try {
    await fs.access(DATA_DIR);
  } catch {
    await fs.mkdir(DATA_DIR, { recursive: true });
  }
}

async function saveHistory(data) {
  await ensureDataDir();
  await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

async function loadHistory() {
  try {
    const content = await fs.readFile(DATA_FILE, 'utf-8');
    return JSON.parse(content);
  } catch {
    return [];
  }
}

async function saveTraktStats(data) {
  await ensureDataDir();
  await fs.writeFile(STATS_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

async function loadTraktStats() {
  try {
    const content = await fs.readFile(STATS_FILE, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

router.get('/sync', async (req, res) => {
  try {
    const [rawHistory, traktStats] = await Promise.all([
      traktService.fetchHistory(),
      traktService.fetchStats()
    ]);
    const normalized = normalizeHistory(rawHistory);
    await saveHistory(normalized);
    await saveTraktStats(traktStats);

    res.json({ count: normalized.length, message: 'Sync complete. Enrichment running in background.' });

    enrichmentService.enrichEvents(normalized)
      .then(() => ratingsService.syncAndApply(normalized))
      .then(() => saveHistory(normalized))
      .catch(err => console.error('Background enrichment failed:', err.message));
  } catch (error) {
    res.status(500).json({ error: 'Failed to sync history', details: error.message });
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
