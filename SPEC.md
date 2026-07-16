# SPEC.md — PDOS（Personal Decision Operating System）功能規格與路線圖

## 現有功能盤點

| 模組 | 已完成 |
|---|---|
| 個人決策設定檔（人生價值、四維權重） | ✅ 新增/編輯權重，即時合計提示 |
| 目標管理（六大生活面向、優先度、期限、進度） | ✅ 新增、編輯、刪除、分類篩選 |
| 事件記憶（impact × relevance × unique 自動算重要性） | ✅ 新增、編輯、刪除、面向篩選、時間軸呈現 |
| 決策工作台（維持現況／準備後行動／立即行動 三選項比較） | ✅ 依權重排序、自動產生 90 天驗證行動、歷史決策留存、決策回顧統計 |
| 行動引擎（90 天行動計畫） | ✅ 新增、編輯、刪除、面向篩選、依分數／投入成本排序、勾選完成 |
| 匯出／匯入 JSON 備份 | ✅ 匯出正常；✅ 匯入已做結構驗證（見 P0-1） |
| 重設示範資料 | ✅ |
| 部署 | ✅ GitHub Actions → GitHub Pages（push main 自動部署） |
| 測試 / Lint | ✅ Vitest（`lib/pure.js` 純函式）+ ESLint + CI；⚠️ `app.js` 的 DOM/互動邏輯仍靠手動驗證 |

---

## 待開發功能規格

### P0 — 資料安全性（必做，理由：唯一已知會實際造成資料遺失/白畫面的路徑）

#### 1. 匯入資料格式驗證 `[x]`

**背景**：目前匯入（`import-input` 的 onchange handler）只用 `try/catch` 擋
`JSON.parse` 失敗的情況。如果匯入的 JSON **格式正確但結構不完整**（例如缺少
`goals`/`events`/`actions`/`profile` 其中一個欄位），`save()` 會先把這份壞資料
寫進 `localStorage`，接著呼叫 `render()` 時因為存取不存在的陣列而丟例外，導致
畫面卡在錯誤狀態——且原本正常的資料已經被覆蓋掉了。

**功能規格**：
- 匯入前先驗證頂層結構：`profile` 為物件、`goals`/`events`/`actions` 為陣列，
  且各自的必要欄位存在
- 驗證失敗時 `alert` 提示並**保留原本的 `data`**，不寫入 `localStorage`
- 涉及檔案：`app.js`（`import-input` 的 `onchange` handler）

**實作備註**：新增純函式 `isValidData(d)`（放在 `esc`/`formatDate` 旁邊，屬於
③ 純函式 helper 區塊），檢查 `profile.weights` 四個權重皆為有限數字、
`goals`/`events`/`actions` 皆為陣列且每筆項目具備必要欄位與型別。`onchange`
handler 先 `JSON.parse`，成功後才跑 `isValidData`，兩關都沒過就 `alert` 並
直接 `return`，不呼叫 `save()`。已用 Playwright 手動驗證：損毀 JSON、格式正確
但缺 `actions` 欄位的 JSON、完整備份檔三種情境，前兩者都不會覆蓋既有資料。

**優先級理由**：符合「資料正確性 / 避免坑使用者」的 P0 判準，是目前唯一會讓
使用者實際弄丟資料的已知路徑。

---

### P1 — 核心 CRUD 完整性（P0 完成後立即實作）

#### 2. 目標／事件／行動可編輯與刪除 `[x]`

**背景**：三個清單（`goals-list`/`events-list`/`actions-list`）目前只能
新增，行動只能勾選完成，**完全沒有編輯或刪除既有項目的入口**。打錯字、資訊
過時、或單純想清掉舊項目時，使用者唯一的手段是「重設示範資料」整個砍掉重練。

**功能規格**：
- 每個卡片／列表項目加上編輯與刪除按鈕
- 編輯重用既有 `openModal` 的表單結構，改為帶入既有值、送出時更新原物件
  （而非 `push` 新項目）
- 刪除前要有確認互動（比照既有 `reset-btn` 的 `confirm()` 寫法）
- 涉及檔案：`app.js`（`renderGoals`/`renderEvents`/`renderActions`、
  `openModal`、`modal-form` 的 submit handler）

**優先級理由**：屬於核心價值主張的必要功能——沒有編輯／刪除，工具用越久資料
越亂，是 MVP 最明顯的缺角。

