import { describe, expect, it } from 'vitest';

import { makeList } from '../test/makeList';
import { makeTask } from '../test/makeTask';
import { quickAddFeedback } from './quickAddFeedback';
import { DEFAULT_LOCATION, type AppLocation } from './view';

const now = new Date(2026, 10, 9, 12);
const work = makeList({ id: 'work', name: 'Работа' });
const inbox: AppLocation = { ...DEFAULT_LOCATION, view: { kind: 'list', list: 'inbox' } };

describe('quickAddFeedback', () => {
  it.each([
    [null, 'inbox', null, null],
    ['2026-11-09', 'today', null, null],
    ['2026-11-08', 'today', 'вс, 8 нояб.', null], // overdue: shown on Today itself
    ['2026-11-13', 'upcoming', 'пт, 13 нояб.', null],
  ] as const)(
    'routes %s to %s, formatting only a date different from today',
    (date, section, dateLabel, day) => {
      const task = makeTask({ id: 'saved', due_date: date });
      const result = quickAddFeedback(task, [], inbox, now);
      expect(result).toMatchObject({
        section,
        listName: null,
        dateLabel,
        visible: date === null,
        destination: { view: { kind: 'list', list: section }, taskId: 'saved', query: '', day },
      });
    },
  );

  it('uses the local calendar date at midnight', () => {
    const task = makeTask({ id: 'saved', due_date: '2026-11-09' });
    expect(quickAddFeedback(task, [], inbox, new Date(2026, 10, 9, 0, 1)).section).toBe('today');
    expect(quickAddFeedback(task, [], inbox, new Date(2026, 10, 8, 23, 59)).section).toBe(
      'upcoming',
    );
  });

  it('names a known user list only when that exact list is open', () => {
    const task = makeTask({ id: 'saved', list_id: 'work', due_date: '2026-11-13' });
    const location: AppLocation = {
      ...DEFAULT_LOCATION,
      view: { kind: 'taskList', listId: 'work' },
    };
    expect(quickAddFeedback(task, [work], location, now)).toMatchObject({
      listName: 'Работа',
      visible: true,
      dateLabel: 'пт, 13 нояб.',
      destination: { view: location.view, day: null },
    });
    expect(quickAddFeedback(task, [work], inbox, now).listName).toBeNull();
    expect(
      quickAddFeedback(
        task,
        [work],
        { ...location, view: { kind: 'taskList', listId: 'home' } },
        now,
      ),
    ).toMatchObject({
      listName: null,
      visible: false,
      destination: { view: { kind: 'list', list: 'upcoming' } },
    });
    expect(quickAddFeedback(task, [], location, now).listName).toBeNull();
    // A date in the past in a user list does not navigate to Today or set ?day=.
    expect(
      quickAddFeedback({ ...task, due_date: '2026-11-08' }, [work], location, now).destination.day,
    ).toBeNull();
  });

  it.each<[Partial<AppLocation>, boolean]>([
    [{}, true],
    [{ day: '2026-11-08' }, false],
    [{ day: '2026-11-10' }, true],
    [{ view: { kind: 'list', list: 'upcoming' } }, true],
    [{ view: { kind: 'list', list: 'completed' } }, false],
    [{ view: { kind: 'tag', tag: 'дом' } }, true],
    [{ view: { kind: 'tag', tag: 'работа' } }, false],
    [{ query: 'молоко' }, true],
    [{ query: 'другое' }, false],
  ])(
    'checks actual visibility, including tomorrow, day, tag and global search: %j',
    (patch, visible) => {
      const task = makeTask({
        id: 'saved',
        title: 'Купить молоко',
        tags: ['дом'],
        due_date: '2026-11-10',
      });
      expect(quickAddFeedback(task, [], { ...DEFAULT_LOCATION, ...patch }, now).visible).toBe(
        visible,
      );
    },
  );
});
