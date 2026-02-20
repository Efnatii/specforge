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

## Web Search CLI (Responses API + `web_search`)

Добавлен модуль: `src/modules/agent/runtime/web-search.js`

- функция: `askWithWeb(query, opts)`
- возвращает: `{ answerText, sources[] }`
- `sources` собираются только из данных `web_search` tool (без выдуманных ссылок)
- встроены: таймаут, ретраи на сетевые ошибки, логирование ключевых шагов

Пример программного вызова:

```js
import { askWithWeb } from "./src/modules/agent/runtime/web-search.js";

const result = await askWithWeb("Найди спецификацию IP54", {
  apiKey: process.env.OPENAI_API_KEY,
  model: "gpt-5-mini",
  allowed_domains: ["example.com"],
  search_context_size: "high",
  user_location: { type: "approximate", country: "RU" },
  external_web_access: true,
  max_tool_calls: 0, // 0 = без верхнего лимита
  tool_choice: "required",
  reasoning: { effort: "high" },
  include: ["web_search_call.action.sources"],
  min_sources_for_facts: 3,
});
```

### Пример CLI (`index.js`)

Файл: `scripts/web-search-cli/index.js`

Запуск:

```bash
node --experimental-default-type=module scripts/web-search-cli/index.js "Найди актуальные требования к IP54 щитам"
```

Можно передать запрос через stdin:

```bash
echo "Сравни цены на автомат 1P C16" | node --experimental-default-type=module scripts/web-search-cli/index.js
```

### Переменные окружения

- `OPENAI_API_KEY` — обязательный API ключ
- `OPENAI_MODEL` — модель (по умолчанию `gpt-5-mini`)
- `OPENAI_RESPONSES_ENDPOINT` — endpoint Responses API (по умолчанию `https://api.openai.com/v1/responses`)
- `WEB_ALLOWED_DOMAINS` — список доменов через запятую (например `example.com,docs.example.com`)
- `WEB_SEARCH_CONTEXT_SIZE` — `low|medium|high`
- `WEB_USER_COUNTRY` — код страны (`RU`, `US`, ...)
- `WEB_USER_REGION`, `WEB_USER_CITY`, `WEB_USER_TIMEZONE` — дополнительные поля локации
- `WEB_EXTERNAL_WEB_ACCESS` — `true|false`
- `WEB_MAX_TOOL_CALLS` — лимит tool-вызовов (`0` = без верхнего лимита)
- `WEB_TOOL_CHOICE` — `auto|required|none`
- `WEB_REASONING_EFFORT` — `minimal|low|medium|high|xhigh|none`
- `WEB_INCLUDE` — include-поля через запятую (по умолчанию `web_search_call.action.sources`)
- `WEB_TIMEOUT_MS` — таймаут запроса (мс)
- `WEB_MAX_RETRIES` — число ретраев (0..2)
- `WEB_RETRY_DELAY_MS` — базовая задержка ретрая (мс)
- `WEB_MIN_SOURCES_FOR_FACTS` — минимальное число ссылок для факт-подтверждения
- `WEB_MAX_SOURCES` — максимальное число возвращаемых источников

### Пример: ограничить доменами

```bash
$env:OPENAI_API_KEY="sk-..."
$env:WEB_ALLOWED_DOMAINS="iec.ch,iea.org"
node --experimental-default-type=module scripts/web-search-cli/index.js "Найди релевантные публикации по энергоэффективности"
```

### Пример: включить высокий контекст поиска

```bash
$env:OPENAI_API_KEY="sk-..."
$env:WEB_SEARCH_CONTEXT_SIZE="high"
node --experimental-default-type=module scripts/web-search-cli/index.js "Сделай подробный обзор темы"
```

## Настройка числа ссылок для верификации фактов

Добавлена опция `factCheckMinSources`:

- UI: настройка `Мин. ссылок для фактов` в параметрах агента
- runtime: используется в `verification` (web-подтверждение позиций)
- schema/system prompt: текст и ограничения синхронизируются с выбранным значением
