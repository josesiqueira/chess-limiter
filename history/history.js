document.addEventListener('DOMContentLoaded', async () => {
  const historyList = document.getElementById('history-list');

  // Load game history from storage
  const data = await chrome.storage.local.get(['gameHistory']);
  const gameHistory = data.gameHistory || {};

  // Get all dates sorted descending (newest first)
  const dates = Object.keys(gameHistory).sort().reverse();

  if (dates.length === 0) {
    historyList.innerHTML = '<div class="empty-history">No games recorded yet</div>';
    return;
  }

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
});

function formatDate(date) {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = String(date.getFullYear()).slice(-2);
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dayName = dayNames[date.getDay()];

  return `${day}.${month}.${year} ${dayName}`;
}
