require('dotenv').config();

const express = require('express');
const eventsRouter = require('./routes/events');
const statsRouter = require('./routes/stats');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use('/api/events', eventsRouter);
app.use('/api/stats', statsRouter);

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

app.listen(PORT, () => {
  console.log(`Trakt Recap server running on port ${PORT}`);
});

module.exports = app;
