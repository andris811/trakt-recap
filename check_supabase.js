const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.log('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkData() {
  console.log('=== Watch History Stats ===');
  
  const { count: total } = await supabase
    .from('watch_history')
    .select('*', { count: 'exact', head: true });
  console.log('Total items:', total);
  
  const { count: movies } = await supabase
    .from('watch_history')
    .select('*', { count: 'exact', head: true })
    .eq('type', 'movie');
  console.log('Movies:', movies);
  
  const { count: episodes } = await supabase
    .from('watch_history')
    .select('*', { count: 'exact', head: true })
    .eq('type', 'episode');
  console.log('Episodes:', episodes);
  
  const { count: withGenres } = await supabase
    .from('watch_history')
    .select('*', { count: 'exact', head: true })
    .not('genres', 'is', null);
  console.log('Items with genres:', withGenres);
  
  const { count: withPoster } = await supabase
    .from('watch_history')
    .select('*', { count: 'exact', head: true })
    .not('poster', 'is', null);
  console.log('Items with poster:', withPoster);
  
  // Sample some data
  console.log('\n=== Sample Movies ===');
  const { data: movies_sample } = await supabase
    .from('watch_history')
    .select('title, genres, poster')
    .eq('type', 'movie')
    .limit(5);
  console.log(movies_sample);
}

checkData().catch(console.error);