**實作備註**：`openModal(type, editId)` 新增第二個參數，帶 `editId` 時預填既有
值並在送出時 `Object.assign` 回原物件（保留 `id`／目標的 `progress`／行動的
`done` 狀態），不帶時維持原本的新增行為。每個卡片新增 `.item-actions` 內的
編輯／刪除按鈕（`data-edit-*`／`data-delete-*`），刪除一律 `confirm()` 確認。
過程中用 Playwright 發現 `renderOverview()` 的 `data.goals.sort(...)` 會**直接
修改 `data.goals` 陣列本身**（`Array.prototype.sort` 是原地排序），導致每次
`render()` 都悄悄把目標清單重新排成依優先度排序，跟 `renderGoals()`「維持
新增順序」的預期不一致；已一併修正為 `[...data.goals].sort(...)`，不再共用
可變參照。已用 Playwright 手動驗證：三種項目的編輯／刪除都正確更新
`localStorage`，行動編輯後 `done` 狀態不會被重置，既有的「新增」流程與決策
分析流程沒有回歸。

#### 3. 決策分析結果留存 `[x]`

**背景**：`analyze()` 產生的三選項比較目前只存在畫面上，切換視圖或重新整理
就消失，只有自動加入的「90 天驗證計畫」行動會留下痕跡。使用者無法回頭比對
「當初為什麼這樣判斷」，跟 README 強調的「反思機制」定位不符。

**功能規格**：
- 每次 `analyze()` 產生結果時，把問題、限制條件、三個選項分數、建議選項存進
  `data`（例如新增 `decisions` 陣列）並持久化
- 決策工作台新增「歷史決策」區塊，可回顧過去的分析
- 涉及檔案：`app.js`（`analyze()`、`data` 結構、`seed`、新增
  `renderDecisionHistory`）

**優先級理由**：呼應 README「反思機制」的核心定位，是決策工具的價值本體，
不是錦上添花的功能。

**實作備註**：`analyze()` 每次產生結果後，把問題、限制條件、三選項分數、建議
選項與分數存進 `data.decisions`（新陣列），並在決策工作台的 `.decision-layout`
下方新增「歷史決策」panel（`renderDecisionHistory()`，依日期新到舊排序）。因為
`decisions` 是既有備份檔案不會有的新欄位，`load()` 與匯入流程（`isValidData()`
放寬為欄位存在時才驗證型別、匯入成功後補預設值）都做了向下相容處理，避免舊
格式的備份檔匯入後因為缺欄位而讓 `decisions.push` 噴例外。`seed` 也補上一筆
示範決策紀錄，讓全新使用者能看到這個區塊長什麼樣子。已用 Playwright 驗證：
分析後歷史清單即時更新且 `localStorage` 正確持久化、`#decision-results` 的
即時分析結果不會被 `save()` 觸發的 `render()` 覆蓋掉、匯入不含 `decisions`
欄位的舊格式備份檔不會壞掉且能正常繼續分析。

---

### P2 — 進階體驗（P1 穩定後排入）

#### 4. 事件／行動篩選與排序 `[x]`

**背景**：目標清單已有分類篩選（`filter-row`），但事件記憶與行動引擎目前
只有固定排序，要找特定面向的舊事件或行動只能整頁捲動。

**功能規格**：
- 比照 `goals` 的 `filter-row`，替事件／行動加上面向篩選
- 行動引擎增加排序切換

**優先級理由**：提升效率但非阻斷性缺口，待 P1 CRUD 補齊後再排入。

**實作備註**：事件的面向篩選直接用 `event.type` 欄位，跟 `goals` 的做法一致。
行動本身沒有 `category` 欄位（只有 `goal` 字串），所以行動的面向篩選是透過
`actionCategory(a)` 反查 `data.goals.find(g=>g.title===a.goal)?.category` 取得
——若對應的目標已被刪除（P1-2 開放刪除目標後才會出現的情況），該行動只會在
「全部」底下顯示，不會歸類到任何面向；這是已知的資料模型限制（行動用標題字串
而非 id 關聯目標），先不在這個 PR 處理（**後續已在「技術債與基礎強化」的
`action.goalId` 項目修復**）。原規格寫的「依到期日」排序在目前的資料
結構下不存在——行動沒有到期日欄位（只有目標有 `deadline`）——已改為更貼近現況
的「依投入成本（低到高，找快贏行動）」，跟預設的「依優先分數」並列在
`#action-sort` 這個獨立的 `filter-row`。已用 Playwright 驗證：事件依面向篩選
筆數正確、篩選到沒有資料的面向會顯示提示訊息、行動依面向篩選（含透過目標反查
分類）正確、切換排序模式後行動順序確實改變（用一筆刻意構造的「低分但低成本」
行動驗證兩種排序給出不同順序），且與先前三個 PR 的功能沒有回歸。

