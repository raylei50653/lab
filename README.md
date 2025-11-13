# React × Django Camera Demo

React 19 + Vite 前端與 Django 5 + OpenCV 後端的全端示範，涵蓋健康檢查、資料 CRUD 以及 MJPEG 串流代理。文件聚焦在開發者日常會用到的環境、指令與疑難排解，部署建議另參閱 `docs/docker.md`。

## 核心特色
- **單一倉庫**：`backend/` 與 `frontend/` 共用 .env、腳本與 docker-compose，方便同步修改。
- **資料 + 串流 API**：Django `data` app 提供文字 CRUD，`camera` app 透過 OpenCV 代理 HTTP MJPEG / RTSP 串流並提供簽章查驗。
- **React 開發體驗**：Vite HMR、React Router、Tailwind 公用元件，並以 `useData` hook 示範 API 整合模式。
- **可觀測性**：所有請求皆可透過 `GET /healthz/` 快速檢查，串流頁面會對應 `/stream/proof/`、`/stream/abort/` 等後端控制 API。
- **容器化腳手架**：`docker-compose.yml` 打包 gunicorn + nginx，前端建置結果直接放進容器，方便 smoke test 或交付。

## 系統需求
- Python 3.12+，建議搭配 [uv](https://github.com/astral-sh/uv) 或 `pip` 管理虛擬環境。
- Node.js 20+ 與 npm。
- 可由開發機連線的攝影機來源（HTTP MJPEG 或 RTSP）；`opencv-python` 安裝時會攜帶必要依賴。
- 選用：Docker Engine 24+、`make`（用於包裝常見指令）。

## 專案結構
```text
.
├── backend/          # Django 專案 (apps: data, camera)
├── frontend/         # React + Vite 用戶端
├── docs/             # 延伸文件 (ex. docker.md)
├── docker-compose.yml
└── Makefile
```

## 快速開始 (本機開發)
1. **Clone** 並進入專案資料夾，必要時建立 `.env` 給 docker 或 CI 使用。
2. **啟動後端**
   ```bash
   cd backend
   uv venv .venv && source .venv/bin/activate   # 或 python -m venv
   uv pip sync                                  # 無 uv 時改用 pip install -r requirements.txt
   python manage.py migrate
   python manage.py runserver 0.0.0.0:8000
   ```
3. **啟動前端**
   ```bash
   cd frontend
   npm install
   npm run dev   # http://localhost:5173，透過 /api 代理到 8000
   ```
4. 開啟瀏覽器造訪 `http://localhost:5173`，依序驗證三個分頁：Health → Data CRUD → Camera。

## 推薦工作流
1. 開兩個終端：A 執行後端 `runserver`，B 執行 `npm run dev`。
2. Health 頁面應回傳 `{"ok": true}` 並帶入 CSRF Cookie。
3. Data CRUD 頁示範 `useData` + `api.js`，每次操作都會重新抓取列表，可同步觀察後端 log。
4. Camera 頁控制 `url / gray / width`，留空 `url` 時使用 `CAMERA_URL`；按下 Reload/Resume 會觸發 `/stream/abort/` 保證只有一條串流。
5. 修改程式時請同步檢查 ESLint (`npm run lint`) 與 Django 測試 (`python manage.py test`)，避免跨端破口。

## 常用指令
| 區域 | 指令 | 用途 |
|------|------|------|
| Backend | `python manage.py runserver` | 啟動本機 API |
| Backend | `python manage.py migrate` | 同步 SQLite schema |
| Backend | `python manage.py test` | 執行 Django 測試與 camera mock |
| Frontend | `npm run dev` | 啟動 Vite HMR |
| Frontend | `npm run build` | 產生 `dist/` 給 nginx 或 docker |
| Frontend | `npm run lint` | ESLint + React Hooks 規則 |
| Root | `docker compose up -d` | 在容器中跑前後端 (gunicorn + nginx) |
| Root | `make docker-*` | `docker compose build/up/down/logs` 的 alias |

## 環境變數速查
> 本機開發可直接改 `.env` 或在 shell 匯入，容器部署則由 `docker compose` 讀取。

### 共用 (根目錄 `.env`)
| 變數 | 說明 | 預設 |
|------|------|------|
| `BACKEND_PORT` / `FRONTEND_PORT` | docker 映射的對外埠號 | `8000` / `4173` |
| `VITE_API_BASE_URL` | 前端建置時寫入的 API URL，遠端部署必填完整網域 | `http://localhost:${BACKEND_PORT:-8000}` |
| `RUN_MIGRATIONS` | docker backend 啟動時是否自動 `migrate` | `true` |
| `PIP_INDEX_URL`, `PIP_EXTRA_INDEX_URL`, `PIP_TRUSTED_HOST` | 企業內部 PyPI 鏡像 | 官方 PyPI |

### Backend (`backend/.env` 或環境變數)
| 變數 | 用途 | 預設 |
|------|------|------|
| `DJANGO_SECRET_KEY` | SECRET_KEY，正式環境務必覆寫 | `django-insecure-dev-placeholder` (本地) |
| `DJANGO_DEBUG` | `True/False` | `False` |
| `DJANGO_ALLOWED_HOSTS` | 逗號分隔 host 白名單 | 空字串 (僅限本機) |
| `DJANGO_CSRF_TRUSTED_ORIGINS` | `scheme://host:port` 列表 | `http://localhost:5173,http://127.0.0.1:5173` |
| `DJANGO_DB_PATH` | SQLite 路徑，可覆寫為 volume | `<backend>/db.sqlite3` |
| `CORS_ALLOW_*` | 已在 `settings.py` 預設全開，部署時可再收斂 | – |

### Camera 相關
| 變數 | 用途 | 舉例 |
|------|------|------|
| `CAMERA_URL` | `/stream/` 預設來源 | `rtsp://192.168.1.2/live` |
| `CAM_FRAME_INTERVAL` | 幀間隔秒數，>0 可節流 | `0.05` ≈ 20fps |

### Frontend (`frontend/.env.local`)
| 變數 | 用途 | 預設 |
|------|------|------|
| `VITE_API_BASE_URL` | 覆蓋 `fetcher` 基底 URL，留空會走 `/api` 代理 | 空字串 |

## API 與 UI 對應
| 頁面 | 主要端點 | 備註 |
|------|-----------|------|
| Health | `GET /healthz/` | 取得 `{"ok": true}` 並刷新 CSRF cookie |
| Data CRUD | `GET/POST /data/`, `PUT/PATCH/DELETE /data/<id>/` | Body 限制 256 KB，`text` 必須是字串 |
| Camera | `GET /stream/` (MJPEG), `GET /stream/proof/`, `POST /stream/abort/` | 支援 `client`, `gray`, `width`, `url` 參數，客製化 UI 能直接重用這些 API |

詳細 payload、錯誤碼與測試方式請閱讀 `backend/README.md`；React 組件拆解與程式碼結構則記錄在 `frontend/README.md`。

## Docker / 部署摘要
1. 建立 `.env`，覆寫 SECRET_KEY、CAMERA_URL、VITE_API_BASE_URL 等必要設定。
2. `docker compose build --pull` (或 `make docker-build`)
3. `docker compose up -d` (或 `make docker-up`)
4. `docker compose ps` 確認 backend `healthy` 後瀏覽 `http://localhost:${FRONTEND_PORT}`。
5. 更多進階情境（volume、私有套件庫、常見錯誤）請看 `docs/docker.md`。

## 測試與品質保證
- 後端：`python manage.py test`，覆蓋 `data` API 驗證與 `camera` 功能。
- 前端：`npm run lint`。可視需求再補整合測試或 Storybook。
- 推薦在 PR / CI 中串接這兩個指令並輸出報表，確保串流修改不會破壞 CRUD。

## Troubleshooting (常見情境)
- `Cannot open camera URL`：確定 `CAMERA_URL` 或 `?url=` 可由後端所在主機連線，必要時在容器內 `curl` / `ffprobe` 測試。
- 前端顯示 `Request timeout`：代表 `fetcher` 遭 10 秒超時，請檢查 `VITE_API_BASE_URL`、Django 是否啟動、以及瀏覽器是否取得 CSRF。
- 串流卡在 `CONNECTING`：檢查瀏覽器 console 是否被 ad-block 阻擋，或 camera 來源無法轉 MJPEG；可在新分頁直接開 `/stream/?client=foo` 驗證。
- Docker backend 長期 `starting`：`docker compose logs backend` 通常會顯示 migrations 失敗、SECRET_KEY 未設或 SQLite 權限不足，修正後重啟即可。
- 需重置資料：`docker compose down -v backend-db-data` (會刪掉 SQLite)，或本機刪除 `backend/db.sqlite3` 後再次 `migrate`。

遇到其他狀況請帶著 `docker compose ps`, `docker compose logs` 或 `python manage.py runserver` 的輸出提交 Issue，便於快速定位。
