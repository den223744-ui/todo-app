import { describe, expect, it } from 'vitest';

import { makeTask } from '../test/makeTask';

import {
  addTag,
  editDueDate,
  editDueTime,
  editNotes,
  editPriority,
  editTitle,
  removeTag,
  subtasksOf,
} from './taskEdit';

const task = makeTask({
  id: 't',
  title: 'Купить молоко',
  notes: 'Обезжиренное',
  priority: 1,
  due_date: '2026-11-09',
  due_time: '18:00:00',
  tags: ['дом'],
});

describe('editTitle', () => {
  it('trims and patches a new title', () => {
    expect(editTitle(task, '  Купить хлеб ')).toEqual({
      kind: 'patch',
      patch: { title: 'Купить хлеб' },
    });
  });

  it('sends nothing when only whitespace changed', () => {
    expect(editTitle(task, ' Купить молоко  ')).toEqual({ kind: 'unchanged' });
  });

  it('rejects an empty title', () => {
    expect(editTitle(task, '   ')).toEqual({ kind: 'invalid', issue: 'title-required' });
  });

  it('allows 500 characters (code points), rejects 501', () => {
    expect(editTitle(task, '😀'.repeat(500)).kind).toBe('patch');
    expect(editTitle(task, 'я'.repeat(501))).toEqual({ kind: 'invalid', issue: 'title-too-long' });
  });
});

describe('editNotes', () => {
  it('patches new notes as typed (inner whitespace kept)', () => {
    expect(editNotes(task, 'Две\nпачки ')).toEqual({
      kind: 'patch',
      patch: { notes: 'Две\nпачки ' },
    });
  });

  it('stores blank notes as none', () => {
    expect(editNotes(task, '  \n ')).toEqual({ kind: 'patch', patch: { notes: null } });
    expect(editNotes({ ...task, notes: null }, '')).toEqual({ kind: 'unchanged' });
  });

  it('sends nothing for the same notes', () => {
    expect(editNotes(task, 'Обезжиренное')).toEqual({ kind: 'unchanged' });
  });

  it('rejects notes over 10 000 characters', () => {
    expect(editNotes(task, 'я'.repeat(10_001))).toEqual({
      kind: 'invalid',
      issue: 'notes-too-long',
    });
  });
});

describe('editPriority', () => {
  it('patches a different priority only', () => {
    expect(editPriority(task, 3)).toEqual({ kind: 'patch', patch: { priority: 3 } });
    expect(editPriority(task, 1)).toEqual({ kind: 'unchanged' });
  });
});

describe('due date and time', () => {
  it('sets and clears the date', () => {
    expect(editDueDate(task, '2026-12-01')).toEqual({
      kind: 'patch',
      patch: { due_date: '2026-12-01' },
    });
    expect(editDueDate(task, '')).toEqual({ kind: 'patch', patch: { due_date: null } });
    expect(editDueDate(task, '2026-11-09')).toEqual({ kind: 'unchanged' });
  });

  it('sets the time in the server form and clears it', () => {
    expect(editDueTime(task, '09:30')).toEqual({ kind: 'patch', patch: { due_time: '09:30:00' } });
    expect(editDueTime(task, '18:00')).toEqual({ kind: 'unchanged' });
    expect(editDueTime(task, '')).toEqual({ kind: 'patch', patch: { due_time: null } });
  });

  it('needs a date for a time', () => {
    const undated = { ...task, due_date: null, due_time: null };
    expect(editDueTime(undated, '09:30')).toEqual({ kind: 'invalid', issue: 'time-needs-date' });
    expect(editDueTime(undated, '')).toEqual({ kind: 'unchanged' });
  });
});

describe('tags', () => {
  it('adds a normalized new tag', () => {
    expect(addTag(task, ' #Работа ')).toEqual({
      kind: 'patch',
      patch: { tags: ['дом', 'работа'] },
    });
  });

  it('ignores empty and duplicate tags', () => {
    expect(addTag(task, ' # ')).toEqual({ kind: 'unchanged' });
    expect(addTag(task, '#ДОМ')).toEqual({ kind: 'unchanged' });
  });

  it('enforces the API limits', () => {
    expect(addTag(task, 'я'.repeat(51))).toEqual({ kind: 'invalid', issue: 'tag-too-long' });
    expect(addTag(task, 'я'.repeat(50)).kind).toBe('patch');
    const full = { ...task, tags: Array.from({ length: 20 }, (_, i) => `t${String(i)}`) };
    expect(addTag(full, 'ещё')).toEqual({ kind: 'invalid', issue: 'too-many-tags' });
  });

  it('removes a tag', () => {
    expect(removeTag(task, 'дом')).toEqual({ kind: 'patch', patch: { tags: [] } });
    expect(removeTag(task, 'нет')).toEqual({ kind: 'unchanged' });
  });
});

describe('subtasksOf', () => {
  it('returns the subtasks of one parent in manual order', () => {
    const tasks = [
      makeTask({ id: 'b', parent_id: 'p', position: 2 }),
      makeTask({ id: 'x', parent_id: 'other' }),
      makeTask({ id: 'a2', parent_id: 'p', position: 1, created_at: '2026-11-08T11:00:00Z' }),
      makeTask({ id: 'a1', parent_id: 'p', position: 1, created_at: '2026-11-08T10:00:00Z' }),
      makeTask({ id: 'p' }),
    ];

    expect(subtasksOf(tasks, 'p').map((t) => t.id)).toEqual(['a1', 'a2', 'b']);
    expect(subtasksOf(tasks, 'none')).toEqual([]);
  });
});
