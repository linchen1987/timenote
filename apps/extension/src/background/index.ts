chrome.action.onClicked.addListener((tab) => {
  if (tab.id) {
    chrome.sidePanel.open({ tabId: tab.id });
  }
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create('auto-sync', { periodInMinutes: 30 });
});

import './fs-handler';
import './sync-scheduler';
