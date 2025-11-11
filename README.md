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
| `DJANGO_SECRET_KEY` | Django 的 SECRET_KEY，正式環境務必覆寫 | `insecure-dev-secret` (docker 預設) |
| `DJANGO_DEBUG` | 是否開啟除錯模式 | `False` |
| `DJANGO_ALLOWED_HOSTS` | 逗號分隔白名單 | 空 (本地) / `localhost,backend` (docker 預設) |
| `DJANGO_CSRF_TRUSTED_ORIGINS` | 逗號分隔、含協定與連接埠的 CSRF 可信來源 | `http://localhost:5173,http://127.0.0.1:5173` |
| `CAMERA_URL` | `GET /stream/` 的預設來源 | – |
| `CAM_FRAME_INTERVAL` | 影格間隔秒數 (>0 時可節流) | `0` |
| `RUN_MIGRATIONS` | docker-entrypoint 是否於啟動時自動 `migrate` | `true` |

### 前端環境變數
- `VITE_API_BASE_URL`：預設 `''` (透過 Vite 代理)。部署時應設定為後端公開網址。

## 7. API 與 UI 功能快覽
| Method & Path | 說明 |
|---------------|------|
| `GET /healthz/` | 健康檢查，回傳 `{ "ok": true }` 並附帶 CSRF cookie |
| `GET /data/`、`POST /data/` | 列表 / 新增資料 (`{"text":"..."}`) |
| `GET /data/<id>/`、`PUT/PATCH /data/<id>/`、`DELETE /data/<id>/` | 讀取 / 覆寫 / 刪除單筆 |
| `GET /stream/` | 代理攝影機，支援 `url`, `gray`, `width` |
> 更多細節請見 `backend/README.md`。

## 8. Docker 部署指南
`docker compose` 會一次建置並啟動兩個服務：
- **backend**：Django + gunicorn，內建健康檢查 (`/healthz/`) 並把 SQLite 持久化到 volume。
- **frontend**：使用預先建置的 React 靜態檔，由 nginx 提供並在啟動前等待 backend 變為 healthy。

快速上手：
1. (建議) 在專案根目錄建立 `.env`，覆寫 `DJANGO_SECRET_KEY`、`BACKEND_PORT`、`FRONTEND_PORT`、`VITE_API_BASE_URL`、`RUN_MIGRATIONS` 與任何 `DJANGO_*` / `CAMERA_*` 值。
2. `docker compose build --pull` 或 `make docker-build`
3. `docker compose up -d` 或 `make docker-up`
4. 造訪 `http://localhost:${FRONTEND_PORT:-4173}` (前端) 與 `http://localhost:${BACKEND_PORT:-8000}/healthz/` (API)
5. 停用：`docker compose down`；如果要移除 SQLite volume，使用 `docker compose down -v`

> 需要更詳細的 `.env` 範本、資料持久化、日誌、 rebuild 與疑難排解，請參考 `docs/docker.md`。

| 常用指令 | 說明 |
|-----------|------|
| `docker compose ps` | 確認 backend 是否變為 `healthy`，frontend 何時啟動 |
| `docker compose logs -f backend` | 追蹤 gunicorn / migrations 狀態，找出無法 healthy 的原因 |
| `docker compose exec backend python manage.py migrate` | 手動遷移資料庫 (可搭配 `RUN_MIGRATIONS=false`) |
| `docker compose up -d --build` | 重新建置並熱替換兩個服務 |
| `make docker-*` | `Makefile` 已包裝 `docker compose build/up/down/logs` 指令 |

主要環境變數 (可寫入 `.env`)：

| 變數 | 說明 | 預設 |
|------|------|------|
| `DJANGO_SECRET_KEY` | 正式環境務必覆寫；docker 預設僅供本地測試 | `insecure-dev-secret` |
| `BACKEND_PORT` / `FRONTEND_PORT` | 對 Host 映射的埠號 | `8000` / `4173` |
| `DJANGO_ALLOWED_HOSTS` | 加入瀏覽器實際使用的網域 (逗號分隔) | `localhost,backend` |
| `VITE_API_BASE_URL` | 建置前端時寫死的 API URL，遠端部署時必須填寫完整網域 | `http://localhost:${BACKEND_PORT:-8000}` |
| `RUN_MIGRATIONS` | 啟動前是否自動 `python manage.py migrate` | `true` |
| `CAMERA_URL` 及其他 `CAMERA_*` | 控制攝影機來源、串流節流與重試行為 | 依程式預設 |
| `PIP_INDEX_URL` / `PIP_EXTRA_INDEX_URL` / `PIP_TRUSTED_HOST` | 需要私有套件庫時可以覆寫 | PyPI 官方來源 |
| `DEBIAN_*` | 後端建置時使用的 Debian 鏡像與套件來源 | 官方鏡像 |

## 9. 測試與品質
- 後端：`python manage.py test`
- 前端：`npm run lint` (建議另行補強整合測試覆蓋關鍵流程)

## 10. Troubleshooting
### API / UI
- `GET /stream/` 卡住：按 **Reload** 或使用「新分頁開啟」再連一次即可，串流之間互不鎖定。
- 503 `Cannot open camera URL`：確認 `CAMERA_URL` 或 `?url=` 可由後端機器連線，並確保來源為 HTTP MJPEG / RTSP。
- CRUD API 回傳 400：`text` 必須為字串，body 需小於 256 KB。
- 前端提示 `Request timeout`：確認後端已啟動、`VITE_API_BASE_URL` / 代理設定正確，且 CORS/CSRF 符合部署環境。

### Docker
- `docker compose ps` 顯示 backend `starting` 或 `unhealthy`：請查看 `docker compose logs backend`，常見原因為 migrations 失敗 (可關閉 `RUN_MIGRATIONS` 後手動執行)、`DJANGO_ALLOWED_HOSTS` 缺少實際網域，或 SQLite volume 權限錯誤。
- 前端無法呼叫 API：若容器跑在遠端機器，務必在 `.env` 設定 `VITE_API_BASE_URL=https://your-domain`，並同步更新 `DJANGO_ALLOWED_HOSTS` 與反向代理設定。
- 更多範例與除錯指引請見 `docs/docker.md`。
