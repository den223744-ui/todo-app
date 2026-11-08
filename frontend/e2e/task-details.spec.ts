/// <reference lib="dom" />
import { expect, test, type Page } from '@playwright/test';

import type { TaskCreate, TaskRead, TaskUpdate } from '../src/api/schema';
import { makeTask } from '../src/test/makeTask';

/** In-memory API for list/create/update/delete; no request reaches a real database. */
async function fakeServer(page: Page, initial: TaskRead[]) {
  let tasks = [...initial];
  await page.route('**/api/tasks**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const id = url.pathname.split('/')[3];
    if (request.method() === 'GET') {
      await route.fulfill({ json: tasks });
    } else if (request.method() === 'POST') {
      const body = request.postDataJSON() as TaskCreate;
      const created = makeTask({
        id: `t${String(tasks.length + 1)}`,
        title: body.title,
        parent_id: body.parent_id ?? null,
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
              ...(fields as Partial<TaskRead>),
              ...(completed === undefined
                ? {}
                : { completed_at: completed ? '2026-11-08T12:00:00Z' : null }),
            }
          : task,
      );
      await route.fulfill({ json: tasks.find((task) => task.id === id) });
    } else {
      tasks = tasks.filter((task) => task.id !== id && task.parent_id !== id);
      await route.fulfill({ status: 204, body: '' });
    }
  });
  return { all: () => tasks };
}

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date(2026, 10, 8, 12) });
});

test('edit a task in the detail panel, add a subtask, and it survives a reload', async ({
  page,
}) => {
  const server = await fakeServer(page, [
    makeTask({ id: 'p', title: 'Починить кран', tags: ['дом'] }),
  ]);
  await page.goto('/?list=inbox');

  await page
    .getByRole('main')
    .getByRole('link', { name: /Починить кран/ })
    .click();
  const panel = page.getByRole('complementary', { name: 'Детали задачи' });
  await expect(panel).toBeVisible();
  await expect(page).toHaveURL(/task=p/);

  await panel.getByLabel('Заметки').fill('Кухня, прокладка 1/2"');
  // The radios are visually hidden; people click the visible label.
  await panel.getByText('Высокий приоритет').click();
  await expect(panel.getByRole('radio', { name: 'Высокий приоритет' })).toBeChecked();
  await panel.getByLabel('Теги').fill('ремонт');
  await panel.getByLabel('Теги').press('Enter');
  await panel.getByLabel('Новая подзадача').fill('Купить прокладку');
  await panel.getByLabel('Новая подзадача').press('Enter');
  await expect(panel.getByLabel('Название подзадачи: Купить прокладку')).toBeVisible();

  await expect
    .poll(() => server.all().find((task) => task.id === 'p'))
    .toMatchObject({ notes: 'Кухня, прокладка 1/2"', priority: 3, tags: ['дом', 'ремонт'] });

  await page.reload();
  const reloaded = page.getByRole('complementary', { name: 'Детали задачи' });
  await expect(reloaded.getByLabel('Заметки')).toHaveValue('Кухня, прокладка 1/2"');
  await expect(reloaded.getByLabel('Название подзадачи: Купить прокладку')).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(reloaded).toBeHidden();
  await expect(page).not.toHaveURL(/task=/);
  await expect(page.getByRole('main').getByRole('link', { name: /Починить кран/ })).toBeFocused();
});

test('double click renames a task in place; deleting closes the panel', async ({ page }) => {
  const server = await fakeServer(page, [makeTask({ id: 'p', title: 'Позвонить' })]);
  await page.goto('/?list=inbox');

  await page
    .getByRole('main')
    .getByRole('link', { name: /Позвонить/ })
    .dblclick();
  const editor = page.getByRole('textbox', { name: 'Изменить название: Позвонить' });
  await editor.fill('Позвонить маме');
  await editor.press('Enter');
  await expect(page.getByRole('main').getByRole('link', { name: /Позвонить маме/ })).toBeFocused();
  await expect.poll(() => server.all()[0]?.title).toBe('Позвонить маме');

  await page
    .getByRole('main')
    .getByRole('link', { name: /Позвонить маме/ })
    .click();
  await page.getByRole('button', { name: 'Удалить задачу' }).click();
  await expect(page.getByRole('complementary', { name: 'Детали задачи' })).toBeHidden();
  await expect(page.getByRole('main').getByRole('link')).toHaveCount(0);
  await expect.poll(() => server.all()).toEqual([]);
});

test('on a phone the panel covers the list and closes back to it', async ({ page }) => {
  await fakeServer(page, [makeTask({ id: 'p', title: 'Задача' })]);
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/?list=inbox&task=p');

  const panel = page.getByRole('complementary', { name: 'Детали задачи' });
  await expect(panel).toBeVisible();
  const box = await panel.boundingBox();
  expect(box).toMatchObject({ x: 0, y: 0, width: 375 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(375);

  await panel.getByRole('button', { name: 'Закрыть детали' }).click();
  await expect(panel).toBeHidden();
});

test('search filters the view and stays in the URL across a reload', async ({ page }) => {
  await fakeServer(page, [
    makeTask({ id: 'a', title: 'Купить хлеб', position: 1 }),
    makeTask({ id: 'b', title: 'Позвонить маме', position: 2 }),
  ]);
  await page.goto('/?list=inbox');

  await page.getByRole('searchbox', { name: 'Поиск по задачам' }).fill('купить ');
  const main = page.getByRole('main');
  await expect(main.getByRole('link', { name: /Купить хлеб/ })).toBeVisible();
  await expect(main.getByRole('link', { name: /Позвонить маме/ })).toHaveCount(0);
  await expect(page).toHaveURL(/q=/);

  await page.reload();
  await expect(page.getByRole('searchbox', { name: 'Поиск по задачам' })).toHaveValue('купить');
  await expect(main.getByRole('link', { name: /Позвонить маме/ })).toHaveCount(0);
});

test('a failed delete puts the task back and shows a toast', async ({ page }) => {
  await fakeServer(page, [makeTask({ id: 'p', title: 'Важная задача' })]);
  await page.route('**/api/tasks/p', (route) =>
    route.request().method() === 'DELETE' ? route.abort('failed') : route.fallback(),
  );
  await page.goto('/?list=inbox&task=p');

  await page.getByRole('button', { name: 'Удалить задачу' }).click();

  const toasts = page.getByRole('region', { name: 'Уведомления' });
  await expect(toasts).toContainText('Нет связи с сервером');
  await expect(page.getByRole('main').getByRole('link', { name: /Важная задача/ })).toBeVisible();
});
