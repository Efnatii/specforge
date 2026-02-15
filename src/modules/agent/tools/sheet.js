export class AgentSheetToolsModule {
  constructor(ctx) {
    this._facade = createAgentSheetToolsInternal(ctx);
    this.tryExecute = this.tryExecute.bind(this);
  }

  async tryExecute(name, args, turnCtx = null) {
    return this._facade.tryExecute(name, args, turnCtx);
  }
}

function createAgentSheetToolsInternal(ctx) {
  const { app, deps } = ctx || {};
  if (!app) throw new Error("AgentSheetToolsModule requires app");
  if (!deps) throw new Error("AgentSheetToolsModule requires deps");

  const {
    marketVerificationModule,
    gridApi,
    stateAccessApi,
    addTableJournal,
    addChangesJournal,
    renderAll,
    renderTabs,
    renderSheet,
    activeSheet,
    selectionText,
  } = deps;

  if (!marketVerificationModule) throw new Error("AgentSheetToolsModule requires marketVerificationModule");
  if (!gridApi) throw new Error("AgentSheetToolsModule requires gridApi");
  if (!stateAccessApi) throw new Error("AgentSheetToolsModule requires stateAccessApi");
  if (typeof addTableJournal !== "function") throw new Error("AgentSheetToolsModule requires addTableJournal()");
  if (typeof addChangesJournal !== "function") throw new Error("AgentSheetToolsModule requires addChangesJournal()");
  if (typeof renderAll !== "function") throw new Error("AgentSheetToolsModule requires renderAll()");
  if (typeof renderTabs !== "function") throw new Error("AgentSheetToolsModule requires renderTabs()");
  if (typeof renderSheet !== "function") throw new Error("AgentSheetToolsModule requires renderSheet()");
  if (typeof activeSheet !== "function") throw new Error("AgentSheetToolsModule requires activeSheet()");
  if (typeof selectionText !== "function") throw new Error("AgentSheetToolsModule requires selectionText()");

  if (typeof gridApi.parseA1Address !== "function") throw new Error("AgentSheetToolsModule requires gridApi.parseA1Address()");
  if (typeof gridApi.parseA1Range !== "function") throw new Error("AgentSheetToolsModule requires gridApi.parseA1Range()");
  if (typeof gridApi.toA1 !== "function") throw new Error("AgentSheetToolsModule requires gridApi.toA1()");
  if (typeof gridApi.agentCellValueText !== "function") throw new Error("AgentSheetToolsModule requires gridApi.agentCellValueText()");
  if (typeof stateAccessApi.setAgentSheetCell !== "function") throw new Error("AgentSheetToolsModule requires stateAccessApi.setAgentSheetCell()");

  const parseA1Address = (...args) => gridApi.parseA1Address(...args);
  const parseA1Range = (...args) => gridApi.parseA1Range(...args);
  const toA1 = (...args) => gridApi.toA1(...args);
  const agentCellValueText = (...args) => gridApi.agentCellValueText(...args);
  const setAgentSheetCell = (...args) => stateAccessApi.setAgentSheetCell(...args);

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

  async function tryExecute(name, args, turnCtx = null) {
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
      const marketSheet = marketVerificationModule.isMarketSheetId(sheet.id);
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
        const verified = marketVerificationModule.ensureMarketVerification(turnCtx, args?.verification, "write_cells");
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

    return undefined;
  }

  return { tryExecute };
}
