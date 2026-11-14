# PhraseMap AI｜17 個小詞認知學習 APP

> 狀態：網頁版＋Android App（v0.2.0）。300 筆預載片語意義為 AI 輔助整理，**尚待人工校對**；AI 功能僅在 Android App。
>
> 完整規格：[docs/PRODUCT_REQUIREMENTS.md](docs/PRODUCT_REQUIREMENTS.md)

## 怎麼使用
- **網頁版**：https://yichincho.github.io/preposition/ （需先在 Settings → Pages 把 Source 設為 GitHub Actions）。不含 AI 功能。
- **Android App**：到 [Releases → android-latest](https://github.com/yichincho/preposition/releases/tag/android-latest) 下載 `PhraseMap.apk` 安裝，在「AI 設定」輸入 Gemini／NVIDIA／DeepSeek 金鑰即可使用 AI 解說與系列文章。
- **更新 App**：直接安裝新版 APK 覆蓋即可，資料保留；**不要先解除安裝**（解除安裝會清除 App 內所有資料）。所有版本使用同一把簽章金鑰（`android/phrasemap-update.keystore`），因此可以覆蓋安裝。

## 功能
- 17 個小詞：IN、INTO、OUT、OUT OF、UP、DOWN、ON、OFF、OVER、AWAY、BACK、ABOUT、(A)ROUND、ACROSS、THROUGH、BY、ALONG。ABOUT／(A)ROUND 比較課放在這兩個小詞頁面中說明，不另佔入口。第 17 個小詞 OUT OF 由使用者指定；17 入口是否與《Word Power》原書目錄完全一致，**尚待核對**。
- 300 筆 `phrase_sense`（同一片語不同意思各自成卡），含中文、認知聯想、例句、語意分支（空間／時間／狀態／程度／完成／情緒／慣用）、可分離性。資料來源：`data/phrases.json`；改完執行 `python3 scripts/build_data.py` 產生 `data/phrases.js`。**ID 一旦產生不可更改。**
- 牌卡：四選一、翻卡自評、Leitner 間隔（1／2／4／8／16／32 天）、答錯本回合再練、到期卡片／最近答錯範圍。
- 例句與文章標示：動詞（含變化形）紅色、小詞底線；以 token 位置標註（`js/core.js`），支援可分離片語，不跨句。
- 個人片語、筆記、圖片（多張）、圖像 Prompt（米白／墨綠／竹風）。
- 備份／匯入：JSON（含圖片、文章、複習紀錄、設定，**不含金鑰**），合併匯入；可匯入舊版備份並自動轉換 ID。

### AI（僅 Android App）
- 模型清單：讀取 `yichincho/ai-models` 的 `models.json` → 本機快取（24 小時）→ 內建備援 `data/models.js`。`status: unknown` 代表尚未實測，請先按「測試連線」。
- 金鑰：原生對話框輸入，以 Android Keystore AES-GCM 加密存在手機；網頁程式只能問「有沒有金鑰」，無法讀取。AI 請求由原生程式送出，主機固定為各服務商官方網址（`AiEndpoints.java`）。
- AI 解說：空間畫面、延伸說明、3 個例句、用法提醒，可加入筆記。
- 系列文章：選 5–12 個片語、主題、難度、篇數、字數 → AI 先排大綱再逐篇寫 → 程式標註並檢查每個目標片語是否出現，沒出現的標成「待審核」；可編輯、重新標註、單篇重新生成、切換標示。
- 429／5xx 自動重試 2 次；401／403／404／410／429 顯示中文說明。

## 測試
- `node --test tests/core.test.js`：300 筆資料、17 小詞、ID、舊 ID 對應、每句標註、間隔演算法、JSON 清理、模型清單格式（CI 會跑）。
- `java AiEndpointsTest`：AI 端點白名單（CI 會跑）。
- `node tests/e2e.js`：本機 Playwright 端到端（網頁版、舊資料遷移、備份還原、模擬 Android 橋接的 AI 設定／解說／文章）。可設 `V1_HTML=舊版index.html` 測遷移。
- **未實測**：真實 Gemini／NVIDIA／DeepSeek 連線（此開發環境無金鑰）、實機 Android 安裝與覆蓋更新、公開網址。

## 資料保護
- 網頁：IndexedDB（瀏覽器）；App：WebView IndexedDB（固定來源 `https://appassets.androidplatform.net`），App 更新不清除。
- 啟動時請求持久化儲存；舊版 `seed-<序號>` ID 的筆記／圖片／紀錄自動遷移。
- 清除網站／App 資料、解除安裝、換裝置仍會遺失，請定期備份。

## AI 金鑰（開發者）
ai-models 的 GitHub Actions 探測需在該 repo 設定 `GEMINI_API_KEY`、`NVIDIA_API_KEY`、`DEEPSEEK_API_KEY`。本 App 的金鑰由使用者在手機上輸入，切勿放進前端、Git 或公開設定檔。
