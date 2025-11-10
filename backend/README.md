## Backend API

Base URL: `http://localhost:8000/`

### 健康檢查
- `GET /healthz/`
- 回傳 `{"ok": true}`，可用於部署後監控。

### 資料 CRUD (`data` app)

| Method & Path        | 說明 | 請求範例 | 回應範例 |
|---------------------|------|-----------|-----------|
| `GET /data/`        | 取得所有資料 | – | `200 OK`<br>`[{"id":1,"content":{"foo":"bar"}}]` |
| `POST /data/`       | 新增資料 | `{"content": {...}}` | `201 Created`<br>`{"id":2,"content":{...}}` |
| `GET /data/<id>/`   | 查詢單筆 | – | `200 OK`<br>`{"id":1,"content":{...}}` |
| `PUT /data/<id>/`   | 覆寫單筆 | `{"content": {...}}` | `200 OK` |
| `PATCH /data/<id>/` | 局部更新 | `{"content": {...}}` | `200 OK` |
| `DELETE /data/<id>/`| 刪除單筆 | – | `204 No Content` |

說明：
- `content` 欄位會原樣存進 `Data.content` (JSONField)。
- 若 body 不是合法 JSON 或缺少 `content`，回傳 `400`.
- 未找到資料回傳 `404`.

### 攝影機串流 (`camera` app)

- `GET /stream/` 以 `multipart/x-mixed-replace` 方式持續回傳 JPEG 幀，可直接嵌入 `<img src="/stream/">`.
- 參數：
  - `url`: 直接指定攝影機來源 (`http://...` MJPEG、`rtsp://...`)；若未設定會使用環境變數 `CAMERA_URL`.
  - `gray`: 設為 `1/true` 會先轉成灰階。
  - `width`: 指定輸出寬度 (px)，高度會等比例縮放。
- 失敗時回傳 `400` (缺少來源) 或 `503` (無法連線來源)。

### 常用環境變數

| 變數 | 用途 | 預設 |
|------|------|------|
| `CAMERA_URL` | 攝影機串流預設來源 | – |
| `CAM_OPEN_RETRY` | 連線失敗時的重試秒數 | `2` |
| `CAM_FRAME_INTERVAL` | 每幀間隔秒數，>0 可節流 | `0` |
