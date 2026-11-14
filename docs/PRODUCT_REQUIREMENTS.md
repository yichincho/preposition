# PhraseMap AI — 產品需求與實作規格（PRD v0.1）

日期：2026-11-14 ｜目的：Codex / Claude Code 實作依據 ｜狀態：規劃，非已完成功能

## 0. 專案與既有來源

- 目標 repo：https://github.com/yichincho/preposition
- 共用 AI repo：https://github.com/yichincho/ai-models
- 知識參考：Brygida Rudzka-Ostyn, *Word Power: Phrasal Verbs and Compounds: A Cognitive Approach*。此書是分類與理論參考，**不可直接大批複製原書文字或圖片**。
- 已讀取實際安裝的 `editorial-infographic-tw` skill：米白紙張 `#F4F1E9`、深森林綠 `#274735`、鼠尾草綠 `#7A9276`、暖炭黑 `#2F302A`、灰綠 `#DDE2D8`；繁體中文雜誌式編排、節制真實攝影／向量圖、清晰層級、足夠留白、不要複製固定方格、避免 AI 霓虹／玻璃感。竹風為本產品的額外風格延伸，不是 skill 原文要求。

## 1. 優先級與驗收

P0（第一版必須）：資料持久化與安全更新；17 個學習入口；片語多語意管理；預載高頻片語（MVP 300 筆需校對）；牌卡學習及四選一測驗；手動新增、匯入；圖像 Prompt 與圖片上傳；搜尋與備份；AI API provider adapter；文章動詞紅字／小詞底線。
P1：FSRS 或同類間隔重複；圖像與語意關聯；系列文章生成／驗證；Anki 可匯入 CSV 與 APKG（若實作依賴可接受）；學習分析。
P2：雲端多裝置同步、語音與離線 PWA 完整支援、知識圖譜進階探索。
各功能未經測試前不得標為已完成。

## 2. 首次安裝、Secrets 與無損更新（最高優先）

### 2.1 第一次安裝設定
- 首次啟動精靈：選擇資料儲存路徑／容量、初始化資料庫、選擇 AI provider、測試連線、設定備份目標。
- 初次只初始化一次；重開機、APP 更新、資料預載更新均不得重新初始化或覆寫個人資料。
- 資料存放於應用程式程式碼目錄之外。建議開發版 `./data` 以 gitignore 排除，正式版用獨立 user data dir 或 Docker named volume。
- 所有使用者圖片、筆記、個人牌卡、文章、複習時間表、設定存於持久層；資料庫存媒體路徑／雜湊值而非僅記臨時 URL。

### 2.2 更新流程
- 更新**替換程式、不刪資料**；預載資料用版本化 migration 和 idempotent upsert，user-owned 欄位不覆寫。
- 版本提升流程：偵測舊版 → 備份 DB + 影像清單（驗證校驗碼）→ 交易式 Schema migration → 新版啟動 → 完整性檢查 → 異常中止且提供還原。
- 禁止自動刪除 data 目錄、`docker compose down -v`、刪除 volume、DROP TABLE 全表重建或未經確認的破壞性 migration。
- 使用 SQLite 時啟用 WAL 與適當備份 API；使用 PostgreSQL 時持久 volume，提供一致性資料庫備份；圖片也需同步備份。
- 驗收：v1 上傳 20 張圖＋寫 10 筆筆記＋複習 30 題 → 升級 v2 → 全數留存且能開啟；版本退回需有可操作的備份還原路徑。
- 每次更新提供資料變更摘要，使用者可自行匯出完整備份 ZIP（含資料庫匯出 JSON／SQLite、圖片、manifest）。

### 2.3 API Key 與 Secrets
- `ai-models` repo 的 GitHub Actions probe 使用 `GEMINI_API_KEY`, `NVIDIA_API_KEY`, `DEEPSEEK_API_KEY`，設定於該 repo `Settings > Secrets and variables > Actions`。
- `preposition` 的**執行環境**另需安全設定：部署伺服器環境變數／秘密管理器；GitHub Actions Secret 僅供 CI job，**不能自動成為瀏覽器 App 執行時金鑰**。
- 前端不能直接嵌入 API Keys。由後端代理受保護的 AI 呼叫，實作 access control / rate limiting / timeout。
- 首次登入可測試模型連線，但 UI 僅顯示通過／失敗與安全錯誤訊息，不顯示金鑰。

## 3. 17 個教學入口與認知語意

預計入口：OUT, IN, INTO, UP, DOWN, OFF, AWAY, ON, OVER, BACK, ABOUT, (A)ROUND, ABOUT/(A)ROUND comparison, ACROSS, THROUGH, BY, ALONG。
**注意：此為教學入口初稿；ABOUT/(A)ROUND comparison 是比較主題，不是第 17 個完全不同的小詞。** 在發布前需核對原書目錄，並在資料模型中分離 `particle` 和 `lesson`。

