# PhraseMap AI — 開發代理指引

請先讀 `docs/PRODUCT_REQUIREMENTS.md`，以其 P0／驗收條件優先；本 repo 目前是規劃階段，不可自稱已有可運作 APP。

## 不可違反
1. 不刪除／重建使用者資料：資料庫、圖片、牌卡、個人片語、筆記、文章、複習紀錄、API 設定都必須獨立於可替換的程式碼；升級要備份 + migration + 回歸測試；禁止 `docker compose down -v`。
2. 17 是「教學入口」，須核對原書目錄；ABOUT/(A)ROUND 比較課不應被當作全新介系詞。
3. `phrase_sense` 是學習與卡片的最小意義單位；多義動詞、空間／時間／抽象分支都需要獨立關聯。
4. 同時支援預載高頻片語與使用者自行建立的牌卡；系統 seed 更新不可覆寫 user data。
5. 英文片語標示：**動詞紅色；小詞／介系詞底線**，含變化形與分離片語；請用 token annotations 而非 regex 全文替換。
6. 每次圖片生成可產 Prompt，外部生成的圖片可上傳並綁定片語 sense；圖片更新後不消失。
7. 視覺參考已安裝 `editorial-infographic-tw`：米白、墨綠、灰綠、雜誌式排版，延伸為低調中國竹風；不複製特定方格模板。
8. AI 型號清單與呼叫方式：見 `yichincho/ai-models`（skill: `ai-model-check`），支援 Gemini / NVIDIA / DeepSeek。模型清單要有快取與 bundled fallback。執行時 API Key 由後端秘密管理，不能寫入 Git／前端。
9. 任何高頻率 70–80% 宣稱需有語料分母與測量，未驗證前寫「目標」。
10. 程式、文件、測驗及使用者介面以台灣繁體中文為主。開發後需跑測試，未測試項目明確標示。

## 建議起始任務
先建立資料持久化、migration、備份還原及 20 筆小詞語意資料的垂直切片；再做 Anki 風格練習 UI；再擴充完整高頻資料與 AI 功能。
