import { app, globalShortcut, nativeTheme, Menu, shell, ipcMain } from 'electron';
import path from 'path';
import localShortcut from 'electron-localshortcut';
import { menubar } from 'menubar';
import Store from 'electron-store';
import AutoLaunch from 'auto-launch';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { LLM_CONFIG } = require('./llm-config.cjs');

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize store for settings
const store = new Store();

// Auto-launch setup
const autoLauncher = new AutoLaunch({
  name: 'QuickGPT',
  path: app.getPath('exe'),
});

// Load all saved settings before creating anything
const savedWindowBounds = store.get('windowBounds');
const savedTheme = store.get('theme', 'system');

// Apply theme immediately
if (savedTheme === 'dark') {
  nativeTheme.themeSource = 'dark';
} else if (savedTheme === 'light') {
  nativeTheme.themeSource = 'light';
} else {
  nativeTheme.themeSource = 'system';
}

// Determine initial icon based on theme
function getInitialIcon() {
  if (savedTheme === 'dark') {
    return path.join(__dirname, 'assets', 'tray-icon-light.png');
  } else if (savedTheme === 'light') {
    return path.join(__dirname, 'assets', 'tray-icon-dark.png');
  } else {
    // System theme - check current system preference
    return nativeTheme.shouldUseDarkColors 
      ? path.join(__dirname, 'assets', 'tray-icon-light.png')
      : path.join(__dirname, 'assets', 'tray-icon-dark.png');
  }
}

// Create menubar instance with saved settings
const mb = menubar({
  index: `file://${path.join(__dirname, 'index.html')}`,
  icon: getInitialIcon(),
  tooltip: 'QuickGPT - AI Assistant',
  preloadWindow: true,
  showOnRightClick: false, // Ensure context menu only on right-click
  browserWindow: {
    // Use saved window bounds if available, otherwise defaults
    width: savedWindowBounds ? savedWindowBounds.width : 380,
    height: savedWindowBounds ? savedWindowBounds.height : 500,
    x: savedWindowBounds ? savedWindowBounds.x : undefined,
    y: savedWindowBounds ? savedWindowBounds.y : undefined,
    minWidth: 350,
    minHeight: 400,
    resizable: true,
    show: false,
    frame: false,
    alwaysOnTop: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false,
      allowRunningInsecureContent: true,
      webviewTag: true
    }
  },
  showOnAllWorkspaces: false,
  showDockIcon: false,
});

// Variables to track state
let isQuitting = false;
let isRecordingHotkey = false;

app.on('ready', () => {
  // Set app to not show in dock
  if (process.platform === 'darwin') {
    app.dock.hide();
  }

  // Setup global shortcut (theme already applied above)
  const globalHotkey = store.get('globalHotkey', 'CommandOrControl+Shift+G');
  registerGlobalShortcut(globalHotkey);

  // Setup auto-launch
  const autoLaunchEnabled = store.get('autoLaunch', false);
  if (autoLaunchEnabled) {
    autoLauncher.enable().catch(console.error);
  } else {
    autoLauncher.disable().catch(console.error);
  }
});

// Register global shortcut
function registerGlobalShortcut(accelerator) {
  globalShortcut.unregisterAll();
  globalShortcut.register(accelerator, () => {
    // Don't execute if recording hotkey
    if (isRecordingHotkey) {
      return;
    }
    
    if (mb.window && mb.window.isVisible()) {
      mb.hideWindow();
    } else {
      mb.showWindow();
    }
  });
}

