import type { Priority } from '../shared/types.ts';

// Keyword triage for incoming submissions. Deliberately simple and explainable:
// the reason is stored and shown on the problem so a human can overrule it.
const RULES: { priority: Priority; words: string[] }[] = [
  {
    priority: 'urgent',
    words: ['fire', 'smoke', 'gas', 'exposed wire', 'electric shock', 'injur', 'bleeding', 'unconscious', 'fainted', 'assault', 'harass', 'following students', 'threat', 'weapon', 'unsafe', 'recklessly', 'stuck between floors', 'collapse', 'emergency'],
  },
  {
    priority: 'high',
    words: ['outage', 'no water', 'no internet', 'not connecting', 'power cut', 'leak', 'undercooked', 'felt sick', 'broken lock', 'lock is broken', 'brown', 'timing out', 'down across'],
  },
];

export function triage(title: string, body: string): { priority: Priority | null; reason: string | null } {
  const text = `${title} ${body}`.toLowerCase();
  for (const rule of RULES) {
    const word = rule.words.find((w) => text.includes(w));
    if (word) return { priority: rule.priority, reason: `Auto-flagged ${rule.priority}: mentions “${word}”` };
  }
  return { priority: null, reason: null };
}
