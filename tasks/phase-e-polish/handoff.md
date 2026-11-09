# Передача: фаза E, E0–E2

Дата: 2026-11-09. Работа выполнена в предоставленном worktree, ветка
`claude/strange-taussig-41658b` не переключалась, HEAD остался `1a1b8af`.
Коммитов и staging нет. Backend, `frontend/src/api/schema.ts`, package.json,
package-lock.json, HighlightedInput и пользовательские данные не менялись.
Существующий `tasks/phase-e-polish/brief.md` сохранён без изменений.
`tasks/ACTIVE.md` сообщал, что занятых файлов нет. Прочитаны AGENTS, SPEC,
PLAN, план stage-3-ui и handoff A–D. Подробное задание пользователя определяет
рамки этой фазы; сохранены тёплая палитра, контурные элементы и Roboto Condensed.

## Реализация и решения

- **E0, создание.** Общий `useUndoableCreate` используется быстрым вводом и
  подзадачами деталей. Тост «Добавлено» с основным действием «Отменить» появляется
  сразу при отправке POST, срок — `UNDO_MS = 5000`. После сохранения QuickAdd
  обновляет этот же тост названием назначения и необязательным вторым действием
  «Показать». Сохраняется определение фактической видимости из фазы A, включая
  смену раздела во время запроса. Обновление не создаёт повторный тост и не
  возобновляет срок отмены. «Показать» убирает только себя, Undo остаётся.
  Undo через кнопку или Ctrl/Cmd+Z дожидается именно своего POST и вызывает
  существующий soft delete с серверным id. Временный id не отправляется в DELETE.
  При отказе POST нечего удалять: предложение отмены убирается, ошибку сообщает
  прежний обработчик мутаций, черновик восстанавливается. Отменённый/закрытый
  тост не возвращается при позднем ответе. Если после «Показать» были открыты
  детали созданной задачи, Undo закрывает их и возвращает фокус в быстрый ввод.
- **E0, остальные действия.** `useTaskActions.change` и чистая `domain/undo.ts`
  восстанавливают только затронутые свойства. Отмена есть у выполнения и возврата
  в работу, удаления родителя/подзадачи, даты/времени (включая очистку даты со
  временем), длительности, списка, приоритета и тегов. Общие actions используются
  строками, деталями, хоткеями и палитрой. Сохранены массовый перенос просроченных
  на сегодня с одним тостом и отменой только успешных записей, команды на
  сегодня/завтра и серия стрелок таймлайна с одним тостом/исходным временем.
  Ошибки одиночных действий убирают их Undo через `mutateAsync`, поэтому
  перекрывающиеся вызовы не теряют обработчик раннего запроса.
  Переименование и заметка остаются без Undo: до сохранения есть Esc.
  Перестановка сохраняет решение D без Undo; удаление самого списка сохраняет
  отдельное подтверждение, у существующего API нет восстановления списка.
- **E0, тосты.** `secondaryAction` обратно совместим со старыми тостами;
  Ctrl/Cmd+Z выбирает только основное действие с `undo: true`. Добавлен
  `updateToast`. Абсолютный `expiresAt` сохраняет исходный срок при перемещении
  тостов внутрь мобильных деталей; истёкший Undo не выполняется даже до удаления
  его DOM. Сохранены лимит трёх уведомлений и прежняя дедупликация ошибок.
- **E1, строки.** AnimatePresence с `initial={false}` стоит на группах и строках;
  вход/выход — opacity + height за 200 мс. Пустой результат больше не размонтирует
  весь TaskList, поэтому последняя строка тоже заканчивает exit. Первая загрузка,
  скелетон → список и новый вид не запускают поштучный вход. UI-ключ сохранённого
  id связывается с optimistic id через WeakMap на QueryClient: ответ POST меняет
  данные существующего DOM-узла, без повторного enter/exit. Аналогичная анимация
  есть у подзадач деталей. Серверное состояние остаётся в Query, не в Zustand.
  dnd-transform остаётся на внешнем `li`, Framer `layout="position"` — внутри.
  Layout выключен при drag/reduced motion; состав/выполнение, а не ручной порядок,
  задают layoutDependency. Сохранены сенсоры и container queries фазы D.
  Layout явно использует tween/easeOut за 220 мс, без пружины.
- **E1, чекбоксы.** Общий TaskCheckbox сохраняет нативный checkbox, checked,
  доступное имя и aria-disabled. Над ним декоративный SVG с pathLength за 180 мс;
  checked использует `--check`. Применён в строках, раскрытых подзадачах и деталях.
  В forced colors возвращается нативный вид. Зачёркивание названий плавно меняет
  textDecorationColor, включая поля названия в деталях и подзадачах.
