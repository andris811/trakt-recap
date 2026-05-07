-- Create watch_history table
CREATE TABLE IF NOT EXISTS watch_history (
  id TEXT PRIMARY KEY,
  trakt_id INTEGER,
  type TEXT,
  title TEXT,
  show_title TEXT,
  season INTEGER,
  episode INTEGER,
  runtime INTEGER,
  genres TEXT[],
  poster TEXT,
  watched_at TIMESTAMPTZ,
  rating INTEGER
);

-- Create trakt_stats table
CREATE TABLE IF NOT EXISTS trakt_stats (
  id SERIAL PRIMARY KEY,
  stats JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create content_cache table
CREATE TABLE IF NOT EXISTS content_cache (
  key TEXT PRIMARY KEY,
  value JSONB
);

-- Enable Row Level Security (optional, for now we'll use service role)
ALTER TABLE watch_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE trakt_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_cache ENABLE ROW LEVEL SECURITY;

-- Create policies to allow all operations (since we're using service role)
CREATE POLICY "Allow all operations" ON watch_history FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations" ON trakt_stats FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations" ON content_cache FOR ALL USING (true) WITH CHECK (true);

-- Grant permissions
GRANT ALL ON watch_history TO authenticated, service_role;
GRANT ALL ON trakt_stats TO authenticated, service_role;
GRANT ALL ON content_cache TO authenticated, service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role;
