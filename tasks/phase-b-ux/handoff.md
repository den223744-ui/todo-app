# Передача: фаза B, B1–B5

Дата: 2026-11-09. Ветка: `stage-3-design` по прямому указанию пользователя.
Коммитов нет. Backend, API-схемы, зависимости и пользовательские данные не менялись.
Перед началом рабочая директория была чистой; `tasks/ACTIVE.md` сообщал, что занятых
файлов нет. Прочитаны `AGENTS.md`, `SPEC.md`, `PLAN.md`, материалы stage-3-ui и handoff A.

## Реализация и решения

- **B1.** В строке родителя — счётчик выполненных подзадач и шеврон с
  `aria-expanded`, именем действия и связью `aria-controls`. Подзадачи раскрываются
  внутри той же карточки группы; их заголовки не открывают панель деталей.
  Выбор и подсчёт — чистые `selectSubtasks` / `subtaskProgress` в domain.
  `uiStore.expandedTaskIds` хранит только UI-состояние и переживает смену раздела.
  Выполнение использует существующий `useTaskActions` → update-мутацию; pending и
  `optimistic-` id блокируют повторную запись, сохраняя возможность фокуса.
  Выполненные названия зачёркнуты. Раскрытие высоты/прозрачности — AnimatePresence
  и Framer Motion; reduced motion отключает переход и layout-анимацию строки.
- **B2.** «На сегодня» видна у невыполненных просроченных задач при hover/focus,
  всегда у выбранной строки, на узком экране и при отсутствии точного hover.
  Над разделом просроченных — перенос всех с числом задач. Отбор — `selectList`
  из smartLists, дата вычисляется повторно на момент нажатия. PATCH содержит
  только `due_date`, поэтому время сохраняется. Один Undo-тост на пакет,
  Ctrl/Cmd+Z поддерживается прежним механизмом. API не даёт атомарного bulk:
  ошибки отдельных PATCH откатываются независимо, Undo возвращает исходные даты
  только успешных записей. Undo во время записи дожидается её результата;
  при отказе всех PATCH предложение отмены убирается. Строка возвращает фокус
  на свою ссылку, соседнюю задачу либо быстрый ввод, если исчезает из раздела.
- **B3.** Чистая `dayHeading(day, now)` выдаёт «Завтра», «Послезавтра», затем
  короткий день недели и дату; год добавляется для другого календарного года.
  Календарные операции работают без деления миллисекунд, включая DST/смену года.
  В дневных группах «Предстоящих» и группе «Завтра» на «Сегодня» — только время;
  без времени дата в строке не дублируется. Поиск/тег/пользовательский список и
  просроченные на «Сегодня» сохраняют прежнее отображение дат.
- **B4.** У сохранённых списков — контурная кнопка действий. Меню поддерживает
  стрелки, Home/End, Enter/Space, Esc, выход Tab и закрытие кликом снаружи.
  ArrowUp открывает с последнего пункта; Esc возвращает фокус на кнопку.
  Переименование заменяет строку полем: Enter сохраняет, Esc отменяет, IME Enter
  не отправляет. Шесть контурных цветов — `menuitemradio`, на маленькой ширине
  размещены в две строки, чтобы сохранить зоны касания. Удаление — нативный
  модальный `dialog` с ролью `alertdialog`, начальный фокус на «Отмена».
  Перед возвратом фокуса вызывается `close()`, снимающий inert с фона.
  Подтверждение закрывает мобильный drawer; после успеха открытый удалённый
  список сменяется на «Сегодня», если пользователь ещё не ушёл с него сам.
  `updateListMutation` / `deleteListMutation` оптимистичны; откат адресный,
  посторонние правки задач/списков не теряются. Удаление сразу обнуляет list_id
  в кеше задач, на ошибке восстанавливает связи ещё не переназначенных задач.
  Счётчики pending защищают от фонового refetch; записи списков сериализованы
  через mutation scope. Ошибки идут через meta.kind и mutationToast, включая 409.
- **B5.** `parseQuickAdd(input, now, lists)` понимает `@Имя` и уникальное первое
  слово многословного имени; регистр и ё/е не различаются. Неизвестные/неоднозначные
  упоминания остаются текстом. Первое распознанное упоминание побеждает, повторы
  сохраняются в названии. Токен `list` подсвечен цветом существующего `--check`.
  Приоритет выбора реализован в domain: папка → токен → открытый список.
  Явное «Без списка» также перекрывает токен; исчезнувшая папка игнорируется.
  Несохранённые списки исключены из распознавания. Подсказка обновлена.

Все новые UI-тексты — в `constants/texts.ts`; цвета/фокус/контуры используют
текущие токены `index.css`. Один компонент — один файл. Новых экранов нет.

