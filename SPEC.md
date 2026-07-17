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
| AI 反思建議（選配，Reflection agent pilot） | ✅ Claude API 輕量代理（`llm-proxy/`，Cloudflare Workers）+ 前端「AI 設定」與生成按鈕；⚠️ 需要使用者自行部署代理才能使用，見 `llm-proxy/README.md` |

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

#### 7. 後端化 + 生活面向 LLM agent（Career/Finance/Health/Research/Reflection）`[~]`

**背景**：README「下一階段」提到，若要擴展至生產版，可將 `app.js` 的資料
服務換成 Fastify + PostgreSQL/pgvector，並為五個生活面向加入 LLM gateway 與
工作流程編排。這是**架構等級的重大轉向**——目前 pdos 是「純前端、本機優先、
無後端、無 AI API 呼叫」的隱私優先 MVP（README 明定），一旦後端化，會變成
需要伺服器、資料庫、（如果做多使用者）帳號系統、LLM API 金鑰與費用的系統。
以下先把這個大方向拆成可以個別評估、個別動工的子項目；**尚未實作任何一項**，
且動工前每一項都要再跟使用者確認範圍與預算。

**優先級理由**：牽涉後端基礎設施、資料同步、LLM 呼叫成本，需要使用者明確
決定要不要跨出「純前端、無後端 MVP」這一步，才值得展開細規格。

**使用者已回答的問題**（原「待確認事項」1–4）：

1. **單人自用**。不需要多使用者帳號系統。
2. **LLM 用 Claude API**。
3. **Research agent 用途尚未定案**，先不展開規格，之後再看。
4. **五個 agent 一個一個做**，不要一次全上。

**AI 評估建議（原問題 5：後端上線後要不要保留純前端模式）**：

**建議：保留，而且不要為了「上 LLM」就先做 7.1（Postgres 後端）／7.2（帳號
系統）／7.3（pgvector）。** 理由：

- 「單人自用」拿掉了後端最主要的存在理由（多裝置同步、多使用者資料隔離）。
  真正**唯一無法繞過、一定需要伺服器**的原因，只有一件事：**Claude API
  金鑰不能放進前端程式碼**（GitHub Pages 是公開靜態網站，金鑰放進 `app.js`
  等於公開金鑰，任何人都能撈走拿去刷你的額度）。
- 除此之外，`localStorage` 完全夠用：單一使用者、資料量不大，不需要
  PostgreSQL，也不需要帳號系統（用一組你自己保管的共用密鑰就夠，見下方
  7.2 修訂）。
- pgvector／語意搜尋是「錦上添花」，不是「不做就無法運作」——第一個 pilot
  agent 可以直接把當下的 `goals`/`events`/`actions`/`decisions` 整包丟給
  Claude 當 context（資料量對單一使用者來說很小，LLM context window 綽綽
  有餘），不需要先蓋一個向量資料庫才能開始。
- 結論：**把 7.1／7.2／7.3／7.6／7.7／7.8 全部往後延**，先做一個最小可行的
  「Claude API 輕量代理」（原 7.4，見下方已改寫）+ 一個 pilot agent
  （7.5 的第一個），實際用過、確定有價值、且真的需要多裝置同步或語意搜尋時，
  再回頭評估要不要做 7.1/7.2/7.3。這樣可以幾天內看到「Reflection agent 真的
  用 Claude 分析我的資料」這個成果，而不是先花大把時間蓋一個目前用不到的
  資料庫與帳號系統。

下面各子項的狀態已依這個結論更新（「建議現在做」／「建議暫緩」）。

---

#### 7.1 後端 API 服務（Fastify + PostgreSQL）`[ ]`——**建議暫緩**

> 單人自用不需要多裝置雲端同步；`localStorage` + 既有的匯出/匯入 JSON 已經
> 是堪用的備份機制。等真的碰到「想在手機和電腦間同步」的痛點，或某個 agent
> 真的需要伺服器端持久化，再回頭做這項。

**背景**：現在所有資料只存在單一瀏覽器的 `localStorage`，換裝置、清瀏覽器
資料、或瀏覽器儲存空間被清掉，資料就直接遺失，也無法跨裝置存取。這是後續
所有 P4+ 子項目（雲端同步、LLM agent）共同的地基。

**功能規格**：
- Fastify server，提供 JSON API 對應現有 `data` 結構：`profile`／`goals`／
  `events`／`actions`／`decisions` 的 CRUD
