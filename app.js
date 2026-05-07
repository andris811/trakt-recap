const express = require('express');
const axios = require('axios');
const eventsRouter = require('./routes/events');
const statsRouter = require('./routes/stats');

const app = express();

app.use(express.json());
app.use('/api/events', eventsRouter);
app.use('/api/stats', statsRouter);

app.get('/callback', async (req, res) => {
  const code = req.query.code;
  
  if (!code) {
    return res.send('<html><body style="font-family: monospace; padding: 40px;"><h2>No authorization code received</h2></body></html>');
  }

  try {
    const response = await axios.post('https://api.trakt.tv/oauth/token', {
      code: code,
      client_id: process.env.TRAKT_CLIENT_ID,
      client_secret: process.env.TRAKT_CLIENT_SECRET,
      redirect_uri: process.env.TRAKT_REDIRECT_URI || 'https://trakt-recap.vercel.app/callback',
      grant_type: 'authorization_code'
    });

    const accessToken = response.data.access_token;
    
    res.send(`
      <html>
        <body style="font-family: monospace; padding: 40px;">
          <h2>Authorization Successful!</h2>
          <p>Add this to your Vercel environment variables:</p>
          <p style="font-size: 18px; background: #f0f0f0; padding: 10px; word-break: break-all;">TRAKT_ACCESS_TOKEN=${accessToken}</p>
          <p>Go to Vercel Dashboard → Settings → Environment Variables and add this token.</p>
        </body>
      </html>
    `);
  } catch (error) {
    res.send(`
      <html>
        <body style="font-family: monospace; padding: 40px;">
          <h2>Error exchanging code</h2>
          <p>${error.message}</p>
        </body>
      </html>
    `);
  }
});

// Export for Vercel serverless
module.exports = app;
