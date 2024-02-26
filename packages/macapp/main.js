const path = require('node:path');
const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');

async function handleFileOpen() {
  const { canceled, filePaths } = await dialog.showOpenDialog();
  if (!canceled) {
    return filePaths[0];
  }
}

function createWindow() {
  const win2 = new BrowserWindow({ width: 800, height: 1500 });
  win2.loadURL('http://localhost:5173');
  return;

  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  const menu = Menu.buildFromTemplate([
    {
      label: app.name,
      submenu: [
        {
          click: () => win.webContents.send('update-counter', 1),
          label: 'Increment',
        },
        {
          click: () => win.webContents.send('update-counter', -1),
          label: 'Decrement',
        },
      ],
    },
  ]);

  Menu.setApplicationMenu(menu);

  win.loadFile('index.html');
  // win.webContents.openDevTools();
}

app.whenReady().then(() => {
  ipcMain.handle('ping', () => 'pong');
  ipcMain.on('set-title', (event, title) => {
    const webContents = event.sender;
    const win = BrowserWindow.fromWebContents(webContents);
    win.setTitle(title);
  });
  ipcMain.handle('dialog:openFile', handleFileOpen);
  ipcMain.on('counter-value', (_event, value) => {
    console.log(value); // will print value to Node console
  });

  createWindow();

  app.on('activate', () => {
    console.log('activate');
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  console.log('window-all-closed');
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
