import { expect, test } from '@playwright/test';

import type { TaskListRead, TaskRead } from '../src/api/schema';

function task(id: string, fields: Partial<TaskRead>): TaskRead {
  return {
    id,
    title: id,
    parent_id: null,
    list_id: null,
    notes: null,
    priority: 0,
    due_date: null,
    due_time: null,
    tags: [],
    position: 1,
    completed_at: null,
    created_at: '2026-11-08T10:00:00Z',
    updated_at: '2026-11-08T10:00:00Z',
    ...fields,
  };
}

const fixtures = [
  task('overdue', {
    title: 'Отправить отчёт по проекту',
    due_date: '2026-11-07',
    due_time: '18:30:00',
    priority: 3,
    tags: ['работа'],
    list_id: 'work',
  }),
  task('today', {
    title: 'Купить продукты на неделю',
    due_date: '2026-11-08',
    priority: 2,
    tags: ['дом', 'покупки'],
  }),
  task('long', {
    title:
      'Проверить адаптивную вёрстку и перенос очень длинного названия задачи на маленьком экране',
    due_date: '2026-11-08',
    due_time: '20:00:00',
    priority: 1,
    tags: ['очень-длинный-тег-для-проверки-переноса-на-мобильном-экране'],
  }),
  task('future', { title: 'Спланировать следующую неделю', due_date: '2026-11-10' }),
  task('inbox', { title: 'Разобрать заметки', tags: ['работа'] }),
];

const lists: TaskListRead[] = [
  {
    id: 'work',
    name: 'Работа',
    color: 'blue',
    position: 1,
    created_at: '2026-11-08T10:00:00Z',
    updated_at: '2026-11-08T10:00:00Z',
  },
];

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date(2026, 10, 8, 12) });
  await page.route('**/api/tasks', (route) => route.fulfill({ json: fixtures }));
  await page.route('**/api/lists', (route) => route.fulfill({ json: lists }));
});

test('task groups, URL navigation and history', async ({ page }, testInfo) => {
  await page.goto('/');
  const main = page.getByRole('main');
  await expect(main.getByRole('heading', { level: 2 })).toHaveText(['Работа', 'Без списка']);
  await expect(main.getByRole('checkbox')).toHaveCount(3);
  await expect(main.getByRole('link', { name: /Отправить отчёт/ })).toContainText('18:30');
  await expect(main.getByRole('link', { name: /Отправить отчёт/ })).toBeVisible();
  await page.clock.runFor(100);
  await page.screenshot({ path: testInfo.outputPath('tasks-desktop.png'), fullPage: true });
  await main.getByRole('link', { name: /Купить продукты/ }).click();
  await expect(page).toHaveURL(/task=today/);
  await expect(main.getByRole('link', { name: /Купить продукты/ })).toHaveAttribute(
    'aria-current',
    'true',
  );
  await page.getByRole('link', { name: 'Предстоящие 1' }).click();
  await expect(page).toHaveURL(/list=upcoming$/);
  await expect(main.getByRole('heading', { level: 2 })).toContainText('10 ноября');
  await page.goBack();
  await expect(main.getByRole('heading', { level: 2 })).toHaveText(['Работа', 'Без списка']);
});

test('mobile drawer, dark theme and long content fit 375px', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');
  await expect(page.getByRole('main').getByRole('checkbox')).toHaveCount(3);
  for (const item of await page.getByRole('main').locator('li:visible, a:visible, time:visible, span:visible').all()) {
    const bounds = await item.boundingBox();
    expect(bounds).not.toBeNull();
    if (bounds) {
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(375);
    }
  }
  await page.clock.runFor(100);
  await page.screenshot({ path: testInfo.outputPath('tasks-mobile-dark.png'), fullPage: true });
  await page.getByRole('button', { name: 'Открыть меню' }).click();
  await page.getByRole('dialog').getByRole('link', { name: 'Предстоящие 1' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('main').getByRole('link', { name: /Спланировать/ })).toBeVisible();
});

test('failed completion rolls back task and sidebar count', async ({ page }) => {
  await page.route('**/api/tasks/overdue', (route) =>
    route.fulfill({
      status: 503,
      json: { error: { code: 'unavailable', message: 'Unavailable' } },
    }),
  );
  await page.goto('/');
  await page.getByRole('checkbox', { name: 'Выполнить: Отправить отчёт по проекту' }).click();
  await expect(page.getByRole('region', { name: 'Уведомления' })).toContainText('оно отменено');
  await expect(
    page.getByRole('checkbox', { name: 'Выполнить: Отправить отчёт по проекту' }),
  ).not.toBeChecked();
  await expect(page.getByRole('link', { name: 'Сегодня 3' })).toBeVisible();
});
