document.addEventListener('DOMContentLoaded', async () => {
  const usernameInput = document.getElementById('username');
  const dailyLimitInput = document.getElementById('daily-limit');
  const saveBtn = document.getElementById('save-btn');
  const messageDiv = document.getElementById('message');

  // Load existing settings
  const data = await chrome.storage.local.get(['username', 'dailyLimit']);

  if (data.username) {
    usernameInput.value = data.username;
  }

  if (data.dailyLimit) {
    dailyLimitInput.value = data.dailyLimit;
  }

  // Save settings
  saveBtn.addEventListener('click', async () => {
    const username = usernameInput.value.trim();
    const dailyLimit = parseInt(dailyLimitInput.value, 10);

    // Validation
    if (!username) {
      showMessage('Please enter a username', 'error');
      return;
    }

    if (isNaN(dailyLimit) || dailyLimit < 1) {
      showMessage('Daily limit must be at least 1', 'error');
      return;
    }

    // Save to storage
    await chrome.storage.local.set({
      username: username,
      dailyLimit: dailyLimit
    });

    showMessage('Saved \u2713', 'success');

    // Trigger a refresh of game data
    chrome.runtime.sendMessage({ action: 'refreshGames' });
  });

  function showMessage(text, type) {
    messageDiv.textContent = text;
    messageDiv.className = `message ${type}`;
    messageDiv.style.display = 'block';

    if (type === 'success') {
      setTimeout(() => {
        messageDiv.style.display = 'none';
      }, 3000);
    }
  }
});
