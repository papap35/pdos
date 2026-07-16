# AGENTS.md — 開發規範手冊（PDOS — Personal Decision Operating System）

本文件定義所有 AI agent 與人類開發者在此專案中必須遵守的原則。
每次開發新功能、修 bug、更新 SPEC.md 前，請先通讀對應章節。

> **每次 PR 前都必須執行 3.5 Step 2.5 文件同步檢查**，確認 SPEC.md、README.md、
> AGENTS.md 均已反映本次異動。

---

## 目錄

1. [寫程式的原則](#1-寫程式的原則)
2. [測試與驗證的原則](#2-測試與驗證的原則)
3. [開發流程原則（Branch → Commit → PR）](#3-開發流程原則branch--commit--pr)
4. [Commit 的原則](#4-commit-的原則)
5. [判讀與更新 SPEC.md 的原則](#5-判讀與更新-specmd-的原則)

---

## 1. 寫程式的原則

### 1.1 目前的架構限制（誠實揭露）

**網站本身**（`index.html` + `app.js` + `styles.css` + `lib/pure.js`）是**沒有
build step 的純靜態網站**，瀏覽器直接執行 `<script>` 標籤，可以直接雙擊
`index.html` 開啟，不需要伺服器。`package.json`／`node_modules` 只用來裝
**開發期**的測試（Vitest）與 lint（ESLint）工具，不影響網站怎麼被載入、也
不會把網站本身變成需要 build 的專案——這條界線很重要，修改時：

- **不要為了網站本身引入需要編譯或打包的語法**（TypeScript、JSX、跨檔案
  `import`/`export` 等），除非先跟使用者確認要不要讓網站也吃下這個複雜度。
- `lib/pure.js` 是唯一的例外：它用 UMD 風格包裝（見 1.2），同時支援瀏覽器
  `<script>` 全域變數與 Node/Vitest 的 `import`／`require`，藉此讓 `app.js`
  維持純 `<script>`、不需要 `type="module"`，同時讓純函式可以被單元測試。
  新增這類「雙軌相容」檔案時比照這個模式，不要另外發明新寫法。
- 若之後真的要讓網站本身也上 build 工具（bundler、TS 等），那是比這更大的
  架構決定，動工前必須先跟使用者確認。

### 1.2 檔案職責分區（新程式碼比照放置）

```
lib/pure.js   純函式 helper（score / esc / formatDate / isValidData /
              migrateActionGoals）—— 無副作用、只依賴輸入參數、不碰 DOM／
              localStorage。用 UMD 包裝同時掛到 window 全域（瀏覽器）與
              module.exports（Vitest 測試用），對應的單元測試放在
              lib/pure.test.js。
lib/pure.test.js  Vitest 測試，只測 lib/pure.js 的純函式，不做 DOM／整合測試。
app.js        由上到下依此順序組織，新增函式時歸類到對應區塊，不要混雜：
  ① 常數與 seed 示範資料（STORAGE, categories, colors, seed）
  ② 持久化（load / save，依賴 lib/pure.js 的 isValidData / migrateActionGoals）
  ③ 其他 helper（id 等——注意 score/esc/formatDate 等純函式已搬進
     lib/pure.js，不要在 app.js 裡重複定義）
  ④ 渲染函式（renderOverview / renderGoals / renderEvents / renderActions ...）
  ⑤ 互動邏輯（openModal、表單 submit、analyze 決策引擎）
  ⑥ 事件綁定（檔案最底部，統一 addEventListener/onclick）
```

- **新的資料推導邏輯（分數、嚴重度、重要性計算之類）如果無副作用、不碰
  DOM，優先寫進 `lib/pure.js` 並補測試**；只有真的需要讀寫 `data`／DOM
  的邏輯才留在 `app.js`。
- 渲染函式只負責「資料 → HTML 字串」，不要在裡面做資料篩選以外的業務運算。
- `index.html` 載入順序固定是 `lib/pure.js` 先於 `app.js`（`app.js` 直接呼叫
  `score`/`esc` 等全域函式，順序顛倒會噴 `ReferenceError`）。

### 1.3 XSS 防禦（硬性規則）

- 專案大量使用 `innerHTML` 模板字串組裝畫面。**任何使用者輸入的字串（標題、
  備註、名稱等）塞進 `innerHTML` 前一律要先過 `esc()`**，比照既有的
  `esc(g.title)`、`esc(e.note)` 寫法。新增欄位或新的 render 函式時不可以為了
  少打字而省略——這是目前唯一的 XSS 防線。
- 數字類欄位（`priority`/`impact`/`relevance`/`unique`/`urgency`/`effort` 等）
  一律用 `+value` 或 `Number(value)` 轉型後才存入 `data`，不要直接存表單原始
  字串。

### 1.4 資料模型

- 全域狀態是單一物件 `data = {profile, goals, events, actions}`，序列化存進
  `localStorage`（key `pdos-v1`），透過 `load()`/`save()` 讀寫，`save()` 會
  connect 到 `render()` 重繪整頁。
- 新增欄位時，**同步更新 `seed`（demo 示範資料）**，確保「全新使用者（無
  localStorage）」與「已有資料的使用者」看到的欄位結構一致，不要讓 demo 模式
  漏欄位。
- 目前的分數／推薦邏輯（`score()`、`analyze()`）假設使用者設定檔的四個權重
  （career/finance/life/freedom）合計為 100；若要放寬這個假設（例如允許使用者
  設不合計 100 的權重），要同時檢視這兩個函式並在 SPEC.md 記錄為一個獨立項目。

### 1.5 邊界與範圍限制

- 這是**本機優先、無後端**的 MVP（README 明定：無雲端同步、無 AI API 呼叫）。
  **不要主動加入任何對外部 API 的 `fetch` 呼叫**——若使用者要求新增這類功能，
  先在 SPEC.md 開一個獨立項目並確認範圍，不要在其他功能的 PR 裡夾帶。
- README「下一階段」提到的 Fastify + PostgreSQL/pgvector 後端與多個 LLM
  agent（Career/Finance/Health/Research/Reflection）是**長期方向、非目前
  範疇**，屬於架構等級的重大變更，動工前必須先有獨立的 SPEC.md 項目與使用者
  確認，不可以在一般功能 PR 中順手做。

---

## 2. 測試與驗證的原則

### 2.1 現況

`lib/pure.js` 的純函式有 Vitest 單元測試（`lib/pure.test.js`），並有 ESLint
（flat config，`eslint.config.mjs`）做基本靜態檢查；`.github/workflows/ci.yml`
在每個 PR 上自動跑 `npm run lint` + `npm test`。**但 `app.js` 裡的渲染／互動
邏輯（DOM 操作、`localStorage`、modal 表單）完全沒有自動化測試**，這部分仍然
靠瀏覽器手動操作驗證：

```bash
npm install        # 第一次或 package.json 變動後執行
npm test            # Vitest，跑 lib/pure.js 的單元測試
npm run lint         # ESLint

# 手動驗證 app.js 的 DOM/互動邏輯（擇一開啟頁面）：
# 1. 直接雙擊開啟 index.html
# 2. 或起一個本機伺服器：
python -m http.server 8080
# 開啟 http://localhost:8080
```

### 2.2 每次 commit / PR 前必須確認

```
□ npm test 通過（lib/pure.js 的單元測試）
□ npm run lint 通過（0 error；warning 需說明或修掉）
□ 開啟瀏覽器 Console，操作過程中沒有出現任何錯誤訊息
□ 五個視圖（今日狀態／目標系統／事件記憶／決策工作台／行動引擎）都能正常切換與渲染
□ 新增目標／記錄事件／新增行動／編輯決策設定檔，四個 modal 都能正常送出並即時反映在畫面上
□ 「分析選項」功能：輸入問題後能產生三個選項排序，且會自動加入一筆 90 天驗證行動
□ 匯出資料／匯入資料（含匯入格式錯誤的檔案，確認有 alert 提示而不是整頁壞掉）
□ 重設示範資料後，畫面確實回到 seed 內容
□ 縮小視窗到手機寬度（<560px），版面（側邊欄、卡片排版）沒有破版
□ light 環境下文字對比、按鈕可讀性正常（目前只有單一淺色主題，無 dark mode）
```

### 2.3 補測試的原則

- `lib/pure.js` 裡的函式（輸入輸出明確、無副作用）**新增或修改時必須同步補
  `lib/pure.test.js`**，含邊界值（0、負數、NaN、空字串、找不到對應資料等）。
- 純函式如果會被 `app.js` 用到，優先放進 `lib/pure.js` 讓它可以被測試，不要
  寫回 `app.js`（見 1.2）。
- `app.js` 裡真的離不開 DOM／`localStorage` 的邏輯，目前沒有自動化測試框架
  覆蓋，改動這類邏輯時**至少要照 2.2 的清單手動驗證邊界情況**（例如空清單、
  唯一一筆資料被刪除後的畫面）。之後若要幫這塊補瀏覽器層級的測試（例如
  Playwright），是新的技術債項目，需要先在 SPEC.md 開項目確認範圍。

---

## 3. 開發流程原則（Branch → Commit → PR）

### 3.0 完整開發流程（必須遵守）

```
1. 確認目前在 main，且 main 是最新的
   git checkout main && git pull

2. 從 main 建立新 branch（命名規則見下方）
   git checkout -b <type>/<scope>-<簡述>

3. 在 branch 上開發，分批 commit（每個 commit 一件事）

4. 開發完畢，執行自我 review（見 3.5），文件同步（Step 2.5）必須在同一 branch 補 commit

5. 建立 PR，並等待 review 後 merge

6. 若 PR 開啟後有追加 commit，同步更新 PR title / description
```

**Branch 命名規則：**

| Prefix      | 用途                     | 範例                              |
| ----------- | ------------------------ | ---------------------------------- |
| `feat/`     | 新功能（新視圖/新互動）   | `feat/goal-edit-delete`            |
| `fix/`      | Bug 修正                  | `fix/score-divide-by-zero`         |
| `refactor/` | 重構（不影響行為）        | `refactor/split-render-functions`  |
| `docs/`     | 文件更新                  | `docs/bootstrap-spec-agents`       |
| `chore/`    | 部署、CI/CD、工具雜務     | `chore/deploy-workflow-tweak`      |

> ⚠️ **這個 repo 的 `main` 一 push 就會透過 GitHub Actions 自動部署到 GitHub
> Pages**（`.github/workflows/deploy.yml`），**沒有 staging 環境**——merge 等於
> 上線。`.github/workflows/ci.yml` 會在每個 PR 上跑 `lib/pure.js` 的單元測試與
> lint，但 `app.js` 的 DOM／互動邏輯不在覆蓋範圍內，PR 前的自我 review（3.5）
> 與手動驗證清單（2.2）仍然是這部分的唯一安全網，不可以跳過。
>
> ⚠️ **PR 一律開向 `main`**。若發現 `main` 上沒有你預期的最新內容，先
> `git fetch origin main` 確認，再從 `origin/main` 重新分支。

### 3.5 PR 建立前的自我 Review 流程

#### Step 1：確認 diff 範圍合理

```bash
git fetch origin main
git diff origin/main...HEAD --stat
git diff origin/main...HEAD
```

#### Step 2：逐項清單檢查

```
□ 所有改動都是本次需求的範疇，沒有夾帶不相關的修改
□ 沒有 console.log 除錯碼遺留
□ 新的使用者輸入欄位有經過 esc()／數字轉型（見 1.3）
□ npm test / npm run lint 通過，且已依 2.2 清單手動驗證過
□ SPEC.md 狀態已同步更新
```

#### Step 2.5：文件同步檢查（每次 PR 必做）

> ⛔ **硬性門檻**：`.md` 更新必須 commit 在**同一個 branch**，與功能程式碼
> 一起進 PR，不可以「先開 PR、事後再補文件」。

| 檔案 | 每次功能 PR 應確認的事項 |
|------|------------------------|
| **SPEC.md** | 對應功能項目是否已標記 `[x]`；有新需求是否已補規格 |
| **README.md** | 功能列表、使用方式、隱私與限制是否反映新變更 |
| **AGENTS.md** | 若有新的開發規範、架構決策（例如導入 build 工具/後端），是否已補充 |

**判斷要不要更新的原則：**

- 新增視圖或資料類型（例如新增一個生活面向以外的模組）→ **README 必更新**
- 引入任何 build 工具、後端、外部 API → **README + AGENTS.md 必更新**（屬於
  架構等級變更）
- 功能完成 → **SPEC.md 必標 `[x]`**
- 只是內部重構或 bug fix（使用者感知不到）→ .md 可不更新，但 commit message
  要說明

#### Step 3：針對這次 PR 的風險評估

自問，任一題不確定就要補說明或先跟使用者確認：

1. 這個改動會不會讓 `score()`/`analyze()` 在某些邊界值下算出 `NaN` 或
   `Infinity`（例如 `effort=0`）？
2. 新的使用者輸入是否都經過 `esc()` 才塞進 `innerHTML`？
3. 這個改動會不會讓現有 localStorage 資料在載入時壞掉（例如改變欄位結構但
   沒有處理舊資料相容性）？

#### Step 4：撰寫 PR 描述

```markdown
## Summary
- 做了什麼（列點）、為什麼

## Test plan
- [ ] npm test / npm run lint 通過
- [ ] 依 2.2 清單手動驗證（列出實際驗證過的項目）

## 已知風險 / 後續待辦
（沒有就寫「無」）
```

---

## 4. Commit 的原則

### 4.1 Commit 時機

- 一個 commit 只做一件事。
- 不 commit 未完成的半成品（除非用 `WIP:` 前綴明確標示）。

### 4.2 Commit Message 格式（Conventional Commits）

```
<type>(<scope>): <簡短說明>

[選填] 較詳細的說明，說明「為什麼」而非「做了什麼」
```

**type 清單：**

| type       | 用途                                   |
| ---------- | -------------------------------------- |
| `feat`     | 新功能（新視圖、新互動）                |
| `fix`      | 修 bug                                 |
| `refactor` | 重構（不影響行為）                      |
| `docs`     | 文件更新（README、SPEC.md、AGENTS.md）  |
| `chore`    | 部署、CI/CD 等雜務                      |

**scope 範例：** `goals`、`events`、`decision`、`actions`、`profile`、`ui`、`deploy`

```bash
# 範例
feat(actions): 支援編輯與刪除既有行動
fix(decision): 修正 effort=0 時分數計算除以零
docs(spec): 標記目標編輯/刪除功能為已完成
chore(deploy): 調整 GitHub Pages 部署 workflow
```

### 4.3 commit 前檢查清單

```
□ npm test / npm run lint 通過
□ 已依 2.2 清單手動驗證
□ 沒有 console.log 除錯碼遺留
□ 使用者輸入字串已用 esc() 處理，數字欄位已轉型
□ SPEC.md 對應功能狀態已更新
□ README 已在本 branch 更新（見 3.5 Step 2.5）
```

### 4.4 不應該 commit 的東西

- `node_modules/`、`.env` 等（已在 `.gitignore`）
- 任何暫時的測試用 `console.log`

---

## 5. 判讀與更新 SPEC.md 的原則

### 5.1 SPEC.md 的用途

`SPEC.md` 是本系統的**功能規格書與路線圖**，決定下一步做什麼、什麼不做。

### 5.2 優先級判讀規則

| 優先級 | 意義                                         | 開發原則                     |
| ------ | -------------------------------------------- | ----------------------------- |
| P0     | 資料正確性 / 資料遺失風險，缺少會誤導或坑使用者 | **必須最先處理**，不可跳過   |
| P1     | 核心價值：完整的目標/事件/行動 CRUD 與決策體驗 | P0 完成後立即實作            |
| P2     | 進階體驗（篩選、排序、搜尋、提醒）             | P1 穩定後排入                |
| P3     | 長期使用價值（歷史紀錄、決策回顧統計）         | 有餘力再做                   |
| P4+    | 架構等級變更（後端、LLM agent、雲端同步）      | 評估成本與範圍後再決定       |

**禁止跳著做**：不可因為某個低優先級功能「比較有趣」就跳過高優先級項目。

### 5.3 標記功能狀態

```
- [ ] 待開發
- [x] 已完成
- [~] 進行中（partial / WIP）
- [-] 已決定不做（附理由）
```

每次功能完成，commit message 加入 `docs(spec): 標記 <項目> 為已完成`。

### 5.4 新增功能到 SPEC.md 的格式

```markdown
#### N. 功能名稱 `[ ]`

**背景**：為什麼需要（使用者痛點 / 資料缺口）
**功能規格**：
- 具體要做什麼（條列）
- 涉及的檔案/模組
**優先級理由**：為什麼是這個優先級
```

### 5.5 判讀「做還是不做」

1. **是否修正資料遺失或誤導性計算（例如除以零、NaN）？** → 是，立即評估，可
   插隊到 P0
2. **是否補齊現有功能明顯缺角的 CRUD（例如目前只能新增不能刪除/編輯）？**
   → 是，優先排入 P1
3. **是否只是體驗優化（排序、篩選、視覺調整）？** → 排入 P2/P3
4. **是否需要引入後端、資料庫或外部 API？** → 記錄在 SPEC.md P4+，先不做，
   且動工前必須跟使用者確認架構變更的範圍

---

## 附錄：專案技術棧速查

```
網站框架：無（Vanilla HTML5 + CSS3 + ES6 JavaScript，無 build step；
         index.html/app.js/styles.css/lib/pure.js 可直接雙擊開啟）
狀態管理：單一全域物件 data，持久化於 localStorage（key: pdos-v1）
純函式層：lib/pure.js（UMD 包裝，同時支援瀏覽器全域與 Node/Vitest import）
開發工具：npm/package.json（僅供測試與 lint，不影響網站本身怎麼載入）
測試：Vitest（lib/pure.test.js，只測 lib/pure.js 的純函式；app.js 的 DOM/
     互動邏輯仍靠手動驗證，見 2.2 清單）
Lint：ESLint 9（flat config，eslint.config.mjs）
CI/CD：GitHub Actions
  - .github/workflows/ci.yml：PR 上跑 npm run lint + npm test
  - .github/workflows/deploy.yml：push 到 main 即自動部署 GitHub Pages
部署：GitHub Pages（無 staging，merge 到 main 等於上線）
```

## 附錄：常用指令

```bash
# 本機開發（擇一開啟頁面）
# 1. 直接用瀏覽器開啟 index.html
# 2. 或起一個本機伺服器：
python -m http.server 8080
# 開啟 http://localhost:8080

# 測試與 lint
npm install
npm test
npm run lint

# 部署
git push origin main   # 觸發 GitHub Actions 自動部署到 GitHub Pages
```