## Проверки

- `npm run lint` — успешно, 0 ошибок и предупреждений.
- `npm run typecheck` — успешно.
- `npm run format:check` — успешно.
- Штатный `npm run test:coverage` — **не запускается**: `spawn EPERM` при запуске
  esbuild для чтения `vite.config.ts`.
- Полный Vitest через временный адаптер без дочернего esbuild-процесса:
  **53 файла, 648 тестов — все прошли**. Весь `domain/`:
  **100% statements, branches, functions, lines**. Пороги не ослаблялись.
  Адаптер использует `typescript.transpileModule`, ESNext/React JSX, source maps
  с inline sources, `preserveSymlinks`, `pool=threads`, `maxWorkers=2`, native
  загрузку конфига. Основные `vite.config.ts` и package scripts не менялись.
  Копия адаптера и логи оставлены в игнорируемом `frontend/test-results/`.
- `npx playwright test` — **не выполнен**: собраны **34 теста**, но запуск workers
  заканчивается `spawn EPERM` до выполнения сценариев. `--list` успешно собирает
  **34 теста в 6 файлах**, из них **8 новых** в `phase-b.spec.ts`.
- Dev-сервер `http://localhost:5173` отвечает HTTP 200.
- `git diff --check` — успешно. Git запускался с разовым `-c safe.directory`,
  глобальная конфигурация не менялась.

Новые тесты проверяют подзадачи/счётчики/блокировки/откат, одиночный и массовый
перенос с Undo, раннюю отмену и частичный отказ, формат дат, мутации списков,
меню/переименование/цвета/подтверждение/навигацию, парсер и QuickAdd.
Браузерные фикстуры фазы B задают UTC и фиксируют только Date через setFixedTime:
таймеры Query продолжают работать. Убран pauseAt из e2e фазы A; старые ожидания
заголовков обновлены в компонентном тесте и task-list e2e.

## Ограничения и что проверить вручную

Реальная геометрия на 375px, анимация высоты, reduced motion, нативная модальность
и возврат фокуса в Chromium **не подтверждены**, e2e нельзя считать зелёными.
Дополнительный просмотр через computer-use был отклонён инструментом:
`Computer Use was not approved to use Google Chrome`. Скриншоты не получены.
Нужно выполнить обычные проверки в среде, разрешающей дочерние процессы:

```powershell
cd frontend
npm run lint
npm run typecheck
npm run format:check
npm run test:coverage
npx playwright test
```

## Изменённые файлы

Относительно корня репозитория, помимо этого handoff:

```text
frontend/src/constants/texts.ts
frontend/src/index.css
frontend/src/domain/dayHeading.ts
frontend/src/domain/dayHeading.test.ts
frontend/src/domain/listCache.ts
frontend/src/domain/listCache.test.ts
frontend/src/domain/subtasks.ts
frontend/src/domain/subtasks.test.ts
frontend/src/domain/quickAdd.ts
frontend/src/domain/quickAdd.test.ts
frontend/src/domain/quickAddInput.ts
frontend/src/domain/quickAddLists.test.ts
frontend/src/store/uiStore.ts
frontend/src/store/uiStore.test.ts
frontend/src/features/tasks/TaskRow.tsx
frontend/src/features/tasks/InlineSubtasks.tsx
frontend/src/features/tasks/TaskList.tsx
frontend/src/features/tasks/TaskListContainer.tsx
frontend/src/features/tasks/TaskListContainer.test.tsx
frontend/src/features/tasks/useTaskActions.ts
frontend/src/features/tasks/PhaseB.test.tsx
frontend/src/features/lists/listMutations.ts
frontend/src/features/lists/listMutations.test.ts
frontend/src/features/lists/listQueries.ts
frontend/src/features/lists/pendingListMutations.ts
frontend/src/features/lists/useLists.ts
frontend/src/features/sidebar/Sidebar.tsx
frontend/src/features/sidebar/SidebarContainer.tsx
frontend/src/features/sidebar/SidebarListItem.tsx
frontend/src/features/sidebar/SidebarListItem.test.tsx
frontend/src/features/sidebar/DeleteListDialog.tsx
frontend/src/features/quick-add/QuickAdd.tsx
frontend/src/features/quick-add/QuickAdd.test.tsx
frontend/src/features/quick-add/HighlightedInput.tsx
frontend/src/features/quick-add/ListPicker.tsx
frontend/src/features/toasts/mutationToast.ts
frontend/src/features/toasts/mutationToast.test.ts
frontend/e2e/phase-a.spec.ts
frontend/e2e/phase-b.spec.ts
frontend/e2e/task-list.spec.ts
```
