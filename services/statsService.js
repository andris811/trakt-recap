function calculateStats(events, traktStats, ratingsMap) {
  const coreStats = {
    totalMovies: 0,
    totalEpisodes: 0,
    totalWatchTimeMinutes: 0,
    totalWatchTimeHours: 0
  };

  const heatmap = {};
  const peakHours = {};
  for (let i = 0; i < 24; i++) {
    peakHours[String(i)] = 0;
  }

  const yearlyBreakdown = {};
  const genreDistribution = {};
  const ratingsDistribution = {};
  for (let i = 1; i <= 10; i++) {
    ratingsDistribution[String(i)] = 0;
  }

  const rewatchMap = {};
  const showCounts = {};
  const dayOfWeek = { Mon: 0, Tue: 0, Wed: 0, Thu: 0, Fri: 0, Sat: 0, Sun: 0 };
  const monthlyTrends = {};
  const dateSet = new Set();
  const ratedContent = new Set();

  // Apply ratings from ratingsMap if provided
  if (ratingsMap) {
    console.log('Applying ratings from ratingsMap...');
    console.log('ratingsMap sample:', JSON.stringify(Object.entries(ratingsMap).slice(0, 5)));
    
    let applied = 0;
    let movieCount = 0, episodeCount = 0;
    
    for (const event of events) {
      let matched = false;
      if (event.type === 'movie') {
        const key = `movie_${event.traktId}`;
        if (ratingsMap[key] !== undefined) {
          event.rating = ratingsMap[key];
          applied++;
          movieCount++;
          matched = true;
        }
      } else if (event.type === 'episode' && event.season !== undefined && event.episode !== undefined) {
        const epKey = `episode_${event.traktId}_${event.season}_${event.episode}`;
        if (ratingsMap[epKey] !== undefined) {
          event.rating = ratingsMap[epKey];
          applied++;
          episodeCount++;
          matched = true;
        }
      }
    }
    console.log(`Applied ${applied} ratings from ratingsMap (${movieCount} movies, ${episodeCount} episodes)`);
  }

  const sortedByTime = [...events].sort((a, b) => new Date(a.watchedAt) - new Date(b.watchedAt));

  let maxBingeLength = 0;
  let maxBingeItems = 0;
  let currentBingeMinutes = 0;
  let currentBingeItems = 0;

  for (let i = 0; i < sortedByTime.length; i++) {
    const event = sortedByTime[i];

    if (event.type === 'movie') {
      coreStats.totalMovies++;
    } else {
      coreStats.totalEpisodes++;
    }

    coreStats.totalWatchTimeMinutes += event.runtime || 0;

    const date = new Date(event.watchedAt);
    const dateKey = date.toISOString().split('T')[0];
    heatmap[dateKey] = (heatmap[dateKey] || 0) + 1;
    dateSet.add(dateKey);

    const hour = String(date.getUTCHours());
    peakHours[hour] = (peakHours[hour] || 0) + 1;

    const year = String(date.getUTCFullYear());
    if (!yearlyBreakdown[year]) {
      yearlyBreakdown[year] = { movies: 0, episodes: 0 };
    }
    if (event.type === 'movie') {
      yearlyBreakdown[year].movies++;
    } else {
      yearlyBreakdown[year].episodes++;
    }

    for (const genre of (event.genres || [])) {
      genreDistribution[genre] = (genreDistribution[genre] || 0) + 1;
    }

    if (event.rating != null) {
      // Count rating only once per unique content (avoid duplicates from re-watches)
      const contentKey = `${event.type}_${event.traktId}_${event.season || ''}_${event.episode || ''}`;
      if (!ratedContent.has(contentKey)) {
        ratedContent.add(contentKey);
        ratingsDistribution[String(event.rating)] = (ratingsDistribution[String(event.rating)] || 0) + 1;
      }
    }

    const rewatchKey = `${event.type}-${event.traktId}`;
    if (!rewatchMap[rewatchKey]) {
      rewatchMap[rewatchKey] = {
        traktId: event.traktId,
        type: event.type,
        title: event.showTitle || event.title,
        poster: event.poster || null,
        count: 0
      };
    }
    rewatchMap[rewatchKey].count++;

    if (event.showTitle) {
      if (!showCounts[event.showTitle]) {
        showCounts[event.showTitle] = { title: event.showTitle, poster: null, traktId: event.traktId, count: 0 };
      }
      showCounts[event.showTitle].count++;
      // Always update poster if we have a valid one
      if (event.poster) {
        showCounts[event.showTitle].poster = event.poster;
      }
    }

    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    dayOfWeek[dayNames[date.getUTCDay()]]++;

    const monthKey = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
    monthlyTrends[monthKey] = (monthlyTrends[monthKey] || 0) + 1;

    if (i > 0) {
      const prevDate = new Date(sortedByTime[i - 1].watchedAt);
      const gapMinutes = (date - prevDate) / (1000 * 60);

      if (gapMinutes <= 60) {
        currentBingeMinutes += event.runtime || 0;
        currentBingeItems++;
      } else {
        if (currentBingeItems > maxBingeItems) {
          maxBingeItems = currentBingeItems;
          maxBingeLength = currentBingeMinutes;
        }
        currentBingeMinutes = event.runtime || 0;
        currentBingeItems = 1;
      }
    } else {
      currentBingeMinutes = event.runtime || 0;
      currentBingeItems = 1;
    }
  }

  if (currentBingeItems > maxBingeItems) {
    maxBingeItems = currentBingeItems;
    maxBingeLength = currentBingeMinutes;
  }

  // Use Trakt's official stats for total watch time (most accurate)
  if (traktStats) {
    coreStats.totalMovies = traktStats.movies.plays;
    coreStats.totalEpisodes = traktStats.episodes.plays;
    coreStats.totalWatchTimeMinutes = traktStats.movies.minutes + traktStats.episodes.minutes;
  } else {
    // Fallback: calculate from events (only works if runtime is populated)
    for (const event of events) {
      if (event.type === 'movie') {
        coreStats.totalMovies++;
      } else {
        coreStats.totalEpisodes++;
      }
      coreStats.totalWatchTimeMinutes += event.runtime || 0;
    }
  }

  coreStats.totalWatchTimeHours = Math.round((coreStats.totalWatchTimeMinutes / 60) * 100) / 100;

  const totalItems = coreStats.totalMovies + coreStats.totalEpisodes;
  const movieVsTvRatio = {
    movies: totalItems > 0 ? Math.round((coreStats.totalMovies / totalItems) * 10000) / 100 : 0,
    episodes: totalItems > 0 ? Math.round((coreStats.totalEpisodes / totalItems) * 10000) / 100 : 0
  };

  const rewatchList = Object.values(rewatchMap)
    .filter(item => item.count > 1)
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const topShows = Object.values(showCounts)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  let firstWatches = 0;
  let rewatches = 0;
  for (const item of Object.values(rewatchMap)) {
    firstWatches++;
    rewatches += item.count - 1;
  }

  const uniqueDays = dateSet.size;
  const sortedDates = [...dateSet].sort();
  const totalDays = sortedDates.length > 0
    ? Math.max(1, Math.round((new Date(sortedDates[sortedDates.length - 1]) - new Date(sortedDates[0])) / (1000 * 60 * 60 * 24)) + 1)
    : 1;
  const totalWeeks = Math.max(1, Math.ceil(totalDays / 7));

  let longestStreak = 0;
  let currentStreak = 0;
  for (let i = 0; i < sortedDates.length; i++) {
    if (i === 0) {
      currentStreak = 1;
    } else {
      const prev = new Date(sortedDates[i - 1]);
      const curr = new Date(sortedDates[i]);
      const diffDays = Math.round((curr - prev) / (1000 * 60 * 60 * 24));
      if (diffDays === 1) {
        currentStreak++;
      } else {
        currentStreak = 1;
      }
    }
    if (currentStreak > longestStreak) {
      longestStreak = currentStreak;
    }
  }

  // Use personal ratings from events, not Trakt's overall stats
  const finalRatingsDistribution = ratingsDistribution;

  const timeline = [...events]
    .sort((a, b) => new Date(b.watchedAt) - new Date(a.watchedAt))
    .slice(0, 50);

  return {
    coreStats,
    activity: {
      heatmap,
      timeline,
      peakHours,
      dayOfWeek,
      monthlyTrends: Object.entries(monthlyTrends)
        .sort(([a], [b]) => a.localeCompare(b))
        .reduce((acc, [k, v]) => ({ ...acc, [k]: v }), {})
    },
    contentInsights: {
      movieVsTvRatio,
      yearlyBreakdown,
      genreDistribution,
      topShows
    },
    personalBehavior: {
      ratingsDistribution: finalRatingsDistribution,
      rewatchStats: {
        totalRewatched: rewatchList.length,
        topRewatched: rewatchList,
        firstWatches,
        rewatches
      },
      bingeSession: {
        maxMinutes: maxBingeLength,
        maxHours: Math.round((maxBingeLength / 60) * 100) / 100,
        maxItems: maxBingeItems
      },
      watchStreak: {
        longestDays: longestStreak
      },
      averages: {
        perDay: Math.round((totalItems / uniqueDays) * 100) / 100,
        perWeek: Math.round((totalItems / totalWeeks) * 100) / 100
      }
    }
  };
}

module.exports = { calculateStats };
