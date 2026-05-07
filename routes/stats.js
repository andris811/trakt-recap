const express = require('express');
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    console.log('Stats endpoint called');
    res.json({
      message: 'API is working',
      timestamp: new Date().toISOString(),
      supabase: !!require('../services/supabaseClient')
    });
  } catch (error) {
    console.error('Stats error:', error.message);
    res.status(500).json({ error: 'Failed to calculate stats', details: error.message });
  }
});

module.exports = router;
