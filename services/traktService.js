const axios = require('axios');

const TRAKT_API_URL = 'https://api.trakt.tv';

class TraktService {
  constructor(clientId, accessToken) {
    this.clientId = clientId;
    this.accessToken = accessToken;
    this.client = axios.create({
      baseURL: TRAKT_API_URL,
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'trakt-api-key': this.clientId,
        'trakt-api-version': '2',
        'Content-Type': 'application/json'
      }
    });
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
        console.error(`Error fetching page ${page}:`, error.response?.data || error.message);
        break;
      }
    }

    console.log(`fetchHistory complete: ${allHistory.length} items fetched`);
    return allHistory;
  }

  async fetchStats() {
    const response = await this.client.get('/users/me/stats');
    return response.data;
  }
}

module.exports = TraktService;
