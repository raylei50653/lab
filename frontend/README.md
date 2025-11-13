# Frontend (React + Vite)

本資料夾包含使用 React 19、Vite、Tailwind、React Router 打造的前端。介面提供三個分頁：Health、Data CRUD 與 Camera，分別演示 API ping、一般 REST CRUD 與 MJPEG 串流控制。以下內容面向開發者，協助你快速啟動、調整與部署。

## 系統需求
- Node.js 20+、npm 10+
- 可存取後端 API (`http://localhost:8000` 為預設代理)
- 建議安裝現代瀏覽器 (Chrome / Edge / Firefox) 以支援 React 19 dev tools

## 安裝與開發啟動
```bash
cd frontend
npm install
npm run dev          # http://localhost:5173
```
Vite 會將 `/api/*` 代理到 `http://localhost:8000`（在 `vite.config.js` 中設定），因此後端需於 8000 port 執行 `python manage.py runserver`。

## 可用 npm 指令
| 指令 | 說明 |
|------|------|
| `npm run dev` | 啟動 Vite 開發伺服器 (含 HMR) |
| `npm run build` | 產出 `dist/`，供 nginx 或 docker 使用 |
| `npm run preview` | 以本機靜態伺服器驗證建置結果 |
| `npm run lint` | ESLint + React Hooks 規則，確保 coding style 一致 |

## 程式結構
```text
src/
├── App.jsx                       # React Router 分頁 (Health / Data / Camera)
├── components/                   # UI 組件 (DataForm, DataTable, HealthCheck, ui/button)
├── hooks/useData.js              # 封裝 CRUD 生命週期 (load, create, update, delete)
├── lib/fetcher.js                # 封裝 fetch + timeout + base URL 邏輯
├── pages/                        # 每個分頁容器組件
├── services/api.js               # 對應後端 REST 端點的薄封裝
└── index.css / App.css           # 全域樣式與佈局
```

### UI / 樣式
- Tailwind (透過 `tailwind.config.js`) + `clsx` / `class-variance-authority` 提供原子化樣式。
- `components/ui/button.tsx` 為共用按鈕樣式，方便擴充 variant。
- 其餘元件使用簡單 inline style，目的在於凸顯功能流程，可依需求換成更完整的設計系統。

### 路由與資料流
- `App.jsx` 建立三個 Route 並顯示簡易分頁導覽。
- `useData` hook 內建 `refresh/create/update/delete` 四個 async 方法，並於 `DataCrud` 中注入至 `DataForm`、`DataTable`。
- Camera 頁面使用多個 `useState` + `useEffect` 控制串流停啟、灰階、寬度與後端證明，亦會呼叫 `/stream/abort/` 釋放舊連線。

## 與後端整合
- `src/lib/fetcher.js` 決定 API Base：
  - `VITE_API_BASE_URL` **有值** → 直接呼叫該 URL (部署時建議設定)。
  - 其餘情況 → 呼叫 `/api`，再由 Vite dev server 代理到 Django。
- 預設逾時 10 秒，逾時會丟出 `Request timeout`，供 UI 顯示錯誤。
- `services/api.js` 只定義 REST path，實際錯誤處理由 `useData` hook 或 Camera 頁面接手。

## 環境變數
建立 `frontend/.env` 或 `.env.local`：
```env
VITE_API_BASE_URL=https://api.example.com    # 留空則轉送到 /api
```
在 docker 建置 (frontend/Dockerfile) 時也會讀取此值，確保靜態檔指向正確 API。

## 建置與部署
```bash
npm run build
```
- 產出的 `dist/` 可交由任一靜態伺服器 (nginx、S3、Vercel) 伺服。
- 若使用 repo 內的 Dockerfile，建置過程會自動執行 `npm run build` 並將檔案複製到 `nginx:alpine`。
- 需要同時部署後端時，建議直接使用根目錄 `docker compose up -d`，詳見 `docs/docker.md`。

## 測試與品質建議
- 目前僅有 ESLint，若要加上整合測試，可考慮引入 Vitest + React Testing Library。
- Camera 頁牽涉串流與計時器，建議在 PR 中至少手動驗證 Pause/Resume/Reload 與 Proof 區塊。

## Troubleshooting
- **Request timeout**：後端未啟動或 `VITE_API_BASE_URL` 指向錯誤；請確認 `python manage.py runserver` 是否運行，或瀏覽器是否能打開 `/api/healthz/`。
- **CORS/CSRF 錯誤**：部署到非 localhost 時，後端需同步設定 `DJANGO_ALLOWED_HOSTS` 與 `DJANGO_CSRF_TRUSTED_ORIGINS`，前端請重新建置以寫入正確 `VITE_API_BASE_URL`。
- **串流畫面黑屏**：確定攝影機來源可被後端讀取，可在瀏覽器以新分頁開啟 `http(s)/rtsp` URL 或直接開 `/api/stream/?client=debug` 測試。
- **Eslint 無法安裝**：若所在環境封鎖 npm registry，可在 `.npmrc` 設定私有鏡像或改由 docker 建置。

更多設計細節與 API 說明請回到根目錄 README 以及 `backend/README.md`。
