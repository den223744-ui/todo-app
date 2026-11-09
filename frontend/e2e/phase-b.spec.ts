/// <reference lib="dom" />
import { expect, test, type Page } from '@playwright/test';

import type {
  TaskCreate,
  TaskListRead,
  TaskListUpdate,
  TaskRead,
  TaskUpdate,
} from '../src/api/schema';
import { makeList } from '../src/test/makeList';
import { makeTask } from '../src/test/makeTask';

// Freeze Date only: Query notifications and animation timers keep running.
test.use({ timezoneId: 'UTC' });
const now = new Date('2026-11-09T12:00:00Z');
const date = (offset: number) =>
  new Date(now.getTime() + offset * 86_400_000).toISOString().slice(0, 10);
const work = makeList({ id: 'work', name: 'Работа' });
const home = makeList({ id: 'home', name: 'Личные дела', color: 'green' });

async function workspace(
  page: Page,
  initial: TaskRead[] = [],
  initialLists: TaskListRead[] = [work, home],
) {
  let tasks = [...initial];
  let lists = [...initialLists];
  let nextId = 1;
  const patches: { id: string; patch: TaskUpdate }[] = [];
  const created: TaskCreate[] = [];
  await page.clock.setFixedTime(now);
  await page.route('**/api/lists**', async (route) => {
    const request = route.request();
    const id = new URL(request.url()).pathname.split('/')[3];
    if (request.method() === 'GET') {
      await route.fulfill({ json: lists });
      return;
    }
    if (request.method() === 'DELETE') {
      lists = lists.filter((list) => list.id !== id);
      tasks = tasks.map((task) => (task.list_id === id ? { ...task, list_id: null } : task));
      await route.fulfill({ status: 204 });
      return;
    }
    if (request.method() === 'PATCH') {
      const patch = request.postDataJSON() as TaskListUpdate;
      if (
        patch.name &&
        lists.some(
          (list) => list.id !== id && list.name.toLowerCase() === patch.name?.toLowerCase(),
        )
      ) {
        await route.fulfill({
          status: 409,
          json: { error: { code: 'conflict', message: 'taken' } },
        });
        return;
      }
      lists = lists.map((list) => (list.id === id ? { ...list, ...patch } : list));
      await route.fulfill({ json: lists.find((list) => list.id === id) });
      return;
    }
    throw new Error(`Unexpected list request: ${request.method()}`);
  });
  await page.route('**/api/tasks**', async (route) => {
    const request = route.request();
    const id = new URL(request.url()).pathname.split('/')[3];
    if (request.method() === 'GET') {
      await route.fulfill({ json: tasks });
      return;
    }
    if (request.method() === 'POST') {
      const body = request.postDataJSON() as TaskCreate;
      created.push(body);
      const task = makeTask({
        ...body,
        id: `created-${String(nextId++)}`,
        position: body.position ?? tasks.length + 1,
      });
      tasks.push(task);
      await route.fulfill({ status: 201, json: task });
      return;
    }
    if (request.method() === 'PATCH' && id) {
      const patch = request.postDataJSON() as TaskUpdate;
      patches.push({ id, patch });
      const { completed, ...fields } = patch;
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
    throw new Error(`Unexpected task request: ${request.method()}`);
  });
  return { patches, created };
}

test('inline subtasks expand by keyboard, lock pending writes, roll back and persist completion', async ({
  page,
}, info) => {
  await workspace(page, [
    makeTask({ id: 'p', title: 'Проект' }),
    makeTask({ id: 'c', title: 'Шаг', parent_id: 'p' }),
    makeTask({ id: 'd', title: 'Готово', parent_id: 'p', completed_at: now.toISOString() }),
  ]);
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let writes = 0;
  await page.route('**/api/tasks/c', async (route) => {
    writes++;
    if (writes === 1) {
      await gate;
      await route.fulfill({
        status: 500,
        json: { error: { code: 'internal_error', message: 'failed' } },
      });
    } else await route.fallback();
  });
  await page.goto('/?list=inbox');
  const trigger = page.getByRole('button', { name: /(показать|скрыть) подзадачи: Проект$/ });
  await expect(trigger).toContainText('1/2');
  await trigger.focus();
  await trigger.press('Enter');
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  const children = page.getByRole('list', { name: 'Подзадачи: Проект' });
  const checkbox = children.getByRole('checkbox', { name: /^(Выполнить|Вернуть в работу): Шаг$/ });
  await checkbox.click();
  await expect(checkbox).toBeChecked();
  await expect(checkbox).toHaveAttribute('aria-disabled', 'true');
  // A real click on the locked box: Playwright would wait for aria-disabled to go.
  await checkbox.click({ force: true });
  expect(writes).toBe(1);
  release();
  await expect(checkbox).not.toBeChecked();
  await expect(checkbox).not.toHaveAttribute('aria-disabled');
  await checkbox.click();
  await expect(children.getByRole('checkbox', { name: 'Вернуть в работу: Шаг' })).toBeChecked();
  await page.screenshot({ path: info.outputPath('subtasks-desktop.png'), fullPage: true });
  await page.reload();
  await page.getByRole('button', { name: /показать подзадачи: Проект$/ }).click();
  await expect(page.getByRole('checkbox', { name: 'Вернуть в работу: Шаг' })).toBeChecked();
});

test('a row reschedule preserves time, offers undo, and is always visible on mobile', async ({
  page,
}, info) => {
  const { patches } = await workspace(page, [
    makeTask({ id: 'late', title: 'Отчёт', due_date: date(-1), due_time: '18:30:00' }),
  ]);
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');
  const action = page.getByRole('button', { name: 'Перенести на сегодня: Отчёт' });
  await expect(action).toBeVisible();
  await expect(action).toHaveCSS('opacity', '1');
  await action.click();
  await expect(page.getByText('Перенесено на сегодня', { exact: true })).toBeVisible();
  await expect(page.getByRole('main').locator('time')).toContainText('18:30');
  await expect.poll(() => patches).toEqual([{ id: 'late', patch: { due_date: date(0) } }]);
  await page.screenshot({ path: info.outputPath('reschedule-mobile.png'), fullPage: true });
  await page.getByRole('button', { name: 'Отменить' }).click();
  await expect(action).toBeVisible();
  await expect.poll(() => patches.length).toBe(2);
  expect(patches[1]).toEqual({ id: 'late', patch: { due_date: date(-1) } });
});

test('overdue bulk reschedule has one undo for every original date', async ({ page }) => {
  const { patches } = await workspace(page, [
    makeTask({ id: 'a', due_date: date(-1) }),
    makeTask({ id: 'b', due_date: date(-2) }),
    makeTask({ id: 'done', due_date: date(-1), completed_at: now.toISOString() }),
  ]);
  await page.goto('/?list=overdue');
  await page.getByRole('button', { name: 'Перенести все на сегодня (2)' }).click();
  const undo = page.getByRole('button', { name: 'Отменить' });
  await expect(undo).toHaveCount(1);
  await expect(page.getByText('Просроченных задач нет', { exact: true })).toBeVisible();
  await undo.click();
  await expect(page.getByRole('button', { name: 'Перенести все на сегодня (2)' })).toBeVisible();
  await expect.poll(() => patches.length).toBe(4);
  expect(patches).toEqual(
    expect.arrayContaining([
      { id: 'a', patch: { due_date: date(-1) } },
      { id: 'b', patch: { due_date: date(-2) } },
    ]),
  );
});

test('upcoming headings are human and rows show only time; search keeps full dates', async ({
  page,
}) => {
  await workspace(page, [
    makeTask({ id: 'a', title: 'Встреча', due_date: date(1), due_time: '10:00:00' }),
    makeTask({ id: 'b', title: 'Прогулка', due_date: date(2) }),
    makeTask({ id: 'c', title: 'Чтение', due_date: date(3) }),
    makeTask({ id: 'next-year', title: 'Отпуск', due_date: '2027-01-05' }),
  ]);
  await page.goto('/?list=upcoming');
  const main = page.getByRole('main');
  await expect(main.getByRole('heading', { level: 2 })).toHaveText([
    'Завтра',
    'Послезавтра',
    'Чт, 12 нояб.',
    'Вт, 5 янв. 2027 г.',
  ]);
  await expect(main.locator('time')).toHaveText(['10:00']);
  await page.getByRole('searchbox').fill('Встреча');
  await expect(main.locator('time')).toHaveText('10 нояб., 10:00');
});

test('list menu supports keyboard, inline rename, conflicting names and colour selection', async ({
  page,
}) => {
  await workspace(page);
  await page.goto('/');
  let trigger = page.getByRole('button', { name: 'Действия со списком Работа' });
  await trigger.focus();
  await trigger.press('ArrowDown');
  await expect(page.getByRole('menuitem', { name: 'Переименовать' })).toBeFocused();
  await page.getByRole('menuitem', { name: 'Переименовать' }).press('End');
  await expect(page.getByRole('menuitem', { name: 'Удалить' })).toBeFocused();
  await page.getByRole('menuitem', { name: 'Удалить' }).press('Escape');
  await expect(trigger).toBeFocused();
  await trigger.click();
  await page.getByRole('menuitemradio', { name: 'Красный' }).click();
  await expect(trigger).toBeFocused();
  await expect(trigger).not.toHaveAttribute('aria-disabled');
  await trigger.click();
  await expect(page.getByRole('menuitemradio', { name: 'Красный' })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await page.getByRole('menuitem', { name: 'Переименовать' }).click();
  let input = page.getByRole('textbox', { name: 'Название списка' });
  await input.fill('Проекты');
  await input.press('Escape');
  await expect(trigger).toBeFocused();
  await trigger.click();
  await page.getByRole('menuitem', { name: 'Переименовать' }).click();
  input = page.getByRole('textbox', { name: 'Название списка' });
  await input.fill('Проекты');
  await input.press('Enter');
  trigger = page.getByRole('button', { name: 'Действия со списком Проекты' });
  await expect(trigger).toBeFocused();
  await expect(trigger).not.toHaveAttribute('aria-disabled');
  await trigger.click();
  await page.getByRole('menuitem', { name: 'Переименовать' }).click();
  await page.getByRole('textbox', { name: 'Название списка' }).fill('Личные дела');
  await page.getByRole('textbox', { name: 'Название списка' }).press('Enter');
  await expect(page.getByText('Список с таким названием уже есть.', { exact: true })).toBeVisible();
  await expect(trigger).toHaveCount(1);
  await page.reload();
  await trigger.click();
  await expect(page.getByRole('menuitemradio', { name: 'Красный' })).toHaveAttribute(
    'aria-checked',
    'true',
  );
});

test('deleting the active list confirms, keeps tasks and navigates to Today', async ({ page }) => {
  await workspace(page, [
    makeTask({ id: 'a', title: 'Сохранить задачу', due_date: date(0), list_id: 'work' }),
  ]);
  await page.goto('/?listId=work');
  const trigger = page.getByRole('button', { name: 'Действия со списком Работа' });
  await trigger.click();
  await page.getByRole('menuitem', { name: 'Удалить' }).click();
  let dialog = page.getByRole('alertdialog', { name: 'Удалить список «Работа»?' });
  await expect(dialog.getByRole('button', { name: 'Отмена' })).toBeFocused();
  await dialog.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await trigger.click();
  await page.getByRole('menuitem', { name: 'Удалить' }).click();
  dialog = page.getByRole('alertdialog');
  await expect(dialog).toContainText('Задачи останутся, но без списка.');
  await dialog.getByRole('button', { name: 'Удалить', exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(
    page
      .getByRole('main')
      .getByRole('region', { name: 'Без списка' })
      .getByRole('link', { name: /Сохранить задачу/ }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole('main').getByRole('link', { name: /Сохранить задачу/ }),
  ).toBeVisible();
  await expect(trigger).toHaveCount(0);
});

test('touch list menu and reduced-motion subtasks remain usable at 375px', async ({
  page,
}, info) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 375, height: 812 });
  await workspace(page, [
    makeTask({ id: 'p', title: 'Проект', due_date: date(0) }),
    makeTask({ id: 'c', title: 'Шаг', parent_id: 'p' }),
  ]);
  await page.goto('/');
  await page.getByRole('button', { name: /показать подзадачи: Проект$/ }).click();
  const children = page.getByRole('list', { name: 'Подзадачи: Проект' });
  await expect(children).toBeVisible();
  await expect(children.locator('..')).toHaveCSS('opacity', '1');
  await page.getByRole('button', { name: 'Открыть меню' }).click();
  const drawer = page.getByRole('dialog', { name: 'Навигация' });
  const trigger = drawer.getByRole('button', { name: 'Действия со списком Работа' });
  await expect(trigger).toHaveCSS('opacity', '1');
  await trigger.click();
  await expect(drawer.getByRole('menu')).toBeVisible();
  await page.screenshot({ path: info.outputPath('list-menu-mobile.png'), fullPage: true });
  await drawer.getByRole('menuitem', { name: 'Удалить' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Отмена' }).click();
  await expect(trigger).toBeFocused();
});

test('@list tokens highlight and persist; the folder selection wins and unknown words stay literal', async ({
  page,
}) => {
  const { created } = await workspace(page);
  await page.goto('/?list=inbox');
  const input = page.getByRole('textbox', { name: 'Новая задача' });
  await input.fill('Отчёт @РАБОТА @неизвестно');
  await expect(page.locator('[data-token-kind="list"]')).toHaveText('@РАБОТА');
  await input.press('Enter');
  await expect.poll(() => created.length).toBe(1);
  expect(created[0]).toMatchObject({ title: 'Отчёт @неизвестно', list_id: 'work' });
  await page.getByRole('combobox', { name: 'Список для новой задачи' }).selectOption('home');
  await input.fill('Купить @работа');
  await input.press('Enter');
  await expect.poll(() => created.length).toBe(2);
  expect(created[1]).toMatchObject({ title: 'Купить', list_id: 'home' });
  await page.getByRole('combobox', { name: 'Список для новой задачи' }).selectOption('');
  await input.fill('Заметка @работа');
  await input.press('Enter');
  await expect.poll(() => created.length).toBe(3);
  expect(created[2]).toMatchObject({ title: 'Заметка', list_id: null });
  await page.reload();
  await page.getByRole('link', { name: /^Личные дела/ }).click();
  await expect(page.getByRole('main').getByRole('link', { name: /Купить/ })).toBeVisible();
});
