// electron/main.cjs
// Host Process: Manages native window and backend daemon lifecycle.
// Spawns backend executable on startup and cleanly kills it on quit to prevent orphans.

const { app, BrowserWindow, dialog } = require('electron');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');

let mainWindow = null;
let backendProcess = null;

const BACKEND_PORT = 8000;
const BACKEND_HOST = '127.0.0.1';
const HEALTH_URL = `http://${BACKEND_HOST}:${BACKEND_PORT}/api/info`;
const IS_DEV = !app.isPackaged && process.env.NODE_ENV !== 'production';

// Ensure single instance to avoid port 8000 collisions
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

/**
 * Health check polling to wait until FastAPI backend responds
 */
function waitForBackend(url, timeoutMs = 25000, intervalMs = 400) {
  const startTime = Date.now();
  return new Promise((resolve, reject) => {
    const check = () => {
      const req = http.get(url, (res) => {
        if (res.statusCode >= 200 && res.statusCode < 400) {
          resolve();
        } else {
          retry();
        }
      });
      req.on('error', () => {
        retry();
      });
      req.setTimeout(800, () => {
        req.destroy();
        retry();
      });
    };

    const retry = () => {
      if (Date.now() - startTime >= timeoutMs) {
        reject(new Error(`Backend failed to respond within ${timeoutMs / 1000}s`));
      } else {
        setTimeout(check, intervalMs);
      }
    };

    check();
  });
}

/**
 * Resolve the path to the backend executable
 */
function getBackendExecutable() {
  if (IS_DEV) {
    // In dev mode, check if backend.exe was built, or fall back to python script
    const localExe = path.join(__dirname, '../../../backend/dist/backend.exe');
    return { command: localExe, args: [], isExe: true };
  }
  // In packaged electron app: resources/backend/backend.exe
  const packagedExe = path.join(process.resourcesPath, 'backend', 'backend.exe');
  return { command: packagedExe, args: [], isExe: true };
}

/**
 * Launch backend process
 */
function startBackend() {
  const { command, args } = getBackendExecutable();

  try {
    backendProcess = spawn(command, args, {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    backendProcess.stdout?.on('data', (data) => {
      console.log(`[backend stdout]: ${data}`);
    });

    backendProcess.stderr?.on('data', (data) => {
      console.error(`[backend stderr]: ${data}`);
    });

    backendProcess.on('exit', (code, signal) => {
      console.log(`Backend process exited with code ${code}, signal ${signal}`);
      backendProcess = null;
    });
  } catch (err) {
    console.error('Failed to spawn backend process:', err);
  }
}

/**
 * Cleanly terminate backend daemon to avoid orphan processes
 */
function stopBackend() {
  if (backendProcess && !backendProcess.killed) {
    console.log('Terminating backend process...');
    try {
      if (process.platform === 'win32' && backendProcess.pid) {
        // Force kill child process tree on Windows
        spawn('taskkill', ['/pid', backendProcess.pid.toString(), '/T', '/F']);
      } else {
        backendProcess.kill();
      }
    } catch (e) {
      console.error('Error stopping backend:', e);
    }
    backendProcess = null;
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 980,
    minHeight: 680,
    backgroundColor: '#070b12',
    title: 'System Monitor & Task Automator',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs'),
    },
    show: false,
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  if (IS_DEV && process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  // Start backend unless disabled via env for testing
  if (process.env.NO_SPAWN_BACKEND !== '1') {
    startBackend();
  }

  // Wait for backend to be healthy before displaying window
  try {
    await waitForBackend(HEALTH_URL, 15000);
  } catch (err) {
    console.warn('Backend not responding yet, proceeding with window load:', err.message);
  }

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('before-quit', () => {
  stopBackend();
});

app.on('window-all-closed', () => {
  stopBackend();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
