# Supabase Setup Instructions

## 1. Go to your Supabase Dashboard
https://supabase.com/dashboard

## 2. Open SQL Editor
Click "SQL Editor" in the left sidebar

## 3. Run this SQL (copy from fix-supabase-sql.sql):
```sql
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
```

## 4. Click "Run" to execute

## 5. Verify tables exist
Click "Table Editor" in left sidebar - you should see:
- watch_history
- trakt_stats  
- content_cache

## 6. Test locally first
```bash
cd /Users/andris811/code/andris811/AVDev/trakt_recap
node app.js
# Visit http://localhost:3000/api/stasts
```

## 7. Redeploy to Vercel
```bash
vercel --prod --yes
```
