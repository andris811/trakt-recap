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
      const response = await this.client.get('/users/me/history', {
        params: {
          limit: perPage,
          page: page
        }
      });

      const data = response.data;

      if (!data || data.length === 0) {
        break;
      }

      allHistory = allHistory.concat(data);

      if (data.length < perPage) {
        break;
      }

      page++;
    }

    return allHistory;
  }

  async fetchStats() {
    const response = await this.client.get('/users/me/stats');
    return response.data;
  }
}

module.exports = TraktService;
