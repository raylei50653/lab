# Backend (Django 5)

React × Django Camera Demo 的後端以 Django 5、Django REST Framework 與 OpenCV 組成，負責 `Health / Data / Camera` 三大 API。此 README 給需要動手改程式或排錯的開發者，整理應用架構、端點定義、環境變數、測試與除錯建議，搭配根目錄與 `frontend/README.md` 即可完整復現整套系統。

| App | 功能重點 | 主要端點 |
|-----|----------|----------|
| `data` | 提供最簡單的文字 CRUD，示範 REST 與表單驗證流程，支援 `?search=` 關鍵字查詢。 | `GET/POST /data/`、`PUT/PATCH/DELETE /data/<id>/` |
| `camera` | 藉由 OpenCV 代理 HTTP MJPEG / RTSP 來源，並提供簽章、強制中斷等控制 API。 | `GET /stream/`、`GET /stream/proof/`、`POST /stream/abort/` |
| `config` | Django 設定、URL routing、WSGI 入口。 | `config/urls.py` 匯入 `data` 與 `camera` 路由 |

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

### 總覽

| 頁面 / 用途 | Method + Path | 說明 |
|-------------|---------------|------|
| Health 檢查 | `GET /healthz/` | 回傳 `{"ok": true}`，供前端頁面與 Docker healthcheck 使用。 |
| Data CRUD - 列表/建立 | `GET /data/`、`POST /data/` | 列表支援 `?search=` 模糊比對；`POST` 驗證 `text` 字串 (<=1024)。 |
| Data CRUD - 單筆 | `GET/PUT/PATCH/DELETE /data/<id>/` | 取得、覆蓋、局部更新或刪除單筆資料。 |
| Camera 串流 | `GET /stream/` | 代理 RTSP / HTTP MJPEG，支援 `url`、`client`、`gray`、`width` 參數。 |
| Camera 簽章 | `GET /stream/proof/` | 回傳後端簽章資料，前端可顯示串流來源確實由伺服器建立。 |
| Camera 中止 | `POST /stream/abort/` | 以 `client` ID 中斷舊串流，避免資源佔用。 |

### 1. 健康檢查
- `GET /healthz/`
- 回傳 `{"ok": true}`，供前端 Health 分頁與 Docker healthcheck 快速檢測。

### 2. 資料 CRUD (`data` app)
資料模型僅包含 `text: CharField`, `created_at`, `updated_at`。所有端點皆允許跨來源 OPTIONS，以方便代理。

| Method & Path | 描述 | 查詢參數 / Body | 成功回應 |
|---------------|------|-----------------|----------|
| `GET /data/` | 取得所有資料 | `?search=` (選填，模糊搜尋 `text`) | `200 OK` + 陣列 |
| `POST /data/` | 建立資料 | Body: `{ "text": "hello" }` | `201 Created` + 新物件 |
| `GET /data/<id>/` | 取得單筆 | – | `200 OK` + 物件 |
| `PUT /data/<id>/`, `PATCH /data/<id>/` | 更新單筆 | Body: `{ "text": "new" }` | `200 OK` + 更新後物件 |
| `DELETE /data/<id>/` | 刪除單筆 | – | `204 No Content` |

成功回應範例：
```json
[
  { "id": 1, "text": "demo", "created_at": "2025-03-01T12:00:00Z", "updated_at": "2025-03-01T12:15:00Z" }
]
```

錯誤回應範例：
```json
{ "text": ["text is required"] }
```

行為重點：
- `text` 會自動移除首尾空白，必須是字串且長度 <= 1024；型別錯誤時回傳 400。
- `GET /data/` 的 `?search=` 以 `text__icontains` 篩選資料（忽略大小寫，空字串視為未篩選）。
- Serializer 回傳 detail-friendly 的錯誤格式，方便前端直接顯示。

### 3. 攝影機串流 (`camera` app)
此 app 使用 OpenCV `VideoCapture` 並輸出 `multipart/x-mixed-replace`，同時提供後端簽章與主動中斷機制。

