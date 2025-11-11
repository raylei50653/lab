# Docker 指南

本指南說明如何以 `docker compose` 建置、啟動與維運 React × Django Camera Demo，並整理常見的錯誤排除步驟。

## 1. 先決條件
- Docker Engine 24+ 與 Compose V2 (`docker compose` 指令)。
- 主機需要保留兩個連接埠：API (`BACKEND_PORT`，預設 8000) 與前端 (`FRONTEND_PORT`，預設 4173)。
- 使用者端需要能夠連線至攝影機來源，且該來源必須能被 backend 容器存取。

## 2. 建置前準備
### 2.1 `.env` 範本
在專案根目錄建立 `.env`，覆寫最常用的設定：

```env
DJANGO_SECRET_KEY=change-me
BACKEND_PORT=8000
FRONTEND_PORT=4173
DJANGO_ALLOWED_HOSTS=localhost,backend
VITE_API_BASE_URL=http://localhost:8000
RUN_MIGRATIONS=true
CAMERA_URL=
```

上述檔案只會被 `docker compose` 讀取，不會自動套用到本機開發環境。

### 2.2 主要環境變數

| 變數 | 範圍 | 說明 | 預設 |
|------|------|------|------|
| `DJANGO_SECRET_KEY` | backend | Django SECRET_KEY，正式環境務必覆寫 | `insecure-dev-secret` |
| `DJANGO_ALLOWED_HOSTS` | backend | 逗號分隔，需包含用戶端實際使用的網域 / IP | `localhost,backend` |
| `DJANGO_DB_PATH` | backend | SQLite 路徑，預設指向 `/app/db/db.sqlite3` | `/app/db/db.sqlite3` |
| `RUN_MIGRATIONS` | backend | 啟動時是否自動執行 `python manage.py migrate --noinput` | `true` |
| `CAMERA_URL`, `CAMERA_*` | backend | 預設攝影機來源與灰階/節流/重試參數 | 程式內建 |
| `BACKEND_PORT`, `FRONTEND_PORT` | compose | 對外映射的連接埠，改成 0.0.0.0:PORT | `8000` / `4173` |
| `VITE_API_BASE_URL` | frontend build | 建置前端時寫入的 API URL；若容器部署在遠端，必須填入完整網址 | `http://localhost:${BACKEND_PORT:-8000}` |
| `PIP_INDEX_URL`, `PIP_EXTRA_INDEX_URL`, `PIP_TRUSTED_HOST` | backend build | 指向內網 PyPI 或自訂套件庫 | `https://pypi.org/simple` |
| `DEBIAN_MIRROR`, `DEBIAN_*` | backend build | 切換 Debian 鏡像 (鏡像站或離線倉庫) | 官方鏡像 |


## 3. 基本操作
### 3.1 建置
```bash
docker compose build --pull
# 或 make docker-build
```
- `--pull` 會確保基底映像檔為最新。
- 需要自訂套件庫或 Debian 鏡像時，可在 `.env` 設定前述 build args。

### 3.2 啟動
```bash
docker compose up -d
# 或 make docker-up
```
- backend 透過 gunicorn 監聽 `0.0.0.0:8000`，並提供 `/healthz/` 給 healthcheck。
- frontend 依賴 backend 的 healthcheck：未通過前不會啟動 nginx。

### 3.3 驗證
```bash
docker compose ps
curl http://localhost:${BACKEND_PORT:-8000}/healthz/
open http://localhost:${FRONTEND_PORT:-4173}  # macOS，可改用瀏覽器
```
- `docker compose ps` 中 backend 需顯示 `healthy`，frontend 才會進入 `running`。
- 若部署在伺服器上，請改用實際網域 / IP 測試。

### 3.4 日誌與維護
```bash
docker compose logs -f backend   # 後端 / migrations 狀態
docker compose logs -f frontend  # nginx / React 靜態站
docker compose exec backend python manage.py migrate
docker compose exec backend python manage.py createsuperuser
```
- 將 `RUN_MIGRATIONS=false` 時，可透過上述 `exec` 指令手動遷移。

### 3.5 停止與清理
```bash
docker compose down              # 停止服務但保留 volume
docker compose down -v           # 停止並刪除 volume (會清空 SQLite)
```

