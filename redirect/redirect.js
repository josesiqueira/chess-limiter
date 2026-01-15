document.addEventListener('DOMContentLoaded', async () => {
  const messageElement = document.getElementById('message');

  // Get the custom message from storage
  const data = await chrome.storage.local.get(['redirectMessage']);

  if (data.redirectMessage) {
    messageElement.textContent = data.redirectMessage;
  }
});