- **E1, переходы.** Заголовок, итоги и список меняются кросс-фейдом за 180 мс
  со сдвигом 6 px. Направление дней передаётся также уходящему кадру: вперёд
  старый кадр уходит вправо, назад — влево. Ключ включает view/тег/listId/день,
  исключает query и taskId. Поиск не перезапускает переход на каждой букве.
  Уходящие список и мобильный таймлайн получают снимок location, сохраняя прежние
  фильтры до конца перехода. QuickAdd, поиск и кнопки дней сохраняют свои узлы,
  черновики и фокус. Тосты появляются снизу/уходят вниз за 180 мс, стек имеет layout.
  Детали въезжают справа за 200 мс и сохраняют данные до завершения exit.
  Drawer выезжает слева с затемнением за 200 мс. Палитра/help — fade + подъём 6 px
  за 180 мс; нативный диалог удаления списка сохраняет showModal и закрывается
  после своего exit. Логотип заменил подпрыгивание на короткую волну opacity.
  При reduce явные initial выключены, exit без сдвигов/высоты, duration = 0,
  layout отключён. Масштабирование и новые пружины не добавлены.
- **E2, семантика и фокус.** `useInertOnExit` обновляет inert через layout effect:
  одного ref callback Motion недостаточно при смене presence. Уходящие строки,
  кадры, тосты и оверлеи сразу получают aria-hidden/inert. Они исключены из
  поиска соседей и определения активной модальности. Фокус-ловушка пропускает
  скрытые/уходящие элементы и уступает верхнему модальному окну. Возврат фокуса
  у палитры/help/drawer происходит при начале выхода, поэтому следующая команда
  не блокируется до окончания анимации. После перехода палитрой выбран `h1`
  нового вида (`tabIndex=-1`); доступный h1 один, уходящий скрыт от accessibility tree.
  Создание сохраняет фокус ввода, Undo удаления/выполнения сохраняет логику соседа D.
  Удаление подзадачи фокусирует соседнее название или ввод подзадачи.
  После удаления списка десктоп фокусирует «Сегодня»; на телефоне drawer уже
  закрыт, фокус возвращается на доступную кнопку меню. Тосты внутри мобильных
  деталей доступны его Tab-ловушке; одновременно смонтирован один Toaster/live region.
  Ctrl/Cmd+Z разрешён в деталях, поля с текстом сохраняют собственный Undo.
- **E2, видимый фокус.** Общее правило `:focus-visible` вынесено также за CSS layers,
  чтобы utility `outline-none` не скрывал его у поиска/палитры/заголовков.
  Контур — 2 px `--check`, offset 2 px; checkbox — offset 3 px. Активный пункт
  cmdk получает контур при клавиатурном фокусе его input. Новые правила не
  используют `:focus`, поэтому мышиный клик сам по себе не включает этот контур.
- **E2, автоматический аудит.** Новый `a11y.spec.ts`: 42 сценария, две темы с
  противоположной системной схемой, 1440 и 375 px. Состояния: Сегодня с задачами,
  таймлайн, Входящие, пустой список, детали, палитра, help, удаление списка,
  меню списка, двухкнопочный тост; дополнительно мобильные drawer/поиск/вкладка
  таймлайна. AxeBuilder использует wcag2a/wcag2aa/wcag21a/wcag21aa, ожидает
  `violations = []`, без exclusions и отключённых правил. Результаты и скриншоты
  сохраняются при реальном запуске. Ещё 9 новых e2e проверяют Undo до POST,
  «Показать» + Undo, фокус, reduced motion с наблюдением первых computed styles,
  кольца фокуса и отсутствие второго transform после keyboard drop.
  Все новые e2e используют API-фикстуры в памяти и фиксированную UTC-дату;
  setFixedTime не останавливает таймеры, pauseAt не используется.

## Контраст: изменения и расчёты

Расчёт по WCAG relative luminance, без округления перед сравнением. Это проверка
значений токенов по коду; результаты браузерного axe пока не получены.

| Светлая тема, цвет текста / фон | Было | Стало | Контраст до → после |
| --- | --- | --- | --- |
| `--ink-faint` / canvas `#f9f4f1` | `#7a7370` | `#716a67` | 4,262 → 4,859 |
| `--ink-faint` / surface `#fffdfb` | `#7a7370` | `#716a67` | 4,585 → 5,227 |
| `--ink-faint` / subtle `#f3ede9` | `#7a7370` | `#716a67` | 4,010 → 4,571 |
| `--accent-fg` / оранжевая плашка `#ed7431` | `#ffffff` | `#26221f` | 2,940 → 5,367 |

