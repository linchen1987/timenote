chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'auto-sync') {
    console.log('[TimeNote] Auto-sync alarm triggered');
  }
});
