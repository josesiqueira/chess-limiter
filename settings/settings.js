document.addEventListener('DOMContentLoaded', async () => {
  const usernameInput = document.getElementById('username');
  const dailyLimitInput = document.getElementById('daily-limit');
  const redirectUrlRadio = document.getElementById('redirect-url');
  const redirectMessageRadio = document.getElementById('redirect-message');
  const urlGroup = document.getElementById('url-group');
  const messageGroup = document.getElementById('message-group');
  const redirectUrlInput = document.getElementById('redirect-url-input');
  const redirectMessageInput = document.getElementById('redirect-message-input');
  const saveBtn = document.getElementById('save-btn');
  const messageDiv = document.getElementById('message');

  // Toggle visibility based on redirect type
  function updateRedirectFields() {
    if (redirectUrlRadio.checked) {
      urlGroup.style.display = 'block';
      messageGroup.style.display = 'none';
    } else {
      urlGroup.style.display = 'none';
      messageGroup.style.display = 'block';
    }
  }

  redirectUrlRadio.addEventListener('change', updateRedirectFields);
  redirectMessageRadio.addEventListener('change', updateRedirectFields);

  // Load existing settings
  const data = await chrome.storage.local.get([
    'username',
    'dailyLimit',
    'redirectType',
    'redirectUrl',
    'redirectMessage'
  ]);

  if (data.username) {
    usernameInput.value = data.username;
  }

  if (data.dailyLimit) {
    dailyLimitInput.value = data.dailyLimit;
  }

  // Set redirect type (default to 'url')
  if (data.redirectType === 'message') {
    redirectMessageRadio.checked = true;
  } else {
    redirectUrlRadio.checked = true;
  }

  if (data.redirectUrl) {
    redirectUrlInput.value = data.redirectUrl;
  }

  if (data.redirectMessage) {
    redirectMessageInput.value = data.redirectMessage;
  }

  // Update field visibility based on loaded settings
  updateRedirectFields();

  // Save settings
  saveBtn.addEventListener('click', async () => {
    const username = usernameInput.value.trim();
    const dailyLimit = parseInt(dailyLimitInput.value, 10);
    const redirectType = redirectUrlRadio.checked ? 'url' : 'message';
    const redirectUrl = redirectUrlInput.value.trim();
    const redirectMessage = redirectMessageInput.value.trim();

    // Validation
    if (!username) {
      showMessage('Please enter a username', 'error');
      return;
    }

    if (isNaN(dailyLimit) || dailyLimit < 1) {
      showMessage('Daily limit must be at least 1', 'error');
      return;
    }

    if (redirectType === 'url' && !redirectUrl) {
      showMessage('Please enter a redirect URL', 'error');
      return;
    }

    if (redirectType === 'message' && !redirectMessage) {
      showMessage('Please enter a message', 'error');
      return;
    }

    // Basic URL validation
    if (redirectType === 'url') {
      try {
        new URL(redirectUrl);
      } catch {
        showMessage('Please enter a valid URL (include https://)', 'error');
        return;
      }
    }

    // Save to storage
    await chrome.storage.local.set({
      username: username,
      dailyLimit: dailyLimit,
      redirectType: redirectType,
      redirectUrl: redirectUrl,
      redirectMessage: redirectMessage
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
