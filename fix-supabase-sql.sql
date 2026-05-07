-- Drop existing policies
DROP POLICY IF EXISTS "Allow all operations" ON watch_history;
DROP POLICY IF EXISTS "Allow all operations" ON trakt_stats;
DROP POLICY IF EXISTS "Allow all operations" ON content_cache;

-- Disable RLS (simpler for service role)
ALTER TABLE watch_history DISABLE ROW LEVEL SECURITY;
ALTER TABLE trakt_stats DISABLE ROW LEVEL SECURITY;
ALTER TABLE content_cache DISABLE ROW LEVEL SECURITY;

-- Grant all permissions to service_role
GRANT ALL ON watch_history TO service_role;
GRANT ALL ON trakt_stats TO service_role;
GRANT ALL ON content_cache TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;
