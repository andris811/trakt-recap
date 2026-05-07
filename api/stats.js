const express = require('express');
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    res.json({
      message: 'API is working',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to calculate stats', details: error.message });
  }
});

module.exports = router;
