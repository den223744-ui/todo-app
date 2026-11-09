# Передача: фаза D, D1–D6

Дата: 2026-11-09. Работа выполнена в предоставленном worktree, ветка
`claude/strange-taussig-41658b` не переключалась, HEAD остался `a319808`
(`chore(frontend): add dnd-kit and cmdk for phase D`). Коммитов нет.
Backend, `src/api/schema.ts`, package.json/package-lock.json и пользовательские
данные не менялись. Существующий `tasks/phase-d-ux/brief.md` сохранён.
`tasks/ACTIVE.md` сообщал, что занятых файлов нет. Прочитаны правила, SPEC,
PLAN, план stage-3-ui и handoff фаз A–C; подробное задание пользователя
определяет рамки этой фазы.

## Реализация и решения

- **D1.** dnd-kit подключён отдельно внутри каждой группы. Ручки есть только
  у сохранённых невыполненных родителей во Входящих, пользовательском списке,
  теге и группах по спискам на Сегодня, включая выбранный день. Поиск,
  Предстоящие, Просроченные, Выполненные и группа «Завтра» исключены.
  Переноса между группами нет. Раскрытые подзадачи едут вместе с родителем
  внутри того же `li`; собственных ручек у них нет.
  MouseSensor активируется после 6px, TouchSensor — через 230ms с tolerance 6px;
  до активации touch сохраняет вертикальную прокрутку. Место ручки зарезервировано,
  на fine/hover она появляется при hover/focus-within, на coarse видна всегда.
  KeyboardSensor использует sortableKeyboardCoordinates: Space/Enter, стрелки,
  Escape. Инструкции, названия и объявления русские. Alt+стрелки используют
  тот же расчёт и запись; временные id и повторные записи защищены.
  `reorderPatches` над `moveTo` обычно возвращает один fractional PATCH;
  перенос на прежнее место ничего не пишет. При исчерпании точности
  перенумеровываются все родители: видимые задачи занимают прежние видимые
  слоты в новом порядке, скрытые сохраняют взаимный порядок и свои слоты.
  Компромисс: в этом редком случае позиции скрытых родителей тоже записываются;
  подзадачи не затрагиваются. Пакет удерживает refetch, использует существующие
  update-мутации и при частичном отказе возвращает все исходные позиции,
  отправляя компенсирующие PATCH на сервер. Undo-тоста перестановки нет.
  dnd-transform находится на внешнем `li`, Framer layout — на внутреннем элементе.
  `layoutDependency` зависит от состава/выполнения группы, а не ручного порядка:
  drop не запускает второй FLIP. На время drag layout отключён. Активная строка
  поднята контурной тенью; DragOverlay не используется, отдельной drop-анимации нет.
  Reduced motion отключает layout и transition соседей. Автопрокрутка dnd-kit
  работает через существующие scroll-контейнеры; нижний ввод остаётся поверх строки.
- **D2.** Блок таймлайна тянется по вертикали после порога мыши/долгого touch.
  Чистые функции переводят пиксели в шаги 15 минут, ограничивают начало с учётом
  полной длительности и форматируют время; PATCH меняет только `due_time`
  в HH:MM:SS. Без длительности используется прежний слот 30 минут. Во время drag
  виден диапазон нового времени. Клик продолжает открывать детали.
  Стрелки на блоке дают ±15 минут, с Shift — ±60; есть aria-describedby.
  Сетка прокручивается от 00:00 до 24:00, чтобы drag мог достичь границ дня без
  изменения начала координат. При первой загрузке/смене дня viewport стоит на
  прежнем начальном часе (08:00 или раньше); поздно пришедшие данные учитываются,
  последующие переносы прокрутку не сбрасывают. Уход с активного таймлайна
  очищает UI-флаг drag. Безвременные задачи на сетку не переносятся.
  Сохранение оптимистично, ошибка откатывается существующей мутацией.
  После переноса — Undo-тост и Ctrl/Cmd+Z. Последовательные стрелки одной задачи
  с паузами менее 800ms и действующим тостом считаются серией: один заменяемый
  тост с последним временем, Undo возвращает время до первого нажатия.
  После паузы начинается отдельная серия. Возврат/приземление не анимируются.
