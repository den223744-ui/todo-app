/// <reference lib="dom" />
import { expect, test, type Page } from '@playwright/test';

import type { TaskCreate, TaskRead, TaskUpdate } from '../src/api/schema';
import { makeList } from '../src/test/makeList';
import { makeTask } from '../src/test/makeTask';

test.use({ timezoneId: 'Europe/Istanbul' });
const now = new Date('2026-11-09T12:00:00+03:00');
const work = makeList({ id: 'work', name: 'Работа' });

/** Isolated workspace: every API request stays inside this fixture. */
async function mockWorkspace(
  page: Page,
  initial: TaskRead[] = [],
  beforeCreate?: () => Promise<void>,
) {
  let tasks = [...initial];
  await page.route('**/api/lists', (route) => route.fulfill({ json: [work] }));
  await page.route('**/api/tasks**', async (route) => {
    const request = route.request();
    const id = new URL(request.url()).pathname.split('/')[3];
    if (request.method() === 'GET') {
      await route.fulfill({ json: tasks });
    } else if (request.method() === 'POST') {
      const body = request.postDataJSON() as TaskCreate;
      if (beforeCreate) await beforeCreate();
      const created = makeTask({
        ...body,
        id: `saved-${String(tasks.length)}`,
        title: body.title,
        position: tasks.length + 1,
      });
      tasks.push(created);
      await route.fulfill({ status: 201, json: created });
    } else if (request.method() === 'PATCH') {
      const { completed, ...fields } = request.postDataJSON() as TaskUpdate;
      tasks = tasks.map((task) =>
        task.id === id
          ? {
              ...task,
              ...fields,
              ...(completed === undefined
                ? {}
                : { completed_at: completed ? now.toISOString() : null }),
            }
          : task,
      );
      await route.fulfill({ json: tasks.find((task) => task.id === id) });
    } else {
      throw new Error(`Unexpected fixture request: ${request.method()} ${request.url()}`);
    }
  });
}

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: now });
});

test('global search finds overdue, undated, completed and parents from Upcoming; clearing restores the view', async ({
  page,
}, testInfo) => {
  await mockWorkspace(page, [
    makeTask({
      id: 'late',
      title: 'Отчёт просроченный',
      due_date: '2026-11-08',
      list_id: 'work',
      tags: ['работа'],
    }),
    makeTask({ id: 'parent', title: 'Родитель' }),
    makeTask({ id: 'child', title: 'Отчёт подзадачи', parent_id: 'parent' }),
    makeTask({
      id: 'future',
      title: 'Отчёт будущий',
      due_date: '2026-11-13',
      due_time: '09:00:00',
    }),
    makeTask({ id: 'done', title: 'Отчёт готовый', completed_at: now.toISOString() }),
  ]);
  await page.goto('/?list=upcoming');
  const main = page.getByRole('main');
  const search = page.getByRole('searchbox');
  await expect(search).toHaveAttribute('placeholder', 'Поиск по всем задачам');
  await search.fill('отчёт');
  await expect(main.getByRole('heading', { level: 2 })).toHaveText(['Найдено', 'Выполненные']);
  const active = main.getByRole('region', { name: 'Найдено' });
  await expect(active.locator('[data-task-link]')).toHaveCount(3);
  expect(
    await active
      .locator('[data-task-link]')
      .evaluateAll((links) => links.map((link) => link.getAttribute('data-task-link'))),
  ).toEqual(['late', 'future', 'parent']);
  await expect(active.getByRole('link', { name: /Отчёт просроченный/ })).toContainText('#работа');
  await expect(
    main.getByRole('region', { name: 'Выполненные' }).getByRole('checkbox'),
  ).toBeChecked();
  await expect(main.getByRole('link', { name: /Отчёт подзадачи/ })).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath('global-search-desktop.png'), fullPage: true });
  await page.reload();
  await expect(main.getByRole('heading', { level: 2 })).toHaveText(['Найдено', 'Выполненные']);
  await search.fill('отсутствует');
  await expect(main.getByText('Ничего не найдено', { exact: true })).toBeVisible();
  await search.press('Escape');
  await expect(page).toHaveURL(/list=upcoming$/);
  await expect(main.locator('[data-task-link]')).toHaveCount(1);
  await expect(main.locator('[data-task-link]')).toHaveAttribute('data-task-link', 'future');
});

