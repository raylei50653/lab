# React × Django Camera Demo

一個使用 Django 5 + SQLite 構建的 REST / Camera 串流 API，搭配 React 19 + Vite 前端的示範專案。後端提供健康檢查、JSON CRUD 與單路攝影機串流，前端則示範如何呼叫 API、管理資料，並直接在瀏覽器顯示 MJPEG 影像。

## 專案結構
```
.
├── backend/      # Django 專案與 API (data、camera 兩個 app)
└── frontend/     # React + Vite 客戶端
```

## 系統需求
- Python 3.12 以上、pip 或 [uv](https://github.com/astral-sh/uv)
- Node.js 20+ 與 npm
- OpenCV 會隨 `opencv-python` 套件安裝，但仍需可用的系統相機來源 (HTTP MJPEG 或 RTSP)

## 後端 (backend/)
Django 5 專案包含兩個 app：
- `data`：使用 `JSONField` 儲存任意 JSON，提供完整 CRUD。
- `camera`：透過 OpenCV 代理單一 IP camera，輸出為 `multipart/x-mixed-replace` MJPEG 串流。

### 啟動流程
```bash
cd backend
uv venv .venv               # 或 python -m venv .venv
source .venv/bin/activate
uv pip sync                 # 依 uv.lock 安裝依賴，無 uv 時請改用 pip install
django>=5.2.8 django-cors-headers>=4.9.0 opencv-python>=4.12.0.88 python-dotenv>=1.2.1
python manage.py migrate
python manage.py runserver 0.0.0.0:8000
```
> Windows 可改用 `Scripts\\activate`。

### 重要環境變數
| 變數 | 用途 | 預設 |
|------|------|------|
| `DJANGO_DEBUG` | 是否開啟除錯模式 | `False` |
| `DJANGO_ALLOWED_HOSTS` | 逗號分隔白名單 | 空 (僅限 localhost) |
| `CAMERA_URL` | `GET /stream/` 未帶 `?url` 時的預設來源 | – |
| `CAM_OPEN_RETRY` | 重新連線攝影機的間隔秒數 | `2` |
| `CAM_OPEN_TEST_TIMEOUT` | 建立新串流前的測試逾時 | `8` |
| `CAM_STREAM_LOCK_WAIT` | 切換來源時鎖等待秒數 | `5` |
| `CAM_FRAME_INTERVAL` | 影格間隔秒數，大於 0 可節流 | `0` |

### API 快覽
| Method & Path | 說明 |
|---------------|------|
| `GET /healthz/` | 健康檢查，回傳 `{ "ok": true }` 並附帶 CSRF cookie |
| `GET /data/`、`POST /data/` | 列表 / 新增資料 (body: `{"content": {...}}`) |
| `GET /data/<id>/`、`PUT/PATCH /data/<id>/`、`DELETE /data/<id>/` | 讀取 / 覆寫 / 刪除單筆資料 |
| `GET /stream/` | 代理攝影機，支援查詢參數 `url`, `gray`, `width` |
> 更完整細節可見 `backend/README.md`。

## 前端 (frontend/)
React 19 + Vite 7，內建 React Router 兩頁：
1. **Home**：健康檢查、JSON CRUD 表單與表格 (使用 `useData` hook)。
2. **Camera**：設定來源 / 灰階 / 寬度，顯示後端串流，並提示連線狀態。

### 開發環境
```bash
cd frontend
npm install
npm run dev     # http://localhost:5173
```
- 預設會將 `fetch('/api/...')` 代理到 `http://localhost:8000` (見 `vite.config.js`)。
- 若後端不在同一來源，建立 `.env` (或 `.env.local`) 並設定 `VITE_API_BASE_URL=https://api.example.com`，前端會直接呼叫該 base URL。

### npm 指令
| 指令 | 說明 |
|------|------|
| `npm run dev` | 啟動 Vite 開發伺服器 (含 API 代理) |
| `npm run build` | 產生最小化的靜態檔至 `frontend/dist/` |
| `npm run preview` | 模擬正式環境以測試打包結果 |
| `npm run lint` | 執行 ESLint (React、Hooks 規則) |

## 同步開發流程
1. 啟動 Django：`cd backend && source .venv/bin/activate && python manage.py runserver`。
2. 另開終端執行 `npm run dev`。
3. 造訪 `http://localhost:5173`，Home 頁可測試 CRUD；Camera 頁輸入攝影機 URL 或留空使用 `CAMERA_URL`。

## 部署建議
- 後端：設定實際 `DJANGO_ALLOWED_HOSTS`、`CSRF_TRUSTED_ORIGINS`，並於部署平台上指定 `CAMERA_URL` 及相機相關變數。
- 前端：`npm run build` 後將 `frontend/dist` 發佈至任一靜態主機，並把 `VITE_API_BASE_URL` 指向後端的公開網址。
- 若要同站部署，可讓前端打包結果放進 CDN，再由前端透過 HTTPS 呼叫後端。

## Troubleshooting
- `GET /stream/` 一直卡住：確認沒有其他瀏覽器頁籤占用串流；必要時在 Camera 頁按下 **Reload** 釋放舊連線。
- 回傳 503 `Cannot open camera URL`：檢查 `CAMERA_URL` 或 `?url=` 是否可由後端機器連線，並確保格式為 HTTP MJPEG 或 RTSP。
- CRUD API 收到 400：`content` 欄位必須是 JSON 物件，且 body 不能超過 256 KB。
- 前端顯示 `Request timeout`：後端若尚未啟動或 CORS 設定不符，請確認 `VITE_API_BASE_URL` 及反向代理。

## 測試與品質
- 後端：`python manage.py test`。
- 前端：`npm run lint`，必要時加上整合測試以覆蓋關鍵流程。
