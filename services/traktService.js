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

        if (data.length < perPage) {
          console.log(`Page ${page}: Got ${data.length} items (< ${perPage}), stopping pagination`);
          break;
        }

        page++;
        
        // Safety check to avoid infinite loops
        if (page > 200) {
          console.log('Safety: Reached 200 pages, stopping');
          break;
        }
      } catch (error) {
        console.error(`Error fetching page ${page}:`, error.response?.data || error.message);
        break;
      }
    }

    return allHistory;
  }

  async fetchStats() {
    const response = await this.client.get('/users/me/stats');
    return response.data;
  }
}

module.exports = TraktService;
