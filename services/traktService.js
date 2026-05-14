const axios = require('axios');

const TRAKT_API_URL = 'https://api.trakt.tv';

class TraktService {
  constructor(clientId, accessToken, clientSecret, refreshToken) {
    this.clientId = clientId;
    this.accessToken = accessToken;
    this.clientSecret = clientSecret;
    this.refreshToken = refreshToken;
    this.client = axios.create({
      baseURL: TRAKT_API_URL,
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'trakt-api-key': this.clientId,
        'trakt-api-version': '2',
        'Content-Type': 'application/json'
      }
    });
    this._isRefreshing = false;
    this._pendingRequests = [];
    this._setupInterceptor();
  }

  _setupInterceptor() {
    this.client.interceptors.response.use(
      response => response,
      async error => {
        const originalRequest = error.config;

        if (error.response?.status === 401 && !originalRequest._retry) {
          if (this._isRefreshing) {
            return new Promise((resolve, reject) => {
              this._pendingRequests.push({ resolve, reject, config: originalRequest });
            });
          }

          originalRequest._retry = true;
          this._isRefreshing = true;

          try {
            const newToken = await this._refreshAccessToken();
            this.accessToken = newToken;
            this.client.defaults.headers['Authorization'] = `Bearer ${newToken}`;
            originalRequest.headers['Authorization'] = `Bearer ${newToken}`;

            this._isRefreshing = false;
            this._pendingRequests.forEach(({ resolve, config }) => {
              config.headers['Authorization'] = `Bearer ${newToken}`;
              resolve(this.client(config));
            });
            this._pendingRequests = [];

            return this.client(originalRequest);
          } catch (refreshError) {
            console.error('Token refresh failed:', refreshError.response?.data || refreshError.message);
            this._isRefreshing = false;
            const authError = new Error(
              'Trakt authorization failed. Your access token has expired and the refresh token is invalid. '
              + 'Visit /callback after re-authorizing the app on Trakt to get a new token.'
            );
            authError.statusCode = 401;
            authError.originalError = error;
            authError.refreshError = refreshError;
            this._pendingRequests.forEach(({ reject }) => {
              reject(authError);
            });
            this._pendingRequests = [];
            return Promise.reject(authError);
          }
        }

        return Promise.reject(error);
      }
    );
  }

  async _refreshAccessToken() {
    if (!this.clientSecret || !this.refreshToken) {
      throw new Error('No client secret or refresh token available');
    }

    console.log('Refreshing expired Trakt access token...');
    const response = await axios.post('https://api.trakt.tv/oauth/token', {
      refresh_token: this.refreshToken,
      client_id: this.clientId,
      client_secret: this.clientSecret,
      redirect_uri: process.env.TRAKT_REDIRECT_URI || 'https://trakt-recap.vercel.app/callback',
      grant_type: 'refresh_token'
    });

    const newToken = response.data.access_token;
    if (response.data.refresh_token) {
      this.refreshToken = response.data.refresh_token;
    }

    console.log('Trakt access token refreshed successfully');
    return newToken;
  }

  async fetchHistory() {
    let allHistory = [];
    let page = 1;
    const perPage = 100;
    let retryCount = 0;
    const maxRetries = 3;
    
    while (true) {
      try {
        const response = await this.client.get('/users/me/history', {
          params: {
            limit: perPage,
            page: page
          }
        });

        const data = response.data;

        if (!data || data.length === 0) {
          console.log(`Page ${page}: No more data, stopping pagination`);
          break;
        }

        allHistory = allHistory.concat(data);
        console.log(`Page ${page}: Fetched ${data.length} items, total: ${allHistory.length}`);

        // Check if we're hitting rate limit
        const remaining = response.headers['x-ratelimit-remaining'];
        const reset = response.headers['x-ratelimit-reset'];
        
        if (remaining && parseInt(remaining) < 5) {
          console.log(`Rate limit low (${remaining} remaining). Waiting for reset at ${reset}...`);
          const waitTime = (parseInt(reset) * 1000) - Date.now() + 1000;
          if (waitTime > 0 && waitTime < 30000) {
            await new Promise(resolve => setTimeout(resolve, waitTime));
            continue;
          }
        }

        if (data.length < perPage) {
          console.log(`Page ${page}: Got ${data.length} items (< ${perPage}), stopping pagination`);
          break;
        }

        page++;
        retryCount = 0;
        
        // Safety check to avoid infinite loops
        if (page > 200) {
          console.log('Safety: Reached 200 pages, stopping');
          break;
        }
        
        // Delay between requests to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        if (error.response?.status === 429) {
          // Rate limited - wait and retry
          retryCount++;
          if (retryCount <= maxRetries) {
            console.log(`Rate limited (attempt ${retryCount}/${maxRetries}). Waiting 5 seconds...`);
            await new Promise(resolve => setTimeout(resolve, 5000));
            continue;
          }
        }
        if (error.statusCode === 401) {
          console.error('Auth error:', error.message);
          if (allHistory.length === 0) {
            throw error;
          }
          console.warn(`Auth after ${allHistory.length} items, returning partial data`);
          break;
        }
        console.error(`Error fetching page ${page}:`, error.response?.data || error.message);
        break;
      }
    }

    console.log(`fetchHistory complete: ${allHistory.length} items fetched`);
    return allHistory;
  }

  async fetchStats() {
    try {
      const response = await this.client.get('/users/me/stats');
      return response.data;
    } catch (error) {
      console.error('Failed to fetch stats from Trakt:', error.response?.data || error.message);
      return null;
    }
  }
}

module.exports = TraktService;
