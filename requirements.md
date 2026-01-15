# Chess Limiter - Chrome Extension Requirements Specification

## Project Overview

**Name:** Chess Limiter  
**Purpose:** Prevent compulsive/binge playing on chess.com by enforcing a daily game limit  
**Philosophy:** Simplicity first, less is more, add friction to override behavior

---

## Feature Summary

1. User sets a daily game limit (in settings page, not popup)
2. Extension tracks games played today via Chess.com API
3. When limit reached, block "New Game" buttons and redirect to: `https://scholar.google.com.br/citations?user=by37RZQAAAAJ&hl=pt-BR`
4. Show toast notification when game starts: "Game X/Y today"
5. Popup shows today's count and last 7 days history
6. Full history page shows all recorded days
7. No override option (strict enforcement)

---

## File Structure

```
chess-limiter/
├── manifest.json
├── popup/
│   ├── popup.html
│   ├── popup.css
│   └── popup.js
├── settings/
│   ├── settings.html
│   ├── settings.css
│   └── settings.js
├── history/
│   ├── history.html
│   ├── history.css
│   └── history.js
├── content/
│   └── content.js
├── background/
│   └── background.js
├── styles/
│   └── toast.css
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

---

## manifest.json Specification

```json
{
  "manifest_version": 3,
  "name": "Chess Limiter",
  "version": "1.0.0",
  "description": "Limit daily chess.com games to prevent binge playing",
  "permissions": [
    "storage",
    "alarms"
  ],
  "host_permissions": [
    "https://api.chess.com/*",
    "https://www.chess.com/*"
  ],
  "action": {
    "default_popup": "popup/popup.html",
    "default_icon": {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  },
  "background": {
    "service_worker": "background/background.js"
  },
  "content_scripts": [
    {
      "matches": ["https://www.chess.com/*"],
      "js": ["content/content.js"],
      "css": ["styles/toast.css"],
      "run_at": "document_idle"
    }
  ],
  "icons": {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  }
}
```

---

## Chess.com API Details

### Endpoint to fetch games
```
GET https://api.chess.com/pub/player/{username}/games/{YYYY}/{MM}
```

### Response Structure (simplified)
```json
{
  "games": [
    {
      "url": "https://www.chess.com/game/live/12345",
      "end_time": 1705312800,
      "time_class": "blitz",
      "white": {
        "username": "player1",
        "result": "win"
      },
      "black": {
        "username": "player2",
        "result": "checkmated"
      }
    }
  ]
}
```

### Determining Win/Loss/Draw for the user
For each game, check if user played as white or black, then check their result:

**Win results:** `"win"`  
**Loss results:** `"checkmated"`, `"timeout"`, `"resigned"`, `"lose"`, `"abandoned"`  
**Draw results:** `"agreed"`, `"stalemate"`, `"repetition"`, `"insufficient"`, `"50move"`, `"timevsinsufficient"`

### API Notes
- No authentication required
- Rate limit: be reasonable, cache results
- Games are returned for the entire month, filter by date locally
- `end_time` is Unix timestamp (seconds)

---

## Storage Schema (chrome.storage.local)

```javascript
{
  // User settings
  "username": "string",           // Chess.com username
  "dailyLimit": 5,                // Number, default 5
  
  // Cached game data
  "gameHistory": {
    "2026-01-15": { wins: 1, losses: 2, draws: 0, total: 3 },
    "2026-01-14": { wins: 3, losses: 1, draws: 1, total: 5 },
    // ... unlimited history
  },
  
  // Last API fetch timestamp (to avoid excessive calls)
  "lastFetch": 1705312800000      // milliseconds
}
```

---

## Component Specifications

### 1. Popup (popup.html, popup.js, popup.css)

**Layout:**
```
┌─────────────────────────────────┐
│  ♟️ Chess Limiter               │
├─────────────────────────────────┤
│  Today: 2/5                 ⚙️  │
├─────────────────────────────────┤
│  15.01.26 Thu  W1 L1 D0  T2     │
│  14.01.26 Wed  W3 L2 D1  T6     │
│  13.01.26 Tue  W0 L1 D0  T1     │
│  12.01.26 Mon  W2 L0 D0  T2     │
│  11.01.26 Sun  W1 L1 D1  T3     │
│  10.01.26 Sat  W0 L2 D0  T2     │
│  09.01.26 Fri  W4 L1 D0  T5     │
│                                 │
│  [Show full history]            │
└─────────────────────────────────┘
```

**Behavior:**
- On open: fetch latest data from storage, display
- Cogwheel (⚙️): opens settings.html in new tab
- "Show full history": opens history.html in new tab
- If no username set: show message "Please configure username in settings ⚙️"
- Date format: `DD.MM.YY DDD` (e.g., "15.01.26 Thu")

**Styling:**
- Width: ~300px
- Clean, minimal dark theme (to match chess.com aesthetic)
- Monospace font for the history entries for alignment

---

### 2. Settings Page (settings.html, settings.js, settings.css)

**Layout:**
```
┌─────────────────────────────────┐
│  ⚙️ Chess Limiter Settings      │
├─────────────────────────────────┤
│                                 │
│  Chess.com username:            │
│  ┌─────────────────────────┐    │
│  │                         │    │
│  └─────────────────────────┘    │
│                                 │
│  Daily game limit:              │
│  ┌─────────────────────────┐    │
│  │ 5                       │    │
│  └─────────────────────────┘    │
│                                 │
│  ┌─────────┐                    │
│  │  Save   │                    │
│  └─────────┘                    │
│                                 │
│  (Saved ✓) ← show after save    │
│                                 │
└─────────────────────────────────┘
```

**Behavior:**
- On load: populate fields with current stored values
- Save button: validate inputs, save to chrome.storage.local
- Validation:
  - Username: required, non-empty, trim whitespace
  - Daily limit: required, integer >= 1
- After save: show "Saved ✓" confirmation message
- Opens in new tab (not popup)

---

### 3. History Page (history.html, history.js, history.css)

**Layout:**
```
┌─────────────────────────────────┐
│  📜 Chess Limiter History       │
├─────────────────────────────────┤
│                                 │
│  15.01.26 Thu  W1 L1 D0  T2     │
│  14.01.26 Wed  W3 L2 D1  T6     │
│  13.01.26 Tue  W0 L1 D0  T1     │
│  12.01.26 Mon  W2 L0 D0  T2     │
│  11.01.26 Sun  W1 L1 D1  T3     │
│  ... (all days, sorted desc)    │
│                                 │
└─────────────────────────────────┘
```

**Behavior:**
- On load: fetch gameHistory from storage
- Sort by date descending (newest first)
- Display all entries (scrollable)
- Same date format as popup

---

### 4. Content Script (content.js)

This is the core enforcement mechanism. Runs on all chess.com pages.

**Responsibilities:**

#### A. Show Toast Notification on Game Start
- Detect when a game starts (user is on a game page)
- Show toast: "Game X/Y today" (e.g., "Game 2/5 today")
- Toast appears in top-right corner, disappears after 3 seconds
- Only show once per game (track shown games)

**Game detection methods:**
- URL matches pattern: `https://www.chess.com/game/live/*` or `https://www.chess.com/play/computer` etc.
- Or detect chess board element appearing

#### B. Block New Game Buttons When Limit Reached
- Continuously monitor for "New Game" / "Play" button clicks
- Buttons to intercept (CSS selectors - may need refinement):
  - Main play button on homepage
  - "New Game" button after game ends
  - Any element that starts a new game
- On click intercept:
  1. Check if today's count >= dailyLimit
  2. If yes: prevent default, redirect to Google Scholar URL
  3. If no: allow normal behavior

**Key selectors to target (research needed, these are starting points):**
```javascript
// These selectors may need adjustment based on chess.com's actual DOM
const playButtonSelectors = [
  '[data-cy="new-game-button"]',
  '.new-game-button',
  '.play-button-button',
  '.game-over-buttons-button', // "New Game" after game ends
  'button[aria-label="New Game"]',
  'a[href="/play"]',
  '.play-quick-link'
];
```

#### C. Communication with Background Script
- Request current game count from background
- Listen for updates to game count

---

### 5. Background Script (background.js)

**Responsibilities:**

#### A. Fetch Games from Chess.com API
- Function to fetch games for current month
- Parse and count today's games
- Categorize into wins/losses/draws
- Update storage

#### B. Periodic Refresh
- Set up alarm to refresh data every 2-3 minutes when browser is open
- Also refresh on extension icon click (popup open)

#### C. Message Handling
- Respond to content script requests for current count
- Notify content scripts when count updates

#### D. Date Change Detection
- Detect when day changes (midnight)
- Reset "today" tracking

**API Fetch Logic:**
```javascript
async function fetchGames(username) {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  
  const url = `https://api.chess.com/pub/player/${username}/games/${year}/${month}`;
  
  const response = await fetch(url);
  const data = await response.json();
  
  return data.games || [];
}
```

**Game Counting Logic:**
```javascript
function countTodayGames(games, username) {
  const today = new Date().toISOString().split('T')[0]; // "2026-01-15"
  
  let wins = 0, losses = 0, draws = 0;
  
  for (const game of games) {
    const gameDate = new Date(game.end_time * 1000).toISOString().split('T')[0];
    
    if (gameDate !== today) continue;
    
    // Determine if user was white or black
    const isWhite = game.white.username.toLowerCase() === username.toLowerCase();
    const userResult = isWhite ? game.white.result : game.black.result;
    
    // Categorize result
    if (userResult === 'win') {
      wins++;
    } else if (['agreed', 'stalemate', 'repetition', 'insufficient', '50move', 'timevsinsufficient'].includes(userResult)) {
      draws++;
    } else {
      losses++;
    }
  }
  
  return { wins, losses, draws, total: wins + losses + draws };
}
```

---

## Toast Notification Styling (toast.css)

```css
.chess-limiter-toast {
  position: fixed;
  top: 20px;
  right: 20px;
  background: rgba(0, 0, 0, 0.85);
  color: #fff;
  padding: 12px 20px;
  border-radius: 8px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  font-size: 14px;
  font-weight: 500;
  z-index: 999999;
  animation: toast-slide-in 0.3s ease, toast-fade-out 0.3s ease 2.7s forwards;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

@keyframes toast-slide-in {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

@keyframes toast-fade-out {
  to {
    opacity: 0;
  }
}
```

---

## Edge Cases & Error Handling

1. **No username configured:** Show friendly message in popup prompting to open settings

2. **Invalid username:** On settings save, could optionally validate by making test API call. At minimum, show error in popup if API returns 404.

3. **API rate limiting:** Cache results, don't fetch more than once per minute

4. **Network errors:** Show cached data with note "Last updated: X minutes ago"

5. **Chess.com DOM changes:** The button selectors may break if chess.com updates their site. Use multiple fallback selectors.

6. **User plays on multiple devices:** API reflects all games, so this works correctly

7. **Games spanning midnight:** Use game's `end_time` to determine which day it counts for

8. **Timezone handling:** Use local timezone for "today" determination

9. **First install:** No history yet, show empty state gracefully

---

## Redirect URL

When limit is reached, redirect to:
```
https://scholar.google.com.br/citations?user=by37RZQAAAAJ&hl=pt-BR
```

---

## User Flow Examples

### Flow 1: Normal Usage
1. User has limit set to 5
2. User plays game 1 → toast shows "Game 1/5 today"
3. User plays game 2 → toast shows "Game 2/5 today"
4. ... continues until game 5
5. Game 5 ends → toast shows "Game 5/5 today"
6. User clicks "New Game" → BLOCKED → redirect to Google Scholar

### Flow 2: First Time Setup
1. User installs extension
2. Opens popup → sees "Please configure username in settings ⚙️"
3. Clicks ⚙️ → settings page opens
4. Enters username "magnuscarlsen" and limit "5"
5. Clicks Save → sees "Saved ✓"
6. Closes tab, opens popup → sees "Today: 0/5" and history

### Flow 3: Viewing History
1. User clicks extension icon
2. Sees last 7 days in popup
3. Clicks "Show full history"
4. New tab opens with complete history

---

## Testing Checklist

- [ ] Settings save and persist correctly
- [ ] API fetch returns correct game data
- [ ] Win/Loss/Draw categorization is accurate
- [ ] Today's count updates after each game
- [ ] Toast appears on game start (only once per game)
- [ ] New Game button blocked when limit reached
- [ ] Redirect happens correctly when blocked
- [ ] Popup displays correct data
- [ ] History page shows all days
- [ ] Day rollover works at midnight
- [ ] Extension works after browser restart

---

## Icons

Create simple chess-themed icons:
- 16x16, 48x48, 128x128 PNG
- Suggestion: simple chess pawn silhouette or a pawn with a small "stop" indicator
- Keep it minimal and recognizable

---

## Future Enhancements (Out of Scope for v1)

- Weekly/monthly statistics
- Export data
- Custom redirect URLs
- Time-based limits (e.g., "only play between 6pm-9pm")
- Pause/vacation mode

---

## Summary

This extension is intentionally minimal:
- **3 HTML pages:** popup, settings, history
- **1 content script:** for blocking and toasts
- **1 background script:** for API and state management
- **No override:** strict enforcement

The friction is in the design: settings are intentionally harder to access, and there's no "just one more game" button.

Good luck building! 🎯