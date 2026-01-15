// Chess Limiter - Content Script
// Runs on chess.com pages to enforce game limits

// Selectors for play/new game buttons (may need adjustment based on chess.com DOM)
const PLAY_BUTTON_SELECTORS = [
  '[data-cy="new-game-button"]',
  '.new-game-button',
  '.play-button-button',
  '.game-over-buttons-button',
  'button[aria-label="New Game"]',
  'button[aria-label="Play"]',
  '.play-quick-link',
  '.ui_v5-button-component[data-cy="play"]',
  '.quick-link-button',
  '.play-mode-selector',
  '[data-tab="play"]',
  '.home-quick-link',
  'a[href="/play/online"]',
  'a[href="/play/computer"]',
  '.game-review-buttons-button',
  '.daily-game-footer-playAgain',
  '.live-game-buttons-button'
];

// Game URL patterns
const GAME_URL_PATTERNS = [
  /^https:\/\/www\.chess\.com\/game\/live\/.+/,
  /^https:\/\/www\.chess\.com\/game\/daily\/.+/,
  /^https:\/\/www\.chess\.com\/play\/computer/
];

// Default redirect URL (fallback)
const DEFAULT_REDIRECT_URL = 'https://scholar.google.com.br/citations?user=by37RZQAAAAJ&hl=pt-BR';

// Track shown toasts to avoid duplicates
let shownToastUrls = new Set();
let currentGameStatus = null;
let isOnGamePage = false;

// Initialize
async function init() {
  // Get initial status
  await updateGameStatus();

  // Check if we're on a game page and show toast
  checkForGamePage();

  // Set up observers and event listeners
  setupClickInterceptors();
  setupMutationObserver();
  setupUrlObserver();

  // Listen for updates from background
  chrome.runtime.onMessage.addListener((message) => {
    if (message.action === 'gameStatusUpdate') {
      currentGameStatus = message.status;
    }
  });
}

// Get current game status from background
async function updateGameStatus() {
  try {
    currentGameStatus = await chrome.runtime.sendMessage({ action: 'getGameStatus' });
  } catch (error) {
    console.error('Chess Limiter: Failed to get game status:', error);
  }
}

// Get the redirect URL based on settings
async function getRedirectUrl() {
  const data = await chrome.storage.local.get(['redirectType', 'redirectUrl', 'redirectMessage']);

  if (data.redirectType === 'message' && data.redirectMessage) {
    // Redirect to the message page
    return chrome.runtime.getURL('redirect/redirect.html');
  } else if (data.redirectType === 'url' && data.redirectUrl) {
    return data.redirectUrl;
  }

  // Fallback to default
  return DEFAULT_REDIRECT_URL;
}

// Check if current URL is a game page
function checkForGamePage() {
  const url = window.location.href;
  const isGame = GAME_URL_PATTERNS.some(pattern => pattern.test(url));

  if (isGame && !shownToastUrls.has(url)) {
    isOnGamePage = true;
    showGameToast();
    shownToastUrls.add(url);
  } else if (!isGame) {
    isOnGamePage = false;
  }
}

// Show toast notification
function showGameToast() {
  if (!currentGameStatus || !currentGameStatus.configured) {
    return;
  }

  // The toast shows current count + 1 since this is a new game starting
  const currentGame = currentGameStatus.todayCount + 1;
  const limit = currentGameStatus.dailyLimit;

  const toast = document.createElement('div');
  toast.className = 'chess-limiter-toast';
  toast.textContent = `Game ${currentGame}/${limit} today`;

  document.body.appendChild(toast);

  // Remove toast after animation completes
  setTimeout(() => {
    toast.remove();
  }, 3500);
}

// Set up click interceptors for play buttons
function setupClickInterceptors() {
  document.addEventListener('click', handleClick, true);
}

// Handle clicks on play buttons
async function handleClick(event) {
  // Update status before checking
  await updateGameStatus();

  if (!currentGameStatus || !currentGameStatus.configured) {
    return;
  }

  if (!currentGameStatus.limitReached) {
    return;
  }

  // Check if clicked element or its parents match play button selectors
  const clickedElement = event.target;

  for (const selector of PLAY_BUTTON_SELECTORS) {
    const matchingElement = clickedElement.closest(selector);
    if (matchingElement) {
      // Block the click and redirect
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      const redirectUrl = await getRedirectUrl();
      window.location.href = redirectUrl;
      return;
    }
  }

  // Also check for links that might start a new game
  const link = clickedElement.closest('a');
  if (link) {
    const href = link.getAttribute('href');
    if (href && (href.includes('/play') || href.includes('/game'))) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      const redirectUrl = await getRedirectUrl();
      window.location.href = redirectUrl;
      return;
    }
  }
}

// Set up mutation observer to watch for dynamically added buttons
function setupMutationObserver() {
  const observer = new MutationObserver((mutations) => {
    // Check if any new game buttons were added
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          checkForGamePage();
        }
      }
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}

// Watch for URL changes (SPA navigation)
function setupUrlObserver() {
  let lastUrl = window.location.href;

  // Check URL periodically (for SPA navigation)
  setInterval(() => {
    if (window.location.href !== lastUrl) {
      lastUrl = window.location.href;
      checkForGamePage();
    }
  }, 500);

  // Also listen for popstate events
  window.addEventListener('popstate', () => {
    checkForGamePage();
  });
}

// Start the content script
init();
