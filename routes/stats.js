const express = require('express');
const router = express.Router();
const { calculateStats } = require('../services/statsService');
const TraktService = require('../services/traktService');
const RatingsService = require('../services/ratingsService');
const supabase = require('../services/supabaseClient');
const { normalizeHistory } = require('../services/transformService');

console.log('Stats route loaded, supabase:', !!supabase);

const traktService = new TraktService(
  process.env.TRAKT_CLIENT_ID,
  process.env.TRAKT_ACCESS_TOKEN
);

const ratingsService = new RatingsService(
  process.env.TRAKT_CLIENT_ID,
  process.env.TRAKT_ACCESS_TOKEN
);

async function loadHistory() {
  if (supabase) {
    console.log('Loading history from Supabase...');
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
    if (allData.length > 0) {
      console.log('First item sample:', allData[0]);
    }
    
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
  }
  console.log('Supabase not configured, returning empty array');
  return [];
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
    
    // Load ratings cache and apply to events
    await ratingsService.loadCache();
    console.log(`Ratings cache loaded, ${Object.keys(ratingsService.ratingsMap).length} entries`);
    console.log('Sample ratingsMap keys:', Object.keys(ratingsService.ratingsMap).slice(0, 10));
    
    const stats = calculateStats(events, traktStats, ratingsService.ratingsMap);
    console.log('Stats calculated:', JSON.stringify(stats.coreStats));
    console.log('Ratings distribution:', JSON.stringify(stats.personalBehavior.ratingsDistribution));
    
    // Count total rated items
    const totalRated = Object.values(stats.personalBehavior.ratingsDistribution).reduce((a, b) => a + b, 0);
    console.log(`Total rated items: ${totalRated}`);
    
    res.json(stats);
  } catch (error) {
    console.error('Stats error:', error.message);
    res.status(500).json({ error: 'Failed to calculate stats', details: error.message });
  }
});

module.exports = router;