- PostgreSQL schema 對應現有欄位，包含技術債修復後的 `action.goalId`
  外鍵關聯（不要重蹈 `action.goal` 字串快照的覆轍）
- 前端 `app.js` 的 `load()`/`save()` 資料層改成呼叫 API，而不是直接讀寫
  `localStorage`——AI 評估建議是保留 `localStorage` 當離線／未登入的
  fallback，不要完全取代（見 7. 開頭的「AI 評估建議」）
- 沿用既有的匯出／匯入 JSON 格式作為「本機資料遷移到雲端帳號」的路徑（見
  7.8，目前也建議暫緩）

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

**優先級理由**：原規劃是 7.2/7.3/7.6/7.8 的共同前提，但依「AI 評估建議」，
這些子項目本身也都建議暫緩，所以這項不再是任何「現在要做的項目」的阻礙——
`7.4`／`7.5` 的第一個 pilot 不依賴這項。

---

#### 7.2 使用者帳號與授權 `[x]`——**簡化成共用密鑰，已完成**

> 已確認單人自用，不需要完整帳號系統。真正需要的只是「防止陌生人打你的
> Claude 代理 endpoint、刷你的額度」，用一組共用密鑰（pre-shared secret）
> 就夠，等真的要做多使用者才需要展開成完整授權系統。

**背景**：Claude API 代理（見改寫後的 7.4）本身需要一個簡單的防護，不然
部署上網後任何人都能打這個 endpoint 消耗你的 Claude 額度。

**功能規格**：
- 代理服務用一個環境變數存一組密鑰（例如 `PROXY_SECRET`）
- `app.js` 新增一個「設定」欄位讓你貼上這組密鑰，存進 `localStorage`
  （比照 `data.profile` 的存法，不用額外欄位/表單系統）
- 每次呼叫代理時在 header 帶上這組密鑰，代理端比對不符就回 401
- 不做註冊、登入、session、多使用者資料隔離

**涉及檔案/模組**：代理服務本身（見 7.4）；`app.js` 新增一個「LLM 設定」
的小 UI（存密鑰）

**優先級理由**：只是 7.4 的最小防護層，跟著 7.4 一起做，不需要獨立展開
成完整帳號系統。

**實作備註**：`app.js` 側邊欄新增「AI 設定」按鈕（`#llm-settings-open`），
開啟 `openModal('llmConfig')` 讓你貼上代理網址與密鑰，存進**獨立的**
`localStorage` key（`pdos-llm-config`，跟決策資料的 `pdos-v1` 完全分開）。
**刻意分開存放的原因**：如果密鑰混進 `data.profile` 之類的欄位，會被「匯出
資料」功能一起打包進 JSON 備份檔——備份檔可能被分享或不安全地同步，密鑰混
進去就等於外洩。已用 Playwright 驗證：匯出的 `pdos-v1` 內容不含密鑰字串。
代理端（`llm-proxy/`）用 `X-Proxy-Secret` header 比對 `PROXY_SECRET`
環境變數，不符回 401，已用真實 wrangler dev 本機執行驗證（見 7.4 備註）。

---

#### 7.3 pgvector 語意搜尋（事件記憶／決策的語意檢索）`[ ]`——**建議暫緩**

> 單人資料量小，第一個 pilot agent 可以直接把 `data` 整包丟給 Claude 當
> context，不需要先蓋向量資料庫。等真的碰到「事件記憶多到需要用語意搜尋
> 才找得到」的痛點，或有 agent 明確需要 RAG，再回頭做。

**背景**：README 提到 pgvector，目的推測是讓「事件記憶」與「歷史決策」可以
用語意相似度搜尋，作為後續 LLM agent 的檢索基礎（RAG），而不是只能用
分類篩選。

**功能規格**：（維持原草案，供之後展開）
- 為 `events`／`decisions` 的文字內容產生 embedding，存進 `pgvector` 欄位
- 新增語意搜尋 API：輸入一段文字，回傳最相關的歷史事件／決策

**涉及檔案/模組**：需要 7.1（資料庫）先落地才有地方存 embedding

**優先級理由**：依賴 7.1，而 7.1 目前建議暫緩，所以這項自然也暫緩。

---

#### 7.4 Claude API 輕量代理 `[x]`——**已完成**