### 3.1 認知設計：分層而非一詞一義
建立四層：小詞 `particle` → 意象圖式 `image_schema`（容器、路徑、接觸、分離、上下、界線）→ 意義面向 `semantic_sense`（空間、時間、狀態、程度、完成、情緒、慣用）→ 片語意義 `phrase_sense`。
- 分支擁有自己的解說、典型場景、關聯線索、反例、英文句、圖像及來源。
- 同一片語可連接多個 senses；每張複習卡引用 **phrase_sense_id**，避免多義混淆。
- 用標籤區分 `evidence_level`: 「辭典已驗證」「語料已驗證」「教學類比」「AI 未核對」；**不要把記憶用類比宣稱為語源證明**。
- UI：首頁小詞卡 → 空間意象 → 空間／時間／抽象 tab → 語意分支 → 片語 → 句子／圖像／牌卡；提供跨小詞比較（如 `use up` vs `run out of`）。

### 3.2 ON 分支例
- 空間：`put on a jacket` 接觸／覆蓋
- 持續：`carry on` 活動繼續
- 啟動：`turn on` 進入運作狀態
- 時間相關片語與一般介系詞用法，須區分語法類型，不能把所有 `on Monday` 都誤視為片語動詞。
每個分支提供 3–5 個具體例子、常見錯誤及使用場景。不要用一個解釋硬套所有 ON。

## 4. 預載片語 + 自建內容（兩者都要）

- 系統預載「經人工校對」高頻詞條：MVP 300，擴充 800–900（數量是產品目標，尚非已建置）。各語意需有例句、中文釋義、搭配、可分離性、使用頻率來源。
- 「70–80% 常用覆蓋」需先指定使用語料（例如口語、學術、學測閱讀）及分母，依 token frequency / type coverage 報表衡量；不得以 800/1100=73% 直接推論實際使用覆蓋率。
- 系統內容與使用者內容分層，user-created 不會被更新覆蓋。允許自建片語／例句／語意／圖像／牌卡；可從內建片語一鍵「製作我的牌卡」。
- 匯入：CSV／JSON、去重預覽、錯誤行檢查、合併策略與還原。匯出：CSV／JSON，Anki 通用 CSV 欄位：Front, Back, Tags, Example, SenseId, ImageRef；APKG 為可選 P1。Anki 匯入格式兼容不是與 Anki 同步。
- 自建資料既可以補充尚未收錄片語，也可覆蓋*個人顯示偏好*，不得修改原始系統資料作為唯一副本。

## 5. Anki 風格複習與隨機四選一

### 5.1 遊戲流程
1. 選核心小詞如 ON，選範圍（全部／已學習／錯題／待複習）與題數 10/20/不限。
2. 題庫以 phrase_sense 為單位，避免同一英文不同義沒有上下文。
3. 正面先顯示英文片語，若有歧義加英文例句／情境提示；先不顯示中文答案。
4. 隨機排列四個**合理且不重複**的中文選項；錯誤選項同詞類／相近難度，避免過度明顯。
5. 選完即回饋正誤、中文、認知拆解及記憶圖，按「下一題」；顯示進度及本回合正確率。
6. 支援「翻卡自評」模式：正面英文，翻面中文＋記憶圖，按 忘記／困難／良好／容易；此模式才更接近 Anki 的自評卡片。
7. 同一回合可選擇不重複抽題，錯題在回合結束後重練；後續使用 FSRS 等間隔排程。亂數有固定 session seed 便於重現測試。

### 5.2 最低驗收
- ON 組 40 個不同 sense 中抽 20 題不重複；每題一個正解且選項沒有同義歧義。
- 多義片語不會因中文選項相近而造成雙重正解。
- 關閉瀏覽器後複習紀錄保留，升級後學習排程不重置。
- 機制保證「首次英文 → 點選中文 → 回饋 → 下一題」，支援手機點擊與鍵盤作答。

## 6. AI 圖像設計與中國竹風

採用已讀取的 `editorial-infographic-tw` skill 的實際規範：
- 紙張米白 `#F4F1E9`、墨綠 `#274735`、鼠尾草綠 `#7A9276`、暖炭黑 `#2F302A`、淡灰綠 `#DDE2D8`。
- 編輯式清楚標題、適當不對稱版面、充裕留白、示意箭頭／線圖配合真實場景，不採用華麗霓虹與重複方塊模板。
- **產品新增中國竹風**：竹葉與竹節作少量邊框／頁角點綴、極淡水墨紙紋、山水留白；文字仍以易讀台灣繁體中文字體呈現。竹紋不能干擾英文片語及測驗選項對比。
- 產圖目的是幫助理解空間意象，圖像依「起點→變化→結果」或對照組構圖，不把複雜理論硬壓成單張圖。
- Prompt 模板產生器：輸入粒子、phrase_sense、space/time/abstract 分支、核心場景、風格、尺寸、負面限制；先複製到 ChatGPT／其他繪圖工具產圖，使用者再匯入。
- 每個 phrase sense 可多張圖、指定主圖、儲存原 prompt / 來源 / 建立日期 / hash / alt 文字；單張圖上傳上限、類型檢查、EXIF 隱私移除、備份／還原。
- 若將來做自動生成 API：先確認模型實際支援 image generation，**不能把 chat-completions 當作一定會產圖片**。
- Skill 是產圖與視覺規範來源，APP 自身需實作為設計 token／prompt，不代表安裝到 ChatGPT 的 skill 會自動在使用者裝置執行。

