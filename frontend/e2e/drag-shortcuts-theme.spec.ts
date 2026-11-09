/// <reference lib="dom" />
import { expect, test, type Locator, type Page } from '@playwright/test';

import type { TaskRead, TaskUpdate } from '../src/api/schema';
import { addDays, toLocalDateString } from '../src/domain/dates';
import { makeList } from '../src/test/makeList';
import { makeTask } from '../src/test/makeTask';

test.use({ timezoneId: 'UTC' });
const now = new Date();
const calendar = new Date(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
const today = toLocalDateString(calendar);
const tomorrow = toLocalDateString(addDays(calendar, 1));
const tasks = [
  makeTask({ id: 'a', title: 'Первая задача', position: 1 }),
  makeTask({ id: 'b', title: 'Вторая задача', position: 2 }),
  makeTask({ id: 'c', title: 'Третья задача', position: 3 }),
];

async function workspace(page: Page, initial: TaskRead[]) {
  let saved = [...initial];
  let failNext = false;
  await page.clock.setFixedTime(now);
  await page.route('**/api/lists**', (route) =>
    route.fulfill({ json: [makeList({ id: 'work', name: 'Работа' })] }),
  );
  await page.route('**/api/tasks**', async (route) => {
    const request = route.request();
    const parts = new URL(request.url()).pathname.split('/');
    const id = parts[3];
    if (request.method() === 'GET') {
      await route.fulfill({ json: saved });
      return;
    }
    if (request.method() === 'PATCH') {
      if (failNext) {
        failNext = false;
        await route.fulfill({
          status: 500,
          json: { error: { code: 'internal', message: 'refused' } },
        });
        return;
      }
      const { completed, ...patch } = request.postDataJSON() as TaskUpdate;
      saved = saved.map((task) =>
        task.id === id
          ? {
              ...task,
              ...patch,
              ...(completed === undefined
                ? {}
                : { completed_at: completed ? now.toISOString() : null }),
            }
          : task,
      );
      await route.fulfill({ json: saved.find((task) => task.id === id) });
      return;
    }
    if (request.method() === 'DELETE') {
      saved = saved.filter((task) => task.id !== id);
      await route.fulfill({ status: 204 });
      return;
    }
    if (request.method() === 'POST' && parts[4] === 'restore') {
      const task = initial.find((task) => task.id === id);
      if (task) saved.push(task);
      await route.fulfill({ json: task });
      return;
    }
    throw new Error(`Unexpected ${request.method()}`);
  });
  return {
    tasks: () => saved,
    fail: () => {
      failNext = true;
    },
  };
}

const rows = (page: Page) => page.getByRole('main').locator('[data-task-link]');
const order = (page: Page) =>
  rows(page).evaluateAll((elements) =>
    elements.map((element) => element.getAttribute('data-task-link')),
  );
async function drag(page: Page, from: Locator, delta: { x: number; y: number }) {
  await from.scrollIntoViewIfNeeded();
  const box = await from.boundingBox();
  if (!box) throw new Error('Missing drag target');
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x, y + Math.sign(delta.y) * 7);
  await page.mouse.move(x + delta.x, y + delta.y, { steps: 12 });
}

test('mouse ordering persists after reload; dragging carries expanded subtasks', async ({
  page,
}) => {
  const data = await workspace(page, [
    ...tasks,
    makeTask({ id: 'child', title: 'Шаг', parent_id: 'c' }),
  ]);
  await page.goto('/?list=inbox');
  await page.getByRole('button', { name: /показать подзадачи: Третья задача$/ }).click();
  const first = await page.locator('[data-task-row="a"]').boundingBox();
  const last = await page.locator('[data-task-row="c"]').boundingBox();
  if (!first || !last) throw new Error('Missing handles');
  await drag(page, page.getByRole('button', { name: 'Переместить «Третья задача»' }), {
    x: 0,
    y: first.y + first.height / 2 - last.y - last.height / 2,
  });
  await expect(page.locator('[data-task-row="c"]')).toContainText('Шаг');
  await page.mouse.up();
  await expect.poll(() => order(page)).toEqual(['c', 'a', 'b']);
  await expect.poll(() => data.tasks().find((task) => task.id === 'c')?.position).toBe(0);
  await page.reload();
  await expect.poll(() => order(page)).toEqual(['c', 'a', 'b']);
});

