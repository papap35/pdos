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

  return { score, esc, formatDate, isValidData, migrateActionGoals };
});
