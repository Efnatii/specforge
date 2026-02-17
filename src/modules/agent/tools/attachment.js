const TEXT_ATTACHMENT_EXT_RE = /\.(txt|md|csv|json|xml|yml|yaml|js|ts|html|css|ini|log|sql)$/i;
const EXCEL_ATTACHMENT_EXT_RE = /\.(xlsx|xlsm)$/i;
const EXCEL_ATTACHMENT_TYPE_RE = /(application\/vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet|application\/vnd\.ms-excel\.sheet\.macroenabled\.12)/i;
const TEXT_ATTACHMENT_MAX_CHARS = 120000;
const EXCEL_ATTACHMENT_MAX_CHARS = 120000;
const EXCEL_ATTACHMENT_MAX_SHEETS = 6;
const EXCEL_ATTACHMENT_MAX_ROWS = 120;
const EXCEL_ATTACHMENT_MAX_COLS = 20;
const ATTACHMENT_CELL_MAX_CHARS = 240;
const REASONING_EFFORT_ORDER = ["low", "medium", "high"];
const WEB_SEARCH_CONTEXT_SIZE_ORDER = ["low", "medium", "high"];

export class AgentAttachmentModule {
  constructor({
    app,
    dom,
    addChangesJournal,
    saveAiOptions,
    renderAiUi,
    toast,
    createId,
    num,
  }) {
    if (!app) throw new Error("AgentAttachmentModule requires app");
    if (!dom) throw new Error("AgentAttachmentModule requires dom");
    if (typeof addChangesJournal !== "function") throw new Error("AgentAttachmentModule requires addChangesJournal()");
    if (typeof saveAiOptions !== "function") throw new Error("AgentAttachmentModule requires saveAiOptions()");
    if (typeof renderAiUi !== "function") throw new Error("AgentAttachmentModule requires renderAiUi()");
    if (typeof toast !== "function") throw new Error("AgentAttachmentModule requires toast()");
    if (typeof createId !== "function") throw new Error("AgentAttachmentModule requires createId()");
    if (typeof num !== "function") throw new Error("AgentAttachmentModule requires num()");

    this._app = app;
    this._dom = dom;
    this._addChangesJournal = addChangesJournal;
    this._saveAiOptions = saveAiOptions;
    this._renderAiUi = renderAiUi;
    this._toast = toast;
    this._createId = createId;
    this._num = num;
  }

  onAgentChipClick(e) {
    const webActionBtn = e.target.closest("[data-web-search-action]");
    if (webActionBtn) {
      const action = String(webActionBtn.dataset.webSearchAction || "");
      if (action === "close") {
        this._app.ai.webSearchPopoverOpen = false;
        this._renderAiUi();
      }
      return;
    }

    const reasoningActionBtn = e.target.closest("[data-reasoning-action]");
    if (reasoningActionBtn) {
      const action = String(reasoningActionBtn.dataset.reasoningAction || "");
      if (action === "close") {
        this._app.ai.reasoningPopoverOpen = false;
        this._renderAiUi();
      }
      return;
    }

    const settingsBtn = e.target.closest("[data-ai-chip-option]");
    if (settingsBtn) {
      const option = String(settingsBtn.dataset.aiChipOption || "");
      if (option === "webSearchSettings") {
        this._app.ai.reasoningPopoverOpen = false;
        this._app.ai.webSearchPopoverOpen = !this._app.ai.webSearchPopoverOpen;
        this._renderAiUi();
        return;
      }
      if (option === "reasoningSettings") {
        this._app.ai.webSearchPopoverOpen = false;
        this._app.ai.reasoningPopoverOpen = !this._app.ai.reasoningPopoverOpen;
        this._renderAiUi();
        return;
      }
    }

    const remove = e.target.closest("button.remove");
    if (!remove) return;
    const chip = e.target.closest(".agent-chip");
    if (!chip) return;
    const type = chip.dataset.chipType;
    if (type !== "file") return;

    const id = chip.dataset.chipId;
    const removed = this._app.ai.attachments.find((f) => f.id === id);
    this._app.ai.attachments = this._app.ai.attachments.filter((f) => f.id !== id);
    if (removed) {
      this._addChangesJournal("ai.file.detach", removed.name);
      this._invalidateFileSearchSync();
    }
    this._renderAiUi();
  }

