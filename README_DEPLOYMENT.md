# Trakt Recap - Deployment Guide

## Environment Variables

Create a `.env` file in the root directory:

```
TRAKT_CLIENT_ID=your_client_id
TRAKT_ACCESS_TOKEN=your_access_token
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_supabase_anon_key
```

## Supabase Setup

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to SQL Editor and run the contents of `supabase-schema.sql`
3. Go to Project Settings → API to get your URL and anon key

## Deploy to Vercel

### Option 1: Vercel CLI (Recommended)

```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Deploy
cd /Users/andris811/code/andris811/AVDev/trakt_recap
vercel --prod
```

### Option 2: GitHub Integration

1. Push your code to GitHub
2. Go to [vercel.com](https://vercel.com) → New Project
3. Import your GitHub repository
4. Configure environment variables
5. Deploy!

## Environment Variables in Vercel

Add these in Vercel Project Settings → Environment Variables:

- `TRAKT_CLIENT_ID`
- `TRAKT_ACCESS_TOKEN`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

## Local Development

```bash
npm install
cd frontend && npm install
cd ..
node app.js
```

## Notes

- The app uses Supabase for data storage (free tier: 500MB database, 1GB file storage)
- If Supabase credentials are not provided, it falls back to file-based storage
- Vercel serverless functions are stateless, so Supabase is required for production
