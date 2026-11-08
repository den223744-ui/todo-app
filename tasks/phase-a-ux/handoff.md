# Передача: Фаза A, A2–A4

Дата: 2026-11-09. Ветка: `stage-3-design` по указанию пользователя.
Изменения оставлены в рабочей директории, коммитов нет. Backend, зависимости,
генерируемые API-типы и реальные данные не изменялись. Перед началом рабочая
директория была чистой; `tasks/ACTIVE.md` сообщал, что занятых файлов нет.

## Реализация

- A2: непустой `query.trim()` переключает `selectTaskGroups` на глобальный поиск
  независимо от view, тега, пользовательского списка и выбранного дня. Совпадение
  в title/notes/tags подзадачи возвращает родителя ровно один раз. Сначала группа
  `search:open` («Найдено»), затем `search:completed` («Выполненные»); пустые скрыты.
  Датированные задачи идут по `compareByDue`, затем задачи без даты, с существующим
  порядком по position для равных дат/времени. Подсказка пустого поиска больше не
  предлагает сменить список. Таймлайн и итоги дня не фильтруются поиском.
- A3: `added` и `quickAddSuccess` удалены. Успешный ответ создания показывает
  четырёхсекундный тост через существующий toastStore. Чистая `quickAddFeedback`
  определяет раздел, короткую локальную дату, фактическую видимость и destination.
  Видимость использует тот же `selectTaskGroups`, учитывая группу «Завтра», поиск,
  тег и выбранный день. При ответе используется текущий экран, даже если пользователь
  успел перейти в другой раздел. «Показать» очищает поиск, открывает нужный view/day
  и сохранённый taskId. Открытый пользовательский список получает своё имя, если
  созданная задача принадлежит ему. Ошибка создания по-прежнему восстанавливает
  текст; её тост формирует существующий обработчик мутаций.
- Одинаковые подтверждения разных созданий показываются отдельно: добавлена опция
  `deduplicate: false` в toastStore, используемая только QuickAdd. Дедупликация
  ошибок по умолчанию и поведение Undo сохранены; «Показать» не помечен как undo.
- A4: `completedLast` — стабильное разделение без изменения входного массива;
  подключено в `selectToday` и `selectDay`. Внутри каждой группы сохраняется прежний
  порядок отдельно для активных и выполненных. `motion.li layout="position"`
  анимирует перенос за 0.22 с без масштабирования содержимого; в AppProviders
  добавлен `MotionConfig reducedMotion="user"`. Ключи строк, семантика и обработчики
  фокуса сохранены. Existing GroupBadge и PriorityMark вынесены в отдельные файлы,
  чтобы соблюдать правило «один компонент — один файл» в изменяемых компонентах.

## Изменённые файлы

Относительно корня репозитория:

- `frontend/src/domain/search.ts`
- `frontend/src/domain/search.test.ts`
- `frontend/src/domain/taskGroups.ts`
- `frontend/src/domain/taskGroups.test.ts`
- `frontend/src/domain/smartLists.ts`
- `frontend/src/domain/smartLists.test.ts`
- `frontend/src/domain/quickAddFeedback.ts` — новый
- `frontend/src/domain/quickAddFeedback.test.ts` — новый
- `frontend/src/constants/texts.ts`
- `frontend/src/features/quick-add/QuickAdd.tsx`
- `frontend/src/features/quick-add/QuickAdd.test.tsx`
- `frontend/src/features/search/SearchField.tsx`
- `frontend/src/features/search/SearchField.test.tsx`
- `frontend/src/features/tasks/TaskList.tsx`
- `frontend/src/features/tasks/TaskListContainer.test.tsx`
- `frontend/src/features/tasks/TaskRow.tsx`
- `frontend/src/features/tasks/GroupBadge.tsx` — новый, извлечён без изменения вида
- `frontend/src/features/tasks/PriorityMark.tsx` — новый, извлечён без изменения вида
- `frontend/src/app/AppProviders.tsx`
- `frontend/src/store/toastStore.ts`
- `frontend/src/store/toastStore.test.ts`
- `frontend/e2e/quick-add.spec.ts`
- `frontend/e2e/phase-a.spec.ts` — новый, 9 сценариев с API-фикстурами в памяти
- `tasks/phase-a-ux/handoff.md` — этот файл

## Проверки и ограничения среды

- `npm run lint` — успешно, 0 ошибок/предупреждений.
- `npm run typecheck` — успешно.
- `npm run format:check` — успешно.
- Стандартный `npm run test:coverage` не запускается: `spawn EPERM` при запуске
  esbuild для загрузки `vite.config.ts`.
- Полный Vitest удалось выполнить без этого дочернего процесса с временным
  `validation.config.mjs`: настройки test/coverage взяты из исходного vite.config,
  esbuild заменён на `typescript.transpileModule` внутри процесса (React JSX,
  ESNext, source maps/inline sources), resolve.preserveSymlinks=true,
  pool=threads, maxWorkers=2; загрузка конфига native. Пороги покрытия не менялись.
  Команда: `npm run test:coverage -- --config validation.config.mjs --configLoader native`.
  Результат: **47 файлов, 610 тестов — все прошли**. Весь `domain/`:
  **100% statements, branches, functions, lines**. Временный конфиг удалён.
  Лог: `frontend/test-results/phase-a-coverage.log`; HTML: `frontend/coverage/index.html`
  (оба — игнорируемые артефакты).
- `npx playwright test` обнаружил 26 сценариев, но остановился до выполнения:
  `spawn EPERM` при создании worker-процессов. Dev-сервер
  `http://localhost:5173` доступен (HTTP 200). `npx playwright test --list` успешно
  собирает **26 тестов в 5 файлах**, включая 9 новых.
- Компонентные тесты проверяют перенос при оптимистичном выполнении, сохранение
  DOM-узла и фокуса, восстановление порядка при ошибке на сегодня и на другом дне;
  ошибки создания, переход по тосту, смену раздела во время запроса и повторы тостов.
- Браузерные геометрия, layout-анимация и reduced motion пока **не подтверждены**.
  Новые e2e проверяют эти случаи, Undo, мобильный тост, его срок 4 с, глобальный
  поиск/подзадачи/выполненные, reload и неизменность таймлайна/итогов дня.
  Скриншоты не получены из-за остановки e2e до запуска браузера.

Перед принятием изменений нужен обычный прогон из frontend в среде, допускающей
запуск дочерних процессов:

```powershell
npm run lint
npm run typecheck
npm run format:check
npm run test:coverage
npx playwright test
```

Git требует разового `-c safe.directory='C:/Users/Administrator/Desktop/TO DO LIST ( SOBES)'`;
глобальный git config не менялся. `git diff --check` проходит.