#### 5. 決策設定檔權重加總提示 `[x]`

**背景**：`score()`/`analyze()` 的分數計算隱含假設四個權重
（career/finance/life/freedom）合計為 100，但表單目前不驗證也不顯示合計，
使用者調整權重後合計可能變成 60 或 140，算出來的分數會失真但沒有任何提示。

**功能規格**：
- 設定檔表單即時顯示四個權重的合計值，非 100 時給予視覺提示（不強制擋下，
  維持「透明、使用者可自行調整」的原則）

**優先級理由**：體驗一致性優化，不影響資料正確性，P2 排入即可。

**實作備註**：在 `openModal('profile')` 的表單模板加了一行 `#weight-sum`，四個
權重 input 各自綁 `input` 事件即時重算合計；合計非 100 時額外加上 `.warn`
class（橘色文字）並附上提示文字，合計為 100 時只顯示數字、不特別強調。刻意
**不**在送出時擋下非 100 的情況——維持「透明、使用者可自行調整」的既有原則，
純粹是視覺提示。已用 Playwright 驗證：初始（seed 合計剛好 100）不顯示警示、
調整任一權重後即時更新合計與警示樣式、儲存非 100 的權重不會被擋下、重新開啟
設定檔時警示會依據已存的權重正確重新出現。

---

### P3 — 長期使用價值（有餘力再做）

#### 6. 決策回顧統計 `[x]`

**背景**：累積夠多歷史決策（依賴 P1-3）與已完成行動後，使用者會想知道
「過去的判斷準不準」。

**功能規格**：
- 依目標完成度、決策後續行動的完成率，做一個簡單的統計檢視

**優先級理由**：依賴 P1-3 落地後才有資料可用，屬於長期使用價值，非目前急迫。

**實作備註**：決策工作台新增「決策回顧統計」panel（`#decision-stats`，重用
`.metrics`/`.metric` 既有樣式），顯示三個指標：①目標平均完成度（`goal.progress`
平均）、②行動完成率（`data.actions` 整體 done 比例）、③決策追蹤行動完成率。
第三項需要知道「哪個 90 天驗證行動是哪個決策產生的」，但原本 `analyze()`
只用 `goal` + 標題關鍵字判斷是否已存在對應行動，決策紀錄跟行動之間沒有存
關聯。這次把 `analyze()` 改成：先確定要不要新增行動、拿到新行動的 `id`，
再把這個 `id` 存進決策紀錄的 `followUpActionId` 欄位；`renderDecisionStats()`
用這個欄位反查行動是否完成來算比例，沒有 `followUpActionId`（例如同一個目標
已經有追蹤行動、這次分析沒有再新增一筆）或對應行動已被刪除的決策，會被排除
在分母外，不會導致例外或算出錯誤比例。`seed` 的示範決策紀錄 `followUpActionId`
設為 `null`（demo 資料不特別去對應某個示範行動，避免內容兜不起來），對應
UI 上會顯示「尚無可追蹤的決策行動」。已用 Playwright 驗證：分析新決策後
「決策追蹤行動完成率」正確從「—」變成「0 / 1」，把對應行動勾選完成後即時
變成「1 / 1（100%）」；匯入不含 `decisions`／`followUpActionId` 的舊格式
備份檔也不會讓統計面板噴例外。

---

### P4+ — 架構等級變更（先記錄，動工前必須跟使用者確認範圍）

#### 7. 後端化 + 生活面向 LLM agent（Career/Finance/Health/Research/Reflection）`[ ]`

**背景**：README「下一階段」提到，若要擴展至生產版，可將 `app.js` 的資料
服務換成 Fastify + PostgreSQL/pgvector，並為五個生活面向加入 LLM gateway 與
工作流程編排。這是**架構等級的重大轉向**——目前 pdos 是「純前端、本機優先、
無後端、無 AI API 呼叫」的隱私優先 MVP（README 明定），一旦後端化，會變成
需要伺服器、資料庫、（如果做多使用者）帳號系統、LLM API 金鑰與費用的系統。
以下先把這個大方向拆成可以個別評估、個別動工的子項目；**尚未實作任何一項**，
且動工前每一項都要再跟使用者確認範圍與預算。