test('handle keyboard sorting, cancellation and Alt arrows use the same saved order', async ({
  page,
}) => {
  await workspace(page, tasks);
  await page.goto('/?list=inbox');
  const handle = page.getByRole('button', { name: 'Переместить «Вторая задача»' });
  await handle.focus();
  await handle.press('Space');
  // dnd-kit announces the pick-up, then at once the position in the same live region.
  await expect(handle).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('«Вторая задача»: позиция', { exact: false })).toBeAttached();
  // The sensor starts listening a moment after the pick-up: on a slow machine the
  // first arrow can come too early, so repeat it (extra presses stop at the top).
  await expect(async () => {
    await page.keyboard.press('ArrowUp');
    await expect(page.getByText('«Вторая задача»: позиция 1 из 3', { exact: false })).toBeAttached({
      timeout: 500,
    });
  }).toPass();
  await page.keyboard.press('Space');
  await expect.poll(() => order(page)).toEqual(['b', 'a', 'c']);
  await expect(handle).not.toHaveAttribute('aria-disabled', 'true');
  await handle.press('Enter');
  await expect(handle).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Escape');
  await expect(page.getByText('Перемещение отменено.', { exact: true })).toBeAttached();
  await expect.poll(() => order(page)).toEqual(['b', 'a', 'c']);
  await page.locator('[data-task-link="b"]').focus();
  await page.keyboard.press('Alt+ArrowDown');
  await expect.poll(() => order(page)).toEqual(['a', 'b', 'c']);
  await page.reload();
  await expect.poll(() => order(page)).toEqual(['a', 'b', 'c']);
});

test('failed ordering rolls back with an error toast; excluded groups have no handles', async ({
  page,
}) => {
  const data = await workspace(page, [
    ...tasks,
    makeTask({ id: 'tomorrow', title: 'Завтрашняя', due_date: tomorrow }),
  ]);
  await page.goto('/?list=inbox');
  data.fail();
  await page.locator('[data-task-link="b"]').focus();
  await page.keyboard.press('Alt+ArrowUp');
  await expect(page.getByText(/Не удалось сохранить/)).toBeVisible();
  await expect.poll(() => order(page)).toEqual(['a', 'b', 'c']);
  await page.goto('/');
  await expect(page.getByRole('button', { name: /Переместить «/ })).toHaveCount(0);
  await page.goto('/?list=upcoming');
  await expect(page.getByRole('button', { name: /Переместить «/ })).toHaveCount(0);
  await page.goto('/?list=inbox&q=задача');
  await expect(page.getByRole('button', { name: /Переместить «/ })).toHaveCount(0);
});

test('timeline mouse snap previews the range, persists time and offers Undo', async ({ page }) => {
  const data = await workspace(page, [
    makeTask({
      id: 'timed',
      title: 'Звонок',
      due_date: today,
      due_time: '14:00:00',
      duration_minutes: 30,
    }),
  ]);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  const block = page.locator('[data-timeline-task="timed"]');
  await drag(page, block, { x: 0, y: 28 });
  await expect(block).toContainText('14:30–15:00');
  await page.mouse.up();
  await expect(page.getByText('Перенесено на 14:30')).toBeVisible();
  await expect.poll(() => data.tasks()[0]?.due_time).toBe('14:30:00');
  await page.getByRole('button', { name: 'Отменить' }).click();
  await expect.poll(() => data.tasks()[0]?.due_time).toBe('14:00:00');
  await drag(page, block, { x: 0, y: 28 });
  await page.mouse.up();
  await expect.poll(() => data.tasks()[0]?.due_time).toBe('14:30:00');
  await page.reload();
  await expect(page.locator('[data-timeline-task="timed"]')).toContainText('14:30');
  expect(data.tasks()[0]?.duration_minutes).toBe(30);
});

test('timeline arrow series persists, Ctrl+Z restores its original time, click opens details', async ({
  page,
}) => {
  const data = await workspace(page, [
    makeTask({
      id: 'timed',
      title: 'Звонок',
      due_date: today,
      due_time: '14:00:00',
      duration_minutes: 30,
    }),
  ]);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  const block = page.locator('[data-timeline-task="timed"]');
  await block.focus();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Shift+ArrowDown');
  await expect(page.getByRole('button', { name: 'Отменить' })).toHaveCount(1);
  await expect.poll(() => data.tasks()[0]?.due_time).toBe('15:30:00');
  await page.keyboard.press('Control+z');
  await expect.poll(() => data.tasks()[0]?.due_time).toBe('14:00:00');
  await block.press('ArrowDown');
  await expect.poll(() => data.tasks()[0]?.due_time).toBe('14:15:00');
  await page.reload();
  await expect(block).toContainText('14:15');
  await block.click();
  await expect(page).toHaveURL(/task=timed/);
});

