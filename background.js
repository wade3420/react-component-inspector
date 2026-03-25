// Track inspect mode per tab
const tabStates = new Map();

chrome.action.onClicked.addListener((tab) => {
  const isActive = tabStates.get(tab.id) || false;
  const newState = !isActive;
  tabStates.set(tab.id, newState);

  // Update icon badge
  chrome.action.setBadgeText({
    tabId: tab.id,
    text: newState ? 'ON' : '',
  });
  chrome.action.setBadgeBackgroundColor({
    tabId: tab.id,
    color: newState ? '#10B981' : '#6B7280',
  });

  // Send toggle message to content script
  chrome.tabs.sendMessage(tab.id, {
    type: 'TOGGLE_INSPECT',
    active: newState,
  });
});

// Clean up when tab closes
chrome.tabs.onRemoved.addListener((tabId) => {
  tabStates.delete(tabId);
});
