# Personal Decision Operating System (PDOS)

一個可直接在瀏覽器開啟的 PDOS v1 MVP。它將個人目標、事件記憶與決策分析放在同一個私有儀表板，所有資料預設只存在此瀏覽器的 `localStorage`。

## 使用方式

直接以瀏覽器開啟 `index.html` 即可。若要使用本機伺服器，可在本資料夾執行：

```powershell
python -m http.server 8080
```

然後開啟 `http://localhost:8080`。

## 功能

- 個人決策設定檔：人生價值與決策權重
- 目標管理：六大生活面向、優先度、期限與進度
- 事件記憶：記錄事件、影響程度與未來相關性，並自動計算重要性
- 決策工作台：比較「維持現況／準備後行動／立即行動」，依個人權重排序
- 90 天行動計畫：從建議決策自動建立高槓桿任務
- 反思機制：列出假設、風險與下一步驗證方式
- 匯出／匯入：以 JSON 備份與還原資料

## 隱私與限制

這是本機優先的 MVP，沒有後端、雲端同步或 AI API 呼叫。決策分數是透明的啟發式模型，目的是協助梳理思路，並非醫療、法律或投資指令。

## 下一階段

若要依系統規格擴展至生產版，可將 `app.js` 的資料服務換為 Fastify + PostgreSQL/pgvector，並為 Career、Finance、Health、Research 與 Reflection agent 加入 LLM gateway 與工作流程編排。

## 開發文件

- [`AGENTS.md`](./AGENTS.md)：開發規範（架構限制、驗證清單、commit/PR 流程）
- [`SPEC.md`](./SPEC.md)：功能規格與路線圖
- [`AI_PROJECT_SOP.md`](./AI_PROJECT_SOP.md)：AI 協作開發 SOP（通用範本）
