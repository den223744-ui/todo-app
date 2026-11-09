# Передача: фаза C, C1–C4

Дата: 2026-11-09. Ветка: `stage-3-design` по прямому указанию пользователя.
Коммитов нет. Backend, API-схемы, зависимости и пользовательские данные не менялись.
До начала рабочая директория была чистой; `tasks/ACTIVE.md` сообщил, что занятых
файлов нет. Прочитаны `AGENTS.md`, `SPEC.md`, `PLAN.md`, план stage-3-ui и handoff A/B.

## Реализация и решения

- **C1.** Порядок деталей: чекбокс/название → свойства → подзадачи → заметка → удаление.
  Свойства собраны в строки с колонкой подписей 64px и высотой от 36px. Дата и время
  стоят рядом с контурной кнопкой очистки; длительность и список — native select,
  у списка есть цветная точка. Приоритет — native radio с символами «Нет / ! / !! / !!!»
  и именами «Без приоритета / Низкий / Средний / Высокий». Сохранены клавиатура,
  фокус, сохранение полей и Esc; тесты обновлены под новые имена приоритетов.
  Теги переносятся вместе с полем в одной строке, длинный тег не расширяет панель.
  Подзадачи показывают счётчик «N из M» через существующий `subtaskProgress`.
  Видимая подпись «Заметка» сохраняет доступное имя «Заметки».
  `AutosizeTextarea`: минимум две строки, высота растёт и уменьшается по содержимому,
  пересчитывается при изменении ширины через ResizeObserver, ручной resize отключён.
- **C2.** Ниже md итоги дня — одна строка с кольцом 28px и короткими метриками;
  md+ сохраняет прежний вид и адаптацию по ширине карточки. Поиск открывается
  кнопкой рядом с меню, занимает строку шапки, получает фокус. Первый Esc/закрытие
  при непустом запросе очищает его, повторное действие сворачивает поле и возвращает
  фокус на кнопку; запрос из URL автоматически раскрывает поиск.
  Быстрый ввод закреплён внизу только ниже md, учитывает safe area, подсказка скрыта.
  Реальная высота формы, включая ошибки, хранится в CSS-переменной через ResizeObserver:
  она задаёт нижний отступ/scroll-padding контента и положение тостов над формой.
  На телефоне уменьшены верхние отступы/дата и скрыто приветствие для раннего начала
  списка. На md+ размеры заголовка и приветствие сохранены.
  На Today ниже lg доступны вкладки «Список / Таймлайн», включая планшетный промежуток
  md–lg, где правой колонки ещё нет. Выбор — только `uiStore.dayView`; ArrowLeft/Right,
  Home/End, roving tabindex и tabpanel поддерживаются. На lg+ вкладок нет.
  Внутри вкладки используется тот же Timeline, что справа на десктопе.
  Глобальный поиск имеет приоритет над вкладками: пока запрос непустой, показываются
  результаты; очистка возвращает выбранную вкладку. После закрытия деталей задачи,
  открытой из мобильного таймлайна, фокус возвращается на её кнопку в таймлайне.
- **C3.** Чистая `isDayClosed(tasks, location, now)` использует `selectToday` и
  `progressOf`, как итоги дня: учитывает показанных родителей и их подзадачи,
  не допускает незавершённых просроченных. Пустой день, другая дата/раздел и поиск
  не празднуются; будущие/недатированные задачи не мешают закрытию текущего дня.
  Старые выполненные задачи вне текущего дневного прогресса не создают поздравление.
  Состояние появляется над выполненными задачами, их заголовки групп скрываются;
  группа «Завтра» сохраняется. Строки остаются с прежними ключами, Undo и откат
  возвращают обычный вид. Появление — Framer Motion, reduced motion отключает вход.
- **C4.** Порядок быстрого ввода не менялся: текст → список → добавить.
  `HighlightedInput.tsx` не изменён: шрифт, паддинги, слой токенов и синхронизация
  прокрутки сохранены. Механизмы TanStack Query, откат и Undo использованы существующие.

UI-тексты находятся в `constants/texts.ts`, цвета — из текущих токенов `index.css`,
заголовки — Roboto Condensed / font-display. Новых экранов и зависимостей нет.

## Проверки

- `npm run lint` — успешно, 0 ошибок/предупреждений.
- `npm run typecheck` — успешно, 0 ошибок.
- `npm run format:check` — успешно.
- Штатный `npm run test:coverage` — не запускается: `spawn EPERM` при старте
  esbuild для загрузки `vite.config.ts`. Продуктовый конфиг и scripts не менялись.
