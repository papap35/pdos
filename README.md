# Personal Decision Operating System (PDOS)

一個可直接在瀏覽器開啟的 PDOS v1 MVP。它將個人目標、事件記憶與決策分析放在同一個私有儀表板，所有資料預設只存在此瀏覽器的 `localStorage`。

## 使用方式

直接以瀏覽器開啟 `index.html` 即可。若要使用本機伺服器，可在本資料夾執行：

```powershell
python -m http.server 8080
```

然後開啟 `http://localhost:8080`。

網站本身（`index.html`/`app.js`/`styles.css`/`lib/`）沒有 build step，直接就是
最終產物；`package.json` 只用來裝開發期的測試／lint 工具，不影響網站怎麼載入。

## 開發（測試／Lint）

```bash
npm install
npm test   # Vitest，只測 lib/pure.js 裡的純函式
npm run lint
```

## 功能

- 個人決策設定檔：人生價值與決策權重
- 目標管理：六大生活面向、優先度、期限與進度
- 事件記憶：記錄事件、影響程度與未來相關性，並自動計算重要性
- 決策工作台：比較「維持現況／準備後行動／立即行動」，依個人權重排序
- 90 天行動計畫：從建議決策自動建立高槓桿任務
- 反思機制：預設是透明的啟發式模型（列出假設、風險與下一步驗證方式）；也可以選配 AI 反思建議（見下方）
- 匯出／匯入：以 JSON 備份與還原資料

## AI 反思建議（選配）

在「今日狀態」的反思提醒卡片按「🤖 用 AI 重新生成反思」，可以用 Claude 針對你目前的
目標／事件／行動／決策產生客製化反思提示，取代預設的固定模板。這是**完全選配**的功能：

- 需要你自己部署一個最小的 Cloudflare Worker 當代理，才能安全呼叫 Claude API（前端不能
  直接放 API 金鑰）——部署步驟見 [`llm-proxy/README.md`](./llm-proxy/README.md)
- 部署好之後，在側邊欄「AI 設定」貼上代理網址與共用密鑰即可使用
- 沒有設定也完全不影響其他功能，pdos 本體仍然是純前端、`localStorage` 優先

## 隱私與限制

pdos 本體（`index.html`/`app.js`/`styles.css`/`lib/`）是本機優先、無後端、無帳號系統的
MVP，所有決策資料只存在你瀏覽器的 `localStorage`。唯一會對外發送資料的地方是選配的
「AI 反思建議」——只有你主動按下按鈕、且自己設定好代理服務時才會呼叫 Claude API，資料
不會被 pdos 本身收集或上傳到任何地方。決策分數是透明的啟發式模型，目的是協助梳理思路，
並非醫療、法律或投資指令。

## 下一階段

`SPEC.md` 的 P4+-7 記錄了完整的後端化／多 agent 路線圖與目前的決策：單人自用不需要
Postgres 後端或帳號系統，Claude 代理 + Reflection agent（上面的「AI 反思建議」）是目前
唯一落地的部分；Career/Finance/Health/Research agent、語意搜尋、多裝置同步都先暫緩，
細節與理由見 `SPEC.md`。

## 開發文件

- [`AGENTS.md`](./AGENTS.md)：開發規範（架構限制、驗證清單、commit/PR 流程）
- [`SPEC.md`](./SPEC.md)：功能規格與路線圖
- [`AI_PROJECT_SOP.md`](./AI_PROJECT_SOP.md)：AI 協作開發 SOP（通用範本）
