const express = require('express');
const eventsRouter = require('./routes/events');
const statsRouter = require('./routes/stats');

const app = express();

app.use(express.json());
app.use('/api/events', eventsRouter);
app.use('/api/stats', statsRouter);

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

// Export for Vercel serverless
module.exports = app;
