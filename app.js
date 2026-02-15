
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
};
const MAX_CHAT_JOURNAL = 220;
const MAX_TABLE_JOURNAL = 240;
const MAX_EXTERNAL_JOURNAL = 240;
const MAX_CHANGES_JOURNAL = 320;

const dom = {
  app: document.getElementById("app"),
  sidebar: document.getElementById("sidebar"),
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
    tableJournal: [],
    externalJournal: [],
    changesJournal: [],
    sheetOverrides: {},
  },
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
    if (!raw) return;
    const parsed = JSON.parse(raw);
    for (const k of ["currentSheet", "allSheets", "selection", "webSearch"]) {
      if (typeof parsed[k] === "boolean") app.ai.options[k] = parsed[k];
    }
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

function addAgentLog(role, text) {
  const clean = String(text || "").trim();
  if (!clean) return;
  const kind = role === "assistant" ? "AI" : "Вы";
  addJournalEntry(app.ai.chatJournal, MAX_CHAT_JOURNAL, kind, clean);
}

function renderAgentJournals() {
  renderJournalList("chat");
  renderJournalList("table");
  renderJournalList("external");
  renderJournalList("changes");
}

function renderJournalList(kind) {
  const map = {
    chat: { listEl: dom.chatJournalList, countEl: dom.chatJournalCount, items: app.ai.chatJournal },
    table: { listEl: dom.tableJournalList, countEl: dom.tableJournalCount, items: app.ai.tableJournal },
    external: { listEl: dom.externalJournalList, countEl: dom.externalJournalCount, items: app.ai.externalJournal },
    changes: { listEl: dom.changesJournalList, countEl: dom.changesJournalCount, items: app.ai.changesJournal },
  };
  const item = map[kind];
  if (!item) return;
  const { listEl, countEl, items } = item;
  if (!listEl || !countEl) return;

  countEl.textContent = String(items.length);
  if (!items.length) {
    listEl.innerHTML = `<div class="agent-journal-empty">Пока пусто</div>`;
    return;
  }

  const html = items
    .slice()
    .reverse()
    .map((it) => `<div class="agent-journal-item"><span class="time">${esc(journalTime(it.ts))}</span><span class="kind">${esc(it.kind)}</span><span class="text">${esc(it.text)}</span></div>`)
    .join("");
  listEl.innerHTML = html;
}

function addTableJournal(kind, text) {
  addJournalEntry(app.ai.tableJournal, MAX_TABLE_JOURNAL, kind, text);
}

function addExternalJournal(kind, text) {
  addJournalEntry(app.ai.externalJournal, MAX_EXTERNAL_JOURNAL, kind, text);
}

function addChangesJournal(kind, text) {
  addJournalEntry(app.ai.changesJournal, MAX_CHANGES_JOURNAL, kind, text);
}

function addJournalEntry(target, limit, kind, text) {
  const entry = {
    ts: Date.now(),
    kind: String(kind || "event").slice(0, 60),
    text: String(text || "").trim().slice(0, 2000),
  };
  if (!entry.text) return;
  target.push(entry);
  if (target.length > limit) target.splice(0, target.length - limit);
  renderAgentJournals();
}

function journalTime(ts) {
  const d = new Date(num(ts, Date.now()));
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  const s = String(d.getSeconds()).padStart(2, "0");
  return `${h}:${m}:${s}`;
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
  return `${s.orderNumber} ${a.fullName || "<Полное название cборки>"} (${s.requestNumber}) ${tag} ${changeLabel()} | ${DEV_LABEL}`;
}

function consumableTitle(a) {
  const s = app.state.settings;
  return `${s.orderNumber} ${a.fullName || "<Полное название cборки>"} (${s.requestNumber}) СП расходный материал ${changeLabel()} | ${DEV_LABEL}`;
}

