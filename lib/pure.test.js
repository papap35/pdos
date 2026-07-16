import { describe, it, expect } from 'vitest';
import { score, esc, formatDate, isValidData, migrateActionGoals } from './pure.js';

describe('score', () => {
  it('computes impact * alignment * urgency / effort, rounded', () => {
    expect(score({ impact: 8, alignment: 9, urgency: 8, effort: 2 })).toBe(288);
  });
  it('guards against divide-by-zero when effort is 0', () => {
    expect(score({ impact: 5, alignment: 5, urgency: 5, effort: 0 })).toBe(125);
  });
  it('guards against negative effort the same way as zero', () => {
    expect(score({ impact: 5, alignment: 5, urgency: 5, effort: -3 })).toBe(125);
  });
});

describe('esc', () => {
  it('escapes all five HTML-significant characters', () => {
    expect(esc(`<b>"a" & 'b'</b>`)).toBe('&lt;b&gt;&quot;a&quot; &amp; &#39;b&#39;&lt;/b&gt;');
  });
  it('defaults to an empty string for undefined input', () => {
    expect(esc(undefined)).toBe('');
  });
  it('coerces non-string input to a string first', () => {
    expect(esc(42)).toBe('42');
  });
});

describe('formatDate', () => {
  it('formats an ISO date string as zh-TW month/day', () => {
    expect(formatDate('2026-07-16')).toBe('7月16日');
  });
});

describe('isValidData', () => {
  const validBase = {
    profile: { values: [], weights: { career: 25, finance: 25, life: 25, freedom: 25 } },
    goals: [{ title: 'g', category: 'Career', priority: 50 }],
    events: [{ title: 'e', type: 'Career', impact: 1, relevance: 1, unique: 1 }],
    actions: [{ title: 'a', impact: 1, alignment: 1, urgency: 1, effort: 1 }],
  };

  it('accepts a well-formed object', () => {
    expect(isValidData(validBase)).toBe(true);
  });
  it('rejects null/non-object input', () => {
    expect(isValidData(null)).toBe(false);
    expect(isValidData('nope')).toBe(false);
  });
  it('rejects a missing profile.weights key', () => {
    const d = { ...validBase, profile: { values: [], weights: { career: 25, finance: 25, life: 25 } } };
    expect(isValidData(d)).toBe(false);
  });
  it('rejects a non-finite weight (NaN)', () => {
    const d = { ...validBase, profile: { values: [], weights: { career: NaN, finance: 25, life: 25, freedom: 25 } } };
    expect(isValidData(d)).toBe(false);
  });
  it('rejects goals that are not an array', () => {
    expect(isValidData({ ...validBase, goals: 'nope' })).toBe(false);
  });
  it('rejects a goal item missing a required field', () => {
    expect(isValidData({ ...validBase, goals: [{ title: 'no category or priority' }] })).toBe(false);
  });
  it('rejects an events item with a non-finite impact', () => {
    const d = { ...validBase, events: [{ title: 'e', type: 'Career', impact: 'x', relevance: 1, unique: 1 }] };
    expect(isValidData(d)).toBe(false);
  });
  it('treats a missing decisions field as valid (older backups predate it)', () => {
    expect(isValidData(validBase)).toBe(true);
  });
  it('accepts a well-formed decisions array', () => {
    const d = { ...validBase, decisions: [{ question: 'q', recommended: 'r' }] };
    expect(isValidData(d)).toBe(true);
  });
  it('rejects a decisions array with a malformed entry', () => {
    const d = { ...validBase, decisions: [{ question: 'q' }] };
    expect(isValidData(d)).toBe(false);
  });
});

describe('migrateActionGoals', () => {
  it('leaves an action with an existing goalId untouched', () => {
    const d = { goals: [{ id: 1, title: 'Goal' }], actions: [{ id: 9, goalId: 1 }] };
    migrateActionGoals(d);
    expect(d.actions[0].goalId).toBe(1);
  });
  it('converts a legacy "goal" title string to goalId by matching the current goals list', () => {
    const d = { goals: [{ id: 7, title: 'My Goal' }], actions: [{ id: 9, goal: 'My Goal' }] };
    migrateActionGoals(d);
    expect(d.actions[0]).toEqual({ id: 9, goalId: 7 });
    expect(d.actions[0]).not.toHaveProperty('goal');
  });
  it('sets goalId to null when the referenced goal title no longer exists', () => {
    const d = { goals: [{ id: 7, title: 'Other Goal' }], actions: [{ id: 9, goal: 'Deleted Goal' }] };
    migrateActionGoals(d);
    expect(d.actions[0].goalId).toBeNull();
  });
  it('passes through an action with neither goalId nor goal unchanged', () => {
    const d = { goals: [], actions: [{ id: 9, title: 'orphan-ish' }] };
    migrateActionGoals(d);
    expect(d.actions[0]).toEqual({ id: 9, title: 'orphan-ish' });
  });
});
