require('dotenv').config();

const axios = require('axios');
const readline = require('readline');
const open = require('child_process').exec;

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const CLIENT_ID = process.env.TRAKT_CLIENT_ID;
const CLIENT_SECRET = process.env.TRAKT_CLIENT_SECRET;
const REDIRECT_URI = process.env.TRAKT_REDIRECT_URI;

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('Error: TRAKT_CLIENT_ID and TRAKT_CLIENT_SECRET must be set in .env');
  process.exit(1);
}

const authUrl = `https://trakt.tv/oauth/authorize?response_type=code&client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(process.env.TRAKT_REDIRECT_URI)}`;

console.log('=== Trakt Access Token Generator ===\n');
console.log('Opening Trakt authorization page in your browser...');
console.log('If it does not open, visit this URL manually:\n');
console.log(authUrl);
console.log('\n');

open(`open "${authUrl}"`);

rl.question('Paste the authorization code from Trakt: ', async (code) => {
  try {
    console.log('\nExchanging code for access token...');

    const response = await axios.post('https://api.trakt.tv/oauth/token', {
      code: code.trim(),
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: REDIRECT_URI,
      grant_type: 'authorization_code'
    });

    const accessToken = response.data.access_token;
    const refreshToken = response.data.refresh_token;

    console.log('\nSuccess! Access token obtained.\n');
    console.log('Add this to your .env file:');
    console.log(`TRAKT_ACCESS_TOKEN=${accessToken}`);
    console.log(`TRAKT_REFRESH_TOKEN=${refreshToken}`);

    rl.close();
  } catch (error) {
    console.error('\nFailed to get access token:');
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error(JSON.stringify(error.response.data, null, 2));
    } else {
      console.error(error.message);
    }
    rl.close();
    process.exit(1);
  }
});
