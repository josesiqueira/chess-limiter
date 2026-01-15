// Chess Limiter - Background Service Worker

const REFRESH_INTERVAL_MINUTES = 3;
const MIN_FETCH_INTERVAL_MS = 60000; // 1 minute minimum between fetches

// Win, loss, draw result mappings
const WIN_RESULTS = ['win'];
const DRAW_RESULTS = ['agreed', 'stalemate', 'repetition', 'insufficient', '50move', 'timevsinsufficient'];
// Everything else is a loss

// Set up alarm for periodic refresh
chrome.alarms.create('refreshGames', {
  periodInMinutes: REFRESH_INTERVAL_MINUTES
});

// Handle alarm
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'refreshGames') {
    refreshGameData();
  }
});

// Handle messages from popup and content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'refreshGames') {
    refreshGameData().then(() => sendResponse({ success: true }));
    return true; // Keep channel open for async response
  }

  if (message.action === 'getGameStatus') {
    getGameStatus().then(sendResponse);
    return true;
  }
});

// Fetch games from Chess.com API
async function fetchGames(username) {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');

  const url = `https://api.chess.com/pub/player/${username}/games/${year}/${month}`;

  try {
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('Username not found');
      }
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    return data.games || [];
  } catch (error) {
    console.error('Chess Limiter: Error fetching games:', error);
    throw error;
  }
}

// Count games and categorize by date
function processGames(games, username) {
  const gamesByDate = {};

  for (const game of games) {
    const gameDate = new Date(game.end_time * 1000).toISOString().split('T')[0];

    if (!gamesByDate[gameDate]) {
      gamesByDate[gameDate] = { wins: 0, losses: 0, draws: 0, total: 0 };
    }

    // Determine if user was white or black
    const isWhite = game.white.username.toLowerCase() === username.toLowerCase();
    const userResult = isWhite ? game.white.result : game.black.result;

    // Categorize result
    if (WIN_RESULTS.includes(userResult)) {
      gamesByDate[gameDate].wins++;
    } else if (DRAW_RESULTS.includes(userResult)) {
      gamesByDate[gameDate].draws++;
    } else {
      gamesByDate[gameDate].losses++;
    }

    gamesByDate[gameDate].total++;
  }

  return gamesByDate;
}

// Main refresh function
async function refreshGameData() {
  const data = await chrome.storage.local.get(['username', 'lastFetch', 'gameHistory']);

  if (!data.username) {
    return;
  }

  // Rate limiting - don't fetch more than once per minute
  const now = Date.now();
  if (data.lastFetch && (now - data.lastFetch) < MIN_FETCH_INTERVAL_MS) {
    return;
  }

  try {
    const games = await fetchGames(data.username);
    const processedGames = processGames(games, data.username);

    // Merge with existing history (keep old data, update current month)
    const existingHistory = data.gameHistory || {};
    const mergedHistory = { ...existingHistory, ...processedGames };

    await chrome.storage.local.set({
      gameHistory: mergedHistory,
      lastFetch: now
    });

    // Notify all chess.com tabs about the update
    notifyContentScripts();
  } catch (error) {
    console.error('Chess Limiter: Failed to refresh game data:', error);
  }
}

// Get current game status (for content scripts)
async function getGameStatus() {
  const data = await chrome.storage.local.get(['username', 'dailyLimit', 'gameHistory']);

  if (!data.username) {
    return { configured: false };
  }

  const dailyLimit = data.dailyLimit || 5;
  const gameHistory = data.gameHistory || {};
  const today = new Date().toISOString().split('T')[0];
  const todayData = gameHistory[today] || { wins: 0, losses: 0, draws: 0, total: 0 };

  return {
    configured: true,
    todayCount: todayData.total,
    dailyLimit: dailyLimit,
    limitReached: todayData.total >= dailyLimit
  };
}

// Notify content scripts about updates
async function notifyContentScripts() {
  const status = await getGameStatus();

  try {
    const tabs = await chrome.tabs.query({ url: 'https://www.chess.com/*' });
    for (const tab of tabs) {
      chrome.tabs.sendMessage(tab.id, {
        action: 'gameStatusUpdate',
        status: status
      }).catch(() => {
        // Tab might not have content script loaded
      });
    }
  } catch (error) {
    // Ignore errors when notifying
  }
}

// Initial refresh on install/update
chrome.runtime.onInstalled.addListener(() => {
  refreshGameData();
});

// Refresh when service worker starts
refreshGameData();
