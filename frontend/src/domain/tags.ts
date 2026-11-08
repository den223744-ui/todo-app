/**
 * Tag normalization, the same rule as the backend (app/schemas/task.py):
 * '#Дом', ' дом ', 'ДОМ' -> 'дом'; empty tags dropped; first occurrence wins.
 * Used for optimistic updates, so the task looks final before the server answers.
 */
export function normalizeTag(raw: string): string {
  return raw.trim().replace(/^#+/, '').trim().toLowerCase();
}

export function normalizeTags(tags: readonly string[]): string[] {
  const result: string[] = [];
  for (const raw of tags) {
    const tag = normalizeTag(raw);
    if (tag && !result.includes(tag)) {
      result.push(tag);
    }
  }
  return result;
}