test('search leaves the day statistics and timeline intact', async ({ page }) => {
  await mockWorkspace(page, [
    makeTask({ id: 'today', title: 'Встреча', due_date: '2026-11-09', due_time: '10:00:00' }),
    makeTask({ id: 'other', title: 'Заметка' }),
  ]);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  const stats = page.getByRole('region', { name: 'Итоги дня' });
  const timeline = page.getByRole('region', { name: 'Таймлайн дня' });
  await expect(timeline.getByRole('button', { name: /Встреча/ })).toBeVisible();
  const before = await stats.textContent();
  await page.getByRole('searchbox').fill('заметка');
  expect(await stats.textContent()).toBe(before);
  await expect(timeline.getByRole('button', { name: /Встреча/ })).toBeVisible();
  await expect(page.getByRole('main').locator('[data-task-link]')).toHaveAttribute(
    'data-task-link',
    'other',
  );
});

test('quick add shows the hidden destination and opens the task from its toast on mobile', async ({
  page,
}, testInfo) => {
  await mockWorkspace(page);
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');
  const input = page.getByRole('textbox', { name: 'Новая задача' });
  await input.fill('Заплатить за квартиру в пятницу');
  await input.press('Enter');
  const toasts = page.getByRole('region', { name: 'Уведомления' });
  await expect(toasts).toContainText('Добавлено в «Предстоящие», пт, 13 нояб.');
  await expect(input).toHaveValue('');
  await expect(input).toBeFocused();
  const button = toasts.getByRole('button', { name: 'Показать' });
  await expect(button).toBeVisible();
  const box = await button.boundingBox();
  expect(box).not.toBeNull();
  if (box) {
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(375);
  }
  await page.screenshot({
    path: testInfo.outputPath('quick-add-toast-mobile.png'),
    fullPage: true,
  });
  await button.click();
  await expect(page).toHaveURL(/list=upcoming&task=saved-0$/);
  await expect(page.getByRole('dialog', { name: 'Детали задачи' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Название', exact: true })).toHaveValue(
    'Заплатить за квартиру',
  );
  await expect(toasts.getByRole('button', { name: 'Показать' })).toHaveCount(0);
});

test('quick add to a visible user list names it and the plain toast lasts four seconds', async ({
  page,
}) => {
  await mockWorkspace(page);
  await page.goto('/?listId=work');
  const input = page.getByRole('textbox', { name: 'Новая задача' });
  await input.fill('Отчёт');
  await input.press('Enter');
  const message = page.getByText('Добавлено в «Работа»', { exact: true });
  await expect(message).toBeVisible();
  await expect(page.getByRole('button', { name: 'Показать' })).toHaveCount(0);
  await page.clock.runFor(4_000);
  await expect(message).toHaveCount(0);
});

test('quick add toast opens an overdue task on Today', async ({ page }) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await mockWorkspace(page, [], () => gate);
  // The parser deliberately rolls past dd.mm dates to next year. Use the actual
  // past-day context, then leave it while the save is pending.
  await page.goto('/?day=2026-11-08');
  await page.getByRole('textbox', { name: 'Новая задача' }).fill('Отчёт');
  await page.getByRole('textbox', { name: 'Новая задача' }).press('Enter');
  await page.getByRole('link', { name: /^Входящие/ }).click();
  release();
  await expect(page.getByRole('region', { name: 'Уведомления' })).toContainText(
    'Добавлено в «Сегодня», вс, 8 нояб.',
  );
  await page.getByRole('button', { name: 'Показать' }).click();
  await expect(page).toHaveURL(/\?task=saved-0$/); // overdue: opened on Today itself
  await expect(page.getByRole('complementary', { name: 'Детали задачи' })).toBeVisible();
  await expect(page.getByRole('main').getByRole('heading', { level: 1 })).toContainText('Сегодня');
});

for (const reducedMotion of ['no-preference', 'reduce'] as const) {
  for (const day of ['2026-11-09', '2026-11-13']) {
    test(`completion moves to the end of each group, focuses its neighbour and keeps Undo (${day}, ${reducedMotion})`, async ({
      page,
    }) => {
      const tasks = [
        makeTask({
          id: 'done-a',
          title: 'Готовая A',
          position: 0,
          due_date: day,
          list_id: 'work',
          completed_at: now.toISOString(),
        }),
        makeTask({
          id: 'open-a',
          title: 'Активная A',
          position: 1,
          due_date: day,
          list_id: 'work',
        }),
        makeTask({
          id: 'done-b',
          title: 'Готовая B',
          position: 2,
          due_date: day,
          list_id: 'work',
          completed_at: now.toISOString(),
        }),
        makeTask({
          id: 'open-b',
          title: 'Активная B',
          position: 3,
          due_date: day,
          list_id: 'work',
        }),
        makeTask({
          id: 'loose-done',
          title: 'Готовая без списка',
          position: 0,
          due_date: day,
          completed_at: now.toISOString(),
        }),
        makeTask({ id: 'loose-open', title: 'Активная без списка', position: 1, due_date: day }),
      ];
      await mockWorkspace(page, tasks);
      await page.emulateMedia({ reducedMotion });
      await page.goto(day === '2026-11-09' ? '/' : `/?day=${day}`);
      const main = page.getByRole('main');
      const group = main.getByRole('region', { name: 'Работа', exact: true });
      const ids = () =>
        group
          .locator('[data-task-link]')
          .evaluateAll((links) => links.map((link) => link.getAttribute('data-task-link')));
      await expect(group.locator('[data-task-link]')).toHaveCount(4);
      expect(await ids()).toEqual(['open-a', 'open-b', 'done-a', 'done-b']);
      const loose = main.getByRole('region', { name: 'Без списка', exact: true });
      await expect(loose.getByRole('checkbox').first()).not.toBeChecked();
      await expect(loose.getByRole('checkbox').last()).toBeChecked();
      const row = group.locator('li').filter({ has: page.locator('[data-task-link="open-a"]') });
      const checkbox = row.getByRole('checkbox');
      await row.evaluate((element) => {
        element.setAttribute('data-kept', 'yes');
      });
      await checkbox.click();
      await expect(checkbox).toBeChecked();
      expect(await ids()).toEqual(['open-b', 'done-a', 'open-a', 'done-b']);
      await expect(group.locator('[data-task-link="open-b"]')).toBeFocused();
      await expect(row).toHaveAttribute('data-kept', 'yes');
      await page.clock.runFor(32);
      if (reducedMotion === 'reduce') await expect(row).toHaveCSS('transform', 'none');
      await page.clock.runFor(500);
      // Real final geometry: no overlapping rows after layout animation.
      const boxes = await group.locator('li').evaluateAll((rows) =>
        rows.map((element) => {
          const rect = element.getBoundingClientRect();
          return { top: rect.top, bottom: rect.bottom };
        }),
      );
      for (let index = 1; index < boxes.length; index++) {
        expect(boxes[index]?.top).toBeGreaterThanOrEqual(boxes[index - 1]?.bottom ?? 0);
      }
      await page.keyboard.press('Control+z');
      await expect(checkbox).not.toBeChecked();
      expect(await ids()).toEqual(['open-a', 'open-b', 'done-a', 'done-b']);
      await expect(group.locator('[data-task-link="open-b"]')).toBeFocused();
    });
  }
}
