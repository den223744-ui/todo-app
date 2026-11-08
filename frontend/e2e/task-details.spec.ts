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
  // The visible subtask row is optimistic: wait until the server has saved it.
  await expect
    .poll(() =>
      server.all().some((task) => task.parent_id === 'p' && task.title === 'Купить прокладку'),
    )
    .toBe(true);

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

  // On a phone the panel covers the page: a modal dialog.
  const panel = page.getByRole('dialog', { name: 'Детали задачи' });
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

test('a 50-character tag wraps inside the panel on a phone', async ({ page }) => {
  const longTag = 'w'.repeat(50);
  await fakeServer(page, [makeTask({ id: 'p', title: 'Задача', tags: [longTag] })]);
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/?list=inbox&task=p');

  const panel = page.getByRole('dialog', { name: 'Детали задачи' });
  const chip = panel.getByRole('listitem').filter({ hasText: `#${longTag}` });
  const remove = panel.getByRole('button', { name: `Убрать тег ${longTag}` });
  // Real geometry: the page width alone does not show overflow hidden by a container.
  for (const element of [chip, remove]) {
    const box = await element.boundingBox();
    expect(box).not.toBeNull();
    expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(375);
  }
});

test('the desktop sidebar scrolls to reach every tag', async ({ page }) => {
  const tags = Array.from({ length: 20 }, (_, i) => `тег${String(i).padStart(2, '0')}`);
  await fakeServer(
    page,
    tags.map((tag, i) => makeTask({ id: `t${String(i)}`, title: tag, tags: [tag] })),
  );
  await page.setViewportSize({ width: 1280, height: 700 });
  await page.goto('/?list=inbox');

  const last = page.getByRole('navigation', { name: 'Теги' }).getByRole('link', { name: /тег19/ });
  const bottom = async () => {
    const box = await last.boundingBox();
    return (box?.y ?? 0) + (box?.height ?? 0);
  };
  expect(await bottom()).toBeGreaterThan(700); // below the fold at first
  // Scroll with the mouse wheel like a person (a click would scrollIntoView,
  // which works even on an overflow:hidden container).
  await page.mouse.move(120, 400);
  await page.mouse.wheel(0, 2000);
  await expect.poll(bottom).toBeLessThanOrEqual(700);
});
