const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

const BUNDLED_DB_PATH = path.join(__dirname, 'maple_local_db.json');

const getWritableDbPath = () => {
  if (!app.isPackaged) {
    return BUNDLED_DB_PATH;
  }
  return path.join(app.getPath('userData'), 'maple_local_db.json');
};

let mainWindow = null;
let simWindow = null;

// 자석 스냅(Snapping) 상태 관리 변수
let isSnapped = true;
let isProgrammaticMove = false;
const SNAP_THRESHOLD = 28; // 메인 창 우측 경계와 28px 이내로 가까워지면 자석처럼 달라붙음
const SIM_WINDOW_WIDTH = 430;

function syncSimulatorPosition() {
  if (!mainWindow || !simWindow || mainWindow.isDestroyed() || simWindow.isDestroyed()) return;
  if (!isSnapped || !simWindow.isVisible()) return;

  const mainBounds = mainWindow.getBounds();
  const simBounds = simWindow.getBounds();

  isProgrammaticMove = true;
  simWindow.setBounds({
    x: mainBounds.x + mainBounds.width - 2, // 메인 창 우측 테두리에 밀착
    y: mainBounds.y,
    width: simBounds.width || SIM_WINDOW_WIDTH,
    height: mainBounds.height
  });
  setTimeout(() => { isProgrammaticMove = false; }, 25);
}

function createSimulatorWindow() {
  if (simWindow && !simWindow.isDestroyed()) {
    if (simWindow.isVisible()) {
      simWindow.hide();
    } else {
      simWindow.show();
      syncSimulatorPosition();
    }
    return;
  }

  const mainBounds = mainWindow ? mainWindow.getBounds() : { x: 100, y: 100, width: 1500, height: 920 };

  simWindow = new BrowserWindow({
    x: mainBounds.x + mainBounds.width - 2,
    y: mainBounds.y,
    width: SIM_WINDOW_WIDTH,
    height: mainBounds.height,
    minWidth: 380,
    minHeight: 520,
    frame: false, // 메이플 외부 채팅창 스타일 프레임리스 창
    backgroundColor: '#11151e',
    alwaysOnTop: false,
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  simWindow.loadFile('simulator.html');

  // 사용자가 시뮬레이터 창을 마우스로 드래그할 때 자석 탈부착 판정
  simWindow.on('move', () => {
    if (isProgrammaticMove || !mainWindow || mainWindow.isDestroyed()) return;

    const mBounds = mainWindow.getBounds();
    const sBounds = simWindow.getBounds();

    const targetRightX = mBounds.x + mBounds.width;
    const distX = Math.abs(sBounds.x - targetRightX);
    const distY = Math.abs(sBounds.y - mBounds.y);

    if (distX <= SNAP_THRESHOLD && distY <= 60) {
      if (!isSnapped) {
        isSnapped = true;
        simWindow.webContents.send('snap-state-changed', true);
      }
      syncSimulatorPosition();
    } else {
      if (isSnapped) {
        isSnapped = false;
        simWindow.webContents.send('snap-state-changed', false);
      }
    }
  });

  simWindow.on('closed', () => {
    simWindow = null;
  });
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1520,
    height: 920,
    minWidth: 1100,
    minHeight: 720,
    backgroundColor: '#0f1218',
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  mainWindow.loadFile('index.html');

  // 메인 창 이동/크기 조절 시 자석처럼 붙어있는 시뮬레이터 창 동시 이동
  mainWindow.on('move', () => syncSimulatorPosition());
  mainWindow.on('resize', () => syncSimulatorPosition());

  mainWindow.on('minimize', () => {
    if (simWindow && !simWindow.isDestroyed() && isSnapped) simWindow.minimize();
  });

  mainWindow.on('restore', () => {
    if (simWindow && !simWindow.isDestroyed() && isSnapped) {
      simWindow.restore();
      syncSimulatorPosition();
    }
  });

  // 메인 창이 닫히면 전체 앱 종료
  mainWindow.on('closed', () => {
    mainWindow = null;
    if (simWindow && !simWindow.isDestroyed()) {
      simWindow.close();
    }
    app.quit();
  });

  // index.html과 app.js를 건드리지 않고도 상단에 [🧭 시뮬레이터 창] 열기/닫기 버튼을 자동 주입
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.executeJavaScript(`
      (function() {
        const extBtn = document.getElementById('toggleExtensionBtn');
        if (extBtn && !document.getElementById('toggleSimWindowBtn')) {
          const simBtn = document.createElement('button');
          simBtn.id = 'toggleSimWindowBtn';
          simBtn.type = 'button';
          simBtn.className = 'btn-primary';
          simBtn.style.cssText = 'height: 32px; padding: 0 10px; font-size: 12px; white-space: nowrap; background: #2b6cb0; border-color: #63b3ed;';
          simBtn.textContent = '🧭 추천 시뮬레이터 창';
          simBtn.addEventListener('click', () => {
            require('electron').ipcRenderer.send('toggle-sim-window');
          });
          extBtn.parentElement.appendChild(simBtn);
        }
      })();
    `).catch(() => {});

    // 메인 창 로드 완료 후 우측에 자석 시뮬레이터 창 자동 부착 실행
    createSimulatorWindow();
  });
}

