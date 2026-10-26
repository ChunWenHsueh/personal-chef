# AI 私人廚師前端

前端提供對話列表、切換歷史、新對話、串流回覆、清空目前對話，以及選取圖片後自動上傳。

| 方法 | 路徑 | 用途 |
| --- | --- | --- |
| GET | `/api/v1/chat/threads` | 讀取對話列表，最近更新的排在前面 |
| GET | `/api/v1/chat/messages?thread_id=...` | 讀取指定對話的訊息 |
| POST | `/api/v1/chat/stream` | 串流 LLM 文字回覆 |
| DELETE | `/api/v1/chat/messages?thread_id=...` | 清空指定對話 |
| GET | `/api/v1/oss/presign?filename=...` | 取得 S3 上傳與讀取簽名網址 |

對話列表來自後端 SQLite checkpoints，標題取自第一則使用者訊息。選擇左側對話會載入其歷史，後續訊息沿用同一個 `thread_id`。瀏覽器會記住目前選取的對話。

按「新對話」只顯示空白草稿，第一次發送時才建立對話 ID。清空成功後只移除目前對話，其他對話會保留。

## 圖片流程

1. 按圖片按鈕選擇本機 JPG、PNG、GIF 或 WebP 圖片，單張上限 10 MB。
2. 前端顯示預覽；選取時不會上傳或建立對話。
3. 按發送後，取得上傳簽名網址，使用 PUT 上傳原始檔案，Content-Type 使用後端回傳值。
4. 上傳成功後，將讀取簽名網址放進聊天請求的 `image_url`，交給 LLM。

上傳失敗會保留圖片和輸入，且不送出聊天請求。重試同一張已選取的圖片會沿用同一個 S3 物件名稱，避免網路狀態不明時建立不同檔名的副本。重新選擇檔案則視為新的上傳。發送中會阻止重複提交。

上傳中或生成中可以按停止按鈕取消瀏覽器請求。後端是否同時停止模型生成，取決於後端的取消處理。

S3 bucket 可保持私有。其 CORS 需允許前端來源、PUT 方法及 Content-Type 標頭。簽名網址目前效期為一小時；持久化的舊圖片網址到期後需要重新簽名。

`localhost` 與 `127.0.0.1` 是不同的瀏覽器來源，連接埠也必須一致。開發時若同時使用兩者，S3 的 AllowedOrigins 需分別包含 `http://localhost:3000`、`http://127.0.0.1:3000`，以及使用後端靜態網頁時的 `http://localhost:8001`、`http://127.0.0.1:8001`。後端產生簽名回傳 200，只表示網址已產生；實際 PUT 由瀏覽器直接送往 S3，成功與否需看瀏覽器的 Network 紀錄。

## 本機開發

在這個目錄執行：

```bash
npm ci
npm run dev
```

瀏覽 `http://localhost:3000`。後端預設位於 `http://localhost:8001`。若需變更，在 `.env.local` 設定 `NEXT_PUBLIC_API_BASE_URL`，再重新啟動開發伺服器。後端 CORS 需允許前端來源。

## API 格式

對話列表回傳 `{ "threads": [...] }`。每個項目包含 `thread_id`、`title`、`last_message`、`created_at`、`updated_at`。

訊息歷史回傳 `{ "messages": [{ "role": "user", "content": "我有雞蛋" }, { "role": "assistant", "content": "可以做蒸蛋。" }] }`。圖片訊息的 `content` 可以是文字與圖片區塊陣列。

聊天請求包含 `message`、`thread_id`、`image_url`。沒有圖片時 `image_url` 是 `null`。前端依目前後端行為讀取原始 UTF-8 文字串流，不解析 SSE 或 JSON 事件。

清空成功時，後端回傳 `{ "success": true }`，前端才會移除對話。

## 靜態建置

從這個目錄執行：

```bash
NEXT_PUBLIC_API_BASE_URL= npm run build
mkdir -p ../app/static
cp -R out/. ../app/static/
```

產物位於 `out/`，需同步完整內容到 `app/static/`，由 FastAPI 提供。

## 檢查

```bash
npm run lint
npx tsc --noEmit
npm run test:upload
```

在專案根目錄可執行後端歷史與 API 檢查：

```bash
uv run python -m unittest discover -s tests -v
```
