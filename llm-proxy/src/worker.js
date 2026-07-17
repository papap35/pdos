import Anthropic from '@anthropic-ai/sdk';

const MAX_PROMPT_CHARS = 8000;

export default {
  async fetch(request, env) {
    const corsHeaders = {
      'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN || '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Proxy-Secret',
    };

    if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
    if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405, corsHeaders);

    if (!env.PROXY_SECRET || request.headers.get('X-Proxy-Secret') !== env.PROXY_SECRET) {
      return json({ error: 'Unauthorized' }, 401, corsHeaders);
    }
    if (!env.ANTHROPIC_API_KEY) {
      return json({ error: 'Server misconfigured: ANTHROPIC_API_KEY not set' }, 500, corsHeaders);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: 'Invalid JSON body' }, 400, corsHeaders);
    }
    if (!body || typeof body.prompt !== 'string' || !body.prompt.trim()) {
      return json({ error: 'Missing "prompt" string in request body' }, 400, corsHeaders);
    }

    const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
    const model = env.ANTHROPIC_MODEL || 'claude-opus-4-8';

    try {
      const message = await client.messages.create({
        model,
        max_tokens: 512,
        messages: [{ role: 'user', content: body.prompt.slice(0, MAX_PROMPT_CHARS) }],
      });

      if (message.stop_reason === 'refusal') {
        return json({ error: 'AI 拒絕回應這個請求。' }, 502, corsHeaders);
      }

      const textBlock = message.content.find((b) => b.type === 'text');
      return json({ text: textBlock ? textBlock.text : '' }, 200, corsHeaders);
    } catch (err) {
      return json({ error: describeAnthropicError(err) }, mapStatus(err), corsHeaders);
    }
  },
};

function describeAnthropicError(err) {
  const status = err && err.status;
  if (status === 401 || status === 403) return 'LLM 服務金鑰設定錯誤，請聯絡管理者。';
  if (status === 429) return 'AI 服務目前請求過多，請稍後再試。';
  if (status === 529) return 'AI 服務暫時過載，請稍後再試。';
  if (typeof status === 'number' && status >= 500) return 'AI 服務暫時無法使用，請稍後再試。';
  return '呼叫 AI 服務時發生未預期的錯誤。';
}

function mapStatus(err) {
  // 429 is passed through so the front end can treat it as retryable; every
  // other upstream failure (including Anthropic auth errors caused by a
  // misconfigured server key) maps to 502 so it's never confused with this
  // worker's own 401 (wrong X-Proxy-Secret).
  return err && err.status === 429 ? 429 : 502;
}

function json(obj, status, headers) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}
