const axios = require('axios');

const TRAKT_API_URL = 'https://api.trakt.tv';

let client = null;
let _isRefreshing = false;
let _pendingRequests = [];
let _clientId = null;
let _clientSecret = null;
let _refreshToken = null;
let _accessToken = null;

function getAccessToken() {
  return _accessToken;
}

function createClient(clientId, accessToken, clientSecret, refreshToken) {
  if (client) return client;
  _clientId = clientId;
  _accessToken = accessToken;
  _clientSecret = clientSecret;
  _refreshToken = refreshToken;

  client = axios.create({
    baseURL: TRAKT_API_URL,
    headers: {
      'Authorization': `Bearer ${_accessToken}`,
      'trakt-api-key': _clientId,
      'trakt-api-version': '2',
      'Content-Type': 'application/json'
    }
  });

  client.interceptors.response.use(
    response => response,
    async error => {
      const originalRequest = error.config;

      if (error.response?.status === 401 && !originalRequest._retry) {
        if (_isRefreshing) {
          return new Promise((resolve, reject) => {
            _pendingRequests.push({ resolve, reject, config: originalRequest });
          });
        }

        originalRequest._retry = true;
        _isRefreshing = true;

        try {
          const response = await axios.post('https://api.trakt.tv/oauth/token', {
            refresh_token: _refreshToken,
            client_id: _clientId,
            client_secret: _clientSecret,
            redirect_uri: process.env.TRAKT_REDIRECT_URI || 'https://trakt-recap.vercel.app/callback',
            grant_type: 'refresh_token'
          });

          const newToken = response.data.access_token;
          if (response.data.refresh_token) {
            _refreshToken = response.data.refresh_token;
          }
          _accessToken = newToken;

          client.defaults.headers['Authorization'] = `Bearer ${newToken}`;
          originalRequest.headers['Authorization'] = `Bearer ${newToken}`;

          _isRefreshing = false;
          _pendingRequests.forEach(({ resolve, config }) => {
            config.headers['Authorization'] = `Bearer ${newToken}`;
            resolve(client(config));
          });
          _pendingRequests = [];

          return client(originalRequest);
        } catch (refreshError) {
          console.error('Token refresh failed:', refreshError.response?.data || refreshError.message);
          _isRefreshing = false;
          const authError = new Error(
            'Trakt authorization failed. Your access token has expired and the refresh token is invalid. '
            + 'Visit /callback after re-authorizing the app on Trakt to get a new token.'
          );
          authError.statusCode = 401;
          _pendingRequests.forEach(({ reject }) => {
            reject(authError);
          });
          _pendingRequests = [];
          return Promise.reject(authError);
        }
      }

      return Promise.reject(error);
    }
  );

  return client;
}

function getClient() {
  return client;
}

module.exports = { createClient, getClient, getAccessToken };
