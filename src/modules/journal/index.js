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
      for (const k of ["currentSheet", "allSheets", "selection", "webSearch"]) {
        if (typeof parsed[k] === "boolean") app.ai.options[k] = parsed[k];
      }
    }
  } catch {}

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
