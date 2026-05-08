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
      if (data.length < perPage) break;
      page++;
    }

    this.ratingsMap = {};

    for (const item of allRatings) {
      if (item.movie) {
        this.ratingsMap[`movie_${item.movie.ids.trakt}`] = item.rating;
      } else if (item.show && !item.episode) {
        this.ratingsMap[`show_${item.show.ids.trakt}`] = item.rating;
      } else if (item.episode) {
        const showId = item.show && item.show.ids && item.show.ids.trakt;
        if (showId !== undefined && item.episode.season !== undefined && item.episode.number !== undefined) {
          this.ratingsMap[`episode_${showId}_${item.episode.season}_${item.episode.number}`] = item.rating;
        }
      }
    }

    await this.saveCache();
    return this.ratingsMap;
  }

  applyRatings(events) {
    let applied = 0;

    for (const event of events) {
      delete event.rating;
    }

    for (const event of events) {
      if (event.type === 'movie') {
        const key = `movie_${event.traktId}`;
        if (this.ratingsMap[key] !== undefined) {
          event.rating = this.ratingsMap[key];
          applied++;
        }
      } else if (event.type === 'episode' && event.season !== undefined && event.episode !== undefined) {
        const key = `episode_${event.traktId}_${event.season}_${event.episode}`;
        if (this.ratingsMap[key] !== undefined) {
          event.rating = this.ratingsMap[key];
          applied++;
        }
      }
    }

    return applied;
  }

  async syncAndApply(events) {
    await this.loadCache();
    await this.fetchRatings();
    return this.applyRatings(events);
  }
}

module.exports = RatingsService;
