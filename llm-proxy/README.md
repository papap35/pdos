# pdos-llm-proxy

一個最小的 [Cloudflare Worker](https://developers.cloudflare.com/workers/)，唯一的工作是幫
`pdos` 安全地轉發 Claude API 呼叫——因為 `pdos` 前端是部署在公開的 GitHub Pages 上，
Anthropic API 金鑰**絕對不能**放進前端程式碼（任何人都能從瀏覽器開發者工具看到並偷走）。

這個服務**沒有資料庫、沒有帳號系統**：單人自用，用一組你自己保管的「共用密鑰」擋掉
陌生人打這個 endpoint 消耗你的 Claude 額度，其餘什麼都不存。

## 部署前需要準備

1. 一個 [Cloudflare 帳號](https://dash.cloudflare.com/sign-up)（免費額度足夠個人使用）
2. 一組 [Anthropic API 金鑰](https://console.anthropic.com/settings/keys)
3. 自己想一組夠長、隨機的「共用密鑰」字串（例如用密碼產生器產生一組 32 字元字串）——
   這組密鑰同時要貼到 pdos 網頁的「AI 設定」裡

## 部署步驟

```bash
cd llm-proxy
npm install

# 登入 Cloudflare（會開瀏覽器做 OAuth，只需要做一次）
npx wrangler login

# 設定兩組 secret（分別互動輸入，值不會顯示在終端機/shell history）
npx wrangler secret put PROXY_SECRET
npx wrangler secret put ANTHROPIC_API_KEY

# 部署
npx wrangler deploy
```

部署成功後，終端機會印出這個 Worker 的網址，格式類似：

```
https://pdos-llm-proxy.<your-cloudflare-subdomain>.workers.dev
```

把這個網址，連同你剛剛設定的 `PROXY_SECRET`，貼到 pdos 網頁側邊欄的「AI 設定」裡。

## 選用設定

`wrangler.toml` 裡可以加一個 `[vars]` 區塊調整：

```toml
[vars]
ANTHROPIC_MODEL = "claude-opus-4-8"   # 預設就是這個，想換模型可以改這裡
ALLOWED_ORIGIN = "https://<你的帳號>.github.io"   # 限制 CORS 來源（預設 "*"，共用密鑰已經是主要防線，這項是額外的縱深防禦）
```

## 本機測試

```bash
# 建一個 .dev.vars 檔（不要 commit，已在 .gitignore）
cat > .dev.vars << 'EOF'
PROXY_SECRET=devsecret
ANTHROPIC_API_KEY=你的真實金鑰
EOF

npm run dev
# 另開一個終端機測試：
curl -X POST http://localhost:8787 \
  -H "Content-Type: application/json" \
  -H "X-Proxy-Secret: devsecret" \
  -d '{"prompt":"用一句話自我介紹"}'
```

## 費用

- Cloudflare Workers 免費額度：每天 100,000 次請求，個人使用完全夠用
- Claude API 依 [官方費率](https://platform.claude.com/docs/en/pricing) 按 token 計費，
  這個 proxy 本身不額外收費，只是單純轉發

## 這個服務做／不做的事

- ✅ 驗證 `X-Proxy-Secret` header，擋掉沒有密鑰的請求
- ✅ 把請求轉發到 Claude API（`ANTHROPIC_MODEL` 環境變數指定模型，預設 `claude-opus-4-8`）
- ✅ 把 Claude 的錯誤（金鑰錯誤、額度超過、服務過載）轉換成給前端看的中文訊息，不洩漏
  內部細節
- ❌ 不存任何請求或回應內容
- ❌ 不做使用者帳號／多租戶隔離（見專案根目錄 `SPEC.md` 7.2）
- ❌ 不做語意搜尋／向量檢索（見 `SPEC.md` 7.3，目前建議暫緩）
