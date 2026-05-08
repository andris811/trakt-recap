const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const supabase = require('./supabaseClient');

const TRAKT_API_URL = 'https://api.trakt.tv';
const CACHE_FILE = path.join(__dirname, '..', 'data', 'content-cache.json');
const BATCH_SIZE = 10;
const BATCH_DELAY_MS = 500;

function extractPoster(images) {
  const posterImages = images && images.poster;
  if (Array.isArray(posterImages) && posterImages.length > 0) {
    return `https://${posterImages[0]}`;
  }
  if (posterImages && posterImages.full) return posterImages.full;
  if (posterImages && posterImages.medium) return posterImages.medium;
  return null;
}

function extractDetails(data, type) {
  return {
    runtime: data.runtime || 0,
    genres: data.genres || [],
    poster: extractPoster(data.images),
    title: data.title,
    overview: data.overview || null,
    country: data.country || null,
    released: type === 'movie' ? (data.released || null) : (data.first_aired || null),
    year: data.year || null,
    traktRating: data.rating || null,
    traktVotes: data.votes || 0,
    imdbId: (data.ids && data.ids.imdb) || null,
    commentCount: data.comment_count || 0
  };
}

class EnrichmentService {
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
    this.cache = {};
  }

  async loadCache() {
    if (supabase) {
      const { data, error } = await supabase
        .from('content_cache')
        .select('key, value');
      if (!error && data) {
        this.cache = {};
        for (const item of data) {
          this.cache[item.key] = item.value;
        }
      }
    } else {
      try {
        const content = await fs.readFile(CACHE_FILE, 'utf-8');
        this.cache = JSON.parse(content);
      } catch {
        this.cache = {};
      }
    }
  }

  async saveCache() {
    if (supabase) {
      const entries = Object.entries(this.cache).map(([key, value]) => ({
        key,
        value
      }));
      const { error } = await supabase
        .from('content_cache')
        .upsert(entries, { onConflict: 'key' });
      if (error) console.error('Failed to save cache to Supabase:', error.message);
    } else {
      await fs.writeFile(CACHE_FILE, JSON.stringify(this.cache, null, 2), 'utf-8');
    }
  }

  async fetchMovieDetails(traktId) {
    const cacheKey = `movie_${traktId}`;
    if (this.cache[cacheKey]) {
      return this.cache[cacheKey];
    }

    try {
      const response = await this.client.get(`/movies/${traktId}`, {
        params: { extended: 'full' }
      });
      const enriched = extractDetails(response.data, 'movie');
      this.cache[cacheKey] = enriched;
      return enriched;
    } catch (err) {
      console.error(`Failed to fetch movie ${traktId}:`, err.message);
      return { runtime: 0, genres: [], poster: null, title: null, overview: null, country: null, released: null, year: null, traktRating: null, traktVotes: 0, imdbId: null, commentCount: 0 };
    }
  }

  async fetchShowDetails(traktId) {
    const cacheKey = `show_${traktId}`;
    if (this.cache[cacheKey]) {
      return this.cache[cacheKey];
    }

    try {
      const response = await this.client.get(`/shows/${traktId}`, {
        params: { extended: 'full' }
      });
      const enriched = extractDetails(response.data, 'show');
      this.cache[cacheKey] = enriched;
      return enriched;
    } catch (err) {
      console.error(`Failed to fetch show ${traktId}:`, err.message);
      return { runtime: 0, genres: [], poster: null, title: null, overview: null, country: null, released: null, year: null, traktRating: null, traktVotes: 0, imdbId: null, commentCount: 0 };
    }
  }

  async enrichEvents(events, saveCallback) {
    await this.loadCache();

    const uniqueItems = new Map();
    for (const event of events) {
      const key = `${event.type}_${event.traktId}`;
      if (!uniqueItems.has(key)) {
        uniqueItems.set(key, {
          key,
          type: event.type,
          traktId: event.traktId,
          poster: event.poster,
          runtime: event.runtime,
          genres: event.genres
        });
      }
    }

    const missing = [...uniqueItems.values()].filter(item => !item.poster || !item.genres || item.genres.length === 0);
    const totalMissing = missing.length;

    console.log(`Enrichment: ${totalMissing} items need enrichment out of ${uniqueItems.size} unique items`);

    for (let i = 0; i < missing.length; i += BATCH_SIZE) {
      const batch = missing.slice(i, i + BATCH_SIZE);
      await Promise.all(batch.map(async (item) => {
        const details = item.type === 'movie'
          ? await this.fetchMovieDetails(item.traktId)
          : await this.fetchShowDetails(item.traktId);
        item.runtime = details.runtime;
        item.genres = details.genres;
        item.poster = details.poster;
      }));

      // Update cache
      for (const item of batch) {
        this.cache[item.key] = {
          runtime: item.runtime,
          genres: item.genres,
          poster: item.poster
        };
      }

      if (i + BATCH_SIZE < missing.length) {
        await new Promise(r => setTimeout(r, BATCH_DELAY_MS));
      }
    }

    await this.saveCache();

    // Update events with enriched data
    for (const event of events) {
      const key = `${event.type}_${event.traktId}`;
      const cached = this.cache[key];
      if (cached) {
        event.runtime = cached.runtime;
        event.genres = cached.genres;
        event.poster = cached.poster;
      }
    }

    // Save to Supabase if callback provided
    if (saveCallback) {
      console.log('Saving enriched data to Supabase...');
      await saveCallback(events);
    }

    return {
      total: events.length,
      uniqueItems: uniqueItems.size,
      enriched: totalMissing,
      wasCached: uniqueItems.size - totalMissing
    };
  }

  async getContentDetails(type, traktId) {
    await this.loadCache();
    const cacheKey = `${type}_${traktId}`;
    if (this.cache[cacheKey]) {
      return this.cache[cacheKey];
    }

    const details = type === 'movie'
      ? await this.fetchMovieDetails(traktId)
      : await this.fetchShowDetails(traktId);
    await this.saveCache();
    return details;
  }

  async getComments(type, traktId, limit = 100) {
    try {
      const endpoint = type === 'movie' ? `/movies/${traktId}/comments/recent` : `/shows/${traktId}/comments/recent`;
      const response = await this.client.get(endpoint, {
        params: { limit, sort: 'likes' }
      });
      return response.data.filter(c => !c.spoiler && c.parent_id === 0);
    } catch (err) {
      console.error(`Failed to fetch comments for ${type} ${traktId}:`, err.message);
      return [];
    }
  }

  async getEpisodeDetails(showId, season, number) {
    const cacheKey = `episode_${showId}_${season}_${number}`;
    if (this.cache[cacheKey]) {
      return this.cache[cacheKey];
    }

    try {
      const response = await this.client.get(`/shows/${showId}/seasons/${season}/episodes/${number}`, {
        params: { extended: 'full' }
      });
      const data = response.data;
      const screenshot = data.images && data.images.screenshot;
      const details = {
        title: data.title,
        overview: data.overview || null,
        runtime: data.runtime || 0,
        rating: data.rating || null,
        votes: data.votes || 0,
        firstAired: data.first_aired || null,
        imdbId: (data.ids && data.ids.imdb) || null,
        commentCount: data.comment_count || 0,
        screenshot: screenshot && screenshot.length > 0 ? `https://${screenshot[0]}` : null
      };
      this.cache[cacheKey] = details;
      await this.saveCache();
      return details;
    } catch (err) {
      console.error(`Failed to fetch episode ${showId} S${season}E${number}:`, err.message);
      return { title: null, overview: null, runtime: 0, rating: null, votes: 0, firstAired: null, imdbId: null, commentCount: 0, screenshot: null };
    }
  }

  async getEpisodeComments(showId, season, number, limit = 100) {
    try {
      const response = await this.client.get(`/shows/${showId}/seasons/${season}/episodes/${number}/comments/recent`, {
        params: { limit, sort: 'likes' }
      });
      return response.data.filter(c => !c.spoiler && c.parent_id === 0);
    } catch (err) {
      console.error(`Failed to fetch episode comments:`, err.message);
      return [];
    }
  }

  async getSeasonEpisodes(showId, season) {
    const cacheKey = `season_${showId}_${season}`;
    if (this.cache[cacheKey]) {
      return this.cache[cacheKey];
    }

    try {
      const response = await this.client.get(`/shows/${showId}/seasons/${season}`, {
        params: { extended: 'full' }
      });
      const episodes = response.data.map(ep => ({
        number: ep.number,
        title: ep.title,
        overview: ep.overview || null,
        runtime: ep.runtime || 0,
        rating: ep.rating || null,
        votes: ep.votes || 0,
        firstAired: ep.first_aired || null,
        imdbId: (ep.ids && ep.ids.imdb) || null,
        commentCount: ep.comment_count || 0,
        screenshot: (ep.images && ep.images.screenshot && ep.images.screenshot[0]) ? `https://${ep.images.screenshot[0]}` : null
      }));
      this.cache[cacheKey] = episodes;
      await this.saveCache();
      return episodes;
    } catch (err) {
      console.error(`Failed to fetch season ${showId} S${season}:`, err.message);
      return [];
    }
  }

  async getShowSeasons(showId) {
    const cacheKey = `seasons_${showId}`;
    if (this.cache[cacheKey]) {
      return this.cache[cacheKey];
    }

    try {
      const response = await this.client.get(`/shows/${showId}/seasons`, {
        params: { extended: 'full' }
      });
      const seasons = response.data
        .filter(s => s.number > 0)
        .map(s => ({
          number: s.number,
          title: s.title || `Season ${s.number}`,
          episodeCount: s.episode_count || 0,
          rating: s.rating || null,
          votes: s.votes || 0,
          firstAired: s.first_aired || null,
          overview: s.overview || null
        }));
      this.cache[cacheKey] = seasons;
      await this.saveCache();
      return seasons;
    } catch (err) {
      console.error(`Failed to fetch seasons for show ${showId}:`, err.message);
      return [];
    }
  }

  async getContentPeople(type, traktId) {
    const cacheKey = `people_${type}_${traktId}`;
    if (this.cache[cacheKey]) {
      return this.cache[cacheKey];
    }

    try {
      const endpoint = type === 'movie' ? `/movies/${traktId}/people` : `/shows/${traktId}/people`;
      const response = await this.client.get(endpoint, {
        params: { extended: 'full' }
      });
      const cast = (response.data.cast || []).map(person => ({
        personId: person.person.ids.trakt,
        name: person.person.name,
        character: person.character,
        headshot: (person.person.images && person.person.images.headshot) ? `https://${person.person.images.headshot[0]}` : null,
        tmdbId: person.person.ids.tmdb || null
      }));
      this.cache[cacheKey] = cast;
      await this.saveCache();
      return cast;
    } catch (err) {
      console.error(`Failed to fetch people for ${type} ${traktId}:`, err.message);
      return [];
    }
  }

  async getPersonDetails(personId) {
    const cacheKey = `person_${personId}`;
    if (this.cache[cacheKey]) {
      return this.cache[cacheKey];
    }

    try {
      const response = await this.client.get(`/people/${personId}`, {
        params: { extended: 'full' }
      });
      const data = response.data;
      const details = {
        name: data.name,
        biography: data.biography || null,
        birthday: data.birthday || null,
        death: data.death || null,
        birthplace: data.birthplace || null,
        homepage: data.homepage || null,
        headshot: (data.images && data.images.headshot) ? `https://${data.images.headshot[0]}` : null,
        tmdbId: (data.ids && data.ids.tmdb) || null
      };
      this.cache[cacheKey] = details;
      await this.saveCache();
      return details;
    } catch (err) {
      console.error(`Failed to fetch person ${personId}:`, err.message);
      return null;
    }
  }

  async getPersonMovies(personId) {
    const cacheKey = `person_movies_${personId}`;
    if (this.cache[cacheKey] && this.cache[cacheKey].length > 0) {
      return this.cache[cacheKey];
    }

    try {
      const response = await this.client.get(`/people/${personId}/movies`);
      const castData = response.data.cast || response.data;

      const movies = [];
      for (const m of castData) {
        if (!m.movie || !m.movie.ids || !m.movie.ids.trakt) continue;

        const traktId = m.movie.ids.trakt;
        let details = this.cache[`movie_${traktId}`];
        if (!details) {
          try {
            const res = await this.client.get(`/movies/${traktId}`, { params: { extended: 'full' } });
             details = {
               title: res.data.title,
               year: res.data.year,
               poster: (res.data.images && res.data.images.poster) ? `https://${res.data.images.poster[0]}` : null,
               released: res.data.released || null,
               rating: res.data.rating || null
             };
             this.cache[`movie_${traktId}`] = details;
          } catch {
            details = { title: m.movie.title, year: m.movie.year, poster: null, released: null, rating: null };
          }
        }

        movies.push({
          title: details.title || m.movie.title,
          year: details.year || m.movie.year,
          traktId,
          poster: details.poster,
          character: m.character || null,
          released: details.released,
          rating: details.rating
        });
      }

      if (movies.length > 0) {
        this.cache[cacheKey] = movies;
        await this.saveCache();
      }
      return movies;
    } catch (err) {
      console.error(`Failed to fetch movies for person ${personId}:`, err.message);
      return [];
    }
  }

  async getPersonShows(personId) {
    const cacheKey = `person_shows_${personId}`;
    if (this.cache[cacheKey] && this.cache[cacheKey].length > 0) {
      return this.cache[cacheKey];
    }

    try {
      const response = await this.client.get(`/people/${personId}/shows`);
      const castData = response.data.cast || response.data;

      const shows = [];
      for (const s of castData) {
        if (!s.show || !s.show.ids || !s.show.ids.trakt) continue;

        const traktId = s.show.ids.trakt;
        let details = this.cache[`show_${traktId}`];
        if (!details) {
          try {
            const res = await this.client.get(`/shows/${traktId}`, { params: { extended: 'full' } });
             details = {
               title: res.data.title,
               year: res.data.year,
               poster: (res.data.images && res.data.images.poster) ? `https://${res.data.images.poster[0]}` : null,
               firstAired: res.data.first_aired || null,
               rating: res.data.rating || null
             };
             this.cache[`show_${traktId}`] = details;
          } catch {
            details = { title: s.show.title, year: s.show.year, poster: null, firstAired: null, rating: null };
          }
        }

        shows.push({
          title: details.title || s.show.title,
          year: details.year || s.show.year,
          traktId,
          poster: details.poster,
          character: s.character || null,
          firstAired: details.firstAired,
          rating: details.rating
        });
      }

      if (shows.length > 0) {
        this.cache[cacheKey] = shows;
        await this.saveCache();
      }
      return shows;
    } catch (err) {
      console.error(`Failed to fetch shows for person ${personId}:`, err.message);
      return [];
    }
  }
}

module.exports = EnrichmentService;
