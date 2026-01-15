document.addEventListener('DOMContentLoaded', async () => {
  const noUsernameDiv = document.getElementById('no-username');
  const mainContent = document.getElementById('main-content');
  const todayCount = document.getElementById('today-count');
  const historyList = document.getElementById('history-list');
  const settingsLink = document.getElementById('settings-link');
  const settingsLinkPrompt = document.getElementById('settings-link-prompt');
  const fullHistoryBtn = document.getElementById('full-history-btn');

  // Open settings page
  const openSettings = () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('settings/settings.html') });
  };

  settingsLink.addEventListener('click', openSettings);
  settingsLinkPrompt.addEventListener('click', openSettings);

  // Open full history page
  fullHistoryBtn.addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('history/history.html') });
  });

  // Load data from storage
  const data = await chrome.storage.local.get(['username', 'dailyLimit', 'gameHistory']);

  if (!data.username) {
    noUsernameDiv.style.display = 'block';
    mainContent.style.display = 'none';
    return;
  }

  noUsernameDiv.style.display = 'none';
  mainContent.style.display = 'block';

  const dailyLimit = data.dailyLimit || 5;
  const gameHistory = data.gameHistory || {};

  // Get today's date string
  const today = new Date().toISOString().split('T')[0];
  const todayData = gameHistory[today] || { wins: 0, losses: 0, draws: 0, total: 0 };

  // Update today's count
  todayCount.textContent = `${todayData.total}/${dailyLimit}`;

  // Get last 7 days
  const dates = Object.keys(gameHistory).sort().reverse().slice(0, 7);

  if (dates.length === 0) {
    historyList.innerHTML = '<div class="empty-history">No games recorded yet</div>';
  } else {
    historyList.innerHTML = dates.map(dateStr => {
      const entry = gameHistory[dateStr];
      const date = new Date(dateStr);
      const formatted = formatDate(date);

      return `
        <div class="history-entry">
          <span class="history-date">${formatted}</span>
          <span class="history-stats">
            <span class="stat-win">W${entry.wins}</span>
            <span class="stat-loss">L${entry.losses}</span>
            <span class="stat-draw">D${entry.draws}</span>
            <span class="stat-total">T${entry.total}</span>
          </span>
        </div>
      `;
    }).join('');
  }

  // Trigger a refresh of game data
  chrome.runtime.sendMessage({ action: 'refreshGames' });
});

function formatDate(date) {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = String(date.getFullYear()).slice(-2);
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dayName = dayNames[date.getDay()];

  return `${day}.${month}.${year} ${dayName}`;
}