  onDocumentClick(e) {
    if (!this._app.ai.webSearchPopoverOpen && !this._app.ai.reasoningPopoverOpen) return;
    const target = e?.target || null;
    if (!target || typeof target.closest !== "function") return;
    if (target.closest("[data-web-search-wrap]")) return;
    if (target.closest("[data-reasoning-wrap]")) return;
    this._app.ai.webSearchPopoverOpen = false;
    this._app.ai.reasoningPopoverOpen = false;
    this._renderAiUi();
  }

  onAgentContextIconsClick(e) {
    const btn = e.target.closest("[data-ai-option]");
    if (!btn) return;
    const option = String(btn.dataset.aiOption || "");

    if (option === "files") {
      this._dom.agentAttachmentInput.click();
      return;
    }

    if (option === "webSearch") {
      const next = !Boolean(this._app.ai.options.webSearch);
      this._app.ai.options.webSearch = next;
      if (!next) this._app.ai.webSearchPopoverOpen = false;
      this._saveAiOptions();
      this._addChangesJournal("ai.option", `webSearch=${next ? "on" : "off"}`);
      this._renderAiUi();
      return;
    }

    if (option === "reasoning") {
      const current = this._app.ai.options.reasoning !== false;
      const next = !current;
      this._app.ai.options.reasoning = next;
      if (!next) this._app.ai.reasoningPopoverOpen = false;
      this._saveAiOptions();
      this._addChangesJournal("ai.option", `reasoning=${next ? "on" : "off"}`);
      this._renderAiUi();
      return;
    }

    this._app.ai.webSearchPopoverOpen = false;
    this._app.ai.reasoningPopoverOpen = false;
    if (!(option in this._app.ai.options)) return;
    this._app.ai.options[option] = !this._app.ai.options[option];
    if (option === "allowQuestions" && !this._app.ai.options[option]) {
      this._app.ai.pendingQuestion = null;
    }
    this._saveAiOptions();
    this._addChangesJournal("ai.option", `${option}=${this._app.ai.options[option] ? "on" : "off"}`);
    this._renderAiUi();
  }

  onAgentContextIconsChange(e) {
    const target = e?.target || null;
    const webField = String(target?.dataset?.webSearchConfig || "");
    const reasoningField = String(target?.dataset?.reasoningConfig || "");

    if (webField === "country") {
      const next = this._normalizeWebSearchCountry(target.value, this._app.ai.options.webSearchCountry || "RU");
      if (this._app.ai.options.webSearchCountry !== next) {
        this._app.ai.options.webSearchCountry = next;
        this._saveAiOptions();
        this._addChangesJournal("ai.option", `webSearchCountry=${next}`);
      }
      this._renderAiUi();
      return;
    }

    if (webField === "contextSize") {
      const next = this._normalizeWebSearchContextSize(target.value, this._app.ai.options.webSearchContextSize || "high");
      if (this._app.ai.options.webSearchContextSize !== next) {
        this._app.ai.options.webSearchContextSize = next;
        this._saveAiOptions();
        this._addChangesJournal("ai.option", `webSearchContextSize=${next}`);
      }
      this._renderAiUi();
      return;
    }

    if (reasoningField === "effort") {
      const next = this._normalizeReasoningEffort(target.value, this._app.ai.options.reasoningEffort || "medium");
      if (this._app.ai.options.reasoningEffort !== next) {
        this._app.ai.options.reasoningEffort = next;
        this._saveAiOptions();
        this._addChangesJournal("ai.option", `reasoningEffort=${next}`);
      }
      this._renderAiUi();
    }
  }

  async onAgentAttachmentsPicked(e) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const incoming = [];
    for (const file of files) {
      const entry = await this._makeAgentAttachment(file);
      incoming.push(entry);
    }
    this._app.ai.attachments.push(...incoming);
    this._invalidateFileSearchSync();
    this._dom.agentAttachmentInput.value = "";
    this._addChangesJournal("ai.file.attach", `Добавлено файлов: ${incoming.length}`);
    this._renderAiUi();

