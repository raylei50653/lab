# React × Django Camera Demo

一個使用 Django 5 + SQLite 提供 REST / Camera 串流 API，並以 React 19 + Vite 作為前端示範的專案。以下內容以「開發流程」為核心，協助你從零開始建立環境、同步開發與測試、最後部署。

## 面向開發的快速導覽
1. 檢查系統需求並安裝 Python / Node / OpenCV 依賴。
2. 下載原始碼，了解 `backend/` 與 `frontend/` 的分工。
3. 初始化 Django 虛擬環境、安裝套件、遷移資料庫並啟動 API。
4. 初始化 React 專案、安裝 npm 套件並啟動 Vite 開發伺服器。
5. 併行開發：後端維持 `runserver`，前端使用 `npm run dev` 透過代理呼叫 API。
6. 撰寫 / 調整功能後，以 linters、單元測試與 docker-compose 驗證整體流程。

---

## 0. 基本需求
- Python 3.12+，搭配 `pip` 或 [uv](https://github.com/astral-sh/uv)。
- Node.js 20+ 與 npm。
- 可用的相機來源 (HTTP MJPEG 或 RTSP)；OpenCV 會隨 `opencv-python` 安裝。
- 推薦安裝 `make` 或自行建立 shell scripts 以符合團隊習慣。

## 1. 取得專案與結構
```text
.
├── backend/      # Django 專案 (data、camera 兩個 app)
├── frontend/     # React + Vite 客戶端
└── docker-compose.yml
```
> Git clone 後，可在根目錄建立共用 `.env`，提供 docker-compose 或 CI 使用。

## 2. 後端開發流程 (`backend/`)
1. 建立並啟用虛擬環境：
   ```bash
   cd backend
   uv venv .venv            # 或 python -m venv .venv
   source .venv/bin/activate  # Windows 使用 Scripts\activate
   ```
2. 安裝套件與遷移資料庫：
   ```bash
   uv pip sync              # 無 uv 時改用 pip install -r requirements.txt
   python manage.py migrate
   ```
3. 進入開發迭代：
   ```bash
   python manage.py runserver 0.0.0.0:8000
   ```
4. 主要 app 職責：
   - `data`：提供文字 CRUD (CharField) 的 JSON API。
   - `camera`：透過 OpenCV 代理單路 IP camera，輸出 `multipart/x-mixed-replace` MJPEG。

## 3. 前端開發流程 (`frontend/`)
1. 安裝依賴並啟動開發伺服器：
   ```bash
   cd frontend
   npm install
   npm run dev   # http://localhost:5173
   ```
2. React Router 頁面：
   - **Health Check**：呼叫 `/healthz/` 並初始化 CSRF cookie。
   - **Data CRUD**：示範 `useData` hook 管理文字清單。
   - **Camera**：操作 `url / gray / width` 參數，串流顯示 MJPEG。
3. API 代理：
   - 開發階段透過 `vite.config.js` 將 `fetch('/api/...')` 指向 `http://localhost:8000`。
   - 若後端不在同源，可建立 `.env(.local)`，設定 `VITE_API_BASE_URL=https://api.example.com`。

## 4. 並行開發節奏
1. 終端 A：`cd backend && source .venv/bin/activate && python manage.py runserver`。
2. 終端 B：`cd frontend && npm run dev`。
3. 瀏覽器進入 `http://localhost:5173`：
   - 先在 Health Check 頁確認 `/healthz/` 正常並取得 CSRF。
   - 在 Data CRUD 頁新增 / 編輯資料以測試 JSON API。
   - 在 Camera 頁輸入 RTSP / MJPEG URL，若留空則fallback 至 `CAMERA_URL`。

## 5. 常用指令
| 區域 | 指令 | 說明 |
|------|------|------|
| Backend | `python manage.py runserver` | 啟動 API |
| Backend | `python manage.py migrate` | 更新資料庫 |
| Frontend | `npm run dev` | 啟動 Vite 開發伺服器 |
| Frontend | `npm run build` | 產生正式版靜態檔 (`frontend/dist`) |
| Frontend | `npm run preview` | 在本機模擬正式部署 |
| Frontend | `npm run lint` | 執行 ESLint (含 Hooks 規則) |

## 6. 重要設定
### 後端環境變數
| 變數 | 用途 | 預設 |
|------|------|------|
| `DJANGO_DEBUG` | 是否開啟除錯模式 | `False` |
| `DJANGO_ALLOWED_HOSTS` | 逗號分隔白名單 | 空 (僅限 localhost) |
| `CAMERA_URL` | `GET /stream/` 的預設來源 | – |
| `CAM_OPEN_RETRY` | 重新連線攝影機的間隔秒數 | `2` |
| `CAM_OPEN_TEST_TIMEOUT` | 新串流建立前的測試逾時 | `8` |
| `CAM_STREAM_LOCK_WAIT` | 切換來源時鎖等待秒數 | `5` |
| `CAM_FRAME_INTERVAL` | 影格間隔秒數 (>0 時可節流) | `0` |
| `CAM_CLIENT_ACK_TIMEOUT` | 前端 heartbeat 逾時秒數 (<=0 停用) | `15` |

### 前端環境變數
- `VITE_API_BASE_URL`：預設 `''` (透過 Vite 代理)。部署時應設定為後端公開網址。

## 7. API 與 UI 功能快覽
| Method & Path | 說明 |
|---------------|------|
| `GET /healthz/` | 健康檢查，回傳 `{ "ok": true }` 並附帶 CSRF cookie |
| `GET /data/`、`POST /data/` | 列表 / 新增資料 (`{"text":"..."}`) |
| `GET /data/<id>/`、`PUT/PATCH /data/<id>/`、`DELETE /data/<id>/` | 讀取 / 覆寫 / 刪除單筆 |
| `GET /stream/` | 代理攝影機，支援 `url`, `gray`, `width` |
| `POST /stream/control/` | 前端 `{"action":"ack|stop","client":"..."}` heartbeat/釋放串流 |
> 更多細節請見 `backend/README.md`。

## 8. Docker 流程
以 docker-compose 同步啟動 Django API 與已建置的 React 靜態站：
1. (可選) 在專案根目錄建立 `.env`，覆寫：
   - `BACKEND_PORT` (預設 `8000`)
   - `FRONTEND_PORT` (預設 `4173`)
   - `VITE_API_BASE_URL` (build 時寫入前端，預設 `http://localhost:${BACKEND_PORT:-8000}`，務必填入瀏覽器可解析的完整 URL)
   - 其他 `DJANGO_*` 與 `CAMERA_*` 相關設定
2. `docker compose build`
3. `docker compose up -d` → 前端 `http://localhost:4173`，API `http://localhost:8000`
4. 結束：`docker compose down`
> 後端容器啟動時會自動 `python manage.py migrate`；如需持久化 SQLite 請自備 volume。

## 9. 測試與品質
- 後端：`python manage.py test`
- 前端：`npm run lint` (建議另行補強整合測試覆蓋關鍵流程)

## 10. Troubleshooting
- `GET /stream/` 卡住：可能有其他瀏覽器頁籤占用串流，請在 Camera 頁按 **Reload** 釋放。
- 503 `Cannot open camera URL`：確認 `CAMERA_URL` 或 `?url=` 可由後端機器連線，並確保來源為 HTTP MJPEG / RTSP。
- CRUD API 回傳 400：`text` 必須為字串，body 需小於 256 KB。
- 前端提示 `Request timeout`：確認後端已啟動、`VITE_API_BASE_URL` / 代理設定正確，且 CORS/CSRF 符合部署環境。