> 這是整個 P4+ 主題裡唯一**現在就該做**的基礎設施：沒有它，任何一個 LLM
> agent 都無法安全運作（金鑰不能放前端）；有了它，就能直接做第一個 pilot
> agent（見 7.5），不需要先蓋資料庫或帳號系統。

**背景**：目前「分析選項」是純前端寫死的啟發式公式（`analyze()` 裡的固定
權重矩陣），**不是真的呼叫 AI**。要讓決策分析／反思提醒變成真正的 AI 輔助，
需要一個安全呼叫 Claude API 的最小後端層——API 金鑰不能放在前端程式碼裡，
且 GitHub Pages 是純靜態託管，沒有伺服器可以放這段邏輯。

**功能規格**：
- 一個獨立的 serverless function（不是完整的 Fastify app），推薦
  Cloudflare Workers 或 Vercel/Netlify Functions（免費額度通常對個人使用
  綽綽有餘，且不需要另外維運一台伺服器）
- 單一 endpoint，收到請求後：驗證 7.2 的共用密鑰 → 組裝 prompt →
  呼叫 Claude API（金鑰放在該平台的環境變數）→ 回傳結果
- 基本的逾時／錯誤處理，讓 LLM 呼叫失敗時前端有清楚的錯誤訊息，不是整頁
  卡死（比照現有 `import-input` 錯誤處理的精神：失敗要有明確提示，不影響
  其他功能）
- 不需要資料庫、不需要 token 用量記錄系統這麼複雜的東西——單人使用，先用
  Claude Console 內建的用量頁面看花費就夠，不用自己重做一套

**涉及檔案/模組**：新增獨立的 serverless function 專案（例如
`llm-proxy/`，視選定平台的慣例調整），與 `app.js` 分開部署

**優先級理由**：是唯一「不做就無法讓任何 agent 運作」的必要建設，而且
比原本設計的完整 Fastify + Postgres 後端輕量非常多，可以很快做完。

**實作備註**：選定 **Cloudflare Workers**（`llm-proxy/`，獨立的
`package.json`／`wrangler.toml`，`npx wrangler deploy` 部署，跟 GitHub
Pages 完全分開）。用官方 `@anthropic-ai/sdk`，模型預設 `claude-opus-4-8`
（可用 `ANTHROPIC_MODEL` 環境變數覆蓋），把 Anthropic 的錯誤（401/403 金鑰
錯誤、429 額度超過、5xx／529 服務問題）轉換成中文錯誤訊息回給前端，不洩漏
內部細節。已用 `wrangler dev --local` 對真實 Cloudflare Workers runtime
（含真的呼叫一次 Anthropic API，用假金鑰驗證錯誤處理路徑）驗證：無密鑰／
密鑰錯誤 → 401、缺 prompt／格式錯誤 → 400、金鑰錯誤時 Anthropic 回應
正確轉換成 502 中文訊息、CORS preflight 正常回應。部署與金鑰設定步驟需要
使用者自己的 Cloudflare 帳號與 Anthropic API 金鑰完成，細節見
`llm-proxy/README.md`。

---

#### 7.5 五個生活面向 LLM agent `[~]`——**第一個 pilot（Reflection）已完成，其餘四個未開始**

**背景**：README 原始願景是讓 Career／Finance／Health／Research／Reflection
五個生活面向各自有專屬的 AI agent 協助分析，取代/補強現有寫死的「三選項
比較」公式。已確認：一個一個做；Research agent 用途未定，先跳過。

**功能規格**（一次只展開「當前要做的那一個」，做完再回來細化下一個）：
- **Reflection agent（第一個，已完成）**：呼應現有「反思提醒」卡片
  （`renderOverview` 裡原本是挑 `impact*relevance*unique` 最高的一筆事件、
  套固定文字模板，這個預設行為**維持不變**）。新增一個「🤖 用 AI 重新生成
  反思」按鈕，**使用者主動點擊**才會把目前的 `goals`/`events`/`actions`/
  `decisions` 整理成 prompt 送給 7.4 的代理，用 Claude 產生客製化反思提示
  取代畫面上的內容。選它當第一個的原因：現有 UI 已經有掛載點
  （`#reflection-title`/`#reflection-text`），不需要新增畫面，最小成本驗證
  「LLM 整合有沒有價值」。
- Career／Finance／Health agent：規格待這個 pilot 用過一段時間、確認方向後
  再展開，目前 `[ ]` 未開始
- Research agent：用途未定，暫不展開

