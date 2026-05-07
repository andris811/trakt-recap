const express = require('express');
const router = express.Router();
const { calculateStats } = require('../services/statsService');
const TraktService = require('../services/traktService');
const supabase = require('../services/supabaseClient');
const { normalizeHistory } = require('../services/transformService');

const traktService = new TraktService(
  process.env.TRAKT_CLIENT_ID,
  process.env.TRAKT_ACCESS_TOKEN
);

async function loadHistory() {
  if (supabase) {
    const { data, error } = await supabase
      .from('watch_history')
      .select('*')
      .order('watched_at', { ascending: false });
    if (error) throw error;
    return data.map(item => ({
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
  }
  return [];
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

router.get('/', async (req, res) => {
  try {
    const [events, traktStats] = await Promise.all([
      loadHistory(),
      loadTraktStats()
    ]);
    const stats = calculateStats(events, traktStats);
    res.json(stats);
  } catch (error) {
    console.error('Stats error:', error.message);
    res.status(500).json({ error: 'Failed to calculate stats', details: error.message });
  }
});

module.exports = router;
