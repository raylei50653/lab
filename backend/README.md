# Backend (Django 5)

本資料夾包含 Django 5 + SQLite + OpenCV 所組成的 REST / MJPEG API。此 README 重點整理開發流程、端點定義、環境變數與常見除錯方式，搭配根目錄與 frontend README 可形成完整開發指南。

## 系統需求
- Python 3.12+
- [uv](https://github.com/astral-sh/uv) 或 `pip` / `venv`
- 可連到攝影機來源的開發機（HTTP MJPEG 或 RTSP）
- OpenCV 會隨 `opencv-python` 套件自動安裝

## 安裝與啟動
```bash
cd backend
uv venv .venv && source .venv/bin/activate        # 或 python -m venv .venv
uv pip sync                                        # 無 uv 時改用 pip install -r requirements.txt
python manage.py migrate
python manage.py runserver 0.0.0.0:8000
```
> `python-dotenv` 會自動載入 `backend/.env`，若缺少 `DJANGO_SECRET_KEY` 會以開發用值取代。

## 專案結構
```text
backend/
├── config/            # Django settings / urls / wsgi
├── data/              # 文字 CRUD API (JSON)
├── camera/            # MJPEG 串流與簽章服務
├── docker-entrypoint.sh
├── Dockerfile
├── manage.py
├── pyproject.toml / requirements.txt
└── uv.lock
```

## 常用管理指令
| 指令 | 用途 |
|------|------|
| `python manage.py runserver` | 啟動開發伺服器 (預設 8000) |
| `python manage.py migrate` | 套用資料庫遷移，預設 SQLite |
| `python manage.py createsuperuser` | 建立 Django 管理者帳號 |
| `python manage.py shell` | 互動式除錯環境 |
| `python manage.py test` | 執行 `data` / `camera` 相關測試 |

## API 詳解

### 1. 健康檢查
- `GET /healthz/`
- 回傳 `{"ok": true}` 並初始化 CSRF cookie（前端 Health 分頁依賴此行為）。
- Docker healthcheck 亦使用此端點。

### 2. 資料 CRUD (`data` app)
資料模型僅包含 `text: CharField`, `created_at`, `updated_at`。所有端點皆允許跨來源 OPTIONS，以方便代理。

| Method & Path | 描述 | 請求 body | 回應 |
|---------------|------|-----------|------|
| `GET /data/` | 取得所有資料（支援 `?search=` 關鍵字） | – | `200 OK` + 陣列 |
| `POST /data/` | 建立資料 | `{ "text": "hello" }` | `201 Created` + 新物件 |
| `GET /data/<id>/` | 取得單筆 | – | `200 OK` + 物件 |
| `PUT /data/<id>/`, `PATCH /data/<id>/` | 更新單筆 | `{ "text": "new" }` | `200 OK` + 更新後物件 |
| `DELETE /data/<id>/` | 刪除單筆 | – | `204 No Content` |

行為重點：
- Body 最大 256 KB，必須是合法 JSON 並包含 `text` 字串。
- `GET /data/` 可接受 `?search=` keyword，會以 `text__icontains` 篩選資料（忽略大小寫，空字串視為未篩選）。
- 失敗時回傳 `{"error": "message"}` 與對應 HTTP 狀態碼。
- `@csrf_exempt` 已套用在 API 層，前端仍需先呼叫 `/healthz/` 以取得 CSRF cookie。

### 3. 攝影機串流 (`camera` app)
此 app 使用 OpenCV `VideoCapture` 並輸出 `multipart/x-mixed-replace`，同時提供後端簽章與主動中斷機制。

#### 3.1 `GET /stream/`
- 參數：
  - `url`: 選填，HTTP(s) MJPEG 或 RTSP。若省略則使用 `CAMERA_URL`。
  - `gray`: `1/true` 代表轉為灰階。
  - `width`: 目標寬度（px，>=16）。高度會等比縮放。
  - `client`: 選填，自訂連線 ID，用於後續 `abort`。
- 回應：`Content-Type: multipart/x-mixed-replace; boundary=frame`。每幀為 JPEG 80% 品質。
- 伺服器端會以 `CAM_FRAME_INTERVAL` 控制最大 FPS，並在連線終止時釋放資源。

#### 3.2 `GET /stream/proof/`
- 與 `/stream/` 接受相同參數。
- 回傳 JSON，包含：
  ```json
  {
    "via_backend": true,
    "client_id": "uuid",
    "request_id": "...",
    "server_time": "2025-01-01T00:00:00Z",
    "camera_protocol": "http",
    "camera_host": "demo.camera",
    "camera_signature": "sha256(url)"
  }
  ```
- Camera 頁會定期輪詢此端點，以便顯示後端確實連線的證明。

#### 3.3 `POST /stream/abort/?client=<id>`
- 依照 `client` ID 註銷舊串流，回傳 `{ "aborted": true }` 表示有連線被終止。
- 用於前端在調整參數或離開頁面時主動釋放後端資源。

## 環境變數
| 變數 | 說明 | 預設 |
|------|------|------|
| `DJANGO_SECRET_KEY` | SECRET_KEY，正式環境必須覆寫 | `django-insecure-dev-placeholder` |
| `DJANGO_DEBUG` | `True/False` | `False` |
| `DJANGO_ALLOWED_HOSTS` | 逗號分隔 host 名稱 | 空值 (本機) |
| `DJANGO_CSRF_TRUSTED_ORIGINS` | 允許跨站 CSRF 的來源 (含協定/埠) | `http://localhost:5173,http://127.0.0.1:5173` |
| `DJANGO_DB_PATH` | SQLite 檔案路徑，可設定為 volume 位置 | `<BASE_DIR>/db.sqlite3` |
| `CAMERA_URL` | `/stream/` 預設來源 | – |
| `CAM_FRAME_INTERVAL` | 幀間隔秒數 (0 為不限) | `0` |

這些變數可透過：
- `backend/.env`
- shell 匯入 (`export DJANGO_DEBUG=true`)
- docker-compose `.env` (對容器匯入)

## 測試
```bash
python manage.py test
```
- `data.tests` 針對 CRUD API 驗證資料驗證、狀態碼與錯誤訊息。
- `camera.tests` 提供基本串流函式測試，可依需要補上 mock / fixture。

## Troubleshooting
- **`Invalid or missing camera URL`**：確認 query string 或 `CAMERA_URL` 是否為 http(s)/rtsp；若僅支援 HTTPS MJPEG，請確保安裝相容 ffmpeg。
- **串流秒斷**：可能來源只允許單連線，或 `WIDTH` 太小導致影像尺寸錯誤；可查看 `python manage.py runserver` log。
- **CORS / CSRF 失敗**：部署在非 localhost 的環境時，記得同步更新 `DJANGO_ALLOWED_HOSTS` 與 `DJANGO_CSRF_TRUSTED_ORIGINS`，並確保反向代理保留 `Cookie` header。
- **SQLite 權限問題**：把 `DJANGO_DB_PATH` 指到 `./db/db.sqlite3` 並確保目錄可寫；docker 情境下 volume 對應 `backend-db-data`。

更多部署與容器化細節請見根目錄 `README.md` 與 `docs/docker.md`。
