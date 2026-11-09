/// <reference lib="dom" />
import { expect, test, type Page } from '@playwright/test';

import type { TaskCreate, TaskRead, TaskUpdate } from '../src/api/schema';
import { makeList } from '../src/test/makeList';
import { makeTask } from '../src/test/makeTask';

test.use({ timezoneId: 'UTC' });
const now = new Date();
const today = now.toISOString().slice(0, 10);
const tomorrowDate = new Date(now);
tomorrowDate.setUTCDate(tomorrowDate.getUTCDate() + 1);
const tomorrow = tomorrowDate.toISOString().slice(0, 10);

async function workspace(page: Page, initial: TaskRead[]) {
  let tasks = [...initial];
  let next = 0;
  await page.clock.setFixedTime(now); // Query timers keep running.
  await page.route('**/api/lists**', (route) =>
    route.fulfill({ json: [makeList({ id: 'work', name: 'Работа' })] }),
  );
  await page.route('**/api/tasks**', async (route) => {
    const request = route.request();
    const id = new URL(request.url()).pathname.split('/')[3];
    if (request.method() === 'GET') {
      await route.fulfill({ json: tasks });
      return;
    }
    if (request.method() === 'POST') {
      const body = request.postDataJSON() as TaskCreate;
      const created = makeTask({
        ...body,
        id: `new-${String(next++)}`,
        position: tasks.length + 1,
      });
      tasks.push(created);
      await route.fulfill({ status: 201, json: created });
      return;
    }
    if (request.method() === 'PATCH') {
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
      return;
    }
    throw new Error(`Unexpected request: ${request.method()}`);
  });
}

test('375px: tasks start in the first screen, dock and toasts leave the last task accessible', async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await workspace(
    page,
    Array.from({ length: 15 }, (_, i) =>
      makeTask({
        id: `t${String(i)}`,
        title: `Дело ${String(i + 1)}`,
        due_date: today,
        position: i,
      }),
    ),
  );
  await page.goto('/');
  const main = page.getByRole('main');
  const first = main.locator('[data-task-link="t0"]');
  await expect(first).toBeInViewport();
  expect((await first.boundingBox())?.y).toBeLessThan(667 / 2);
  const stats = await page.getByRole('region', { name: 'Итоги дня' }).boundingBox();
  expect(stats?.height).toBeLessThanOrEqual(64);
  const form = page.getByRole('form', { name: 'Новая задача' });
  const dock = await form.boundingBox();
  expect(dock).not.toBeNull();
  expect((dock?.y ?? 0) + (dock?.height ?? 0)).toBeCloseTo(667, 0);
  await expect(form.getByText(/Enter — добавить/)).toBeHidden();
  await main.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  const last = main.locator('[data-task-link="t14"]');
  await expect(last).toBeInViewport();
  const lastBox = await last.boundingBox();
  expect((lastBox?.y ?? 0) + (lastBox?.height ?? 0)).toBeLessThanOrEqual(dock?.y ?? 0);
  await page.getByRole('textbox', { name: 'Новая задача' }).fill('Завтра дело завтра');
  await page.getByRole('textbox', { name: 'Новая задача' }).press('Enter');
  const toast = page.getByRole('region', { name: 'Уведомления' });
  await expect(toast).toContainText('Добавлено');
  const toastBox = await toast.boundingBox();
  expect((toastBox?.y ?? 0) + (toastBox?.height ?? 0)).toBeLessThanOrEqual(dock?.y ?? 0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(375);
  expect(await main.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath('mobile-dock.png'), fullPage: true });
});

