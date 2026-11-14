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