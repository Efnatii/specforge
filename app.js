
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
const CHAT_CONTEXT_RECENT_MESSAGES = 5;
const CHAT_SUMMARY_CHUNK_SIZE = 5;
const MAX_CHAT_SUMMARY_CHARS = 3600;
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
const POSITION_MARKET_FIELDS = new Set(["name", "manufacturer", "article", "supplier", "note"]);

const dom = {
  app: document.getElementById("app"),
  sidebar: document.getElementById("sidebar"),
  sidebarResizeHandle: document.getElementById("sidebarResizeHandle"),
  btnSidebarTabTree: document.getElementById("btnSidebarTabTree"),
  btnSidebarTabJournals: document.getElementById("btnSidebarTabJournals"),
  sidebarPanelTree: document.getElementById("sidebarPanelTree"),
  sidebarPanelJournals: document.getElementById("sidebarPanelJournals"),
  journalTabs: Array.from(document.querySelectorAll(".journal-tab[data-journal-view]")),
  journalPanes: Array.from(document.querySelectorAll(".journal-pane[data-journal-pane]")),
  tree: document.getElementById("tree"),
  inspector: document.getElementById("inspector"),
  tabs: document.getElementById("sheetTabs"),
  viewport: document.getElementById("sheetViewport"),
  canvas: document.getElementById("sheetCanvas"),
  toast: document.getElementById("toast"),
  importFile: document.getElementById("importFileInput"),
  settingsDialog: document.getElementById("settingsDialog"),
  settingsForm: document.getElementById("settingsForm"),
  settingOrder: document.getElementById("settingOrderNumber"),
  settingRequest: document.getElementById("settingRequestNumber"),
  settingDate: document.getElementById("settingChangeDate"),
  settingVersion: document.getElementById("settingVersion"),
  settingVat: document.getElementById("settingVatRate"),
  settingMode: document.getElementById("settingTotalMode"),
  btnToggleSidebar: document.getElementById("btnToggleSidebar"),
  btnSettings: document.getElementById("btnOpenSettings"),
  btnAddAssembly: document.getElementById("btnAddAssembly"),
  btnAddPosition: document.getElementById("btnAddPosition"),
  btnToggleProjCons: document.getElementById("btnToggleConsumablesSheet"),
  btnImportExcel: document.getElementById("btnImportExcel"),
  btnExportJson: document.getElementById("btnExportJson"),
  btnImportJson: document.getElementById("btnImportJson"),
  btnExportXlsx: document.getElementById("btnExportXlsx"),
  openAiAuthDialog: document.getElementById("openAiAuthDialog"),
  openAiAuthForm: document.getElementById("openAiAuthForm"),
  openAiApiKeyInput: document.getElementById("openAiApiKeyInput"),
  openAiModelSelect: document.getElementById("openAiModelSelect"),
  openAiModelPrice: document.getElementById("openAiModelPrice"),
  openAiAuthHint: document.getElementById("openAiAuthHint"),
  btnOpenAiCancel: document.getElementById("btnOpenAiCancel"),
  btnOpenAiDisconnect: document.getElementById("btnOpenAiDisconnect"),
  btnOpenAiSave: document.getElementById("btnOpenAiSave"),
  btnOpenAiAuth: document.getElementById("btnOpenAiAuth"),
  openAiAuthIndicator: document.getElementById("openAiAuthIndicator"),
  agentOverlay: document.getElementById("agentOverlay"),
  agentBody: document.getElementById("agentBody"),
  btnToggleAgentPanel: document.getElementById("btnToggleAgentPanel"),
  agentContextIcons: document.getElementById("agentContextIcons"),
  agentChips: document.getElementById("agentContextChips"),
  chatJournalList: document.getElementById("chatJournalList"),
  tableJournalList: document.getElementById("tableJournalList"),
  externalJournalList: document.getElementById("externalJournalList"),
  changesJournalList: document.getElementById("changesJournalList"),
  chatJournalCount: document.getElementById("chatJournalCount"),
  tableJournalCount: document.getElementById("tableJournalCount"),
  externalJournalCount: document.getElementById("externalJournalCount"),
  changesJournalCount: document.getElementById("changesJournalCount"),
  btnCopyAllJournals: document.getElementById("btnCopyAllJournals"),
  btnCopyChatJournal: document.getElementById("btnCopyChatJournal"),
  btnCopyTableJournal: document.getElementById("btnCopyTableJournal"),
  btnCopyExternalJournal: document.getElementById("btnCopyExternalJournal"),
  btnCopyChangesJournal: document.getElementById("btnCopyChangesJournal"),
  btnClearChatJournal: document.getElementById("btnClearChatJournal"),
  btnClearTableJournal: document.getElementById("btnClearTableJournal"),
  btnClearExternalJournal: document.getElementById("btnClearExternalJournal"),
  btnClearChangesJournal: document.getElementById("btnClearChangesJournal"),
  agentPrompt: document.getElementById("agentPromptInput"),
  btnAgentSend: document.getElementById("btnAgentSend"),
  agentAttachmentInput: document.getElementById("agentAttachmentInput"),
};

const app = {
  template: null,
  state: null,
  workbook: null,
  ui: {
    activeSheetId: "summary",
    treeSel: { type: "settings" },
    sidebarTab: "tree",
    journalView: "chat",
    selection: null,
    zoomBySheet: {},
    selecting: false,
    panning: false,
    pan: null,
    sidebarCollapsed: false,
    sidebarWidth: 360,
    sidebarResizing: false,
  },
  ai: {
    apiKey: "",
    model: DEFAULT_AI_MODEL,
    connected: false,
    sending: false,
    collapsed: false,
    options: {
      currentSheet: true,
      allSheets: false,
      selection: false,
      webSearch: true,
    },
    attachments: [],
    chatJournal: [],
    chatSummary: "",
    chatSummaryCount: 0,
    tableJournal: [],
    externalJournal: [],
    changesJournal: [],
    sheetOverrides: {},
    lastTaskPrompt: "",
    lastAssemblyId: "",
    lastActionablePrompt: "",
    pendingTask: "",
    taskState: "idle",
    turnId: "",
    turnCounter: 0,
    streaming: true,
    streamDeltaCount: 0,
    streamResponseId: "",
    currentRequestId: "",
    lastStreamBuffer: "",
    streamDeltaFlushTimer: 0,
    streamDeltaHasPending: false,
    streamEntryId: "",
    lastSuccessfulMutationTs: 0,
  },
};

const journalRenderState = {
  timer: 0,
  kinds: new Set(),
};

init().catch((err) => {
  console.error(err);
  toast("Ошибка загрузки шаблона");
});

async function init() {
  const [reportRes, stylesRes] = await Promise.all([
    fetch("assets/template-report.json"),
    fetch("assets/template-styles.json"),
  ]);
  if (!reportRes.ok || !stylesRes.ok) throw new Error("template load failed");

  const [report, styles] = await Promise.all([reportRes.json(), stylesRes.json()]);
  app.template = parseTemplate(report, styles);
  injectStyles(app.template.styles);
  app.state = makeDefaultState();
  loadAiSettings();
  applySidebarWidth(app.ui.sidebarWidth, false);
  bindEvents();
  renderAll();
  renderAiUi();
  toast("Шаблон КП готов");
}

function loadAiSettings() {
  try {
    const key = String(localStorage.getItem(STORAGE_KEYS.openAiApiKey) || "").trim();
    app.ai.apiKey = key;
    app.ai.connected = Boolean(key);
  } catch {}

  try {
    const storedModel = String(localStorage.getItem(STORAGE_KEYS.openAiModel) || "").trim();
    if (isKnownAiModel(storedModel)) app.ai.model = storedModel;
  } catch {}

  try {
    app.ai.collapsed = localStorage.getItem(STORAGE_KEYS.agentCollapsed) === "1";
  } catch {}

  try {
    const raw = localStorage.getItem(STORAGE_KEYS.agentOptions);
    if (raw) {
      const parsed = JSON.parse(raw);
      for (const k of ["currentSheet", "allSheets", "selection", "webSearch"]) {
        if (typeof parsed[k] === "boolean") app.ai.options[k] = parsed[k];
      }
    }
  } catch {}

  try {
    const rawWidth = num(localStorage.getItem(STORAGE_KEYS.sidebarWidth), app.ui.sidebarWidth);
    app.ui.sidebarWidth = clampSidebarWidth(rawWidth);
  } catch {}
}

function saveAiOptions() {
  try {
    localStorage.setItem(STORAGE_KEYS.agentOptions, JSON.stringify(app.ai.options));
  } catch {}
}

function saveAiCollapsed() {
  try {
    localStorage.setItem(STORAGE_KEYS.agentCollapsed, app.ai.collapsed ? "1" : "0");
  } catch {}
}

function saveOpenAiApiKey() {
  try {
    if (app.ai.apiKey) localStorage.setItem(STORAGE_KEYS.openAiApiKey, app.ai.apiKey);
    else localStorage.removeItem(STORAGE_KEYS.openAiApiKey);
  } catch {}
}

function saveOpenAiModel() {
  try {
    if (isKnownAiModel(app.ai.model)) localStorage.setItem(STORAGE_KEYS.openAiModel, app.ai.model);
  } catch {}
}

function clampSidebarWidth(value) {
  const width = num(value, 360);
  return Math.max(MIN_SIDEBAR_WIDTH, Math.min(MAX_SIDEBAR_WIDTH, Math.round(width)));
}

