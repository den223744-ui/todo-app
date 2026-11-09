/// <reference lib="dom" />
import type { Page } from '@playwright/test';

import type { TaskCreate, TaskRead, TaskUpdate } from '../../src/api/schema';
import { makeList } from '../../src/test/makeList';
import { makeTask } from '../../src/test/makeTask';

export const NOW = new Date('2026-02-03T12:00:00Z');
export const TODAY = '2026-02-03';
export const TASKS = [
  makeTask({
    id: 'timed',
    title: 'Обсудить проект',
    due_date: TODAY,
    due_time: '14:00:00',
    duration_minutes: 45,
    list_id: 'work',
    tags: ['проект'],
    priority: 2,
  }),
  makeTask({ id: 'today', title: 'Спокойная прогулка', due_date: TODAY, position: 2 }),
  makeTask({ id: 'inbox', title: 'Разобрать записи', position: 3 }),
  makeTask({ id: 'next', title: 'Проверить почту', position: 4 }),
  makeTask({ id: 'child', title: 'Подготовить вопросы', parent_id: 'timed' }),
  makeTask({
    id: 'done',
    title: 'Выполненная задача',
    due_date: TODAY,
    completed_at: NOW.toISOString(),
    list_id: 'work',
    due_time: '15:00:00',
  }),
];

/** In-memory API only; these tests never write the user's workspace. */
export async function workspace(page: Page, initial: readonly TaskRead[] = TASKS) {
  let saved = [...initial];
  let deleted: TaskRead[] = [];
  let lists = [
    makeList({ id: 'work', name: 'Работа' }),
    makeList({ id: 'empty', name: 'Пустой список' }),
  ];
  let sequence = 0;
  let release: (() => void) | undefined;
  let createGate = Promise.resolve();
  await page.clock.setFixedTime(NOW); // Keep Query and Motion timers running.
  await page.route('**/api/lists**', async (route) => {
    if (route.request().method() === 'DELETE') {
      const id = new URL(route.request().url()).pathname.split('/')[3];
      lists = lists.filter((list) => list.id !== id);
      saved = saved.map((task) => (task.list_id === id ? { ...task, list_id: null } : task));
      await route.fulfill({ status: 204 });
    } else await route.fulfill({ json: lists });
  });
  await page.route('**/api/tasks**', async (route) => {
    const request = route.request();
    const parts = new URL(request.url()).pathname.split('/');
    const id = parts[3];
    if (request.method() === 'GET') {
      await route.fulfill({ json: saved });
      return;
    }
    if (request.method() === 'DELETE') {
      deleted = saved.filter((task) => task.id === id || task.parent_id === id);
      saved = saved.filter((task) => !deleted.includes(task));
      await route.fulfill({ status: 204 });
      return;
    }
    if (request.method() === 'POST') {
      if (parts[4] === 'restore') {
        saved.push(...deleted);
        await route.fulfill({ json: deleted.find((task) => task.id === id) });
        return;
      }
      await createGate;
      const input = request.postDataJSON() as TaskCreate;
      const created = makeTask({
        ...input,
        id: `created-${String(++sequence)}`,
        position: saved.length + 1,
      });
      saved.push(created);
      await route.fulfill({ status: 201, json: created });
      return;
    }
    if (request.method() === 'PATCH') {
      const { completed, ...patch } = request.postDataJSON() as TaskUpdate;
      saved = saved.map((task) =>
        task.id === id
          ? {
              ...task,
              ...patch,
              ...('due_date' in patch && patch.due_date === null ? { due_time: null } : {}),
              ...(completed === undefined
                ? {}
                : { completed_at: completed ? NOW.toISOString() : null }),
            }
          : task,
      );
      await route.fulfill({ json: saved.find((task) => task.id === id) });
      return;
    }
    throw new Error(`Unexpected request: ${request.method()}`);
  });
  return {
    tasks: () => saved,
    holdCreate: () => {
      createGate = new Promise<void>((resolve) => {
        release = resolve;
      });
    },
    releaseCreate: () => {
      release?.();
    },
  };
}