Другие значения токенов не менялись. `--ink-muted` в светлой теме:
5,314 / 5,716 / 4,999 на canvas / surface / subtle. В тёмной теме соответственно
`--ink-faint`: 6,340 / 5,744 / 5,107, `--ink-muted`: 8,203 / 7,433 / 6,609.
Контур `--check`: 4,637 на светлом subtle и 6,592 на тёмном surface.
Убраны opacity-60 у выполненных блоков таймлайна и opacity-75 у их мелких подписей,
чтобы исходный контраст токена не уменьшался прозрачностью. Цвета списков сохранены.
Расчёты: `frontend/.vite/phase-e-contrast.txt`.

## Проверки

- `npm run lint` — успешно, 0 ошибок и предупреждений.
- `npm run typecheck` — успешно.
- `npm run format:check` — успешно.
- Штатный `npm run test:coverage` — **не запустился**, `spawn EPERM` при старте
  esbuild для vite.config.ts. Лог: `.vite/phase-e-standard-coverage.log`.
- Полный Vitest через адаптер, **TZ=UTC: 70 файлов, 726 тестов — все прошли**.
  `domain/`: **100% statements / branches / functions / lines**, включая undo.ts.
  Все файлы: 98,80% statements/lines, 94,83% branches, 91,66% functions.
  Пороги не ослаблялись. Адаптер скопирован из D: typescript.transpileModule,
  ESNext/React JSX, source maps/inline sources, preserveSymlinks, threads,
  maxWorkers=2, native config loader. Продуктовый vite.config и scripts не менялись.
  Команда: `npm run test:coverage -- --config .vite/phase-e.validation.mjs --configLoader native`.
  Адаптер/лог: `.vite/phase-e.validation.mjs`, `.vite/phase-e-coverage.log`;
  HTML: `coverage/index.html` — игнорируемые артефакты.
- Полный Vitest без coverage с тем же адаптером, **TZ=Pacific/Kiritimati:
  70 файлов, 726 тестов — все прошли**. Лог: `.vite/phase-e-kiritimati.log`.
- `npx playwright test --list` — **100 тестов в 10 файлах**, включая 42 axe и
  9 phase-e. Лог: `.vite/phase-e-playwright-list.log`.
- Попытка выполнения D/E/axe: собраны 58 сценариев до добавления последнего
  отдельного теста drop, **0 выполнено**. `spawn EPERM` в WorkerHost.startRunner
  до создания worker. Лог: `.vite/phase-e-browser.log`. Ранее отдельно D также
  остановилась на запуске worker. Ни одного результата axe или скриншота нет.
- `git diff --check` — успешно; запрещённые файлы и HighlightedInput имеют пустой diff.
  Git запускался с разовым `-c safe.directory`, глобальный config не менялся.

Добавлено 16 unit/component-тестов. Старые сценарии сохранены; изменены ожидания
нового основного Undo/вторичного Show и пятисекундного срока создания. Ожидания
выхода DOM переведены на waitFor, без увеличения таймаутов. В jsdom добавлен
пустой window.scrollTo, поскольку Framer измеряет высоту с сохранением прокрутки.

## Ограничения и что осталось подтвердить

Штатный coverage не зелёный: успешен адаптированный прогон. Сбор e2e не равен
выполнению. **Нельзя заявить 0 нарушений axe:** браузерный аудит заблокирован
до запуска. Реальные enter/exit, reduced motion, mouse/touch и keyboard DnD,
отсутствие скачка после drop, геометрия 375 px и браузерные кольца/возврат фокуса
пока не подтверждены Chromium. Ожидания для них написаны, но возможны дополнительные
исправления после реального прогона. Визуальных скриншотов этой фазы нет.

Нужно запустить из frontend в среде с разрешёнными дочерними процессами и
dev-сервером именно этого worktree на 5173:

```powershell
npm run lint
npm run typecheck
npm run format:check
npm run test:coverage
$env:TZ = 'UTC'
npm run test
$env:TZ = 'Pacific/Kiritimati'
npm run test
npx playwright test e2e/a11y.spec.ts e2e/phase-e.spec.ts e2e/phase-d.spec.ts
```

Как и в D, bulk PATCH не атомарен: при частичном отказе возвращаются только
успешные записи. Компенсирующая отмена создания — отдельный DELETE после POST;
если DELETE отклонён, созданная задача остаётся, существующий mutationToast
сообщает ошибку и мутация восстанавливает её в кеше.

## Изменённые файлы

Относительно корня репозитория, кроме этого handoff; исходный brief не изменён:

```text
frontend/e2e/a11y.spec.ts
frontend/e2e/fixtures/phase-e.ts
frontend/e2e/phase-a.spec.ts
frontend/e2e/phase-e.spec.ts
frontend/src/App.tsx
frontend/src/components/AnimatedListItem.tsx
frontend/src/components/AppShell.tsx
frontend/src/components/BrandLogo.tsx
frontend/src/components/MobileDrawer.tsx
frontend/src/components/ShortcutDialog.tsx
frontend/src/components/TaskCheckbox.tsx
frontend/src/components/TaskTitle.tsx
frontend/src/components/ViewFrame.tsx
frontend/src/components/ViewTransition.tsx
frontend/src/components/useFocusTrap.ts
frontend/src/components/useInertOnExit.ts
frontend/src/constants/texts.ts
frontend/src/domain/undo.test.ts
frontend/src/domain/undo.ts
frontend/src/features/details/DetailsPanel.tsx
frontend/src/features/details/SubtaskList.tsx
frontend/src/features/details/SubtaskTitle.tsx
frontend/src/features/details/TaskDetails.tsx
frontend/src/features/details/TaskDetailsContainer.tsx
frontend/src/features/quick-add/QuickAdd.test.tsx
frontend/src/features/quick-add/QuickAdd.tsx
frontend/src/features/shortcuts/CommandPalette.tsx
frontend/src/features/shortcuts/GlobalShortcuts.tsx
frontend/src/features/shortcuts/ShortcutHelp.tsx
frontend/src/features/shortcuts/focus.ts
frontend/src/features/sidebar/DeleteListDialog.tsx
frontend/src/features/sidebar/SidebarContainer.tsx
frontend/src/features/sidebar/SidebarLink.tsx
frontend/src/features/sidebar/SidebarListItem.test.tsx
frontend/src/features/sidebar/SidebarListItem.tsx
frontend/src/features/tasks/InlineSubtasks.tsx
frontend/src/features/tasks/PhaseB.test.tsx
frontend/src/features/tasks/PhaseE.test.tsx
frontend/src/features/tasks/TaskList.tsx
frontend/src/features/tasks/TaskListContainer.tsx
frontend/src/features/tasks/TaskRow.tsx
frontend/src/features/tasks/Undo.test.tsx
frontend/src/features/tasks/taskMutations.ts
frontend/src/features/tasks/taskPresentation.ts
frontend/src/features/tasks/useTaskActions.ts
frontend/src/features/tasks/useUndoableCreate.ts
frontend/src/features/timeline/Timeline.tsx
frontend/src/features/timeline/TimelineBlock.tsx
frontend/src/features/timeline/TimelineContainer.tsx
frontend/src/features/toasts/ToastItem.tsx
frontend/src/features/toasts/Toaster.test.tsx
frontend/src/features/toasts/Toaster.tsx
frontend/src/features/toasts/UndoShortcut.tsx
frontend/src/index.css
frontend/src/store/toastStore.test.ts
frontend/src/store/toastStore.ts
frontend/src/test/setup.ts
```

## Приёмка Claude Code (2026-11-09)

Codex упёрся в лимит использования после записи handoff. Штатные проверки в нормальной среде:
lint, typecheck, format:check — успешно; test:coverage — 726/726, `domain/` 100%;
TZ=UTC и TZ=Pacific/Kiritimati — 726/726; `npx playwright test` — 100/100
(и 200/200 с `--repeat-each 2`), включая 42 axe-проверки с 0 нарушений.

Исправлено по итогам реального прогона e2e/axe:
- axe `label-content-name-mismatch` (WCAG 2.5.3): имя кнопки подзадач теперь
  начинается с видимого счётчика — «1/3, показать подзадачи: …».
- axe `scrollable-region-focusable`: прокручиваемый список в «?» фокусируем
  (`tabIndex=0`, `role=region`).
- Анимация групп (`motion.section` в AnimatePresence) не завершала exit: при поиске
  старые группы оставались в DOM рядом с «Найдено». Анимация на уровне групп снята,
  строки по-прежнему появляются/уходят анимированно.
- Фокус-ловушка учитывала скрытую CSS-ом кнопку и radio с tabindex=-1 — Tab уходил
  из мобильного drawer. Теперь только достижимые Tab-ом и видимые элементы.
- Тесты: устаревший селектор названия (`[data-task-title]`), combobox палитры в диалоге,
  dnd-kit снимает `aria-pressed` после drop, 375px-проверка границ одним проходом,
  Undo-тост на фейковых часах проверяется по исчезновению «Отменить» из дерева доступности.
