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
  const journalRenderState = {
    timer: 0,
    kinds: new Set(),
  };
  const REASONING_EFFORT_ORDER = ["low", "medium", "high"];
  const WEB_SEARCH_CONTEXT_SIZE_ORDER = ["low", "medium", "high"];
  const REASONING_EFFORT_LABELS = {
    low: "Низкий",
    medium: "Средний",
    high: "Высокий",
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
  if (effort === "low") return "L";
  if (effort === "high") return "H";
  return "M";
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
  if (size === "low") return "low";
  if (size === "medium") return "medium";
  return "max";
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
      for (const k of ["webSearch", "reasoning", "allowQuestions"]) {
        if (typeof parsed[k] === "boolean") app.ai.options[k] = parsed[k];
      }
      app.ai.options.reasoningEffort = normalizeReasoningEffort(parsed.reasoningEffort, app.ai.options.reasoningEffort || "medium");
      app.ai.options.webSearchCountry = normalizeWebSearchCountry(parsed.webSearchCountry, app.ai.options.webSearchCountry || "RU");
      app.ai.options.webSearchContextSize = normalizeWebSearchContextSize(parsed.webSearchContextSize, app.ai.options.webSearchContextSize || "high");
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
  if (dom.btnAgentSend) dom.btnAgentSend.disabled = !app.ai.connected || app.ai.sending || hasLockedQuestion;
  if (dom.agentPrompt) dom.agentPrompt.disabled = !app.ai.connected || app.ai.sending || hasLockedQuestion;

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
    const wrapCls = app.ai.webSearchPopoverOpen
      ? "agent-tool-chip-wrap agent-web-search-wrap is-open"
      : "agent-tool-chip-wrap agent-web-search-wrap";
    const chipCls = app.ai.webSearchPopoverOpen
      ? "agent-chip agent-tool-chip is-selected"
      : "agent-chip agent-tool-chip";
    parts.push(`<div class="${wrapCls}" data-web-search-wrap>
      <button type="button" class="${chipCls}" data-ai-chip-option="webSearchSettings" title="Web search settings" aria-label="Web search settings">
        <b>webSearch</b>
        <span>Web search</span>
        ${gearIcon}
      </button>
      <div class="agent-web-search-popover" data-web-search-popover role="dialog" aria-label="Web search settings">
        <div class="agent-web-search-head">
          <strong>Web Search</strong>
          <button type="button" class="agent-web-search-close" data-web-search-action="close" aria-label="Close settings">x</button>
        </div>
        <label class="agent-web-search-row">
          <span>Country</span>
          <select data-web-search-config="country">
            <option value="RU"${selectedAttr(country, "RU")}>Russia (RU)</option>
            <option value="US"${selectedAttr(country, "US")}>United States (US)</option>
            <option value="DE"${selectedAttr(country, "DE")}>Germany (DE)</option>
            <option value="GB"${selectedAttr(country, "GB")}>United Kingdom (GB)</option>
            <option value="FR"${selectedAttr(country, "FR")}>France (FR)</option>
          </select>
        </label>
        <label class="agent-web-search-row">
          <span>Context</span>
          <select data-web-search-config="contextSize">
            <option value="high"${selectedAttr(contextSize, "high")}>max</option>
            <option value="medium"${selectedAttr(contextSize, "medium")}>medium</option>
            <option value="low"${selectedAttr(contextSize, "low")}>low</option>
          </select>
        </label>
        <div class="agent-web-search-summary" data-web-search-config="summary">enabled=on, country=${esc(country)}, search_context_size=${esc(contextSizeLabel)}</div>
      </div>
    </div>`);
  }

  if (app.ai.options.allowQuestions) {
    parts.push('<span class="agent-chip"><b>allowQuestions</b><span>AI questions</span></span>');
  }

  if (app.ai.options.reasoning !== false) {
    const effort = normalizeReasoningEffort(app.ai.options.reasoningEffort, "medium");
    const wrapCls = app.ai.reasoningPopoverOpen
      ? "agent-tool-chip-wrap agent-reasoning-wrap is-open"
      : "agent-tool-chip-wrap agent-reasoning-wrap";
    const chipCls = app.ai.reasoningPopoverOpen
      ? "agent-chip agent-tool-chip is-selected"
      : "agent-chip agent-tool-chip";
    parts.push(`<div class="${wrapCls}" data-reasoning-wrap>
      <button type="button" class="${chipCls}" data-ai-chip-option="reasoningSettings" title="Reasoning settings" aria-label="Reasoning settings">
        <b>reasoning</b>
        <span>${esc(reasoningEffortLabel(effort))}</span>
        ${gearIcon}
      </button>
      <div class="agent-reasoning-popover" data-reasoning-popover role="dialog" aria-label="Reasoning settings">
        <div class="agent-web-search-head">
          <strong>Reasoning</strong>
          <button type="button" class="agent-web-search-close" data-reasoning-action="close" aria-label="Close settings">x</button>
        </div>
        <label class="agent-web-search-row">
          <span>Effort</span>
          <select data-reasoning-config="effort">
            <option value="low"${selectedAttr(effort, "low")}>low</option>
            <option value="medium"${selectedAttr(effort, "medium")}>medium</option>
            <option value="high"${selectedAttr(effort, "high")}>high</option>
          </select>
        </label>
        <div class="agent-web-search-summary" data-reasoning-config="summary">enabled=on, effort=${esc(effort)}</div>
      </div>
    </div>`);
  }

  for (const f of app.ai.attachments) {
    const kb = Math.max(1, Math.round(num(f.size) / 1024));
    parts.push(`<span class="agent-chip" data-chip-type="file" data-chip-id="${esc(f.id)}"><b>file</b><span>${esc(f.name)} (${kb} KB)</span><button type="button" class="remove" title="Detach" aria-label="Detach">x</button></span>`);
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
      const effort = normalizeReasoningEffort(app.ai.options.reasoningEffort, "medium");
      btn.classList.toggle("is-selected", enabled);
      btn.dataset.effort = effort;
      const title = `Reasoning: ${enabled ? "on" : "off"}, effort=${effort}`;
      btn.title = title;
      btn.setAttribute("aria-label", `${title}. Click to toggle.`);
      const badge = btn.querySelector("[data-ai-effort-badge]");
      if (badge) {
        badge.textContent = reasoningEffortBadge(effort);
        badge.style.opacity = enabled ? "1" : "0.45";
      }
      return;
    }
    if (key === "webSearch") {
      const title = `Web search: ${app.ai.options.webSearch ? "on" : "off"}`;
      btn.title = title;
      btn.setAttribute("aria-label", `${title}. Click to toggle.`);
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

async function copyText(text) {
  try {
    if (win.navigator?.clipboard?.writeText) {
      await win.navigator.clipboard.writeText(text);
      return;
    }
  } catch {}

  const ta = win.document.createElement("textarea");
  ta.value = text;
  ta.style.position = "fixed";
  ta.style.left = "-9999px";
  win.document.body.appendChild(ta);
  ta.select();
  win.document.execCommand("copy");
  win.document.body.removeChild(ta);
}

async function copyJournal(kind) {
  const cfg = journalConfig(kind);
  if (!cfg) return;
  if (!cfg.items.length) {
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
  const total = kinds.reduce((acc, kind) => acc + (journalConfig(kind)?.items.length || 0), 0);
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

function renderOpenAiModelOptions() {
  if (!dom.openAiModelSelect) return;
  dom.openAiModelSelect.innerHTML = AI_MODELS
    .map((m) => `<option value="${esc(m.id)}">${esc(m.label)} (${moneyUsd(m.inputUsdPer1M)} in / ${moneyUsd(m.outputUsdPer1M)} out за 1M)</option>`)
    .join("");

  const selectedId = isKnownAiModel(app.ai.model) ? app.ai.model : DEFAULT_AI_MODEL;
  dom.openAiModelSelect.value = selectedId;
  renderOpenAiModelPrice();
}

function renderOpenAiModelPrice() {
  if (!dom.openAiModelPrice || !dom.openAiModelSelect) return;
  const selectedId = String(dom.openAiModelSelect.value || "").trim();
  const model = AI_MODELS.find((m) => m.id === selectedId) || currentAiModelMeta();
  dom.openAiModelPrice.textContent = `${model.label}: вход ${moneyUsd(model.inputUsdPer1M)} / выход ${moneyUsd(model.outputUsdPer1M)} за 1M токенов. ${WEB_SEARCH_PRICE_NOTE}`;
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


