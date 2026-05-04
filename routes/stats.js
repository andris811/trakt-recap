const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const { calculateStats } = require('../services/statsService');

const router = express.Router();

const DATA_FILE = path.join(__dirname, '..', 'data', 'watch-history.json');
const STATS_FILE = path.join(__dirname, '..', 'data', 'trakt-stats.json');
const RATINGS_FILE = path.join(__dirname, '..', 'data', 'ratings-cache.json');

async function loadHistory() {
  try {
    const content = await fs.readFile(DATA_FILE, 'utf-8');
    return JSON.parse(content);
  } catch {
    return [];
  }
}

async function loadTraktStats() {
  try {
    const content = await fs.readFile(STATS_FILE, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

async function loadShowRatings() {
  try {
    const content = await fs.readFile(RATINGS_FILE, 'utf-8');
    const cache = JSON.parse(content);
    const showRatings = {};
    for (const [key, value] of Object.entries(cache)) {
      if (key.startsWith('show_')) {
        const traktId = key.replace('show_', '');
        showRatings[traktId] = value;
      }
    }
    return showRatings;
  } catch {
    return {};
  }
}

router.get('/', async (req, res) => {
  try {
    const [events, traktStats, showRatings] = await Promise.all([
      loadHistory(),
      loadTraktStats(),
      loadShowRatings()
    ]);
    const stats = calculateStats(events, traktStats);
    stats.showRatings = showRatings;
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: 'Failed to calculate stats', details: error.message });
  }
});

module.exports = router;
