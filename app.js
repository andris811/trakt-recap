require('dotenv').config();

const express = require('express');
const path = require('path');
const eventsRouter = require('./routes/events');
const statsRouter = require('./routes/stats');
const supabase = require('./services/supabaseClient');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use('/api/events', eventsRouter);
app.use('/api/stats', statsRouter);

// Serve frontend static files
const frontendDistPath = path.join(__dirname, 'frontend', 'dist');
app.use(express.static(frontendDistPath));

// Fallback for SPA - serve index.html for all non-API routes
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api') && !req.path.startsWith('/callback')) {
    res.sendFile(path.join(frontendDistPath, 'index.html'));
  }
});

// Image proxy for Trakt images (only if not using Supabase)
if (!supabase) {
  app.use('/trakt-images', (req, res) => {
    const imageUrl = 'https://media.trakt.tv' + req.path;
    fetch(imageUrl)
      .then(response => {
        res.status(response.status);
        response.headers.forEach((value, name) => {
          res.setHeader(name, value);
        });
        response.body.pipe(res);
      })
      .catch(() => res.status(404).send('Image not found'));
  });
}

app.get('/callback', (req, res) => {
  const code = req.query.code;
  res.send(`
    <html>
      <body style="font-family: monospace; padding: 40px;">
        <h2>Authorization Code:</h2>
        <p style="font-size: 18px; background: #f0f0f0; padding: 10px; word-break: break-all;">${code || 'No code received'}</p>
        <p>Copy this code and paste it into your terminal.</p>
      </body>
    </html>
  `);
});

// Always export for Vercel serverless
module.exports = app;
