(function (root, factory) {
  const exported = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = exported;
  }
  Object.assign(root, exported);
})(typeof window !== 'undefined' ? window : globalThis, function () {
  function score(a) { return Math.round((a.impact * a.alignment * a.urgency) / Math.max(a.effort, 1)) }

  function esc(s = '') { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])) }

  function formatDate(d) { return new Intl.DateTimeFormat('zh-TW', { month: 'short', day: 'numeric' }).format(new Date(d)) }

  function isValidData(d) {
    if (!d || typeof d !== 'object') return false;
    if (!d.profile || typeof d.profile !== 'object' || !Array.isArray(d.profile.values)) return false;
    const w = d.profile.weights;
    if (!w || typeof w !== 'object' || !['career', 'finance', 'life', 'freedom'].every(k => Number.isFinite(w[k]))) return false;
    if (!Array.isArray(d.goals) || !d.goals.every(g => g && typeof g.title === 'string' && typeof g.category === 'string' && Number.isFinite(+g.priority))) return false;
    if (!Array.isArray(d.events) || !d.events.every(x => x && typeof x.title === 'string' && typeof x.type === 'string' && Number.isFinite(+x.impact) && Number.isFinite(+x.relevance) && Number.isFinite(+x.unique))) return false;
    if (!Array.isArray(d.actions) || !d.actions.every(a => a && typeof a.title === 'string' && Number.isFinite(+a.impact) && Number.isFinite(+a.alignment) && Number.isFinite(+a.urgency) && Number.isFinite(+a.effort))) return false;
    if (d.decisions != null && (!Array.isArray(d.decisions) || !d.decisions.every(x => x && typeof x.question === 'string' && typeof x.recommended === 'string'))) return false;
    return true;
  }

  function migrateActionGoals(d) {
    d.actions = (d.actions || []).map(a => {
      if (a.goalId != null) return a;
      if (a.goal != null) {
        const g = (d.goals || []).find(x => x.title === a.goal);
        const { goal, ...rest } = a;
        return { ...rest, goalId: g ? g.id : null };
      }
      return a;
    });
  }

  function buildReflectionPrompt(d) {
    const goalTitle = (goalId) => (d.goals.find(g => g.id === goalId) || {}).title || '（目標已刪除）';
    const goals = d.goals.map(g => `- ${g.title}（${g.category}，優先度${g.priority}，進度${g.progress}%，期限${g.deadline}）`).join('\n') || '（無）';
    const events = [...d.events].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 10)
      .map(e => `- [${e.date}] ${e.title}：${e.note}`).join('\n') || '（無）';
    const actions = d.actions.filter(a => !a.done)
      .map(a => `- ${a.title}（對應：${goalTitle(a.goalId)}）`).join('\n') || '（無）';
    const decisions = [...(d.decisions || [])].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5)
      .map(dc => `- [${dc.date}] ${dc.question} → 建議：${dc.recommended}`).join('\n') || '（無）';
    return `你是使用者的個人決策反思教練。請根據以下資料，給一段簡短（3–5 句、不超過 120 字）的中文反思提醒，指出一個值得使用者注意的模式或風險，並提出一個具體的下一步驗證方式。不要條列，寫成一段自然的文字。

目標：
${goals}

近期事件：
${events}

未完成行動：
${actions}

近期決策：
${decisions}`;
  }

  return { score, esc, formatDate, isValidData, migrateActionGoals, buildReflectionPrompt };
});