function projectConsumableTitle() {
  const s = app.state.settings;
  return `${s.orderNumber} Расходники (${s.requestNumber}) СП расходный материал ${changeLabel()} | ${DEV_LABEL}`;
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

  p.push(`<div class="tree-item ${selected(sel, { type: "settings" }) ? "is-selected" : ""}" data-node="settings">Общие настройки</div>`);

  for (const a of app.state.assemblies) {
    p.push(`<details open><summary><span class="tree-summary-label">${esc(a.fullName || "Сборка")} [${esc(a.abbreviation)}]</span><button type="button" class="tree-mini-btn" data-tree-action="dup-assembly" data-id="${a.id}" title="Дублировать сборку" aria-label="Дублировать сборку"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 9h10v10H9zM5 5h10v10" /></svg></button></summary>`);
    p.push(`<div class="tree-item ${selected(sel, { type: "assembly", id: a.id }) ? "is-selected" : ""}" data-node="assembly" data-id="${a.id}">Параметры</div>`);
    p.push(`<div class="tree-item ${selected(sel, { type: "list", id: a.id, list: "main" }) ? "is-selected" : ""}" data-node="list" data-id="${a.id}" data-list="main">Осн. материалы (${a.main.length})</div>`);
    for (const pos of a.main) p.push(`<div class="tree-item small ${selected(sel, { type: "pos", id: a.id, list: "main", pos: pos.id }) ? "is-selected" : ""}" style="padding-left:18px" data-node="pos" data-id="${a.id}" data-list="main" data-pos="${pos.id}">• ${esc(pos.name || "Позиция")}</div>`);

    if (a.separateConsumables) {
      p.push(`<div class="tree-item ${selected(sel, { type: "list", id: a.id, list: "cons" }) ? "is-selected" : ""}" data-node="list" data-id="${a.id}" data-list="cons">Расх. материалы (${a.consumable.length})</div>`);
      for (const pos of a.consumable) p.push(`<div class="tree-item small ${selected(sel, { type: "pos", id: a.id, list: "cons", pos: pos.id }) ? "is-selected" : ""}" style="padding-left:18px" data-node="pos" data-id="${a.id}" data-list="cons" data-pos="${pos.id}">• ${esc(pos.name || "Позиция")}</div>`);
    }

    p.push(`</details>`);
  }

  p.push(`<div class="tree-item ${selected(sel, { type: "projlist" }) ? "is-selected" : ""}" data-node="projlist">Расходники ${app.state.hasProjectConsumables ? "(вкл.)" : "(выкл.)"}</div>`);
  if (app.state.hasProjectConsumables) {
    for (const pos of app.state.projectConsumables) p.push(`<div class="tree-item small ${selected(sel, { type: "projpos", pos: pos.id }) ? "is-selected" : ""}" style="padding-left:18px" data-node="projpos" data-pos="${pos.id}">• ${esc(pos.name || "Позиция")}</div>`);
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
    dom.inspector.innerHTML = `<h3>${s.list === "main" ? "Основные материалы" : "Расходные материалы"}</h3><div class="inline-actions"><button class="btn-flat" data-action="add-pos" data-id="${s.id}" data-list="${s.list}">Добавить позицию</button></div>`;
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
    dom.inspector.innerHTML = `<h3>Расходники</h3><div class="inline-actions"><button class="btn-flat" data-action="toggle-proj">${app.state.hasProjectConsumables ? "Выключить лист" : "Включить лист"}</button><button class="btn-flat" data-action="add-proj-pos" ${app.state.hasProjectConsumables ? "" : "disabled"}>Добавить позицию</button></div>`;
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
      <div class="inline-actions"><button class="btn-flat" data-action="open-settings">Окно настроек</button></div>
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
      <div class="inline-actions"><button class="btn-flat danger" data-action="del-assembly" data-id="${a.id}">Удалить сборку</button></div>
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
      <div class="inline-actions"><button class="btn-flat danger" data-action="del-pos" data-id="${id}" data-list="${list}" data-pos="${p.id}">Удалить позицию</button></div>
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
  if (dom.btnClearChatJournal) {
    dom.btnClearChatJournal.onclick = () => {
      app.ai.chatJournal = [];
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
  app.ai.apiKey = "";
  app.ai.connected = false;
  app.ai.sending = false;
  app.ai.attachments = [];
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

  const text = String(dom.agentPrompt.value || "").trim();
  if (!text) {
    toast("Введите запрос для ИИ");
    return;
  }

  app.ai.sending = true;
  renderAiUi();
  addAgentLog("user", text);
  addChangesJournal("ai.prompt", `Отправлен запрос (${text.length} символов)`);

  try {
    const input = buildAgentInput(text);
    const out = await runOpenAiAgentTurn(input);
    addAgentLog("assistant", out || "Готово.");
    dom.agentPrompt.value = "";
  } catch (err) {
    console.error(err);
    const details = String(err?.message || "Неизвестная ошибка").slice(0, 400);
    addAgentLog("assistant", `Ошибка выполнения: ${details}`);
    toast("Ошибка выполнения запроса ИИ");
  } finally {
    app.ai.sending = false;
    renderAiUi();
  }
}

function buildAgentInput(userText) {
  const parts = [];
  parts.push(`Запрос пользователя:\n${userText}`);

  const ctx = buildAgentContextText();
  if (ctx) parts.push(`Контекст проекта:\n${ctx}`);

  return parts.join("\n\n");
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

async function runOpenAiAgentTurn(userInput) {
  const modelId = currentAiModelMeta().id;
  const input = [{ role: "user", content: [{ type: "input_text", text: userInput }] }];
  let allowWebSearch = Boolean(app.ai.options.webSearch);
  let response = null;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      response = await callOpenAiResponses({
        model: modelId,
        instructions: agentSystemPrompt(),
        input,
        tools: agentToolsSpec(allowWebSearch),
        tool_choice: "auto",
      });
      break;
    } catch (err) {
      const msg = String(err?.message || "");
      const canRetryWithoutWeb = allowWebSearch && isWebSearchToolError(msg);
      if (!canRetryWithoutWeb) throw err;
      allowWebSearch = false;
      addExternalJournal("openai.fallback", "Повтор без web_search tool из-за ошибки 400");
    }
  }

  if (!response) throw new Error("openai no response");

  for (let i = 0; i < 10; i += 1) {
    const calls = extractAgentFunctionCalls(response);
    if (!calls.length) {
      const text = extractAgentText(response);
      return text || "Готово.";
    }

    const outputs = [];
    for (const call of calls) {
      const args = parseJsonSafe(call.arguments, {});
      const result = await executeAgentTool(call.name, args);
      outputs.push({
        type: "function_call_output",
        call_id: call.call_id,
        output: JSON.stringify(result),
      });
    }

    response = await callOpenAiResponses({
      model: modelId,
      previous_response_id: response.id,
      input: outputs,
    });
  }

  throw new Error("agent tool loop limit");
}

function isWebSearchToolError(message) {
  const m = String(message || "").toLowerCase();
  return m.includes("400") && (m.includes("web_search") || m.includes("tool") || m.includes("tools"));
}

function agentSystemPrompt() {
  return [
    "Ты AI-агент внутри SpecForge.",
    "Ты можешь читать и изменять таблицы и состояние проекта через tools.",
    "Перед изменениями проверяй целевые листы/диапазоны.",
    "При изменениях кратко подтверждай, что именно поменял.",
    "Если запрос неясен, задай короткий уточняющий вопрос.",
  ].join(" ");
}

function agentToolsSpec(useWebSearch = app.ai.options.webSearch) {
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
        },
        required: ["updates"],
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
    {
      type: "function",
      name: "set_state_value",
      description: "Изменить значение в состоянии проекта по пути",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string" },
          value: { type: ["string", "number", "boolean", "object", "array", "null"] },
        },
        required: ["path", "value"],
        additionalProperties: false,
      },
    },
  ];

  if (useWebSearch) tools.push({ type: "web_search_preview" });
  return tools;
}

