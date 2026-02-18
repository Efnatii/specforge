export class AiJournalModule {
  constructor(ctx) {
    Object.assign(this, createAiJournalInternal(ctx));
  }
}

function createAiJournalInternal(ctx) {
  const {
    app,
    dom,
    windowRef,
    localStorageRef,
    toast: toastFn,
    config,
    helpers,
  } = ctx;

  if (!app) throw new Error("AiJournalModule requires app");
  if (!dom) throw new Error("AiJournalModule requires dom");
  if (!config) throw new Error("AiJournalModule requires config");
  if (!helpers) throw new Error("AiJournalModule requires helpers");

  const {
    AI_MODELS,
    DEFAULT_AI_MODEL,
    WEB_SEARCH_PRICE_NOTE,
    STORAGE_KEYS,
    MAX_CHAT_JOURNAL,
    MAX_TABLE_JOURNAL,
    MAX_EXTERNAL_JOURNAL,
    MAX_CHANGES_JOURNAL,
    MAX_CHAT_JOURNAL_TEXT,
    MAX_COMMON_JOURNAL_TEXT,
    CHAT_CONTEXT_RECENT_MESSAGES,
    CHAT_SUMMARY_CHUNK_SIZE,
    MAX_CHAT_SUMMARY_CHARS,
    MIN_SIDEBAR_WIDTH,
    MAX_SIDEBAR_WIDTH,
    JOURNAL_RENDER_DEBOUNCE_MS,
    STREAM_DELTA_FLUSH_MS,
    STREAM_TEXT_PREVIEW_LIMIT,
  } = config;

  const {
    num,
    esc,
    uid,
  } = helpers;

  const win = windowRef || globalThis.window;
  const storage = localStorageRef || globalThis.localStorage;
  const toast = typeof toastFn === "function" ? toastFn : () => {};
  const journalRenderState = {
    timer: 0,
    kinds: new Set(),
  };
  const REASONING_EFFORT_ORDER = ["low", "medium", "high", "xhigh"];
  const WEB_SEARCH_CONTEXT_SIZE_ORDER = ["low", "medium", "high"];
  const REASONING_DEPTH_ORDER = ["fast", "balanced", "deep"];
  const REASONING_VERIFY_ORDER = ["off", "basic", "strict"];
  const REASONING_SUMMARY_ORDER = ["auto", "concise", "detailed", "off"];
  const REASONING_CLARIFY_ORDER = ["never", "minimal", "normal"];
  const TOOLS_MODE_ORDER = ["auto", "prefer", "require", "none"];
  const BREVITY_MODE_ORDER = ["short", "normal", "detailed"];
  const OUTPUT_MODE_ORDER = ["plain", "bullets", "json"];
  const RISKY_ACTIONS_MODE_ORDER = ["allow_if_asked", "confirm", "never"];
  const STYLE_MODE_ORDER = ["clean", "verbose"];
  const CITATIONS_MODE_ORDER = ["off", "on"];
  const TASK_PROFILE_ORDER = ["auto", "fast", "balanced", "bulk", "longrun", "price_search", "proposal", "source_audit", "accurate", "research", "spec_strict", "custom"];
  const OPTIONAL_TEXT_MODE_ORDER = ["auto", "off", "custom"];
  const BACKGROUND_MODE_ORDER = ["off", "auto", "on"];
  const COMPACT_MODE_ORDER = ["off", "auto", "on"];
  const INCLUDE_SOURCES_MODE_ORDER = ["off", "auto", "on"];
  const SERVICE_TIER_ORDER = ["flex", "standard", "priority"];
  const SERVICE_TIER_LABELS = {
    flex: "FLEX",
    standard: "STANDARD",
    priority: "PRIORITY",
  };
  const WEB_SEARCH_COUNTRY_LABELS = {
    RU: "Россия",
    US: "США",
    DE: "Германия",
    GB: "Великобритания",
    FR: "Франция",
  };
  const REASONING_EFFORT_LABELS = {
    low: "Низкий",
    medium: "Средний",
    high: "Высокий",
    xhigh: "Максимальный",
  };
  const TASK_PROFILE_LABELS = {
    auto: "Авто (по задаче)",
    fast: "Черновик (макс. скорость)",
    balanced: "Стандартный",
    bulk: "Пакетный (быстро)",
    longrun: "Длинная сессия",
    price_search: "Поиск цен и источников",
    proposal: "КП и спецификация",
    source_audit: "Аудит исходников",
    accurate: "Точный (усиленная проверка)",
    research: "Исследование (глубоко)",
    spec_strict: "Спецификация ЩО (максимум)",
    custom: "Пользовательский",
  };
  ensureJournalUiState();

function normalizeReasoningEffort(value, fallback = "medium") {
  const normalized = String(value || "").trim().toLowerCase();
  if (REASONING_EFFORT_ORDER.includes(normalized)) return normalized;
  const fb = String(fallback || "").trim().toLowerCase();
  return REASONING_EFFORT_ORDER.includes(fb) ? fb : "medium";
}

function reasoningEffortLabel(value) {
  const effort = normalizeReasoningEffort(value, "medium");
  return REASONING_EFFORT_LABELS[effort] || effort;
}

function reasoningEffortBadge(value) {
  const effort = normalizeReasoningEffort(value, "medium");
  if (effort === "xhigh") return "М";
  if (effort === "low") return "Н";
  if (effort === "high") return "В";
  return "С";
}

function normalizeWebSearchCountry(value, fallback = "RU") {
  const raw = String(value || "").trim().toUpperCase();
  if (/^[A-Z]{2}$/.test(raw)) return raw;
  const fb = String(fallback || "").trim().toUpperCase();
  return /^[A-Z]{2}$/.test(fb) ? fb : "RU";
}

function normalizeWebSearchContextSize(value, fallback = "high") {
  const raw = String(value || "").trim().toLowerCase();
  if (WEB_SEARCH_CONTEXT_SIZE_ORDER.includes(raw)) return raw;
  const fb = String(fallback || "").trim().toLowerCase();
  return WEB_SEARCH_CONTEXT_SIZE_ORDER.includes(fb) ? fb : "high";
}

function webSearchContextSizeLabel(value) {
  const size = normalizeWebSearchContextSize(value, "high");
  if (size === "low") return "минимальный";
  if (size === "medium") return "средний";
  return "максимальный";
}

function webSearchCountryLabel(value) {
  const country = normalizeWebSearchCountry(value, "RU");
  return WEB_SEARCH_COUNTRY_LABELS[country] || country;
}

function reasoningDepthLabel(value) {
  const mode = normalizeReasoningDepth(value, "balanced");
  if (mode === "fast") return "Быстрая";
  if (mode === "deep") return "Глубокая";
  return "Сбалансированная";
}

function reasoningVerifyLabel(value) {
  const mode = normalizeReasoningVerify(value, "basic");
  if (mode === "off") return "Выключена";
  if (mode === "strict") return "Строгая";
  return "Базовая";
}

function reasoningSummaryLabel(value) {
  const mode = normalizeReasoningSummary(value, "auto");
  if (mode === "off") return "Выключена";
  if (mode === "concise") return "Краткая";
  if (mode === "detailed") return "Подробная";
  return "Автоматическая";
}

function reasoningClarifyLabel(value) {
  const mode = normalizeReasoningClarify(value, "never");
  if (mode === "never") return "Никогда";
  if (mode === "normal") return "Обычный";
  return "Минимальный";
}

function reasoningToolsModeLabel(value) {
  const mode = normalizeToolsMode(value, "auto");
  if (mode === "none") return "Не использовать";
  if (mode === "prefer") return "Предпочитать";
  if (mode === "require") return "Обязательно";
  return "Авто";
}
function taskProfileLabel(value) {
  const key = normalizeTaskProfile(value, "auto");
  return TASK_PROFILE_LABELS[key] || key;
}

function normalizeServiceTier(value, fallback = "standard") {
  return normalizeEnum(value, SERVICE_TIER_ORDER, fallback);
}

function serviceTierLabel(value) {
  if (String(value || "").trim().toLowerCase() === "default") return "DEFAULT";
  const tier = normalizeServiceTier(value, "standard");
  return SERVICE_TIER_LABELS[tier] || tier.toUpperCase();
}
function normalizeEnum(value, allowed, fallback) {
  const raw = String(value || "").trim().toLowerCase();
  if (allowed.includes(raw)) return raw;
  const fb = String(fallback || "").trim().toLowerCase();
  return allowed.includes(fb) ? fb : allowed[0];
}

function normalizeReasoningDepth(value, fallback = "balanced") {
  return normalizeEnum(value, REASONING_DEPTH_ORDER, fallback);
}

function normalizeReasoningVerify(value, fallback = "basic") {
  return normalizeEnum(value, REASONING_VERIFY_ORDER, fallback);
}

function normalizeReasoningSummary(value, fallback = "auto") {
  return normalizeEnum(value, REASONING_SUMMARY_ORDER, fallback);
}

function normalizeReasoningClarify(value, fallback = "never") {
  return normalizeEnum(value, REASONING_CLARIFY_ORDER, fallback);
}

function normalizeToolsMode(value, fallback = "auto") {
  return normalizeEnum(value, TOOLS_MODE_ORDER, fallback);
}

function normalizeBrevityMode(value, fallback = "normal") {
  return normalizeEnum(value, BREVITY_MODE_ORDER, fallback);
}

function normalizeOutputMode(value, fallback = "bullets") {
  return normalizeEnum(value, OUTPUT_MODE_ORDER, fallback);
}

function normalizeRiskyActionsMode(value, fallback = "allow_if_asked") {
  return normalizeEnum(value, RISKY_ACTIONS_MODE_ORDER, fallback);
}

function normalizeStyleMode(value, fallback = "clean") {
  return normalizeEnum(value, STYLE_MODE_ORDER, fallback);
}

function normalizeCitationsMode(value, fallback = "off") {
  return normalizeEnum(value, CITATIONS_MODE_ORDER, fallback);
}
function normalizeTaskProfile(value, fallback = "auto") {
  return normalizeEnum(value, TASK_PROFILE_ORDER, fallback);
}

function normalizeBackgroundMode(value, fallback = "auto") {
  return normalizeEnum(value, BACKGROUND_MODE_ORDER, fallback);
}

function normalizeCompactMode(value, fallback = "off") {
  return normalizeEnum(value, COMPACT_MODE_ORDER, fallback);
}

function normalizeIncludeSourcesMode(value, fallback = "off") {
  return normalizeEnum(value, INCLUDE_SOURCES_MODE_ORDER, fallback);
}

function normalizeOptionalTextMode(value, fallback = "auto") {
  return normalizeEnum(value, OPTIONAL_TEXT_MODE_ORDER, fallback);
}

function inferOptionalTextMode(modeRaw, valueRaw, defaultValue = "") {
  const raw = String(modeRaw || "").trim().toLowerCase();
  if (raw === "auto" || raw === "off" || raw === "custom") return raw;
  const value = String(valueRaw || "").trim();
  const def = String(defaultValue || "").trim();
  if (value && value !== def) return "custom";
  return "auto";
}

function normalizeBooleanOption(value, fallback = false) {
  if (typeof value === "boolean") return value;
  if (value === undefined || value === null) return Boolean(fallback);
  const raw = String(value).trim().toLowerCase();
  if (raw === "1" || raw === "true" || raw === "on" || raw === "yes") return true;
  if (raw === "0" || raw === "false" || raw === "off" || raw === "no") return false;
  return Boolean(fallback);
}

function normalizePromptCacheKey(value, fallback = "") {
  const raw = String(value || "").replace(/\s+/g, " ").trim().slice(0, 240);
  if (raw) return raw;
  return String(fallback || "").replace(/\s+/g, " ").trim().slice(0, 240);
}

function normalizePromptCacheRetention(value, fallback = "default") {
  const raw = String(value || "").trim().toLowerCase().slice(0, 64).replace(/_/g, "-");
  if (raw === "default" || raw === "in-memory" || raw === "24h") return raw;
  const fb = String(fallback || "").trim().toLowerCase().slice(0, 64).replace(/_/g, "-");
  if (fb === "default" || fb === "in-memory" || fb === "24h") return fb;
  return "default";
}

function normalizeSafetyIdentifier(value, fallback = "") {
  const raw = String(value || "").replace(/\s+/g, " ").trim().slice(0, 240);
  if (raw) return raw;
  return String(fallback || "").replace(/\s+/g, " ").trim().slice(0, 240);
}

function normalizeTokenThreshold(value, fallback = 0, min = 1, max = 4000000) {
  const raw = Number(value);
  if (!Number.isFinite(raw) || raw <= 0) {
    const fb = Number(fallback);
    if (!Number.isFinite(fb) || fb <= 0) return 0;
    return Math.max(min, Math.min(max, Math.round(fb)));
  }
  return Math.max(min, Math.min(max, Math.round(raw)));
}

function normalizeTurnThreshold(value, fallback = 0, min = 1, max = 10000) {
  return normalizeTokenThreshold(value, fallback, min, max);
}

function normalizeMetadataTag(value, fallback = "") {
  const raw = String(value || "").replace(/\s+/g, " ").trim().slice(0, 64);
  if (raw) return raw;
  return String(fallback || "").replace(/\s+/g, " ").trim().slice(0, 64);
}

function normalizeReasoningMaxTokens(value, fallback = 0) {
  const raw = Number(value);
  if (!Number.isFinite(raw) || raw <= 0) return Math.max(0, Number(fallback) || 0);
  return Math.max(0, Math.round(raw));
}

function loadAiSettings() {
  try {
    const key = String(storage.getItem(STORAGE_KEYS.openAiApiKey) || "").trim();
    app.ai.apiKey = key;
    app.ai.connected = Boolean(key);
  } catch {}

  try {
    const storedModel = String(storage.getItem(STORAGE_KEYS.openAiModel) || "").trim();
    if (isKnownAiModel(storedModel)) app.ai.model = storedModel;
  } catch {}

  try {
    app.ai.collapsed = storage.getItem(STORAGE_KEYS.agentCollapsed) === "1";
  } catch {}

  try {
    const raw = storage.getItem(STORAGE_KEYS.agentOptions);
    if (raw) {
      const parsed = JSON.parse(raw);
      for (const k of ["webSearch", "reasoning", "compatCache", "safeTruncationAuto", "useConversationState", "structuredSpecOutput", "metadataEnabled", "lowBandwidthMode"]) {
        if (typeof parsed[k] === "boolean") app.ai.options[k] = parsed[k];
      }
      app.ai.options.taskProfile = normalizeTaskProfile(parsed.taskProfile, app.ai.options.taskProfile || "auto");
      app.ai.options.serviceTier = normalizeServiceTier(parsed.serviceTier, app.ai.options.serviceTier || "standard");
      app.ai.options.reasoningEffort = normalizeReasoningEffort(parsed.reasoningEffort, app.ai.options.reasoningEffort || "medium");
      app.ai.options.reasoningDepth = normalizeReasoningDepth(parsed.reasoningDepth, app.ai.options.reasoningDepth || "balanced");
      app.ai.options.reasoningVerify = normalizeReasoningVerify(parsed.reasoningVerify, app.ai.options.reasoningVerify || "basic");
      app.ai.options.reasoningSummary = normalizeReasoningSummary(parsed.reasoningSummary, app.ai.options.reasoningSummary || "auto");
      app.ai.options.reasoningClarify = normalizeReasoningClarify(parsed.reasoningClarify, app.ai.options.reasoningClarify || "never");
      app.ai.options.toolsMode = normalizeToolsMode(parsed.toolsMode, app.ai.options.toolsMode || "auto");
      app.ai.options.brevityMode = normalizeBrevityMode(parsed.brevityMode, app.ai.options.brevityMode || "normal");
      app.ai.options.outputMode = normalizeOutputMode(parsed.outputMode, app.ai.options.outputMode || "bullets");
      app.ai.options.riskyActionsMode = normalizeRiskyActionsMode(parsed.riskyActionsMode, app.ai.options.riskyActionsMode || "allow_if_asked");
      app.ai.options.styleMode = normalizeStyleMode(parsed.styleMode, app.ai.options.styleMode || "clean");
      app.ai.options.citationsMode = normalizeCitationsMode(parsed.citationsMode, app.ai.options.citationsMode || "off");
      app.ai.options.reasoningMaxTokens = normalizeReasoningMaxTokens(parsed.reasoningMaxTokens, app.ai.options.reasoningMaxTokens || 0);
      app.ai.options.webSearchCountry = normalizeWebSearchCountry(parsed.webSearchCountry, app.ai.options.webSearchCountry || "RU");
      app.ai.options.webSearchContextSize = normalizeWebSearchContextSize(parsed.webSearchContextSize, app.ai.options.webSearchContextSize || "high");
      app.ai.options.promptCacheKeyMode = inferOptionalTextMode(parsed.promptCacheKeyMode, parsed.promptCacheKey, "");
      app.ai.options.promptCacheKey = normalizePromptCacheKey(parsed.promptCacheKey, app.ai.options.promptCacheKey || "");
      app.ai.options.promptCacheRetentionMode = inferOptionalTextMode(parsed.promptCacheRetentionMode, parsed.promptCacheRetention, "default");
      app.ai.options.promptCacheRetention = normalizePromptCacheRetention(parsed.promptCacheRetention, app.ai.options.promptCacheRetention || "default");
      app.ai.options.safetyIdentifierMode = inferOptionalTextMode(parsed.safetyIdentifierMode, parsed.safetyIdentifier, "");
      app.ai.options.safetyIdentifier = normalizeSafetyIdentifier(parsed.safetyIdentifier, app.ai.options.safetyIdentifier || "");
      app.ai.options.backgroundMode = normalizeBackgroundMode(parsed.backgroundMode, app.ai.options.backgroundMode || "auto");
      app.ai.options.backgroundTokenThreshold = normalizeTokenThreshold(parsed.backgroundTokenThreshold, app.ai.options.backgroundTokenThreshold || 12000, 2000, 2000000);
      app.ai.options.compactMode = normalizeCompactMode(parsed.compactMode, app.ai.options.compactMode || "off");
      app.ai.options.compactThresholdTokens = normalizeTokenThreshold(parsed.compactThresholdTokens, app.ai.options.compactThresholdTokens || 90000, 1000, 4000000);
      app.ai.options.compactTurnThreshold = normalizeTurnThreshold(parsed.compactTurnThreshold, app.ai.options.compactTurnThreshold || 45, 1, 10000);
      app.ai.options.metadataPromptVersionMode = inferOptionalTextMode(parsed.metadataPromptVersionMode, parsed.metadataPromptVersion, "v1");
      app.ai.options.metadataPromptVersion = normalizeMetadataTag(parsed.metadataPromptVersion, app.ai.options.metadataPromptVersion || "v1");
      app.ai.options.metadataFrontendBuildMode = inferOptionalTextMode(parsed.metadataFrontendBuildMode, parsed.metadataFrontendBuild, "");
      app.ai.options.metadataFrontendBuild = normalizeMetadataTag(parsed.metadataFrontendBuild, app.ai.options.metadataFrontendBuild || "");
      app.ai.options.includeSourcesMode = normalizeIncludeSourcesMode(parsed.includeSourcesMode, app.ai.options.includeSourcesMode || "off");
      app.ai.options.safeTruncationAuto = normalizeBooleanOption(parsed.safeTruncationAuto, app.ai.options.safeTruncationAuto === true);
      app.ai.options.useConversationState = normalizeBooleanOption(parsed.useConversationState, app.ai.options.useConversationState === true);
      app.ai.options.structuredSpecOutput = normalizeBooleanOption(parsed.structuredSpecOutput, app.ai.options.structuredSpecOutput === true);
      app.ai.options.metadataEnabled = normalizeBooleanOption(parsed.metadataEnabled, app.ai.options.metadataEnabled !== false);
      app.ai.options.lowBandwidthMode = normalizeBooleanOption(parsed.lowBandwidthMode, app.ai.options.lowBandwidthMode === true);
    }
  } catch {}

  app.ai.webSearchPopoverOpen = false;
  app.ai.reasoningPopoverOpen = false;

  try {
    const rawWidth = num(storage.getItem(STORAGE_KEYS.sidebarWidth), app.ui.sidebarWidth);
    app.ui.sidebarWidth = clampSidebarWidth(rawWidth);
  } catch {}
}

function saveAiOptions() {
  try {
    storage.setItem(STORAGE_KEYS.agentOptions, JSON.stringify(app.ai.options));
  } catch {}
}

function saveAiCollapsed() {
  try {
    storage.setItem(STORAGE_KEYS.agentCollapsed, app.ai.collapsed ? "1" : "0");
  } catch {}
}

function saveOpenAiApiKey() {
  try {
    if (app.ai.apiKey) storage.setItem(STORAGE_KEYS.openAiApiKey, app.ai.apiKey);
    else storage.removeItem(STORAGE_KEYS.openAiApiKey);
  } catch {}
}

function saveOpenAiModel() {
  try {
    if (isKnownAiModel(app.ai.model)) storage.setItem(STORAGE_KEYS.openAiModel, app.ai.model);
  } catch {}
}

function clampSidebarWidth(value) {
  const width = num(value, 360);
  return Math.max(MIN_SIDEBAR_WIDTH, Math.min(MAX_SIDEBAR_WIDTH, Math.round(width)));
}

function saveSidebarWidth() {
  try {
    storage.setItem(STORAGE_KEYS.sidebarWidth, String(clampSidebarWidth(app.ui.sidebarWidth)));
  } catch {}
}

function applySidebarWidth(value, persist = true) {
  app.ui.sidebarWidth = clampSidebarWidth(value);
  if (dom.app) dom.app.style.setProperty("--sidebar-user-w", `${app.ui.sidebarWidth}px`);
  if (persist) saveSidebarWidth();
}

function renderAiUi() {
  if (dom.btnOpenAiAuth) {
    dom.btnOpenAiAuth.classList.toggle("is-connected", app.ai.connected);
    dom.btnOpenAiAuth.title = app.ai.connected ? "OpenAI: настройки подключения" : "Подключить OpenAI";
    dom.btnOpenAiAuth.setAttribute("aria-label", dom.btnOpenAiAuth.title);
  }

  if (dom.agentOverlay) {
    dom.agentOverlay.hidden = !app.ai.connected;
    dom.agentOverlay.classList.toggle("is-collapsed", app.ai.collapsed);
  }

  const hasLockedQuestion = hasLockedQuestionOptions();
  if (dom.btnAgentSend) {
    const isCancelMode = Boolean(app.ai.sending);
    const title = isCancelMode
      ? "\u041e\u0442\u043c\u0435\u043d\u0438\u0442\u044c \u0432\u044b\u043f\u043e\u043b\u043d\u0435\u043d\u0438\u0435"
      : "\u041e\u0442\u043f\u0440\u0430\u0432\u0438\u0442\u044c";
    dom.btnAgentSend.disabled = isCancelMode
      ? false
      : (!app.ai.connected || hasLockedQuestion);
    dom.btnAgentSend.title = title;
    dom.btnAgentSend.setAttribute("aria-label", title);
    const mode = isCancelMode ? "cancel" : "send";
    if (dom.btnAgentSend.dataset.mode !== mode) {
      dom.btnAgentSend.dataset.mode = mode;
      dom.btnAgentSend.innerHTML = isCancelMode
        ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7l10 10M17 7L7 17" /></svg>'
        : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12 20 4l-5 16-3-6-8-2zM12 14l8-10" /></svg>';
    }
  }
  if (dom.agentPrompt) dom.agentPrompt.disabled = !app.ai.connected || app.ai.sending || hasLockedQuestion;
  if (dom.btnAgentCancel) {
    dom.btnAgentCancel.hidden = true;
    dom.btnAgentCancel.disabled = true;
  }

  renderSidebarMode();
  renderJournalViewMode();
  renderAgentChips();
  renderAgentContextIcons();
  renderAgentQuestionFrame();
  renderAgentJournals();
}

function renderAgentChips() {
  if (!dom.agentChips) return;
  const parts = [];
  const gearIcon = "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7zM4 12h2m12 0h2M12 4v2m0 12v2M6.3 6.3l1.4 1.4m8.6 8.6 1.4 1.4m0-11.4-1.4 1.4m-8.6 8.6-1.4 1.4\" /></svg>";
  const selectedAttr = (current, value) => (current === value ? " selected" : "");

  if (app.ai.options.webSearch) {
    const country = normalizeWebSearchCountry(app.ai.options.webSearchCountry, "RU");
    const contextSize = normalizeWebSearchContextSize(app.ai.options.webSearchContextSize, "high");
    const contextSizeLabel = webSearchContextSizeLabel(contextSize);
    const countryLabel = webSearchCountryLabel(country);
    const wrapCls = app.ai.webSearchPopoverOpen
      ? "agent-tool-chip-wrap agent-web-search-wrap is-open"
      : "agent-tool-chip-wrap agent-web-search-wrap";
    const chipCls = app.ai.webSearchPopoverOpen
      ? "agent-chip agent-tool-chip is-selected"
      : "agent-chip agent-tool-chip";
    parts.push(`<div class="${wrapCls}" data-web-search-wrap>
      <button type="button" class="${chipCls}" data-ai-chip-option="webSearchSettings" title="Настройки веб-поиска" aria-label="Настройки веб-поиска">
        <b>Веб-поиск</b>
        <span>Поиск в интернете</span>
        ${gearIcon}
      </button>
      <div class="agent-web-search-popover" data-web-search-popover role="dialog" aria-label="Настройки веб-поиска">
        <div class="agent-web-search-head">
          <strong>Веб-поиск</strong>
          <button type="button" class="agent-web-search-close" data-web-search-action="close" aria-label="Закрыть настройки">x</button>
        </div>
        <label class="agent-web-search-row">
          <span data-tooltip="Что делает настройка: определяет географию веб-выдачи и источников.&#10;&#10;• Россия (RU) — приоритет русскоязычных и локальных источников.&#10;• США (US) — приоритет англоязычных источников США.&#10;• Германия (DE), Великобритания (GB), Франция (FR) — приоритет источников выбранного региона.">Страна</span>
          <select data-web-search-config="country">
            <option value="RU"${selectedAttr(country, "RU")}>Россия (RU)</option>
            <option value="US"${selectedAttr(country, "US")}>США (US)</option>
            <option value="DE"${selectedAttr(country, "DE")}>Германия (DE)</option>
            <option value="GB"${selectedAttr(country, "GB")}>Великобритания (GB)</option>
            <option value="FR"${selectedAttr(country, "FR")}>Франция (FR)</option>
          </select>
        </label>
        <label class="agent-web-search-row">
          <span data-tooltip="Что делает настройка: задаёт объём контекста, который берётся из веб-поиска.&#10;&#10;• Максимальный — больше материалов из поиска, выше полнота, но медленнее и дороже.&#10;• Средний — баланс полноты и скорости.&#10;• Минимальный — быстрее и дешевле, но меньше контекста.">Контекст</span>
          <select data-web-search-config="contextSize">
            <option value="high"${selectedAttr(contextSize, "high")}>Максимальный</option>
            <option value="medium"${selectedAttr(contextSize, "medium")}>Средний</option>
            <option value="low"${selectedAttr(contextSize, "low")}>Минимальный</option>
          </select>
        </label>
      </div>
    </div>`);
  }

  if (app.ai.options.reasoning !== false) {
    const taskProfile = normalizeTaskProfile(app.ai.options.taskProfile, "auto");
    const effort = normalizeReasoningEffort(app.ai.options.reasoningEffort, "medium");
    const depth = normalizeReasoningDepth(app.ai.options.reasoningDepth, "balanced");
    const verify = normalizeReasoningVerify(app.ai.options.reasoningVerify, "basic");
    const summaryMode = normalizeReasoningSummary(app.ai.options.reasoningSummary, "auto");
    const clarify = normalizeReasoningClarify(app.ai.options.reasoningClarify, "never");
    const toolsMode = normalizeToolsMode(app.ai.options.toolsMode, "auto");
    const brevityMode = normalizeBrevityMode(app.ai.options.brevityMode, "normal");
    const outputMode = normalizeOutputMode(app.ai.options.outputMode, "bullets");
    const riskyActionsMode = normalizeRiskyActionsMode(app.ai.options.riskyActionsMode, "allow_if_asked");
    const styleMode = normalizeStyleMode(app.ai.options.styleMode, "clean");
    const citationsMode = normalizeCitationsMode(app.ai.options.citationsMode, "off");
    const reasoningMaxTokens = normalizeReasoningMaxTokens(app.ai.options.reasoningMaxTokens, 0);
    const compatCache = app.ai.options.compatCache !== false;
    const promptCacheKeyMode = normalizeOptionalTextMode(app.ai.options.promptCacheKeyMode, "auto");
    const promptCacheKeyRaw = normalizePromptCacheKey(app.ai.options.promptCacheKey, "");
    const promptCacheRetentionMode = normalizeOptionalTextMode(app.ai.options.promptCacheRetentionMode, "auto");
    const promptCacheRetentionRaw = normalizePromptCacheRetention(app.ai.options.promptCacheRetention, "default");
    const safetyIdentifierMode = normalizeOptionalTextMode(app.ai.options.safetyIdentifierMode, "auto");
    const safetyIdentifierRaw = normalizeSafetyIdentifier(app.ai.options.safetyIdentifier, "");
    const safeTruncationAuto = normalizeBooleanOption(app.ai.options.safeTruncationAuto, false);
    const backgroundMode = normalizeBackgroundMode(app.ai.options.backgroundMode, "auto");
    const backgroundTokenThreshold = normalizeTokenThreshold(app.ai.options.backgroundTokenThreshold, 12000, 2000, 2000000);
    const compactMode = normalizeCompactMode(app.ai.options.compactMode, "off");
    const compactThresholdTokens = normalizeTokenThreshold(app.ai.options.compactThresholdTokens, 90000, 1000, 4000000);
    const compactTurnThreshold = normalizeTurnThreshold(app.ai.options.compactTurnThreshold, 45, 1, 10000);
    const useConversationState = normalizeBooleanOption(app.ai.options.useConversationState, false);
    const structuredSpecOutput = normalizeBooleanOption(app.ai.options.structuredSpecOutput, false);
    const metadataEnabled = normalizeBooleanOption(app.ai.options.metadataEnabled, true);
    const metadataPromptVersionMode = normalizeOptionalTextMode(app.ai.options.metadataPromptVersionMode, "auto");
    const metadataPromptVersionRaw = normalizeMetadataTag(app.ai.options.metadataPromptVersion, "v1");
    const metadataFrontendBuildMode = normalizeOptionalTextMode(app.ai.options.metadataFrontendBuildMode, "auto");
    const metadataFrontendBuildRaw = normalizeMetadataTag(app.ai.options.metadataFrontendBuild, "");
    const includeSourcesMode = normalizeIncludeSourcesMode(app.ai.options.includeSourcesMode, "off");
    const lowBandwidthMode = normalizeBooleanOption(app.ai.options.lowBandwidthMode, false);
    const serviceTierRequested = normalizeServiceTier(app?.ai?.options?.serviceTier, "standard");
    const serviceTierActual = String(app?.ai?.serviceTierActual || "").trim().toLowerCase();
    const backgroundActive = Boolean(app?.ai?.backgroundActive);
    const backgroundPollCount = Math.max(0, Number(app?.ai?.backgroundPollCount || 0));

    const effortLabel = reasoningEffortLabel(effort);
    const taskProfileLabelText = taskProfileLabel(taskProfile);
    const depthLabel = reasoningDepthLabel(depth);
    const verifyLabel = reasoningVerifyLabel(verify);
    const summaryLabel = reasoningSummaryLabel(summaryMode);
    const clarifyLabel = reasoningClarifyLabel(clarify);
    const toolsLabel = reasoningToolsModeLabel(toolsMode);
    const compactStatus = compactMode === "on"
      ? "вкл"
      : compactMode === "auto"
        ? `авто(${compactThresholdTokens}/${compactTurnThreshold})`
        : "выкл";
    const bgStatus = backgroundMode === "on"
      ? "вкл"
      : backgroundMode === "auto"
        ? `авто(>=${backgroundTokenThreshold})`
        : "выкл";
    const sourcesStatus = includeSourcesMode === "on"
      ? "вкл"
      : includeSourcesMode === "auto"
        ? "авто"
        : "выкл";
    const serviceActualLabel = serviceTierActual ? serviceTierLabel(serviceTierActual) : "н/д";
    const effortScore = effort === "xhigh" ? 4 : effort === "high" ? 3 : effort === "medium" ? 2 : 1;
    const resourceScore = effortScore
      + (depth === "deep" ? 2 : depth === "balanced" ? 1 : 0)
      + (verify === "strict" ? 2 : verify === "basic" ? 1 : 0)
      + (structuredSpecOutput ? 2 : 0)
      + (backgroundMode === "on" ? 1 : 0)
      + (compactMode === "on" ? 1 : 0)
      + (reasoningMaxTokens >= 16000 ? 2 : reasoningMaxTokens >= 8000 ? 1 : 0)
      + (includeSourcesMode === "on" ? 1 : 0);
    const resourceTier = resourceScore >= 10 ? "Высокая нагрузка" : resourceScore >= 6 ? "Средняя нагрузка" : "Низкая нагрузка";
    const speedTier = resourceScore >= 10 ? "скорость ниже" : resourceScore >= 6 ? "скорость средняя" : "скорость выше";
    const budgetTier = resourceScore >= 10 ? "расход выше" : resourceScore >= 6 ? "расход средний" : "расход ниже";
    const resourceSummary = `${resourceTier}; ${speedTier}; ${budgetTier}`;
    const customModeLabel = (valueRaw) => {
      const text = String(valueRaw || "").trim();
      if (!text) return "Введите текст…";
      if (text.length <= 20) return `Введите текст: ${text}`;
      return `Введите текст: ${text.slice(0, 20)}…`;
    };
    const promptCacheKeyCustomLabel = customModeLabel(promptCacheKeyRaw);
    const promptCacheRetentionCustomLabel = customModeLabel(promptCacheRetentionRaw === "default" ? "" : promptCacheRetentionRaw);
    const safetyIdentifierCustomLabel = customModeLabel(safetyIdentifierRaw);
    const metadataPromptVersionCustomLabel = customModeLabel(metadataPromptVersionRaw === "v1" ? "" : metadataPromptVersionRaw);
    const metadataFrontendBuildCustomLabel = customModeLabel(metadataFrontendBuildRaw);

    const wrapCls = app.ai.reasoningPopoverOpen
      ? "agent-tool-chip-wrap agent-reasoning-wrap is-open"
      : "agent-tool-chip-wrap agent-reasoning-wrap";
    const chipCls = app.ai.reasoningPopoverOpen
      ? "agent-chip agent-tool-chip is-selected"
      : "agent-chip agent-tool-chip";

    parts.push(`<div class="${wrapCls}" data-reasoning-wrap>
      <button type="button" class="${chipCls}" data-ai-chip-option="reasoningSettings" title="Настройки размышлений" aria-label="Настройки размышлений">
        <b>Размышления</b>
        <span>${esc(taskProfileLabelText)}</span>
        ${gearIcon}
      </button>
      <div class="agent-reasoning-popover" data-reasoning-popover role="dialog" aria-label="Настройки размышлений">
        <div class="agent-web-search-head">
          <strong>Размышления</strong>
          <button type="button" class="agent-web-search-close" data-reasoning-action="close" aria-label="Закрыть настройки">x</button>
        </div>
        <label class="agent-web-search-row">
          <span data-tooltip="Что делает настройка: выбирает стратегию работы агента под тип задачи (порядок сверху вниз: от самого лёгкого к самому тяжёлому).&#10;&#10;• Авто — профиль подбирается по задаче и ключевым словам.&#10;• Черновик — самая высокая скорость, минимальная глубина.&#10;• Стандартный — базовый универсальный режим.&#10;• Пакетный — быстрые массовые операции.&#10;• Длинная сессия — устойчивость на долгом диалоге.&#10;• Поиск цен и источников — сбор цен, поставщиков и ссылок.&#10;• КП и спецификация — фокус на структуру коммерческого предложения.&#10;• Аудит исходников — глубокий разбор кода и артефактов.&#10;• Точный — усиленная самопроверка и детализация.&#10;• Исследование — самый глубокий поиск и сравнение источников.&#10;• Спецификация ЩО (максимум) — наиболее строгий профиль для электрощитовой спецификации.&#10;• Пользовательский — полностью ручные настройки.">Профиль</span>
          <select data-reasoning-config="taskProfile">
            <option value="auto"${selectedAttr(taskProfile, "auto")}>Авто (по задаче)</option>
            <option value="fast"${selectedAttr(taskProfile, "fast")}>Черновик (макс. скорость)</option>
            <option value="balanced"${selectedAttr(taskProfile, "balanced")}>Стандартный</option>
            <option value="bulk"${selectedAttr(taskProfile, "bulk")}>Пакетный (быстро)</option>
            <option value="longrun"${selectedAttr(taskProfile, "longrun")}>Длинная сессия</option>
            <option value="price_search"${selectedAttr(taskProfile, "price_search")}>Поиск цен и источников</option>
            <option value="proposal"${selectedAttr(taskProfile, "proposal")}>КП и спецификация</option>
            <option value="source_audit"${selectedAttr(taskProfile, "source_audit")}>Аудит исходников</option>
            <option value="accurate"${selectedAttr(taskProfile, "accurate")}>Точный (усиленная проверка)</option>
            <option value="research"${selectedAttr(taskProfile, "research")}>Исследование (глубоко)</option>
            <option value="spec_strict"${selectedAttr(taskProfile, "spec_strict")}>Спецификация ЩО (максимум)</option>
            <option value="custom"${selectedAttr(taskProfile, "custom")}>Пользовательский</option>
          </select>
        </label>
        <label class="agent-web-search-row">
          <span data-tooltip="Что показывает настройка: суммарную оценку нагрузки текущих параметров.&#10;&#10;• Формируется из усилия, глубины, проверки, лимитов токенов, включённых источников, фона и структурированного JSON.&#10;• Используйте для быстрой оценки компромисса «качество/скорость/стоимость».">Оценка ресурсов</span>
          <input type="text" value="${esc(resourceSummary)}" readonly tabindex="-1" />
        </label>
        <label class="agent-web-search-row">
          <span data-tooltip="Что делает настройка: задаёт вычислительное усилие модели.&#10;&#10;• Низкое — быстрый ответ, минимум анализа.&#10;• Среднее — баланс скорости и качества.&#10;• Высокое — больше сравнений и самопроверок.&#10;• Максимальное — наиболее тщательная проработка (дольше и дороже).">Усилие</span>
          <select data-reasoning-config="effort">
            <option value="low"${selectedAttr(effort, "low")}>Низкое</option>
            <option value="medium"${selectedAttr(effort, "medium")}>Среднее</option>
            <option value="high"${selectedAttr(effort, "high")}>Высокое</option>
            <option value="xhigh"${selectedAttr(effort, "xhigh")}>Максимальное</option>
          </select>
        </label>
        <label class="agent-web-search-row">
          <span data-tooltip="Что делает настройка: определяет глубину рассуждений.&#10;&#10;• Быстро — короткая цепочка рассуждений.&#10;• Сбалансировано — стандартная глубина анализа.&#10;• Глубоко — несколько подходов и расширенная проверка.">Глубина</span>
          <select data-reasoning-config="depth">
            <option value="fast"${selectedAttr(depth, "fast")}>Быстро</option>
            <option value="balanced"${selectedAttr(depth, "balanced")}>Сбалансировано</option>
            <option value="deep"${selectedAttr(depth, "deep")}>Глубоко</option>
          </select>
        </label>
        <label class="agent-web-search-row">
          <span data-tooltip="Что делает настройка: задаёт строгость самопроверки перед ответом.&#10;&#10;• Выключена — без явной самопроверки.&#10;• Базовая — короткая проверка логики и очевидных ошибок.&#10;• Строгая — подробный чеклист, поиск противоречий и проверка краевых случаев.">Проверка</span>
          <select data-reasoning-config="verify">
            <option value="off"${selectedAttr(verify, "off")}>Выключена</option>
            <option value="basic"${selectedAttr(verify, "basic")}>Базовая</option>
            <option value="strict"${selectedAttr(verify, "strict")}>Строгая</option>
          </select>
        </label>
        <label class="agent-web-search-row">
          <span data-tooltip="Что делает настройка: определяет, какую сводку рассуждений показывать.&#10;&#10;• Авто — уровень сводки выбирается автоматически.&#10;• Краткая — только ключевые выводы.&#10;• Подробная — расширенная сводка шагов.&#10;• Выключена — без сводки рассуждений.">Сводка</span>
          <select data-reasoning-config="summaryMode">
            <option value="auto"${selectedAttr(summaryMode, "auto")}>Авто</option>
            <option value="concise"${selectedAttr(summaryMode, "concise")}>Краткая</option>
            <option value="detailed"${selectedAttr(summaryMode, "detailed")}>Подробная</option>
            <option value="off"${selectedAttr(summaryMode, "off")}>Выключена</option>
          </select>
        </label>
        <label class="agent-web-search-row">
          <span data-tooltip="Что делает настройка: регулирует частоту уточняющих вопросов пользователю.&#10;&#10;• Никогда — не задавать уточнения, работать с допущениями.&#10;• Минимально — спрашивать только при высоком риске ошибки.&#10;• Обычно — спрашивать при существенной неопределённости.&#10;• Если в «Риски» выбран «Никогда», вопросы блокируются независимо от этого поля.">Уточнения</span>
          <select data-reasoning-config="clarify">
            <option value="never"${selectedAttr(clarify, "never")}>Никогда</option>
            <option value="minimal"${selectedAttr(clarify, "minimal")}>Минимально</option>
            <option value="normal"${selectedAttr(clarify, "normal")}>Обычно</option>
          </select>
        </label>
        <label class="agent-web-search-row">
          <span data-tooltip="Что делает настройка: задаёт политику использования инструментов.&#10;&#10;• Авто — использовать инструменты по необходимости.&#10;• Предпочитать — чаще обращаться к инструментам для проверки фактов.&#10;• Обязательно — по возможности решать через инструменты.&#10;• Не использовать — отвечать без инструментов.">Инструменты</span>
          <select data-reasoning-config="toolsMode">
            <option value="auto"${selectedAttr(toolsMode, "auto")}>Авто</option>
            <option value="prefer"${selectedAttr(toolsMode, "prefer")}>Предпочитать</option>
            <option value="require"${selectedAttr(toolsMode, "require")}>Обязательно</option>
            <option value="none"${selectedAttr(toolsMode, "none")}>Не использовать</option>
          </select>
        </label>
        <label class="agent-web-search-row">
          <span data-tooltip="Что делает настройка: определяет длину и насыщенность финального ответа.&#10;&#10;• Кратко — только итог и минимум деталей.&#10;• Нормально — баланс краткости и пояснений.&#10;• Подробно — развернутые шаги, контекст и пояснения.">Краткость</span>
          <select data-reasoning-config="brevityMode">
            <option value="short"${selectedAttr(brevityMode, "short")}>Кратко</option>
            <option value="normal"${selectedAttr(brevityMode, "normal")}>Нормально</option>
            <option value="detailed"${selectedAttr(brevityMode, "detailed")}>Подробно</option>
          </select>
        </label>
        <label class="agent-web-search-row">
          <span data-tooltip="Что делает настройка: определяет формат финального ответа.&#10;&#10;• Обычный текст — свободная форма ответа.&#10;• Пункты — структурированный список.&#10;• JSON — строгий JSON без лишнего текста.">Формат</span>
          <select data-reasoning-config="outputMode">
            <option value="plain"${selectedAttr(outputMode, "plain")}>Обычный текст</option>
            <option value="bullets"${selectedAttr(outputMode, "bullets")}>Пункты</option>
            <option value="json"${selectedAttr(outputMode, "json")}>JSON</option>
          </select>
        </label>
        <label class="agent-web-search-row">
          <span data-tooltip="Что делает настройка: управляет поведением при рискованных действиях.&#10;&#10;• Только по явной просьбе — рискованные шаги выполнять только по прямому запросу пользователя.&#10;• Подтверждать — перед рискованными/необратимыми действиями просить подтверждение.&#10;• Никогда — полностью запретить вопросы пользователю и вызов ask_user_question.">Риски</span>
          <select data-reasoning-config="riskyActionsMode">
            <option value="allow_if_asked"${selectedAttr(riskyActionsMode, "allow_if_asked")}>Только по явной просьбе</option>
            <option value="confirm"${selectedAttr(riskyActionsMode, "confirm")}>Подтверждать</option>
            <option value="never"${selectedAttr(riskyActionsMode, "never")}>Никогда</option>
          </select>
        </label>
        <label class="agent-web-search-row">
          <span data-tooltip="Что делает настройка: задаёт стиль подачи ответа.&#10;&#10;• Сухой — максимально по делу.&#10;• Развёрнутый — больше контекста и обоснований.">Стиль</span>
          <select data-reasoning-config="styleMode">
            <option value="clean"${selectedAttr(styleMode, "clean")}>Сухой</option>
            <option value="verbose"${selectedAttr(styleMode, "verbose")}>Развёрнутый</option>
          </select>
        </label>
        <label class="agent-web-search-row">
          <span data-tooltip="Что делает настройка: управляет автоматическим добавлением ссылок на источники.&#10;&#10;• Выключены — ссылки на источники не добавляются автоматически.&#10;• Включены — при web_search добавляются ссылки на ключевые источники.">Ссылки</span>
          <select data-reasoning-config="citationsMode">
            <option value="off"${selectedAttr(citationsMode, "off")}>Выключены</option>
            <option value="on"${selectedAttr(citationsMode, "on")}>Включены</option>
          </select>
        </label>
        <label class="agent-web-search-row">
          <span data-tooltip="Что делает настройка: задаёт верхнюю границу длины ответа в токенах.&#10;&#10;• 0 — лимит выбирается моделью автоматически.&#10;• Положительное число — жёсткий верхний предел длины ответа в токенах.&#10;• Чем выше лимит, тем потенциально длиннее ответ, но выше время и стоимость.&#10;• Пример: 12000.">Токены</span>
          <input type="number" min="0" step="1" value="${reasoningMaxTokens}" data-reasoning-config="maxTokens" />
        </label>
        <label class="agent-web-search-row">
          <span data-tooltip="Что делает настройка: включает/выключает запоминание фолбэков неподдерживаемых параметров модели.&#10;&#10;• Вкл — рантайм запоминает совместимые фолбэки параметров модели и применяет их дальше.&#10;• Выкл — кэш совместимости не используется.">Кэш совместимости</span>
          <select data-reasoning-config="compatCache">
            <option value="on"${compatCache ? " selected" : ""}>Вкл</option>
            <option value="off"${compatCache ? "" : " selected"}>Выкл</option>
          </select>
        </label>
        <label class="agent-web-search-row">
          <span data-tooltip="Что делает настройка: задаёт режим и значение prompt_cache_key одним полем.&#10;&#10;• Авто — ключ формируется автоматически.&#10;• Выкл — prompt_cache_key не отправляется.&#10;• Введите текст… — при выборе откроется ввод вашего ключа.">Ключ кэша промпта</span>
          <select data-reasoning-config="promptCacheKeyMode">
            ${promptCacheKeyMode === "custom" ? `<option value="" selected hidden>${esc(promptCacheKeyCustomLabel)}</option>` : ""}
            <option value="auto"${selectedAttr(promptCacheKeyMode, "auto")}>Авто</option>
            <option value="off"${selectedAttr(promptCacheKeyMode, "off")}>Выкл</option>
            <option value="custom">Введите текст…</option>
          </select>
        </label>
        <label class="agent-web-search-row">
          <span data-tooltip="Что делает настройка: задаёт режим и значение prompt_cache_retention одним полем.&#10;&#10;• Авто — удержание выбирается автоматически по профилю и нагрузке (обычно in-memory для лёгких задач, 24h для тяжёлых/длинных).&#10;• Выкл — не отправлять prompt_cache_retention.&#10;• Введите текст… — при выборе откроется ввод (например 24h или in-memory).">Удержание кэша</span>
          <select data-reasoning-config="promptCacheRetentionMode">
            ${promptCacheRetentionMode === "custom" ? `<option value="" selected hidden>${esc(promptCacheRetentionCustomLabel)}</option>` : ""}
            <option value="auto"${selectedAttr(promptCacheRetentionMode, "auto")}>Авто</option>
            <option value="off"${selectedAttr(promptCacheRetentionMode, "off")}>Выкл</option>
            <option value="custom">Введите текст…</option>
          </select>
        </label>
        <label class="agent-web-search-row">
          <span data-tooltip="Что делает настройка: задаёт режим и значение safety_identifier одним полем.&#10;&#10;• Авто — идентификатор формируется автоматически.&#10;• Выкл — safety_identifier не отправляется.&#10;• Введите текст… — при выборе откроется ввод вашего идентификатора.">Идентификатор безопасности</span>
          <select data-reasoning-config="safetyIdentifierMode">
            ${safetyIdentifierMode === "custom" ? `<option value="" selected hidden>${esc(safetyIdentifierCustomLabel)}</option>` : ""}
            <option value="auto"${selectedAttr(safetyIdentifierMode, "auto")}>Авто</option>
            <option value="off"${selectedAttr(safetyIdentifierMode, "off")}>Выкл</option>
            <option value="custom">Введите текст…</option>
          </select>
        </label>
        <label class="agent-web-search-row">
          <span data-tooltip="Что делает настройка: определяет поведение при переполнении контекста.&#10;&#10;• Вкл — отправлять truncation=auto (режим «не падать» при переполнении контекста).&#10;• Выкл — не отправлять truncation (кроме специальных случаев модели).">Безопасная обрезка</span>
          <select data-reasoning-config="safeTruncationAuto">
            <option value="off"${safeTruncationAuto ? "" : " selected"}>Выкл</option>
            <option value="on"${safeTruncationAuto ? " selected" : ""}>Вкл</option>
          </select>
        </label>
        <label class="agent-web-search-row">
          <span data-tooltip="Что делает настройка: задаёт режим запуска ответа (синхронно/в фоне).&#10;&#10;• Выкл — всегда синхронный запуск.&#10;• Авто — фон только для bulk или при большом max_output_tokens.&#10;• Вкл — стартовый запрос всегда в фоне.">Фоновый режим</span>
          <select data-reasoning-config="backgroundMode">
            <option value="off"${selectedAttr(backgroundMode, "off")}>Выкл</option>
            <option value="auto"${selectedAttr(backgroundMode, "auto")}>Авто</option>
            <option value="on"${selectedAttr(backgroundMode, "on")}>Вкл</option>
          </select>
        </label>
        <label class="agent-web-search-row">
          <span data-tooltip="Что делает настройка: задаёт порог автоперехода в фоновый режим.&#10;&#10;• Используется в режиме «Авто».&#10;• Если max_output_tokens >= порога, стартовый запрос уходит в фон.&#10;• Пример: 12000.">Порог фона</span>
          <input type="number" min="2000" step="500" value="${backgroundTokenThreshold}" data-reasoning-config="backgroundTokenThreshold" />
        </label>
        <label class="agent-web-search-row">
          <span data-tooltip="Что делает настройка: управляет автокомпакцией контекста через endpoint compact в Responses API.&#10;&#10;• Выкл — компакция отключена.&#10;• Авто — компакция по порогам токенов/ходов.&#10;• Вкл — компакция всегда включена.">Компакция</span>
          <select data-reasoning-config="compactMode">
            <option value="off"${selectedAttr(compactMode, "off")}>Выкл</option>
            <option value="auto"${selectedAttr(compactMode, "auto")}>Авто</option>
            <option value="on"${selectedAttr(compactMode, "on")}>Вкл</option>
          </select>
        </label>
        <label class="agent-web-search-row">
          <span data-tooltip="Что делает настройка: задаёт токен-порог для автокомпакции.&#10;&#10;• Используется в режиме «Авто».&#10;• Если input_tokens >= порога, выполняется compact.&#10;• Пример: 90000.">Порог компакции (токены)</span>
          <input type="number" min="1000" step="1000" value="${compactThresholdTokens}" data-reasoning-config="compactThresholdTokens" />
        </label>
        <label class="agent-web-search-row">
          <span data-tooltip="Что делает настройка: задаёт порог по числу ходов для автокомпакции.&#10;&#10;• Используется в режиме «Авто».&#10;• Если число ходов >= порога, выполняется компакция длинной сессии.&#10;• Пример: 45.">Порог компакции (ходы)</span>
          <input type="number" min="1" step="1" value="${compactTurnThreshold}" data-reasoning-config="compactTurnThreshold" />
        </label>
        <label class="agent-web-search-row">
          <span data-tooltip="Что делает настройка: управляет переносом состояния диалога между запросами.&#10;&#10;• Вкл — в длинных сессиях переносить контекст через previous_response_id.&#10;• Выкл — контекст собирается только из локальной истории.">Состояние диалога</span>
          <select data-reasoning-config="useConversationState">
            <option value="off"${useConversationState ? "" : " selected"}>Выкл</option>
            <option value="on"${useConversationState ? " selected" : ""}>Вкл</option>
          </select>
        </label>
        <label class="agent-web-search-row">
          <span data-tooltip="Что делает настройка: включает строгий структурированный вывод по JSON Schema.&#10;&#10;• Вкл — включить структурированный вывод по JSON Schema.&#10;• Выкл — обычный текстовый вывод.">Структурированный JSON спецификации</span>
          <select data-reasoning-config="structuredSpecOutput">
            <option value="off"${structuredSpecOutput ? "" : " selected"}>Выкл</option>
            <option value="on"${structuredSpecOutput ? " selected" : ""}>Вкл</option>
          </select>
        </label>
        <label class="agent-web-search-row">
          <span data-tooltip="Что делает настройка: включает передачу служебных metadata в Responses API.&#10;&#10;• Вкл — отправлять metadata в Responses API (до 16 пар ключ-значение).&#10;• Выкл — не отправлять metadata.">Метаданные</span>
          <select data-reasoning-config="metadataEnabled">
            <option value="on"${metadataEnabled ? " selected" : ""}>Вкл</option>
            <option value="off"${metadataEnabled ? "" : " selected"}>Выкл</option>
          </select>
        </label>
        <label class="agent-web-search-row">
          <span data-tooltip="Что делает настройка: задаёт режим и значение metadata.prompt_version одним полем.&#10;&#10;• Авто — версия формируется автоматически из текущей версии системы/профиля.&#10;• Выкл — тег prompt_version не отправляется.&#10;• Введите текст… — при выборе откроется ввод версии.">Версия промпта</span>
          <select data-reasoning-config="metadataPromptVersionMode">
            ${metadataPromptVersionMode === "custom" ? `<option value="" selected hidden>${esc(metadataPromptVersionCustomLabel)}</option>` : ""}
            <option value="auto"${selectedAttr(metadataPromptVersionMode, "auto")}>Авто</option>
            <option value="off"${selectedAttr(metadataPromptVersionMode, "off")}>Выкл</option>
            <option value="custom">Введите текст…</option>
          </select>
        </label>
        <label class="agent-web-search-row">
          <span data-tooltip="Что делает настройка: задаёт режим и значение metadata.frontend_build одним полем.&#10;&#10;• Авто — тег сборки фронта формируется автоматически.&#10;• Выкл — тег frontend_build не отправляется.&#10;• Введите текст… — при выборе откроется ввод сборки.">Сборка фронтенда</span>
          <select data-reasoning-config="metadataFrontendBuildMode">
            ${metadataFrontendBuildMode === "custom" ? `<option value="" selected hidden>${esc(metadataFrontendBuildCustomLabel)}</option>` : ""}
            <option value="auto"${selectedAttr(metadataFrontendBuildMode, "auto")}>Авто</option>
            <option value="off"${selectedAttr(metadataFrontendBuildMode, "off")}>Выкл</option>
            <option value="custom">Введите текст…</option>
          </select>
        </label>
        <label class="agent-web-search-row">
          <span data-tooltip="Что делает настройка: управляет запросом источников и результатов tool-call через include.&#10;&#10;• Выкл — поле include не запрашивается.&#10;• Авто — include включается по профилю/инструментам.&#10;• Вкл — всегда запрашивать источники и результаты web/file search.">Источники в ответе</span>
          <select data-reasoning-config="includeSourcesMode">
            <option value="off"${selectedAttr(includeSourcesMode, "off")}>Выкл</option>
            <option value="auto"${selectedAttr(includeSourcesMode, "auto")}>Авто</option>
            <option value="on"${selectedAttr(includeSourcesMode, "on")}>Вкл</option>
          </select>
        </label>
        <label class="agent-web-search-row">
          <span data-tooltip="Что делает настройка: включает экономию трафика при стриминге.&#10;&#10;• Вкл — stream_options.include_obfuscation=false (меньше трафика).&#10;• Выкл — стандартное поведение API.">Режим низкой полосы</span>
          <select data-reasoning-config="lowBandwidthMode">
            <option value="off"${lowBandwidthMode ? "" : " selected"}>Выкл</option>
            <option value="on"${lowBandwidthMode ? " selected" : ""}>Вкл</option>
          </select>
        </label>
      </div>
    </div>`);
  }

  for (const f of app.ai.attachments) {
    const kb = Math.max(1, Math.round(num(f.size) / 1024));
    parts.push(`<span class="agent-chip" data-chip-type="file" data-chip-id="${esc(f.id)}"><b>файл</b><span>${esc(f.name)} (${kb} КБ)</span><button type="button" class="remove" title="Открепить" aria-label="Открепить">x</button></span>`);
  }

  dom.agentChips.innerHTML = parts.join("");
}

function renderAgentContextIcons() {
  if (!dom.agentContextIcons) return;
  dom.agentContextIcons.querySelectorAll("[data-ai-option]").forEach((btn) => {
    const key = String(btn.dataset.aiOption || "");
    if (key === "files") {
      btn.classList.toggle("is-selected", app.ai.attachments.length > 0);
      return;
    }
    if (key === "reasoning") {
      const enabled = app.ai.options.reasoning !== false;
      const taskProfile = normalizeTaskProfile(app.ai.options.taskProfile, "auto");
      const effort = normalizeReasoningEffort(app.ai.options.reasoningEffort, "medium");
      const depth = normalizeReasoningDepth(app.ai.options.reasoningDepth, "balanced");
      const verify = normalizeReasoningVerify(app.ai.options.reasoningVerify, "basic");
      const summaryMode = normalizeReasoningSummary(app.ai.options.reasoningSummary, "auto");
      const backgroundMode = normalizeBackgroundMode(app.ai.options.backgroundMode, "auto");
      const compactMode = normalizeCompactMode(app.ai.options.compactMode, "off");
      const useConversationState = normalizeBooleanOption(app.ai.options.useConversationState, false);
      const lowBandwidthMode = normalizeBooleanOption(app.ai.options.lowBandwidthMode, false);
      const serviceTierRequested = normalizeServiceTier(app?.ai?.options?.serviceTier, "standard");
      const serviceTierActualRaw = String(app?.ai?.serviceTierActual || "").trim().toLowerCase();
      const effortLabel = reasoningEffortLabel(effort);
      const depthLabel = reasoningDepthLabel(depth);
      const verifyLabel = reasoningVerifyLabel(verify);
      const summaryLabel = reasoningSummaryLabel(summaryMode);
      const profileLabel = taskProfileLabel(taskProfile);
      btn.classList.toggle("is-selected", enabled);
      btn.dataset.effort = effort;
      const backgroundTitle = backgroundMode === "auto" ? "авто" : backgroundMode === "on" ? "вкл" : "выкл";
      const compactTitle = compactMode === "auto" ? "авто" : compactMode === "on" ? "вкл" : "выкл";
      const serviceTierActualLabel = serviceTierActualRaw ? serviceTierLabel(serviceTierActualRaw) : "н/д";
      const title = `Размышления: ${enabled ? "включены" : "выключены"}, профиль — ${profileLabel}, усилие — ${effortLabel}, глубина — ${depthLabel}, проверка — ${verifyLabel}, сводка — ${summaryLabel}, фон — ${backgroundTitle}, компакция — ${compactTitle}, состояние диалога — ${useConversationState ? "вкл" : "выкл"}, низкая полоса — ${lowBandwidthMode ? "вкл" : "выкл"}, уровень сервиса — ${serviceTierLabel(serviceTierRequested)}/${serviceTierActualLabel}`;
      btn.title = title;
      btn.setAttribute("aria-label", `${title}. Нажмите для переключения.`);
      const badge = btn.querySelector("[data-ai-effort-badge]");
      if (badge) {
        badge.textContent = reasoningEffortBadge(effort);
        badge.style.opacity = enabled ? "1" : "0.45";
      }
      return;
    }
    if (key === "webSearch") {
      const title = `Веб-поиск: ${app.ai.options.webSearch ? "включён" : "выключен"}`;
      btn.title = title;
      btn.setAttribute("aria-label", `${title}. Нажмите для переключения.`);
      btn.classList.toggle("is-selected", Boolean(app.ai.options.webSearch));
      return;
    }
    btn.classList.toggle("is-selected", Boolean(app.ai.options[key]));
  });
}
function hasLockedQuestionOptions() {
  const q = app.ai.pendingQuestion;
  if (!q || typeof q !== "object") return false;
  const options = Array.isArray(q.options) ? q.options.filter((x) => String(x || "").trim()) : [];
  return options.length > 0 && !q.allow_custom;
}

function renderAgentQuestionFrame() {
  if (!dom.agentQuestionFrame || !dom.agentQuestionText || !dom.agentQuestionChoices) return;
  const q = app.ai.pendingQuestion;
  if (!app.ai.connected || !q || typeof q !== "object") {
    dom.agentQuestionFrame.hidden = true;
    dom.agentQuestionText.textContent = "";
    dom.agentQuestionChoices.innerHTML = "";
    return;
  }

  const questionText = String(q.text || "").trim();
  if (!questionText) {
    dom.agentQuestionFrame.hidden = true;
    dom.agentQuestionText.textContent = "";
    dom.agentQuestionChoices.innerHTML = "";
    return;
  }

  const options = Array.isArray(q.options)
    ? q.options.map((x) => String(x || "").trim()).filter(Boolean).slice(0, 6)
    : [];

  dom.agentQuestionFrame.hidden = false;
  dom.agentQuestionText.textContent = questionText;

  if (!options.length) {
    dom.agentQuestionChoices.innerHTML = "<div class=\"agent-question-hint\">Введите ответ в поле ниже и отправьте.</div>";
    return;
  }

  const parts = options.map((option, idx) => {
    return `<button type="button" class="btn-flat agent-question-choice" data-agent-question-choice="${idx}">${esc(option)}</button>`;
  });
  const customCls = q.allow_custom ? " is-selected" : "";
  parts.push(`<button type="button" class="btn-flat agent-question-choice agent-question-custom${customCls}" data-agent-question-custom="1">Предложить свой</button>`);
  dom.agentQuestionChoices.innerHTML = parts.join("");
}

function addAgentLog(role, text, options = {}) {
  const clean = String(text || "").trim();
  if (!clean) return;
  const kind = role === "assistant" ? "AI" : "Вы";
  const removed = addJournalEntry(app.ai.chatJournal, MAX_CHAT_JOURNAL, kind, clean, MAX_CHAT_JOURNAL_TEXT, {
    level: options?.level || "info",
    source: options?.source || "chat",
    turn_id: options?.turn_id || app.ai.turnId || "",
    request_id: options?.request_id || "",
    response_id: options?.response_id || "",
    duration_ms: options?.duration_ms,
    status: options?.status || (role === "assistant" ? "completed" : "done"),
    meta: options?.meta,
  });
  if (removed > 0 && app.ai.chatSummaryCount > 0) {
    app.ai.chatSummaryCount = Math.max(0, app.ai.chatSummaryCount - removed);
  }
  rollupChatSummaryState();
}

function beginAgentStreamingEntry(turnId) {
  const entryId = uid();
  app.ai.streamEntryId = entryId;
  app.ai.streamDeltaHasPending = false;
  app.ai.streamReasoningBuffer = "";
  app.ai.streamReasoningDeltaCount = 0;
  if (app.ai.streamDeltaFlushTimer) {
    win.clearTimeout(app.ai.streamDeltaFlushTimer);
    app.ai.streamDeltaFlushTimer = 0;
  }
  const removed = addJournalEntry(app.ai.chatJournal, MAX_CHAT_JOURNAL, "AI", "Думаю...", MAX_CHAT_JOURNAL_TEXT, {
    id: entryId,
    source: "chat",
    status: "streaming",
    level: "info",
    turn_id: turnId || app.ai.turnId || "",
    allowEmpty: true,
    meta: { stream: true },
  });
  if (removed > 0 && app.ai.chatSummaryCount > 0) {
    app.ai.chatSummaryCount = Math.max(0, app.ai.chatSummaryCount - removed);
  }
  return entryId;
}

function appendAgentStreamingDelta(entryId, delta) {
  const text = String(delta || "");
  if (!text) return;
  app.ai.streamEntryId = entryId || app.ai.streamEntryId || "";
  app.ai.lastStreamBuffer = `${app.ai.lastStreamBuffer || ""}${text}`;
  app.ai.streamDeltaCount = num(app.ai.streamDeltaCount, 0) + 1;
  app.ai.streamDeltaHasPending = true;

  if (app.ai.streamDeltaFlushTimer) return;
  app.ai.streamDeltaFlushTimer = win.setTimeout(() => {
    app.ai.streamDeltaFlushTimer = 0;
    flushAgentStreamingDeltaPatch();
  }, STREAM_DELTA_FLUSH_MS);
}

function appendAgentStreamingReasoningDelta(entryId, delta, options = {}) {
  const replace = Boolean(options?.replace);
  const text = String(delta || "");
  app.ai.streamEntryId = entryId || app.ai.streamEntryId || "";
  if (!text && !replace) return;

  if (replace) {
    app.ai.streamReasoningBuffer = text;
  } else {
    app.ai.streamReasoningBuffer = `${app.ai.streamReasoningBuffer || ""}${text}`;
  }
  app.ai.streamReasoningDeltaCount = num(app.ai.streamReasoningDeltaCount, 0) + 1;
  app.ai.streamDeltaHasPending = true;

  if (app.ai.streamDeltaFlushTimer) return;
  app.ai.streamDeltaFlushTimer = win.setTimeout(() => {
    app.ai.streamDeltaFlushTimer = 0;
    flushAgentStreamingDeltaPatch();
  }, STREAM_DELTA_FLUSH_MS);
}

function finalizeAgentStreamingEntry(entryId, finalText, status = "completed", level = "info", extraMeta = undefined) {
  if (app.ai.streamDeltaFlushTimer) {
    win.clearTimeout(app.ai.streamDeltaFlushTimer);
    app.ai.streamDeltaFlushTimer = 0;
  }
  flushAgentStreamingDeltaPatch();

  if (!entryId) return;
  const text = String(finalText || "").trim() || String(app.ai.lastStreamBuffer || "").trim() || "Готово.";
  const meta = {
    stream: true,
    delta_count: num(app.ai.streamDeltaCount, 0),
    chars: text.length,
    reasoning_delta_count: num(app.ai.streamReasoningDeltaCount, 0),
    reasoning_chars: String(app.ai.streamReasoningBuffer || "").length,
  };
  if (extraMeta && typeof extraMeta === "object") {
    Object.assign(meta, extraMeta);
  }
  patchJournalEntry(app.ai.chatJournal, entryId, { text, status, level, meta }, "chat");
  app.ai.streamEntryId = "";
  app.ai.streamDeltaHasPending = false;
  app.ai.streamReasoningBuffer = "";
  app.ai.streamReasoningDeltaCount = 0;
  rollupChatSummaryState();
}

function clipStreamingPreviewText(textRaw, maxLen = STREAM_TEXT_PREVIEW_LIMIT) {
  const text = String(textRaw || "");
  if (text.length <= maxLen) return text;
  return `[streaming preview: ${text.length} chars]\n...\n${text.slice(-maxLen)}`;
}

function buildStreamingPreviewText(textRaw, reasoningRaw = "") {
  const answerText = clipStreamingPreviewText(textRaw);
  const reasoningText = clipStreamingPreviewText(reasoningRaw, Math.min(8000, STREAM_TEXT_PREVIEW_LIMIT));
  if (!reasoningText) return answerText;
  if (!answerText) return `Размышления ИИ:\n${reasoningText}`;
  return `Размышления ИИ:\n${reasoningText}\n\n-----\nПромежуточный ответ:\n${answerText}`;
}

function flushAgentStreamingDeltaPatch() {
  if (!app.ai.streamDeltaHasPending) return;
  if (!app.ai.streamEntryId) return;

  app.ai.streamDeltaHasPending = false;
  patchJournalEntry(app.ai.chatJournal, app.ai.streamEntryId, {
    text: buildStreamingPreviewText(app.ai.lastStreamBuffer, app.ai.streamReasoningBuffer),
    status: "streaming",
    meta: {
      stream: true,
      delta_count: app.ai.streamDeltaCount,
      chars: String(app.ai.lastStreamBuffer || "").length,
      reasoning_delta_count: app.ai.streamReasoningDeltaCount,
      reasoning_chars: String(app.ai.streamReasoningBuffer || "").length,
      preview: true,
    },
  }, "chat");
}

function nextAgentTurnId() {
  const n = num(String(app.ai.turnCounter || 0), 0) + 1;
  app.ai.turnCounter = n;
  return `turn_${Date.now()}_${n}`;
}

function rollupChatSummaryState() {
  const total = app.ai.chatJournal.length;
  const olderCount = Math.max(0, total - CHAT_CONTEXT_RECENT_MESSAGES);
  if (app.ai.chatSummaryCount > olderCount) app.ai.chatSummaryCount = olderCount;

  while (app.ai.chatSummaryCount + CHAT_SUMMARY_CHUNK_SIZE <= olderCount) {
    const from = app.ai.chatSummaryCount;
    const to = from + CHAT_SUMMARY_CHUNK_SIZE;
    const chunk = app.ai.chatJournal.slice(from, to);
    const chunkSummary = summarizeChatChunk(chunk);
    app.ai.chatSummary = mergeChatSummary(app.ai.chatSummary, chunkSummary);
    app.ai.chatSummaryCount = to;
  }
}

function summarizeChatChunk(chunk) {
  const rows = [];
  for (const item of chunk || []) {
    const role = String(item?.kind || "").trim() === "AI" ? "assistant" : "user";
    const text = String(item?.text || "").replace(/\s+/g, " ").trim();
    if (!text) continue;
    rows.push(`${role}:${text.slice(0, 180)}`);
  }
  return rows.join(" | ");
}

function mergeChatSummary(prev, next) {
  const a = String(prev || "").trim();
  const b = String(next || "").trim();
  if (!b) return a;
  const joined = a ? `${a} || ${b}` : b;
  if (joined.length <= MAX_CHAT_SUMMARY_CHARS) return joined;
  return `...${joined.slice(-(MAX_CHAT_SUMMARY_CHARS - 3))}`;
}

function ensureJournalUiState() {
  if (!app.ai.journalUi || typeof app.ai.journalUi !== "object") app.ai.journalUi = {};
  if (!app.ai.journalUi.expandedTurns || typeof app.ai.journalUi.expandedTurns !== "object") {
    app.ai.journalUi.expandedTurns = {};
  }
  for (const kind of ["chat", "table", "external", "changes"]) {
    if (!app.ai.journalUi.expandedTurns[kind] || typeof app.ai.journalUi.expandedTurns[kind] !== "object") {
      app.ai.journalUi.expandedTurns[kind] = {};
    }
  }
  if (!app.ai.journalUi.expandedTrace || typeof app.ai.journalUi.expandedTrace !== "object") {
    app.ai.journalUi.expandedTrace = {};
  }
  return app.ai.journalUi;
}

function normalizeTurnId(turnId) {
  return String(turnId || "").trim();
}

function turnGroupKey(turnId) {
  return normalizeTurnId(turnId) || "__no_turn__";
}

function turnExpandedStore(kind) {
  const state = ensureJournalUiState();
  if (!state.expandedTurns[kind] || typeof state.expandedTurns[kind] !== "object") {
    state.expandedTurns[kind] = {};
  }
  return state.expandedTurns[kind];
}

function isTurnExpanded(kind, turnId, fallback = false) {
  const store = turnExpandedStore(kind);
  const key = turnGroupKey(turnId);
  if (Object.prototype.hasOwnProperty.call(store, key)) return Boolean(store[key]);
  return Boolean(fallback);
}

function setTurnExpanded(kind, turnId, expanded) {
  const store = turnExpandedStore(kind);
  store[turnGroupKey(turnId)] = Boolean(expanded);
}

function isTraceExpanded(turnId, fallback = false) {
  const state = ensureJournalUiState();
  const key = normalizeTurnId(turnId);
  if (!key) return false;
  if (Object.prototype.hasOwnProperty.call(state.expandedTrace, key)) return Boolean(state.expandedTrace[key]);
  return Boolean(fallback);
}

function setTraceExpanded(turnId, expanded) {
  const state = ensureJournalUiState();
  const key = normalizeTurnId(turnId);
  if (!key) return;
  state.expandedTrace[key] = Boolean(expanded);
}

function renderAgentJournals() {
  renderJournalList("chat");
  renderJournalList("table");
  renderJournalList("external");
  renderJournalList("changes");
}

function requestJournalRender(kind = "all") {
  const normalized = String(kind || "all");
  if (normalized === "all") {
    journalRenderState.kinds.clear();
    journalRenderState.kinds.add("all");
  } else if (!journalRenderState.kinds.has("all")) {
    journalRenderState.kinds.add(normalized);
  }

  if (journalRenderState.timer) return;
  journalRenderState.timer = win.setTimeout(flushJournalRender, JOURNAL_RENDER_DEBOUNCE_MS);
}

function flushJournalRender() {
  if (journalRenderState.timer) {
    win.clearTimeout(journalRenderState.timer);
    journalRenderState.timer = 0;
  }

  const kinds = journalRenderState.kinds.has("all") || !journalRenderState.kinds.size
    ? ["chat", "table", "external", "changes"]
    : Array.from(journalRenderState.kinds);
  journalRenderState.kinds.clear();
  for (const kind of kinds) renderJournalList(kind);
}

function journalConfig(kind) {
  const map = {
    chat: { listEl: dom.chatJournalList, countEl: dom.chatJournalCount, items: app.ai.chatJournal, title: "История чата" },
    table: { listEl: dom.tableJournalList, countEl: dom.tableJournalCount, items: app.ai.tableJournal, title: "Действия ИИ с таблицей" },
    external: { listEl: dom.externalJournalList, countEl: dom.externalJournalCount, items: app.ai.externalJournal, title: "Внешние запросы" },
    changes: { listEl: dom.changesJournalList, countEl: dom.changesJournalCount, items: app.ai.changesJournal, title: "Журнал изменений" },
  };
  return map[kind] || null;
}

function renderJournalList(kind) {
  const cfg = journalConfig(kind);
  if (!cfg) return;
  const { listEl, countEl, items } = cfg;
  if (!listEl || !countEl) return;
  bindJournalListEvents(listEl, kind);

  countEl.textContent = String(items.length);
  if (!items.length) {
    listEl.innerHTML = `<div class="agent-journal-empty">Пока пусто</div>`;
    return;
  }

  const groups = groupJournalEntriesByTurn(items);
  const html = groups.map((group, idx) => renderJournalTurnGroup(kind, group, idx)).join("");
  listEl.innerHTML = html;
}

function bindJournalListEvents(listEl, kind) {
  if (!listEl) return;
  if (String(listEl.dataset.journalTurnsBound || "") === "1") return;
  listEl.addEventListener("toggle", (event) => {
    const details = event?.target;
    if (!details || String(details.tagName || "").toUpperCase() !== "DETAILS") return;

    if (details.classList.contains("journal-turn-group")) {
      setTurnExpanded(kind, details.dataset.turnId || "", details.open);
      return;
    }

    if (details.classList.contains("journal-turn-trace")) {
      setTraceExpanded(details.dataset.turnId || "", details.open);
    }
  }, true);
  listEl.dataset.journalTurnsBound = "1";
}

function groupJournalEntriesByTurn(itemsRaw) {
  const groups = [];
  const byKey = new Map();
  for (const raw of itemsRaw || []) {
    const it = normalizeJournalEntry(raw);
    const key = turnGroupKey(it.turn_id);
    let group = byKey.get(key);
    if (!group) {
      group = {
        key,
        turn_id: normalizeTurnId(it.turn_id),
        first_ts: it.ts,
        last_ts: it.ts,
        items: [],
      };
      byKey.set(key, group);
      groups.push(group);
    }
    group.items.push(it);
    group.first_ts = Math.min(group.first_ts, it.ts);
    group.last_ts = Math.max(group.last_ts, it.ts);
  }
  groups.sort((a, b) => b.last_ts - a.last_ts);
  return groups;
}

function renderJournalTurnGroup(kind, group, indexInList) {
  const turnId = normalizeTurnId(group.turn_id);
  const open = isTurnExpanded(kind, turnId, indexInList === 0);
  const status = summarizeTurnStatus(group.items);
  const statusBadge = renderJournalStatusBadge(status);
  const label = turnId ? `Задача ${turnId}` : "Без привязки к задаче";
  const prompt = kind === "chat" ? extractTurnPromptSnippet(turnId) : "";
  const timeFrom = journalTime(group.first_ts);
  const timeTo = journalTime(group.last_ts);
  const timeInfo = timeFrom === timeTo ? timeFrom : `${timeFrom} - ${timeTo}`;
  const trace = kind === "chat" ? renderTurnTraceBlock(turnId) : "";
  const rows = group.items.slice().reverse().map((it) => renderJournalItemRow(it)).join("");

  return `<details class="journal-turn-group" data-journal-kind="${esc(kind)}" data-turn-id="${esc(turnId)}" ${open ? "open" : ""}>
    <summary class="journal-turn-summary">
      <span class="journal-turn-summary-main">${statusBadge}${esc(label)}</span>
      <span class="journal-turn-summary-meta">${esc(`записей: ${group.items.length} | ${timeInfo}`)}</span>
    </summary>
    ${prompt ? `<div class="journal-turn-prompt">${esc(prompt)}</div>` : ""}
    ${trace}
    <div class="journal-turn-items">${rows}</div>
  </details>`;
}

function summarizeTurnStatus(items) {
  let hasError = false;
  let hasRunning = false;
  let hasDone = false;
  for (const itRaw of items || []) {
    const it = normalizeJournalEntry(itRaw);
    const code = String(it.status || "").toLowerCase();
    if (code === "error" || code === "failed") hasError = true;
    else if (code === "running" || code === "streaming" || code === "start") hasRunning = true;
    else if (code === "completed" || code === "done" || code === "ok") hasDone = true;
  }
  if (hasError) return "error";
  if (hasRunning) return "running";
  if (hasDone) return "completed";
  return "";
}

function extractTurnPromptSnippet(turnId) {
  const id = normalizeTurnId(turnId);
  if (!id) return "";
  const row = app.ai.chatJournal
    .map((raw) => normalizeJournalEntry(raw))
    .find((it) => it.turn_id === id && it.kind === "Вы");
  if (!row) return "";
  const text = String(row.text || "").replace(/\s+/g, " ").trim();
  if (!text) return "";
  if (text.length > 240) return `${text.slice(0, 237)}...`;
  return text;
}

function renderTurnTraceBlock(turnId) {
  const id = normalizeTurnId(turnId);
  if (!id) return "";
  const table = app.ai.tableJournal.map((raw) => normalizeJournalEntry(raw)).filter((it) => it.turn_id === id);
  const external = app.ai.externalJournal.map((raw) => normalizeJournalEntry(raw)).filter((it) => it.turn_id === id);
  const changes = app.ai.changesJournal.map((raw) => normalizeJournalEntry(raw)).filter((it) => it.turn_id === id);
  const total = table.length + external.length + changes.length;
  if (!total) return "";

  const summaryParts = [];
  if (table.length) summaryParts.push(`table:${table.length}`);
  if (external.length) summaryParts.push(`external:${external.length}`);
  if (changes.length) summaryParts.push(`changes:${changes.length}`);

  const open = isTraceExpanded(id, false);
  const sections = [
    renderTurnTraceSection("Действия ИИ с таблицей", table),
    renderTurnTraceSection("Внешние запросы", external),
    renderTurnTraceSection("Журнал изменений", changes),
  ].filter(Boolean).join("");

  return `<details class="journal-turn-trace" data-turn-id="${esc(id)}" ${open ? "open" : ""}>
    <summary>${esc(`Размышления и путь выполнения (${summaryParts.join(" | ")})`)}</summary>
    ${sections}
  </details>`;
}

function renderTurnTraceSection(title, items) {
  if (!Array.isArray(items) || !items.length) return "";
  const rows = items
    .slice()
    .reverse()
    .map((it) => {
      const text = compactJournalTraceText(it);
      return `<div class="journal-turn-trace-item">
        <span class="time">${esc(journalTime(it.ts))}</span>
        <span class="kind">${esc(it.kind)}</span>
        <span class="text">${esc(text)}</span>
      </div>`;
    })
    .join("");
  return `<div class="journal-turn-trace-section">
    <div class="journal-turn-trace-title">${esc(`${title}: ${items.length}`)}</div>
    ${rows}
  </div>`;
}

function compactJournalTraceText(itRaw) {
  const it = normalizeJournalEntry(itRaw);
  const text = String(it.text || "").replace(/\s+/g, " ").trim();
  if (!text) return it.kind || "event";
  const isToolIo = it.kind === "tool.call" || it.kind === "tool.result";
  const maxLen = isToolIo ? 340 : 180;
  if (text.length > maxLen) return `${text.slice(0, maxLen - 3)}...`;
  return text;
}

function renderJournalItemRow(itRaw) {
  const it = normalizeJournalEntry(itRaw);
  const level = esc(String(it.level || "info"));
  const status = renderJournalStatusBadge(it.status);
  const aux = renderJournalAuxInfo(it);
  const reasoning = renderJournalReasoningBlock(it.meta);
  const meta = renderJournalMetaBlock(it.meta);
  return `<div class="agent-journal-item level-${level}">
    <span class="time">${esc(journalTime(it.ts))}</span>
    <span class="kind">${esc(it.kind)}</span>
    <span class="text">${status}${aux}${renderJournalTextHtml(it.text, { status: it.status })}${reasoning}${meta}</span>
  </div>`;
}

function renderJournalTextHtml(textRaw, options = {}) {
  const status = String(options?.status || "").toLowerCase();
  if (status === "streaming") {
    const text = String(textRaw || "");
    return `<span class="journal-text-frag">${esc(text).replace(/\n/g, "<br/>")}</span>`;
  }

  const chunks = splitTextAndJsonChunks(String(textRaw || ""));
  const parts = [];
  let jsonIdx = 1;

  for (const chunk of chunks) {
    if (chunk.type === "json") {
      const pretty = JSON.stringify(chunk.value, null, 2);
      const label = classifyJournalJsonChunk(chunk.value, jsonIdx);
      parts.push(`<details class="journal-json-block"><summary>${esc(label)}</summary><pre>${esc(pretty)}</pre></details>`);
      jsonIdx += 1;
      continue;
    }

    const text = String(chunk.text || "");
    if (!text) continue;
    parts.push(`<span class="journal-text-frag">${renderMarkdownLite(text)}</span>`);
  }

  return parts.join("");
}

function renderJournalStatusBadge(statusRaw) {
  const status = String(statusRaw || "").trim();
  if (!status) return "";
  const code = status.toLowerCase();
  let cls = "state-running";
  if (code === "completed" || code === "done" || code === "ok") cls = "state-done";
  if (code === "error" || code === "failed") cls = "state-error";
  const labelMap = {
    running: "Выполняет",
    streaming: "Думает",
    completed: "Готово",
    done: "Готово",
    ok: "Готово",
    error: "Ошибка",
    failed: "Ошибка",
    start: "Старт",
  };
  const label = labelMap[code] || status;
  return `<span class="journal-status-badge ${cls}">${esc(label)}</span>`;
}

function renderJournalAuxInfo(it) {
  const parts = [];
  if (it.source) parts.push(`src=${it.source}`);
  if (it.turn_id) parts.push(`turn=${it.turn_id}`);
  if (it.request_id) parts.push(`req=${it.request_id}`);
  if (it.response_id) parts.push(`resp=${it.response_id}`);
  if (Number.isFinite(it.duration_ms)) parts.push(`${Math.max(0, Math.round(it.duration_ms))}ms`);
  if (!parts.length) return "";
  return `<div class="journal-aux">${esc(parts.join(" | "))}</div>`;
}

function normalizeJournalReasoningHistory(metaRaw) {
  const src = metaRaw && typeof metaRaw === "object" ? metaRaw.reasoning_history : null;
  if (!Array.isArray(src) || !src.length) return [];
  const out = [];
  for (const rowRaw of src) {
    const row = rowRaw && typeof rowRaw === "object" ? rowRaw : {};
    const summary = String(row.summary || "").trim();
    const assistant = String(row.assistant_text || "").trim();
    if (!summary && !assistant) continue;
    out.push({
      seq: Math.max(1, num(row.seq, out.length + 1)),
      request_id: String(row.request_id || "").trim(),
      response_id: String(row.response_id || "").trim(),
      summary: summary.slice(0, 4000),
      assistant_text: assistant.slice(0, 1400),
    });
  }
  out.sort((a, b) => a.seq - b.seq);
  return out;
}

function renderJournalReasoningBlock(metaRaw) {
  const items = normalizeJournalReasoningHistory(metaRaw);
  if (!items.length) return "";
  const sections = items.map((item) => {
    const lines = [];
    lines.push(`Запрос #${item.seq}`);
    const refs = [];
    if (item.request_id) refs.push(`req=${item.request_id}`);
    if (item.response_id) refs.push(`resp=${item.response_id}`);
    if (refs.length) lines.push(refs.join(" | "));
    if (item.summary) lines.push(`Summary:\n${item.summary}`);
    if (item.assistant_text) lines.push(`Промежуточный ответ:\n${item.assistant_text}`);
    return lines.join("\n");
  });
  const body = sections.join("\n\n-----\n\n");
  return `<details class="journal-reasoning-block"><summary>${esc(`История размышлений: ${items.length}`)}</summary><pre>${esc(body)}</pre></details>`;
}

function renderJournalMetaBlock(meta) {
  if (meta === undefined || meta === null) return "";
  let pretty = "";
  try {
    pretty = JSON.stringify(meta, null, 2);
  } catch {
    pretty = String(meta);
  }
  if (!pretty.trim()) return "";
  return `<details class="journal-meta-block"><summary>Meta</summary><pre>${esc(pretty)}</pre></details>`;
}

function classifyJournalJsonChunk(value, idx) {
  if (value && typeof value === "object") {
    const name = String(value.name || value.id || "").toLowerCase();
    if (name.startsWith("functions.") || value.args || value.arguments || value.call_id) return "Tool call";
    if (value.ok !== undefined || value.error !== undefined || value.applied !== undefined || value.result !== undefined) return "Tool result";
  }
  return `JSON ${idx}`;
}

function renderMarkdownLite(textRaw) {
  const text = String(textRaw || "").trim();
  if (!text) return "";
  const blocks = text.split(/\n{2,}/);
  const html = [];

  for (const block of blocks) {
    const lines = block.split("\n").map((x) => x.trimEnd());
    if (!lines.length) continue;

    if (lines.every((line) => /^\s*[-*]\s+/.test(line))) {
      const li = lines
        .map((line) => line.replace(/^\s*[-*]\s+/, ""))
        .map((line) => `<li>${renderInlineMarkdown(line)}</li>`)
        .join("");
      html.push(`<ul class="journal-list">${li}</ul>`);
      continue;
    }

    if (lines.every((line) => /^\s*\d+\.\s+/.test(line))) {
      const li = lines
        .map((line) => line.replace(/^\s*\d+\.\s+/, ""))
        .map((line) => `<li>${renderInlineMarkdown(line)}</li>`)
        .join("");
      html.push(`<ol class="journal-list">${li}</ol>`);
      continue;
    }

    const header = lines[0].match(/^\s{0,3}#{1,3}\s+(.*)$/);
    if (header) {
      const body = lines.slice(1).join("\n").trim();
      html.push(`<div class="journal-md-head">${renderInlineMarkdown(header[1])}</div>`);
      if (body) html.push(`<p class="journal-md-par">${renderInlineMarkdown(body).replace(/\n/g, "<br/>")}</p>`);
      continue;
    }

    html.push(`<p class="journal-md-par">${renderInlineMarkdown(lines.join("\n")).replace(/\n/g, "<br/>")}</p>`);
  }

  return html.join("");
}

function renderInlineMarkdown(textRaw) {
  const src = String(textRaw || "");
  if (!src) return "";
  const chunks = src.split(/(`[^`]+`)/g);
  return chunks
    .map((chunk) => {
      if (!chunk) return "";
      if (chunk.startsWith("`") && chunk.endsWith("`") && chunk.length >= 2) {
        return `<code>${esc(chunk.slice(1, -1))}</code>`;
      }
      return esc(chunk);
    })
    .join("");
}

function splitTextAndJsonChunks(text) {
  const src = String(text || "");
  if (!src) return [{ type: "text", text: "" }];
  if (!src.includes("{") && !src.includes("[")) return [{ type: "text", text: src }];
  if (src.length > 40000) return [{ type: "text", text: src }];

  const out = [];
  let i = 0;
  let last = 0;
  while (i < src.length) {
    const ch = src[i];
    if (ch !== "{" && ch !== "[") {
      i += 1;
      continue;
    }

    const end = findBalancedJsonEnd(src, i);
    if (end < 0) {
      i += 1;
      continue;
    }

    const candidate = src.slice(i, end + 1);
    let parsed = null;
    try {
      parsed = JSON.parse(candidate);
    } catch {
      i += 1;
      continue;
    }

    if (i > last) out.push({ type: "text", text: src.slice(last, i) });
    out.push({ type: "json", value: parsed });
    i = end + 1;
    last = i;
  }

  if (last < src.length) out.push({ type: "text", text: src.slice(last) });
  if (!out.length) return [{ type: "text", text: src }];
  return out;
}

function findBalancedJsonEnd(text, startIdx) {
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = startIdx; i < text.length; i += 1) {
    const ch = text[i];

    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === "\\") {
        escaped = true;
        continue;
      }
      if (ch === "\"") {
        inString = false;
      }
      continue;
    }

    if (ch === "\"") {
      inString = true;
      continue;
    }
    if (ch === "{" || ch === "[") {
      depth += 1;
      continue;
    }
    if (ch === "}" || ch === "]") {
      depth -= 1;
      if (depth === 0) return i;
      if (depth < 0) return -1;
    }
  }

  return -1;
}

function journalDateTime(ts) {
  const d = new Date(num(ts, Date.now()));
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  const s = String(d.getSeconds()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${h}:${m}:${s}`;
}

function formatJournalForCopy(kind) {
  const cfg = journalConfig(kind);
  if (!cfg) return "";
  const title = cfg.title || kind;
  const items = Array.isArray(cfg.items) ? cfg.items : [];
  const lines = [];
  lines.push(`# ${title}`);
  lines.push(`Количество записей: ${items.length}`);
  lines.push("");
  for (const raw of items) {
    const it = normalizeJournalEntry(raw);
    const ts = journalDateTime(it.ts);
    const main = [`[${ts}]`, it.kind].filter(Boolean).join(" ");
    lines.push(`${main}: ${formatJournalTextForCopy(it.text)}`);
    const metaLine = [
      it.level ? `level=${it.level}` : "",
      it.source ? `source=${it.source}` : "",
      it.status ? `status=${it.status}` : "",
      it.turn_id ? `turn=${it.turn_id}` : "",
      it.request_id ? `request=${it.request_id}` : "",
      it.response_id ? `response=${it.response_id}` : "",
      Number.isFinite(it.duration_ms) ? `duration_ms=${Math.round(it.duration_ms)}` : "",
    ].filter(Boolean).join(", ");
    if (metaLine) lines.push(`  ${metaLine}`);
    if (it.meta !== undefined) {
      lines.push("  meta:");
      try {
        lines.push(JSON.stringify(it.meta, null, 2).split("\n").map((line) => `    ${line}`).join("\n"));
      } catch {
        lines.push(`    ${String(it.meta)}`);
      }
    }
  }
  return lines.join("\n");
}

function formatJournalTextForCopy(textRaw) {
  const chunks = splitTextAndJsonChunks(String(textRaw || ""));
  const out = [];
  let idx = 1;
  for (const chunk of chunks) {
    if (chunk.type === "json") {
      out.push(`\n[JSON ${idx}]\n${JSON.stringify(chunk.value, null, 2)}\n`);
      idx += 1;
      continue;
    }
    out.push(String(chunk.text || ""));
  }
  return out.join("").replace(/\n{3,}/g, "\n\n").trim();
}

function copyTextLegacy(text) {
  if (!win.document || typeof win.document.execCommand !== "function") {
    throw new Error("copy legacy API unavailable");
  }
  const ta = win.document.createElement("textarea");
  ta.value = String(text ?? "");
  ta.style.position = "fixed";
  ta.style.left = "-9999px";
  win.document.body.appendChild(ta);
  ta.focus();
  ta.select();
  ta.setSelectionRange(0, ta.value.length);
  let copied = false;
  try {
    copied = Boolean(win.document.execCommand("copy"));
  } finally {
    win.document.body.removeChild(ta);
  }
  if (!copied) throw new Error("copy legacy API failed");
}

async function copyText(text) {
  const value = String(text ?? "");
  try {
    copyTextLegacy(value);
    return;
  } catch {}
  if (win.navigator?.clipboard?.writeText) {
    await win.navigator.clipboard.writeText(value);
    return;
  }
  throw new Error("copy API unavailable");
}

async function copyJournal(kind) {
  const cfg = journalConfig(kind);
  if (!cfg) return;
  const items = Array.isArray(cfg.items) ? cfg.items : [];
  if (!items.length) {
    toast("Журнал пуст");
    return;
  }
  const text = formatJournalForCopy(kind);
  try {
    await copyText(text);
    addChangesJournal("journal.copy", String(kind));
    toast("Журнал скопирован");
  } catch {
    toast("Не удалось скопировать журнал");
  }
}

function formatAllJournalsForCopy() {
  return ["chat", "table", "external", "changes"]
    .map((kind) => formatJournalForCopy(kind))
    .join("\n\n");
}

async function copyAllJournals() {
  const kinds = ["chat", "table", "external", "changes"];
  const total = kinds.reduce((acc, kind) => {
    const items = journalConfig(kind)?.items;
    return acc + (Array.isArray(items) ? items.length : 0);
  }, 0);
  if (!total) {
    toast("Все журналы пусты");
    return;
  }
  const text = formatAllJournalsForCopy();
  try {
    await copyText(text);
    addChangesJournal("journal.copy", "all", { meta: { total } });
    toast("Все журналы скопированы");
  } catch {
    toast("Не удалось скопировать все журналы");
  }
}

function addTableJournal(kind, text, options = {}) {
  addJournalEntry(app.ai.tableJournal, MAX_TABLE_JOURNAL, kind, text, MAX_COMMON_JOURNAL_TEXT, {
    source: options?.source || "table",
    level: options?.level || "info",
    turn_id: options?.turn_id || app.ai.turnId || "",
    request_id: options?.request_id || "",
    response_id: options?.response_id || "",
    duration_ms: options?.duration_ms,
    status: options?.status || "",
    meta: options?.meta,
  });
}

function addExternalJournal(kind, text, options = {}) {
  addJournalEntry(app.ai.externalJournal, MAX_EXTERNAL_JOURNAL, kind, text, MAX_COMMON_JOURNAL_TEXT, {
    source: options?.source || "openai",
    level: options?.level || "info",
    turn_id: options?.turn_id || app.ai.turnId || "",
    request_id: options?.request_id || "",
    response_id: options?.response_id || "",
    duration_ms: options?.duration_ms,
    status: options?.status || "",
    meta: options?.meta,
  });
}

function addChangesJournal(kind, text, options = {}) {
  addJournalEntry(app.ai.changesJournal, MAX_CHANGES_JOURNAL, kind, text, MAX_COMMON_JOURNAL_TEXT, {
    source: options?.source || "ui",
    level: options?.level || "info",
    turn_id: options?.turn_id || app.ai.turnId || "",
    request_id: options?.request_id || "",
    response_id: options?.response_id || "",
    duration_ms: options?.duration_ms,
    status: options?.status || "",
    meta: options?.meta,
  });
}

function addJournalEntry(target, limit, kind, text, maxTextLen = MAX_COMMON_JOURNAL_TEXT) {
  const options = arguments.length > 5 ? arguments[5] : {};
  const rawText = String(text || "").trim();
  const clipped = maxTextLen > 0 ? rawText.slice(0, maxTextLen) : rawText;
  if (!clipped && !options?.allowEmpty) return 0;

  const entry = normalizeJournalEntry({
    id: String(options?.id || uid()),
    ts: Number.isFinite(options?.ts) ? options.ts : Date.now(),
    kind: String(kind || "event").slice(0, 60),
    text: clipped || "",
    level: String(options?.level || "info"),
    source: String(options?.source || ""),
    turn_id: String(options?.turn_id || ""),
    request_id: String(options?.request_id || ""),
    response_id: String(options?.response_id || ""),
    duration_ms: Number.isFinite(options?.duration_ms) ? num(options.duration_ms, 0) : undefined,
    status: String(options?.status || ""),
    meta: options?.meta,
  });

  target.push(entry);
  let removed = 0;
  if (target.length > limit) {
    removed = target.length - limit;
    target.splice(0, removed);
  }
  requestJournalRender(journalKindForTarget(target));
  return removed;
}

function journalTime(ts) {
  const d = new Date(num(ts, Date.now()));
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  const s = String(d.getSeconds()).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

function normalizeJournalEntry(raw) {
  const src = raw && typeof raw === "object" ? raw : {};
  return {
    id: String(src.id || uid()),
    ts: num(src.ts, Date.now()),
    kind: String(src.kind || "event").slice(0, 60),
    text: String(src.text || ""),
    level: String(src.level || "info"),
    source: String(src.source || ""),
    turn_id: String(src.turn_id || ""),
    request_id: String(src.request_id || ""),
    response_id: String(src.response_id || ""),
    duration_ms: src.duration_ms === undefined ? undefined : num(src.duration_ms, 0),
    status: String(src.status || ""),
    meta: src.meta,
  };
}

function journalKindForTarget(target) {
  if (target === app.ai.chatJournal) return "chat";
  if (target === app.ai.tableJournal) return "table";
  if (target === app.ai.externalJournal) return "external";
  if (target === app.ai.changesJournal) return "changes";
  return "all";
}

function findJournalEntry(list, id) {
  if (!Array.isArray(list) || !id) return null;
  const idx = list.findIndex((it) => String(it?.id || "") === String(id));
  if (idx < 0) return null;
  return { idx, item: list[idx] };
}

function patchJournalEntry(list, id, patch, kindHint = "") {
  const found = findJournalEntry(list, id);
  if (!found) return false;
  const next = { ...found.item, ...patch };
  list[found.idx] = normalizeJournalEntry(next);
  requestJournalRender(kindHint || journalKindForTarget(list));
  return true;
}

function renderSidebarMode() {
  const isTree = app.ui.sidebarTab !== "journals";
  if (dom.btnSidebarTabTree) {
    dom.btnSidebarTabTree.classList.toggle("active", isTree);
    dom.btnSidebarTabTree.setAttribute("aria-selected", isTree ? "true" : "false");
  }
  if (dom.btnSidebarTabJournals) {
    dom.btnSidebarTabJournals.classList.toggle("active", !isTree);
    dom.btnSidebarTabJournals.setAttribute("aria-selected", !isTree ? "true" : "false");
  }
  if (dom.sidebarPanelTree) dom.sidebarPanelTree.hidden = !isTree;
  if (dom.sidebarPanelJournals) dom.sidebarPanelJournals.hidden = isTree;
}

function renderJournalViewMode() {
  const active = app.ui.journalView || "table";
  for (const btn of dom.journalTabs || []) {
    const k = String(btn.dataset.journalView || "");
    btn.classList.toggle("active", k === active);
    btn.setAttribute("aria-selected", k === active ? "true" : "false");
  }
  for (const pane of dom.journalPanes || []) {
    const k = String(pane.dataset.journalPane || "");
    pane.hidden = k !== active;
    pane.classList.toggle("active", k === active);
  }
}

function isKnownAiModel(modelId) {
  const id = String(modelId || "").trim();
  return AI_MODELS.some((m) => m.id === id);
}

function currentAiModelMeta() {
  const id = isKnownAiModel(app.ai.model) ? app.ai.model : DEFAULT_AI_MODEL;
  return AI_MODELS.find((m) => m.id === id) || AI_MODELS[0];
}

function modelSupportsServiceTier(model, tier) {
  const tiers = Array.isArray(model?.tiers) ? model.tiers : ["standard"];
  return tiers.includes(tier);
}

function preferredServiceTierForModel(model, preferred = "standard") {
  const tier = normalizeServiceTier(preferred, "standard");
  if (modelSupportsServiceTier(model, tier)) return tier;
  if (modelSupportsServiceTier(model, "standard")) return "standard";
  const tiers = Array.isArray(model?.tiers) ? model.tiers : [];
  if (!tiers.length) return "standard";
  return normalizeServiceTier(tiers[0], "standard");
}

function modelPriceByTier(model, tier) {
  const t = normalizeServiceTier(tier, "standard");
  const pricing = model?.pricing && typeof model.pricing === "object" ? model.pricing : {};
  const exact = pricing[t];
  if (exact && Number.isFinite(Number(exact.inputUsdPer1M)) && Number.isFinite(Number(exact.outputUsdPer1M))) {
    return exact;
  }
  const standard = pricing.standard;
  if (standard && Number.isFinite(Number(standard.inputUsdPer1M)) && Number.isFinite(Number(standard.outputUsdPer1M))) {
    return standard;
  }
  return {
    inputUsdPer1M: num(model?.inputUsdPer1M, 0),
    outputUsdPer1M: num(model?.outputUsdPer1M, 0),
  };
}

function modelSelectValue(modelId, tier) {
  const id = String(modelId || "").trim();
  const t = normalizeServiceTier(tier, "standard");
  return `${id}::${t}`;
}

function parseModelSelectValue(raw) {
  const src = String(raw || "").trim();
  if (!src) return { modelId: "", tier: "standard" };
  const idx = src.indexOf("::");
  if (idx < 0) return { modelId: src, tier: "standard" };
  return {
    modelId: src.slice(0, idx),
    tier: normalizeServiceTier(src.slice(idx + 2), "standard"),
  };
}

function renderOpenAiModelOptions() {
  if (!dom.openAiModelSelect) return;
  const selectedModelId = isKnownAiModel(app.ai.model) ? app.ai.model : DEFAULT_AI_MODEL;
  const selectedTier = normalizeServiceTier(app?.ai?.options?.serviceTier, "standard");
  const groups = [
    { key: "flex", label: "FLEX" },
    { key: "standard", label: "STANDARD" },
    { key: "priority", label: "PRIORITY" },
  ];
  dom.openAiModelSelect.innerHTML = groups
    .map((group) => {
      const items = AI_MODELS.filter((m) => modelSupportsServiceTier(m, group.key));
      if (!items.length) return "";
      const options = items
        .map((m) => {
          const price = modelPriceByTier(m, group.key);
          return `<option value="${esc(modelSelectValue(m.id, group.key))}" data-model-id="${esc(m.id)}" data-service-tier="${esc(group.key)}">${esc(m.label)} (${moneyUsd(price.inputUsdPer1M)} вход / ${moneyUsd(price.outputUsdPer1M)} выход за 1M)</option>`;
        })
        .join("");
      return `<optgroup label="${esc(group.label)}">${options}</optgroup>`;
    })
    .join("");

  const selectedModel = AI_MODELS.find((m) => m.id === selectedModelId) || AI_MODELS[0];
  const finalTier = preferredServiceTierForModel(selectedModel, selectedTier);
  let selectedValue = modelSelectValue(selectedModelId, finalTier);
  if (!Array.from(dom.openAiModelSelect.options || []).some((o) => String(o.value || "") === selectedValue)) {
    selectedValue = modelSelectValue(selectedModelId, "standard");
  }
  if (!Array.from(dom.openAiModelSelect.options || []).some((o) => String(o.value || "") === selectedValue)) {
    const first = dom.openAiModelSelect.options[0];
    selectedValue = String(first?.value || "");
  }
  dom.openAiModelSelect.value = selectedValue;
  renderOpenAiModelPrice();
}

function renderOpenAiModelPrice() {
  if (!dom.openAiModelPrice || !dom.openAiModelSelect) return;
  const parsed = parseModelSelectValue(dom.openAiModelSelect.value);
  const selectedOption = dom.openAiModelSelect.selectedOptions?.[0] || null;
  const modelId = String(selectedOption?.dataset?.modelId || parsed.modelId || "").trim();
  const tier = normalizeServiceTier(selectedOption?.dataset?.serviceTier || parsed.tier || app?.ai?.options?.serviceTier, "standard");
  const model = AI_MODELS.find((m) => m.id === modelId) || currentAiModelMeta();
  const price = modelPriceByTier(model, tier);
  dom.openAiModelPrice.textContent = `${model.label} [${serviceTierLabel(tier)}]: вход ${moneyUsd(price.inputUsdPer1M)} / выход ${moneyUsd(price.outputUsdPer1M)} за 1M токенов. ${WEB_SEARCH_PRICE_NOTE}`;
}

function moneyUsd(v) {
  return `$${num(v).toFixed(2).replace(/\.00$/, "")}`;
}

  return {
    loadAiSettings,
    saveAiOptions,
    saveAiCollapsed,
    saveOpenAiApiKey,
    saveOpenAiModel,
    clampSidebarWidth,
    saveSidebarWidth,
    applySidebarWidth,
    renderAiUi,
    renderAgentChips,
    renderAgentContextIcons,
    addAgentLog,
    beginAgentStreamingEntry,
    appendAgentStreamingDelta,
    appendAgentStreamingReasoningDelta,
    finalizeAgentStreamingEntry,
    buildStreamingPreviewText,
    flushAgentStreamingDeltaPatch,
    nextAgentTurnId,
    rollupChatSummaryState,
    summarizeChatChunk,
    mergeChatSummary,
    renderAgentJournals,
    requestJournalRender,
    flushJournalRender,
    journalConfig,
    renderJournalList,
    renderJournalTextHtml,
    renderJournalStatusBadge,
    renderJournalAuxInfo,
    renderJournalMetaBlock,
    classifyJournalJsonChunk,
    renderMarkdownLite,
    renderInlineMarkdown,
    splitTextAndJsonChunks,
    findBalancedJsonEnd,
    journalDateTime,
    formatJournalForCopy,
    formatJournalTextForCopy,
    formatAllJournalsForCopy,
    copyJournal,
    copyAllJournals,
    addTableJournal,
    addExternalJournal,
    addChangesJournal,
    addJournalEntry,
    journalTime,
    normalizeJournalEntry,
    journalKindForTarget,
    findJournalEntry,
    patchJournalEntry,
    renderSidebarMode,
    renderJournalViewMode,
    isKnownAiModel,
    currentAiModelMeta,
    renderOpenAiModelOptions,
    renderOpenAiModelPrice,
    moneyUsd,
  };
}



