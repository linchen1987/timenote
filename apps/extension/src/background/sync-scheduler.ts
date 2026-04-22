chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'auto-sync') {
    console.log('[TimeNote] Auto-sync triggered');
    // TODO: implement auto-sync using NoteService + SyncService
    // This requires importing the sync logic
  }
});