test('375px: search expands across the header, keeps global results and clears before collapsing', async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await workspace(page, [
    makeTask({ id: 'today', title: 'Сейчас', due_date: today }),
    makeTask({ id: 'global', title: 'Купить хлеб' }),
  ]);
  await page.goto('/');
  const trigger = page.getByRole('button', { name: 'Открыть поиск' });
  await expect(page.getByRole('searchbox')).toHaveCount(0);
  await trigger.click();
  const input = page.getByRole('searchbox', { name: 'Поиск по задачам' });
  await expect(input).toBeFocused();
  expect((await input.boundingBox())?.width).toBeGreaterThan(300);
  await input.fill('хлеб');
  await expect(page.getByRole('main').locator('[data-task-link]')).toHaveAttribute(
    'data-task-link',
    'global',
  );
  await input.press('Escape');
  await expect(input).toHaveValue('');
  await input.press('Escape');
  await expect(input).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await trigger.click();
  await page.getByRole('button', { name: 'Закрыть поиск' }).click();
  await expect(input).toHaveCount(0);
  await page.goto('/?q=хлеб');
  await expect(input).toHaveValue('хлеб');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(375);
});

test('375px: List/Timeline tabs work by keyboard and click, and a timeline task opens details', async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await workspace(page, [
    makeTask({
      id: 'meeting',
      title: 'Встреча',
      due_date: today,
      due_time: '10:00:00',
      duration_minutes: 60,
    }),
  ]);
  await page.goto('/');
  const list = page.getByRole('tab', { name: 'Список', exact: true });
  const timeline = page.getByRole('tab', { name: 'Таймлайн', exact: true });
  await list.focus();
  await list.press('ArrowRight');
  await expect(timeline).toBeFocused();
  await expect(timeline).toHaveAttribute('aria-selected', 'true');
  const region = page.getByRole('region', { name: 'Таймлайн дня' });
  await expect(region).toBeVisible();
  expect((await region.boundingBox())?.width).toBeGreaterThan(330);
  await expect(page.getByRole('tabpanel', { name: 'Список' })).toBeHidden();
  await region.getByRole('button', { name: /Встреча/ }).click();
  const details = page.getByRole('dialog', { name: 'Детали задачи' });
  await expect(details.getByLabel('Название', { exact: true })).toHaveValue('Встреча');
  await details.getByRole('button', { name: 'Закрыть детали' }).click();
  await expect(timeline).toHaveAttribute('aria-selected', 'true');
  await expect(region.getByRole('button', { name: /Встреча/ })).toBeFocused();
  await page.getByRole('button', { name: 'Открыть поиск' }).click();
  const search = page.getByRole('searchbox');
  await search.fill('Встреча');
  await expect(page.getByRole('main').locator('[data-task-link="meeting"]')).toBeVisible();
  await expect(page.getByRole('tablist')).toHaveCount(0);
  await search.press('Escape');
  await expect(timeline).toHaveAttribute('aria-selected', 'true');
  await search.press('Escape');
  await list.click();
  await expect(page.getByRole('tabpanel', { name: 'Список' })).toBeVisible();
  await expect(region).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(375);
  await page.screenshot({ path: info.outputPath('mobile-list.png'), fullPage: true });
});