test('shortcuts, command palette, task action Undo and help keep focus', async ({ page }) => {
  await workspace(page, tasks);
  await page.goto('/?list=inbox');
  await page.keyboard.press('n');
  await expect(page.getByRole('textbox', { name: 'Новая задача' })).toBeFocused();
  await page.keyboard.press('Control+k');
  const dialog = page.getByRole('dialog', { name: 'Палитра команд' });
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('textbox', { name: 'Новая задача' })).toBeFocused();
  await page.getByRole('heading', { level: 1 }).click();
  await page.keyboard.press('j');
  await expect(page.locator('[data-task-link="a"]')).toBeFocused();
  await page.keyboard.press('x');
  await expect(page.locator('[data-task-link="b"]')).toBeFocused();
  await page.keyboard.press('Control+z');
  await expect(page.locator('[data-task-link="a"]')).toBeVisible();
  await page.keyboard.press('Control+k');
  await dialog.getByRole('option', { name: 'На завтра', exact: true }).click();
  await page.getByRole('button', { name: 'Отменить' }).click();
  await page.keyboard.press('Control+k');
  await dialog.getByRole('combobox').fill('Третья');
  await dialog.getByRole('option', { name: 'Третья задача' }).click();
  await expect(page).toHaveURL(/task=c/);
  await page.keyboard.press('Escape');
  await page.keyboard.press('?');
  const help = page.getByRole('dialog', { name: 'Горячие клавиши' });
  await expect(help.getByRole('table')).toHaveCount(3);
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-task-link="c"]')).toBeFocused();
});

test('explicit theme beats system and is applied at DOMContentLoaded after reload', async ({
  page,
}) => {
  await workspace(page, []);
  await page.addInitScript(() => {
    document.addEventListener('DOMContentLoaded', () => {
      document.documentElement.setAttribute(
        'data-theme-at-dom-ready',
        document.documentElement.getAttribute('data-theme') ?? 'system',
      );
    });
  });
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');
  await page.getByRole('radio', { name: 'Светлая', exact: true }).click();
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.locator('html')).toHaveAttribute('data-theme-at-dom-ready', 'light');
  await expect(page.locator('html')).toHaveCSS('color-scheme', 'light');
  await page.emulateMedia({ colorScheme: 'light' });
  await page.getByRole('radio', { name: 'Тёмная' }).click();
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.locator('html')).toHaveAttribute('data-theme-at-dom-ready', 'dark');
  await expect(page.locator('html')).toHaveCSS('color-scheme', 'dark');
  await page.evaluate(() => {
    localStorage.setItem('tood-theme', 'broken');
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.locator('html')).toHaveAttribute('data-theme-at-dom-ready', 'system');
  await expect(page.locator('html')).not.toHaveAttribute('data-theme');
});

test.describe('375px touch layout', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 375, height: 667 } });
  test('handles stay visible, words stay whole, theme lives in drawer and / opens search', async ({
    page,
  }, info) => {
    await workspace(page, [
      makeTask({ id: 'a', title: 'Приготовить спокойный завтрак', position: 1 }),
      tasks[1],
    ]);
    await page.goto('/?list=inbox');
    const handle = page.getByRole('button', {
      name: 'Переместить «Приготовить спокойный завтрак»',
    });
    await expect(handle).toBeVisible();
    await expect(handle).toHaveCSS('opacity', '1');
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(375);
    await expect(page.locator('[data-task-link="a"]')).toHaveCSS('word-break', 'normal');
    const whole = await page
      .locator('[data-task-link="a"] [data-task-title]')
      .evaluate((element) => {
        const text = element.firstChild;
        if (!text) return false;
        const range = document.createRange();
        range.setStart(text, 0);
        range.setEnd(text, 'Приготовить'.length);
        return range.getClientRects().length === 1;
      });
    expect(whole).toBe(true);
    await page.keyboard.press('/');
    await expect(page.getByRole('searchbox')).toBeFocused();
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Открыть меню' }).click();
    await page
      .getByRole('dialog', { name: 'Навигация' })
      .getByRole('radio', { name: 'Тёмная' })
      .click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await page.getByRole('button', { name: 'Закрыть меню' }).click();
    await page.screenshot({ path: info.outputPath('drag-mobile.png'), fullPage: true });
  });
});
