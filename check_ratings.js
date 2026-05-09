require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

async function check() {
  // Check content_cache for ratings
  const { data: cache } = await supabase
    .from('content_cache')
    .select('*')
    .eq('key', 'ratings_map');
  
  if (cache && cache[0]) {
    const ratings = cache[0].value || {};
    const keys = Object.keys(ratings);
    console.log('Ratings in Supabase cache:', keys.length);
    console.log('Sample keys:', keys.slice(0, 5));
    console.log('Sample entries:', keys.slice(0, 3).map(k => `${k}: ${ratings[k]}`));
  } else {
    console.log('No ratings cache in Supabase');
  }
  
  // Count ratings in watch_history table
  const { data: rated } = await supabase
    .from('watch_history')
    .select('rating')
    .not('rating', 'is', null);
  
  console.log('Rated items in watch_history:', rated ? rated.length : 0);
}

check().catch(console.error);