// 로컬 DB 불러오기
ipcMain.handle('load-local-db', async () => {
  try {
    const targetPath = getWritableDbPath();

    if (app.isPackaged && !fs.existsSync(targetPath)) {
      if (fs.existsSync(BUNDLED_DB_PATH)) {
        const seedRaw = fs.readFileSync(BUNDLED_DB_PATH, 'utf-8');
        fs.mkdirSync(path.dirname(targetPath), { recursive: true });
        fs.writeFileSync(targetPath, seedRaw, 'utf-8');
      }
    }

    const readPath = fs.existsSync(targetPath) ? targetPath : BUNDLED_DB_PATH;
    if (!fs.existsSync(readPath)) {
      return { success: true, data: { seasons: {}, records: [] } };
    }

    const raw = fs.readFileSync(readPath, 'utf-8');
    return { success: true, data: JSON.parse(raw) };
  } catch (err) {
    console.error('DB 로드 오류:', err);
    return { success: false, error: err.message };
  }
});

// 로컬 DB 저장하기 (저장 즉시 시뮬레이터 창에도 실시간 갱신 신호 전달)
ipcMain.handle('save-local-db', async (event, payload) => {
  try {
    const targetPath = getWritableDbPath();
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.writeFileSync(targetPath, JSON.stringify(payload, null, 2), 'utf-8');

    if (simWindow && !simWindow.isDestroyed()) {
      simWindow.webContents.send('db-updated-from-main');
    }
    return { success: true };
  } catch (err) {
    console.error('DB 저장 오류:', err);
    return { success: false, error: err.message };
  }
});

// 시뮬레이터 창 제어용 IPC 이벤트
ipcMain.on('toggle-sim-window', () => {
  createSimulatorWindow();
});

ipcMain.on('sim-force-snap', () => {
  isSnapped = true;
  syncSimulatorPosition();
  if (simWindow && !simWindow.isDestroyed()) {
    simWindow.webContents.send('snap-state-changed', true);
  }
});

ipcMain.on('sim-toggle-always-on-top', (event, flag) => {
  if (simWindow && !simWindow.isDestroyed()) {
    simWindow.setAlwaysOnTop(Boolean(flag));
  }
});

ipcMain.on('sim-window-minimize', () => {
  if (simWindow && !simWindow.isDestroyed()) simWindow.minimize();
});

ipcMain.on('sim-window-close', () => {
  if (simWindow && !simWindow.isDestroyed()) simWindow.hide();
});

// 시뮬레이터에서 직업을 클릭했을 때 메인 대시보드의 해당 직업 상세 뷰로 연동
ipcMain.on('sim-select-job-in-main', (event, jobName) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.executeJavaScript(`
      (function() {
        const filterEl = document.getElementById('rankJobFilter');
        if (filterEl) {
          filterEl.value = ${JSON.stringify(jobName)};
          filterEl.dispatchEvent(new Event('change'));
        }
      })();
    `).catch(() => {});
  }
});

app.whenReady().then(() => {
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});