## 4. 更新程式碼或依賴
- 調整 `backend/requirements.txt` 或 `frontend/package*.json` 後，重新建置：`docker compose up -d --build`.
- 如果只變更前端程式碼，可執行 `docker compose build frontend && docker compose up -d frontend`.
- `frontend` 映像檔已包含建置好的 `dist/`，因此部署時無需再跑 `npm install`。

## 5. 資料持久化與遷移
- SQLite 存放於命名 volume `backend-db-data` (`/app/db`)，因此 `docker compose down` 不會刪除資料。
- 若要重新開始，可執行 `docker compose down -v backend-db-data`. **注意：此動作不可逆。**
- 導入既有資料庫時，可將 `db.sqlite3` 複製到 volume (透過 `docker compose run --rm backend sh -c 'cat > /app/db/db.sqlite3' < db.sqlite3`)，再啟動服務。

## 6. 建置代理與內網需求
- 封閉網路可透過 `.env` 設定 `PIP_INDEX_URL` / `DEBIAN_MIRROR` 指向內網鏡像。
- 若需信任自簽名 HTTPS，請設定 `PIP_TRUSTED_HOST=<host>`，或在自訂基底映像檔中安裝 CA。
- `frontend` 建置過程不需要外部網路（依賴 npm registry），若環境無法直接連線，建議預先準備離線 npm cache 或改用私有 registry。

## 7. Troubleshooting
### 7.1 backend `starting` / `unhealthy`
1. `docker compose logs backend` 了解錯誤訊息。
2. 常見原因：
   - migrations 失敗：設 `RUN_MIGRATIONS=false`，進入容器手動執行 `python manage.py migrate` 以取得更完整堆疊。
   - SQLite volume 權限：刪除 `backend-db-data` 後重新啟動，或確認主機磁碟不為唯讀。
   - `DJANGO_ALLOWED_HOSTS` 缺少當前網域，導致 Django 拒絕請求；請加入實際網域或 IP。

### 7.2 前端無法打 API / 看到 `Request timeout`
- 若容器跑在遠端，**不要**保留 `VITE_API_BASE_URL=http://localhost:8000`，應填寫實際外部網址，例如 `https://demo.example.com`.
- 更新 `VITE_API_BASE_URL` 後需要重新建置 frontend：`docker compose up -d --build frontend`.
- 也別忘了在 `.env` 更新 `DJANGO_ALLOWED_HOSTS`，並確保反向代理或防火牆允許這些來源。

### 7.3 `Cannot open camera URL`
- 從 backend 容器測試來源：`docker compose exec backend curl -I http://camera.mjpeg/stream` 或使用 `ffprobe` / `opencv-python`。
- 如果攝影機只允許內網，請確認 Docker 主機可以直接連線，必要時設定 VPN 或在 `.env` 提供固定的 `CAMERA_URL`。
- `width` / `gray` 僅在成功取得原始串流後才會生效。

### 7.4 連接埠衝突
- 執行 `docker compose up` 時若出現 `port is already allocated`，請在 `.env` 調整 `BACKEND_PORT` / `FRONTEND_PORT`。
- 防火牆需允許新埠號對外開放；若由反向代理轉發，可設定 `BACKEND_PORT=127.0.0.1:8000` 等綁定僅限本機。

### 7.5 重置 SQLite 或清除測試資料
- `docker compose down -v backend-db-data` 可移除 volume 並重新建立乾淨的資料庫。
- 僅想清空資料可 `docker compose exec backend python manage.py flush`.

### 7.6 建置過程連不上 PyPI / Debian
- 設定 `.env` 中的 `PIP_INDEX_URL`, `PIP_TRUSTED_HOST`, `DEBIAN_MIRROR`，再重新 `docker compose build`.
- 若使用私有證書，請在自訂基底映像檔中安裝 CA 或將證書掛載到 `/usr/local/share/ca-certificates`.

### 7.7 重新部署後仍看到舊版
- 確認 `docker compose ps` 是否載入最新映像檔，必要時 `docker compose up -d --force-recreate`.
- 前端是靜態檔，若瀏覽器有快取，請按下 `Cmd+Shift+R` / `Ctrl+Shift+R` 強制重新整理。

如仍無法解決，請附上 `docker compose ps`, `docker compose logs backend` 以及 `.env` (遮蔽敏感值) 以便進一步排查。
