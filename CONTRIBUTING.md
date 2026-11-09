# Правила проекта

Как устроен код и как в нём работать. Спецификация продукта — [`SPEC.md`](SPEC.md).

## Команды

```bash
docker compose up                                      # всё приложение
cd backend && uv run pytest                            # тесты бэкенда
cd backend && uv run ruff check . && uv run mypy app   # линтер и типы
cd frontend && npm run dev
cd frontend && npm run test                            # vitest
cd frontend && npm run e2e                             # playwright
cd frontend && npm run gen:api                         # типы из OpenAPI
```

## Архитектура

- Бэкенд: роутеры тонкие → бизнес-логика в `services/` → модели в `models/`. Каждый запрос скоупится по workspace из cookie: к задачам — только с фильтром по `workspace_id`.
- Схема БД меняется только Alembic-миграциями.
- Фронтенд: логика без React — в `src/domain/` (чистые функции; текущее время приходит аргументом `now`, без `Date.now()` внутри).
- Серверное состояние — только TanStack Query. Zustand — только UI-состояние (выделение, открытые панели, тема).
- Типы API — из сгенерированного `src/api/schema.ts`, ручных DTO нет. После изменения схем бэкенда — `npm run gen:api`.
- Мутации оптимистичные, с откатом при ошибке.
- Анимации — Framer Motion, с учётом `prefers-reduced-motion`.

## Стиль кода

- TypeScript strict без `any`; Python — полные type hints, mypy strict.
- Имена — английские, UI-тексты — русские и вынесены в `constants/texts.ts`.
- Маленькие компоненты: один компонент — один файл.
- Новая зависимость — только с причиной в описании коммита.

## Процесс

- Работа этапами; в изменение входит только текущий этап.
- Новая логика — новые тесты в том же изменении.
- Перед мержем: линтеры, типы и все тесты зелёные, CI зелёный.
- Коммиты — Conventional Commits (`feat:`, `fix:`, `test:`, `refactor:`, `chore:`, `docs:`), маленькие и осмысленные.
- Неоднозначное требование — уточнить, а не додумывать.