test('compact properties keep labels, subtask progress comes before autosizing notes and Esc still reverts', async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await workspace(page, [
    makeTask({
      id: 'p',
      title: 'Проект',
      due_date: today,
      due_time: '10:00:00',
      list_id: 'work',
      notes: 'Коротко',
    }),
    makeTask({ id: 'a', title: 'Готово', parent_id: 'p', completed_at: now.toISOString() }),
    makeTask({ id: 'b', title: 'Продолжить', parent_id: 'p' }),
  ]);
  await page.goto('/?task=p');
  const panel = page.getByRole('dialog', { name: 'Детали задачи' });
  await expect(panel.getByRole('heading', { name: 'Подзадачи 1 из 2' })).toBeInViewport();
  const date = await panel.getByLabel('Дата', { exact: true }).boundingBox();
  const time = await panel.getByLabel('Время', { exact: true }).boundingBox();
  expect(date?.y).toBe(time?.y);
  expect(date?.height).toBeLessThanOrEqual(36);
  await panel.getByText('!!!', { exact: true }).click();
  await expect(panel.getByRole('radio', { name: 'Высокий', exact: true })).toBeChecked();
  await expect(panel.getByLabel('Список', { exact: true })).toHaveValue('work');
  const notes = panel.getByLabel('Заметки', { exact: true });
  await expect(notes).toHaveCSS('resize', 'none');
  const small = (await notes.boundingBox())?.height ?? 0;
  await notes.fill(Array.from({ length: 12 }, (_, i) => `Строка ${String(i)}`).join('\n'));
  expect((await notes.boundingBox())?.height).toBeGreaterThan(small + 100);
  await notes.press('Escape');
  await expect(notes).toHaveValue('Коротко');
  expect((await notes.boundingBox())?.height).toBe(small);
  const tag = panel.getByPlaceholder('Новый тег');
  await tag.fill('важное');
  await tag.press('Enter');
  await expect(panel.getByText('#важное')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(375);
  await page.screenshot({ path: info.outputPath('compact-details-mobile.png'), fullPage: true });
  await panel.getByRole('button', { name: 'Закрыть детали' }).click();
});

test('day closed appears after completing the last task, Undo restores it, search and other days do not celebrate', async ({
  page,
}) => {
  await workspace(page, [makeTask({ id: 'last', title: 'Последнее дело', due_date: today })]);
  await page.goto('/');
  const message = page.getByText('Все дела на сегодня сделаны', { exact: true });
  await expect(message).toHaveCount(0);
  await page.getByRole('main').getByRole('checkbox', { name: 'Выполнить: Последнее дело' }).click();
  await expect(message).toBeVisible();
  await expect(page.getByRole('main').locator('[data-task-link="last"]')).toBeVisible();
  await expect(page.getByRole('main').getByRole('heading', { name: 'Без списка' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Отменить', exact: true }).click();
  await expect(message).toHaveCount(0);
  await page.getByRole('main').getByRole('checkbox', { name: 'Выполнить: Последнее дело' }).click();
  await expect(message).toBeVisible();
  await page.getByRole('searchbox').fill('Последнее');
  await expect(message).toHaveCount(0);
  await page.getByRole('searchbox').press('Escape');
  await expect(message).toBeVisible();
  await page.goto(`/?day=${tomorrow}`);
  await expect(message).toHaveCount(0);
  await expect(page.getByText('На этот день задач нет', { exact: true })).toBeVisible();
});

test('empty Today keeps its empty state; day closed has no entrance movement with reduced motion', async ({
  page,
}) => {
  await workspace(page, []);
  await page.goto('/');
  await expect(page.getByText('На сегодня задач нет', { exact: true })).toBeVisible();
  await expect(page.getByText('Все дела на сегодня сделаны')).toHaveCount(0);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await workspace(page, [
    makeTask({ id: 'done', due_date: today, completed_at: now.toISOString() }),
  ]);
  await page.reload();
  const status = page.getByRole('status').filter({ hasText: 'Все дела на сегодня сделаны' });
  await expect(status).toHaveCSS('opacity', '1');
  await expect(status).toHaveCSS('transform', 'none');
});

test('desktop keeps inline quick add, full statistics and the right timeline without tabs', async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await workspace(page, [
    makeTask({ id: 'meeting', title: 'Встреча', due_date: today, due_time: '10:00:00' }),
  ]);
  await page.goto('/');
  await expect(page.getByRole('tablist')).toHaveCount(0);
  await expect(page.getByRole('searchbox')).toBeVisible();
  await expect(page.getByRole('form', { name: 'Новая задача' })).toHaveCSS('position', 'static');
  await expect(page.getByText(/Enter — добавить/)).toBeVisible();
  const region = page.getByRole('region', { name: 'Таймлайн дня' });
  await expect(region).toBeVisible();
  expect((await region.boundingBox())?.x).toBeGreaterThan(1000);
  await page.screenshot({ path: info.outputPath('desktop.png'), fullPage: true });
});