**涉及檔案/模組**：`lib/pure.js`（新增純函式 `buildReflectionPrompt(d)` 組
prompt）、`app.js`（`callLlmProxy()`、`loadLlmConfig()`/`saveLlmConfig()`、
`ai-reflect-btn` 的 click handler）、`index.html`（反思卡片新增按鈕與狀態
文字、側邊欄新增「AI 設定」入口）

**優先級理由**：是這個大方向的最終體驗價值，依賴 7.4（代理）與 7.2（密鑰
防護）先做完；不依賴 7.1/7.3。

**實作備註**：**刻意設計成使用者主動觸發，不是自動呼叫**——`render()` 每次
存檔都會執行，如果 AI 反思是自動觸發，會在使用者根本沒要求的情況下持續消耗
Claude 額度。按鈕點擊後才呼叫 `callLlmProxy()`，失敗時（未設定/密鑰錯誤/
網路問題/伺服器錯誤）在按鈕旁顯示清楚的中文錯誤訊息，不影響頁面其他部分；
呼叫中按鈕會被停用避免重複點擊。AI 產生的內容是**暫時性**的（跟既有的
`#decision-results` 面板同一種模式）——下次 `render()` 執行時（例如新增一筆
資料）會被預設的啟發式反思蓋回去，不會持久化存進 `data`。已用 Playwright +
本機 mock proxy 伺服器驗證：未設定時顯示清楚提示、密鑰錯誤時顯示伺服器回傳
的錯誤訊息、設定正確後成功呼叫並更新畫面、且**匯出的 `pdos-v1` 備份檔確認
不含這組密鑰**（見 7.2 備註）。

---

#### 7.6 工作流程編排 `[ ]`——**建議暫緩**

> 只做一個 agent 時完全不需要編排；等真的做到第二、三個 agent，且它們之間
> 需要互相依賴（例如 Career 的結論餵給 Reflection）時再評估要不要做，不要
> 預先蓋框架。

**背景**：README 提到「工作流程編排」，暗示 agent 之間可能需要協調。

**優先級理由**：依賴 7.5 做到第二個以上的 agent 才有意義展開。

---

#### 7.7 部署與維運調整 `[ ]`——**範圍縮小為「幫 7.4 選一個 serverless 平台」**

**背景**：原本假設要部署 Fastify + PostgreSQL，現在 7.1 暫緩、7.4 改成輕量
serverless function，部署需求小很多。

**功能規格**：
- 在 Cloudflare Workers / Vercel Functions / Netlify Functions 三選一
  （都有免費額度，個人單一 endpoint 用量通常不會超過），主要看你熟悉/
  想學哪個平台
- GitHub Pages 的前端部署維持不變，只是 `app.js` 呼叫的 API 網址多指向
  這個新 endpoint

**優先級理由**：跟著 7.4 一起確認，動工前選定平台即可，不需要獨立展開。

---

#### 7.8 既有本機資料的遷移路徑 `[ ]`——**目前不需要**

> 沒有 7.1（沒有把資料搬到雲端資料庫），資料就還是留在 `localStorage`，
> 不存在「升級 = 資料遺失」的風險，這項自然不需要。等之後真的要做 7.1
> 才需要重新評估。

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

`P4+-7`（後端化／LLM agent）已拆解成 7.1–7.8 八個子項目。依照 AI 評估建議的
最小可行路徑，**`7.4（Claude API 輕量代理）→ 7.2（共用密鑰防護）→
7.5 第一個 pilot（Reflection agent）` 三項已經完成**：`llm-proxy/`
（Cloudflare Workers）部署程式碼與文件就緒、pdos 前端有「AI 設定」與
「AI 反思建議」功能，密鑰單獨存放不會混進備份檔。**7.1（Postgres 後端）／
7.3（pgvector 語意搜尋）／7.6（工作流程編排）／7.7（部署調整，已被 7.4
的輕量方案取代）／7.8（資料遷移，目前不需要）維持建議暫緩**，理由詳見 7.
開頭的「AI 評估建議」段落。

下一步若要繼續，有兩個方向可選：① 展開 7.5 的下一個 agent（Career／
Finance／Health，Research 用途仍待定）；② 先用一段時間驗證 Reflection
agent 有沒有實際幫助，再決定要不要擴展。哪個都不是自動預設，等使用者決定。

在使用者決定下一步之前，可以考慮視使用習慣新增新的 P2/P3 級小功能，或繼續
擴充 `lib/pure.js` 的測試覆蓋率。
