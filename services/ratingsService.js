const axios = require('axios');
const supabase = require('./supabaseClient');

const TRAKT_API_URL = 'https://api.trakt.tv';
const CACHE_KEY = 'ratings_map';

class RatingsService {
  constructor(clientId, accessToken) {
    this.client = axios.create({
      baseURL: TRAKT_API_URL,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'trakt-api-key': clientId,
        'trakt-api-version': '2',
        'Content-Type': 'application/json'
      }
    });
    this.ratingsMap = {};
  }

  async loadCache() {
    if (supabase) {
      const { data, error } = await supabase
        .from('content_cache')
        .select('value')
        .eq('key', CACHE_KEY)
        .single();
      
      if (!error && data) {
        this.ratingsMap = data.value || {};
        return;
      }
    }
    
    // Fallback to file (for local development)
    try {
      const fs = require('fs').promises;
      const path = require('path');
      const CACHE_FILE = path.join(__dirname, '..', 'data', 'ratings-cache.json');
      const content = await fs.readFile(CACHE_FILE, 'utf-8');
      this.ratingsMap = JSON.parse(content);
    } catch {
      this.ratingsMap = {};
    }
  }

  async saveCache() {
    if (supabase) {
      const { error } = await supabase
        .from('content_cache')
        .upsert({ key: CACHE_KEY, value: this.ratingsMap }, { onConflict: 'key' });
      
      if (error) {
        console.error('Failed to save ratings cache to Supabase:', error.message);
      }
      return;
    }
    
    // Fallback to file (for local development)
    try {
      const fs = require('fs').promises;
      const path = require('path');
      const CACHE_FILE = path.join(__dirname, '..', 'data', 'ratings-cache.json');
      await fs.writeFile(CACHE_FILE, JSON.stringify(this.ratingsMap, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to save ratings cache to file:', err.message);
    }
  }

  async fetchRatings() {
    console.log('Fetching ratings from Trakt...');
    let allRatings = [];
    let page = 1;
    const perPage = 100;

    while (true) {
      const response = await this.client.get('/sync/ratings', {
        params: { per_page: perPage, page }
      });
      const data = response.data;
      if (!data || data.length === 0) break;
      allRatings = allRatings.concat(data);
      console.log(`Page ${page}: Fetched ${data.length} ratings, total: ${allRatings.length}`);
      if (data.length < perPage) break;
      page++;
    }

    console.log(`Total ratings fetched from Trakt: ${allRatings.length}`);
    this.ratingsMap = {};
    let movieCount = 0, showCount = 0, episodeCount = 0;

    for (const item of allRatings) {
      if (item.movie) {
        this.ratingsMap[`movie_${item.movie.ids.trakt}`] = item.rating;
        movieCount++;
      } else if (item.show && !item.episode) {
        this.ratingsMap[`show_${item.show.ids.trakt}`] = item.rating;
        showCount++;
      } else if (item.episode) {
        const showId = item.show && item.show.ids && item.show.ids.trakt;
        if (showId !== undefined && item.episode.season !== undefined && item.episode.number !== undefined) {
          this.ratingsMap[`episode_${showId}_${item.episode.season}_${item.episode.number}`] = item.rating;
          episodeCount++;
        }
      }
    }

    console.log(`Ratings parsed: ${movieCount} movies, ${showCount} shows, ${episodeCount} episodes`);
    console.log(`Total entries in ratingsMap: ${Object.keys(this.ratingsMap).length}`);

    await this.saveCache();
    return this.ratingsMap;
  }

  applyRatings(events) {
    let applied = 0;

    for (const event of events) {
      delete event.rating;
    }

    // Build a map of show traktId -> rating for quick lookup
    const showRatings = {};
    for (const [key, rating] of Object.entries(this.ratingsMap)) {
      if (key.startsWith('show_')) {
        const showId = key.replace('show_', '');
        showRatings[showId] = rating;
      }
    }

    let movieApplied = 0, episodeApplied = 0;

    for (const event of events) {
      if (event.type === 'movie') {
        const key = `movie_${event.traktId}`;
        if (this.ratingsMap[key] !== undefined) {
          event.rating = this.ratingsMap[key];
          applied++;
          movieApplied++;
        }
      } else if (event.type === 'episode' && event.season !== undefined && event.episode !== undefined) {
        // Try episode-specific rating first
        const epKey = `episode_${event.traktId}_${event.season}_${event.episode}`;
        if (this.ratingsMap[epKey] !== undefined) {
          event.rating = this.ratingsMap[epKey];
          applied++;
          episodeApplied++;
        } else if (showRatings[event.traktId] !== undefined) {
          // Fall back to show rating
          event.rating = showRatings[event.traktId];
          applied++;
          episodeApplied++;
        }
      }
    }

    console.log(`Applied ${applied} ratings: ${movieApplied} movies, ${episodeApplied} episodes`);
    return applied;
  }

  async syncAndApply(events) {
    console.log('Loading ratings cache...');
    await this.loadCache();
    console.log(`Ratings cache loaded, ${Object.keys(this.ratingsMap).length} entries`);
    
    console.log('Fetching ratings from Trakt...');
    await this.fetchRatings();
    console.log(`Ratings fetched, ${Object.keys(this.ratingsMap).length} total entries`);
    
    const applied = this.applyRatings(events);
    console.log(`Applied ${applied} ratings to events`);
    return applied;
  }
}

module.exports = RatingsService;