- **D3.** Рядом с UndoShortcut установлен один GlobalShortcuts. Чистый резолвер
  использует физические code для букв, учитывает IME, поля, модификаторы,
  модальные окна, drawer, палитру, help и drag. Ctrl/Cmd+K доступен из полей.
  Стрелки табов, меню, радиогрупп, ручек и таймлайна остаются их обработчикам;
  Enter на других кнопках/ссылках не подменяет их действие.
  Реализованы N, /, J/K/стрелки, X, E, Enter, Backspace/Delete, Alt+стрелки, Esc.
  `selectedTaskId` — только UI-состояние. Основная ссылка получает aria-current,
  видимый контур, фокус и scrollIntoView с существующим scroll-padding над вводом.
  Навигация идёт через группы, без зацикливания. Клик/фокус строки выделяет её;
  исчезнувшая из представления задача снимает выделение. После выполнения/удаления
  фокус переходит к следующей, затем предыдущей строке, иначе к быстрому вводу.
  Удаление из деталей тоже учитывает соседей через границы групп.
  Отложенный фокус проверяет актуальное выделение/редактор/оверлеи, поэтому быстрое
  J → E не перебивает редактирование. UndoShortcut сохранён и защищён от работы
  внутри модальных поверхностей, drag и композиции. Старые проверки фокуса
  после выполнения обновлены под новое требование D3, включая Undo и e2e фазы A.
- **D4.** Палитра cmdk открывается/закрывается Ctrl/Cmd+K с preventDefault,
  закрывается Escape/кликом снаружи, очищает запрос и возвращает фокус.
  Общий ShortcutDialog использует один useFocusTrap; Command.Dialog поверх него
  не добавлен. Есть действия, все умные списки, «Завтра», пользовательские списки
  с точками, теги, темы и поиск задач через searchTopLevelTasks при непустом вводе.
  Переходы идут через useAppLocation. «Завтра» вычисляется календарно на момент
  выбора команды. Для выделенной/открытой задачи доступны существующие toggle,
  destroy и перенос даты с Undo; pending блокирует повторные команды записи.
  Навигация и команды задачи вынесены в отдельные небольшие компоненты.
- **D5.** Help — модальный диалог с тремя таблицами и контурными kbd.
  Модификатор определяется в одном месте: ⌘ для Mac/iPhone/iPad, Ctrl иначе.
  Escape/кнопка закрытия возвращают фокус. Контурная кнопка «? Горячие клавиши»
  находится в десктопном подвале сайдбара. В мобильном drawer она скрыта;
  открытие через палитру/клавиатуру сохранено.
- **D6.** Тема `light | dark | system` хранится в themeStore и localStorage
  (`tood-theme`); по умолчанию system. Чтение/запись защищены try/catch,
  неизвестные значения дают system. События storage синхронизируют вкладки.
  Inline-скрипт в head до первой отрисовки применяет явную тему; в TS и HTML
  стоят взаимные комментарии о синхронизации ключа/валидации. Для system атрибута
  data-theme нет. Исходные значения токенов не изменены; тёмные правила явной
  и системной темы продублированы с комментарием «держать в синхроне».
  Единственная зависимость от prefers-color-scheme найдена в index.css,
  её селектор исключает явную light. color-scheme следует явной теме.
  Радиогруппа из солнца/луны/монитора с roving tabindex, стрелками, Home/End
  находится в подвале общего сайдбара, включая мобильный drawer.

Новые UI-тексты — в constants/texts.ts, цвета/фокус — из текущих токенов,
заголовки — Roboto Condensed. HighlightedInput не менялся. Новых экранов,
роутеров и зависимостей нет.

