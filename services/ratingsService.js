const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

const TRAKT_API_URL = 'https://api.trakt.tv';
const CACHE_FILE = path.join(__dirname, '..', 'data', 'ratings-cache.json');

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
    try {
      const content = await fs.readFile(CACHE_FILE, 'utf-8');
      this.ratingsMap = JSON.parse(content);
    } catch {
      this.ratingsMap = {};
    }
  }

  async saveCache() {
    await fs.writeFile(CACHE_FILE, JSON.stringify(this.ratingsMap, null, 2), 'utf-8');
  }

  async fetchRatings() {
    let allRatings = [];
    let page = 1;
    const perPage = 1000;

    while (true) {
      const response = await this.client.get('/sync/ratings', {
        params: { limit: perPage, page }
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
        const showId = item.show?.ids?.trakt;
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
