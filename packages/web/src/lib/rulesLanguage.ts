import { useSyncExternalStore } from 'react';

export type RulesLanguage = 'en' | 'es';

const KEY = 'go-lan:rules-language';
const listeners = new Set<() => void>();

let current: RulesLanguage = stored() ?? preferred();

/**
 * The rules are the one piece of text worth reading in your own language, so
 * they are translated while the rest of the app stays in English. The choice is
 * shared by every copy on screen and remembered for next time.
 */
export function useRulesLanguage(): RulesLanguage {
  return useSyncExternalStore(subscribe, () => current, () => current);
}

export function setRulesLanguage(language: RulesLanguage): void {
  if (language === current) return;

  current = language;
  localStorage.setItem(KEY, language);
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function stored(): RulesLanguage | null {
  const saved = localStorage.getItem(KEY);
  return saved === 'en' || saved === 'es' ? saved : null;
}

function preferred(): RulesLanguage {
  return navigator.languages.some((tag) => tag.toLowerCase().startsWith('es')) ? 'es' : 'en';
}
