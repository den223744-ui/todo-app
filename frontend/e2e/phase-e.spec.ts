/// <reference lib="dom" />
import { expect, test, type Page } from '@playwright/test';
import { workspace } from './fixtures/phase-e';

test.use({ timezoneId: 'UTC' });

test('create keeps focus; pending creation has Undo and never deletes an optimistic id', async ({
  page,
}) => {
  const data = await workspace(page);
  data.holdCreate();
  await page.goto('/?list=inbox');
  const input = page.getByRole('textbox', { name: 'Новая задача' });
  await input.fill('Новое дело');
  await input.press('Enter');
  await expect(input).toBeFocused();
  await expect(page.getByText('Добавлено', { exact: true })).toBeVisible();
  await expect(page.locator('[data-task-row^="optimistic-"]')).toHaveCount(1);
  const deletes: string[] = [];
  page.on('request', (request) => {
    if (request.method() === 'DELETE') deletes.push(request.url());
  });
  await page.keyboard.press('Control+z');
  expect(deletes).toEqual([]);
  data.releaseCreate();
  await expect.poll(() => deletes.length).toBe(1);
  expect(deletes[0]).toContain('/tasks/created-1');
  await expect(page.getByRole('link', { name: 'Новое дело' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Отменить' })).toHaveCount(0);
});

test('hidden creation offers Undo and Show together; Show preserves its Undo', async ({ page }) => {
  const data = await workspace(page);
  await page.goto('/?list=inbox');
  const input = page.getByRole('textbox', { name: 'Новая задача' });
  await input.fill('Новое дело завтра');
  await input.press('Enter');
  await expect(page.getByRole('button', { name: 'Отменить' })).toHaveCount(1);
  await page.getByRole('button', { name: 'Показать' }).click();
  await expect(page).toHaveURL(/task=created-1/);
  await page.getByRole('button', { name: 'Отменить' }).click();
  await expect.poll(() => data.tasks().some((task) => task.id === 'created-1')).toBe(false);
});

test('delete and Undo animate rows, keep neighbouring focus and do not animate initial rows', async ({
  page,
}) => {
  await workspace(page);
  await page.goto('/?list=inbox');
  const first = page.locator('[data-task-link="inbox"]');
  const next = page.locator('[data-task-link="next"]');
  await expect(first).toBeVisible();
  await expect(page.locator('[data-task-row="inbox"]')).toHaveCSS('opacity', '1');
  await first.focus();
  await page.keyboard.press('Delete');
  await expect(next).toBeFocused();
  await expect(page.locator('[data-task-row="inbox"]')).toHaveCount(0);
  await page.keyboard.press('Control+z');
  await expect(first).toBeVisible();
  await expect(next).toBeFocused();
});

test('palette navigation focuses h1 and preserves the quick-add draft; search keeps its frame', async ({
  page,
}) => {
  await workspace(page);
  await page.goto('/?list=inbox');
  const input = page.getByRole('textbox', { name: 'Новая задача' });
  await input.fill('Мой черновик');
  await page.keyboard.press('Control+k');
  await page.getByRole('option', { name: 'Предстоящие', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Предстоящие' })).toBeFocused();
  await expect(input).toHaveValue('Мой черновик');
  const search = page.getByRole('searchbox');
  await search.fill('проект');
  const frame = await page
    .locator('[data-view-transition]:not([aria-hidden])')
    .last()
    .elementHandle();
  await search.fill('прогулка');
  expect(await frame.evaluate((element) => element.isConnected)).toBe(true);
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
});

test('details and help return focus; deletion of the active list focuses Today', async ({
  page,
}) => {
  await workspace(page);
  await page.goto('/?list=inbox');
  const row = page.locator('[data-task-link="inbox"]');
  await row.click();
  await page.getByRole('button', { name: 'Закрыть детали' }).click();
  await expect(row).toBeFocused();
  const help = page.getByRole('button', { name: 'Горячие клавиши' });
  await help.click();
  await page.keyboard.press('Escape');
  await expect(help).toBeFocused();
  await page.goto('/?listId=work');
  await page.getByRole('button', { name: 'Действия со списком Работа' }).click();
  await page.getByRole('menuitem', { name: 'Удалить', exact: true }).click();
  const dialog = page.getByRole('alertdialog');
  await expect(dialog.getByRole('button', { name: 'Отмена' })).toBeFocused();
  await dialog.getByRole('button', { name: 'Удалить', exact: true }).click();
  await expect(page.locator('[data-sidebar-today]')).toBeFocused();
  await expect(page).not.toHaveURL(/listId=work/);
});

test('375px: drawer and details return focus and keep their keyboard traps', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await workspace(page);
  await page.goto('/');
  const menu = page.getByRole('button', { name: 'Открыть меню' });
  await menu.click();
  await page
    .getByRole('dialog', { name: 'Навигация' })
    .getByRole('radio', { name: 'Как в системе' })
    .focus();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Закрыть меню' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(menu).toBeFocused();
  const row = page.locator('[data-task-link="timed"]');
  await row.click();
  const details = page.getByRole('dialog', { name: 'Детали задачи' });
  await details.getByRole('button', { name: 'Удалить задачу', exact: true }).focus();
  await page.keyboard.press('Tab');
  await expect(details.getByRole('button', { name: 'Закрыть детали' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(row).toBeFocused();
});

async function observeMotion(page: Page) {
  await page.evaluate(() => {
    const samples: { kind: string; transform: string; opacity: string }[] = [];
    const selector = '[data-view-transition], [data-toast], [data-task-details]';
    const sample = (element: Element) => {
      const nodes = [
        ...Array.from(element.querySelectorAll(selector)),
        ...(element.matches(selector) ? [element] : []),
      ];
      for (const node of nodes) {
        const style = getComputedStyle(node);
        samples.push({
          kind: node.hasAttribute('data-toast')
            ? 'toast'
            : node.hasAttribute('data-task-details')
              ? 'details'
              : 'view',
          transform: style.transform,
          opacity: style.opacity,
        });
      }
      document.documentElement.dataset.motionSamples = JSON.stringify(samples);
    };
    new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'attributes' && mutation.target instanceof Element)
          sample(mutation.target);
        for (const node of Array.from(mutation.addedNodes))
          if (node instanceof Element) sample(node);
      }
    }).observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style'],
    });
  });
}

test('reduced motion: first observed styles of transitions, toast and details are final', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await workspace(page);
  await page.goto('/?list=inbox');
  await observeMotion(page);
  const input = page.getByRole('textbox', { name: 'Новая задача' });
  await input.fill('Новая');
  await input.press('Enter');
  await page.locator('[data-task-link="inbox"]').click();
  await page.getByRole('button', { name: 'Закрыть детали' }).click();
  await page.keyboard.press('Control+k');
  await page.getByRole('option', { name: 'Предстоящие', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Предстоящие', level: 1 })).toBeFocused();
  const samples = await page.evaluate(
    () =>
      JSON.parse(document.documentElement.dataset.motionSamples ?? '[]') as {
        kind: string;
        transform: string;
        opacity: string;
      }[],
  );
  expect(new Set(samples.map((sample) => sample.kind))).toEqual(
    new Set(['toast', 'details', 'view']),
  );
  expect(samples.length).toBeGreaterThan(0);
  for (const sample of samples) {
    expect(['none', 'matrix(1, 0, 0, 1, 0, 0)']).toContain(sample.transform);
    expect(sample.opacity).toBe('1');
  }
});

test('keyboard focus rings cover native checkbox, grip, theme, palette and timeline controls', async ({
  page,
}) => {
  await workspace(page);
  await page.goto('/?list=inbox');
  await page.keyboard.press('Tab'); // Establish keyboard :focus-visible modality.
  for (const locator of [
    page.getByRole('checkbox', { name: 'Выполнить: Разобрать записи' }),
    page.getByRole('button', { name: 'Переместить «Разобрать записи»' }),
    page.getByRole('radio', { name: 'Как в системе' }),
    page.getByRole('button', { name: 'Горячие клавиши' }),
  ]) {
    await locator.focus();
    await expect(locator).toHaveCSS('outline-style', 'solid');
    await expect(locator).toHaveCSS('outline-width', '2px');
  }
  await page.keyboard.press('Control+k');
  await expect(page.getByRole('dialog').getByRole('combobox')).toHaveCSS('outline-width', '2px');
  await expect(page.locator('[cmdk-item][data-selected="true"]')).toHaveCSS('outline-width', '2px');
  await page.keyboard.press('Escape');
  await page.goto('/');
  await page.keyboard.press('Tab');
  const block = page.locator('[data-timeline-task="timed"]');
  await block.focus();
  await expect(block).toHaveCSS('outline-width', '2px');
});

test('keyboard drop resets the dnd transform without starting a second Framer layout movement', async ({
  page,
}) => {
  await workspace(page);
  await page.goto('/?list=inbox');
  const handle = page.getByRole('button', { name: 'Переместить «Проверить почту»' });
  await handle.focus();
  await handle.press('Space');
  await expect(handle).toHaveAttribute('aria-pressed', 'true');
  // KeyboardSensor installs its listeners after pickup; repeated first arrows stop at the top.
  await expect(async () => {
    await page.keyboard.press('ArrowUp');
    await expect(
      page.getByText('«Проверить почту»: позиция 1 из 2', { exact: false }),
    ).toBeAttached({ timeout: 500 });
  }).toPass();
  await page.keyboard.press('Space');
  // dnd-kit drops aria-pressed after the drop instead of setting it to false.
  await expect(handle).not.toHaveAttribute('aria-pressed', 'true');
  const samples = await page.locator('[data-task-row="next"]').evaluate(async (row) => {
    const transforms: string[] = [];
    for (let frame = 0; frame < 3; frame++) {
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => {
          resolve();
        }),
      );
      transforms.push(
        getComputedStyle(row).transform,
        getComputedStyle(row.firstElementChild as Element).transform,
      );
    }
    return transforms;
  });
  expect(samples).toEqual(Array<string>(6).fill('none'));
});