**優先級理由**：牽涉後端基礎設施、資料同步、LLM 呼叫成本，需要使用者明確
決定要不要跨出「純前端、無後端 MVP」這一步，才值得展開細規格。

---

#### 7.1 後端 API 服務（Fastify + PostgreSQL）`[ ]`

**背景**：現在所有資料只存在單一瀏覽器的 `localStorage`，換裝置、清瀏覽器
資料、或瀏覽器儲存空間被清掉，資料就直接遺失，也無法跨裝置存取。這是後續
所有 P4+ 子項目（雲端同步、LLM agent）共同的地基。

**功能規格**：
- Fastify server，提供 JSON API 對應現有 `data` 結構：`profile`／`goals`／
  `events`／`actions`／`decisions` 的 CRUD
- PostgreSQL schema 對應現有欄位，包含 P2-4/P2-4 修復後的 `action.goalId`
  外鍵關聯（不要重蹈 `action.goal` 字串快照的覆轍）
- 前端 `app.js` 的 `load()`/`save()` 資料層改成呼叫 API，而不是直接讀寫
  `localStorage`——**是否完全取代 `localStorage`，還是把它降級為離線快取／
  未登入時的 fallback**，待確認（見文末「待確認事項」）
- 沿用既有的匯出／匯入 JSON 格式作為「本機資料遷移到雲端帳號」的路徑（見
  7.8）

**資料結構草案**：
```
users(id, email, created_at)
profiles(user_id, name, values, weights_career, weights_finance, weights_life, weights_freedom)
goals(id, user_id, title, category, priority, deadline, progress)
events(id, user_id, type, title, note, impact, relevance, unique, date)
actions(id, user_id, title, goal_id → goals.id, impact, alignment, urgency, effort, done)
decisions(id, user_id, date, question, goal_id → goals.id, constraints, options(jsonb), recommended, best_score, follow_up_action_id → actions.id)
```

**涉及檔案/模組**：新增 `server/`（Fastify app）、`server/db/migrations`；
`app.js` 的持久化層改寫

**優先級理由**：是 7.2–7.6 的共同前提，沒有這層其他子項目都無法動工。

---

#### 7.2 使用者帳號與授權 `[ ]`

**背景**：後端持久化資料前，要先知道「這是誰的資料」。目前完全沒有帳號
概念（單一使用者、單一瀏覽器）。

**功能規格**：（依 7.1 的模式決定，見「待確認事項」——如果選擇「單人自用、
雲端只是換個儲存位置」，這項可以簡化成一組固定 API token，不需要完整的
註冊/登入系統）
- 若需要多使用者：註冊／登入（email + 密碼，或第三方 OAuth）、session／JWT，
  每個 API 呼叫帶身份
- 若單人自用：一組環境變數存放的 API token，前端呼叫 API 時帶上，不做
  註冊流程

**涉及檔案/模組**：`server/auth`

**優先級理由**：7.1 API 服務要不要做成多使用者，直接決定這項的範圍大小，
必須先確認 7.1 的方向才能細化。

---

#### 7.3 pgvector 語意搜尋（事件記憶／決策的語意檢索）`[ ]`

**背景**：README 提到 pgvector，目的推測是讓「事件記憶」與「歷史決策」可以
用語意相似度搜尋，作為後續 LLM agent 的檢索基礎（RAG），而不是只能用
分類篩選。

**功能規格**：
- 為 `events`／`decisions` 的文字內容產生 embedding（呼叫 embedding API），
  存進 `pgvector` 欄位
- 新增語意搜尋 API：輸入一段文字，回傳最相關的歷史事件／決策
- 決策工作台的 `analyze()` 未來可以用這個檢索結果作為背景脈絡餵給 LLM
  （見 7.4/7.5）

**涉及檔案/模組**：`server/embeddings`，DB schema 加 `vector` 欄位

**優先級理由**：是讓 LLM agent（7.5）有實際歷史脈絡可用的資料基礎，沒有
這層，agent 只能看到當下輸入、看不到使用者過去的模式。

---

#### 7.4 LLM Gateway（集中管理 LLM API 呼叫）`[ ]`

