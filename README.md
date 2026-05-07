# Trakt Recap

A personal watch analytics dashboard powered by the Trakt API. Track your viewing habits, explore detailed statistics, and visualize your watching patterns.

## Features

- **Full History Sync** — Fetches your complete Trakt watch history with pagination
- **Data Enrichment** — Automatically enriches data with runtime, genres, posters, and ratings
- **Interactive Dashboard** — Modern dark-mode UI with charts, heatmaps, and detailed modals
- **Advanced Analytics** — Binge sessions, watch streaks, genre distribution, yearly reviews
- **Episode Navigation** — Browse episodes with arrow keys, view season details, track watched episodes
- **Comments & Ratings** — View community comments and ratings for movies, shows, and episodes

## Tech Stack

### Backend
- **Node.js** + **Express**
- **Axios** for API requests
- Local JSON file storage

### Frontend
- **React** (Vite)
- **Tailwind CSS**
- **Recharts** for data visualization
- **Axios** for API communication

## Getting Started

### Prerequisites
- Node.js 18+
- A Trakt API app with Client ID and Client Secret

### Backend Setup

1. Install dependencies:
```bash
npm install
```

2. Create `.env` file:
```env
TRAKT_CLIENT_ID=your_client_id
TRAKT_CLIENT_SECRET=your_client_secret
TRAKT_REDIRECT_URI=http://localhost:3000/callback
TRAKT_ACCESS_TOKEN=your_access_token
PORT=3000
```

3. Get an access token (first time only):
```bash
node get-token.js
```

4. Start the server:
```bash
npm start
```

### Frontend Setup

1. Navigate to frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Start the dev server:
```bash
npm run dev
```

The frontend runs on `http://localhost:5173` and proxies API requests to the backend.

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/events/sync` | Fetch and sync watch history from Trakt |
| POST | `/api/events/enrich` | Enrich stored data with details from Trakt |
| GET | `/api/events` | Get all stored watch events |
| GET | `/api/events/content/:type/:traktId` | Get content details (movie/show) |
| GET | `/api/events/episode/:showId/:season/:number` | Get episode details |
| GET | `/api/events/season/:showId/:season` | Get all episodes in a season |
| GET | `/api/events/seasons/:showId` | Get all seasons of a show |
| GET | `/api/stats` | Get computed analytics and statistics |

## Project Structure

```
trakt_recap/
├── app.js                          # Express server entry point
├── get-token.js                    # OAuth token generator
├── package.json
├── .env.example
├── data/                           # Local storage
│   ├── watch-history.json          # Normalized watch events
│   ├── trakt-stats.json            # Trakt user stats
│   ├── content-cache.json          # Cached content details
│   └── ratings-cache.json          # Cached ratings
├── services/
│   ├── traktService.js             # Trakt API client
│   ├── transformService.js         # Data normalization
│   ├── enrichmentService.js        # Content enrichment layer
│   ├── ratingsService.js           # Ratings sync and mapping
│   └── statsService.js             # Analytics calculations
├── routes/
│   ├── events.js                   # Event and content endpoints
│   └── stats.js                    # Stats endpoint
└── frontend/
    ├── src/
    │   ├── App.jsx                 # Main app component
    │   ├── utils.js                # Utility functions
    │   └── components/
    │       ├── SummaryCards.jsx    # Top stats cards
    │       ├── Heatmap.jsx         # Activity heatmap
    │       ├── PeakHoursChart.jsx  # Peak hours bar chart
    │       ├── GenreChart.jsx      # Genre distribution pie chart
    │       ├── RatingsChart.jsx    # Ratings distribution bar chart
    │       ├── Timeline.jsx        # Recent activity list
    │       ├── YearReview.jsx      # Yearly review section
    │       ├── SeriesModal.jsx     # Series/movie detail modal
    │       ├── EpisodeModal.jsx    # Episode detail modal
    │       ├── SeasonModal.jsx     # Season episode list modal
    │       ├── GenreModal.jsx      # Genre items list modal
    │       ├── RatingsModal.jsx    # Rated items list modal
    │       └── YearListModal.jsx   # Year items list modal
    └── vite.config.js
```

## Data Flow

1. **Sync** → Fetches raw history from Trakt `/users/me/history`
2. **Normalize** → Converts to clean `WatchEvent` structure
3. **Enrich** → Fetches movie/show details for runtime, genres, posters
4. **Ratings** → Fetches user ratings from `/sync/ratings` and maps to events
5. **Stats** → Computes analytics from enriched data

## License

MIT
# Deployment trigger Thu May  7 13:55:23 CST 2026