    const readable = incoming.filter((x) => String(x?.text || "").trim().length > 0).length;
    const failed = incoming.filter((x) => String(x?.parse_error || "").trim()).length;
    const failedPart = failed > 0 ? `, parse errors: ${failed}` : "";
    this._toast(`Файлы прикреплены: ${incoming.length}, readable: ${readable}${failedPart}`);
  }

  _normalizeWebSearchCountry(value, fallback = "RU") {
    const raw = String(value || "").trim().toUpperCase();
    if (/^[A-Z]{2}$/.test(raw)) return raw;
    const fb = String(fallback || "").trim().toUpperCase();
    return /^[A-Z]{2}$/.test(fb) ? fb : "RU";
  }

  _normalizeWebSearchContextSize(value, fallback = "high") {
    const raw = String(value || "").trim().toLowerCase();
    if (WEB_SEARCH_CONTEXT_SIZE_ORDER.includes(raw)) return raw;
    const fb = String(fallback || "").trim().toLowerCase();
    return WEB_SEARCH_CONTEXT_SIZE_ORDER.includes(fb) ? fb : "high";
  }

  _normalizeReasoningEffort(value, fallback = "medium") {
    const raw = String(value || "").trim().toLowerCase();
    if (REASONING_EFFORT_ORDER.includes(raw)) return raw;
    const fb = String(fallback || "").trim().toLowerCase();
    return REASONING_EFFORT_ORDER.includes(fb) ? fb : "medium";
  }

  _invalidateFileSearchSync() {
    if (!this._app.ai.fileSearch || typeof this._app.ai.fileSearch !== "object") {
      this._app.ai.fileSearch = { vectorStoreId: "", attachmentsSignature: "", syncedAt: 0 };
      return;
    }
    this._app.ai.fileSearch.vectorStoreId = "";
    this._app.ai.fileSearch.attachmentsSignature = "";
    this._app.ai.fileSearch.syncedAt = 0;
  }

  async _makeAgentAttachment(file) {
    const name = String(file.name || "file");
    const type = String(file.type || "application/octet-stream");
    let text = "";
    let truncated = false;
    let parser = "";
    let parseError = "";

    if (this._isExcelAttachment(name, type)) {
      const parsedExcel = await this._extractExcelText(file);
      text = parsedExcel.text;
      truncated = parsedExcel.truncated;
      parser = parsedExcel.parser;
      parseError = parsedExcel.error;
    } else if (this._isTextAttachment(name, type)) {
      const parsedText = await this._extractText(file, TEXT_ATTACHMENT_MAX_CHARS);
      text = parsedText.text;
      truncated = parsedText.truncated;
      parser = parsedText.parser;
      parseError = parsedText.error;
    }

    return {
      id: this._createId(),
      name,
      size: this._num(file.size, 0),
      type,
      text,
      truncated,
      parser,
      parse_error: parseError,
    };
  }

  _isTextAttachment(name, type) {
    return /^text\//i.test(type) || TEXT_ATTACHMENT_EXT_RE.test(name);
  }

  _isExcelAttachment(name, type) {
    return EXCEL_ATTACHMENT_EXT_RE.test(name) || EXCEL_ATTACHMENT_TYPE_RE.test(type);
  }

  async _extractText(file, maxChars) {
    try {
      const raw = await file.text();
      return this._clipText(raw, maxChars, "text");
    } catch (err) {
      return {
        text: "",
        truncated: false,
        parser: "",
        error: String(err?.message || "attachment text read failed"),
      };
    }
  }

  async _extractExcelText(file) {
    const excelJs = globalThis?.ExcelJS;
    if (!excelJs || typeof excelJs.Workbook !== "function") {
      return { text: "", truncated: false, parser: "", error: "ExcelJS is unavailable" };
    }

    try {
      const workbook = new excelJs.Workbook();
      const arrayBuffer = await file.arrayBuffer();
      await workbook.xlsx.load(arrayBuffer);

      const worksheets = Array.isArray(workbook.worksheets) ? workbook.worksheets : [];
      if (!worksheets.length) return { text: "", truncated: false, parser: "exceljs", error: "" };

      const lines = [];
      let charCount = 0;
      let truncated = false;

      const pushLine = (lineRaw = "") => {
        if (truncated) return;
        const line = String(lineRaw);
        const projected = charCount + line.length + 1;
        if (projected > EXCEL_ATTACHMENT_MAX_CHARS) {
          const rest = Math.max(0, EXCEL_ATTACHMENT_MAX_CHARS - charCount - 1);
          if (rest > 0) lines.push(line.slice(0, rest));
          truncated = true;
          return;
        }
        lines.push(line);
        charCount = projected;
      };

      for (let sIdx = 0; sIdx < worksheets.length; sIdx += 1) {
        if (sIdx >= EXCEL_ATTACHMENT_MAX_SHEETS) {
          pushLine(`[trimmed sheets <= ${EXCEL_ATTACHMENT_MAX_SHEETS}]`);
          truncated = true;
          break;
        }

        const ws = worksheets[sIdx];
        const sheetName = String(ws?.name || `Sheet${sIdx + 1}`);
        pushLine(`Sheet: ${sheetName}`);

        const rowCount = Math.max(0, Number(ws?.rowCount || 0));
        const colCount = Math.max(0, Number(ws?.columnCount || 0));
        if (rowCount <= 0 || colCount <= 0) {
          pushLine("[empty]");
          if (sIdx + 1 < worksheets.length) pushLine("");
          continue;
        }

        const rows = Math.min(EXCEL_ATTACHMENT_MAX_ROWS, rowCount);
        const cols = Math.min(EXCEL_ATTACHMENT_MAX_COLS, colCount);
        pushLine(new Array(cols).fill(0).map((_, i) => this._colName(i + 1)).join("\t"));

        for (let r = 1; r <= rows; r += 1) {
          const row = ws.getRow(r);
          const values = [];
          for (let c = 1; c <= cols; c += 1) {
            const cellValue = row.getCell(c)?.value;
            values.push(this._excelCellText(cellValue));
          }
          pushLine(values.join("\t"));
          if (truncated) break;
        }

        if (!truncated && (rowCount > rows || colCount > cols)) {
          pushLine(`[trimmed rows <= ${rows}, cols <= ${cols}]`);
        }
        if (!truncated && sIdx + 1 < worksheets.length) pushLine("");
      }

      const text = lines.join("\n");
      return {
        text,
        truncated,
        parser: "exceljs",
        error: "",
      };
    } catch (err) {
      return {
        text: "",
        truncated: false,
        parser: "",
        error: String(err?.message || "excel parse failed"),
      };
    }
  }

  _clipText(raw, maxChars, parser = "") {
    const src = String(raw || "");
    const text = src.slice(0, maxChars);
    return {
      text,
      truncated: src.length > maxChars,
      parser,
      error: "",
    };
  }

  _excelCellText(value) {
    if (value === null || value === undefined) return "";

    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      return this._sanitizeCellText(String(value));
    }
    if (value instanceof Date) {
      return this._sanitizeCellText(value.toISOString());
    }
    if (typeof value !== "object") {
      return this._sanitizeCellText(String(value));
    }

    if (Array.isArray(value?.richText)) {
      const text = value.richText.map((part) => String(part?.text || "")).join("");
      return this._sanitizeCellText(text);
    }

    if (value?.formula !== undefined) {
      const formula = String(value.formula || "").trim();
      const result = value?.result !== undefined ? this._excelCellText(value.result) : "";
      if (result && formula) return this._sanitizeCellText(`${result} (= ${formula})`);
      if (formula) return this._sanitizeCellText(`=${formula}`);
      return this._sanitizeCellText(result);
    }

    if (value?.hyperlink) {
      const text = String(value?.text || "").trim();
      const link = String(value.hyperlink || "").trim();
      return this._sanitizeCellText(text || link);
    }

    if (value?.text !== undefined) {
      return this._sanitizeCellText(String(value.text || ""));
    }

    if (value?.result !== undefined) {
      return this._excelCellText(value.result);
    }

    if (value?.error) {
      return this._sanitizeCellText(String(value.error));
    }

    try {
      return this._sanitizeCellText(JSON.stringify(value));
    } catch {
      return "";
    }
  }

  _sanitizeCellText(textRaw) {
    return String(textRaw || "")
      .replace(/[\t\r\n]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, ATTACHMENT_CELL_MAX_CHARS);
  }

  _colName(col) {
    let n = Number(col);
    let out = "";
    while (n > 0) {
      const r = (n - 1) % 26;
      out = String.fromCharCode(65 + r) + out;
      n = Math.floor((n - 1) / 26);
    }
    return out || "A";
  }
}