**背景**：目前「分析選項」是純前端寫死的啟發式公式（`analyze()` 裡的固定
權重矩陣），**不是真的呼叫 AI**。要讓決策分析變成真正的 AI 輔助，需要一個
安全呼叫 LLM API 的後端層——API 金鑰不能放在前端程式碼裡。

**功能規格**：
- 後端新增 `/api/llm/*` endpoint，封裝呼叫 LLM API（模型選型待確認）
- API 金鑰透過環境變數管理，不進版控（`.env` + `.env.example` 占位）
- 加上基本的逾時／重試／錯誤處理，讓 LLM 呼叫失敗時前端有清楚的錯誤訊息，
  不是整頁卡死
- 需要抓 LLM 呼叫成本（token 用量記錄），避免失控

**涉及檔案/模組**：`server/llm-gateway`

**優先級理由**：是 7.5 五個 domain agent 的共同基礎設施，必須先做。

---

#### 7.5 五個生活面向 LLM agent `[ ]`

**背景**：README 原始願景是讓 Career／Finance／Health／Research／Reflection
五個生活面向各自有專屬的 AI agent 協助分析，取代/補強現有寫死的「三選項
比較」公式。

**功能規格**（草案，五個 agent 的實際範圍都需要使用者進一步確認）：
- **Career agent**：分析職涯目標（`goals` 篩選 category=Career）與對應行動的
  落差，給建議
- **Finance agent**：分析財務目標進度，抓出風險（例如期限接近但進度落後）
- **Health agent**：從 `events`（category=Health）抓健康相關訊號，主動提醒
- **Research agent**：⚠️ README 沒有說明具體用途，需要使用者定義這個
  agent 實際要做什麼
- **Reflection agent**：呼應現有「反思提醒」卡片（`renderOverview` 裡寫死的
  邏輯），改用 LLM 產生更客製化的反思提示

**涉及檔案/模組**：`server/agents/*.js`

**優先級理由**：是這個大方向的最終體驗價值，但依賴 7.1–7.4 都先做完；
五個 agent 不需要一次全做，可以先挑 1–2 個當 pilot（見「待確認事項」）。

---

#### 7.6 工作流程編排 `[ ]`

**背景**：README 提到「工作流程編排」，暗示 agent 之間可能需要協調（例如
Career agent 的結論餵給 Reflection agent 做整合建議）。

**功能規格**：待確認——如果 7.5 只做 1–2 個獨立 agent，這項可能不需要；
只有當多個 agent 之間真的需要互相依賴/串接時才需要引入編排機制，不要為了
「將來可能需要」而預先蓋一個複雜框架。

**優先級理由**：排在 7.5 之後，且很可能不需要獨立框架，視實際 agent 數量
與交互複雜度決定。

---

#### 7.7 部署與維運調整 `[ ]`

**背景**：現在的部署是純靜態網站丟 GitHub Pages。一旦有 Fastify 後端＋
PostgreSQL/pgvector，需要新的部署管線與 hosting 方案。

**功能規格**：待確認 hosting 選型（例如 Fly.io／Render／Railway 之類提供
免費或低成本 Postgres + Node 服務的平台），需要把「這是個人 MVP、不想花大
錢」的預算限制列入考量。

**優先級理由**：決定「能不能上線」的前提，但同時依賴 7.1–7.6 的範圍大小，
不用最早決定，但要在正式動工前確認。

---

#### 7.8 既有本機資料的遷移路徑 `[ ]`

**背景**：現有使用者的資料在瀏覽器 `localStorage`。一旦上雲，如果沒有遷移
路徑，等於「升級 = 資料遺失」，違反 AGENTS.md 對資料安全性的 P0 判準。

**功能規格**：
- 善用既有的「匯出資料」JSON 備份功能：使用者匯出本機資料 → 登入雲端帳號
  後「匯入」，寫進後端資料庫
- 沿用／擴充現有的 `isValidData()`／`migrateActionGoals()` 驗證與遷移邏輯

**優先級理由**：一旦決定要做 7.1，這項是保護既有使用者資料的必要環節，
不能省略，應視為這個大主題底下唯一的 P0 級子項。

---

**待確認事項**（動工前需要使用者明確回答，不是 AI 該自己決定的範圍）：

1. **單人自用，還是要做成多使用者系統？** 直接決定 7.2 的範圍大小——如果只
   是「我自己的資料想同步到雲端」，可以用一組固定 token，省掉整套帳號系統。