// Menubar events
mb.on('ready', () => {
  console.log('QuickGPT is ready');
  
  // Create context menu for tray
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show QuickGPT',
      click: () => {
        // Don't execute if recording hotkey
        if (isRecordingHotkey) {
          return;
        }
        mb.showWindow();
      }
    },
    { type: 'separator' },
    {
      label: 'Preferences',
      click: () => {
        // Don't execute if recording hotkey
        if (isRecordingHotkey) {
          return;
        }
        mb.showWindow();
        mb.window.webContents.send('show-preferences');
      }
    },
    { type: 'separator' },
    {
      label: 'Quit QuickGPT',
      click: () => {
        // Allow quitting even when recording hotkey
        isQuitting = true;
        app.quit();
      }
    }
  ]);
  
  // Override default tray behavior to ensure proper click handling
  mb.tray.removeAllListeners();
  
  // Left click - show/hide window
  mb.tray.on('click', () => {
    // Don't execute if recording hotkey
    if (isRecordingHotkey) {
      return;
    }
    
    if (mb.window && mb.window.isVisible()) {
      mb.hideWindow();
    } else {
      mb.showWindow();
    }
  });
  
  // Double click - always show window
  mb.tray.on('double-click', () => {
    // Don't execute if recording hotkey
    if (isRecordingHotkey) {
      return;
    }
    
    mb.showWindow();
  });
  
  // Right click - show context menu
  mb.tray.on('right-click', () => {
    mb.tray.popUpContextMenu(contextMenu);
  });
  
  // Handle theme changes
  nativeTheme.on('updated', () => {
    updateTrayIcon();
  });
  
  updateTrayIcon();
});

mb.on('after-create-window', () => {
  localShortcut.register(mb.window, 'CommandOrControl+,', () => {
    // Don't execute if recording hotkey
    if (isRecordingHotkey) {
      return;
    }
    mb.window.webContents.send('show-preferences');
  });
  
  localShortcut.register(mb.window, 'Escape', () => {
    // Don't execute if recording hotkey
    if (isRecordingHotkey) {
      return;
    }
    mb.hideWindow();
  });
  
  // localShortcut.register(mb.window, 'CommandOrControl+B', () => {
  //   // Don't execute if recording hotkey
  //   if (isRecordingHotkey) {
  //     return;
  //   }
  //   mb.window.webContents.send('open-current-tab-in-browser');
  // });

  // Handle external links
  mb.window.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Send initial tab setting to renderer (window bounds already applied in constructor)
  mb.window.webContents.once('dom-ready', () => {
    const lastTab = store.get('lastTab', 0);
    // Send immediately since settings are already loaded
    mb.window.webContents.send('restore-last-tab', lastTab);
  });
});

mb.on('show', () => {
  if (process.platform === 'darwin') {
    mb.window.setVisibleOnAllWorkspaces(true);
  }
});

mb.on('hide', () => {
  // Save window bounds
  if (mb.window) {
    store.set('windowBounds', mb.window.getBounds());
  }
});

mb.on('after-hide', () => {
  if (process.platform === 'darwin' && !isQuitting) {
    app.hide();
  }
});

// Update tray icon based on theme
function updateTrayIcon() {
  let iconName;
  if (nativeTheme.shouldUseDarkColors) {
    iconName = 'tray-icon-light.png';
  } else {
    iconName = 'tray-icon-dark.png';
  }
  
  const iconPath = path.join(__dirname, 'assets', iconName);
  mb.tray.setImage(iconPath);
}

// IPC handlers for settings

ipcMain.on('get-setting', (event, key, defaultValue) => {
  event.returnValue = store.get(key, defaultValue);
});

ipcMain.on('set-setting', (event, key, value) => {
  store.set(key, value);
  
  // Handle specific settings
  if (key === 'theme') {
    nativeTheme.themeSource = value;
    updateTrayIcon();
  } else if (key === 'globalHotkey') {
    registerGlobalShortcut(value);
  } else if (key === 'autoLaunch') {
    if (value) {
      autoLauncher.enable().catch(console.error);
    } else {
      autoLauncher.disable().catch(console.error);
    }
  } else if (key === 'lastTab') {
    // Just store it, no action needed
  }
});

ipcMain.on('quit-app', () => {
  isQuitting = true;
  app.quit();
});

ipcMain.on('open-url-in-browser', (event, url) => {
  mb.hideWindow();
  shell.openExternal(url);
});

ipcMain.on('set-hotkey-recording', (event, recording) => {
  isRecordingHotkey = recording;
});

// Prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    // Show window if someone tries to run a second instance
    if (mb.window) {
      mb.showWindow();
    }
  });
}

// App event handlers
app.on('before-quit', () => {
  isQuitting = true;
});

app.on('will-quit', () => {
  // Unregister all shortcuts
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  // Don't quit on window close for menubar apps
});

app.on('activate', () => {
  mb.showWindow();
});

// Security: Prevent new window creation
app.on('web-contents-created', (event, contents) => {
  contents.on('new-window', (event, navigationUrl) => {
    event.preventDefault();
    shell.openExternal(navigationUrl);
  });
}); 