const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

// 1. 제작자가 빌드에 포함시킨 초기 완전체 DB 경로 (패키지 내부 시드 파일)
const BUNDLED_DB_PATH = path.join(__dirname, 'maple_local_db.json');

// 2. 실제 읽기/쓰기가 이루어질 경로
// 개발 중(npm start)에는 프로젝트 폴더의 파일을 직접 수정하고,
// 배포된 .exe 실행 시에는 유저 PC의 AppData 폴더를 사용하여 읽기 전용(권한) 오류를 방지합니다.
const getWritableDbPath = () => {
  if (!app.isPackaged) {
    return BUNDLED_DB_PATH;
  }
  return path.join(app.getPath('userData'), 'maple_local_db.json');
};

function createWindow() {
  const win = new BrowserWindow({
    width: 1620,
    height: 940,
    minWidth: 1150,
    minHeight: 720,
    backgroundColor: '#0f1218',
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  win.loadFile('index.html');
}

// 로컬 DB 불러오기 (배포된 .exe 최초 실행 시 내장된 완전체 DB를 유저 폴더로 자동 복제)
ipcMain.handle('load-local-db', async () => {
  try {
    const targetPath = getWritableDbPath();

    // 배포 버전에서 유저 PC에 아직 DB가 없거나 내장 DB보다 구버전이면 내장 완전체 DB를 복제
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

// 로컬 DB 저장하기
ipcMain.handle('save-local-db', async (event, payload) => {
  try {
    const targetPath = getWritableDbPath();
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.writeFileSync(targetPath, JSON.stringify(payload, null, 2), 'utf-8');
    return { success: true };
  } catch (err) {
    console.error('DB 저장 오류:', err);
    return { success: false, error: err.message };
  }
});

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});