## 7. AI 文章生成與視覺標示

- 選小詞與 5–12 個目標片語 → 文章主題、難度、篇數、字數 → AI 先分配故事大綱、再逐篇生成 → 驗證語法／目標片語用法／sense → 存入閱讀庫。
- **片語中的動詞紅色，後接的小詞或介系詞加底線**，例如 `gave up`：gave 紅字、up 底線；`cheer her up`：cheer 紅字、up 底線，her 正常；`ran out of`：ran 紅字、out of 底線。
- 標示以 token offsets + grammar annotation 決定，**不要做全文章簡單字串替換**。支援時態、被動、可分離片語、多小詞、片語歧義；可以切換顯示／隱藏標記。
- AI 輸出需結構化並二次驗證，錯誤用法標示待審核；使用者可修改與再生。文章/圖片/片語雙向連結。

## 8. ai-models API 整合（依 repo 現有實作）

- 讀取 `https://raw.githubusercontent.com/yichincho/ai-models/main/models.json`；維持 `schemaVersion: 1`；遠端更新 → 本機快取 → bundled fallback，不因網路異常崩潰。
- providers：`GEMINI`（Gemini 原生格式）、`NVIDIA` 與 `DEEPSEEK`（OpenAI-compatible）。不要硬編目前模型 ID；依清單 recommended + status 選擇，服務故障允許手動切換。
- 參考 `ai-models/.claude/skills/ai-model-check/SKILL.md` 的錯誤處理：對 429/500/502/503 限次重試、每次呼叫 timeout、友善 401/403/404/410/429 錯誤、必要時處理 think block 與 JSON 清理。
- 片語 AI 解說、系列文章、例句修正各設 prompt template + schema validator；記錄 provider/model/cost（若可得）與請求狀態。
- `models.json` 裡的 `status: unknown` **不是通過實測**；第一次使用必須測試連線，絕不能假定推薦型號一定可用。
- 本應用若是 PWA／Web，需在後端代理請求並做基本用量控制；不要在瀏覽器中暴露 NVIDIA / Gemini / DeepSeek Key。

## 9. 建議技術與資料模型

- 建議 Web PWA：Next.js + TypeScript，FastAPI（Python）後端；個人初版可用 SQLite（可升級 PostgreSQL），圖片用持久目錄／物件儲存。部署方式未定前勿宣稱完成。
- tables：`particles`, `lessons`, `image_schemas`, `semantic_senses`, `phrases`, `phrase_senses`, `examples`, `grammar_rules`, `flashcards`, `quiz_sessions`, `review_logs`, `phrase_images`, `user_phrases`, `user_notes`, `articles`, `article_phrase_links`, `model_configs`, `schema_migrations`, `backup_manifests`。
- 類型：`SemanticSense.dimension` = `spatial|temporal|degree|state|emotion|completion|idiomatic`，每個 sense 有自己的 `explanation_zh_tw`、`image_prompt`、`verified_status`、`source`。
- 分開 system_seed data 與 user data；全部 record 有 stable ID、created_at、updated_at，user 紀錄不可被 seed import 刪除。

## 10. 開發任務與交付驗收

1. 建立 repo scaffold / Docker Compose / .env.example / README / CI，並先做無損更新與備份整合測試。
2. 建立資料庫 migration、17 教學入口與核心語意關係、可人工審校的 300 筆 seed（先測試 20 筆樣本）。
3. 建立學習地圖、片語細節、搜尋、個人牌卡 CRUD、CSV 匯入匯出。
4. 建立英文→中文四選一、翻面自評、回合記錄、錯題複習。
5. 加入中國竹風樣式 token、圖片 Prompt 產生器、圖片上傳管理與回復驗證。
6. 加入 ai-models catalog / backend adapters / 文章生成／語法標註／例句驗證。
7. 真實部署、連線測試、PWA 手機介面、資安與升級回歸測試；全部完成後才發布「可用版」。

**必要 E2E 情境**：首次安裝→個人新增片語→上傳多張圖→做 20 題並保存紀錄→生成文章→替換程式版本→再次登入，所有內容與關聯完整無損；備份 ZIP 可還原到乾淨安裝。

## 11. 不應誤解的範圍

- 本文件是規格，不是程式已完成。
- 多選題的「Anki 風格」不等於原生 Anki，原生 Anki 是翻卡＋自評＋間隔重複；此專案兩種模式都支持。
- 正確片語解釋不應全部靠 AI 任意推導；記憶類比與詞典已驗證意思分開標註。
- 17 章 ≠ 17 個互不重複的介系詞；亦有 particle 與一般介系詞用法之別。
