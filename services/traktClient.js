const axios = require('axios');
const fs = require('fs');
const path = require('path');

const TRAKT_API_URL = 'https://api.trakt.tv';
const TOKEN_CACHE_FILE = path.join(__dirname, '..', 'data', 'token-cache.json');
const TMP_TOKEN_CACHE = '/tmp/trakt-token-cache.json';

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

function loadCachedTokens() {
  for (const file of [TOKEN_CACHE_FILE, TMP_TOKEN_CACHE]) {
    try {
      const data = JSON.parse(fs.readFileSync(file, 'utf-8'));
      if (data.accessToken && data.refreshToken) {
        console.log(`Loaded cached tokens from ${file}`);
        return data;
      }
    } catch {}
  }
  return null;
}

function saveCachedTokens(accessToken, refreshToken) {
  const payload = JSON.stringify({ accessToken, refreshToken });
  try {
    fs.mkdirSync(path.dirname(TOKEN_CACHE_FILE), { recursive: true });
    fs.writeFileSync(TOKEN_CACHE_FILE, payload, 'utf-8');
  } catch {}
  try {
    fs.writeFileSync(TMP_TOKEN_CACHE, payload, 'utf-8');
  } catch {}
}

function createClient(clientId, accessToken, clientSecret, refreshToken) {
  if (client) return client;
  _clientId = clientId;
  _clientSecret = clientSecret;

  const cached = loadCachedTokens();
  _accessToken = cached?.accessToken || accessToken;
  _refreshToken = cached?.refreshToken || refreshToken;

  if (cached) {
    console.log('Using cached tokens instead of env vars');
  }

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
          saveCachedTokens(_accessToken, _refreshToken);

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
