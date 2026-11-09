/// <reference lib="dom" />
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { workspace } from './fixtures/phase-e';

test.use({ timezoneId: 'UTC' });
const tags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
type State =
  | 'today'
  | 'inbox'
  | 'empty'
  | 'details'
  | 'palette'
  | 'help'
  | 'delete-list'
  | 'toast'
  | 'list-menu'
  | 'drawer'
  | 'search'
  | 'timeline';

async function openState(page: Page, state: State) {
  await workspace(page);
  await page.goto(state === 'inbox' ? '/?list=inbox' : state === 'empty' ? '/?listId=empty' : '/');
  await expect(
    page.locator('[data-task-link="timed"], [data-task-link="inbox"]').first(),
  ).toBeVisible();
}

for (const theme of ['light', 'dark'] as const) {
  for (const mobile of [false, true]) {
    test.describe(`${theme}, ${mobile ? '375px' : 'desktop'}`, () => {
      test.use({
        viewport: { width: mobile ? 375 : 1440, height: 900 },
        colorScheme: theme === 'light' ? 'dark' : 'light',
      });
      const states: State[] = [
        'today',
        'inbox',
        'empty',
        'details',
        'palette',
        'help',
        'delete-list',
        'toast',
        'list-menu',
        ...(mobile ? (['drawer', 'search', 'timeline'] as const) : []),
      ];
      for (const state of states) {
        test(`axe: ${state}`, async ({ page }, info) => {
          await page.addInitScript((value) => {
            localStorage.setItem('tood-theme', value);
          }, theme);
          // The empty view has no rows; open it after checking that initial data loaded.
          await openState(page, state === 'empty' ? 'today' : state);
          if (state === 'empty') {
            await page.goto('/?listId=empty');
            await expect(page.getByText('В этом списке пока нет задач')).toBeVisible();
          }
          if (state === 'details') {
            await page.locator('[data-task-link="timed"]').click();
            await expect(page.getByRole('heading', { name: 'Детали задачи' })).toBeFocused();
          }
          if (state === 'palette') await page.keyboard.press('Control+k');
          if (state === 'help') await page.keyboard.press('?');
          if (state === 'drawer' || ((state === 'delete-list' || state === 'list-menu') && mobile))
            await page.getByRole('button', { name: 'Открыть меню' }).click();
          if (state === 'list-menu') {
            await page.getByRole('button', { name: 'Действия со списком Работа' }).click();
            await expect(page.getByRole('menu')).toBeVisible();
          }
          if (state === 'delete-list') {
            await page.getByRole('button', { name: 'Действия со списком Работа' }).click();
            await page.getByRole('menuitem', { name: 'Удалить', exact: true }).click();
            await expect(page.getByRole('alertdialog')).toBeVisible();
          }
          if (state === 'search') {
            await page.getByRole('button', { name: 'Открыть поиск' }).click();
            await page.getByRole('searchbox').fill('проект');
          }
          if (state === 'timeline') await page.getByRole('tab', { name: 'Таймлайн' }).click();
          if (state === 'toast') {
            const input = page.getByRole('textbox', { name: 'Новая задача' });
            await input.fill('Подготовить отчёт послезавтра');
            await input.press('Enter');
            await expect(page.getByRole('button', { name: 'Показать', exact: true })).toBeVisible();
            await expect(page.getByRole('button', { name: 'Отменить' })).toBeVisible();
          }
          await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
          if (state === 'palette')
            await expect(page.getByRole('dialog', { name: 'Палитра команд' })).toBeVisible();
          if (state === 'help')
            await expect(page.getByRole('dialog', { name: 'Горячие клавиши' })).toBeVisible();
          // No exclusions and no disabled rules: all rendered UI must pass.
          const results = await new AxeBuilder({ page }).withTags(tags).analyze();
          await info.attach('axe-results', {
            body: JSON.stringify(results, null, 2),
            contentType: 'application/json',
          });
          expect(results.violations).toEqual([]);
          await page.screenshot({ path: info.outputPath(`${state}.png`), fullPage: true });
        });
      }
    });
  }
}
