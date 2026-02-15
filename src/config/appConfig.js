const SHEET_NAMES = {
  summary: "Общая",
  main: "Осн. мат. <Аббрев. сборки>",
  consumable: "Расх. мат. <Аббрев. сборки>",
  projectConsumable: "Расходники",
};
const DEV_LABEL = "Гороховицкий Егор Русланович";
const DEFAULT_AI_MODEL = "gpt-5-mini";
const AI_MODELS = [
  { id: "gpt-5-mini", label: "GPT-5 mini", inputUsdPer1M: 0.25, outputUsdPer1M: 2 },
  { id: "gpt-5", label: "GPT-5", inputUsdPer1M: 1.25, outputUsdPer1M: 10 },
  { id: "gpt-5.1", label: "GPT-5.1", inputUsdPer1M: 1.25, outputUsdPer1M: 10 },
  { id: "gpt-5-nano", label: "GPT-5 nano", inputUsdPer1M: 0.05, outputUsdPer1M: 0.4 },
  { id: "o1", label: "o1", inputUsdPer1M: 15, outputUsdPer1M: 60 },
  { id: "o3-pro", label: "o3-pro", inputUsdPer1M: 20, outputUsdPer1M: 80 },
];
const WEB_SEARCH_PRICE_NOTE = "Веб-поиск (reasoning models): $10 за 1K tool calls + стоимость входных/выходных токенов.";
const STORAGE_KEYS = {
  openAiApiKey: "specforge.openai.apiKey",
  openAiModel: "specforge.openai.model",
  agentCollapsed: "specforge.openai.agentCollapsed",
  agentOptions: "specforge.openai.agentOptions",
  sidebarWidth: "specforge.ui.sidebarWidth",
};
const MAX_CHAT_JOURNAL = 220;
const MAX_TABLE_JOURNAL = 240;
const MAX_EXTERNAL_JOURNAL = 240;
const MAX_CHANGES_JOURNAL = 320;
const MAX_CHAT_JOURNAL_TEXT = 120000;
const MAX_COMMON_JOURNAL_TEXT = 8000;
const CHAT_CONTEXT_RECENT_MESSAGES = 12;
const CHAT_CONTEXT_MAX_CHARS = 22000;
const CHAT_CONTEXT_MESSAGE_MAX_CHARS = 1400;
const CHAT_SUMMARY_CHUNK_SIZE = 4;
const MAX_CHAT_SUMMARY_CHARS = 9000;
const MIN_SIDEBAR_WIDTH = 280;
const MAX_SIDEBAR_WIDTH = 760;
const JOURNAL_RENDER_DEBOUNCE_MS = 90;
const STREAM_DELTA_FLUSH_MS = 120;
const STREAM_TEXT_PREVIEW_LIMIT = 12000;
const AI_MUTATION_INTENT_RE = /\b(создай|создать|добавь|добавить|измени|обнови|поменяй|замени|исправь|заполни|вставь|удали|увелич|уменьш|пересчитай|рассчитай|create|add|set|update|change|fill|replace|delete|write)\b/i;
const AI_ACTIONABLE_VERB_RE = /\b(вызови|вызвать|переключи|переключить|прочитай|прочитать|выполни|выполнить|запусти|запустить|получи|получить|покажи|показать|resolve|list|read|get|write|set|update|delete|toggle|create|add|duplicate|clear|run|execute)\b/i;
const AI_TOOL_NAME_HINTS = [
  "resolve_target_context",
  "list_sheets",
  "set_active_sheet",
  "list_assemblies",
  "read_settings",
  "update_settings",
  "get_state",
  "set_state_value",
  "get_selection",
  "read_range",
  "write_cells",
  "clear_range",
  "clear_sheet_overrides",
  "create_assembly",
  "update_assembly",
  "duplicate_assembly",
  "delete_assembly",
  "bulk_delete_assemblies",
  "read_assembly",
  "list_positions",
  "add_position",
  "read_position",
  "update_position",
  "duplicate_position",
  "delete_position",
  "toggle_project_consumables",
  "add_project_position",
  "list_project_positions",
  "update_project_position",
  "delete_project_position",
];
const AI_CONTINUE_PROMPT_RE = /^\s*(продолжай|продолжить|дальше|далее|продолжение|еще|ещё|continue|go on|next)\s*[.!?]*\s*$/i;
const AI_SHORT_ACK_PROMPT_RE = /^\s*(да|ага|ок|окей|хорошо|сделай|делай|дальше|далее|продолжай|продолжить|continue|go on|next|удали|delete)\s*[.!?]*\s*$/i;
const AI_INCOMPLETE_RESPONSE_RE = /(продолж|нужн[аоы]|уточн|подтверд|если хотите|если нужно|would you like|if you want|ответьте|выберите|укажите|что делаем|какой вариант|\?\s*$)/i;
const AGENT_MAX_FORCED_RETRIES = 4;
const AGENT_MAX_TOOL_ROUNDS = 96;
const MARKET_VERIFICATION_MIN_SOURCES = 2;
const MARKET_VERIFICATION_MAX_SOURCES = 6;
const POSITION_MARKET_FIELDS = new Set([
  "schematic",
  "name",
  "manufacturer",
  "article",
  "qty",
  "unit",
  "price_catalog_vat_markup",
  "markup",
  "discount",
  "supplier",
  "note",
]);