2. **LLM 用哪個供應商／模型？預算上限是多少？** 決定 7.4 的技術選型與
   7.5 每個 agent 的呼叫頻率設計。
3. **Research agent 具體要做什麼？** README 沒有說明，需要先定義用途才能
   展開規格。
4. **五個 agent 要一次做完，還是先挑 1–2 個 pilot？** 建議 pilot（例如先做
   Reflection agent，直接升級現有「反思提醒」卡片），驗證 LLM 整合的價值後
   再決定要不要擴展到其他四個。
5. **後端上線後，要不要保留現在的純前端／`localStorage` 模式作為離線選項？**
   還是後端化後就完全取代？

---

## 技術債與基礎強化

- ~~**測試框架**~~ **已導入**：`score()`/`esc()`/`formatDate()`/`isValidData()`/
  `migrateActionGoals()` 從 `app.js` 搬到 `lib/pure.js`（UMD 包裝，瀏覽器
  `<script>` 全域與 Node/Vitest import 雙軌相容，`index.html` 的載入方式與
  「直接雙擊開啟」完全不變），並補上 `lib/pure.test.js`（Vitest，21 個測試
  案例含邊界值）。`app.js` 本身的 DOM／互動邏輯仍然沒有自動化測試，維持手動
  驗證（見 AGENTS.md 2.2／2.3）。
- ~~**Lint**~~ **已導入**：ESLint 9（flat config，`eslint.config.mjs`），對
  `app.js`／`lib/pure.js` 設定瀏覽器全域＋跨檔案函式白名單，對測試/設定檔
  設定 Node 全域。
- 新增 `.github/workflows/ci.yml`，每個 PR 自動跑 `npm run lint` + `npm test`
  （原本的 `.github/workflows/deploy.yml` 維持不變，只在 push main 時跑）。
- `package.json`／`node_modules` 只服務開發期工具，不影響網站本身的載入
  方式；`.gitignore` 已新增排除 `node_modules/`。
- ~~**行動與目標之間用標題字串關聯，不是 id**~~ **已修復**：`action.goal`
  （標題字串快照）已改成 `action.goalId`（關聯 `goal.id`），顯示時透過
  `actionGoalTitle(a)` 即時查表取得目標的當下標題。新增 `migrateActionGoals(d)`
  在 `load()` 與匯入流程都會執行，把舊格式（只有 `goal` 字串、沒有 `goalId`）
  的既有 `localStorage` 資料與匯入的舊備份檔就地轉換：依標題比對現有目標找出
  `goalId`，找不到對應目標的行動則 `goalId:null`（歸類為「目標已刪除」，只
  顯示在「全部」篩選底下，不會噴例外）。已用 Playwright 驗證：改名目標後，
  底下行動顯示的標題與面向篩選都會跟著更新（修復前会對不起來）；刪除目標後，
  其行動顯示「（目標已刪除）」且只出現在「全部」；匯入舊格式備份檔會正確
  轉換出 `goalId`。

---

## 優先開發路徑建議

`P0-1（匯入驗證）→ P1-2（編輯／刪除）→ P1-3（決策留存）→ P2-4（篩選排序）→
P2-5（權重提示）→ P3-6（決策回顧統計）` 皆已完成，「技術債與基礎強化」段落
的測試框架、Lint、`action.goalId` 資料模型三項也都已處理。

`P4+-7`（後端化／LLM agent）已拆解成 7.1–7.8 八個子項目與 5 題「待確認
事項」（見上方），**但尚未實作任何一項**——這是架構等級的重大轉向，每個
子項動工前都要先跟使用者確認範圍，尤其是「待確認事項」的 5 題（單人自用
或多使用者、LLM 供應商與預算、Research agent 用途、要不要做 pilot、要不要
保留純前端模式）沒有答案前不應該開始寫程式碼。若使用者確認要開始，建議
順序是 `7.1（後端 API）→ 7.8（資料遷移，跟 7.1 同批做）→ 7.2（帳號）→
7.4（LLM Gateway）→ 7.5（先做 1 個 pilot agent）→ 7.3（語意搜尋，pilot
證明價值後再加）→ 7.6（工作流程編排，視 agent 數量決定要不要做）→
7.7（部署，視整體規模決定 hosting）`。

在使用者決定要不要開始 P4+ 之前，可以考慮視使用習慣新增新的 P2/P3 級小
功能，或繼續擴充 `lib/pure.js` 的測試覆蓋率。
