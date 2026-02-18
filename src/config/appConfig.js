const SHEET_NAMES = {
  summary: "Общая",
  main: "Осн. мат. <Аббрев. сборки>",
  consumable: "Расх. мат. <Аббрев. сборки>",
  projectConsumable: "Расходники",
};
const DEV_LABEL = "Гороховицкий Егор Русланович";
const DEFAULT_AI_MODEL = "gpt-5-mini";
function model(id, label, pricing = {}, tiers = ["standard"]) {
  const standard = pricing.standard || { inputUsdPer1M: 0, outputUsdPer1M: 0 };
  return {
    id,
    label,
    tiers: Array.isArray(tiers) && tiers.length ? tiers : ["standard"],
    pricing,
    inputUsdPer1M: standard.inputUsdPer1M,
    outputUsdPer1M: standard.outputUsdPer1M,
  };
}
const AI_MODELS = [
  model("gpt-5.2", "GPT-5.2", {
    standard: { inputUsdPer1M: 1.25, outputUsdPer1M: 10 },
    flex: { inputUsdPer1M: 0.625, outputUsdPer1M: 5 },
    priority: { inputUsdPer1M: 2.5, outputUsdPer1M: 20 },
  }, ["flex", "standard", "priority"]),
  model("gpt-5.1", "GPT-5.1", {
    standard: { inputUsdPer1M: 1.25, outputUsdPer1M: 10 },
    flex: { inputUsdPer1M: 0.625, outputUsdPer1M: 5 },
    priority: { inputUsdPer1M: 2.5, outputUsdPer1M: 20 },
  }, ["flex", "standard", "priority"]),
  model("gpt-5", "GPT-5", {
    standard: { inputUsdPer1M: 1.25, outputUsdPer1M: 10 },
    flex: { inputUsdPer1M: 0.625, outputUsdPer1M: 5 },
    priority: { inputUsdPer1M: 2.5, outputUsdPer1M: 20 },
  }, ["flex", "standard", "priority"]),
  model("gpt-5-mini", "GPT-5 mini", {
    standard: { inputUsdPer1M: 0.25, outputUsdPer1M: 2 },
    flex: { inputUsdPer1M: 0.125, outputUsdPer1M: 1 },
    priority: { inputUsdPer1M: 0.5, outputUsdPer1M: 4 },
  }, ["flex", "standard", "priority"]),
  model("gpt-5-nano", "GPT-5 nano", {
    standard: { inputUsdPer1M: 0.05, outputUsdPer1M: 0.4 },
    flex: { inputUsdPer1M: 0.025, outputUsdPer1M: 0.2 },
    priority: { inputUsdPer1M: 0.1, outputUsdPer1M: 0.8 },
  }, ["flex", "standard", "priority"]),
  model("gpt-5.2-chat-latest", "GPT-5.2 chat latest", {
    standard: { inputUsdPer1M: 1.25, outputUsdPer1M: 10 },
    priority: { inputUsdPer1M: 2.5, outputUsdPer1M: 20 },
  }, ["standard", "priority"]),
  model("gpt-5.1-chat-latest", "GPT-5.1 chat latest", {
    standard: { inputUsdPer1M: 1.25, outputUsdPer1M: 10 },
    priority: { inputUsdPer1M: 2.5, outputUsdPer1M: 20 },
  }, ["standard", "priority"]),
  model("gpt-5-chat-latest", "GPT-5 chat latest", {
    standard: { inputUsdPer1M: 1.25, outputUsdPer1M: 10 },
    priority: { inputUsdPer1M: 2.5, outputUsdPer1M: 20 },
  }, ["standard", "priority"]),
  model("gpt-5.2-codex", "GPT-5.2 Codex (код)", {
    standard: { inputUsdPer1M: 1.25, outputUsdPer1M: 10 },
    priority: { inputUsdPer1M: 2.5, outputUsdPer1M: 20 },
  }, ["standard", "priority"]),
  model("gpt-5.1-codex-max", "GPT-5.1 Codex Max (код)", {
    standard: { inputUsdPer1M: 1.5, outputUsdPer1M: 12 },
    priority: { inputUsdPer1M: 3, outputUsdPer1M: 24 },
  }, ["standard", "priority"]),
  model("gpt-5.1-codex", "GPT-5.1 Codex (код)", {
    standard: { inputUsdPer1M: 1.25, outputUsdPer1M: 10 },
    priority: { inputUsdPer1M: 2.5, outputUsdPer1M: 20 },
  }, ["standard", "priority"]),
  model("gpt-5-codex", "GPT-5 Codex (код)", {
    standard: { inputUsdPer1M: 1.25, outputUsdPer1M: 10 },
    priority: { inputUsdPer1M: 2.5, outputUsdPer1M: 20 },
  }, ["standard", "priority"]),
  model("gpt-5.2-pro", "GPT-5.2 Pro", {
    standard: { inputUsdPer1M: 15, outputUsdPer1M: 120 },
    priority: { inputUsdPer1M: 30, outputUsdPer1M: 240 },
  }, ["standard", "priority"]),
  model("gpt-5-pro", "GPT-5 Pro", {
    standard: { inputUsdPer1M: 15, outputUsdPer1M: 120 },
    priority: { inputUsdPer1M: 30, outputUsdPer1M: 240 },
  }, ["standard", "priority"]),
  model("gpt-4.1", "GPT-4.1", {
    standard: { inputUsdPer1M: 2, outputUsdPer1M: 8 },
  }, ["standard"]),
  model("gpt-4.1-mini", "GPT-4.1 mini", {
    standard: { inputUsdPer1M: 0.4, outputUsdPer1M: 1.6 },
  }, ["standard"]),
  model("gpt-4.1-nano", "GPT-4.1 nano", {
    standard: { inputUsdPer1M: 0.1, outputUsdPer1M: 0.4 },
  }, ["standard"]),
  model("gpt-4o", "GPT-4o", {
    standard: { inputUsdPer1M: 2.5, outputUsdPer1M: 10 },
  }, ["standard"]),
  model("gpt-4o-2024-05-13", "GPT-4o (2024-05-13)", {
    standard: { inputUsdPer1M: 5, outputUsdPer1M: 15 },
  }, ["standard"]),
  model("gpt-4o-mini", "GPT-4o mini", {
    standard: { inputUsdPer1M: 0.15, outputUsdPer1M: 0.6 },
  }, ["standard"]),
  model("o3", "o3", {
    standard: { inputUsdPer1M: 2, outputUsdPer1M: 8 },
    flex: { inputUsdPer1M: 1, outputUsdPer1M: 4 },
    priority: { inputUsdPer1M: 4, outputUsdPer1M: 16 },
  }, ["flex", "standard", "priority"]),
  model("o4-mini", "o4-mini", {
    standard: { inputUsdPer1M: 1.1, outputUsdPer1M: 4.4 },
    flex: { inputUsdPer1M: 0.55, outputUsdPer1M: 2.2 },
    priority: { inputUsdPer1M: 2.2, outputUsdPer1M: 8.8 },
  }, ["flex", "standard", "priority"]),
  model("o1", "o1", {
    standard: { inputUsdPer1M: 15, outputUsdPer1M: 60 },
  }, ["standard"]),
  model("o3-pro", "o3-pro", {
    standard: { inputUsdPer1M: 20, outputUsdPer1M: 80 },
  }, ["standard"]),
  model("computer-use-preview", "Computer Use Preview", {
    standard: { inputUsdPer1M: 3, outputUsdPer1M: 12 },
  }, ["standard"]),
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
  "list_attachments",
  "read_attachment",
  "read_range",
  "find_cells",
  "write_cells",
  "write_matrix",
  "copy_range",
  "fill_range",
  "replace_in_range",
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
  "move_position",
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
const AGENT_MAX_FORCED_RETRIES = 24;
const AGENT_MAX_TOOL_ROUNDS = 160;
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
