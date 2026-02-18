# SpecForge KP Viewer

Статический проект для GitHub Pages:
- просмотр KPI-таблиц в стиле исходного Excel-шаблона;
- панорамирование правой кнопкой мыши;
- выделение диапазонов и копирование (`Ctrl+C` / `Cmd+C`);
- масштабирование колёсиком;
- редактирование только через левую боковую панель;
- импорт/экспорт JSON и экспорт XLSX.

## Запуск локально

```bash
python -m http.server 8080
```

Открыть: `http://localhost:8080`

## Публикация в GitHub Pages

1. Запушить репозиторий на GitHub.
2. В `Settings -> Pages` выбрать источник: ветка `main`, папка `/ (root)`.
3. Сохранить и дождаться публикации.

## Smoke: Responses Runtime

Проверка ключевых сценариев без сетевого доступа к OpenAI:
- sync/background policy;
- `prompt_cache_*` + `safety_identifier` + `truncation` + `metadata` + `include`;
- background polling + cancel endpoint;
- fallback `previous_response_id` без отправки `function_call_output` в fresh-turn.

Запуск:

```bash
node --experimental-default-type=module scripts/smoke-responses.mjs
```

Ожидаемый результат:

```text
SMOKE_OK
```
