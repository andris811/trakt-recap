const express = require('express');
const axios = require('axios');
const path = require('path');
const eventsRouter = require('./routes/events');
const statsRouter = require('./routes/stats');

const app = express();

app.use(express.json());

// Password gate middleware
app.use('/api/', (req, res, next) => {
  const pw = process.env.APP_PASSWORD;
  if (!pw) return next();
  if (req.headers['x-app-password'] === pw) return next();
  res.status(401).json({ error: 'Unauthorized' });
});

app.use('/api/events', eventsRouter);
app.use('/api/stats', statsRouter);

// Debug endpoint
app.get('/debug', (req, res) => {
  res.json({
    hasSupabaseUrl: !!process.env.SUPABASE_URL,
    hasSupabaseKey: !!process.env.SUPABASE_ANON_KEY,
    hasTraktClientId: !!process.env.TRAKT_CLIENT_ID,
    hasTraktSecret: !!process.env.TRAKT_CLIENT_SECRET,
    hasTraktToken: !!process.env.TRAKT_ACCESS_TOKEN,
    hasRedirectUri: !!process.env.TRAKT_REDIRECT_URI,
    hasAppPassword: !!process.env.APP_PASSWORD,
    nodeEnv: process.env.NODE_ENV
  });
});

// Proxy Trakt images
app.use('/trakt-images', async (req, res) => {
  try {
    const imagePath = req.path.replace(/^\/trakt-images/, '');
    const imageUrl = `https://media.trakt.tv${imagePath}`;
    const response = await axios.get(imageUrl, { responseType: 'stream' });
    
    // Forward content type
    if (response.headers['content-type']) {
      res.setHeader('Content-Type', response.headers['content-type']);
    }
    
    response.data.pipe(res);
  } catch (error) {
    res.status(404).send('Image not found');
  }
});

// Serve frontend static files
const frontendDist = path.join(__dirname, 'frontend', 'dist');
app.use(express.static(frontendDist));

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
    const refreshToken = response.data.refresh_token;
    
    res.send(`
      <html>
        <body style="font-family: monospace; padding: 40px;">
          <h2>Authorization Successful!</h2>
          <p>Add these to your Vercel environment variables:</p>
          <p style="font-size: 14px; margin-top: 20px; color: #666;">TRAKT_ACCESS_TOKEN</p>
          <p style="font-size: 18px; background: #f0f0f0; padding: 10px; word-break: break-all;">${accessToken}</p>
          ${refreshToken ? `
          <p style="font-size: 14px; margin-top: 20px; color: #666;">TRAKT_REFRESH_TOKEN</p>
          <p style="font-size: 18px; background: #f0f0f0; padding: 10px; word-break: break-all;">${refreshToken}</p>
          ` : ''}
          <p style="margin-top: 30px;">Go to Vercel Dashboard → Settings → Environment Variables and add these tokens.</p>
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

// SPA catch-all - serve index.html for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(frontendDist, 'index.html'));
});

// Export for Vercel serverless
module.exports = app;