| 參數 | 設定位置 | 說明 |
|------|----------|------|
| `url` | Query | HTTP(s) MJPEG 或 RTSP；留空則使用 `CAMERA_URL` |
| `gray` | Query | `1/true` 代表轉為灰階 |
| `width` | Query | 目標寬度（px，>=16），高度等比例縮放 |
| `client` | Query / body | 前端自訂連線 ID，用於 `abort` |

#### 3.1 `GET /stream/`
- 回應：`Content-Type: multipart/x-mixed-replace; boundary=frame`。每幀為 JPEG 80% 品質。
- 伺服器端會以 `CAM_FRAME_INTERVAL` 控制最大 FPS，並在連線終止時釋放資源。
- 若 URL 無效或來源無法打開，回傳 `400 Invalid or missing camera URL`。

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
- Camera 頁會定期輪詢此端點，以顯示後端確實連線的證明與來源資訊。

#### 3.3 `POST /stream/abort/?client=<id>`
- 依照 `client` ID 註銷舊串流，回傳 `{ "aborted": true }` 表示有連線被終止。
- 用於前端在調整參數或離開頁面時主動釋放後端資源；若 `client` 未連線則回傳 `{ "aborted": false }`。

## 環境變數
| 變數 | 說明 | 預設 |
|------|------|------|
| `DJANGO_SECRET_KEY` | SECRET_KEY，正式環境必須覆寫 | `django-insecure-dev-placeholder` |
| `DJANGO_DEBUG` | `True/False` | `False` |
| `DJANGO_ALLOWED_HOSTS` | 逗號分隔 host 名稱 | 空值 (本機) |
| `DJANGO_DB_PATH` | SQLite 檔案路徑，可設定為 volume 位置 | `<BASE_DIR>/db.sqlite3` |
| `CAMERA_URL` | `/stream/` 預設來源 | – |
| `CAM_FRAME_INTERVAL` | 幀間隔秒數 (0 為不限) | `0` |

這些變數可透過：
- `backend/.env`
- shell 匯入 (`export DJANGO_DEBUG=true`)
- docker-compose `.env` (對容器匯入)

## 攝影機連線備忘 / NAT vs Bridge
- **建議在 VM 或容器使用 Bridge/Host 模式**：RTSP / MJPEG 需要來源主動回傳封包，NAT 容易讓攝影機封包被擋下，造成 `Cannot open camera URL`。
- 本機 (Host)、VM、Camera 建議位於同一子網（例如 `10.15.106.0/24`），便於使用 Wireshark / ffprobe 觀察封包。
- 若必須使用 NAT，可在防火牆或路由器設定 port forwarding，但這通常比切換到 Bridge 更難維護。
- 連線失敗時，可在主機或容器內直接 `ffprobe <url>` 或 `curl -I http://camera/stream` 確認來源是否可達。

## 測試
```bash
python manage.py test
```
- `data.tests` 針對 CRUD API 驗證資料驗證、狀態碼與錯誤訊息。
- `camera.tests` 提供基本串流函式測試，可依需要補上 mock / fixture。

## Troubleshooting
- **`Invalid or missing camera URL`**：確認 query string 或 `CAMERA_URL` 是否為 http(s)/rtsp；若僅支援 HTTPS MJPEG，請確保安裝相容 ffmpeg。
- **串流秒斷**：可能來源只允許單連線，或 `WIDTH` 太小導致影像尺寸錯誤；可查看 `python manage.py runserver` log。
- **VM 使用 NAT 造成無法抓流**：改用 Bridge 模式或在 Hyper-V / VMware 啟用「外部網路」介面，確保攝影機能直接回傳封包。
- **CORS 失敗**：部署在非 localhost 的環境時，記得同步更新 `DJANGO_ALLOWED_HOSTS`，並確認前端實際使用的網域/IP 已包含在其中。
- **SQLite 權限問題**：把 `DJANGO_DB_PATH` 指到 `./db/db.sqlite3` 並確保目錄可寫；docker 情境下 volume 對應 `backend-db-data`。

更多部署與容器化細節請見根目錄 `README.md` 與 `docs/docker.md`。
