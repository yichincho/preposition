# PhraseMap AI｜17 個小詞認知學習 APP

> 狀態：需求規格與開發準備階段（尚未完成 APP）。
>
> 完整規格：[docs/PRODUCT_REQUIREMENTS.md](docs/PRODUCT_REQUIREMENTS.md)

## 產品目標
以 Brygida Rudzka-Ostyn《Word Power》為研究參考，建立「核心小詞 → 空間／時間／抽象語意 → 片語 → 記憶圖 → 閱讀文章 → 複習」的個人知識庫。

- 17 個原書教學分類先核對後建置（不把比較章誤認成獨立詞）。
- 預載經確認的高頻片語、支援自行新增／匯入／編輯；首版目標 300 筆，擴充目標 800–900 筆。70–80% 頻率覆蓋率需有語料庫分母與測量方法，不能直接宣稱。
- 學習卡、隨機四選一、答錯再練習、間隔複習（可匯出 Anki 相容格式，並非聲稱已安裝 Anki）。
- AI 認知圖提示詞產生、圖片自行匯入、同一意義多張圖、個人資料備份。
- 使用 yichincho/ai-models 模型清單及 Gemini / NVIDIA / DeepSeek 呼叫規範；不在前端或 Git 倉庫洩漏 API Key。
- 英文閱讀：**片語中的動詞紅色，介系詞／小詞加底線**，含動詞變化式和可分離片語。
- 視覺：editorial-infographic-tw 的繁體中文編輯式資訊圖，延伸為米白紙張＋墨綠＋竹葉留白／水墨線條的「中國竹風」，保持易讀、避免濫用裝飾。

## 首次安裝與更新（不可破壞個人資料）
程式、預載片語資料、使用者資料及圖片應分開儲存。初次啟動建立資料目錄與 Schema；後續以**增量更新／資料庫遷移**升級，不刪除舊資料，也不要求解除安裝再安裝。

- 開發時可用 Docker Compose named volumes 或獨立 persistent data directory；更新僅替換程式容器／靜態檔，**禁止**使用 `docker compose down -v`。
- 發布前自動備份資料庫與圖片清單、跑可回復 migrations、驗證圖片仍可讀；用 stable ID / user-owned 欄位，預載資料 upsert 不覆蓋使用者筆記。
- 實際安裝／更新工具須待平台方案確定後實作與驗收。

## AI 金鑰
ai-models 的 GitHub Actions 探測需在該專案 Settings → Secrets and variables → Actions 設定 `GEMINI_API_KEY`、`NVIDIA_API_KEY`、`DEEPSEEK_API_KEY`。
本 APP 執行時的金鑰要放在**部署伺服器環境變數／秘密管理服務**，不是只設 GitHub Actions secret 就能供 App 執行。切勿放進前端 bundle、Git commits、公開設定檔。

## 本次交付
此儲存庫先建立可供 Codex / Claude Code 實作的需求規格，尚未完成應用程式、部署、圖片產生或 API 真實測試。
## 已提交的第一版 MVP（2026-11-14）

- [開啟網頁原始檔](index.html)：17 個小詞入口、示範片語、中文四選一、翻卡、個人片語新增、圖片匯入、筆記、完整 JSON 備份與匯入。
- 使用瀏覽器 IndexedDB 儲存使用者資料；部署更新只替換網頁程式，不會主動清空 IndexedDB。**清除網站資料、改用其他瀏覽器、或更換網址來源仍可能使資料無法讀取；請定期下載備份。**
- 靜態部署 workflow：[.github/workflows/pages.yml](.github/workflows/pages.yml)。首次使用請在 repo Settings → Pages → Build and deployment 設為 GitHub Actions；部署狀態需自行查看 Actions。預期網址為 https://yichincho.github.io/preposition/ ，**未驗證公開網址已可開啟**。
- 目前為原創少量示範片語；**不是** 300 或 800 筆已驗證資料庫。NVIDIA / Gemini / DeepSeek 自動文章生成與 API runtime 尚未實作。
- 目前無法在此環境完成實際瀏覽器端到端測試，建議先測試備份／匯入與更新後圖片保留，再作正式使用。

