/// <reference lib="dom" />
import { expect, test, type Page } from '@playwright/test';

import type { TaskCreate, TaskRead } from '../src/api/schema';
import { makeTask } from '../src/test/makeTask';

/** An isolated API fixture; no requests reach the user's dev database. */
async function mockTasks(page: Page, beforeCreate?: () => Promise<void>) {
  const tasks: TaskRead[] = [];
  const requests: TaskCreate[] = [];
  await page.route('**/api/tasks', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({ json: tasks });
      return;
    }
    const body = route.request().postDataJSON() as TaskCreate;
    requests.push(body);
    if (beforeCreate) await beforeCreate();
    const created = makeTask({
      id: `task-${String(tasks.length + 1)}`,
      title: body.title,
      priority: body.priority ?? 0,
      due_date: body.due_date ?? null,
      due_time: body.due_time ? `${body.due_time}:00` : null,
      tags: body.tags ?? [],
    });
    tasks.push(created);
    await route.fulfill({ status: 201, json: created });
  });
  return { tasks, requests };
}

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date(2026, 10, 8, 12) });
});

test('highlights literal tokens and creates the parsed task, fetched again after reload', async ({
  page,
}, testInfo) => {
  const { requests } = await mockTasks(page);
  await page.goto('/?list=inbox');
  const input = page.getByRole('textbox', { name: 'Новая задача' });
  await input.fill('Купить молоко завтра в 18:00 #дом !!');
  await expect(page.locator('mark')).toHaveText(['завтра', 'в 18:00', '#дом', '!!']);
  await page.clock.runFor(100);
  await page.screenshot({ path: testInfo.outputPath('quick-add-desktop.png'), fullPage: true });
  await input.press('Enter');
  await expect(input).toHaveValue('');
  expect(requests).toEqual([
    {
      title: 'Купить молоко',
      due_date: '2026-11-09',
      due_time: '18:00',
      tags: ['дом'],
      priority: 2,
    },
  ]);
  await expect(page.getByText('Задача добавлена.', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Предстоящие 1' }).click();
  await expect(page.getByRole('main').getByRole('link', { name: /Купить молоко/ })).toContainText(
    '18:00',
  );
  await page.reload();
  await expect(page.getByRole('main').getByRole('link', { name: /Купить молоко/ })).toContainText(
    'Средний приоритет',
  );
});

test('today supplies the date, shows the optimistic task and blocks repeated Enter', async ({
  page,
}) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const { requests } = await mockTasks(page, () => gate);
  await page.goto('/');
  const input = page.getByRole('textbox', { name: 'Новая задача' });
  await input.fill('Проверить отчёт');
  await input.press('Enter');
  await expect(page.getByRole('main').getByRole('link', { name: /Проверить отчёт/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Сохраняем…' })).toBeDisabled();
  await input.press('Enter');
  expect(requests).toHaveLength(1);
  expect(requests[0]?.due_date).toBe('2026-11-08');
  release();
  await expect(input).toHaveValue('');
  await expect(
    page.getByRole('main').getByRole('link', { name: /Проверить отчёт/ }),
  ).toHaveAttribute('href', '?task=task-1');
  await expect(input).toBeFocused();
});

test('tag context is merged with typed tags without duplicates', async ({ page }) => {
  const { requests } = await mockTasks(page);
  await page.goto('/?tag=дом');
  const input = page.getByRole('textbox', { name: 'Новая задача' });
  await input.fill('Купить хлеб #покупки #дом');
  await page.getByRole('button', { name: 'Добавить', exact: true }).click();
  await expect(input).toHaveValue('');
  expect(requests[0]).toMatchObject({
    title: 'Купить хлеб',
    due_date: null,
    tags: ['покупки', 'дом'],
  });
  await expect(page.getByRole('main').getByRole('link', { name: /Купить хлеб/ })).toBeVisible();
});

test('failed create retains the draft and retry creates one task', async ({ page }) => {
  const tasks: TaskRead[] = [];
  let attempts = 0;
  await page.route('**/api/tasks', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({ json: tasks });
    } else if (++attempts === 1) {
      await route.abort('failed');
    } else {
      tasks.push(
        makeTask({ id: 'saved', title: 'Купить хлеб', tags: ['дом'], due_date: '2026-11-08' }),
      );
      await route.fulfill({ status: 201, json: tasks[0] });
    }
  });
  await page.goto('/');
  const input = page.getByRole('textbox', { name: 'Новая задача' });
  await input.fill('Купить хлеб #дом');
  await input.press('Enter');
  await expect(page.getByRole('alert')).toContainText('Текст сохранён');
  await expect(input).toHaveValue('Купить хлеб #дом');
  await expect(page.getByRole('main').getByRole('link', { name: /Купить хлеб/ })).toHaveCount(0);
  await input.press('Enter');
  await expect(input).toHaveValue('');
  await expect(page.getByRole('main').getByRole('link', { name: /Купить хлеб/ })).toHaveCount(1);
  expect(attempts).toBe(2);
});

test('mobile dark input keeps caret and highlights aligned when scrolling and editing', async ({
  page,
}, testInfo) => {
  await mockTasks(page);
  await page.setViewportSize({ width: 375, height: 812 });
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');
  const input = page.getByRole('textbox', { name: 'Новая задача' });
  await input.fill(
    'Очень длинное название задачи для проверки горизонтальной прокрутки завтра в 18:00 #дом !!',
  );
  await input.press('End');
  await expect(input).toHaveCSS('font-size', '16px');
  await page.evaluate(() => document.fonts.ready);
  await expect.poll(() => input.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
  await expect
    .poll(async () => {
      const nativeScroll = await input.evaluate((element) => element.scrollLeft);
      const mirrorScroll = await page
        .locator('.quick-add-mirror')
        .evaluate((element) => element.scrollLeft);
      return Math.abs(nativeScroll - mirrorScroll);
    })
    .toBeLessThanOrEqual(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(375);
  await page.clock.runFor(100);
  await expect
    .poll(async () => {
      const field = await input.boundingBox();
      const lastToken = await page.locator('mark').last().boundingBox();
      if (!field || !lastToken) throw new Error('Quick add field is missing');
      return lastToken.x + lastToken.width - (field.x + field.width);
    })
    .toBeLessThan(0);
  await page.screenshot({ path: testInfo.outputPath('quick-add-mobile-dark.png'), fullPage: true });
  await input.press('Home');
  await input.press('Delete');
  await expect(input).toHaveValue(/^чень длинное/);
  await expect
    .poll(() => page.locator('.quick-add-mirror').evaluate((element) => element.scrollLeft))
    .toBe(0);
  await input.press('End');
  await expect(page.locator('mark')).toHaveText(['завтра', 'в 18:00', '#дом', '!!']);
});

test('forced colors keeps the native text readable and hides the mirror', async ({ page }) => {
  await mockTasks(page);
  await page.emulateMedia({ forcedColors: 'active' });
  await page.goto('/');
  const input = page.getByRole('textbox', { name: 'Новая задача' });
  await input.fill('Молоко завтра');
  await expect(page.locator('.quick-add-mirror')).toBeHidden();
  expect(await input.evaluate((element) => getComputedStyle(element).color)).not.toBe(
    'rgba(0, 0, 0, 0)',
  );
});