function saveSidebarWidth() {
  try {
    localStorage.setItem(STORAGE_KEYS.sidebarWidth, String(clampSidebarWidth(app.ui.sidebarWidth)));
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

  if (dom.btnAgentSend) dom.btnAgentSend.disabled = !app.ai.connected || app.ai.sending;
  if (dom.agentPrompt) dom.agentPrompt.disabled = !app.ai.connected || app.ai.sending;

  renderSidebarMode();
  renderJournalViewMode();
  renderAgentChips();
  renderAgentContextIcons();
  renderAgentJournals();
}

function renderAgentChips() {
  if (!dom.agentChips) return;
  const parts = [];

  for (const [key, title] of Object.entries({
    currentSheet: "Текущий лист",
    allSheets: "Все листы",
    selection: "Выделение",
    webSearch: "Веб-поиск",
  })) {
    if (!app.ai.options[key]) continue;
    parts.push(`<span class="agent-chip"><b>${esc(key)}</b><span>${esc(title)}</span></span>`);
  }

  for (const f of app.ai.attachments) {
    const kb = Math.max(1, Math.round(num(f.size) / 1024));
    parts.push(`<span class="agent-chip" data-chip-type="file" data-chip-id="${esc(f.id)}"><b>file</b><span>${esc(f.name)} (${kb} KB)</span><button type="button" class="remove" title="Открепить" aria-label="Открепить">×</button></span>`);
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
    btn.classList.toggle("is-selected", Boolean(app.ai.options[key]));
  });
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
  if (app.ai.streamDeltaFlushTimer) {
    window.clearTimeout(app.ai.streamDeltaFlushTimer);
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
  app.ai.streamDeltaFlushTimer = window.setTimeout(() => {
    app.ai.streamDeltaFlushTimer = 0;
    flushAgentStreamingDeltaPatch();
  }, STREAM_DELTA_FLUSH_MS);
}

function finalizeAgentStreamingEntry(entryId, finalText, status = "completed", level = "info", extraMeta = undefined) {
  if (app.ai.streamDeltaFlushTimer) {
    window.clearTimeout(app.ai.streamDeltaFlushTimer);
    app.ai.streamDeltaFlushTimer = 0;
  }
  flushAgentStreamingDeltaPatch();

  if (!entryId) return;
  const text = String(finalText || "").trim() || String(app.ai.lastStreamBuffer || "").trim() || "Готово.";
  const meta = {
    stream: true,
    delta_count: num(app.ai.streamDeltaCount, 0),
    chars: text.length,
  };
  if (extraMeta && typeof extraMeta === "object") {
    Object.assign(meta, extraMeta);
  }
  patchJournalEntry(app.ai.chatJournal, entryId, { text, status, level, meta }, "chat");
  app.ai.streamEntryId = "";
  app.ai.streamDeltaHasPending = false;
  rollupChatSummaryState();
}

function buildStreamingPreviewText(textRaw) {
  const text = String(textRaw || "");
  if (text.length <= STREAM_TEXT_PREVIEW_LIMIT) return text;
  return `[streaming preview: ${text.length} chars]\n...\n${text.slice(-STREAM_TEXT_PREVIEW_LIMIT)}`;
}

function flushAgentStreamingDeltaPatch() {
  if (!app.ai.streamDeltaHasPending) return;
  if (!app.ai.streamEntryId) return;

  app.ai.streamDeltaHasPending = false;
  patchJournalEntry(app.ai.chatJournal, app.ai.streamEntryId, {
    text: buildStreamingPreviewText(app.ai.lastStreamBuffer),
    status: "streaming",
    meta: {
      stream: true,
      delta_count: app.ai.streamDeltaCount,
      chars: String(app.ai.lastStreamBuffer || "").length,
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
  journalRenderState.timer = window.setTimeout(flushJournalRender, JOURNAL_RENDER_DEBOUNCE_MS);
}

function flushJournalRender() {
  if (journalRenderState.timer) {
    window.clearTimeout(journalRenderState.timer);
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

  countEl.textContent = String(items.length);
  if (!items.length) {
    listEl.innerHTML = `<div class="agent-journal-empty">Пока пусто</div>`;
    return;
  }

  const html = items
    .slice()
    .reverse()
    .map((raw) => {
      const it = normalizeJournalEntry(raw);
      const level = esc(String(it.level || "info"));
      const status = renderJournalStatusBadge(it.status);
      const aux = renderJournalAuxInfo(it);
      const meta = renderJournalMetaBlock(it.meta);
      return `<div class="agent-journal-item level-${level}">
        <span class="time">${esc(journalTime(it.ts))}</span>
        <span class="kind">${esc(it.kind)}</span>
        <span class="text">${status}${aux}${renderJournalTextHtml(it.text, { status: it.status })}${meta}</span>
      </div>`;
    })
    .join("");
  listEl.innerHTML = html;
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

function parseTemplate(report, stylesRaw) {
  const styles = {};
  for (const s of stylesRaw.styles) styles[s.id] = normalizeStyle(s);

  const sheets = {
    summary: normalizeSheet(report[SHEET_NAMES.summary]),
    main: normalizeSheet(report[SHEET_NAMES.main]),
    consumable: normalizeSheet(report[SHEET_NAMES.consumable]),
    projectConsumable: normalizeSheet(report[SHEET_NAMES.projectConsumable]),
  };

  return { styles, sheets };
}

function normalizeSheet(raw) {
  const maxCol = raw.maxCol;
  const cols = expandCols(raw.cols, maxCol).map(excelWToPx);
  const rowStyles = {};
  const rowValues = {};

  for (const c of raw.cells) {
    const { row, col } = decodeAddr(c.a);
    if (!rowStyles[row]) rowStyles[row] = new Array(maxCol).fill(0);
    if (!rowValues[row]) rowValues[row] = {};
    rowStyles[row][col - 1] = Number(c.s || 0);
    if (c.v !== null && c.v !== undefined) rowValues[row][col] = normalizeCellValue(c.v);
  }

  const rowHeights = {};
  for (const [r, pt] of Object.entries(raw.rowHeights || {})) rowHeights[Number(r)] = ptToPx(Number(pt));

  return {
    maxCol,
    cols,
    merges: raw.merges || [],
    rowStyles,
    rowValues,
    rowHeights,
    defaultRowHeight: ptToPx(Number(raw.defaultRowHeight || 14.4)),
    view: {
      xSplit: raw.view?.xSplit || 0,
      ySplit: raw.view?.ySplit || 0,
      zoom: (raw.view?.zoomScale || 100) / 100,
    },
  };
}

function normalizeStyle(s) {
  const font = s.font || {};
  const fill = s.fill || {};
  const align = s.alignment || {};
  const border = s.border || {};
  return {
    id: s.id,
    numFmtId: Number(s.numFmtId || 0),
    numFmtCode: s.numFmtCode ? String(s.numFmtCode).replaceAll("\\\\", "\\") : "",
    font: {
      name: font.name || "Times New Roman",
      size: Number(font.size || 8),
      bold: Boolean(font.bold),
      italic: Boolean(font.italic),
      color: colorRef(font.color) || "#000000",
    },
    fill: {
      type: fill.patternType || "none",
      color: fill.patternType === "solid" ? (colorRef(fill.fgColor || fill.bgColor) || "#ffffff") : null,
    },
    align: {
      h: align.horizontal || "left",
      v: align.vertical || "middle",
      wrap: align.wrapText === "1",
    },
    border: {
      left: normBorder(border.left),
      right: normBorder(border.right),
      top: normBorder(border.top),
      bottom: normBorder(border.bottom),
    },
  };
}

function normBorder(side) {
  if (!side || !side.style) return null;
  return { style: side.style, color: colorRef(side.color) || "#000" };
}

function colorRef(c) {
  if (!c) return null;
  if (c.rgb) return `#${String(c.rgb).slice(-6).toLowerCase()}`;
  if (c.theme !== undefined) {
    const theme = Number(c.theme);
    return ({ 0: "#ffffff", 1: "#000000", 2: "#eeece1", 3: "#1f497d" })[theme] || "#000000";
  }
  if (c.indexed !== undefined) return Number(c.indexed) === 65 ? "#d9d9d9" : "#000000";
  return "#000000";
}

function injectStyles(styles) {
  const el = document.createElement("style");
  el.id = "sheet-style-map";
  const lines = [];
  for (const [id, s] of Object.entries(styles)) {
    const d = [];
    d.push(`font-family:'${String(s.font.name).replaceAll("'", "\\'")}', 'Times New Roman', serif`);
    d.push(`font-size:${s.font.size}px`);
    d.push(`font-weight:${s.font.bold ? 700 : 400}`);
    d.push(`font-style:${s.font.italic ? "italic" : "normal"}`);
    d.push(`color:${s.font.color}`);
    d.push(`text-align:${s.align.h}`);
    d.push(`vertical-align:${s.align.v}`);
    d.push(`white-space:${s.align.wrap ? "pre-line" : "nowrap"}`);
    d.push(`background:${s.fill.type === "solid" ? s.fill.color : "transparent"}`);
    for (const side of ["left", "right", "top", "bottom"]) {
      const b = s.border[side];
      d.push(`border-${side}:${b ? "1px solid " + b.color : "none"}`);
    }
    lines.push(`.cell.s-${id}{${d.join(";")}}`);
  }
  el.textContent = lines.join("\n");
  document.head.appendChild(el);
}

function decodeAddr(addr) {
  const m = /^([A-Z]+)(\d+)$/i.exec(addr);
  if (!m) return { row: 1, col: 1 };
  let col = 0;
  for (const ch of m[1].toUpperCase()) col = col * 26 + (ch.charCodeAt(0) - 64);
  return { row: Number(m[2]), col };
}

function expandCols(meta, maxCol) {
  const arr = new Array(maxCol).fill(8.43);
  for (const c of meta || []) {
    const min = Number(c.min || 1);
    const max = Number(c.max || min);
    const w = num(c.width, 8.43);
    for (let i = min; i <= max; i += 1) arr[i - 1] = w;
  }
  return arr;
}

function excelWToPx(w) {
  return Math.max(20, Math.floor(num(w, 8.43) * 7 + 5));
}

function pxToExcelW(px) {
  return Math.max(1, (num(px, 64) - 5) / 7);
}

function ptToPx(pt) {
  return Math.round(num(pt, 14.4) * (96 / 72));
}

function pxToPt(px) {
  return num(px, 19) * (72 / 96);
}

function normalizeCellValue(v) {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) && v.trim() !== "" ? n : v;
  }
  return v;
}

function num(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function clamp(v, min, max) {
  return Math.min(Math.max(v, min), max);
}

function round2(v) {
  return Math.round((num(v) + Number.EPSILON) * 100) / 100;
}

function ceil1(v) {
  return Math.ceil(num(v));
}
function makeDefaultState() {
  return {
    settings: {
      orderNumber: "0091-0821",
      requestNumber: "0254",
      changeDate: "2026-02-15",
      version: "",
      vatRate: 0.22,
      totalMode: "withoutDiscount",
    },
    assemblies: [],
    hasProjectConsumables: false,
    projectConsumables: [makePosition()],
  };
}

function makePosition() {
  return {
    id: uid(),
    schematic: "",
    name: "",
    manufacturer: "",
    article: "",
    qty: 1,
    unit: "шт",
    priceCatalogVatMarkup: 0,
    markup: 0,
    discount: 0,
    supplier: "",
    note: "",
  };
}

function makeAssembly(index = 1) {
  const full = `Новая сборка ${index}`;
  return {
    id: uid(),
    fullName: full,
    abbreviation: deriveAbbr(full),
    abbrManual: false,
    separateConsumables: false,
    main: [makePosition()],
    consumable: [makePosition()],
    manualConsNoDisc: 0,
    manualConsDisc: 0,
    labor: {
      devCoeff: 1.25,
      devHours: 0,
      devRate: 0,
      assmCoeff: 1.25,
      assmHours: 0,
      assmRate: 0,
      profitCoeff: 0.3,
    },
  };
}

function deriveAbbr(name) {
  const src = String(name || "").replace(/\s+/g, " ").trim();
  if (!src) return "СБР";

  const tokens = src.split(" ").filter(Boolean);
  if (!tokens.length) return "СБР";

  let i = 0;
  let initials = "";
  while (i < tokens.length && /^[\p{L}]+$/u.test(tokens[i])) {
    initials += tokens[i][0].toUpperCase();
    i += 1;
  }

  if (initials && i < tokens.length) {
    return `${initials}${tokens.slice(i).join(" ")}`.trim();
  }
  if (initials) return initials;
  if (tokens.length === 1) return tokens[0];
  return src;
}

function keepAbbr(value) {
  return String(value ?? "").trim();
}

function pctToDec(v) {
  return num(v) / 100;
}

function normalizePercentDecimal(v, fallback = 0) {
  const n = num(v, fallback);
  const abs = Math.abs(n);
  return abs > 1 && abs <= 100 ? n / 100 : n;
}

function decToPct(v) {
  return round2(num(v) * 100);
}

function calcItem(raw, vat) {
  const qty = num(raw.qty);
  const pCatalog = num(raw.priceCatalogVatMarkup ?? raw.priceWithoutVat);
  const m = num(raw.markup);
  const d = num(raw.discount);

  const divider = (1 + vat) * (1 + m);
  const baseNoVat = divider > 0 ? pCatalog / divider : 0;
  const priceNoVat = baseNoVat * (1 + m);
  const priceVat = priceNoVat * (1 + vat);
  const sumNoVat = qty * priceNoVat;
  const sumVat = qty * priceVat;

  const discPriceNoVat = baseNoVat * (1 - d);
  const discPriceVat = discPriceNoVat * (1 + vat);
  const discSumNoVat = qty * discPriceNoVat;
  const discSumVat = qty * discPriceVat;

  return {
    raw,
    baseNoVat,
    priceNoVat,
    priceVat,
    sumNoVat,
    sumVat,
    discPriceNoVat,
    discPriceVat,
    discSumNoVat,
    discSumVat,
  };
}

function calcAssemblyMetrics(a, vat) {
  const main = a.main.map((p) => calcItem(p, vat));
  const cons = a.consumable.map((p) => calcItem(p, vat));

  const mainNoDisc = main.reduce((s, i) => s + i.sumVat, 0);
  const mainDisc = main.reduce((s, i) => s + i.discSumVat, 0);

  const consNoDisc = a.separateConsumables
    ? ceil1(cons.reduce((s, i) => s + i.sumVat, 0))
    : num(a.manualConsNoDisc);
  const consDisc = a.separateConsumables
    ? ceil1(cons.reduce((s, i) => s + i.discSumVat, 0))
    : num(a.manualConsDisc);

  const baseNoDisc = mainNoDisc + consNoDisc;
  const baseDisc = mainDisc + consDisc;

  const devTax = num(a.labor.devRate) * 0.6;
  const devTotal = num(a.labor.devHours) * (num(a.labor.devRate) + devTax);
  const devCoeff = devTotal * num(a.labor.devCoeff);

  const assmTax = num(a.labor.assmRate) * 0.6;
  const assmTotal = num(a.labor.assmHours) * (num(a.labor.assmRate) + assmTax);
  const assmCoeff = assmTotal * num(a.labor.assmCoeff);

  const profitNoDisc = (baseNoDisc + devCoeff + assmCoeff) * num(a.labor.profitCoeff);
  const profitDisc = (baseDisc + devCoeff + assmCoeff) * num(a.labor.profitCoeff);

  const totalNoDisc = ceil1(baseNoDisc + devCoeff + assmCoeff + profitNoDisc);
  const totalDisc = baseDisc + devCoeff + assmCoeff + profitDisc;

  return {
    main,
    cons,
    consNoDisc,
    consDisc,
    baseNoDisc,
    baseDisc,
    devTax,
    devTotal,
    devCoeff,
    assmTax,
    assmTotal,
    assmCoeff,
    profitNoDisc,
    profitDisc,
    totalNoDisc,
    totalDisc,
  };
}

function buildWorkbook() {
  const names = buildNamePlan();
  const sheets = [];
  const summaryEntries = [];

  for (const a of app.state.assemblies) {
    const metrics = calcAssemblyMetrics(a, app.state.settings.vatRate);
    const n = names[a.id];

    let consSheet = null;
    let consRef = null;

    if (a.separateConsumables) {
      consSheet = buildConsumableSheet(`assembly:${a.id}:cons`, n.consName, a.consumable, app.template.sheets.consumable, consumableTitle(a));
      consRef = { sheetName: consSheet.name, totalRow: consSheet.meta.totalRow };
    }

    const mainSheet = buildMainSheet(`assembly:${a.id}:main`, n.mainName, a, metrics, app.template.sheets.main, consRef, mainTitle(a));

    sheets.push(mainSheet);
    if (consSheet) sheets.push(consSheet);

    summaryEntries.push({
      label: a.fullName || "<Полное название cборки>",
      sheetName: mainSheet.name,
      totalRow: mainSheet.meta.totalRow,
      noDisc: metrics.totalNoDisc,
      disc: metrics.totalDisc,
    });
  }

  if (app.state.hasProjectConsumables) {
    const proj = buildConsumableSheet("project-consumables", names.project, app.state.projectConsumables, app.template.sheets.projectConsumable, projectConsumableTitle());
    sheets.push(proj);
    summaryEntries.push({
      label: "Расходники",
      sheetName: proj.name,
      totalRow: proj.meta.totalRow,
      noDisc: readCellNum(proj, proj.meta.totalRow, 11),
      disc: readCellNum(proj, proj.meta.totalRow, 17),
    });
  }

  const summary = buildSummarySheet(summaryEntries, app.template.sheets.summary);
  const all = [summary, ...sheets];
  return { sheets: all, byId: Object.fromEntries(all.map((s) => [s.id, s])) };
}

function buildNamePlan() {
  const used = new Set([SHEET_NAMES.summary]);
  const plan = {};
  for (const a of app.state.assemblies) {
    const abbr = keepAbbr(a.abbreviation) || deriveAbbr(a.fullName);
    if (a.separateConsumables) {
      plan[a.id] = {
        mainName: uniqueSheetName(`Осн. мат. ${abbr}`, used),
        consName: uniqueSheetName(`Расх. мат. ${abbr}`, used),
      };
    } else {
      plan[a.id] = {
        mainName: uniqueSheetName(abbr || "Сборка", used),
        consName: null,
      };
    }
  }
  plan.project = app.state.hasProjectConsumables ? uniqueSheetName("Расходники", used) : null;
  return plan;
}

function uniqueSheetName(base, used) {
  let n = String(base || "").replace(/[\\/*?:\[\]]/g, " ").replace(/\s+/g, " ").trim().slice(0, 31) || "Sheet";
  let c = n;
  let i = 2;
  while (used.has(c)) {
    const s = ` (${i})`;
    c = `${n.slice(0, 31 - s.length)}${s}`;
    i += 1;
  }
  used.add(c);
  return c;
}

function sheetRow(template, patRow, heightRow = patRow) {
  const pat = template.rowStyles[patRow] || new Array(template.maxCol).fill(0);
  const h = template.rowHeights[heightRow] || template.defaultRowHeight;
  return { height: h, cells: pat.map((sid) => ({ styleId: Number(sid || 0), value: null, formula: "" })) };
}

function setR(row, col, value, formula = "") {
  const c = row.cells[col - 1];
  if (!c) return;
  c.value = normalizeCellValue(value);
  c.formula = formula;
}

function copyVals(row, vals) {
  if (!vals) return;
  for (const [c, v] of Object.entries(vals)) setR(row, Number(c), v);
}

function readCellNum(sheet, row, col) {
  return num(sheet.rows[row - 1]?.cells[col - 1]?.value, 0);
}

function changeLabel() {
  if (String(app.state.settings.version || "").trim()) return `вер. ${String(app.state.settings.version).trim()}`;
  const d = new Date(app.state.settings.changeDate);
  if (Number.isNaN(d.getTime())) return "изм.";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `изм. ${dd}.${mm}.${d.getFullYear()}`;
}

function mainTitle(a) {
  const s = app.state.settings;
  const tag = a.separateConsumables ? "СП основной материал" : "СП";
  return `${s.orderNumber} ${a.fullName || "<Полное название cборки>"} (${s.requestNumber}) ${tag} ${changeLabel()}`;
}

function consumableTitle(a) {
  const s = app.state.settings;
  return `${s.orderNumber} ${a.fullName || "<Полное название cборки>"} (${s.requestNumber}) СП расходный материал ${changeLabel()}`;
}

function projectConsumableTitle() {
  const s = app.state.settings;
  return `${s.orderNumber} Расходники (${s.requestNumber}) СП расходный материал ${changeLabel()}`;
}
function buildSummarySheet(entries, t) {
  const rows = [];

  const r1 = sheetRow(t, 1, 1);
  copyVals(r1, t.rowValues[1]);
  rows.push(r1);

  for (let i = 0; i < entries.length; i += 1) {
    const e = entries[i];
    const rn = rows.length + 1;
    const r = sheetRow(t, 2, 2);
    const useDisc = app.state.settings.totalMode === "withDiscount";
    const total = useDisc ? e.disc : e.noDisc;
    const col = useDisc ? "Q" : "K";

    setR(r, 1, i + 1);
    setR(r, 2, e.label);
    setR(r, 3, "к-т");
    setR(r, 4, 1);
    setR(r, 5, round2(total), `${quoteSheet(e.sheetName)}!${col}${e.totalRow}`);
    setR(r, 6, app.state.settings.vatRate);
    setR(r, 7, round2(total - total * app.state.settings.vatRate), `I${rn}-H${rn}`);
    setR(r, 8, round2(total * app.state.settings.vatRate), `I${rn}*F${rn}`);
    setR(r, 9, round2(total), `E${rn}`);
    rows.push(r);
  }

  const trn = rows.length + 1;
  const tr = sheetRow(t, 3, 3);
  copyVals(tr, t.rowValues[3]);
  const sumFormula = trn > 2 ? `SUM(I2:I${trn - 1})` : "0";
  const sumValue = entries.reduce((s, e) => s + (app.state.settings.totalMode === "withDiscount" ? e.disc : e.noDisc), 0);
  setR(tr, 9, round2(sumValue), sumFormula);
  rows.push(tr);

  return {
    id: "summary",
    name: SHEET_NAMES.summary,
    cols: t.cols,
    rows,
    merges: [],
    freeze: { x: 0, y: 0 },
    zoom: t.view.zoom,
    meta: { totalRow: trn },
  };
}

function buildMainSheet(id, name, assembly, metrics, t, consRef, title) {
  const rows = [];
  const vat = app.state.settings.vatRate;

  const r1 = sheetRow(t, 1, 1);
  setR(r1, 1, title);
  rows.push(r1);

  const r2 = sheetRow(t, 2, 2);
  copyVals(r2, t.rowValues[2]);
  rows.push(r2);

  const posStart = rows.length + 1;
  for (let i = 0; i < metrics.main.length; i += 1) {
    const it = metrics.main[i];
    const rn = rows.length + 1;
    const r = sheetRow(t, 3, 3);
    setR(r, 1, i + 1);
    setR(r, 2, it.raw.schematic);
    setR(r, 3, it.raw.name);
    setR(r, 4, it.raw.manufacturer);
    setR(r, 5, it.raw.article);
    setR(r, 6, it.raw.qty);
    setR(r, 7, it.raw.unit);
    setR(r, 8, round2(it.baseNoVat));
    setR(r, 9, round2(it.priceVat), `H${rn}*(1+L${rn})*(1+${vat})`);
    setR(r, 10, round2(it.sumNoVat), `F${rn}*H${rn}*(1+L${rn})`);
    setR(r, 11, round2(it.sumVat), `F${rn}*I${rn}`);
    setR(r, 12, it.raw.markup);
    setR(r, 13, it.raw.discount);
    setR(r, 14, round2(it.discPriceNoVat), `H${rn}*(1-M${rn})`);
    setR(r, 15, round2(it.discPriceVat), `N${rn}*(1+${vat})`);
    setR(r, 16, round2(it.discSumNoVat), `F${rn}*N${rn}`);
    setR(r, 17, round2(it.discSumVat), `F${rn}*O${rn}`);
    setR(r, 18, it.raw.supplier);
    setR(r, 19, it.raw.note);
    rows.push(r);
  }
  const posEnd = rows.length;

  rows.push(sheetRow(t, 4, 4));

  const r5 = sheetRow(t, 5, 5);
  copyVals(r5, t.rowValues[5]);
  rows.push(r5);

  const r6n = rows.length + 1;
  const r6 = sheetRow(t, 6, 6);
  copyVals(r6, t.rowValues[6]);
  if (consRef) {
    setR(r6, 11, round2(metrics.consNoDisc), `${quoteSheet(consRef.sheetName)}!$K$${consRef.totalRow}`);
    setR(r6, 17, round2(metrics.consDisc), `${quoteSheet(consRef.sheetName)}!$Q$${consRef.totalRow}`);
  } else {
    setR(r6, 11, round2(metrics.consNoDisc));
    setR(r6, 17, round2(metrics.consDisc));
  }
  rows.push(r6);

  const r7n = rows.length + 1;
  const r7 = sheetRow(t, 7, 7);
  copyVals(r7, t.rowValues[7]);
  setR(r7, 11, round2(metrics.baseNoDisc), `SUM(K${posStart}:K${posEnd})+K${r6n}`);
  setR(r7, 17, round2(metrics.baseDisc), `Q${r6n}+SUM(Q${posStart}:Q${posEnd})`);
  rows.push(r7);

  const r8 = sheetRow(t, 8, 8);
  copyVals(r8, t.rowValues[8]);
  rows.push(r8);

  const r9n = rows.length + 1;
  const r9 = sheetRow(t, 9, 9);
  copyVals(r9, t.rowValues[9]);
  setR(r9, 6, assembly.labor.devCoeff);
  setR(r9, 7, assembly.labor.devHours);
  setR(r9, 8, round2(assembly.labor.devRate));
  setR(r9, 9, round2(metrics.devTax), `H${r9n}*0.6`);
  setR(r9, 10, round2(metrics.devTotal), `G${r9n}*(H${r9n}+I${r9n})`);
  setR(r9, 11, round2(metrics.devCoeff), `J${r9n}*F${r9n}`);
  rows.push(r9);

  const r10n = rows.length + 1;
  const r10 = sheetRow(t, 10, 10);
  copyVals(r10, t.rowValues[10]);
  setR(r10, 6, assembly.labor.assmCoeff);
  setR(r10, 7, assembly.labor.assmHours);
  setR(r10, 8, round2(assembly.labor.assmRate));
  setR(r10, 9, round2(metrics.assmTax), `H${r10n}*0.6`);
  setR(r10, 10, round2(metrics.assmTotal), `G${r10n}*(H${r10n}+I${r10n})`);
  setR(r10, 11, round2(metrics.assmCoeff), `J${r10n}*F${r10n}`);
  rows.push(r10);

  const r11n = rows.length + 1;
  const r11 = sheetRow(t, 11, 11);
  copyVals(r11, t.rowValues[11]);
  setR(r11, 6, assembly.labor.profitCoeff);
  setR(r11, 11, round2(metrics.profitNoDisc), `(K${r10n}+K${r9n}+K${r7n})*F${r11n}`);
  setR(r11, 17, round2(metrics.profitDisc), `(Q${r7n}+K${r9n}+K${r10n})*F${r11n}`);
  rows.push(r11);

  const r12 = sheetRow(t, 12, 12);
  copyVals(r12, t.rowValues[12]);
  rows.push(r12);

  const r13n = rows.length + 1;
  const r13 = sheetRow(t, 13, 13);
  copyVals(r13, t.rowValues[13]);
  setR(r13, 11, round2(metrics.totalNoDisc), `CEILING((SUM(K${r7n}:K${r11n})),1)`);
  setR(r13, 17, round2(metrics.totalDisc), `Q${r11n}+Q${r7n}+K${r9n}+K${r10n}`);
  rows.push(r13);

  return {
    id,
    name,
    cols: t.cols,
    rows,
    merges: ["A1:G1"],
    freeze: { x: 0, y: 0 },
    zoom: t.view.zoom,
    meta: { totalRow: r13n },
  };
}

function buildConsumableSheet(id, name, positions, t, title) {
  const rows = [];
  const vat = app.state.settings.vatRate;
  const items = positions.map((p) => calcItem(p, vat));

  const r1 = sheetRow(t, 1, 1);
  setR(r1, 1, title);
  rows.push(r1);

  const r2 = sheetRow(t, 2, 2);
  copyVals(r2, t.rowValues[2]);
  rows.push(r2);

  const posStart = rows.length + 1;
  for (let i = 0; i < items.length; i += 1) {
    const it = items[i];
    const rn = rows.length + 1;
    const r = sheetRow(t, 3, 3);
    setR(r, 1, i + 1);
    setR(r, 2, it.raw.schematic);
    setR(r, 3, it.raw.name);
    setR(r, 4, it.raw.manufacturer);
    setR(r, 5, it.raw.article);
    setR(r, 6, it.raw.qty);
    setR(r, 7, it.raw.unit);
    setR(r, 8, round2(it.baseNoVat));
    setR(r, 9, round2(it.priceVat), `H${rn}*(1+L${rn})*(1+${vat})`);
    setR(r, 10, round2(it.sumNoVat), `F${rn}*H${rn}*(1+L${rn})`);
    setR(r, 11, round2(it.sumVat), `F${rn}*I${rn}`);
    setR(r, 12, it.raw.markup);
    setR(r, 13, it.raw.discount);
    setR(r, 14, round2(it.discPriceNoVat), `H${rn}*(1-M${rn})`);
    setR(r, 15, round2(it.discPriceVat), `N${rn}*(1+${vat})`);
    setR(r, 16, round2(it.discSumNoVat), `F${rn}*N${rn}`);
    setR(r, 17, round2(it.discSumVat), `F${rn}*O${rn}`);
    setR(r, 18, it.raw.supplier);
    setR(r, 19, it.raw.note);
    rows.push(r);
  }
  const posEnd = rows.length;

  rows.push(sheetRow(t, 4, 4));

  const r5 = sheetRow(t, 5, 5);
  copyVals(r5, t.rowValues[5]);
  rows.push(r5);

  const r6n = rows.length + 1;
  const r6 = sheetRow(t, 6, 6);
  copyVals(r6, t.rowValues[6]);
  const totalK = ceil1(items.reduce((s, i) => s + i.sumVat, 0));
  const totalQ = ceil1(items.reduce((s, i) => s + i.discSumVat, 0));
  setR(r6, 11, round2(totalK), `CEILING((SUM(K${posStart}:K${posEnd})),1)`);
  setR(r6, 17, round2(totalQ), `CEILING((SUM(Q${posStart}:Q${posEnd})),1)`);
  rows.push(r6);

  return {
    id,
    name,
    cols: t.cols,
    rows,
    merges: ["A1:G1"],
    freeze: { x: 0, y: 0 },
    zoom: t.view.zoom,
    meta: { totalRow: r6n },
  };
}

function quoteSheet(name) {
  return `'${String(name).replaceAll("'", "''")}'`;
}
function renderAll() {
  app.workbook = buildWorkbook();
  applyAgentSheetOverrides();
  if (!app.workbook.byId[app.ui.activeSheetId]) app.ui.activeSheetId = "summary";
  renderTabs();
  renderSheet();
  renderTree();
  renderInspector();
  renderAiUi();
}

function renderTabs() {
  dom.tabs.innerHTML = app.workbook.sheets
    .map((s) => `<button class="sheet-tab ${s.id === app.ui.activeSheetId ? "active" : ""}" data-sheet="${esc(s.id)}">${esc(s.name)}</button>`)
    .join("");
}

function activeSheet() {
  return app.workbook.byId[app.ui.activeSheetId] || null;
}

function currentZoom(sheet) {
  return app.ui.zoomBySheet[sheet.id] || sheet.zoom || 1;
}

function renderSheet() {
  const s = activeSheet();
  if (!s) return;

  dom.canvas.style.setProperty("--sheet-zoom", String(currentZoom(s)));

  const h = document.createElement("h2");
  h.className = "sheet-title";
  h.textContent = s.name;

  const t = document.createElement("table");
  t.className = "sheet-table";

  const cg = document.createElement("colgroup");
  for (const w of s.cols) {
    const c = document.createElement("col");
    c.style.width = `${w}px`;
    cg.appendChild(c);
  }
  t.appendChild(cg);

  const merge = buildMergeMeta(s.merges);

  const body = document.createElement("tbody");

  for (let ri = 1; ri <= s.rows.length; ri += 1) {
    const r = s.rows[ri - 1];
    const tr = document.createElement("tr");
    tr.style.height = `${r.height}px`;

    for (let ci = 1; ci <= s.cols.length; ci += 1) {
      const k = `${ri}:${ci}`;
      if (merge.skip.has(k)) continue;

      const cell = r.cells[ci - 1];
      const td = document.createElement("td");
      td.className = `cell s-${cell.styleId}`;
      td.dataset.row = String(ri);
      td.dataset.col = String(ci);

      const st = app.template.styles[cell.styleId];
      if (st?.align?.wrap) td.classList.add("wrap");

      const m = merge.start.get(k);
      if (m) {
        td.rowSpan = m.rs;
        td.colSpan = m.cs;
      }

      td.textContent = cellText(cell, st);
      if (cell.formula) td.title = cell.formula;
      tr.appendChild(td);
    }

    body.appendChild(tr);
  }

  t.appendChild(body);
  dom.canvas.innerHTML = "";
  dom.canvas.appendChild(h);
  dom.canvas.appendChild(t);

  paintSelection();
}

function cellText(cell, style) {
  if (cell.value === null || cell.value === undefined || cell.value === "") return "";
  if (typeof cell.value !== "number") return String(cell.value);

  const id = style?.numFmtId || 0;
  const code = style?.numFmtCode || "";

  if (id === 9 || id === 10 || code.includes("%")) {
    const d = id === 9 ? 0 : 2;
    return `${new Intl.NumberFormat("ru-RU", { minimumFractionDigits: d, maximumFractionDigits: d }).format(cell.value * 100)}%`;
  }

  if (id === 2) return new Intl.NumberFormat("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(cell.value);

  if (code.includes("₽") || code.includes("р.") || id === 165 || id === 166 || id === 164) {
    const d = id === 164 ? 0 : 2;
    return `${new Intl.NumberFormat("ru-RU", { minimumFractionDigits: d, maximumFractionDigits: d }).format(cell.value)} ₽`;
  }

  if (Number.isInteger(cell.value)) return new Intl.NumberFormat("ru-RU").format(cell.value);
  return new Intl.NumberFormat("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(cell.value);
}

function buildMergeMeta(merges) {
  const start = new Map();
  const skip = new Set();
  for (const r of merges || []) {
    const [a, b] = r.split(":");
    if (!a || !b) continue;
    const s = decodeAddr(a);
    const e = decodeAddr(b);
    start.set(`${s.row}:${s.col}`, { rs: e.row - s.row + 1, cs: e.col - s.col + 1 });
    for (let i = s.row; i <= e.row; i += 1) {
      for (let j = s.col; j <= e.col; j += 1) {
        if (i === s.row && j === s.col) continue;
        skip.add(`${i}:${j}`);
      }
    }
  }
  return { start, skip };
}

function offsets(arr) {
  const out = [];
  let sum = 0;
  for (const v of arr) {
    out.push(sum);
    sum += v;
  }
  return out;
}

function renderTree() {
  const sel = app.ui.treeSel;
  const p = [];

  p.push(`
    <div class="tree-item tree-item-with-actions ${selected(sel, { type: "settings" }) ? "is-selected" : ""}" data-node="settings">
      <span class="tree-item-label">Общие настройки</span>
      <span class="tree-item-actions">
        <button type="button" class="tree-mini-btn" data-tree-action="open-settings" title="Открыть окно настроек" aria-label="Открыть окно настроек">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm8 4-.9-.4a7.7 7.7 0 0 0-.3-1.2l.7-.7-1.4-2.4-1 .3c-.3-.3-.7-.6-1.1-.8L15.7 5h-3.4l-.3 1.1c-.4.2-.8.5-1.1.8l-1-.3L8.5 9l.7.7c-.1.4-.2.8-.3 1.2L8 12l.9.4c.1.4.2.8.3 1.2l-.7.7 1.4 2.4 1-.3c.3.3.7.6 1.1.8l.3 1.1h3.4l.3-1.1c.4-.2.8-.5 1.1-.8l1 .3 1.4-2.4-.7-.7c.1-.4.2-.8.3-1.2z" /></svg>
        </button>
      </span>
    </div>
  `);

  for (const a of app.state.assemblies) {
    p.push(`<details open><summary><span class="tree-summary-label">${esc(a.fullName || "Сборка")} [${esc(a.abbreviation)}]</span><button type="button" class="tree-mini-btn" data-tree-action="dup-assembly" data-id="${a.id}" title="Дублировать сборку" aria-label="Дублировать сборку"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 9h10v10H9zM5 5h10v10" /></svg></button></summary>`);
    p.push(`
      <div class="tree-item tree-item-with-actions ${selected(sel, { type: "assembly", id: a.id }) ? "is-selected" : ""}" data-node="assembly" data-id="${a.id}">
        <span class="tree-item-label">Параметры</span>
        <span class="tree-item-actions">
          <button type="button" class="tree-mini-btn" data-tree-action="del-assembly" data-id="${a.id}" title="Удалить сборку" aria-label="Удалить сборку">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 7h12M9 7V5h6v2M8 7l1 12h6l1-12" /></svg>
          </button>
        </span>
      </div>
    `);
    p.push(`
      <div class="tree-item tree-item-with-actions ${selected(sel, { type: "list", id: a.id, list: "main" }) ? "is-selected" : ""}" data-node="list" data-id="${a.id}" data-list="main">
        <span class="tree-item-label">Осн. материалы (${a.main.length})</span>
        <span class="tree-item-actions">
          <button type="button" class="tree-mini-btn" data-tree-action="add-pos" data-id="${a.id}" data-list="main" title="Добавить позицию" aria-label="Добавить позицию">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h10M17 15v6M14 18h6" /></svg>
          </button>
        </span>
      </div>
    `);
    for (const pos of a.main) {
      p.push(`
        <div class="tree-item tree-item-with-actions small ${selected(sel, { type: "pos", id: a.id, list: "main", pos: pos.id }) ? "is-selected" : ""}" style="padding-left:18px" data-node="pos" data-id="${a.id}" data-list="main" data-pos="${pos.id}">
          <span class="tree-item-label">• ${esc(pos.name || "Позиция")}</span>
          <span class="tree-item-actions">
            <button type="button" class="tree-mini-btn" data-tree-action="dup-pos" data-id="${a.id}" data-list="main" data-pos="${pos.id}" title="Дублировать позицию" aria-label="Дублировать позицию">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 9h10v10H9zM5 5h10v10" /></svg>
            </button>
            <button type="button" class="tree-mini-btn" data-tree-action="del-pos" data-id="${a.id}" data-list="main" data-pos="${pos.id}" title="Удалить позицию" aria-label="Удалить позицию">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 7h12M9 7V5h6v2M8 7l1 12h6l1-12" /></svg>
            </button>
          </span>
        </div>
      `);
    }

    if (a.separateConsumables) {
      p.push(`
        <div class="tree-item tree-item-with-actions ${selected(sel, { type: "list", id: a.id, list: "cons" }) ? "is-selected" : ""}" data-node="list" data-id="${a.id}" data-list="cons">
          <span class="tree-item-label">Расх. материалы (${a.consumable.length})</span>
          <span class="tree-item-actions">
            <button type="button" class="tree-mini-btn" data-tree-action="add-pos" data-id="${a.id}" data-list="cons" title="Добавить позицию" aria-label="Добавить позицию">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h10M17 15v6M14 18h6" /></svg>
            </button>
          </span>
        </div>
      `);
      for (const pos of a.consumable) {
        p.push(`
          <div class="tree-item tree-item-with-actions small ${selected(sel, { type: "pos", id: a.id, list: "cons", pos: pos.id }) ? "is-selected" : ""}" style="padding-left:18px" data-node="pos" data-id="${a.id}" data-list="cons" data-pos="${pos.id}">
            <span class="tree-item-label">• ${esc(pos.name || "Позиция")}</span>
            <span class="tree-item-actions">
              <button type="button" class="tree-mini-btn" data-tree-action="dup-pos" data-id="${a.id}" data-list="cons" data-pos="${pos.id}" title="Дублировать позицию" aria-label="Дублировать позицию">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 9h10v10H9zM5 5h10v10" /></svg>
              </button>
              <button type="button" class="tree-mini-btn" data-tree-action="del-pos" data-id="${a.id}" data-list="cons" data-pos="${pos.id}" title="Удалить позицию" aria-label="Удалить позицию">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 7h12M9 7V5h6v2M8 7l1 12h6l1-12" /></svg>
              </button>
            </span>
          </div>
        `);
      }
    }

    p.push(`</details>`);
  }

  p.push(`
    <div class="tree-item tree-item-with-actions ${selected(sel, { type: "projlist" }) ? "is-selected" : ""}" data-node="projlist">
      <span class="tree-item-label">Расходники</span>
      <span class="tree-item-actions">
        <button type="button" class="tree-mini-btn has-indicator" data-tree-action="toggle-proj" title="${app.state.hasProjectConsumables ? "Выключить лист расходников" : "Включить лист расходников"}" aria-label="${app.state.hasProjectConsumables ? "Выключить лист расходников" : "Включить лист расходников"}">
          <span class="tree-mini-indicator ${app.state.hasProjectConsumables ? "is-on" : "is-off"}" aria-hidden="true"></span>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v7m5-5a7 7 0 1 1-10 0" /></svg>
        </button>
        <button type="button" class="tree-mini-btn" data-tree-action="add-proj-pos" title="Добавить позицию" aria-label="Добавить позицию" ${app.state.hasProjectConsumables ? "" : "disabled"}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h10M17 15v6M14 18h6" /></svg>
        </button>
      </span>
    </div>
  `);
  if (app.state.hasProjectConsumables) {
    for (const pos of app.state.projectConsumables) {
      p.push(`
        <div class="tree-item tree-item-with-actions small ${selected(sel, { type: "projpos", pos: pos.id }) ? "is-selected" : ""}" style="padding-left:18px" data-node="projpos" data-pos="${pos.id}">
          <span class="tree-item-label">• ${esc(pos.name || "Позиция")}</span>
          <span class="tree-item-actions">
            <button type="button" class="tree-mini-btn" data-tree-action="dup-pos" data-id="project" data-list="project" data-pos="${pos.id}" title="Дублировать позицию" aria-label="Дублировать позицию">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 9h10v10H9zM5 5h10v10" /></svg>
            </button>
            <button type="button" class="tree-mini-btn" data-tree-action="del-pos" data-id="project" data-list="project" data-pos="${pos.id}" title="Удалить позицию" aria-label="Удалить позицию">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 7h12M9 7V5h6v2M8 7l1 12h6l1-12" /></svg>
            </button>
          </span>
        </div>
      `);
    }
  }

  dom.tree.innerHTML = p.join("");
}

function selected(curr, expected) {
  if (!curr || curr.type !== expected.type) return false;
  for (const [k, v] of Object.entries(expected)) if (k !== "type" && curr[k] !== v) return false;
  return true;
}

function renderInspector() {
  const s = app.ui.treeSel;
  if (s.type === "settings") {
    renderSettingsInspector();
    return;
  }

  if (s.type === "assembly") {
    const a = assemblyById(s.id);
    if (!a) return;
    renderAssemblyInspector(a);
    return;
  }

  if (s.type === "list") {
    dom.inspector.innerHTML = `<h3>${s.list === "main" ? "Основные материалы" : "Расходные материалы"}</h3>`;
    return;
  }

  if (s.type === "pos") {
    const a = assemblyById(s.id);
    if (!a) return;
    const list = s.list === "main" ? a.main : a.consumable;
    const p = list.find((x) => x.id === s.pos);
    if (!p) return;
    renderPositionInspector(p, s.id, s.list);
    return;
  }

  if (s.type === "projlist") {
    dom.inspector.innerHTML = `<h3>Расходники</h3>`;
    return;
  }

  if (s.type === "projpos") {
    const p = app.state.projectConsumables.find((x) => x.id === s.pos);
    if (!p) return;
    renderPositionInspector(p, "project", "project");
    return;
  }

  dom.inspector.innerHTML = "";
}
function renderSettingsInspector() {
  const s = app.state.settings;
  dom.inspector.innerHTML = `
    <h3>Общие настройки</h3>
    <div class="grid">
      <label>Номер заказа<input data-role="setting" data-field="orderNumber" value="${esc(s.orderNumber)}" /></label>
      <label>Номер запроса<input data-role="setting" data-field="requestNumber" value="${esc(s.requestNumber)}" /></label>
      <label>Дата изменения<input data-role="setting" data-field="changeDate" type="date" value="${esc(s.changeDate)}" /></label>
      <label>Версия<input data-role="setting" data-field="version" value="${esc(s.version)}" placeholder="1234" /></label>
      <label>НДС, %<input data-role="setting" data-field="vatRate" type="number" step="0.01" value="${decToPct(s.vatRate)}" /></label>
      <label>Итоговая цена<select data-role="setting" data-field="totalMode"><option value="withoutDiscount" ${s.totalMode === "withoutDiscount" ? "selected" : ""}>Без скидки</option><option value="withDiscount" ${s.totalMode === "withDiscount" ? "selected" : ""}>Со скидкой</option></select></label>
    </div>`;
}

function renderAssemblyInspector(a) {
  const m = calcAssemblyMetrics(a, app.state.settings.vatRate);
  dom.inspector.innerHTML = `
    <h3>Параметры сборки</h3>
    <div class="grid">
      <label>Полное название<input data-role="assembly" data-id="${a.id}" data-field="fullName" value="${esc(a.fullName)}" /></label>
      <label>Аббревиатура<input data-role="assembly" data-id="${a.id}" data-field="abbreviation" value="${esc(a.abbreviation)}" /></label>
      <label class="check-line"><input data-role="assembly" data-id="${a.id}" data-field="abbrManual" type="checkbox" ${a.abbrManual ? "checked" : ""} /> Ручная аббревиатура</label>
      <label class="check-line"><input data-role="assembly" data-id="${a.id}" data-field="separateConsumables" type="checkbox" ${a.separateConsumables ? "checked" : ""} /> Отдельный лист расходных материалов</label>
      ${a.separateConsumables ? "" : `<label>Расх. материал без скидки<input data-role="assembly" data-id="${a.id}" data-field="manualConsNoDisc" type="number" step="0.01" value="${a.manualConsNoDisc}" /></label><label>Расх. материал со скидкой<input data-role="assembly" data-id="${a.id}" data-field="manualConsDisc" type="number" step="0.01" value="${a.manualConsDisc}" /></label>`}
      <div class="meta">Разработка схемы</div>
      <div class="row"><label>Коэфф.<input data-role="labor" data-id="${a.id}" data-field="devCoeff" type="number" step="0.01" value="${a.labor.devCoeff}" /></label><label>Часы<input data-role="labor" data-id="${a.id}" data-field="devHours" type="number" step="0.1" value="${a.labor.devHours}" /></label></div>
      <label>Ставка<input data-role="labor" data-id="${a.id}" data-field="devRate" type="number" step="0.01" value="${a.labor.devRate}" /></label>
      <div class="meta">Работа по сборке</div>
      <div class="row"><label>Коэфф.<input data-role="labor" data-id="${a.id}" data-field="assmCoeff" type="number" step="0.01" value="${a.labor.assmCoeff}" /></label><label>Часы<input data-role="labor" data-id="${a.id}" data-field="assmHours" type="number" step="0.1" value="${a.labor.assmHours}" /></label></div>
      <label>Ставка<input data-role="labor" data-id="${a.id}" data-field="assmRate" type="number" step="0.01" value="${a.labor.assmRate}" /></label>
      <label>Прибыль (0.3 = 30%)<input data-role="labor" data-id="${a.id}" data-field="profitCoeff" type="number" step="0.01" value="${a.labor.profitCoeff}" /></label>
      <div class="meta">Итог без скидки: <strong>${money(m.totalNoDisc)}</strong><br/>Итог со скидкой: <strong>${money(m.totalDisc)}</strong></div>
    </div>`;
}

function renderPositionInspector(p, id, list) {
  const role = list === "project" ? "project-pos" : "pos";
  dom.inspector.innerHTML = `
    <h3>Позиция</h3>
    <div class="grid">
      <label>Обозначение<input data-role="${role}" data-id="${id}" data-list="${list}" data-pos="${p.id}" data-field="schematic" value="${esc(p.schematic)}" /></label>
      <label>Наименование<input data-role="${role}" data-id="${id}" data-list="${list}" data-pos="${p.id}" data-field="name" value="${esc(p.name)}" /></label>
      <label>Производитель<input data-role="${role}" data-id="${id}" data-list="${list}" data-pos="${p.id}" data-field="manufacturer" value="${esc(p.manufacturer)}" /></label>
      <label>Артикул<input data-role="${role}" data-id="${id}" data-list="${list}" data-pos="${p.id}" data-field="article" value="${esc(p.article)}" /></label>
      <div class="row"><label>Кол-во<input data-role="${role}" data-id="${id}" data-list="${list}" data-pos="${p.id}" data-field="qty" type="number" step="0.01" value="${p.qty}" /></label><label>Ед. изм.<input data-role="${role}" data-id="${id}" data-list="${list}" data-pos="${p.id}" data-field="unit" value="${esc(p.unit)}" /></label></div>
      <label>Цена без скидки, с наценкой и с НДС<input data-role="${role}" data-id="${id}" data-list="${list}" data-pos="${p.id}" data-field="priceCatalogVatMarkup" type="number" step="0.01" value="${p.priceCatalogVatMarkup}" /></label>
      <div class="row"><label>Наценка, %<input data-role="${role}" data-id="${id}" data-list="${list}" data-pos="${p.id}" data-field="markup" type="number" step="0.01" value="${decToPct(p.markup)}" /></label><label>Скидка, %<input data-role="${role}" data-id="${id}" data-list="${list}" data-pos="${p.id}" data-field="discount" type="number" step="0.01" value="${decToPct(p.discount)}" /></label></div>
      <label>Поставщик<input data-role="${role}" data-id="${id}" data-list="${list}" data-pos="${p.id}" data-field="supplier" value="${esc(p.supplier)}" /></label>
      <label>Примечание<textarea data-role="${role}" data-id="${id}" data-list="${list}" data-pos="${p.id}" data-field="note">${esc(p.note)}</textarea></label>
    </div>`;
}

function assemblyById(id) {
  return app.state.assemblies.find((a) => a.id === id) || null;
}

function bindEvents() {
  dom.btnToggleSidebar.onclick = () => {
    app.ui.sidebarCollapsed = !app.ui.sidebarCollapsed;
    dom.app.classList.toggle("sidebar-collapsed", app.ui.sidebarCollapsed);
  };

  if (dom.sidebarResizeHandle) {
    dom.sidebarResizeHandle.onpointerdown = onSidebarResizePointerDown;
  }
  window.addEventListener("pointermove", onSidebarResizePointerMove);
  window.addEventListener("pointerup", onSidebarResizePointerUp);
  window.addEventListener("pointercancel", onSidebarResizePointerUp);

  if (dom.btnSidebarTabTree) {
    dom.btnSidebarTabTree.onclick = () => {
      app.ui.sidebarTab = "tree";
      renderAiUi();
    };
  }
  if (dom.btnSidebarTabJournals) {
    dom.btnSidebarTabJournals.onclick = () => {
      app.ui.sidebarTab = "journals";
      renderAiUi();
    };
  }
  for (const btn of dom.journalTabs || []) {
    btn.onclick = () => {
      const k = String(btn.dataset.journalView || "table");
      app.ui.journalView = k;
      renderJournalViewMode();
    };
  }

  dom.btnOpenAiAuth.onclick = onOpenAiAuthClick;
  if (dom.openAiAuthForm) dom.openAiAuthForm.onsubmit = onOpenAiAuthSubmit;
  if (dom.btnOpenAiCancel) dom.btnOpenAiCancel.onclick = () => dom.openAiAuthDialog?.close();
  if (dom.btnOpenAiDisconnect) {
    dom.btnOpenAiDisconnect.onclick = () => {
      disconnectOpenAi();
      if (dom.openAiAuthDialog?.open) dom.openAiAuthDialog.close();
    };
  }
  if (dom.openAiModelSelect) {
    dom.openAiModelSelect.onchange = () => renderOpenAiModelPrice();
  }
  dom.btnToggleAgentPanel.onclick = () => {
    app.ai.collapsed = !app.ai.collapsed;
    saveAiCollapsed();
    renderAiUi();
  };
  dom.agentChips.onclick = onAgentChipClick;
  if (dom.btnCopyChatJournal) {
    dom.btnCopyChatJournal.onclick = () => {
      void copyJournal("chat");
    };
  }
  if (dom.btnCopyAllJournals) {
    dom.btnCopyAllJournals.onclick = () => {
      void copyAllJournals();
    };
  }
  if (dom.btnCopyTableJournal) {
    dom.btnCopyTableJournal.onclick = () => {
      void copyJournal("table");
    };
  }
  if (dom.btnCopyExternalJournal) {
    dom.btnCopyExternalJournal.onclick = () => {
      void copyJournal("external");
    };
  }
  if (dom.btnCopyChangesJournal) {
    dom.btnCopyChangesJournal.onclick = () => {
      void copyJournal("changes");
    };
  }
  if (dom.btnClearChatJournal) {
    dom.btnClearChatJournal.onclick = () => {
      app.ai.chatJournal = [];
      app.ai.chatSummary = "";
      app.ai.chatSummaryCount = 0;
      app.ai.lastTaskPrompt = "";
      app.ai.lastActionablePrompt = "";
      app.ai.pendingTask = "";
      app.ai.lastStreamBuffer = "";
      app.ai.streamEntryId = "";
      app.ai.streamDeltaHasPending = false;
      if (app.ai.streamDeltaFlushTimer) {
        window.clearTimeout(app.ai.streamDeltaFlushTimer);
        app.ai.streamDeltaFlushTimer = 0;
      }
      renderAgentJournals();
    };
  }
  if (dom.btnClearTableJournal) {
    dom.btnClearTableJournal.onclick = () => {
      app.ai.tableJournal = [];
      renderAgentJournals();
    };
  }
  if (dom.btnClearExternalJournal) {
    dom.btnClearExternalJournal.onclick = () => {
      app.ai.externalJournal = [];
      renderAgentJournals();
    };
  }
  if (dom.btnClearChangesJournal) {
    dom.btnClearChangesJournal.onclick = () => {
      app.ai.changesJournal = [];
      renderAgentJournals();
    };
  }
  if (dom.agentContextIcons) dom.agentContextIcons.onclick = onAgentContextIconsClick;
  dom.btnAgentSend.onclick = sendAgentPrompt;
  dom.agentPrompt.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      sendAgentPrompt();
    }
  });
  dom.agentAttachmentInput.onchange = onAgentAttachmentsPicked;

  dom.btnSettings.onclick = () => openSettingsDialog();

  dom.btnAddAssembly.onclick = () => {
    const a = makeAssembly(app.state.assemblies.length + 1);
    app.state.assemblies.push(a);
    app.ui.treeSel = { type: "assembly", id: a.id };
    app.ui.activeSheetId = `assembly:${a.id}:main`;
    renderAll();
    addChangesJournal("assembly.add", a.fullName || a.id);
    toast("Сборка добавлена");
  };

  dom.btnAddPosition.onclick = () => {
    if (!addPositionBySelection()) toast("Выберите раздел позиций");
  };

  dom.btnToggleProjCons.onclick = () => {
    app.state.hasProjectConsumables = !app.state.hasProjectConsumables;
    if (app.state.hasProjectConsumables && !app.state.projectConsumables.length) app.state.projectConsumables = [makePosition()];
    app.ui.treeSel = { type: "projlist" };
    renderAll();
    addChangesJournal("project.consumables", app.state.hasProjectConsumables ? "включены" : "выключены");
  };

  dom.btnImportExcel.onclick = () => {
    dom.importFile.accept = ".xlsx,.xlsm,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel.sheet.macroEnabled.12";
    dom.importFile.click();
  };
  dom.btnExportJson.onclick = exportJson;
  dom.btnImportJson.onclick = () => {
    dom.importFile.accept = "application/json,.json,.xlsx,.xlsm,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel.sheet.macroEnabled.12";
    dom.importFile.click();
  };
  dom.btnExportXlsx.onclick = exportXlsx;

  dom.importFile.onchange = importJson;

  dom.tabs.onclick = (e) => {
    const b = e.target.closest("button[data-sheet]");
    if (!b) return;
    app.ui.activeSheetId = b.dataset.sheet;
    app.ui.selection = null;
    renderTabs();
    renderSheet();
  };

  dom.tree.onclick = onTreeClick;
  dom.inspector.onclick = onInspectorClick;
  dom.inspector.onchange = onInspectorChange;

  dom.settingsForm.onsubmit = (e) => {
    e.preventDefault();
    applySettingsForm();
    dom.settingsDialog.close();
    renderAll();
  };

  dom.viewport.oncontextmenu = (e) => e.preventDefault();
  dom.viewport.onmousedown = onViewportMouseDown;
  window.onmousemove = onViewportMouseMove;
  window.onmouseup = onViewportMouseUp;
  document.addEventListener("mousedown", onDocumentMouseDown, true);

  dom.viewport.addEventListener("wheel", (e) => {
    e.preventDefault();
    const s = activeSheet();
    if (!s) return;
    const curr = currentZoom(s);
    const next = clamp(curr * (e.deltaY < 0 ? 1.08 : 0.92), 0.45, 2.1);
    if (Math.abs(next - curr) < 0.0001) return;

    const rect = dom.viewport.getBoundingClientRect();
    const mouseViewportX = e.clientX - rect.left;
    const mouseViewportY = e.clientY - rect.top;
    const worldX = (dom.viewport.scrollLeft + mouseViewportX) / curr;
    const worldY = (dom.viewport.scrollTop + mouseViewportY) / curr;

    app.ui.zoomBySheet[s.id] = next;
    dom.canvas.style.setProperty("--sheet-zoom", String(next));
    dom.viewport.scrollLeft = worldX * next - mouseViewportX;
    dom.viewport.scrollTop = worldY * next - mouseViewportY;
    toast(`Масштаб: ${Math.round(next * 100)}%`);
  }, { passive: false });

  document.addEventListener("copy", (e) => {
    if (editableFocus()) return;
    const s = activeSheet();
    const sel = app.ui.selection;
    if (!s || !sel || sel.sheet !== s.id) return;
    const text = selectionText(s, sel);
    if (!text) return;
    if (e.clipboardData) {
      e.preventDefault();
      e.clipboardData.setData("text/plain", text);
      toast("Скопировано");
    }
  });

  document.addEventListener("keydown", async (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "c") {
      if (editableFocus()) return;
      const s = activeSheet();
      const sel = app.ui.selection;
      if (!s || !sel || sel.sheet !== s.id) return;
      e.preventDefault();
      const text = selectionText(s, sel);
      await copyText(text);
      toast("Скопировано");
    }
  });

}

async function onOpenAiAuthClick() {
  if (!dom.openAiAuthDialog || typeof dom.openAiAuthDialog.showModal !== "function" || !dom.openAiApiKeyInput || !dom.openAiAuthHint || !dom.btnOpenAiDisconnect || !dom.btnOpenAiSave || !dom.openAiModelSelect) {
    const key = window.prompt("Введите OpenAI API key (формат sk-...)");
    if (key === null) return;
    await connectOpenAiWithKey(key, app.ai.model);
    return;
  }

  renderOpenAiModelOptions();
  if (dom.openAiModelSelect) dom.openAiModelSelect.value = isKnownAiModel(app.ai.model) ? app.ai.model : DEFAULT_AI_MODEL;
  renderOpenAiModelPrice();
  dom.openAiApiKeyInput.value = "";
  dom.openAiAuthHint.textContent = app.ai.connected
    ? "Ключ уже сохранен. Можно заменить ключ и/или модель."
    : "Введите OpenAI API key, выберите модель и нажмите Сохранить.";
  dom.btnOpenAiDisconnect.hidden = !app.ai.connected;
  dom.btnOpenAiSave.disabled = false;
  dom.openAiAuthDialog.showModal();
}

async function onOpenAiAuthSubmit(e) {
  e.preventDefault();
  if (String(e.submitter?.value || "") === "cancel") {
    dom.openAiAuthDialog?.close();
    return;
  }
  if (!dom.openAiApiKeyInput) return;
  const selectedModel = String(dom.openAiModelSelect?.value || DEFAULT_AI_MODEL).trim();
  if (!isKnownAiModel(selectedModel)) {
    toast("Выберите корректную модель");
    return;
  }

  const token = String(dom.openAiApiKeyInput.value || "").trim();
  if (!token) {
    if (app.ai.connected) {
      app.ai.model = selectedModel;
      saveOpenAiModel();
      addChangesJournal("auth.model", selectedModel);
      dom.openAiAuthDialog.close();
      toast("Настройки сохранены");
      return;
    }
    toast("Введите API key");
    return;
  }

  if (dom.btnOpenAiSave) dom.btnOpenAiSave.disabled = true;
  const ok = await connectOpenAiWithKey(token, selectedModel);
  if (dom.btnOpenAiSave) dom.btnOpenAiSave.disabled = false;
  if (ok && dom.openAiAuthDialog?.open) dom.openAiAuthDialog.close();
}

async function connectOpenAiWithKey(token, modelId = DEFAULT_AI_MODEL) {
  const clean = String(token || "").trim();
  if (!clean) {
    toast("Ключ не введен");
    return false;
  }
  const model = isKnownAiModel(modelId) ? modelId : DEFAULT_AI_MODEL;
  const verified = await verifyOpenAiApiKey(clean);
  if (!verified.ok) {
    toast(verified.error || "OpenAI: ключ не принят");
    return false;
  }
  let finalModel = model;
  if (Array.isArray(verified.modelIds) && verified.modelIds.length) {
    if (!verified.modelIds.includes(finalModel)) {
      const preferred = AI_MODELS.map((m) => m.id).find((id) => verified.modelIds.includes(id));
      if (preferred) {
        addExternalJournal("auth.model.fallback", `Модель ${finalModel} недоступна, выбрана ${preferred}`);
        finalModel = preferred;
      }
    }
  }
  app.ai.apiKey = clean;
  app.ai.model = finalModel;
  app.ai.connected = true;
  saveOpenAiApiKey();
  saveOpenAiModel();
  addChangesJournal("auth.connect", finalModel);
  renderAiUi();
  toast("Ключ API сохранен");
  return true;
}

function disconnectOpenAi() {
  if (app.ai.streamDeltaFlushTimer) {
    window.clearTimeout(app.ai.streamDeltaFlushTimer);
    app.ai.streamDeltaFlushTimer = 0;
  }
  app.ai.apiKey = "";
  app.ai.connected = false;
  app.ai.sending = false;
  app.ai.attachments = [];
  app.ai.streamEntryId = "";
  app.ai.streamDeltaHasPending = false;
  app.ai.lastStreamBuffer = "";
  addExternalJournal("auth", "Ключ OpenAI отключен");
  addChangesJournal("auth.disconnect", "manual");
  saveOpenAiApiKey();
  renderAiUi();
  toast("OpenAI отключен");
}

async function verifyOpenAiApiKey(key) {
  const startedAt = Date.now();
  addExternalJournal("auth.request", "GET /v1/models (проверка API key)");
  try {
    const res = await fetch("https://api.openai.com/v1/models", {
      headers: {
        Authorization: `Bearer ${key}`,
      },
    });
    const ms = Date.now() - startedAt;
    addExternalJournal("auth.response", `HTTP ${res.status} /v1/models (${ms}ms)`);
    if (res.ok) {
      const body = await res.json().catch(() => ({}));
      const ids = Array.isArray(body?.data) ? body.data.map((m) => String(m?.id || "").trim()).filter(Boolean) : [];
      return { ok: true, modelIds: ids };
    }
    if (res.status === 401 || res.status === 403) return { ok: false, error: "OpenAI: неверный ключ" };
    return { ok: false, error: `OpenAI: ошибка ${res.status}` };
  } catch {
    const ms = Date.now() - startedAt;
    addExternalJournal("auth.error", `Сетевая ошибка при проверке ключа (${ms}ms)`);
    return { ok: false, error: "OpenAI: сеть недоступна" };
  }
}

function onAgentChipClick(e) {
  const remove = e.target.closest("button.remove");
  if (!remove) return;
  const chip = e.target.closest(".agent-chip");
  if (!chip) return;
  const type = chip.dataset.chipType;
  if (type === "file") {
    const id = chip.dataset.chipId;
    const removed = app.ai.attachments.find((f) => f.id === id);
    app.ai.attachments = app.ai.attachments.filter((f) => f.id !== id);
    if (removed) addChangesJournal("ai.file.detach", removed.name);
    renderAiUi();
  }
}

function onAgentContextIconsClick(e) {
  const btn = e.target.closest("[data-ai-option]");
  if (!btn) return;
  const option = String(btn.dataset.aiOption || "");

  if (option === "files") {
    dom.agentAttachmentInput.click();
    return;
  }

  if (!(option in app.ai.options)) return;
  app.ai.options[option] = !app.ai.options[option];
  saveAiOptions();
  addChangesJournal("ai.option", `${option}=${app.ai.options[option] ? "on" : "off"}`);
  renderAiUi();
}

async function onAgentAttachmentsPicked(e) {
  const files = Array.from(e.target.files || []);
  if (!files.length) return;

  const incoming = [];
  for (const file of files) {
    const entry = await makeAgentAttachment(file);
    incoming.push(entry);
  }
  app.ai.attachments.push(...incoming);
  dom.agentAttachmentInput.value = "";
  addChangesJournal("ai.file.attach", `Добавлено файлов: ${incoming.length}`);
  renderAiUi();
  toast(`Файлы прикреплены: ${incoming.length}`);
}

async function makeAgentAttachment(file) {
  const textLike = /^text\//i.test(file.type) || /\.(txt|md|csv|json|xml|yml|yaml|js|ts|html|css)$/i.test(file.name);
  let text = "";
  let truncated = false;
  if (textLike) {
    try {
      const raw = await file.text();
      const maxChars = 40000;
      text = raw.slice(0, maxChars);
      truncated = raw.length > maxChars;
    } catch {}
  }
  return {
    id: uid(),
    name: String(file.name || "file"),
    size: num(file.size, 0),
    type: String(file.type || "application/octet-stream"),
    text,
    truncated,
  };
}

async function sendAgentPrompt() {
  if (!app.ai.connected || !app.ai.apiKey) {
    toast("Сначала подключите OpenAI");
    return;
  }
  if (app.ai.sending) return;

  const rawText = String(dom.agentPrompt.value || "").trim();
  if (!rawText) {
    toast("Введите запрос для ИИ");
    return;
  }
  const normalized = normalizeAgentPrompt(rawText);
  const text = String(normalized?.text || "").trim();
  if (!text) {
    toast("Нет задачи для выполнения");
    return;
  }
  if (!AI_CONTINUE_PROMPT_RE.test(rawText) && !AI_SHORT_ACK_PROMPT_RE.test(rawText)) {
    app.ai.lastTaskPrompt = rawText;
  }
  if (normalized.actionable) {
    app.ai.lastActionablePrompt = normalized.basePrompt || rawText;
    app.ai.pendingTask = normalized.basePrompt || rawText;
  }
  app.ai.turnId = nextAgentTurnId();
  app.ai.taskState = "running";
  app.ai.lastStreamBuffer = "";
  app.ai.streamDeltaCount = 0;
  app.ai.streamResponseId = "";
  app.ai.streamEntryId = "";
  app.ai.streamDeltaHasPending = false;
  if (app.ai.streamDeltaFlushTimer) {
    window.clearTimeout(app.ai.streamDeltaFlushTimer);
    app.ai.streamDeltaFlushTimer = 0;
  }

  app.ai.sending = true;
  renderAiUi();
  addAgentLog("user", rawText, {
    turn_id: app.ai.turnId,
    status: "done",
    meta: {
      normalized_prompt: text,
      mode: normalized.mode,
      pending_task_used: Boolean(normalized.usedPendingTask),
    },
  });
  addChangesJournal("ai.prompt", `Отправлен запрос (${rawText.length} символов)`, {
    turn_id: app.ai.turnId,
    meta: { normalized: text.slice(0, 300) },
  });
  const streamEntryId = beginAgentStreamingEntry(app.ai.turnId);
  let streamDeltaEvents = 0;
  let streamDeltaChars = 0;
  const turnStartedAt = Date.now();

  try {
    const input = buildAgentInput(text);
    const out = await runOpenAiAgentTurn(input, text, {
      rawUserText: rawText,
      turnId: app.ai.turnId,
      streamEntryId,
      onStreamDelta: (delta) => appendAgentStreamingDelta(streamEntryId, delta),
      onStreamEvent: (eventName, eventData) => {
        const isDelta = eventName === "response.output_text.delta";
        if (isDelta) {
          streamDeltaEvents += 1;
          streamDeltaChars += String(eventData?.delta || "").length;
          if (streamDeltaEvents % 40 !== 0) return;
          addExternalJournal("stream.delta", `chunks=${streamDeltaEvents}, chars=${streamDeltaChars}`, {
            turn_id: app.ai.turnId,
            request_id: String(eventData?.__request_id || ""),
            response_id: String(eventData?.response?.id || eventData?.id || ""),
            status: "streaming",
            meta: { chunks: streamDeltaEvents, chars: streamDeltaChars },
          });
          return;
        }
        addExternalJournal("stream.event", String(eventName || "event"), {
          turn_id: app.ai.turnId,
          request_id: String(eventData?.__request_id || ""),
          response_id: String(eventData?.response?.id || eventData?.id || ""),
          status: "streaming",
          meta: compactForTool(eventData),
        });
      },
    });
    const finalText = sanitizeAgentOutputText(out || "Готово.");
    finalizeAgentStreamingEntry(streamEntryId, finalText, "completed", "info", {
      response_id: app.ai.streamResponseId || "",
      duration_ms: Date.now() - turnStartedAt,
    });
    app.ai.taskState = "completed";
    if (normalized.actionable) app.ai.pendingTask = "";
    addChangesJournal("ai.task.complete", `turn=${app.ai.turnId}`, {
      turn_id: app.ai.turnId,
      status: "completed",
      meta: {
        duration_ms: Date.now() - turnStartedAt,
        delta_chunks: streamDeltaEvents,
        delta_chars: streamDeltaChars,
      },
    });
    dom.agentPrompt.value = "";
  } catch (err) {
    console.error(err);
    const details = String(err?.message || "Неизвестная ошибка").slice(0, 400);
    finalizeAgentStreamingEntry(streamEntryId, `Ошибка выполнения: ${details}`, "error", "error", {
      duration_ms: Date.now() - turnStartedAt,
    });
    app.ai.taskState = "failed";
    addChangesJournal("ai.task.error", `turn=${app.ai.turnId}`, {
      turn_id: app.ai.turnId,
      level: "error",
      status: "error",
      meta: { error: details, duration_ms: Date.now() - turnStartedAt },
    });
    toast("Ошибка выполнения запроса ИИ");
  } finally {
    app.ai.sending = false;
    renderAiUi();
  }
}

function normalizeAgentPrompt(rawText) {
  const text = String(rawText || "").trim();
  if (!text) return { text: "", actionable: false, mode: "empty", usedPendingTask: false };

  const lastTask = String(app.ai.pendingTask || app.ai.lastActionablePrompt || app.ai.lastTaskPrompt || "").trim();
  const wantsContinue = AI_CONTINUE_PROMPT_RE.test(text) || AI_SHORT_ACK_PROMPT_RE.test(text);
  if (wantsContinue && lastTask) {
    addChangesJournal("ai.prompt.continue", "Использована последняя задача", { meta: { task: lastTask.slice(0, 220) } });
    return {
      text: `Продолжи и заверши предыдущую задачу пользователя без уточнений и без вопросов: ${lastTask}`,
      basePrompt: lastTask,
      actionable: true,
      mode: "continue-last-task",
      usedPendingTask: true,
    };
  }

  const actionable = isActionableAgentPrompt(text);
  return {
    text,
    basePrompt: text,
    actionable,
    mode: actionable ? "actionable" : "plain",
    usedPendingTask: false,
  };
}

function isActionableAgentPrompt(textRaw) {
  const text = String(textRaw || "").trim();
  if (!text) return false;
  if (AI_MUTATION_INTENT_RE.test(text) || AI_ACTIONABLE_VERB_RE.test(text)) return true;
  const lower = text.toLowerCase();
  return AI_TOOL_NAME_HINTS.some((tool) => lower.includes(tool));
}

function buildAgentInput(userText) {
  const parts = [];
  const chatCtx = buildChatHistoryContext();
  if (chatCtx) parts.push(`История диалога:\n${chatCtx}`);

  parts.push(`Текущий запрос пользователя:\n${userText}`);

  const ctx = buildAgentContextText();
  if (ctx) parts.push(`Контекст проекта:\n${ctx}`);

  return parts.join("\n\n");
}

function buildChatHistoryContext(maxMessages = CHAT_CONTEXT_RECENT_MESSAGES, maxChars = 12000) {
  const src = Array.isArray(app.ai.chatJournal) ? app.ai.chatJournal : [];
  if (!src.length) return "";

  const olderCount = Math.max(0, src.length - maxMessages);
  const summaryStart = Math.min(app.ai.chatSummaryCount, olderCount);
  const remainder = src.slice(summaryStart, olderCount);

  let summary = String(app.ai.chatSummary || "").trim();
  if (remainder.length) {
    const remainderSummary = summarizeChatChunk(remainder);
    summary = mergeChatSummary(summary, remainderSummary);
  }

  const recent = src.slice(-maxMessages);
  const lines = [];
  if (summary) lines.push(`summary: ${summary}`);

  for (const item of recent) {
    const kind = String(item?.kind || "").trim();
    const text = String(item?.text || "").replace(/\s+/g, " ").trim();
    if (!text) continue;
    const role = kind === "AI" ? "assistant" : "user";
    lines.push(`${role}: ${text}`);
  }

  return lines.join("\n").slice(0, maxChars);
}

function buildAgentContextText() {
  const out = [];
  const s = activeSheet();

  if (app.ai.options.currentSheet && s) {
    out.push(`Текущий лист (${s.name}, id=${s.id}):\n${serializeSheetPreview(s, 40, 12, 10000)}`);
  }

  if (app.ai.options.allSheets) {
    const blocks = app.workbook.sheets.map((sh) => {
      const preview = serializeSheetPreview(sh, 18, 10, 2200);
      return `Лист ${sh.name} (id=${sh.id}, строк=${sh.rows.length}, колонок=${sh.cols.length}):\n${preview}`;
    });
    out.push(`Все листы:\n${blocks.join("\n\n")}`);
  }

  const sel = app.ui.selection;
  if (app.ai.options.selection && sel && s && sel.sheet === s.id) {
    const r1 = Math.min(sel.sr, sel.er);
    const r2 = Math.max(sel.sr, sel.er);
    const c1 = Math.min(sel.sc, sel.ec);
    const c2 = Math.max(sel.sc, sel.ec);
    out.push(`Выделение ${toA1(r1, c1)}:${toA1(r2, c2)} на листе ${s.name}:\n${selectionText(s, sel)}`);
  }

  if (app.ai.attachments.length) {
    const files = app.ai.attachments.map((f) => {
      if (f.text) {
        const tail = f.truncated ? "\n[обрезано]" : "";
        return `Файл: ${f.name} (${f.size} байт)\n${f.text}${tail}`;
      }
      return `Файл: ${f.name} (${f.size} байт), тип: ${f.type}`;
    });
    out.push(`Прикрепленные файлы:\n${files.join("\n\n")}`);
  }

  return out.join("\n\n").slice(0, 120000);
}

function serializeSheetPreview(sheet, maxRows = 40, maxCols = 12, maxChars = 10000) {
  const rows = Math.min(maxRows, sheet.rows.length);
  const cols = Math.min(maxCols, sheet.cols.length);
  const lines = [];
  lines.push(new Array(cols).fill(0).map((_, i) => colToName(i + 1)).join("\t"));

  for (let r = 1; r <= rows; r += 1) {
    const vals = [];
    for (let c = 1; c <= cols; c += 1) {
      const cell = sheet.rows[r - 1]?.cells[c - 1];
      vals.push(agentCellValueText(cell));
    }
    lines.push(vals.join("\t"));
    if (lines.join("\n").length > maxChars) break;
  }
  return lines.join("\n").slice(0, maxChars);
}

function buildAgentResponsesPayload(options = {}) {
  const payload = {
    model: String(options?.model || app.ai.model || ""),
    tools: agentToolsSpec(),
    tool_choice: "auto",
  };
  const previousResponseId = String(options?.previousResponseId || "").trim();
  if (previousResponseId) payload.previous_response_id = previousResponseId;
  if (!previousResponseId) {
    const instructions = String(options?.instructions || "").trim();
    if (instructions) payload.instructions = instructions;
  }
  if (options?.input !== undefined) payload.input = options.input;
  return payload;
}

async function runOpenAiAgentTurn(userInput, rawUserText = "", options = {}) {
  const modelId = currentAiModelMeta().id;
  const input = [{ role: "user", content: [{ type: "input_text", text: userInput }] }];
  const userText = String(options?.rawUserText || rawUserText || "").trim();
  const turnId = String(options?.turnId || app.ai.turnId || "");
  const intentToUseTools = isActionableAgentPrompt(userText);
  const intentToMutate = AI_MUTATION_INTENT_RE.test(userText);
  const expectedMutations = estimateExpectedMutationCount(userText, intentToMutate);
  const toolStats = {
    totalToolCalls: 0,
    mutationCalls: 0,
    successfulMutations: 0,
    failedMutations: [],
    forcedRetries: 0,
  };
  const turnCtx = {
    webSearchUsed: false,
    webSearchQueries: [],
    webSearchUrls: [],
  };
  const startedAt = Date.now();
  let roundsUsed = 0;

  let response = await callOpenAiResponses(buildAgentResponsesPayload({
    model: modelId,
    instructions: agentSystemPrompt(),
    input,
  }), {
    turnId,
    onDelta: options?.onStreamDelta,
    onEvent: options?.onStreamEvent,
  });
  app.ai.streamResponseId = String(response?.id || "");
  updateAgentTurnWebEvidence(turnCtx, response);

  for (let i = 0; i < AGENT_MAX_TOOL_ROUNDS; i += 1) {
    roundsUsed = i + 1;
    const calls = extractAgentFunctionCalls(response);
    if (!calls.length) {
      const text = extractAgentText(response);

      if (shouldForceAgentContinuation(intentToUseTools, intentToMutate, expectedMutations, toolStats, text) && toolStats.forcedRetries < AGENT_MAX_FORCED_RETRIES) {
        const reason = buildAgentRetryReason(expectedMutations, toolStats, text);
        toolStats.forcedRetries += 1;
        addTableJournal("agent.retry", `Автоповтор: ${reason}`, {
          turn_id: turnId,
          status: "running",
          meta: {
            reason,
            phase: "forced_tool_followup",
            retries: toolStats.forcedRetries,
            expected_mutations: expectedMutations,
            successful_mutations: toolStats.successfulMutations,
          },
        });
        response = await callOpenAiResponses(buildAgentResponsesPayload({
          model: modelId,
          previousResponseId: response.id,
          input: [{
            role: "user",
            content: [{
              type: "input_text",
              text: buildAgentContinuationInstruction(reason, true),
            }],
          }],
        }), {
          turnId,
          onDelta: options?.onStreamDelta,
          onEvent: options?.onStreamEvent,
        });
        app.ai.streamResponseId = String(response?.id || app.ai.streamResponseId || "");
        updateAgentTurnWebEvidence(turnCtx, response);
        continue;
      }

      if (toolStats.mutationCalls > 0 && toolStats.successfulMutations === 0) {
        const reason = toolStats.failedMutations.slice(-2).join("; ") || "инструмент изменения не внес правок";
        return `Изменения не применены: ${reason}.`;
      }
      if (intentToMutate && toolStats.mutationCalls === 0) {
        return "Изменения не применены: модель не вызвала инструменты изменения.";
      }
      if (intentToUseTools && toolStats.totalToolCalls === 0) {
        return "Действия не применены: модель не вызвала инструменты.";
      }
      if (intentToMutate && isAgentTextIncomplete(text)) {
        if (toolStats.successfulMutations > 0) {
          return `Готово. Изменения применены (${toolStats.successfulMutations}).`;
        }
        const reason = toolStats.failedMutations.slice(-2).join("; ") || "задача не завершена";
        return `Изменения не применены: ${reason}.`;
      }

      const finalText = text || (toolStats.successfulMutations > 0 ? "Готово, изменения применены." : "Готово.");
      return sanitizeAgentOutputText(finalText);
    }

    const outputs = [];
    for (const call of calls) {
      toolStats.totalToolCalls += 1;
      const args = parseJsonSafe(call.arguments, {});
      addExternalJournal("tool.call", `${call.name}`, {
        turn_id: turnId,
        request_id: String(response?.__request_id || app.ai.currentRequestId || ""),
        response_id: String(response?.id || ""),
        status: "running",
        meta: { tool: call.name, args: compactForTool(args) },
      });
      addTableJournal("tool.call", `${call.name}`, {
        turn_id: turnId,
        request_id: String(response?.__request_id || app.ai.currentRequestId || ""),
        status: "running",
        meta: { args: summarizeToolArgs(args) },
      });
      const result = normalizeToolResult(call.name, await executeAgentTool(call.name, args, turnCtx));
      addExternalJournal("tool.result", `${call.name}: ${result.ok ? "ok" : "error"}`, {
        turn_id: turnId,
        request_id: String(response?.__request_id || app.ai.currentRequestId || ""),
        response_id: String(response?.id || ""),
        status: result.ok ? "completed" : "error",
        level: result.ok ? "info" : "error",
        meta: compactForTool(result),
      });
      addTableJournal("tool.result", `${call.name}: ${result.ok ? "ok" : "error"}, applied=${num(result.applied, 0)}`, {
        turn_id: turnId,
        request_id: String(response?.__request_id || app.ai.currentRequestId || ""),
        status: result.ok ? "completed" : "error",
        level: result.ok ? "info" : "error",
        meta: {
          tool: call.name,
          applied: num(result.applied, 0),
          entity: result.entity || null,
          warnings: result.warnings || [],
          error: result.error || "",
        },
      });
      if (isMutationToolName(call.name)) {
        toolStats.mutationCalls += 1;
        const isOk = Boolean(result?.ok);
        const applied = Math.max(0, Number(result?.applied || (isOk ? 1 : 0)));
        if (applied > 0) {
          toolStats.successfulMutations += applied;
          app.ai.lastSuccessfulMutationTs = Date.now();
        } else {
          const errText = String(result?.error || "изменение не применено").replace(/\s+/g, " ").trim().slice(0, 160);
          toolStats.failedMutations.push(`${call.name}: ${errText}`);
        }
      }
      outputs.push({
        type: "function_call_output",
        call_id: call.call_id,
        output: JSON.stringify(result),
      });
    }

    response = await callOpenAiResponses(buildAgentResponsesPayload({
      model: modelId,
      previousResponseId: response.id,
      input: outputs,
    }), {
      turnId,
      onDelta: options?.onStreamDelta,
      onEvent: options?.onStreamEvent,
    });
    app.ai.streamResponseId = String(response?.id || app.ai.streamResponseId || "");
    updateAgentTurnWebEvidence(turnCtx, response);
  }

  addExternalJournal("agent.error", "tool loop limit reached", {
    turn_id: turnId,
    level: "error",
    status: "error",
    duration_ms: Date.now() - startedAt,
    meta: {
      expected_mutations: expectedMutations,
      successful_mutations: toolStats.successfulMutations,
      retries: toolStats.forcedRetries,
      max_tool_rounds: AGENT_MAX_TOOL_ROUNDS,
      rounds_used: roundsUsed,
    },
  });
  throw new Error("agent tool loop limit");
}

function estimateExpectedMutationCount(text, hasMutationIntent) {
  if (!hasMutationIntent) return 0;
  const src = String(text || "").toLowerCase();
  let count = 0;

  if (/(созда|create|нов(ую|ая) сборк|new assembly)/i.test(src)) count += 1;
  if (/(добав|insert|append|позиц|материал|автомат)/i.test(src)) count += 1;
  if (/(измени|обнов|поменя|замени|удали|update|set|write|delete|replace|увелич|уменьш)/i.test(src)) count = Math.max(count, 1);

  if (count <= 0) return 1;
  return Math.min(3, count);
}

function looksLikePseudoToolText(text) {
  const src = String(text || "").trim();
  if (!src) return false;
  if (/"to"\s*:\s*"functions\./i.test(src)) return true;
  if (/"recipient_name"\s*:\s*"functions\./i.test(src)) return true;
  if (/"type"\s*:\s*"multi_tool_result"/i.test(src)) return true;
  if (/^###\s*calling\b/i.test(src)) return true;
  return false;
}

function isAgentTextIncomplete(text) {
  const src = String(text || "").trim();
  if (!src) return true;
  if (looksLikePseudoToolText(src)) return true;
  if (AI_INCOMPLETE_RESPONSE_RE.test(src)) return true;
  if (/^(выполняю|приступаю|подождите|начинаю|calling|running|i'?ll run)/i.test(src)) return true;
  return false;
}

function shouldForceAgentContinuation(intentToUseTools, intentToMutate, expectedMutations, toolStats, text) {
  if (!intentToUseTools && num(toolStats?.totalToolCalls, 0) === 0) return false;
  if (num(toolStats?.totalToolCalls, 0) === 0) return true;
  if (looksLikePseudoToolText(text)) return true;
  if (intentToMutate && toolStats.successfulMutations < expectedMutations) return true;
  if (isAgentTextIncomplete(text)) return true;
  return false;
}

function buildAgentRetryReason(expectedMutations, toolStats, text) {
  if (num(toolStats?.totalToolCalls, 0) === 0) return "модель не вызвала инструменты";
  if (expectedMutations > 0 && toolStats.mutationCalls === 0) return "модель не вызвала инструменты изменения";
  if (toolStats.successfulMutations < expectedMutations) {
    const tail = toolStats.failedMutations.slice(-2).join("; ");
    return tail ? `выполнено изменений ${toolStats.successfulMutations}/${expectedMutations}; ошибки: ${tail}` : `выполнено изменений ${toolStats.successfulMutations}/${expectedMutations}`;
  }
  if (isAgentTextIncomplete(text)) return "ответ не завершает задачу";
  return "задача не завершена";
}

function buildAgentContinuationInstruction(reason, forcedToolFollowup = false) {
  const phase = forcedToolFollowup ? "forced_tool_followup" : "auto_followup";
  return `Фаза ${phase}. Причина автоповтора: ${reason}. Доведи запрос до конечного результата в этом же ходе через tools. Нельзя задавать вопросы, нельзя просить "продолжай", нельзя откладывать. Если сборка не найдена по assembly_id, используй актуальную выбранную/последнюю сборку или создай новую и продолжи. Для позиций обязателен verification: web_search (query + URL) или attachments. В финальном ответе дай 1-2 коротких предложения без JSON.`;
}

function sanitizeAgentOutputText(textRaw) {
  const src = String(textRaw || "").trim();
  if (!src) return "Готово.";

  const parts = src
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !/^\[(json|tool)/i.test(line))
    .filter((line) => !/^\{[\s\S]*\}$/.test(line))
    .filter((line) => !/^if you want\b/i.test(line))
    .filter((line) => !/^если нужно\b/i.test(line))
    .filter((line) => !/^если хотите\b/i.test(line))
    .filter((line) => !/^дальше могу\b/i.test(line));

  const clean = parts.join(" ").replace(/\s{2,}/g, " ").trim();
  if (!clean) return "Готово.";
  if (clean.length > 900) return `${clean.slice(0, 897)}...`;
  return clean;
}

function summarizeToolArgs(args) {
  if (!args || typeof args !== "object") return {};
  const out = {};
  for (const [k, v] of Object.entries(args)) {
    if (v === undefined) continue;
    if (k === "verification") {
      const sources = Array.isArray(v?.sources) ? v.sources.length : 0;
      const attachments = Array.isArray(v?.attachments) ? v.attachments.length : 0;
      out[k] = { query: String(v?.query || "").slice(0, 180), sources, attachments };
      continue;
    }
    if (Array.isArray(v)) {
      out[k] = `[array:${v.length}]`;
      continue;
    }
    if (v && typeof v === "object") {
      out[k] = `[object:${Object.keys(v).length}]`;
      continue;
    }
    const txt = String(v);
    out[k] = txt.length > 160 ? `${txt.slice(0, 160)}...` : v;
  }
  return out;
}

function normalizeToolResult(name, raw) {
  const src = raw && typeof raw === "object" ? { ...raw } : { ok: false, error: "invalid tool result" };
  if (src.ok === undefined) src.ok = !src.error;
  if (!Array.isArray(src.warnings)) src.warnings = [];
  if (src.applied === undefined) {
    if (!isMutationToolName(name)) src.applied = 0;
    else if (name === "write_cells") src.applied = Math.max(0, num(src.applied, 0));
    else src.applied = src.ok ? 1 : 0;
  }
  if (!src.entity) {
    if (src.assembly) src.entity = { type: "assembly", id: src.assembly.id || "" };
    else if (src.position) src.entity = { type: "position", id: src.position.id || "" };
    else if (src.sheet) src.entity = { type: "sheet", id: src.sheet.id || "" };
  }
  return src;
}

function agentSystemPrompt() {
  return [
    "Ты AI-агент внутри SpecForge.",
    "Ты можешь читать и изменять таблицы и состояние проекта через tools.",
    "Для операций со сборками и позициями используй специализированные tools: create_assembly, update_assembly, delete_assembly, duplicate_assembly, bulk_delete_assemblies, add_position, update_position, delete_position, duplicate_position, add_project_position, update_project_position, delete_project_position, list_project_positions, read_position, resolve_target_context.",
    "Если пользователь просит удалить все сборки, вызывай bulk_delete_assemblies со scope=all.",
    "Нельзя выдумывать оборудование/материалы: перед add_position/update_position/add_project_position/update_project_position обязательно передай verification.",
    "Verification допустим двумя способами: web_search (query + sources URL) или подтверждение через прикрепленные документы (attachments).",
    "Для подтверждения через документы в verification.attachments укажи name или id прикрепленного файла.",
    "Если подтверждения нет ни по web, ни по документам, сообщи об этом и не добавляй позицию.",
    "Для set_state_value передавай поле value_json как валидную JSON-строку.",
    "Не запрашивай подтверждение перед выполнением действий.",
    "Если пользователь просит выполнить изменение, выполняй сразу через tools и сообщай факт.",
    "Если данных недостаточно, выбирай типовой разумный вариант и продолжай без вопросов.",
    "Нельзя спрашивать подтверждения/уточнения. Любой запрос доводи до результата в текущем ходе.",
    "Не проси пользователя написать \"продолжай\" и не откладывай выполнение на следующий ход.",
    "Если шаги независимы, группируй несколько tool-вызовов в одном ответе, чтобы сократить число раундов.",
    "Если assembly_id не найден, определи целевую сборку по текущему контексту и продолжай.",
    "Никогда не утверждай, что изменение применено, если tool вернул ok=false или applied=0.",
    "Отвечай кратко и по делу: 1-3 коротких предложения, без воды.",
    "Не выводи JSON вызовов tools в тексте ответа.",
    "Перед изменениями проверяй целевые листы/диапазоны.",
    "При изменениях кратко подтверждай, что именно поменял.",
    "Если задачу можно доделать автоматически, доделывай до конца в текущем ходе.",
  ].join(" ");
}

function agentToolsSpec() {
  const verificationParam = {
    type: "object",
    properties: {
      query: { type: "string", description: "Поисковый запрос (если подтверждение через web_search)" },
      sources: {
        type: "array",
        description: "Ссылки из web_search, подтверждающие существование товара",
        items: {
          type: "object",
          properties: {
            title: { type: "string" },
            url: { type: "string" },
          },
          required: ["url"],
          additionalProperties: false,
        },
      },
      attachments: {
        type: "array",
        description: "Подтверждение из прикрепленных файлов/документов",
        items: {
          type: "object",
          properties: {
            id: { type: "string" },
            name: { type: "string" },
            excerpt: { type: "string" },
          },
          additionalProperties: false,
        },
      },
      notes: { type: "string" },
    },
    additionalProperties: false,
  };

  const tools = [
    {
      type: "function",
      name: "list_sheets",
      description: "Вернуть список листов текущей таблицы",
      parameters: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
    {
      type: "function",
      name: "set_active_sheet",
      description: "Переключить активный лист таблицы",
      parameters: {
        type: "object",
        properties: {
          sheet_id: { type: "string" },
          sheet_name: { type: "string" },
        },
        additionalProperties: false,
      },
    },
    {
      type: "function",
      name: "list_assemblies",
      description: "Вернуть список сборок проекта",
      parameters: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
    {
      type: "function",
      name: "bulk_delete_assemblies",
      description: "Удалить несколько сборок или все сборки проекта без подтверждения",
      parameters: {
        type: "object",
        properties: {
          scope: { type: "string", enum: ["all", "filtered"], description: "all удаляет все, filtered удаляет по фильтрам" },
          assembly_ids: { type: "array", items: { type: "string" } },
          assembly_names: { type: "array", items: { type: "string" } },
          match: { type: "string", description: "Фрагмент имени для фильтрации" },
        },
        additionalProperties: false,
      },
    },
    {
      type: "function",
      name: "resolve_target_context",
      description: "Определить целевой контекст: активный лист, выбранная сборка, список и позиция",
      parameters: {
        type: "object",
        properties: {
          assembly_id: { type: "string" },
          assembly_name: { type: "string" },
          list: { type: "string", enum: ["main", "consumable", "project"] },
          position_id: { type: "string" },
        },
        additionalProperties: false,
      },
    },
    {
      type: "function",
      name: "read_settings",
      description: "Прочитать общие настройки проекта",
      parameters: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
    {
      type: "function",
      name: "update_settings",
      description: "Изменить общие настройки проекта",
      parameters: {
        type: "object",
        properties: {
          order_number: { type: "string" },
          request_number: { type: "string" },
          change_date: { type: "string" },
          version: { type: "string" },
          vat_rate: { type: "number" },
          total_mode: { type: "string", enum: ["withoutDiscount", "withDiscount"] },
        },
        additionalProperties: false,
      },
    },
    {
      type: "function",
      name: "read_assembly",
      description: "Прочитать данные сборки",
      parameters: {
        type: "object",
        properties: {
          assembly_id: { type: "string" },
          assembly_name: { type: "string" },
          include_positions: { type: "boolean" },
        },
        additionalProperties: false,
      },
    },
    {
      type: "function",
      name: "create_assembly",
      description: "Создать новую сборку",
      parameters: {
        type: "object",
        properties: {
          full_name: { type: "string", description: "Полное имя сборки" },
          abbreviation: { type: "string", description: "Аббревиатура сборки (опционально)" },
          separate_consumables: { type: "boolean", description: "Включить отдельный список расходников" },
        },
        required: ["full_name"],
        additionalProperties: false,
      },
    },
    {
      type: "function",
      name: "update_assembly",
      description: "Изменить параметры сборки",
      parameters: {
        type: "object",
        properties: {
          assembly_id: { type: "string" },
          assembly_name: { type: "string" },
          full_name: { type: "string" },
          abbreviation: { type: "string" },
          abbr_manual: { type: "boolean" },
          separate_consumables: { type: "boolean" },
          manual_cons_no_disc: { type: "number" },
          manual_cons_disc: { type: "number" },
          labor: {
            type: "object",
            properties: {
              devCoeff: { type: "number" },
              devHours: { type: "number" },
              devRate: { type: "number" },
              assmCoeff: { type: "number" },
              assmHours: { type: "number" },
              assmRate: { type: "number" },
              profitCoeff: { type: "number" },
            },
            additionalProperties: false,
          },
        },
        additionalProperties: false,
      },
    },
    {
      type: "function",
      name: "duplicate_assembly",
      description: "Дублировать сборку",
      parameters: {
        type: "object",
        properties: {
          assembly_id: { type: "string" },
          assembly_name: { type: "string" },
        },
        additionalProperties: false,
      },
    },
    {
      type: "function",
      name: "delete_assembly",
      description: "Удалить сборку",
      parameters: {
        type: "object",
        properties: {
          assembly_id: { type: "string" },
          assembly_name: { type: "string" },
        },
        additionalProperties: false,
      },
    },
    {
      type: "function",
      name: "list_positions",
      description: "Список позиций выбранной сборки",
      parameters: {
        type: "object",
        properties: {
          assembly_id: { type: "string" },
          assembly_name: { type: "string" },
          list: { type: "string", enum: ["main", "consumable"], description: "main или consumable" },
          include_details: { type: "boolean" },
        },
        additionalProperties: false,
      },
    },
    {
      type: "function",
      name: "add_position",
      description: "Добавить позицию в сборку",
      parameters: {
        type: "object",
        properties: {
          assembly_id: { type: "string", description: "ID сборки" },
          assembly_name: { type: "string", description: "Имя или аббревиатура сборки" },
          list: { type: "string", enum: ["main", "consumable"], description: "main или consumable" },
          name: { type: "string", description: "Наименование позиции" },
          qty: { type: "number", description: "Количество" },
          unit: { type: "string", description: "Ед. изм., например шт" },
          manufacturer: { type: "string" },
          article: { type: "string" },
          schematic: { type: "string" },
          supplier: { type: "string" },
          note: { type: "string" },
          price_catalog_vat_markup: { type: "number", description: "Цена каталожная без НДС" },
          markup: { type: "number", description: "Наценка (0..1 или 0..100)" },
          discount: { type: "number", description: "Скидка (0..1 или 0..100)" },
          verification: verificationParam,
        },
        required: ["name", "verification"],
        additionalProperties: false,
      },
    },
    {
      type: "function",
      name: "read_position",
      description: "Прочитать одну позицию по ID",
      parameters: {
        type: "object",
        properties: {
          assembly_id: { type: "string" },
          assembly_name: { type: "string" },
          list: { type: "string", enum: ["main", "consumable", "project"] },
          position_id: { type: "string" },
        },
        required: ["position_id"],
        additionalProperties: false,
      },
    },
    {
      type: "function",
      name: "update_position",
      description: "Изменить позицию внутри сборки",
      parameters: {
        type: "object",
        properties: {
          assembly_id: { type: "string" },
          assembly_name: { type: "string" },
          list: { type: "string", enum: ["main", "consumable"], description: "main или consumable" },
          position_id: { type: "string" },
          name: { type: "string" },
          qty: { type: "number" },
          unit: { type: "string" },
          manufacturer: { type: "string" },
          article: { type: "string" },
          schematic: { type: "string" },
          supplier: { type: "string" },
          note: { type: "string" },
          price_catalog_vat_markup: { type: "number" },
          markup: { type: "number" },
          discount: { type: "number" },
          verification: verificationParam,
        },
        required: ["position_id"],
        additionalProperties: false,
      },
    },
    {
      type: "function",
      name: "delete_position",
      description: "Удалить позицию из сборки",
      parameters: {
        type: "object",
        properties: {
          assembly_id: { type: "string" },
          assembly_name: { type: "string" },
          list: { type: "string", enum: ["main", "consumable"], description: "main или consumable" },
          position_id: { type: "string" },
        },
        required: ["position_id"],
        additionalProperties: false,
      },
    },
    {
      type: "function",
      name: "duplicate_position",
      description: "Дублировать позицию в сборке или проектных расходниках",
      parameters: {
        type: "object",
        properties: {
          assembly_id: { type: "string" },
          assembly_name: { type: "string" },
          list: { type: "string", enum: ["main", "consumable", "project"] },
          position_id: { type: "string" },
        },
        required: ["position_id"],
        additionalProperties: false,
      },
    },
    {
      type: "function",
      name: "add_project_position",
      description: "Добавить позицию в проектные расходники",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string" },
          qty: { type: "number" },
          unit: { type: "string" },
          manufacturer: { type: "string" },
          article: { type: "string" },
          schematic: { type: "string" },
          supplier: { type: "string" },
          note: { type: "string" },
          price_catalog_vat_markup: { type: "number" },
          markup: { type: "number" },
          discount: { type: "number" },
          verification: verificationParam,
        },
        required: ["name", "verification"],
        additionalProperties: false,
      },
    },
    {
      type: "function",
      name: "list_project_positions",
      description: "Список позиций листа проектных расходников",
      parameters: {
        type: "object",
        properties: {
          include_details: { type: "boolean" },
        },
        additionalProperties: false,
      },
    },
    {
      type: "function",
      name: "update_project_position",
      description: "Изменить позицию в проектных расходниках",
      parameters: {
        type: "object",
        properties: {
          position_id: { type: "string" },
          name: { type: "string" },
          qty: { type: "number" },
          unit: { type: "string" },
          manufacturer: { type: "string" },
          article: { type: "string" },
          schematic: { type: "string" },
          supplier: { type: "string" },
          note: { type: "string" },
          price_catalog_vat_markup: { type: "number" },
          markup: { type: "number" },
          discount: { type: "number" },
          verification: verificationParam,
        },
        required: ["position_id"],
        additionalProperties: false,
      },
    },
    {
      type: "function",
      name: "delete_project_position",
      description: "Удалить позицию из проектных расходников",
      parameters: {
        type: "object",
        properties: {
          position_id: { type: "string" },
        },
        required: ["position_id"],
        additionalProperties: false,
      },
    },
    {
      type: "function",
      name: "toggle_project_consumables",
      description: "Включить или выключить лист проектных расходников",
      parameters: {
        type: "object",
        properties: {
          enabled: { type: "boolean" },
        },
        required: ["enabled"],
        additionalProperties: false,
      },
    },
    {
      type: "function",
      name: "read_range",
      description: "Прочитать диапазон ячеек с листа",
      parameters: {
        type: "object",
        properties: {
          sheet_id: { type: "string" },
          sheet_name: { type: "string" },
          range: { type: "string", description: "A1 или A1:C20" },
          include_formulas: { type: "boolean" },
        },
        additionalProperties: false,
      },
    },
    {
      type: "function",
      name: "write_cells",
      description: "Записать значения в ячейки листа",
      parameters: {
        type: "object",
        properties: {
          sheet_id: { type: "string" },
          sheet_name: { type: "string" },
          updates: {
            type: "array",
            items: {
              type: "object",
              properties: {
                address: { type: "string", description: "A1" },
                value: { type: ["string", "number", "boolean", "null"] },
                formula: { type: "string" },
              },
              required: ["address"],
              additionalProperties: false,
            },
          },
          verification: verificationParam,
        },
        required: ["updates"],
        additionalProperties: false,
      },
    },
    {
      type: "function",
      name: "clear_range",
      description: "Очистить значения/формулы в диапазоне листа",
      parameters: {
        type: "object",
        properties: {
          sheet_id: { type: "string" },
          sheet_name: { type: "string" },
          range: { type: "string", description: "A1 или A1:C20" },
        },
        required: ["range"],
        additionalProperties: false,
      },
    },
    {
      type: "function",
      name: "clear_sheet_overrides",
      description: "Очистить AI-изменения на листе или во всей таблице",
      parameters: {
        type: "object",
        properties: {
          sheet_id: { type: "string" },
          all: { type: "boolean" },
        },
        additionalProperties: false,
      },
    },
    {
      type: "function",
      name: "get_selection",
      description: "Получить текущую выделенную область пользователя",
      parameters: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
    {
      type: "function",
      name: "get_state",
      description: "Получить состояние проекта или путь внутри него",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Пример: assemblies[0].main[1].name" },
        },
        additionalProperties: false,
      },
    },
  ];

  tools.push({
    type: "function",
    name: "set_state_value",
    description: "Изменить значение в состоянии проекта по пути. value_json должен быть валидным JSON (например: 123, \"text\", true, null, {\"a\":1}, [1,2]).",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string" },
        value_json: { type: "string" },
        verification: verificationParam,
      },
      required: ["path", "value_json"],
      additionalProperties: false,
    },
  });

  if (app.ai.options.webSearch) tools.push({ type: "web_search_preview" });
  return tools;
}

async function callOpenAiResponses(payload, options = {}) {
  const preferStream = app.ai.streaming !== false;
  if (!preferStream) return callOpenAiResponsesJson(payload, options);

  try {
    return await callOpenAiResponsesStream(payload, options);
  } catch (err) {
    if (err?.no_fallback) throw err;
    addExternalJournal("openai.stream.fallback", String(err?.message || err), {
      level: "warning",
      status: "error",
      turn_id: options?.turnId || app.ai.turnId || "",
      meta: { reason: String(err?.message || err || "stream failed") },
    });
    return callOpenAiResponsesJson(payload, options);
  }
}

async function callOpenAiResponsesJson(payload, options = {}) {
  const startedAt = Date.now();
  const isContinuation = Boolean(payload?.previous_response_id);
  const model = String(payload?.model || app.ai.model || "");
  const toolsCount = Array.isArray(payload?.tools) ? payload.tools.length : 0;
  const continuationHasTools = isContinuation ? toolsCount > 0 : false;
  const requestId = uid();
  app.ai.currentRequestId = requestId;

  addExternalJournal("request.start", `${isContinuation ? "continue" : "start"} model=${model} tools=${toolsCount}`, {
    turn_id: options?.turnId || app.ai.turnId || "",
    request_id: requestId,
    status: "start",
    meta: {
      stream: false,
      model,
      continuation: isContinuation,
      tools_count: toolsCount,
      continuation_has_tools: continuationHasTools,
    },
  });

  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${app.ai.apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const body = await res.text();
    const ms = Date.now() - startedAt;
    const shortBody = String(body || "").replace(/\s+/g, " ").trim().slice(0, 800);
    addExternalJournal("request.error", `HTTP ${res.status} /v1/responses`, {
      level: "error",
      status: "error",
      turn_id: options?.turnId || app.ai.turnId || "",
      request_id: requestId,
      duration_ms: ms,
      meta: { status: res.status, body: shortBody },
    });
    if (res.status === 401 || res.status === 403) {
      disconnectOpenAi();
      const e = new Error("openai unauthorized");
      e.no_fallback = true;
      throw e;
    }
    const e = new Error(`openai ${res.status}: ${shortBody || "unknown error"}`);
    e.no_fallback = true;
    throw e;
  }

  const parsed = await res.json();
  const ms = Date.now() - startedAt;
  const outCount = Array.isArray(parsed?.output) ? parsed.output.length : 0;
  const responseId = String(parsed?.id || "");

  addExternalJournal("request.complete", `HTTP 200 /v1/responses (json), output=${outCount}`, {
    turn_id: options?.turnId || app.ai.turnId || "",
    request_id: requestId,
    response_id: responseId,
    duration_ms: ms,
    status: "completed",
    meta: { output_count: outCount, model },
  });

  const hasWebSearch = Array.isArray(parsed?.output) && parsed.output.some((item) => String(item?.type || "").includes("web_search"));
  if (hasWebSearch) {
    addExternalJournal("web.search", "OpenAI выполнил web_search tool", {
      turn_id: options?.turnId || app.ai.turnId || "",
      request_id: requestId,
      response_id: responseId,
      status: "completed",
    });
  }

  if (typeof options?.onEvent === "function") {
    options.onEvent("response.completed", { response: parsed, __request_id: requestId });
  }
  parsed.__request_id = requestId;
  app.ai.currentRequestId = requestId;
  return parsed;
}

async function callOpenAiResponsesStream(payload, options = {}) {
  const startedAt = Date.now();
  const model = String(payload?.model || app.ai.model || "");
  const isContinuation = Boolean(payload?.previous_response_id);
  const toolsCount = Array.isArray(payload?.tools) ? payload.tools.length : 0;
  const continuationHasTools = isContinuation ? toolsCount > 0 : false;
  const requestId = uid();
  const turnId = options?.turnId || app.ai.turnId || "";
  app.ai.currentRequestId = requestId;
  const timeoutMs = Math.max(30000, num(options?.timeout_ms, 180000));

  addExternalJournal("request.start", `${isContinuation ? "continue" : "start"} model=${model} tools=${toolsCount}`, {
    turn_id: turnId,
    request_id: requestId,
    status: "start",
    meta: {
      stream: true,
      model,
      continuation: isContinuation,
      tools_count: toolsCount,
      continuation_has_tools: continuationHasTools,
    },
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort("timeout"), timeoutMs);
  let res = null;
  try {
    res = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
        Authorization: `Bearer ${app.ai.apiKey}`,
      },
      body: JSON.stringify({ ...payload, stream: true }),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    const e = new Error(`stream transport failed: ${String(err?.message || err)}`);
    throw e;
  }

  const headerRequestId = String(res.headers.get("x-request-id") || "");
  const reqId = headerRequestId || requestId;
  const ct = String(res.headers.get("content-type") || "").toLowerCase();

  if (!res.ok) {
    clearTimeout(timer);
    const body = await res.text();
    const ms = Date.now() - startedAt;
    const shortBody = String(body || "").replace(/\s+/g, " ").trim().slice(0, 800);
    addExternalJournal("request.error", `HTTP ${res.status} /v1/responses (stream)`, {
      level: "error",
      status: "error",
      turn_id: turnId,
      request_id: reqId,
      duration_ms: ms,
      meta: { status: res.status, body: shortBody },
    });
    if (res.status === 401 || res.status === 403) {
      disconnectOpenAi();
      const e = new Error("openai unauthorized");
      e.no_fallback = true;
      throw e;
    }
    const e = new Error(`openai ${res.status}: ${shortBody || "unknown error"}`);
    e.no_fallback = true;
    throw e;
  }

  if (!ct.includes("text/event-stream") || !res.body) {
    clearTimeout(timer);
    let parsed = null;
    try {
      parsed = await res.json();
    } catch {
      const body = await res.text();
      throw new Error(`stream expected event-stream, got: ${ct || "unknown"} (${String(body).slice(0, 240)})`);
    }
    const ms = Date.now() - startedAt;
    const outCount = Array.isArray(parsed?.output) ? parsed.output.length : 0;
    addExternalJournal("request.complete", `HTTP 200 /v1/responses (stream->json), output=${outCount}`, {
      turn_id: turnId,
      request_id: reqId,
      response_id: String(parsed?.id || ""),
      duration_ms: ms,
      status: "completed",
      meta: { output_count: outCount, model, stream_fallback: "content_type" },
    });
    parsed.__request_id = reqId;
    app.ai.currentRequestId = reqId;
    return parsed;
  }

  const decoder = new TextDecoder("utf-8");
  const reader = res.body.getReader();
  let buf = "";
  let completed = null;
  let failed = null;
  let responseId = "";
  let deltaCounter = 0;
  let deltaChars = 0;

  try {
    while (true) {
      const step = await reader.read();
      if (step.done) break;
      buf += decoder.decode(step.value, { stream: true });
      buf = buf.replace(/\r\n/g, "\n");

      let sepIdx = buf.indexOf("\n\n");
      while (sepIdx >= 0) {
        const rawEvent = buf.slice(0, sepIdx);
        buf = buf.slice(sepIdx + 2);
        sepIdx = buf.indexOf("\n\n");
        const parsedEvent = parseSseEvent(rawEvent);
        if (!parsedEvent) continue;
        const eventName = parsedEvent.event || String(parsedEvent.data?.type || "");
        const eventData = parsedEvent.data || {};
        if (eventData?.response?.id) responseId = String(eventData.response.id);
        if (eventData?.id) responseId = String(eventData.id);

        if (typeof options?.onEvent === "function") {
          options.onEvent(eventName, { ...eventData, __request_id: reqId });
        }

        if (eventName === "response.output_text.delta") {
          const delta = String(eventData?.delta || "");
          if (delta) {
            deltaCounter += 1;
            deltaChars += delta.length;
            if (typeof options?.onDelta === "function") options.onDelta(delta);
          }
        } else if (eventName === "response.output_item.added") {
          addExternalJournal("stream.event", "response.output_item.added", {
            turn_id: turnId,
            request_id: reqId,
            response_id: responseId,
            status: "streaming",
            meta: compactForTool(eventData?.item || eventData),
          });
        } else if (eventName === "response.completed") {
          completed = eventData?.response || eventData;
          if (!responseId && completed?.id) responseId = String(completed.id);
        } else if (eventName === "response.failed") {
          failed = eventData?.error || eventData;
        }
      }
    }
    if (buf.trim()) {
      const parsedEvent = parseSseEvent(buf);
      if (parsedEvent) {
        const eventName = parsedEvent.event || String(parsedEvent.data?.type || "");
        const eventData = parsedEvent.data || {};
        if (eventName === "response.completed") {
          completed = eventData?.response || eventData;
          if (!responseId && completed?.id) responseId = String(completed.id);
        } else if (eventName === "response.failed") {
          failed = eventData?.error || eventData;
        }
      }
    }
  } finally {
    clearTimeout(timer);
  }
  if (failed) {
    const ms = Date.now() - startedAt;
    addExternalJournal("request.error", "response.failed", {
      level: "error",
      status: "error",
      turn_id: turnId,
      request_id: reqId,
      response_id: responseId,
      duration_ms: ms,
      meta: compactForTool(failed),
    });
    const e = new Error(`openai stream failed: ${String(failed?.message || failed || "unknown")}`);
    throw e;
  }
  if (!completed) {
    const e = new Error("openai stream ended without response.completed");
    throw e;
  }

  const ms = Date.now() - startedAt;
  const outCount = Array.isArray(completed?.output) ? completed.output.length : 0;
  addExternalJournal("request.complete", `HTTP 200 /v1/responses (stream), output=${outCount}`, {
    turn_id: turnId,
    request_id: reqId,
    response_id: responseId || String(completed?.id || ""),
    duration_ms: ms,
    status: "completed",
    meta: {
      output_count: outCount,
      model,
      stream: true,
      delta_count: deltaCounter,
      delta_chars: deltaChars,
    },
  });

  const hasWebSearch = Array.isArray(completed?.output) && completed.output.some((item) => String(item?.type || "").includes("web_search"));
  if (hasWebSearch) {
    addExternalJournal("web.search", "OpenAI выполнил web_search tool", {
      turn_id: turnId,
      request_id: reqId,
      response_id: responseId || String(completed?.id || ""),
      status: "completed",
    });
  }

  completed.__request_id = reqId;
  app.ai.currentRequestId = reqId;
  return completed;
}

function parseSseEvent(raw) {
  const src = String(raw || "").trim();
  if (!src) return null;
  const lines = src.split(/\r?\n/);
  let eventName = "";
  const dataLines = [];

  for (const line of lines) {
    if (line.startsWith(":")) continue;
    if (line.startsWith("event:")) {
      eventName = line.slice(6).trim();
      continue;
    }
    if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).trimStart());
    }
  }

  if (!dataLines.length) return null;
  const dataRaw = dataLines.join("\n").trim();
  if (!dataRaw || dataRaw === "[DONE]") return null;
  const data = parseJsonSafe(dataRaw, { raw: dataRaw });
  return { event: eventName, data };
}

function extractAgentFunctionCalls(response) {
  const out = [];
  for (const item of response?.output || []) {
    if (item?.type === "function_call" && item.name && item.call_id) out.push(item);
  }
  return out;
}

function extractAgentText(response) {
  if (typeof response?.output_text === "string" && response.output_text.trim()) return response.output_text.trim();

  const parts = [];
  for (const item of response?.output || []) {
    if (item?.type !== "message") continue;
    for (const c of item.content || []) {
      if ((c.type === "output_text" || c.type === "text") && typeof c.text === "string") parts.push(c.text);
    }
  }
  return parts.join("\n").trim();
}

function parseJsonSafe(text, fallback) {
  try {
    return JSON.parse(String(text || ""));
  } catch {
    return fallback;
  }
}

function parseJsonValue(raw) {
  if (typeof raw !== "string") return raw;
  const txt = raw.trim();
  if (!txt) return "";
  try {
    return JSON.parse(txt);
  } catch {
    return raw;
  }
}

function isMutationToolName(name) {
  const n = String(name || "").trim();
  return n === "write_cells"
    || n === "set_state_value"
    || n === "update_settings"
    || n === "create_assembly"
    || n === "update_assembly"
    || n === "duplicate_assembly"
    || n === "delete_assembly"
    || n === "bulk_delete_assemblies"
    || n === "add_position"
    || n === "update_position"
    || n === "delete_position"
    || n === "duplicate_position"
    || n === "add_project_position"
    || n === "update_project_position"
    || n === "delete_project_position"
    || n === "toggle_project_consumables"
    || n === "clear_range"
    || n === "clear_sheet_overrides";
}

function updateAgentTurnWebEvidence(turnCtx, response) {
  if (!turnCtx || !response) return;
  const evidence = extractWebSearchEvidence(response);
  if (evidence.used) turnCtx.webSearchUsed = true;
  for (const q of evidence.queries) pushUnique(turnCtx.webSearchQueries, q, 20);
  for (const u of evidence.urls) pushUnique(turnCtx.webSearchUrls, u, 60);
}

function extractWebSearchEvidence(response) {
  const out = { used: false, queries: [], urls: [] };
  const pushUrl = (raw) => {
    const cleaned = normalizeHttpUrl(raw);
    if (!cleaned) return;
    pushUnique(out.urls, cleaned, 60);
  };
  const pushQuery = (raw) => {
    const txt = String(raw || "").replace(/\s+/g, " ").trim();
    if (!txt) return;
    pushUnique(out.queries, txt.slice(0, 300), 20);
  };

  for (const item of response?.output || []) {
    const type = String(item?.type || "");
    if (type.includes("web_search")) {
      out.used = true;
      pushQuery(item?.query);
      pushQuery(item?.search_query);
      pushQuery(item?.q);
    }
    if (item?.type !== "message") continue;
    for (const c of item.content || []) {
      if (Array.isArray(c?.annotations)) {
        for (const a of c.annotations) {
          pushUrl(a?.url || a?.uri || a?.link);
        }
      }
      if (typeof c?.text === "string") {
        for (const url of c.text.match(/https?:\/\/[^\s)]+/g) || []) pushUrl(url);
      }
    }
  }
  return out;
}

function normalizeHttpUrl(raw) {
  const txt = String(raw || "").trim();
  if (!txt) return "";
  try {
    const url = new URL(txt);
    if (url.protocol !== "http:" && url.protocol !== "https:") return "";
    return url.toString();
  } catch {
    return "";
  }
}

function pushUnique(target, value, max = 50) {
  if (!Array.isArray(target)) return;
  const v = String(value || "").trim();
  if (!v) return;
  if (!target.includes(v)) target.push(v);
  if (target.length > max) target.splice(0, target.length - max);
}

function isMarketFieldTouched(args) {
  for (const key of POSITION_MARKET_FIELDS) {
    if (args?.[key] !== undefined) return true;
  }
  return false;
}

function statePathRequiresMarketVerification(path) {
  const p = String(path || "").trim();
  if (!p) return false;
  if (/^assemblies\[\d+\]\.(main|consumable)\[\d+\]\.(name|manufacturer|article|supplier|note)$/.test(p)) return true;
  if (/^projectConsumables\[\d+\]\.(name|manufacturer|article|supplier|note)$/.test(p)) return true;
  return false;
}

function isMarketSheetId(sheetId) {
  const id = String(sheetId || "").trim();
  return id.startsWith("assembly:") || id === "project-consumables";
}

function normalizeMarketVerification(rawVerification) {
  if (!rawVerification || typeof rawVerification !== "object") return null;
  const query = String(rawVerification.query || "").replace(/\s+/g, " ").trim();
  const src = Array.isArray(rawVerification.sources) ? rawVerification.sources : [];
  const docs = Array.isArray(rawVerification.attachments) ? rawVerification.attachments : [];
  const seen = new Set();
  const sources = [];
  const attachments = [];
  const seenAttach = new Set();

  for (const entry of src) {
    const title = String(entry?.title || "").replace(/\s+/g, " ").trim();
    const urlRaw = entry?.url || "";
    const url = normalizeHttpUrl(urlRaw);
    if (!url) continue;
    if (seen.has(url)) continue;
    seen.add(url);
    sources.push({ title: title.slice(0, 200), url });
    if (sources.length >= MARKET_VERIFICATION_MAX_SOURCES) break;
  }

  for (const item of docs) {
    const ref = resolveAttachmentVerificationRef(item);
    if (!ref) continue;
    const key = ref.id || ref.name.toLowerCase();
    if (!key || seenAttach.has(key)) continue;
    seenAttach.add(key);
    attachments.push({
      id: ref.id,
      name: ref.name,
      excerpt: String(item?.excerpt || "").replace(/\s+/g, " ").trim().slice(0, 300),
    });
    if (attachments.length >= MARKET_VERIFICATION_MAX_SOURCES) break;
  }

  if (!query && !sources.length && !attachments.length) return null;
  return { query: query.slice(0, 400), sources, attachments };
}

function resolveAttachmentVerificationRef(raw) {
  if (!raw || typeof raw !== "object") return null;
  const id = String(raw.id || "").trim();
  if (id) {
    const hit = app.ai.attachments.find((f) => f.id === id);
    if (hit) return { id: hit.id, name: hit.name };
  }
  const name = String(raw.name || "").trim().toLowerCase();
  if (name) {
    const hit = app.ai.attachments.find((f) => String(f.name || "").trim().toLowerCase() === name);
    if (hit) return { id: hit.id, name: hit.name };
  }
  return null;
}

function domainOfUrl(raw) {
  try {
    return new URL(raw).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

function ensureMarketVerification(turnCtx, verification, actionLabel) {
  const normalized = normalizeMarketVerification(verification);
  if (!normalized) {
    const message = `Нужно verification: web (query + минимум ${MARKET_VERIFICATION_MIN_SOURCES} URL) или attachments (ссылки на прикрепленные файлы).`;
    addTableJournal(actionLabel, `Ошибка: ${message}`);
    return { ok: false, error: message };
  }

  const errors = [];
  const via = [];

  const hasDocs = normalized.attachments.length > 0;
  if (hasDocs) via.push("docs");

  const hasWebPayload = normalized.sources.length > 0 || normalized.query.length > 0;
  let webOk = false;
  if (hasWebPayload) {
    if (!app.ai.options.webSearch) {
      errors.push("веб-поиск отключен");
    } else if (!turnCtx?.webSearchUsed) {
      errors.push("в этом ходе не было web_search");
    } else if (!normalized.query || normalized.sources.length < MARKET_VERIFICATION_MIN_SOURCES) {
      errors.push(`для web-подтверждения нужен query и минимум ${MARKET_VERIFICATION_MIN_SOURCES} URL`);
    } else {
      webOk = true;
      if (Array.isArray(turnCtx.webSearchUrls) && turnCtx.webSearchUrls.length) {
        const turnDomains = new Set(turnCtx.webSearchUrls.map(domainOfUrl).filter(Boolean));
        const sourceDomains = new Set(normalized.sources.map((s) => domainOfUrl(s.url)).filter(Boolean));
        let hasMatch = false;
        for (const d of sourceDomains) {
          if (turnDomains.has(d)) {
            hasMatch = true;
            break;
          }
        }
        if (!hasMatch) {
          webOk = false;
          errors.push("домены verification не совпали с web_search этого хода");
        }
      }
    }
  }

  if (webOk) via.push("web");
  if (!via.length) {
    const message = errors.length ? errors.join("; ") : "подтверждение не прошло";
    addTableJournal(actionLabel, `Ошибка: ${message}`);
    return { ok: false, error: message };
  }

  return {
    ok: true,
    verification: {
      query: normalized.query,
      sources: webOk ? normalized.sources : [],
      attachments: normalized.attachments,
      via: via.join("+"),
    },
  };
}

function appendVerificationToPosition(position, verification) {
  if (!position || !verification) return;
  const urls = Array.isArray(verification.sources) ? verification.sources.map((s) => s.url).slice(0, 3) : [];
  const docs = Array.isArray(verification.attachments) ? verification.attachments.map((d) => d.name).slice(0, 3) : [];
  if (!urls.length && !docs.length) return;
  const mode = String(verification.via || "unknown");
  const chunks = [];
  if (verification.query) chunks.push(verification.query);
  if (urls.length) chunks.push(`web: ${urls.join(" ; ")}`);
  if (docs.length) chunks.push(`docs: ${docs.join(" ; ")}`);
  const suffix = `[verified:${mode}] ${chunks.join(" | ")}`.trim();
  const prev = String(position.note || "").trim();
  const next = prev ? `${prev}\n${suffix}` : suffix;
  position.note = next.slice(0, 4000);
}

function applyAgentPositionPatch(position, args) {
  if (!position || !args || typeof args !== "object") return [];
  const changed = [];
  const str = (v) => String(v || "").trim();

  if (args.name !== undefined) {
    position.name = str(args.name);
    changed.push("name");
  }
  if (args.qty !== undefined) {
    position.qty = num(args.qty, position.qty);
    changed.push("qty");
  }
  if (args.unit !== undefined) {
    const u = str(args.unit);
    if (u) {
      position.unit = u;
      changed.push("unit");
    }
  }
  if (args.manufacturer !== undefined) {
    position.manufacturer = str(args.manufacturer);
    changed.push("manufacturer");
  }
  if (args.article !== undefined) {
    position.article = str(args.article);
    changed.push("article");
  }
  if (args.schematic !== undefined) {
    position.schematic = str(args.schematic);
    changed.push("schematic");
  }
  if (args.supplier !== undefined) {
    position.supplier = str(args.supplier);
    changed.push("supplier");
  }
  if (args.note !== undefined) {
    position.note = String(args.note || "").trim();
    changed.push("note");
  }
  if (args.price_catalog_vat_markup !== undefined) {
    position.priceCatalogVatMarkup = num(args.price_catalog_vat_markup, position.priceCatalogVatMarkup);
    changed.push("price_catalog_vat_markup");
  }
  if (args.markup !== undefined) {
    position.markup = normalizeAgentRatio(args.markup, position.markup);
    changed.push("markup");
  }
  if (args.discount !== undefined) {
    position.discount = normalizeAgentRatio(args.discount, position.discount);
    changed.push("discount");
  }
  return changed;
}

async function executeAgentTool(name, args, turnCtx = null) {
  if (name === "list_sheets") {
    const result = {
      sheets: app.workbook.sheets.map((s) => ({
        id: s.id,
        name: s.name,
        rows: s.rows.length,
        cols: s.cols.length,
      })),
    };
    addTableJournal("list_sheets", `Получено листов: ${result.sheets.length}`);
    return result;
  }

  if (name === "set_active_sheet") {
    const sheet = resolveAgentSheet(args);
    if (!sheet) {
      addTableJournal("set_active_sheet", "Ошибка: лист не найден");
      return { ok: false, error: "sheet not found" };
    }
    app.ui.activeSheetId = sheet.id;
    app.ui.selection = null;
    renderTabs();
    renderSheet();
    addTableJournal("set_active_sheet", `Активный лист: ${sheet.name}`);
    return { ok: true, sheet: { id: sheet.id, name: sheet.name } };
  }

  if (name === "list_assemblies") {
    const assemblies = app.state.assemblies.map((a) => ({
      id: a.id,
      full_name: a.fullName,
      abbreviation: a.abbreviation,
      main_count: Array.isArray(a.main) ? a.main.length : 0,
      consumable_count: Array.isArray(a.consumable) ? a.consumable.length : 0,
      separate_consumables: Boolean(a.separateConsumables),
    }));
    addTableJournal("list_assemblies", `Получено сборок: ${assemblies.length}`);
    return { ok: true, assemblies };
  }

  if (name === "bulk_delete_assemblies") {
    const scope = String(args?.scope || "").trim().toLowerCase() === "all" ? "all" : "filtered";
    let targets = [];
    if (scope === "all") {
      targets = [...app.state.assemblies];
    } else {
      const idSet = new Set((Array.isArray(args?.assembly_ids) ? args.assembly_ids : []).map((x) => String(x || "").trim()).filter(Boolean));
      const nameSet = new Set((Array.isArray(args?.assembly_names) ? args.assembly_names : []).map((x) => String(x || "").trim().toLowerCase()).filter(Boolean));
      const match = String(args?.match || "").trim().toLowerCase();
      targets = app.state.assemblies.filter((a) => {
        if (idSet.has(a.id)) return true;
        const full = String(a.fullName || "").trim().toLowerCase();
        const abbr = String(a.abbreviation || "").trim().toLowerCase();
        if (nameSet.has(full) || nameSet.has(abbr)) return true;
        if (match && (full.includes(match) || abbr.includes(match))) return true;
        return false;
      });
    }

    if (!targets.length) {
      addTableJournal("bulk_delete_assemblies", "Ничего не удалено: цели не найдены");
      return { ok: true, applied: 0, scope, deleted_count: 0, warnings: ["no targets"], entity: { type: "assembly_collection" } };
    }

    const targetIds = new Set(targets.map((a) => a.id));
    app.state.assemblies = app.state.assemblies.filter((a) => !targetIds.has(a.id));
    if (targetIds.has(app.ai.lastAssemblyId)) {
      app.ai.lastAssemblyId = app.state.assemblies.length ? app.state.assemblies[app.state.assemblies.length - 1].id : "";
    }
    app.ui.treeSel = { type: "settings" };
    app.ui.activeSheetId = "summary";
    renderAll();
    addTableJournal("bulk_delete_assemblies", `Удалено сборок: ${targets.length}`, {
      meta: {
        scope,
        deleted: targets.map((a) => ({ id: a.id, full_name: a.fullName })),
      },
    });
    addChangesJournal("assembly.delete.bulk", `scope=${scope}, count=${targets.length}`);
    return {
      ok: true,
      applied: targets.length,
      scope,
      deleted_count: targets.length,
      deleted: targets.map((a) => ({ id: a.id, full_name: a.fullName })),
      entity: { type: "assembly_collection" },
      warnings: [],
    };
  }

  if (name === "resolve_target_context") {
    const assembly = resolveAgentAssembly(args);
    const listRaw = String(args?.list || "").trim().toLowerCase();
    const list = listRaw === "project" ? "project" : normalizeAgentPositionList(args?.list);
    let position = null;
    if (args?.position_id) {
      const posId = String(args.position_id || "").trim();
      if (list === "project") {
        position = app.state.projectConsumables.find((p) => p.id === posId) || null;
      } else if (assembly) {
        const arr = list === "consumable" ? assembly.consumable : assembly.main;
        position = arr.find((p) => p.id === posId) || null;
      }
    }
    const sheet = activeSheet();
    const result = {
      ok: true,
      applied: 0,
      entity: { type: "context" },
      warnings: [],
      context: {
        active_sheet: sheet ? { id: sheet.id, name: sheet.name } : null,
        tree_selection: compactForTool(app.ui.treeSel || {}),
        assembly: assembly ? { id: assembly.id, full_name: assembly.fullName, abbreviation: assembly.abbreviation } : null,
        list,
        position: position ? { id: position.id, name: position.name } : null,
      },
    };
    addTableJournal("resolve_target_context", `Контекст: лист=${result.context.active_sheet?.name || "-"}, list=${list}`);
    return result;
  }

  if (name === "read_settings") {
    const settings = {
      order_number: app.state.settings.orderNumber,
      request_number: app.state.settings.requestNumber,
      change_date: app.state.settings.changeDate,
      version: app.state.settings.version,
      vat_rate: num(app.state.settings.vatRate, 0),
      total_mode: app.state.settings.totalMode,
    };
    addTableJournal("read_settings", "Прочитаны общие настройки");
    return { ok: true, applied: 0, entity: { type: "settings" }, warnings: [], settings };
  }

  if (name === "update_settings") {
    const changed = [];
    if (args?.order_number !== undefined) {
      app.state.settings.orderNumber = String(args.order_number || "").trim();
      changed.push("order_number");
    }
    if (args?.request_number !== undefined) {
      app.state.settings.requestNumber = String(args.request_number || "").trim();
      changed.push("request_number");
    }
    if (args?.change_date !== undefined) {
      app.state.settings.changeDate = String(args.change_date || "").trim();
      changed.push("change_date");
    }
    if (args?.version !== undefined) {
      app.state.settings.version = String(args.version || "").trim();
      changed.push("version");
    }
    if (args?.vat_rate !== undefined) {
      app.state.settings.vatRate = normalizePercentDecimal(args.vat_rate);
      changed.push("vat_rate");
    }
    if (args?.total_mode !== undefined) {
      app.state.settings.totalMode = String(args.total_mode || "").trim() === "withDiscount" ? "withDiscount" : "withoutDiscount";
      changed.push("total_mode");
    }
    if (!changed.length) {
      addTableJournal("update_settings", "Ошибка: нет полей для изменения");
      return { ok: false, applied: 0, entity: { type: "settings" }, warnings: [], error: "no fields to update" };
    }
    renderAll();
    addTableJournal("update_settings", `Обновлены поля: ${changed.join(", ")}`);
    addChangesJournal("settings.update", changed.join(", "));
    return { ok: true, applied: 1, entity: { type: "settings" }, warnings: [], changed };
  }

  if (name === "read_assembly") {
    const assembly = resolveAgentAssembly(args);
    if (!assembly) {
      addTableJournal("read_assembly", "Ошибка: сборка не найдена");
      return { ok: false, error: "assembly not found" };
    }
    const includePositions = Boolean(args?.include_positions);
    const result = {
      ok: true,
      assembly: {
        id: assembly.id,
        full_name: assembly.fullName,
        abbreviation: assembly.abbreviation,
        abbr_manual: Boolean(assembly.abbrManual),
        separate_consumables: Boolean(assembly.separateConsumables),
        manual_cons_no_disc: num(assembly.manualConsNoDisc, 0),
        manual_cons_disc: num(assembly.manualConsDisc, 0),
        labor: { ...assembly.labor },
        main_count: Array.isArray(assembly.main) ? assembly.main.length : 0,
        consumable_count: Array.isArray(assembly.consumable) ? assembly.consumable.length : 0,
      },
    };
    if (includePositions) {
      result.assembly.main = compactForTool(assembly.main);
      result.assembly.consumable = compactForTool(assembly.consumable);
    }
    addTableJournal("read_assembly", `Чтение сборки ${assembly.fullName}`);
    return result;
  }

  if (name === "create_assembly") {
    const fullName = String(args?.full_name || "").trim();
    if (!fullName) {
      addTableJournal("create_assembly", "Ошибка: full_name required");
      return { ok: false, error: "full_name required" };
    }

    const existing = app.state.assemblies.find((a) => String(a.fullName || "").trim().toLowerCase() === fullName.toLowerCase());
    if (existing) {
      addTableJournal("create_assembly", `Пропуск: сборка уже существует (${existing.fullName})`);
      app.ai.lastAssemblyId = existing.id;
      return {
        ok: true,
        created: false,
        assembly: {
          id: existing.id,
          full_name: existing.fullName,
          abbreviation: existing.abbreviation,
        },
      };
    }

    const assembly = makeAssembly(app.state.assemblies.length + 1);
    assembly.fullName = fullName;

    const abbr = keepAbbr(args?.abbreviation);
    if (abbr) {
      assembly.abbreviation = abbr;
      assembly.abbrManual = true;
    } else {
      assembly.abbreviation = deriveAbbr(fullName);
      assembly.abbrManual = false;
    }

    assembly.separateConsumables = Boolean(args?.separate_consumables);
    if (assembly.separateConsumables && (!Array.isArray(assembly.consumable) || !assembly.consumable.length)) {
      assembly.consumable = [makePosition()];
    }

    app.state.assemblies.push(assembly);
    app.ai.lastAssemblyId = assembly.id;
    app.ui.treeSel = { type: "assembly", id: assembly.id };
    app.ui.activeSheetId = `assembly:${assembly.id}:main`;
    renderAll();
    addTableJournal("create_assembly", `Создана сборка ${assembly.fullName} (${assembly.id})`);
    addChangesJournal("assembly.add", `${assembly.id}:${assembly.fullName}`);
    return {
      ok: true,
      created: true,
      assembly: {
        id: assembly.id,
        full_name: assembly.fullName,
        abbreviation: assembly.abbreviation,
      },
    };
  }

  if (name === "update_assembly") {
    const assembly = resolveAgentAssembly(args);
    if (!assembly) {
      addTableJournal("update_assembly", "Ошибка: сборка не найдена");
      return { ok: false, error: "assembly not found" };
    }

    const changed = [];
    if (args?.full_name !== undefined) {
      assembly.fullName = String(args.full_name || "").trim();
      if (!assembly.abbrManual) assembly.abbreviation = deriveAbbr(assembly.fullName);
      changed.push("full_name");
    }
    if (args?.abbreviation !== undefined) {
      assembly.abbreviation = keepAbbr(args.abbreviation);
      changed.push("abbreviation");
    }
    if (args?.abbr_manual !== undefined) {
      assembly.abbrManual = Boolean(args.abbr_manual);
      if (!assembly.abbrManual) assembly.abbreviation = deriveAbbr(assembly.fullName);
      changed.push("abbr_manual");
    }
    if (args?.separate_consumables !== undefined) {
      assembly.separateConsumables = Boolean(args.separate_consumables);
      if (assembly.separateConsumables && !assembly.consumable.length) assembly.consumable = [makePosition()];
      changed.push("separate_consumables");
    }
    if (args?.manual_cons_no_disc !== undefined) {
      assembly.manualConsNoDisc = num(args.manual_cons_no_disc, assembly.manualConsNoDisc);
      changed.push("manual_cons_no_disc");
    }
    if (args?.manual_cons_disc !== undefined) {
      assembly.manualConsDisc = num(args.manual_cons_disc, assembly.manualConsDisc);
      changed.push("manual_cons_disc");
    }
    if (args?.labor && typeof args.labor === "object") {
      for (const key of ["devCoeff", "devHours", "devRate", "assmCoeff", "assmHours", "assmRate", "profitCoeff"]) {
        if (args.labor[key] === undefined) continue;
        assembly.labor[key] = num(args.labor[key], assembly.labor[key]);
        changed.push(`labor.${key}`);
      }
    }

    if (!changed.length) {
      addTableJournal("update_assembly", "Ошибка: нет полей для изменения");
      return { ok: false, error: "no fields to update" };
    }

    renderAll();
    addTableJournal("update_assembly", `${assembly.fullName}: ${changed.join(", ")}`);
    addChangesJournal("assembly.update", `${assembly.id}: ${changed.join(", ")}`);
    return { ok: true, assembly: { id: assembly.id, full_name: assembly.fullName }, changed };
  }

  if (name === "duplicate_assembly") {
    const source = resolveAgentAssembly(args);
    if (!source) {
      addTableJournal("duplicate_assembly", "Ошибка: сборка не найдена");
      return { ok: false, error: "assembly not found" };
    }

    const copy = {
      ...source,
      id: uid(),
      fullName: nextCopyAssemblyName(source.fullName || "Сборка"),
      main: Array.isArray(source.main) && source.main.length ? source.main.map((p) => ({ ...p, id: uid() })) : [makePosition()],
      consumable: Array.isArray(source.consumable) && source.consumable.length ? source.consumable.map((p) => ({ ...p, id: uid() })) : [makePosition()],
      labor: { ...source.labor },
      manualConsNoDisc: num(source.manualConsNoDisc, 0),
      manualConsDisc: num(source.manualConsDisc, 0),
    };
    const srcIdx = app.state.assemblies.findIndex((a) => a.id === source.id);
    if (srcIdx >= 0) app.state.assemblies.splice(srcIdx + 1, 0, copy);
    else app.state.assemblies.push(copy);

    app.ai.lastAssemblyId = copy.id;
    app.ui.treeSel = { type: "assembly", id: copy.id };
    app.ui.activeSheetId = `assembly:${copy.id}:main`;
    renderAll();
    addTableJournal("duplicate_assembly", `${source.fullName} -> ${copy.fullName}`);
    addChangesJournal("assembly.duplicate", `${source.id} -> ${copy.id}`);
    return {
      ok: true,
      source: { id: source.id, full_name: source.fullName },
      copy: { id: copy.id, full_name: copy.fullName },
    };
  }

  if (name === "delete_assembly") {
    const assembly = resolveAgentAssembly(args);
    if (!assembly) {
      addTableJournal("delete_assembly", "Ошибка: сборка не найдена");
      return { ok: false, error: "assembly not found" };
    }

    app.state.assemblies = app.state.assemblies.filter((x) => x.id !== assembly.id);
    if (app.ai.lastAssemblyId === assembly.id) app.ai.lastAssemblyId = app.state.assemblies.length ? app.state.assemblies[app.state.assemblies.length - 1].id : "";
    app.ui.treeSel = { type: "settings" };
    app.ui.activeSheetId = "summary";
    renderAll();
    addTableJournal("delete_assembly", `Удалена сборка ${assembly.fullName}`);
    addChangesJournal("assembly.delete", assembly.fullName || assembly.id);
    return { ok: true, deleted: { id: assembly.id, full_name: assembly.fullName } };
  }

  if (name === "list_positions") {
    const assembly = resolveAgentAssembly(args);
    if (!assembly) {
      if (!app.state.assemblies.length) {
        const listKey = normalizeAgentPositionList(args?.list);
        addTableJournal("list_positions", "Сборок нет, возвращен пустой список");
        return { ok: true, assembly: null, list: listKey, positions: [] };
      }
      addTableJournal("list_positions", "Ошибка: сборка не найдена");
      return { ok: false, error: "assembly not found" };
    }
    const listKey = normalizeAgentPositionList(args?.list);
    const arr = listKey === "consumable" ? assembly.consumable : assembly.main;
    const includeDetails = Boolean(args?.include_details);
    const positions = arr.map((p) => (includeDetails ? compactForTool(p) : {
      id: p.id,
      name: p.name,
      qty: p.qty,
      unit: p.unit,
      manufacturer: p.manufacturer,
      article: p.article,
    }));
    addTableJournal("list_positions", `${assembly.fullName}.${listKey}: ${positions.length}`);
    return {
      ok: true,
      assembly: { id: assembly.id, full_name: assembly.fullName },
      list: listKey,
      positions,
    };
  }

  if (name === "read_position") {
    const posId = String(args?.position_id || "").trim();
    if (!posId) {
      addTableJournal("read_position", "Ошибка: position_id required");
      return { ok: false, applied: 0, entity: { type: "position" }, warnings: [], error: "position_id required" };
    }
    const listRaw = String(args?.list || "").trim().toLowerCase();
    if (listRaw === "project") {
      const pos = app.state.projectConsumables.find((p) => p.id === posId) || null;
      if (!pos) {
        addTableJournal("read_position", "Ошибка: позиция не найдена");
        return { ok: false, applied: 0, entity: { type: "position" }, warnings: [], error: "position not found" };
      }
      addTableJournal("read_position", `project.${pos.id}`);
      return {
        ok: true,
        applied: 0,
        entity: { type: "position", id: pos.id },
        warnings: [],
        position: compactForTool(pos),
        list: "project",
      };
    }

    const assembly = resolveAgentAssembly(args);
    if (!assembly) {
      addTableJournal("read_position", "Ошибка: сборка не найдена");
      return { ok: false, applied: 0, entity: { type: "position" }, warnings: [], error: "assembly not found" };
    }
    const listKey = normalizeAgentPositionList(args?.list);
    const arr = listKey === "consumable" ? assembly.consumable : assembly.main;
    const pos = arr.find((p) => p.id === posId) || null;
    if (!pos) {
      addTableJournal("read_position", "Ошибка: позиция не найдена");
      return { ok: false, applied: 0, entity: { type: "position" }, warnings: [], error: "position not found" };
    }
    addTableJournal("read_position", `${assembly.fullName}.${listKey}.${pos.id}`);
    return {
      ok: true,
      applied: 0,
      entity: { type: "position", id: pos.id },
      warnings: [],
      assembly: { id: assembly.id, full_name: assembly.fullName },
      list: listKey,
      position: compactForTool(pos),
    };
  }

  if (name === "add_position") {
    let assembly = resolveAgentAssembly(args);
    const listKey = normalizeAgentPositionList(args?.list);

    const baseName = String(args?.name || "").trim();
    if (!baseName) {
      addTableJournal("add_position", "Ошибка: name required");
      return { ok: false, error: "name required" };
    }

    const verified = ensureMarketVerification(turnCtx, args?.verification, "add_position");
    if (!verified.ok) return { ok: false, error: verified.error };

    if (!assembly) {
      const autoName = String(args?.assembly_name || args?.assembly_id || "Новая сборка").trim() || "Новая сборка";
      assembly = makeAssembly(app.state.assemblies.length + 1);
      assembly.fullName = autoName;
      assembly.abbreviation = deriveAbbr(autoName);
      assembly.abbrManual = false;
      app.state.assemblies.push(assembly);
      app.ai.lastAssemblyId = assembly.id;
      addTableJournal("add_position", `Автосоздана сборка ${assembly.fullName} (${assembly.id})`);
      addChangesJournal("assembly.add.auto", `${assembly.id}:${assembly.fullName}`);
    }

    const target = listKey === "consumable" ? assembly.consumable : assembly.main;
    if (!Array.isArray(target)) {
      addTableJournal("add_position", "Ошибка: список позиций недоступен");
      return { ok: false, error: "target list unavailable" };
    }

    const position = makePosition();
    applyAgentPositionPatch(position, args);
    position.name = baseName;
    appendVerificationToPosition(position, verified.verification);

    target.push(position);
    app.ui.treeSel = { type: "pos", id: assembly.id, list: listKey === "consumable" ? "cons" : "main", pos: position.id };
    app.ui.activeSheetId = listKey === "consumable" ? `assembly:${assembly.id}:cons` : `assembly:${assembly.id}:main`;
    renderAll();
    addTableJournal("add_position", `${assembly.fullName}.${listKey}: ${position.name}, qty=${position.qty} ${position.unit}`);
    addChangesJournal("position.add", `${assembly.id}.${listKey}.${position.id}`);
    return {
      ok: true,
      assembly: {
        id: assembly.id,
        full_name: assembly.fullName,
      },
      list: listKey,
      position: {
        id: position.id,
        name: position.name,
        qty: position.qty,
        unit: position.unit,
      },
    };
  }

  if (name === "update_position") {
    const assembly = resolveAgentAssembly(args);
    if (!assembly) {
      addTableJournal("update_position", "Ошибка: сборка не найдена");
      return { ok: false, error: "assembly not found" };
    }
    const listKey = normalizeAgentPositionList(args?.list);
    const arr = listKey === "consumable" ? assembly.consumable : assembly.main;
    const pos = arr.find((p) => p.id === String(args?.position_id || "")) || null;
    if (!pos) {
      addTableJournal("update_position", "Ошибка: позиция не найдена");
      return { ok: false, error: "position not found" };
    }

    if (isMarketFieldTouched(args)) {
      const verified = ensureMarketVerification(turnCtx, args?.verification, "update_position");
      if (!verified.ok) return { ok: false, error: verified.error };
      appendVerificationToPosition(pos, verified.verification);
    }

    const changed = applyAgentPositionPatch(pos, args);
    if (!changed.length) {
      addTableJournal("update_position", "Ошибка: нет полей для изменения");
      return { ok: false, error: "no fields to update" };
    }

    app.ui.treeSel = { type: "pos", id: assembly.id, list: listKey === "consumable" ? "cons" : "main", pos: pos.id };
    app.ui.activeSheetId = listKey === "consumable" ? `assembly:${assembly.id}:cons` : `assembly:${assembly.id}:main`;
    renderAll();
    addTableJournal("update_position", `${assembly.fullName}.${listKey}.${pos.id}: ${changed.join(", ")}`);
    addChangesJournal("position.update", `${assembly.id}.${listKey}.${pos.id}`);
    return { ok: true, changed, position: { id: pos.id, name: pos.name } };
  }

  if (name === "delete_position") {
    const assembly = resolveAgentAssembly(args);
    if (!assembly) {
      addTableJournal("delete_position", "Ошибка: сборка не найдена");
      return { ok: false, error: "assembly not found" };
    }
    const listKey = normalizeAgentPositionList(args?.list);
    const listForDelete = listKey === "consumable" ? "cons" : "main";
    const arr = listForDelete === "main" ? assembly.main : assembly.consumable;
    const posId = String(args?.position_id || "");
    const exists = arr.some((p) => p.id === posId);
    if (!exists) {
      addTableJournal("delete_position", "Ошибка: позиция не найдена");
      return { ok: false, error: "position not found" };
    }
    deletePosition(assembly.id, listForDelete, posId);
    addTableJournal("delete_position", `${assembly.fullName}.${listKey}: удалена ${posId}`);
    return { ok: true, deleted: { assembly_id: assembly.id, list: listKey, position_id: posId } };
  }

  if (name === "duplicate_position") {
    const posId = String(args?.position_id || "").trim();
    if (!posId) {
      addTableJournal("duplicate_position", "Ошибка: position_id required");
      return { ok: false, applied: 0, entity: { type: "position" }, warnings: [], error: "position_id required" };
    }
    const listRaw = String(args?.list || "").trim().toLowerCase();
    if (listRaw === "project") {
      const arr = app.state.projectConsumables;
      const idx = arr.findIndex((p) => p.id === posId);
      if (idx < 0) {
        addTableJournal("duplicate_position", "Ошибка: позиция не найдена");
        return { ok: false, applied: 0, entity: { type: "position" }, warnings: [], error: "position not found" };
      }
      const src = arr[idx];
      const copy = { ...src, id: uid() };
      arr.splice(idx + 1, 0, copy);
      app.ui.treeSel = { type: "projpos", pos: copy.id };
      app.ui.activeSheetId = "project-consumables";
      renderAll();
      addTableJournal("duplicate_position", `project: ${src.id} -> ${copy.id}`);
      addChangesJournal("project.position.duplicate", `${src.id} -> ${copy.id}`);
      return {
        ok: true,
        applied: 1,
        entity: { type: "position", id: copy.id },
        warnings: [],
        list: "project",
        source: { id: src.id, name: src.name },
        copy: { id: copy.id, name: copy.name },
      };
    }

    const assembly = resolveAgentAssembly(args);
    if (!assembly) {
      addTableJournal("duplicate_position", "Ошибка: сборка не найдена");
      return { ok: false, applied: 0, entity: { type: "position" }, warnings: [], error: "assembly not found" };
    }
    const listKey = normalizeAgentPositionList(args?.list);
    const arr = listKey === "consumable" ? assembly.consumable : assembly.main;
    const idx = arr.findIndex((p) => p.id === posId);
    if (idx < 0) {
      addTableJournal("duplicate_position", "Ошибка: позиция не найдена");
      return { ok: false, applied: 0, entity: { type: "position" }, warnings: [], error: "position not found" };
    }
    const src = arr[idx];
    const copy = { ...src, id: uid() };
    arr.splice(idx + 1, 0, copy);
    app.ui.treeSel = { type: "pos", id: assembly.id, list: listKey === "consumable" ? "cons" : "main", pos: copy.id };
    app.ui.activeSheetId = listKey === "consumable" ? `assembly:${assembly.id}:cons` : `assembly:${assembly.id}:main`;
    renderAll();
    addTableJournal("duplicate_position", `${assembly.fullName}.${listKey}: ${src.id} -> ${copy.id}`);
    addChangesJournal("position.duplicate", `${assembly.id}.${listKey}.${src.id} -> ${copy.id}`);
    return {
      ok: true,
      applied: 1,
      entity: { type: "position", id: copy.id },
      warnings: [],
      assembly: { id: assembly.id, full_name: assembly.fullName },
      list: listKey,
      source: { id: src.id, name: src.name },
      copy: { id: copy.id, name: copy.name },
    };
  }

  if (name === "add_project_position") {
    const baseName = String(args?.name || "").trim();
    if (!baseName) {
      addTableJournal("add_project_position", "Ошибка: name required");
      return { ok: false, error: "name required" };
    }

    const verified = ensureMarketVerification(turnCtx, args?.verification, "add_project_position");
    if (!verified.ok) return { ok: false, error: verified.error };

    if (!app.state.hasProjectConsumables) app.state.hasProjectConsumables = true;
    const pos = makePosition();
    applyAgentPositionPatch(pos, args);
    pos.name = baseName;
    appendVerificationToPosition(pos, verified.verification);
    app.state.projectConsumables.push(pos);
    app.ui.treeSel = { type: "projpos", pos: pos.id };
    app.ui.activeSheetId = "project-consumables";
    renderAll();
    addTableJournal("add_project_position", `project: ${pos.name}, qty=${pos.qty} ${pos.unit}`);
    addChangesJournal("project.position.add", pos.id);
    return { ok: true, position: { id: pos.id, name: pos.name, qty: pos.qty, unit: pos.unit } };
  }

  if (name === "list_project_positions") {
    const includeDetails = Boolean(args?.include_details);
    const positions = app.state.projectConsumables.map((p) => (includeDetails ? compactForTool(p) : {
      id: p.id,
      name: p.name,
      qty: p.qty,
      unit: p.unit,
      manufacturer: p.manufacturer,
      article: p.article,
    }));
    addTableJournal("list_project_positions", `Получено позиций: ${positions.length}`);
    return {
      ok: true,
      applied: 0,
      entity: { type: "project_positions" },
      warnings: [],
      enabled: Boolean(app.state.hasProjectConsumables),
      positions,
    };
  }

  if (name === "update_project_position") {
    const posId = String(args?.position_id || "");
    const pos = app.state.projectConsumables.find((p) => p.id === posId) || null;
    if (!pos) {
      addTableJournal("update_project_position", "Ошибка: позиция не найдена");
      return { ok: false, error: "position not found" };
    }

    if (isMarketFieldTouched(args)) {
      const verified = ensureMarketVerification(turnCtx, args?.verification, "update_project_position");
      if (!verified.ok) return { ok: false, error: verified.error };
      appendVerificationToPosition(pos, verified.verification);
    }

    const changed = applyAgentPositionPatch(pos, args);
    if (!changed.length) {
      addTableJournal("update_project_position", "Ошибка: нет полей для изменения");
      return { ok: false, error: "no fields to update" };
    }
    app.ui.treeSel = { type: "projpos", pos: pos.id };
    app.ui.activeSheetId = "project-consumables";
    renderAll();
    addTableJournal("update_project_position", `${pos.id}: ${changed.join(", ")}`);
    addChangesJournal("project.position.update", pos.id);
    return { ok: true, changed, position: { id: pos.id, name: pos.name } };
  }

  if (name === "delete_project_position") {
    const posId = String(args?.position_id || "");
    const exists = app.state.projectConsumables.some((p) => p.id === posId);
    if (!exists) {
      addTableJournal("delete_project_position", "Ошибка: позиция не найдена");
      return { ok: false, error: "position not found" };
    }
    deletePosition("project", "project", posId);
    addTableJournal("delete_project_position", `Удалена позиция ${posId}`);
    return { ok: true, deleted: { position_id: posId } };
  }

  if (name === "toggle_project_consumables") {
    app.state.hasProjectConsumables = Boolean(args?.enabled);
    if (app.state.hasProjectConsumables && !app.state.projectConsumables.length) {
      app.state.projectConsumables = [makePosition()];
    }
    app.ui.treeSel = { type: "projlist" };
    if (app.state.hasProjectConsumables) app.ui.activeSheetId = "project-consumables";
    renderAll();
    addTableJournal("toggle_project_consumables", app.state.hasProjectConsumables ? "Включено" : "Выключено");
    addChangesJournal("project.consumables", app.state.hasProjectConsumables ? "включены" : "выключены");
    return { ok: true, enabled: app.state.hasProjectConsumables };
  }

  if (name === "read_range") {
    const sheet = resolveAgentSheet(args);
    if (!sheet) {
      addTableJournal("read_range", "Ошибка: лист не найден");
      return { ok: false, error: "sheet not found" };
    }

    const parsed = parseA1Range(args?.range || "A1");
    if (!parsed) {
      addTableJournal("read_range", "Ошибка: некорректный диапазон");
      return { ok: false, error: "bad range" };
    }

    const rowCount = parsed.r2 - parsed.r1 + 1;
    const colCount = parsed.c2 - parsed.c1 + 1;
    const maxCells = 1500;
    let r2 = parsed.r2;
    let c2 = parsed.c2;
    if (rowCount * colCount > maxCells) {
      const maxRows = Math.max(1, Math.floor(maxCells / Math.max(1, colCount)));
      r2 = parsed.r1 + maxRows - 1;
    }

    const includeFormulas = Boolean(args?.include_formulas);
    const rows = [];
    for (let r = parsed.r1; r <= r2; r += 1) {
      const curr = [];
      for (let c = parsed.c1; c <= c2; c += 1) {
        const cell = sheet.rows[r - 1]?.cells[c - 1] || null;
        const item = {
          address: toA1(r, c),
          value: cell ? cell.value : null,
          text: agentCellValueText(cell),
        };
        if (includeFormulas) item.formula = cell?.formula || "";
        curr.push(item);
      }
      rows.push(curr);
    }

    const result = {
      ok: true,
      sheet: { id: sheet.id, name: sheet.name },
      range: `${toA1(parsed.r1, parsed.c1)}:${toA1(r2, c2)}`,
      rows,
    };
    addTableJournal("read_range", `${sheet.name}: ${result.range}`);
    return result;
  }

  if (name === "write_cells") {
    const sheet = resolveAgentSheet(args);
    if (!sheet) {
      addTableJournal("write_cells", "Ошибка: лист не найден");
      return { ok: false, error: "sheet not found" };
    }

    const updates = Array.isArray(args?.updates) ? args.updates : [];
    if (!updates.length) {
      addTableJournal("write_cells", "Ошибка: пустой список updates");
      return { ok: false, error: "updates required" };
    }

    const parsedUpdates = [];
    const marketCols = new Set([3, 4, 5, 18, 19]);
    const marketSheet = isMarketSheetId(sheet.id);
    let marketTouches = 0;
    let skipped = 0;
    for (const u of updates) {
      const p = parseA1Address(u?.address);
      if (!p) {
        skipped += 1;
        continue;
      }
      if (marketSheet && marketCols.has(p.col)) {
        const hasFormula = String(u?.formula || "").trim().length > 0;
        const hasValue = u?.value !== undefined && String(u?.value ?? "").trim().length > 0;
        if (hasFormula || hasValue) marketTouches += 1;
      }
      parsedUpdates.push({ row: p.row, col: p.col, value: u?.value ?? null, formula: u?.formula || "" });
    }

    if (marketTouches > 0) {
      const verified = ensureMarketVerification(turnCtx, args?.verification, "write_cells");
      if (!verified.ok) return { ok: false, error: verified.error };
    }

    let applied = 0;
    for (const item of parsedUpdates) {
      setAgentSheetCell(sheet.id, item.row, item.col, item.value, item.formula);
      applied += 1;
    }

    if (applied <= 0) {
      const reason = skipped > 0 ? `нет корректных A1-адресов (пропущено: ${skipped})` : "нечего применять";
      addTableJournal("write_cells", `Ошибка: ${reason}`);
      return { ok: false, error: reason, applied: 0, skipped, sheet: { id: sheet.id, name: sheet.name } };
    }

    renderAll();
    addTableJournal("write_cells", `${sheet.name}: изменено ячеек ${applied}${skipped ? `, пропущено ${skipped}` : ""}`);
    addChangesJournal("ai.write_cells", `${sheet.name}: ${applied}`);
    return { ok: true, applied, skipped, sheet: { id: sheet.id, name: sheet.name } };
  }

  if (name === "clear_range") {
    const sheet = resolveAgentSheet(args);
    if (!sheet) {
      addTableJournal("clear_range", "Ошибка: лист не найден");
      return { ok: false, error: "sheet not found" };
    }
    const parsed = parseA1Range(args?.range || "");
    if (!parsed) {
      addTableJournal("clear_range", "Ошибка: некорректный диапазон");
      return { ok: false, error: "bad range" };
    }

    let cleared = 0;
    for (let r = parsed.r1; r <= parsed.r2; r += 1) {
      for (let c = parsed.c1; c <= parsed.c2; c += 1) {
        setAgentSheetCell(sheet.id, r, c, null, "");
        cleared += 1;
      }
    }
    renderAll();
    const rangeTxt = `${toA1(parsed.r1, parsed.c1)}:${toA1(parsed.r2, parsed.c2)}`;
    addTableJournal("clear_range", `${sheet.name}: ${rangeTxt}, ячеек ${cleared}`);
    addChangesJournal("ai.clear_range", `${sheet.id}:${rangeTxt}`);
    return { ok: true, sheet: { id: sheet.id, name: sheet.name }, range: rangeTxt, cleared };
  }

  if (name === "clear_sheet_overrides") {
    const clearAll = Boolean(args?.all);
    const sheetId = String(args?.sheet_id || "").trim();

    if (clearAll || !sheetId) {
      const count = Object.keys(app.ai.sheetOverrides || {}).length;
      app.ai.sheetOverrides = {};
      renderAll();
      addTableJournal("clear_sheet_overrides", `Очищены override-карты: ${count}`);
      addChangesJournal("ai.sheet_overrides.clear", "all");
      return { ok: true, cleared_maps: count, all: true };
    }

    if (!app.ai.sheetOverrides[sheetId]) {
      addTableJournal("clear_sheet_overrides", `Ошибка: для листа ${sheetId} override нет`);
      return { ok: false, error: "sheet override not found" };
    }

    const count = Object.keys(app.ai.sheetOverrides[sheetId] || {}).length;
    delete app.ai.sheetOverrides[sheetId];
    renderAll();
    addTableJournal("clear_sheet_overrides", `Лист ${sheetId}: очищено ${count} ячеек`);
    addChangesJournal("ai.sheet_overrides.clear", sheetId);
    return { ok: true, sheet_id: sheetId, cleared_cells: count, all: false };
  }

  if (name === "get_selection") {
    const sel = app.ui.selection;
    const s = activeSheet();
    if (!sel || !s || sel.sheet !== s.id) {
      addTableJournal("get_selection", "Выделение отсутствует");
      return { ok: true, selection: null };
    }
    const r1 = Math.min(sel.sr, sel.er);
    const r2 = Math.max(sel.sr, sel.er);
    const c1 = Math.min(sel.sc, sel.ec);
    const c2 = Math.max(sel.sc, sel.ec);
    const result = {
      ok: true,
      selection: {
        sheet_id: s.id,
        sheet_name: s.name,
        range: `${toA1(r1, c1)}:${toA1(r2, c2)}`,
        text: selectionText(s, sel),
      },
    };
    addTableJournal("get_selection", `${s.name}: ${result.selection.range}`);
    return result;
  }

  if (name === "get_state") {
    const value = args?.path ? getStatePath(args.path) : app.state;
    addTableJournal("get_state", args?.path ? `Чтение пути ${args.path}` : "Чтение полного state");
    return { ok: true, path: args?.path || "", value: compactForTool(value) };
  }

  if (name === "set_state_value") {
    if (!args?.path) {
      addTableJournal("set_state_value", "Ошибка: path required");
      return { ok: false, error: "path required" };
    }
    if (!statePathExists(args.path)) {
      addTableJournal("set_state_value", `Ошибка: path not found (${args.path})`);
      return { ok: false, error: "path not found" };
    }
    if (statePathRequiresMarketVerification(args.path)) {
      const verified = ensureMarketVerification(turnCtx, args?.verification, "set_state_value");
      if (!verified.ok) return { ok: false, error: verified.error };
    }
    const nextValue = args?.value_json !== undefined ? parseJsonValue(args.value_json) : args?.value;
    try {
      const prevValue = getStatePath(args.path);
      setStatePath(args.path, nextValue);
      renderAll();
      addTableJournal("set_state_value", `Изменен путь ${args.path}`);
      addChangesJournal("ai.set_state", args.path);
      return { ok: true, changed: !Object.is(prevValue, nextValue) };
    } catch (err) {
      addTableJournal("set_state_value", `Ошибка: ${String(err?.message || err)}`);
      return { ok: false, error: String(err?.message || err) };
    }
  }

  return { ok: false, error: `unknown tool: ${name}` };
}

function resolveAgentSheet(args) {
  const id = String(args?.sheet_id || "").trim();
  if (id && app.workbook.byId[id]) return app.workbook.byId[id];
  if (id) return null;

  const name = String(args?.sheet_name || "").trim().toLowerCase();
  if (name) {
    const match = app.workbook.sheets.find((s) => String(s.name || "").trim().toLowerCase() === name);
    if (match) return match;
    return null;
  }

  return activeSheet();
}

function resolveAgentAssembly(args) {
  const id = String(args?.assembly_id || "").trim();
  const nameRaw = String(args?.assembly_name || "").trim();
  const explicitTarget = Boolean(id || nameRaw);
  if (id) {
    const byId = assemblyById(id);
    if (byId) {
      app.ai.lastAssemblyId = byId.id;
      return byId;
    }
  }

  if (nameRaw) {
    const name = nameRaw.toLowerCase();
    const exact = app.state.assemblies.find((a) => {
      const full = String(a.fullName || "").trim().toLowerCase();
      const abbr = String(a.abbreviation || "").trim().toLowerCase();
      return full === name || abbr === name;
    });
    if (exact) {
      app.ai.lastAssemblyId = exact.id;
      return exact;
    }

    const partial = app.state.assemblies.find((a) => {
      const full = String(a.fullName || "").trim().toLowerCase();
      const abbr = String(a.abbreviation || "").trim().toLowerCase();
      return full.includes(name) || name.includes(full) || abbr.includes(name) || name.includes(abbr);
    });
    if (partial) {
      app.ai.lastAssemblyId = partial.id;
      return partial;
    }
  }

  const rememberedId = String(app.ai.lastAssemblyId || "").trim();
  if (rememberedId) {
    const remembered = assemblyById(rememberedId);
    if (remembered) {
      app.ai.lastAssemblyId = remembered.id;
      if (explicitTarget) {
        addTableJournal("agent.fallback", `assembly fallback -> remembered (${remembered.fullName})`, {
          status: "running",
          meta: { requested_id: id || null, requested_name: nameRaw || null, resolved_id: remembered.id, reason: "remembered" },
        });
      }
      return remembered;
    }
  }

  const selId = String(app.ui?.treeSel?.id || "").trim();
  if (selId) {
    const selected = assemblyById(selId);
    if (selected) {
      app.ai.lastAssemblyId = selected.id;
      if (explicitTarget) {
        addTableJournal("agent.fallback", `assembly fallback -> selected (${selected.fullName})`, {
          status: "running",
          meta: { requested_id: id || null, requested_name: nameRaw || null, resolved_id: selected.id, reason: "selected" },
        });
      }
      return selected;
    }
  }

  const activeId = String(app.ui?.activeSheetId || "").trim();
  const m = activeId.match(/^assembly:([^:]+):/);
  if (m?.[1]) {
    const bySheet = assemblyById(m[1]);
    if (bySheet) {
      app.ai.lastAssemblyId = bySheet.id;
      if (explicitTarget) {
        addTableJournal("agent.fallback", `assembly fallback -> active sheet (${bySheet.fullName})`, {
          status: "running",
          meta: { requested_id: id || null, requested_name: nameRaw || null, resolved_id: bySheet.id, reason: "active_sheet" },
        });
      }
      return bySheet;
    }
  }

  if (app.state.assemblies.length === 1) {
    app.ai.lastAssemblyId = app.state.assemblies[0].id;
    if (explicitTarget) {
      addTableJournal("agent.fallback", `assembly fallback -> only assembly (${app.state.assemblies[0].fullName})`, {
        status: "running",
        meta: { requested_id: id || null, requested_name: nameRaw || null, resolved_id: app.state.assemblies[0].id, reason: "single" },
      });
    }
    return app.state.assemblies[0];
  }
  if (app.state.assemblies.length > 1) {
    const fallback = app.state.assemblies[app.state.assemblies.length - 1];
    app.ai.lastAssemblyId = fallback.id;
    if (explicitTarget) {
      addTableJournal("agent.fallback", `assembly fallback -> last (${fallback.fullName})`, {
        status: "running",
        meta: { requested_id: id || null, requested_name: nameRaw || null, resolved_id: fallback.id, reason: "last" },
      });
    }
    return fallback;
  }
  return null;
}

function normalizeAgentPositionList(raw) {
  const txt = String(raw || "").trim().toLowerCase();
  if (!txt) return "main";
  if (txt === "cons" || txt === "consumable" || txt === "consumables" || txt === "расходники" || txt === "расходные") return "consumable";
  return "main";
}

function normalizeAgentRatio(raw, fallback = 0) {
  const n = num(raw, fallback);
  if (n > 1 && n <= 100) return n / 100;
  return n;
}

function parseA1Address(addr) {
  const clean = String(addr || "").replaceAll("$", "").trim().toUpperCase();
  if (!/^[A-Z]+[0-9]+$/.test(clean)) return null;
  return decodeAddr(clean);
}

function parseA1Range(range) {
  const txt = String(range || "").trim().toUpperCase();
  if (!txt) return null;
  const [a, b] = txt.split(":");
  const s = parseA1Address(a);
  const e = parseA1Address(b || a);
  if (!s || !e) return null;
  return {
    r1: Math.min(s.row, e.row),
    c1: Math.min(s.col, e.col),
    r2: Math.max(s.row, e.row),
    c2: Math.max(s.col, e.col),
  };
}

function colToName(col) {
  let n = Math.max(1, num(col, 1));
  let out = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    out = String.fromCharCode(65 + rem) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

function toA1(row, col) {
  return `${colToName(col)}${Math.max(1, num(row, 1))}`;
}

function agentCellValueText(cell) {
  if (!cell || cell.value === null || cell.value === undefined) return "";
  if (typeof cell.value === "number" || typeof cell.value === "boolean") return String(cell.value);
  return String(cell.value);
}

function compactForTool(value, depth = 0) {
  if (depth > 5) return "[depth-limit]";
  if (value === null || value === undefined) return value;
  if (typeof value === "string") return value.length > 1200 ? `${value.slice(0, 1200)}...[trim]` : value;
  if (typeof value !== "object") return value;
  if (Array.isArray(value)) {
    const limit = 80;
    const arr = value.slice(0, limit).map((v) => compactForTool(v, depth + 1));
    if (value.length > limit) arr.push(`[... ${value.length - limit} more]`);
    return arr;
  }
  const out = {};
  let count = 0;
  for (const [k, v] of Object.entries(value)) {
    if (count >= 80) {
      out.__trimmed__ = true;
      break;
    }
    out[k] = compactForTool(v, depth + 1);
    count += 1;
  }
  return out;
}

function getStatePath(path) {
  const tokens = parseStatePath(path);
  if (!tokens.length) return app.state;
  let ref = app.state;
  for (const token of tokens) {
    if (ref === null || ref === undefined) return undefined;
    ref = ref[token];
  }
  return ref;
}

function statePathExists(path) {
  const tokens = parseStatePath(path);
  if (!tokens.length) return false;

  let ref = app.state;
  for (let i = 0; i < tokens.length - 1; i += 1) {
    const token = tokens[i];
    if (ref === null || ref === undefined || typeof ref !== "object") return false;
    if (!(token in ref)) return false;
    ref = ref[token];
  }

  if (ref === null || ref === undefined || typeof ref !== "object") return false;
  const last = tokens[tokens.length - 1];
  if (Array.isArray(ref) && typeof last === "number") {
    return Number.isInteger(last) && last >= 0 && last < ref.length;
  }
  return Object.prototype.hasOwnProperty.call(ref, last);
}

function setStatePath(path, value) {
  const tokens = parseStatePath(path);
  if (!tokens.length) throw new Error("bad path");

  let ref = app.state;
  for (let i = 0; i < tokens.length - 1; i += 1) {
    const t = tokens[i];
    const next = tokens[i + 1];
    if (ref[t] === undefined || ref[t] === null) ref[t] = typeof next === "number" ? [] : {};
    if (typeof ref[t] !== "object") throw new Error(`path blocked at ${String(t)}`);
    ref = ref[t];
  }

  ref[tokens[tokens.length - 1]] = value;
}

function parseStatePath(path) {
  const src = String(path || "").trim();
  if (!src) return [];
  const tokens = [];
  const re = /([^[.\]]+)|\[(\d+)\]/g;
  let m;
  while ((m = re.exec(src))) {
    if (m[1] !== undefined) tokens.push(m[1]);
    else tokens.push(Number(m[2]));
  }
  return tokens;
}

function setAgentSheetCell(sheetId, row, col, value, formula = "") {
  if (!app.ai.sheetOverrides[sheetId]) app.ai.sheetOverrides[sheetId] = {};
  app.ai.sheetOverrides[sheetId][`${row}:${col}`] = {
    value: normalizeAgentValue(value),
    formula: String(formula || ""),
  };
}

function normalizeAgentValue(value) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number" || typeof value === "boolean") return value;
  return String(value);
}

function applyAgentSheetOverrides() {
  for (const [sheetId, map] of Object.entries(app.ai.sheetOverrides || {})) {
    const sheet = app.workbook.byId[sheetId];
    if (!sheet || !map || typeof map !== "object") continue;

    for (const [cellKey, patch] of Object.entries(map)) {
      const [rRaw, cRaw] = cellKey.split(":");
      const row = Number(rRaw);
      const col = Number(cRaw);
      if (!Number.isFinite(row) || !Number.isFinite(col) || row < 1 || col < 1) continue;
      writeSheetCell(sheet, row, col, patch?.value ?? null, patch?.formula || "");
    }
  }
}

function writeSheetCell(sheet, row, col, value, formula = "") {
  ensureSheetBounds(sheet, row, col);
  const cell = sheet.rows[row - 1].cells[col - 1];
  cell.value = normalizeAgentValue(value);
  cell.formula = String(formula || "");
}

function ensureSheetBounds(sheet, row, col) {
  while (sheet.cols.length < col) {
    sheet.cols.push(64);
    for (const r of sheet.rows) r.cells.push({ styleId: 0, value: null, formula: "" });
  }

  while (sheet.rows.length < row) {
    const height = sheet.rows[sheet.rows.length - 1]?.height || 20;
    const cells = new Array(sheet.cols.length).fill(0).map(() => ({ styleId: 0, value: null, formula: "" }));
    sheet.rows.push({ height, cells });
  }

  for (const r of sheet.rows) {
    while (r.cells.length < sheet.cols.length) r.cells.push({ styleId: 0, value: null, formula: "" });
  }
}
function onTreeClick(e) {
  const actionBtn = e.target.closest("[data-tree-action]");
  if (actionBtn) {
    e.preventDefault();
    e.stopPropagation();
    const action = String(actionBtn.dataset.treeAction || "");
    if (action === "open-settings") openSettingsDialog();
    else if (action === "dup-assembly") duplicateAssembly(actionBtn.dataset.id);
    else if (action === "del-assembly") deleteAssembly(actionBtn.dataset.id);
    else if (action === "add-pos") addPosition(actionBtn.dataset.id, actionBtn.dataset.list);
    else if (action === "del-pos") deletePosition(actionBtn.dataset.id, actionBtn.dataset.list, actionBtn.dataset.pos);
    else if (action === "dup-pos") duplicatePosition(actionBtn.dataset.id, actionBtn.dataset.list, actionBtn.dataset.pos);
    else if (action === "toggle-proj") toggleProjectConsumables();
    else if (action === "add-proj-pos") addProjectPosition();
    return;
  }

  const n = e.target.closest("[data-node]");
  if (!n) return;
  const t = n.dataset.node;

  if (t === "settings") {
    app.ui.treeSel = { type: "settings" };
  } else if (t === "assembly") {
    app.ui.treeSel = { type: "assembly", id: n.dataset.id };
    app.ui.activeSheetId = `assembly:${n.dataset.id}:main`;
  } else if (t === "list") {
    const list = n.dataset.list;
    app.ui.treeSel = { type: "list", id: n.dataset.id, list };
    app.ui.activeSheetId = list === "cons" ? `assembly:${n.dataset.id}:cons` : `assembly:${n.dataset.id}:main`;
  } else if (t === "pos") {
    const list = n.dataset.list;
    app.ui.treeSel = { type: "pos", id: n.dataset.id, list, pos: n.dataset.pos };
    app.ui.activeSheetId = list === "cons" ? `assembly:${n.dataset.id}:cons` : `assembly:${n.dataset.id}:main`;
  } else if (t === "projlist") {
    app.ui.treeSel = { type: "projlist" };
    if (app.state.hasProjectConsumables) app.ui.activeSheetId = "project-consumables";
  } else if (t === "projpos") {
    app.ui.treeSel = { type: "projpos", pos: n.dataset.pos };
    if (app.state.hasProjectConsumables) app.ui.activeSheetId = "project-consumables";
  }

  renderTree();
  renderInspector();
  renderTabs();
  renderSheet();
}

function onInspectorClick(e) {
  const a = e.target.closest("[data-action]");
  if (!a) return;
  const action = a.dataset.action;

  if (action === "open-settings") {
    openSettingsDialog();
    return;
  }

  if (action === "del-assembly") {
    deleteAssembly(a.dataset.id);
    return;
  }

  if (action === "add-pos") {
    addPosition(a.dataset.id, a.dataset.list);
    return;
  }

  if (action === "del-pos") {
    deletePosition(a.dataset.id, a.dataset.list, a.dataset.pos);
    return;
  }

  if (action === "toggle-proj") {
    toggleProjectConsumables();
    return;
  }

  if (action === "add-proj-pos") {
    addProjectPosition();
  }
}

function onInspectorChange(e) {
  const t = e.target;
  const role = t.dataset.role;

  if (role === "setting") {
    const f = t.dataset.field;
    if (f === "vatRate") app.state.settings.vatRate = pctToDec(t.value);
    else if (f === "totalMode") app.state.settings.totalMode = t.value === "withDiscount" ? "withDiscount" : "withoutDiscount";
    else app.state.settings[f] = String(t.value || "");
    renderAll();
    addChangesJournal("settings.update", f);
    return;
  }

  if (role === "assembly") {
    const a = assemblyById(t.dataset.id);
    if (!a) return;
    const f = t.dataset.field;
    if (f === "abbrManual" || f === "separateConsumables") {
      a[f] = Boolean(t.checked);
      if (f === "abbrManual" && !a.abbrManual) a.abbreviation = deriveAbbr(a.fullName);
      if (f === "separateConsumables" && a.separateConsumables && !a.consumable.length) a.consumable = [makePosition()];
    } else if (f === "fullName") {
      a.fullName = String(t.value || "").trim();
      if (!a.abbrManual) a.abbreviation = deriveAbbr(a.fullName);
    } else if (f === "abbreviation") {
      a.abbreviation = keepAbbr(t.value);
    } else {
      a[f] = num(t.value);
    }
    renderAll();
    addChangesJournal("assembly.update", `${a.id}.${f}`);
    return;
  }

  if (role === "labor") {
    const a = assemblyById(t.dataset.id);
    if (!a) return;
    a.labor[t.dataset.field] = num(t.value);
    renderAll();
    addChangesJournal("labor.update", `${a.id}.${t.dataset.field}`);
    return;
  }

  if (role === "pos" || role === "project-pos") {
    const pos = getPositionRef(t.dataset.id, t.dataset.list, t.dataset.pos);
    if (!pos) return;
    const f = t.dataset.field;
    if (f === "qty" || f === "priceCatalogVatMarkup") pos[f] = num(t.value);
    else if (f === "markup" || f === "discount") pos[f] = pctToDec(t.value);
    else pos[f] = String(t.value || "");
    renderAll();
    addChangesJournal("position.update", `${t.dataset.list || ""}.${f}`);
  }
}

function getPositionRef(assemblyId, list, posId) {
  if (list === "project") return app.state.projectConsumables.find((p) => p.id === posId) || null;
  const a = assemblyById(assemblyId);
  if (!a) return null;
  const arr = list === "main" ? a.main : a.consumable;
  return arr.find((p) => p.id === posId) || null;
}

function onSidebarResizePointerDown(e) {
  if (app.ui.sidebarCollapsed) return;
  app.ui.sidebarResizing = true;
  app.ui.sidebarResizePointerId = e.pointerId;
  app.ui.sidebarResizeStartX = e.clientX;
  app.ui.sidebarResizeStartWidth = clampSidebarWidth(app.ui.sidebarWidth || dom.sidebar?.getBoundingClientRect()?.width || 360);
  dom.sidebarResizeHandle?.setPointerCapture?.(e.pointerId);
  document.body.classList.add("sidebar-resizing");
  e.preventDefault();
}

function onSidebarResizePointerMove(e) {
  if (!app.ui.sidebarResizing) return;
  const delta = e.clientX - num(app.ui.sidebarResizeStartX, 0);
  const nextWidth = num(app.ui.sidebarResizeStartWidth, 360) + delta;
  applySidebarWidth(nextWidth, false);
}

function onSidebarResizePointerUp(e) {
  if (!app.ui.sidebarResizing) return;
  if (app.ui.sidebarResizePointerId !== undefined && e.pointerId !== undefined && e.pointerId !== app.ui.sidebarResizePointerId) return;
  app.ui.sidebarResizing = false;
  app.ui.sidebarResizePointerId = undefined;
  app.ui.sidebarResizeStartX = undefined;
  app.ui.sidebarResizeStartWidth = undefined;
  dom.sidebarResizeHandle?.releasePointerCapture?.(e.pointerId);
  document.body.classList.remove("sidebar-resizing");
  saveSidebarWidth();
}

function addPositionBySelection() {
  const s = app.ui.treeSel;
  if (s.type === "list") {
    addPosition(s.id, s.list);
    return true;
  }
  if (s.type === "pos") {
    addPosition(s.id, s.list);
    return true;
  }
  if (s.type === "projlist" || s.type === "projpos") {
    if (!app.state.hasProjectConsumables) app.state.hasProjectConsumables = true;
    const p = makePosition();
    app.state.projectConsumables.push(p);
    app.ui.treeSel = { type: "projpos", pos: p.id };
    renderAll();
    return true;
  }
  return false;
}

function addPosition(assemblyId, list) {
  const a = assemblyById(assemblyId);
  if (!a) return;
  const arr = list === "main" ? a.main : a.consumable;
  const p = makePosition();
  arr.push(p);
  app.ui.treeSel = { type: "pos", id: assemblyId, list, pos: p.id };
  renderAll();
  addChangesJournal("position.add", `${assemblyId}.${list}.${p.id}`);
  toast("Позиция добавлена");
}

function addProjectPosition() {
  if (!app.state.hasProjectConsumables) return;
  const p = makePosition();
  app.state.projectConsumables.push(p);
  app.ui.treeSel = { type: "projpos", pos: p.id };
  renderAll();
  addChangesJournal("project.position.add", p.id);
  toast("Позиция добавлена");
}

function toggleProjectConsumables() {
  app.state.hasProjectConsumables = !app.state.hasProjectConsumables;
  if (app.state.hasProjectConsumables && !app.state.projectConsumables.length) app.state.projectConsumables = [makePosition()];
  app.ui.treeSel = { type: "projlist" };
  renderAll();
  addChangesJournal("project.consumables", app.state.hasProjectConsumables ? "включены" : "выключены");
}

function deleteAssembly(assemblyId) {
  const deleted = assemblyById(assemblyId);
  if (!deleted) return;
  app.state.assemblies = app.state.assemblies.filter((x) => x.id !== assemblyId);
  if (app.ai.lastAssemblyId === assemblyId) app.ai.lastAssemblyId = app.state.assemblies.length ? app.state.assemblies[app.state.assemblies.length - 1].id : "";
  app.ui.treeSel = { type: "settings" };
  app.ui.activeSheetId = "summary";
  renderAll();
  addChangesJournal("assembly.delete", deleted.fullName || assemblyId || "");
  toast("Сборка удалена");
}

function duplicateAssembly(assemblyId) {
  const src = assemblyById(assemblyId);
  if (!src) return;

  const copy = {
    ...src,
    id: uid(),
    fullName: nextCopyAssemblyName(src.fullName || "Сборка"),
    main: Array.isArray(src.main) && src.main.length ? src.main.map((p) => ({ ...p, id: uid() })) : [makePosition()],
    consumable: Array.isArray(src.consumable) && src.consumable.length ? src.consumable.map((p) => ({ ...p, id: uid() })) : [makePosition()],
    labor: { ...src.labor },
    manualConsNoDisc: num(src.manualConsNoDisc, 0),
    manualConsDisc: num(src.manualConsDisc, 0),
  };

  const srcIdx = app.state.assemblies.findIndex((a) => a.id === src.id);
  if (srcIdx >= 0) app.state.assemblies.splice(srcIdx + 1, 0, copy);
  else app.state.assemblies.push(copy);

  app.ai.lastAssemblyId = copy.id;
  app.ui.treeSel = { type: "assembly", id: copy.id };
  app.ui.activeSheetId = `assembly:${copy.id}:main`;
  renderAll();
  addChangesJournal("assembly.duplicate", `${src.id} -> ${copy.id}`);
  toast("Сборка продублирована");
}

function duplicatePosition(assemblyId, list, posId) {
  if (list === "project") {
    const arr = app.state.projectConsumables;
    const idx = arr.findIndex((p) => p.id === posId);
    if (idx < 0) return;
    const src = arr[idx];
    const copy = { ...src, id: uid() };
    arr.splice(idx + 1, 0, copy);
    app.ui.treeSel = { type: "projpos", pos: copy.id };
    renderAll();
    addChangesJournal("project.position.duplicate", `${src.id} -> ${copy.id}`);
    toast("Позиция продублирована");
    return;
  }

  const a = assemblyById(assemblyId);
  if (!a) return;
  const arr = list === "main" ? a.main : a.consumable;
  const idx = arr.findIndex((p) => p.id === posId);
  if (idx < 0) return;
  const src = arr[idx];
  const copy = { ...src, id: uid() };
  arr.splice(idx + 1, 0, copy);
  app.ui.treeSel = { type: "pos", id: assemblyId, list, pos: copy.id };
  renderAll();
  addChangesJournal("position.duplicate", `${assemblyId}.${list}.${src.id} -> ${copy.id}`);
  toast("Позиция продублирована");
}

function nextCopyAssemblyName(base) {
  const src = String(base || "").trim() || "Сборка";
  const used = new Set(app.state.assemblies.map((a) => String(a.fullName || "").trim()));

  let name = `${src} (копия)`;
  if (!used.has(name)) return name;

  let i = 2;
  while (used.has(`${src} (копия ${i})`)) i += 1;
  return `${src} (копия ${i})`;
}

function deletePosition(assemblyId, list, posId) {
  if (list === "project") {
    const arr = app.state.projectConsumables;
    const idx = arr.findIndex((p) => p.id === posId);
    if (idx < 0) return;
    if (arr.length === 1) arr[0] = makePosition();
    else arr.splice(idx, 1);
    app.ui.treeSel = { type: "projlist" };
    renderAll();
    addChangesJournal("project.position.delete", posId);
    return;
  }

  const a = assemblyById(assemblyId);
  if (!a) return;
  const arr = list === "main" ? a.main : a.consumable;
  const idx = arr.findIndex((p) => p.id === posId);
  if (idx < 0) return;
  if (arr.length === 1) arr[0] = makePosition();
  else arr.splice(idx, 1);
  app.ui.treeSel = { type: "list", id: assemblyId, list };
  renderAll();
  addChangesJournal("position.delete", `${assemblyId}.${list}.${posId}`);
}

function onViewportMouseDown(e) {
  dom.viewport.focus();

  if (e.button === 2) {
    app.ui.panning = true;
    app.ui.pan = { x: e.clientX, y: e.clientY, left: dom.viewport.scrollLeft, top: dom.viewport.scrollTop };
    dom.viewport.classList.add("is-panning");
    e.preventDefault();
    return;
  }

  if (e.button !== 0) return;
  const td = e.target.closest("td[data-row][data-col]");
  if (!td) return;

  const s = activeSheet();
  if (!s) return;

  app.ui.selecting = true;
  app.ui.selection = {
    sheet: s.id,
    sr: Number(td.dataset.row),
    sc: Number(td.dataset.col),
    er: Number(td.dataset.row),
    ec: Number(td.dataset.col),
  };

  paintSelection();
  e.preventDefault();
}

function onViewportMouseMove(e) {
  if (app.ui.panning && app.ui.pan) {
    dom.viewport.scrollLeft = app.ui.pan.left - (e.clientX - app.ui.pan.x);
    dom.viewport.scrollTop = app.ui.pan.top - (e.clientY - app.ui.pan.y);
    return;
  }

  if (!app.ui.selecting || !app.ui.selection) return;
  const target = document.elementFromPoint(e.clientX, e.clientY);
  const td = target && target.closest ? target.closest("td[data-row][data-col]") : null;
  if (!td) return;

  app.ui.selection.er = Number(td.dataset.row);
  app.ui.selection.ec = Number(td.dataset.col);
  paintSelection();
}

function onViewportMouseUp(e) {
  if (e.button === 2) {
    app.ui.panning = false;
    app.ui.pan = null;
    dom.viewport.classList.remove("is-panning");
    return;
  }
  if (e.button === 0) app.ui.selecting = false;
}

function onDocumentMouseDown(e) {
  if (e.button !== 0) return;
  const inCell = e.target.closest && e.target.closest("#sheetCanvas td[data-row][data-col]");
  const inToolbar = e.target.closest && e.target.closest(".toolbar");
  const inSidebar = e.target.closest && e.target.closest(".sidebar");
  const inAgent = e.target.closest && e.target.closest("#agentOverlay");
  if (!inCell && !inToolbar && !inSidebar && !inAgent) clearSelection();
}

function clearSelection() {
  if (!app.ui.selection) return;
  app.ui.selection = null;
  paintSelection();
}

function editableFocus() {
  const el = document.activeElement;
  if (!el) return false;
  if (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT") return true;
  return Boolean(el.isContentEditable);
}

function paintSelection() {
  dom.canvas.querySelectorAll("td.selected").forEach((x) => x.classList.remove("selected"));
  const s = activeSheet();
  const sel = app.ui.selection;
  if (!s || !sel || sel.sheet !== s.id) return;

  const r1 = Math.min(sel.sr, sel.er);
  const r2 = Math.max(sel.sr, sel.er);
  const c1 = Math.min(sel.sc, sel.ec);
  const c2 = Math.max(sel.sc, sel.ec);

  for (let r = r1; r <= r2; r += 1) {
    for (let c = c1; c <= c2; c += 1) {
      const td = dom.canvas.querySelector(`td[data-row="${r}"][data-col="${c}"]`);
      if (td) td.classList.add("selected");
    }
  }
}

function selectionText(sheet, sel) {
  const r1 = Math.min(sel.sr, sel.er);
  const r2 = Math.max(sel.sr, sel.er);
  const c1 = Math.min(sel.sc, sel.ec);
  const c2 = Math.max(sel.sc, sel.ec);
  const lines = [];
  for (let r = r1; r <= r2; r += 1) {
    const vals = [];
    for (let c = c1; c <= c2; c += 1) {
      const cell = sheet.rows[r - 1]?.cells[c - 1];
      const st = cell ? app.template.styles[cell.styleId] : null;
      vals.push(cell ? cellText(cell, st) : "");
    }
    lines.push(vals.join("\t"));
  }
  return lines.join("\n");
}

async function copyText(text) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }
  } catch {}
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.position = "fixed";
  ta.style.left = "-9999px";
  document.body.appendChild(ta);
  ta.select();
  document.execCommand("copy");
  document.body.removeChild(ta);
}
function openSettingsDialog() {
  const s = app.state.settings;
  dom.settingOrder.value = s.orderNumber;
  dom.settingRequest.value = s.requestNumber;
  dom.settingDate.value = s.changeDate;
  dom.settingVersion.value = s.version || "";
  dom.settingVat.value = decToPct(s.vatRate);
  dom.settingMode.value = s.totalMode;
  dom.settingsDialog.showModal();
}

function applySettingsForm() {
  app.state.settings.orderNumber = dom.settingOrder.value.trim();
  app.state.settings.requestNumber = dom.settingRequest.value.trim();
  app.state.settings.changeDate = dom.settingDate.value;
  app.state.settings.version = dom.settingVersion.value.trim();
  app.state.settings.vatRate = pctToDec(dom.settingVat.value);
  app.state.settings.totalMode = dom.settingMode.value === "withDiscount" ? "withDiscount" : "withoutDiscount";
  addChangesJournal("settings.update", "dialog apply");
}

function exportJson() {
  const payload = {
    format: "specforge-kp/v1",
    developer: DEV_LABEL,
    exportedAt: new Date().toISOString(),
    state: app.state,
    agent: {
      sheetOverrides: app.ai.sheetOverrides,
    },
  };
  download(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }), `${exportName()}.json`);
  toast("JSON экспортирован");
}

async function importJson(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  const lowerName = String(file.name || "").toLowerCase();
  try {
    if (lowerName.endsWith(".xlsx") || lowerName.endsWith(".xlsm")) {
      const imported = await importExcelState(file);
      app.state = normalizeState(imported);
      app.ai.sheetOverrides = {};
      addChangesJournal("import.xlsx", file.name);
      toast("Excel импортирован");
    } else {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const raw = parsed.state || parsed;
      app.state = normalizeState(raw);
      app.ai.sheetOverrides = normalizeSheetOverrides(parsed.agent?.sheetOverrides || raw.agent?.sheetOverrides);
      addChangesJournal("import.json", file.name);
      toast("JSON импортирован");
    }
    app.ui.treeSel = { type: "settings" };
    app.ui.activeSheetId = "summary";
    app.ui.selection = null;
    renderAll();
  } catch (err) {
    console.error(err);
    toast("Ошибка импорта файла");
  } finally {
    dom.importFile.value = "";
  }
}

async function importExcelState(file) {
  if (!window.ExcelJS) throw new Error("ExcelJS unavailable");
  const wb = new window.ExcelJS.Workbook();
  await wb.xlsx.load(await file.arrayBuffer());

  const defaults = makeDefaultState();
  const settings = { ...defaults.settings };
  let titleParsed = false;

  const summaryWs = wb.worksheets.find((ws) => isSummarySheetName(ws?.name));
  if (summaryWs) {
    const vat = excelNum(summaryWs.getCell("F2").value);
    if (Number.isFinite(vat)) settings.vatRate = normalizePercentDecimal(vat);
    const f = excelFormula(summaryWs.getCell("E2").value);
    if (/\!Q\d+/i.test(f)) settings.totalMode = "withDiscount";
  }

  let projectWs = null;
  const consByAbbr = new Map();
  const mainSheets = [];

  for (const ws of wb.worksheets) {
    const name = String(ws.name || "").trim();
    if (!name) continue;
    if (isSummarySheetName(name)) continue;

    if (isConsumableAssemblySheetName(name)) {
      const abbr = stripConsumablePrefix(name);
      consByAbbr.set(abbr, ws);
      if (!titleParsed) {
        titleParsed = applySettingsFromTitle(settings, excelText(ws.getCell("A1").value));
      }
      continue;
    }

    if (isMainAssemblySheetName(name)) {
      const abbr = stripMainPrefix(name);
      mainSheets.push({ ws, abbr, separate: true });
      if (!titleParsed) {
        titleParsed = applySettingsFromTitle(settings, excelText(ws.getCell("A1").value));
      }
      continue;
    }

    if (isProjectConsumablesSheetName(name)) {
      projectWs = ws;
      if (!titleParsed) {
        titleParsed = applySettingsFromTitle(settings, excelText(ws.getCell("A1").value));
      }
      continue;
    }

    mainSheets.push({ ws, abbr: name, separate: false });
    if (!titleParsed) {
      titleParsed = applySettingsFromTitle(settings, excelText(ws.getCell("A1").value));
    }
  }

  const assemblies = [];
  for (const item of mainSheets) {
    const ws = item.ws;
    const fullName = parseAssemblyFullName(excelText(ws.getCell("A1").value), settings, item.abbr);
    const assembly = makeAssembly(assemblies.length + 1);
    assembly.fullName = fullName;
    assembly.abbreviation = keepAbbr(item.abbr) || deriveAbbr(fullName);
    assembly.abbrManual = true;

    const parsedMain = parseSheetPositions(ws, settings.vatRate, "main");
    assembly.main = parsedMain.length ? parsedMain : [makePosition()];

    const labor = parseLabor(ws);
    assembly.labor = {
      ...assembly.labor,
      ...labor,
    };

    const manualCons = parseManualConsumables(ws);
    if (Number.isFinite(manualCons.noDisc)) assembly.manualConsNoDisc = manualCons.noDisc;
    if (Number.isFinite(manualCons.disc)) assembly.manualConsDisc = manualCons.disc;

    const consWs = consByAbbr.get(item.abbr) || consByAbbr.get(assembly.abbreviation);
    if (item.separate || consWs) {
      assembly.separateConsumables = true;
      const parsedCons = parseSheetPositions(consWs || ws, settings.vatRate, "consumable");
      assembly.consumable = parsedCons.length ? parsedCons : [makePosition()];
    } else {
      assembly.separateConsumables = false;
      assembly.consumable = [makePosition()];
    }

    assemblies.push(assembly);
  }

  const state = {
    settings,
    assemblies,
    hasProjectConsumables: false,
    projectConsumables: [makePosition()],
  };

  if (projectWs) {
    const parsed = parseSheetPositions(projectWs, settings.vatRate, "consumable");
    state.hasProjectConsumables = true;
    state.projectConsumables = parsed.length ? parsed : [makePosition()];
  }

  return state;
}

function parseSheetPositions(ws, vatRate, kind) {
  if (!ws) return [];
  const layout = detectPositionLayout(ws);
  const maxRows = Math.max(ws.rowCount, layout.startRow + 3);
  const out = [];
  let started = false;
  let emptyRun = 0;

  for (let r = layout.startRow; r <= maxRows; r += 1) {
    const rowText = rowLooseText(ws, r, layout.maxCols);
    if (isPositionsStopRow(rowText, kind)) {
      if (started) break;
      continue;
    }

    const idx = excelCellNum(ws, r, layout.cols.idx);
    const schematic = excelCellText(ws, r, layout.cols.schematic);
    const name = excelCellText(ws, r, layout.cols.name);
    const manufacturer = excelCellText(ws, r, layout.cols.manufacturer);
    const article = excelCellText(ws, r, layout.cols.article);
    const qtyRaw = excelCellNum(ws, r, layout.cols.qty);
    const unit = excelCellText(ws, r, layout.cols.unit);
    const priceCatalogRaw = excelCellNum(ws, r, layout.cols.priceCatalog);
    const basePriceRaw = excelCellNum(ws, r, layout.cols.basePrice);

    const hasIdentity = Boolean(schematic || name || manufacturer || article);
    const hasNumbers = Number.isFinite(idx) || Number.isFinite(qtyRaw) || Number.isFinite(priceCatalogRaw) || Number.isFinite(basePriceRaw);
    if (!hasIdentity && !hasNumbers) {
      emptyRun += 1;
      if (started && emptyRun >= 3) break;
      continue;
    }
    emptyRun = 0;

    const markup = normalizePercentDecimal(excelCellNum(ws, r, layout.cols.markup));
    const discount = normalizePercentDecimal(excelCellNum(ws, r, layout.cols.discount));
    const fromBase = Number.isFinite(basePriceRaw) ? basePriceRaw * (1 + markup) * (1 + vatRate) : NaN;
    const catalogPrice = Number.isFinite(priceCatalogRaw) ? priceCatalogRaw : (Number.isFinite(fromBase) ? fromBase : 0);

    if (!Number.isFinite(idx) && !hasIdentity) continue;
    started = true;

    out.push({
      id: uid(),
      schematic,
      name,
      manufacturer,
      article,
      qty: num(qtyRaw, 1),
      unit: unit || "шт",
      priceCatalogVatMarkup: round2(catalogPrice),
      markup,
      discount,
      supplier: excelCellText(ws, r, layout.cols.supplier),
      note: excelCellText(ws, r, layout.cols.note),
    });
  }

  return out;
}

function parseLabor(ws) {
  const result = {};
  const maxRows = Math.max(ws.rowCount, 20);
  const maxCols = Math.max(19, ws.actualColumnCount || ws.columnCount || 19);

  const dev = findCellByText(ws, /разработка\s*схем/i, maxRows, maxCols);
  if (dev) {
    const nums = rowNumbers(ws, dev.row, dev.col + 1, maxCols);
    if (nums.length > 0) result.devCoeff = normalizeCoeff(nums[0]);
    if (nums.length > 1) result.devHours = num(nums[1], 0);
    if (nums.length > 2) result.devRate = num(nums[2], 0);
  }

  const assm = findCellByText(ws, /работа\s*по\s*сборке/i, maxRows, maxCols);
  if (assm) {
    const nums = rowNumbers(ws, assm.row, assm.col + 1, maxCols);
    if (nums.length > 0) result.assmCoeff = normalizeCoeff(nums[0]);
    if (nums.length > 1) result.assmHours = num(nums[1], 0);
    if (nums.length > 2) result.assmRate = num(nums[2], 0);
  }

  const profit = findCellByText(ws, /прибыл/i, maxRows, maxCols);
  if (profit) {
    const nums = rowNumbers(ws, profit.row, profit.col + 1, maxCols);
    if (nums.length > 0) result.profitCoeff = normalizePercentDecimal(nums[0]);
  }

  return result;
}

function parseManualConsumables(ws) {
  const maxRows = Math.max(ws.rowCount, 20);
  const maxCols = Math.max(19, ws.actualColumnCount || ws.columnCount || 19);
  const hit = findCellByText(ws, /расходн\w*\s*материал/i, maxRows, maxCols);
  if (!hit) return { noDisc: 0, disc: 0 };

  const fixedNoDisc = excelCellNum(ws, hit.row, 11);
  const fixedDisc = excelCellNum(ws, hit.row, 17);
  if (Number.isFinite(fixedNoDisc) || Number.isFinite(fixedDisc)) {
    return {
      noDisc: num(fixedNoDisc, 0),
      disc: num(fixedDisc, 0),
    };
  }

  const nums = rowNumbers(ws, hit.row, hit.col + 1, maxCols);
  if (nums.length >= 2) {
    return {
      noDisc: num(nums[0], 0),
      disc: num(nums[nums.length - 1], 0),
    };
  }
  if (nums.length === 1) {
    return { noDisc: num(nums[0], 0), disc: num(nums[0], 0) };
  }
  return { noDisc: 0, disc: 0 };
}

function isSummarySheetName(name) {
  return /^общ/i.test(String(name || "").trim());
}

function isMainAssemblySheetName(name) {
  return /^осн\.?\s*мат\.?/i.test(String(name || "").trim());
}

function isConsumableAssemblySheetName(name) {
  return /^расх\.?\s*мат\.?/i.test(String(name || "").trim());
}

function isProjectConsumablesSheetName(name) {
  return /^расходник/i.test(String(name || "").trim());
}

function stripMainPrefix(name) {
  return String(name || "").replace(/^осн\.?\s*мат\.?\s*/i, "").trim();
}

function stripConsumablePrefix(name) {
  return String(name || "").replace(/^расх\.?\s*мат\.?\s*/i, "").trim();
}

function parseHeaderText(v) {
  return String(v || "")
    .toLowerCase()
    .replace(/\r?\n+/g, " ")
    .replace(/[^\p{L}\p{N}%]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function headerHasAny(text, aliases) {
  return aliases.some((a) => text.includes(a));
}

function isCatalogPriceHeader(text) {
  if (!text.includes("цена")) return false;
  if (text.includes("без скид") || text.includes("нацен") || text.includes("с ндс")) return true;
  return false;
}

function isBasePriceHeader(text) {
  return text.includes("цена") && text.includes("без ндс") && !text.includes("с ндс");
}

function detectPositionLayout(ws) {
  const defaults = {
    idx: 1,
    schematic: 2,
    name: 3,
    manufacturer: 4,
    article: 5,
    qty: 6,
    unit: 7,
    basePrice: 8,
    priceCatalog: 9,
    markup: 12,
    discount: 13,
    supplier: 18,
    note: 19,
  };
  const maxRows = Math.min(Math.max(ws.rowCount, 12), 50);
  const maxCols = Math.max(19, ws.actualColumnCount || ws.columnCount || 19);

  let best = null;
  for (let r = 1; r <= maxRows; r += 1) {
    const cols = {};
    let score = 0;
    for (let c = 1; c <= maxCols; c += 1) {
      const txt = parseHeaderText(excelText(ws.getCell(r, c).value));
      if (!txt) continue;

      if (!cols.idx && (txt.includes("п п") || txt.includes("№") || txt === "n")) {
        cols.idx = c;
        score += 2;
      }
      if (!cols.schematic && headerHasAny(txt, ["обознач", "схем", "чертеж"])) {
        cols.schematic = c;
        score += 1;
      }
      if (!cols.name && headerHasAny(txt, ["наименование", "марка", "позиция"])) {
        cols.name = c;
        score += 2;
      }
      if (!cols.manufacturer && headerHasAny(txt, ["производ", "бренд", "завод"])) {
        cols.manufacturer = c;
        score += 1;
      }
      if (!cols.article && headerHasAny(txt, ["артикул", "код", "каталож", "партномер"])) {
        cols.article = c;
        score += 1;
      }
      if (!cols.qty && headerHasAny(txt, ["кол во", "колич", "qty"])) {
        cols.qty = c;
        score += 2;
      }
      if (!cols.unit && headerHasAny(txt, ["ед изм", "единиц", "unit"])) {
        cols.unit = c;
        score += 1;
      }
      if (!cols.markup && txt.includes("нацен")) {
        cols.markup = c;
        score += 1;
      }
      if (!cols.discount && txt.includes("скид")) {
        cols.discount = c;
        score += 1;
      }
      if (!cols.supplier && txt.includes("поставщ")) cols.supplier = c;
      if (!cols.note && (txt.includes("примеч") || txt.includes("коммент"))) cols.note = c;

      if (!cols.priceCatalog && isCatalogPriceHeader(txt)) {
        cols.priceCatalog = c;
        score += 2;
      } else if (!cols.basePrice && isBasePriceHeader(txt)) {
        cols.basePrice = c;
        score += 1;
      } else if (!cols.priceCatalog && txt.includes("цена")) {
        cols.priceCatalog = c;
        score += 1;
      }
    }

    if (!best || score > best.score) best = { row: r, cols, score };
  }

  const useDetected = best && best.score >= 4;
  const cols = { ...defaults, ...(useDetected ? best.cols : {}) };
  if (!cols.basePrice) cols.basePrice = defaults.basePrice;
  if (!cols.priceCatalog) cols.priceCatalog = defaults.priceCatalog;

  return {
    headerRow: useDetected ? best.row : 2,
    startRow: (useDetected ? best.row : 2) + 1,
    maxCols,
    cols,
  };
}

function rowLooseText(ws, row, maxCols) {
  const out = [];
  for (let c = 1; c <= maxCols; c += 1) {
    const t = excelText(ws.getCell(row, c).value);
    if (t) out.push(t);
  }
  return parseHeaderText(out.join(" "));
}

function isPositionsStopRow(text, kind) {
  if (!text) return false;
  if (kind === "main" && (text.includes("разработка схем") || text.includes("расходный материал"))) return true;
  return text.includes("итого");
}

function excelCellText(ws, row, col) {
  if (!Number.isFinite(col) || col <= 0) return "";
  return excelText(ws.getCell(row, col).value);
}

function excelCellNum(ws, row, col) {
  if (!Number.isFinite(col) || col <= 0) return NaN;
  return excelNum(ws.getCell(row, col).value);
}

function findCellByText(ws, pattern, maxRows, maxCols) {
  for (let r = 1; r <= maxRows; r += 1) {
    for (let c = 1; c <= maxCols; c += 1) {
      const txt = parseHeaderText(excelText(ws.getCell(r, c).value));
      if (txt && pattern.test(txt)) return { row: r, col: c };
    }
  }
  return null;
}

function rowNumbers(ws, row, fromCol, maxCols) {
  const nums = [];
  for (let c = Math.max(1, fromCol); c <= maxCols; c += 1) {
    const n = excelNum(ws.getCell(row, c).value);
    if (Number.isFinite(n)) nums.push(n);
  }
  return nums;
}

function applySettingsFromTitle(settings, titleRaw) {
  const title = String(titleRaw || "").split("|")[0].trim();
  if (!title) return false;

  const orderMatch = title.match(/^([0-9A-Za-zА-Яа-я-]+)\s+/);
  if (orderMatch) settings.orderNumber = orderMatch[1];

  const reqMatch = title.match(/\(([^)]+)\)/);
  if (reqMatch) settings.requestNumber = String(reqMatch[1]).trim();

  const dateMatch = title.match(/изм\.\s*(\d{2})\.(\d{2})\.(\d{4})/i);
  if (dateMatch) settings.changeDate = `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}`;

  const verMatch = title.match(/вер\.\s*([^\s|]+)/i);
  if (verMatch) settings.version = String(verMatch[1]).trim();

  return Boolean(orderMatch || reqMatch || dateMatch || verMatch);
}

function parseAssemblyFullName(titleRaw, settings, fallback) {
  const title = String(titleRaw || "").split("|")[0].trim();
  if (!title) return fallback || "Сборка";
  const order = settings.orderNumber ? escapeReg(settings.orderNumber) : "[0-9A-Za-zА-Яа-я-]+";
  const req = settings.requestNumber ? escapeReg(settings.requestNumber) : "[^)]+";
  const m = title.match(new RegExp(`^${order}\\s+(.+?)\\s*\\(${req}\\)`));
  if (m && m[1]) return m[1].trim();
  return fallback || "Сборка";
}

function excelPrimitive(v) {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v;
  if (typeof v === "object") {
    if (Array.isArray(v.richText)) return v.richText.map((x) => x.text || "").join("");
    if (typeof v.text === "string") return v.text;
    if (v.result !== undefined) return excelPrimitive(v.result);
    if (typeof v.hyperlink === "string") return v.hyperlink;
    return null;
  }
  return v;
}

function excelText(v) {
  const p = excelPrimitive(v);
  if (p === null || p === undefined) return "";
  if (p instanceof Date) return p.toISOString().slice(0, 10);
  return String(p).trim();
}

function excelNum(v) {
  const p = excelPrimitive(v);
  if (typeof p === "number" && Number.isFinite(p)) return p;
  if (p instanceof Date) return NaN;
  const s = String(p ?? "").replace(/\s+/g, "").replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

function excelFormula(v) {
  return v && typeof v === "object" && typeof v.formula === "string" ? v.formula : "";
}

function normalizeCoeff(v) {
  const n = num(v, 0);
  return n > 3 && n <= 300 ? n / 100 : n;
}

function escapeReg(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeState(raw) {
  const base = makeDefaultState();
  const s = raw?.settings || {};
  const state = {
    settings: {
      orderNumber: String(s.orderNumber || base.settings.orderNumber),
      requestNumber: String(s.requestNumber || base.settings.requestNumber),
      changeDate: String(s.changeDate || base.settings.changeDate),
      version: String(s.version || ""),
      vatRate: normVat(s.vatRate, base.settings.vatRate),
      totalMode: s.totalMode === "withDiscount" ? "withDiscount" : "withoutDiscount",
    },
    assemblies: Array.isArray(raw?.assemblies) ? raw.assemblies.map((a, i) => normAssembly(a, i + 1)) : [],
    hasProjectConsumables: Boolean(raw?.hasProjectConsumables),
    projectConsumables: Array.isArray(raw?.projectConsumables) && raw.projectConsumables.length ? raw.projectConsumables.map(normPosition) : [makePosition()],
  };
  return state;
}

function normalizeSheetOverrides(raw) {
  if (!raw || typeof raw !== "object") return {};
  const out = {};
  for (const [sheetId, cells] of Object.entries(raw)) {
    if (!cells || typeof cells !== "object") continue;
    const map = {};
    for (const [key, patch] of Object.entries(cells)) {
      if (!/^\d+:\d+$/.test(key)) continue;
      map[key] = {
        value: normalizeAgentValue(patch?.value ?? null),
        formula: String(patch?.formula || ""),
      };
    }
    if (Object.keys(map).length) out[String(sheetId)] = map;
  }
  return out;
}

function normVat(v, fallback) {
  return normalizePercentDecimal(v, fallback);
}

function normAssembly(a, i) {
  const b = makeAssembly(i);
  const rawAbbr = keepAbbr(a?.abbreviation);
  return {
    id: String(a?.id || uid()),
    fullName: String(a?.fullName || b.fullName),
    abbreviation: rawAbbr || b.abbreviation,
    abbrManual: Boolean(a?.abbrManual),
    separateConsumables: Boolean(a?.separateConsumables),
    main: normPosList(a?.main),
    consumable: normPosList(a?.consumable),
    manualConsNoDisc: num(a?.manualConsNoDisc, b.manualConsNoDisc),
    manualConsDisc: num(a?.manualConsDisc, b.manualConsDisc),
    labor: {
      devCoeff: num(a?.labor?.devCoeff, b.labor.devCoeff),
      devHours: num(a?.labor?.devHours, b.labor.devHours),
      devRate: num(a?.labor?.devRate, b.labor.devRate),
      assmCoeff: num(a?.labor?.assmCoeff, b.labor.assmCoeff),
      assmHours: num(a?.labor?.assmHours, b.labor.assmHours),
      assmRate: num(a?.labor?.assmRate, b.labor.assmRate),
      profitCoeff: num(a?.labor?.profitCoeff, b.labor.profitCoeff),
    },
  };
}

function normPosList(list) {
  return Array.isArray(list) && list.length ? list.map(normPosition) : [makePosition()];
}

function normPosition(p) {
  const b = makePosition();
  const m = num(p?.markup, b.markup);
  const d = num(p?.discount, b.discount);
  return {
    id: String(p?.id || uid()),
    schematic: String(p?.schematic || ""),
    name: String(p?.name || ""),
    manufacturer: String(p?.manufacturer || ""),
    article: String(p?.article || ""),
    qty: num(p?.qty, b.qty),
    unit: String(p?.unit || b.unit),
    priceCatalogVatMarkup: num(p?.priceCatalogVatMarkup ?? p?.priceWithoutVat, b.priceCatalogVatMarkup),
    markup: m > 1 && m <= 100 ? m / 100 : m,
    discount: d > 1 && d <= 100 ? d / 100 : d,
    supplier: String(p?.supplier || ""),
    note: String(p?.note || ""),
  };
}

async function exportXlsx() {
  if (!window.ExcelJS) {
    toast("ExcelJS не загружен");
    return;
  }

  try {
    const wb = new window.ExcelJS.Workbook();
    wb.creator = DEV_LABEL;
    wb.created = new Date();

    for (const s of app.workbook.sheets) {
      const ws = wb.addWorksheet(s.name, {
        views: [{
          state: "normal",
          zoomScale: Math.round(currentZoom(s) * 100),
        }],
      });

      ws.columns = s.cols.map((w) => ({ width: pxToExcelW(w) }));

      for (let r = 0; r < s.rows.length; r += 1) {
        const sr = s.rows[r];
        const wr = ws.getRow(r + 1);
        wr.height = pxToPt(sr.height);
        for (let c = 0; c < sr.cells.length; c += 1) {
          const cell = sr.cells[c];
          const wc = wr.getCell(c + 1);
          wc.value = cell.formula ? { formula: cell.formula, result: excelValue(cell.value) } : excelValue(cell.value);
          const style = excelStyle(app.template.styles[cell.styleId]);
          if (style) wc.style = style;
        }
      }

      for (const m of s.merges) ws.mergeCells(m);
    }

    const buf = await wb.xlsx.writeBuffer();
    download(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `${exportName()}.xlsx`);
    toast("XLSX экспортирован");
  } catch (err) {
    console.error(err);
    toast("Ошибка экспорта XLSX");
  }
}

function excelStyle(s) {
  if (!s) return null;
  const style = {
    font: {
      name: s.font.name,
      size: s.font.size,
      bold: s.font.bold,
      italic: s.font.italic,
      color: { argb: `FF${s.font.color.slice(1).toUpperCase()}` },
    },
  };

  if (s.fill.type === "solid" && s.fill.color) {
    style.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${s.fill.color.slice(1).toUpperCase()}` } };
  }

  const b = {};
  for (const side of ["left", "right", "top", "bottom"]) {
    const v = s.border[side];
    if (v) b[side] = { style: v.style, color: { argb: `FF${v.color.slice(1).toUpperCase()}` } };
  }
  if (Object.keys(b).length) style.border = b;

  style.alignment = { horizontal: s.align.h, vertical: s.align.v, wrapText: s.align.wrap };

  const fmt = s.numFmtCode || ({ 2: "0.00", 9: "0%", 10: "0.00%" }[s.numFmtId] || "");
  if (fmt && fmt !== "General") style.numFmt = fmt;

  return style;
}

function excelValue(v) {
  if (v === null || v === undefined || v === "") return null;
  return typeof v === "number" || typeof v === "boolean" ? v : String(v);
}

function exportName() {
  const order = safeToken(app.state.settings.orderNumber || "kp");
  const req = safeToken(app.state.settings.requestNumber || "request");
  return `kp_${order}_${req}`;
}

function safeToken(v) {
  return String(v).replace(/[\\/:*?"<>|\s]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "x";
}

function download(blob, name) {
  const u = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = u;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(u);
}

function money(v) {
  return `${new Intl.NumberFormat("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num(v))} ₽`;
}

function esc(v) {
  return String(v ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function toast(text) {
  dom.toast.textContent = text;
  dom.toast.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => dom.toast.classList.remove("show"), 1600);
}

function uid() {
  return `id_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
}