- Полный Vitest через временный адаптер без дочернего esbuild-процесса:
  **59 файлов, 661 тест — все прошли**. Весь `domain/`, включая новую функцию:
  **100% statements / branches / functions / lines**. Пороги не ослаблялись.
  Адаптер использует `typescript.transpileModule`, ESNext/React JSX, source maps
  с inline sources, preserveSymlinks, threads/maxWorkers=2 и native config loader.
  Команда из frontend:
  `npm run test:coverage -- --config .vite/phase-c.validation.mjs --configLoader native`.
  Адаптер и лог сохранены в игнорируемых `.vite/phase-c.validation.mjs` и
  `.vite/phase-c-coverage.log`; HTML — `coverage/index.html`.
- `npx playwright test` — **41 сценарий собран, 0 выполнено**: `spawn EPERM`
  при создании workers. `npx playwright test --list` собирает **41 тест в 7 файлах**,
  включая **7 новых** в `phase-c.spec.ts`. Лог — `test-results/phase-c-playwright.log`.
- Dev-сервер `http://localhost:5173` отвечает HTTP 200.
- `git diff --check` — успешно. Git запускался с разовым `-c safe.directory`,
  глобальные настройки Git не менялись.

Добавлено 13 unit/component-тестов: 6 domain, autosize, мобильный поиск (2), вкладки,
связка мобильного App/таймлайна/поиска/фокуса и «День закрыт» с Undo/откатом (2).
Существующие тесты деталей продолжают проверять сохранение, Esc, ошибки и мутации.
Новые e2e проверяют первый экран 375px, компактные итоги, нижний ввод/последнюю задачу,
тосты над вводом, раскрытие поиска, вкладки/таймлайн/фокус/поиск, компактные детали и
autosize, закрытие дня/Undo/пустоту/reduced motion, десктоп и горизонтальный overflow.
Время в новых e2e берётся при запуске; timezone UTC и setFixedTime фиксируют только Date,
не останавливая таймеры Query. `completed_at` берётся из того же текущего времени.

## Ограничения и что осталось подтвердить

Штатные test:coverage и Playwright **нельзя считать зелёными**. Реальная геометрия
на 375px, браузерный autosize/перенос тегов, safe area, совпадение зеркала ввода,
анимации/reduced motion и фокус в Chromium пока не подтверждены запуском e2e.
Попытка визуального просмотра не дала скриншотов: browser access host недоступен,
доступ к окну Chrome отклонён инструментом с сообщением
`Computer Use was not approved to use Google Chrome`.

Перед приёмкой нужен штатный прогон в среде, разрешающей дочерние процессы:

```powershell
cd frontend
npm run lint
npm run typecheck
npm run format:check
npm run test:coverage
npx playwright test
```

Не запускать Playwright параллельно с записью логов/адаптеров в `test-results`:
он очищает этот каталог при старте. Адаптер фазы C поэтому оставлен в `.vite`.

## Изменённые файлы

Относительно корня репозитория, кроме этого handoff:

```text
frontend/src/App.tsx
frontend/src/MobileApp.test.tsx
frontend/src/components/AppShell.tsx
frontend/src/components/AutosizeTextarea.tsx
frontend/src/components/AutosizeTextarea.test.tsx
frontend/src/constants/texts.ts
frontend/src/domain/dayClosed.ts
frontend/src/domain/dayClosed.test.ts
frontend/src/features/details/TaskDetails.tsx
frontend/src/features/details/TaskDetails.test.tsx
frontend/src/features/details/TaskDetailsContainer.tsx
frontend/src/features/details/PriorityPicker.tsx
frontend/src/features/details/TagEditor.tsx
frontend/src/features/details/SubtaskList.tsx
frontend/src/features/quick-add/QuickAdd.tsx
frontend/src/features/search/SearchField.tsx
frontend/src/features/search/MobileSearch.tsx
frontend/src/features/search/MobileSearch.test.tsx
frontend/src/features/tasks/TodayStats.tsx
frontend/src/features/tasks/DayStat.tsx
frontend/src/features/tasks/DayViewTabs.tsx
frontend/src/features/tasks/DayViewTabs.test.tsx
frontend/src/features/tasks/DayClosed.tsx
frontend/src/features/tasks/DayClosed.test.tsx
frontend/src/features/tasks/TaskList.tsx
frontend/src/features/tasks/TaskListContainer.tsx
frontend/src/features/timeline/Timeline.tsx
frontend/src/features/timeline/TimelineContainer.tsx
frontend/src/features/toasts/Toaster.tsx
frontend/src/store/uiStore.ts
frontend/src/index.css
frontend/e2e/task-details.spec.ts
frontend/e2e/phase-c.spec.ts
```