async function callOpenAiResponses(payload) {
  const startedAt = Date.now();
  const isContinuation = Boolean(payload?.previous_response_id);
  const model = String(payload?.model || app.ai.model || "");
  addExternalJournal(
    "openai.request",
    `${isContinuation ? "continue" : "start"} model=${model} tools=${Array.isArray(payload?.tools) ? payload.tools.length : 0}`,
  );

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
    const shortBody = String(body || "").replace(/\s+/g, " ").trim().slice(0, 240);
    addExternalJournal("openai.error", `HTTP ${res.status} /v1/responses (${ms}ms) ${shortBody}`);
    if (res.status === 401 || res.status === 403) {
      disconnectOpenAi();
      throw new Error("openai unauthorized");
    }
    throw new Error(`openai ${res.status}: ${shortBody || "unknown error"}`);
  }

  const parsed = await res.json();
  const ms = Date.now() - startedAt;
  const outCount = Array.isArray(parsed?.output) ? parsed.output.length : 0;
  addExternalJournal("openai.response", `HTTP 200 /v1/responses (${ms}ms), output=${outCount}`);

  const hasWebSearch = Array.isArray(parsed?.output) && parsed.output.some((item) => String(item?.type || "").includes("web_search"));
  if (hasWebSearch) addExternalJournal("web.search", "OpenAI выполнил web_search tool");

  return parsed;
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