## Проверки

- `npm run lint` — успешно, 0 ошибок/предупреждений.
- `npm run typecheck` — успешно, 0 ошибок.
- `npm run format:check` — успешно.
- Штатный `npm run test:coverage` — повторно проверен, **не запускается**:
  `spawn EPERM` при старте esbuild для загрузки vite.config.ts.
  Лог: `frontend/.vite/phase-d-standard-coverage.log`.
- Полный Vitest через временный адаптер, **TZ=UTC: 68 файлов, 707 тестов —
  все прошли**. Весь domain/: **100% statements / branches / functions / lines**.
  Пороги не ослаблялись. Адаптер: typescript.transpileModule, ESNext/React JSX,
  source maps с inline sources, preserveSymlinks, threads/maxWorkers=2,
  native config loader. Продуктовые vite.config.ts и package scripts не менялись.
  Команда из frontend:
  `npm run test:coverage -- --config .vite/phase-d.validation.mjs --configLoader native`.
  Адаптер/лог — `.vite/phase-d.validation.mjs`, `.vite/phase-d-coverage.log`;
  HTML — `coverage/index.html` (игнорируемые артефакты).
- Полный Vitest с тем же адаптером без coverage, **TZ=Pacific/Kiritimati:
  68 файлов, 707 тестов — все прошли**. Лог: `.vite/phase-d-kiritimati.log`.
- `npx playwright test --list` — успешно: **49 тестов в 8 файлах**, включая
  **8 новых** в phase-d.spec.ts. Лог: `.vite/phase-d-playwright-list.log`.
  Браузерные тесты в этой фазе **не запускались**, как оговорено в задании.
- `git diff --check` — успешно. Разовый `-c safe.directory`, глобальная
  конфигурация Git не менялась. Diff запрещённых файлов и HighlightedInput пуст.

Новые проверки покрывают fractional-патчи и глобальную перенумерацию,
оптимистичную перестановку и компенсацию частичного отказа, Alt+стрелки,
клавиатуру/выделение/фокус/Undo, поиск на телефоне, палитру/переходы/действия,
help, радиогруппу и недоступный/битый storage, снап/границы времени,
быстрые серии стрелок и Undo, ошибку записи, начальную прокрутку таймлайна.
E2E используют API-фикстуры в памяти и setFixedTime только для Date;
таймеры Query не остановлены. Дни фикстуры согласованы с UTC браузера независимо
от часового пояса процесса, завтра считается domain-календарём.

## Ограничения и что осталось подтвердить

Штатный coverage **нельзя считать зелёным**: успешен адаптированный прогон.
Сбор e2e не подтверждает их выполнение. Реальные mouse/touch drag, авто-scroll,
keyboard dnd-kit в Chromium, геометрия/перенос слов на 375px, переключение темы
до первого paint и отсутствие скачка после drop пока не подтверждены браузером.
Скриншоты в этой фазе не получены; мобильный сценарий сохраняет их при запуске.

У API нет атомарного bulk PATCH. Компенсация перестановки возвращает все позиции
при успешных ответах; если сервер отклонит и компенсирующие записи, гарантировать
атомарный откат на сервере нельзя. Мутации покажут ошибку, финальный refetch
сверит кэш с фактическим серверным состоянием. Это не Undo-операция.

Перед приёмкой в среде с доступными дочерними процессами:

```powershell
cd frontend
npm run lint
npm run typecheck
npm run format:check
npm run test:coverage
npx playwright test
```

## Изменённые файлы

Относительно корня репозитория, кроме этого handoff:

```text
frontend/index.html
frontend/e2e/phase-a.spec.ts
frontend/e2e/phase-d.spec.ts
frontend/src/App.tsx
frontend/src/components/ShortcutDialog.tsx
frontend/src/components/icons/GripIcon.tsx
frontend/src/components/icons/MonitorIcon.tsx
frontend/src/components/icons/MoonIcon.tsx
frontend/src/components/icons/SunIcon.tsx
frontend/src/constants/texts.ts
frontend/src/domain/reorder.ts
frontend/src/domain/reorder.test.ts
frontend/src/domain/shortcuts.ts
frontend/src/domain/shortcuts.test.ts
frontend/src/domain/theme.ts
frontend/src/domain/theme.test.ts
frontend/src/domain/timeline.ts
frontend/src/domain/timelineMove.test.ts
frontend/src/features/details/DetailsFocus.test.tsx
frontend/src/features/details/TaskDetailsContainer.tsx
frontend/src/features/search/MobileSearch.tsx
frontend/src/features/search/SearchField.tsx
frontend/src/features/shortcuts/CommandPalette.tsx
frontend/src/features/shortcuts/GlobalShortcuts.tsx
frontend/src/features/shortcuts/NavigationCommands.tsx
frontend/src/features/shortcuts/PhaseD.test.tsx
frontend/src/features/shortcuts/ShortcutHelp.tsx
frontend/src/features/shortcuts/TaskCommands.tsx
frontend/src/features/shortcuts/focus.ts
frontend/src/features/sidebar/Sidebar.tsx
frontend/src/features/tasks/Reorder.test.tsx
frontend/src/features/tasks/SortableTaskGroup.tsx
frontend/src/features/tasks/TaskList.tsx
frontend/src/features/tasks/TaskListContainer.tsx
frontend/src/features/tasks/TaskListContainer.test.tsx
frontend/src/features/tasks/TaskRow.tsx
frontend/src/features/tasks/Undo.test.tsx
frontend/src/features/tasks/useReorderTasks.ts
frontend/src/features/tasks/useTaskActions.ts
frontend/src/features/theme/ThemePicker.tsx
frontend/src/features/theme/ThemePicker.test.tsx
frontend/src/features/theme/ThemeSync.tsx
frontend/src/features/timeline/Timeline.tsx
frontend/src/features/timeline/Timeline.test.tsx
frontend/src/features/timeline/TimelineBlock.tsx
frontend/src/features/timeline/TimelineContainer.tsx
frontend/src/features/timeline/TimelineMove.test.tsx
frontend/src/features/timeline/useTimelineMove.ts
frontend/src/features/toasts/UndoShortcut.tsx
frontend/src/index.css
frontend/src/store/themeStore.ts
frontend/src/store/themeStore.test.tsx
frontend/src/store/uiStore.ts
frontend/src/test/setup.ts
```

## Приёмка Claude Code (2026-11-09)

Штатные проверки в нормальной среде: lint, typecheck, format:check — успешно;
`npm run test:coverage` — 68 файлов, 710 тестов, `domain/` 100%; vitest с TZ=UTC и
TZ=Pacific/Kiritimati — 710/710; `npx playwright test` — 49/49.

Исправлено по итогам прогона e2e и просмотра в браузере:
- Корзина в строке показывалась по выделению (фокусу), то есть появлялась на mousedown
  и сдвигала строку под курсором: клик по «1/3» и «На сегодня» терялся, а второй клик
  двойного щелчка попадал в «Удалить» и удалял задачу (DELETE в трейсе). Теперь корзина —
  только у открытой задачи, как до фазы D; клик с `detail > 1` её не нажимает;
  двойной клик переименовывает с любого места строки (кроме чекбокса, «1/3», ручки).
  Тесты в TaskRow.test.tsx, проверены мутацией.
- e2e клавиатурной сортировки ждал текст «Взята задача…», который dnd-kit сразу
  перезаписывает объявлением позиции; тест проверяет aria-pressed и позицию.
- Старая проблема, не регрессия: при ширине окна ~1024px (три колонки) средняя
  колонка узкая, а строка переключала раскладку по ширине окна (`sm:`) — названия
  рвались по буквам. Строка переведена на container queries (`@container` на списке,
  `@md:` в строке): раскладка зависит от ширины списка.