export const APP_CONFIG = {
  sheetNames: SHEET_NAMES,
  devLabel: DEV_LABEL,
  defaultAiModel: DEFAULT_AI_MODEL,
  aiModels: AI_MODELS,
  webSearchPriceNote: WEB_SEARCH_PRICE_NOTE,
  storageKeys: STORAGE_KEYS,
  maxChatJournal: MAX_CHAT_JOURNAL,
  maxTableJournal: MAX_TABLE_JOURNAL,
  maxExternalJournal: MAX_EXTERNAL_JOURNAL,
  maxChangesJournal: MAX_CHANGES_JOURNAL,
  maxChatJournalText: MAX_CHAT_JOURNAL_TEXT,
  maxCommonJournalText: MAX_COMMON_JOURNAL_TEXT,
  chatContextRecentMessages: CHAT_CONTEXT_RECENT_MESSAGES,
  chatContextMaxChars: CHAT_CONTEXT_MAX_CHARS,
  chatContextMessageMaxChars: CHAT_CONTEXT_MESSAGE_MAX_CHARS,
  chatSummaryChunkSize: CHAT_SUMMARY_CHUNK_SIZE,
  maxChatSummaryChars: MAX_CHAT_SUMMARY_CHARS,
  minSidebarWidth: MIN_SIDEBAR_WIDTH,
  maxSidebarWidth: MAX_SIDEBAR_WIDTH,
  journalRenderDebounceMs: JOURNAL_RENDER_DEBOUNCE_MS,
  streamDeltaFlushMs: STREAM_DELTA_FLUSH_MS,
  streamTextPreviewLimit: STREAM_TEXT_PREVIEW_LIMIT,
  aiMutationIntentRe: AI_MUTATION_INTENT_RE,
  aiActionableVerbRe: AI_ACTIONABLE_VERB_RE,
  aiToolNameHints: AI_TOOL_NAME_HINTS,
  aiContinuePromptRe: AI_CONTINUE_PROMPT_RE,
  aiShortAckPromptRe: AI_SHORT_ACK_PROMPT_RE,
  aiIncompleteResponseRe: AI_INCOMPLETE_RESPONSE_RE,
  agentMaxForcedRetries: AGENT_MAX_FORCED_RETRIES,
  agentMaxToolRounds: AGENT_MAX_TOOL_ROUNDS,
  marketVerificationMinSources: MARKET_VERIFICATION_MIN_SOURCES,
  marketVerificationMaxSources: MARKET_VERIFICATION_MAX_SOURCES,
  positionMarketFields: POSITION_MARKET_FIELDS,
  templateReportPath: "assets/template-report.json",
  templateStylesPath: "assets/template-styles.json",
};