async function executeAgentTool(name, args) {
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

    let applied = 0;
    for (const u of updates) {
      const p = parseA1Address(u?.address);
      if (!p) continue;
      setAgentSheetCell(sheet.id, p.row, p.col, u?.value ?? null, u?.formula || "");
      applied += 1;
    }

    renderAll();
    addTableJournal("write_cells", `${sheet.name}: изменено ячеек ${applied}`);
    addChangesJournal("ai.write_cells", `${sheet.name}: ${applied}`);
    return { ok: true, applied, sheet: { id: sheet.id, name: sheet.name } };
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
    try {
      setStatePath(args.path, args.value);
      renderAll();
      addTableJournal("set_state_value", `Изменен путь ${args.path}`);
      addChangesJournal("ai.set_state", args.path);
      return { ok: true };
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

  const name = String(args?.sheet_name || "").trim().toLowerCase();
  if (name) {
    const match = app.workbook.sheets.find((s) => String(s.name || "").trim().toLowerCase() === name);
    if (match) return match;
  }

  return activeSheet();
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
    if (actionBtn.dataset.treeAction === "dup-assembly") {
      duplicateAssembly(actionBtn.dataset.id);
    }
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
    const deleted = assemblyById(a.dataset.id);
    app.state.assemblies = app.state.assemblies.filter((x) => x.id !== a.dataset.id);
    app.ui.treeSel = { type: "settings" };
    app.ui.activeSheetId = "summary";
    renderAll();
    addChangesJournal("assembly.delete", deleted?.fullName || a.dataset.id || "");
    toast("Сборка удалена");
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
    app.state.hasProjectConsumables = !app.state.hasProjectConsumables;
    if (app.state.hasProjectConsumables && !app.state.projectConsumables.length) app.state.projectConsumables = [makePosition()];
    app.ui.treeSel = { type: "projlist" };
    renderAll();
    addChangesJournal("project.consumables", app.state.hasProjectConsumables ? "включены" : "выключены");
    return;
  }

  if (action === "add-proj-pos") {
    if (!app.state.hasProjectConsumables) return;
    const p = makePosition();
    app.state.projectConsumables.push(p);
    app.ui.treeSel = { type: "projpos", pos: p.id };
    renderAll();
    addChangesJournal("project.position.add", p.id);
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

  app.ui.treeSel = { type: "assembly", id: copy.id };
  app.ui.activeSheetId = `assembly:${copy.id}:main`;
  renderAll();
  addChangesJournal("assembly.duplicate", `${src.id} -> ${copy.id}`);
  toast("Сборка продублирована");
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
  const n = num(v, fallback);
  return n > 1 && n <= 100 ? n / 100 : n;
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
