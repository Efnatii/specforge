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
  const MARKET_SENSITIVE_COLS = new Set([3, 4, 5, 18, 19]);
  const MAX_WRITE_CELLS = 6000;
  const MAX_FIND_RESULTS = 500;

  function resolveSheetByRef({ sheetId, sheetName, fallbackToActive = true } = {}) {
    const id = String(sheetId || "").trim();
    if (id && app.workbook.byId[id]) return app.workbook.byId[id];
    if (id) return null;

    const name = String(sheetName || "").trim().toLowerCase();
    if (name) {
      const match = app.workbook.sheets.find((s) => String(s.name || "").trim().toLowerCase() === name);
      if (match) return match;
      return null;
    }

    return fallbackToActive ? activeSheet() : null;
  }

  function resolveAgentSheet(args) {
    return resolveSheetByRef({
      sheetId: args?.sheet_id,
      sheetName: args?.sheet_name,
      fallbackToActive: true,
    });
  }

  function hasMeaningfulCellContent(value, formula = "") {
    const hasFormula = String(formula || "").trim().length > 0;
    const hasValue = value !== undefined && value !== null && String(value).trim().length > 0;
    return hasFormula || hasValue;
  }

  function countMarketTouches(sheet, parsedUpdates) {
    const marketSheet = marketVerificationModule.isMarketSheetId(sheet?.id || "");
    if (!marketSheet || !Array.isArray(parsedUpdates) || !parsedUpdates.length) return 0;
    let touches = 0;
    for (const item of parsedUpdates) {
      if (!MARKET_SENSITIVE_COLS.has(Number(item?.col))) continue;
      if (hasMeaningfulCellContent(item?.value, item?.formula)) touches += 1;
    }
    return touches;
  }

  function normalizeMatrixCellValue(raw) {
    if (raw === null || raw === undefined) return null;
    if (typeof raw === "string" || typeof raw === "number" || typeof raw === "boolean") return raw;
    try {
      return JSON.stringify(raw);
    } catch {
      return String(raw);
    }
  }

  function normalizeFindMaxResults(valueRaw) {
    const n = Number(valueRaw);
    if (!Number.isFinite(n)) return 80;
    return Math.max(1, Math.min(MAX_FIND_RESULTS, Math.floor(n)));
  }

  function normalizeReplaceMaxChanges(valueRaw) {
    const n = Number(valueRaw);
    if (!Number.isFinite(n)) return 1200;
    return Math.max(1, Math.min(MAX_WRITE_CELLS, Math.floor(n)));
  }

  function escapeRegExp(value) {
    return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function replaceTextValue(source, search, replaceWith, { matchCase = false, wholeCell = false } = {}) {
    const src = String(source ?? "");
    if (!search) return { text: src, changed: false, replacements: 0 };

    if (wholeCell) {
      const matched = matchCase ? src === search : src.toLowerCase() === search.toLowerCase();
      if (!matched || src === replaceWith) return { text: src, changed: false, replacements: 0 };
      return { text: replaceWith, changed: true, replacements: 1 };
    }

    const flags = matchCase ? "g" : "gi";
    const pattern = new RegExp(escapeRegExp(search), flags);
    let replacements = 0;
    const text = src.replace(pattern, () => {
      replacements += 1;
      return replaceWith;
    });
    return { text, changed: replacements > 0 && text !== src, replacements };
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

    if (name === "find_cells") {
      const sheet = resolveAgentSheet(args);
      if (!sheet) {
        addTableJournal("find_cells", "Ошибка: лист не найден");
        return { ok: false, error: "sheet not found" };
      }

      const queryRaw = String(args?.query || "");
      const query = queryRaw.trim();
      if (!query) {
        addTableJournal("find_cells", "Ошибка: пустой query");
        return { ok: false, error: "query required" };
      }

      const rangeParsed = args?.range ? parseA1Range(args.range) : null;
      if (args?.range && !rangeParsed) {
        addTableJournal("find_cells", "Ошибка: некорректный диапазон");
        return { ok: false, error: "bad range" };
      }

      const r1 = rangeParsed ? rangeParsed.r1 : 1;
      const c1 = rangeParsed ? rangeParsed.c1 : 1;
      const r2 = rangeParsed ? rangeParsed.r2 : Math.max(1, sheet.rows.length);
      const c2 = rangeParsed ? rangeParsed.c2 : Math.max(1, sheet.cols.length);
      const matchCase = Boolean(args?.match_case);
      const inFormulas = Boolean(args?.in_formulas);
      const maxResults = normalizeFindMaxResults(args?.max_results);

      const needle = matchCase ? query : query.toLowerCase();
      const results = [];
      let truncated = false;

      for (let r = r1; r <= r2; r += 1) {
        for (let c = c1; c <= c2; c += 1) {
          const cell = sheet.rows[r - 1]?.cells[c - 1] || null;
          if (!cell) continue;

          const text = agentCellValueText(cell);
          const formula = String(cell.formula || "");
          const textHaystack = matchCase ? text : text.toLowerCase();
          const formulaHaystack = matchCase ? formula : formula.toLowerCase();

          let matchedIn = "";
          if (text && textHaystack.includes(needle)) matchedIn = "value";
          else if (inFormulas && formula && formulaHaystack.includes(needle)) matchedIn = "formula";

          if (!matchedIn) continue;
          const item = {
            address: toA1(r, c),
            text,
            value: cell.value ?? null,
            matched_in: matchedIn,
          };
          if (inFormulas && formula) item.formula = formula;
          results.push(item);

          if (results.length >= maxResults) {
            truncated = true;
            break;
          }
        }
        if (truncated) break;
      }

      const rangeText = `${toA1(r1, c1)}:${toA1(r2, c2)}`;
      addTableJournal("find_cells", `${sheet.name}: "${query}" -> ${results.length}${truncated ? "+" : ""}`);
      return {
        ok: true,
        sheet: { id: sheet.id, name: sheet.name },
        query,
        range: rangeText,
        results,
        truncated,
      };
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
      let skipped = 0;
      for (const u of updates) {
        const p = parseA1Address(u?.address);
        if (!p) {
          skipped += 1;
          continue;
        }
        parsedUpdates.push({ row: p.row, col: p.col, value: u?.value ?? null, formula: u?.formula || "" });
      }

      const marketTouches = countMarketTouches(sheet, parsedUpdates);
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

    if (name === "write_matrix") {
      const sheet = resolveAgentSheet(args);
      if (!sheet) {
        addTableJournal("write_matrix", "Ошибка: лист не найден");
        return { ok: false, error: "sheet not found" };
      }

      const start = parseA1Address(args?.start_address || "");
      if (!start) {
        addTableJournal("write_matrix", "Ошибка: некорректный start_address");
        return { ok: false, error: "bad start_address" };
      }

      const matrix = Array.isArray(args?.values) ? args.values : [];
      if (!matrix.length) {
        addTableJournal("write_matrix", "Ошибка: пустой values");
        return { ok: false, error: "values required" };
      }

      const parsedUpdates = [];
      let rowIndex = 0;
      let maxWidth = 0;
      for (const rowRaw of matrix) {
        const row = Array.isArray(rowRaw) ? rowRaw : [rowRaw];
        maxWidth = Math.max(maxWidth, row.length);
        for (let colIndex = 0; colIndex < row.length; colIndex += 1) {
          parsedUpdates.push({
            row: start.row + rowIndex,
            col: start.col + colIndex,
            value: normalizeMatrixCellValue(row[colIndex]),
            formula: "",
          });
        }
        rowIndex += 1;
      }

      if (!parsedUpdates.length) {
        addTableJournal("write_matrix", "Ошибка: матрица не содержит записываемых значений");
        return { ok: false, error: "matrix is empty" };
      }
      if (parsedUpdates.length > MAX_WRITE_CELLS) {
        addTableJournal("write_matrix", `Ошибка: слишком много ячеек (${parsedUpdates.length}, лимит ${MAX_WRITE_CELLS})`);
        return { ok: false, error: `too many cells: ${parsedUpdates.length} > ${MAX_WRITE_CELLS}` };
      }

      const marketTouches = countMarketTouches(sheet, parsedUpdates);
      if (marketTouches > 0) {
        const verified = marketVerificationModule.ensureMarketVerification(turnCtx, args?.verification, "write_matrix");
        if (!verified.ok) return { ok: false, error: verified.error };
      }

      for (const item of parsedUpdates) {
        setAgentSheetCell(sheet.id, item.row, item.col, item.value, "");
      }

      const end = {
        row: start.row + matrix.length - 1,
        col: start.col + Math.max(1, maxWidth) - 1,
      };
      const rangeText = `${toA1(start.row, start.col)}:${toA1(end.row, end.col)}`;

      renderAll();
      addTableJournal("write_matrix", `${sheet.name}: ${rangeText}, ячеек ${parsedUpdates.length}`);
      addChangesJournal("ai.write_matrix", `${sheet.id}:${rangeText}`);
      return {
        ok: true,
        sheet: { id: sheet.id, name: sheet.name },
        range: rangeText,
        applied: parsedUpdates.length,
      };
    }

    if (name === "copy_range") {
      const sourceSheet = resolveSheetByRef({
        sheetId: args?.source_sheet_id,
        sheetName: args?.source_sheet_name,
        fallbackToActive: true,
      });
      if (!sourceSheet) {
        addTableJournal("copy_range", "Ошибка: исходный лист не найден");
        return { ok: false, error: "source sheet not found" };
      }

      const targetSheet = resolveSheetByRef({
        sheetId: args?.target_sheet_id,
        sheetName: args?.target_sheet_name,
        fallbackToActive: true,
      }) || sourceSheet;
      if (!targetSheet) {
        addTableJournal("copy_range", "Ошибка: целевой лист не найден");
        return { ok: false, error: "target sheet not found" };
      }

      const sourceRange = parseA1Range(args?.source_range || "");
      if (!sourceRange) {
        addTableJournal("copy_range", "Ошибка: некорректный source_range");
        return { ok: false, error: "bad source_range" };
      }
      const targetStart = parseA1Address(args?.target_start || "");
      if (!targetStart) {
        addTableJournal("copy_range", "Ошибка: некорректный target_start");
        return { ok: false, error: "bad target_start" };
      }

      const rows = sourceRange.r2 - sourceRange.r1 + 1;
      const cols = sourceRange.c2 - sourceRange.c1 + 1;
      const totalCells = rows * cols;
      if (totalCells > MAX_WRITE_CELLS) {
        addTableJournal("copy_range", `Ошибка: слишком много ячеек (${totalCells}, лимит ${MAX_WRITE_CELLS})`);
        return { ok: false, error: `too many cells: ${totalCells} > ${MAX_WRITE_CELLS}` };
      }

      const includeValues = args?.include_values !== false;
      const includeFormulas = args?.include_formulas !== false;
      const skipEmpty = args?.skip_empty !== false;
      if (!includeValues && !includeFormulas) {
        addTableJournal("copy_range", "Ошибка: include_values и include_formulas одновременно false");
        return { ok: false, error: "nothing to copy" };
      }

      const parsedUpdates = [];
      let skipped = 0;
      for (let rOffset = 0; rOffset < rows; rOffset += 1) {
        for (let cOffset = 0; cOffset < cols; cOffset += 1) {
          const srcRow = sourceRange.r1 + rOffset;
          const srcCol = sourceRange.c1 + cOffset;
          const srcCell = sourceSheet.rows[srcRow - 1]?.cells[srcCol - 1] || null;

          const value = includeValues ? (srcCell?.value ?? null) : null;
          const formula = includeFormulas ? String(srcCell?.formula || "") : "";
          if (skipEmpty && !hasMeaningfulCellContent(value, formula)) {
            skipped += 1;
            continue;
          }

          parsedUpdates.push({
            row: targetStart.row + rOffset,
            col: targetStart.col + cOffset,
            value,
            formula,
          });
        }
      }

      if (!parsedUpdates.length) {
        addTableJournal("copy_range", "Ошибка: после фильтрации пусто");
        return { ok: false, error: "no cells to copy", skipped };
      }

      const marketTouches = countMarketTouches(targetSheet, parsedUpdates);
      if (marketTouches > 0) {
        const verified = marketVerificationModule.ensureMarketVerification(turnCtx, args?.verification, "copy_range");
        if (!verified.ok) return { ok: false, error: verified.error };
      }

      for (const item of parsedUpdates) {
        setAgentSheetCell(targetSheet.id, item.row, item.col, item.value, item.formula);
      }

      const targetEnd = {
        row: targetStart.row + rows - 1,
        col: targetStart.col + cols - 1,
      };
      const sourceRangeText = `${toA1(sourceRange.r1, sourceRange.c1)}:${toA1(sourceRange.r2, sourceRange.c2)}`;
      const targetRangeText = `${toA1(targetStart.row, targetStart.col)}:${toA1(targetEnd.row, targetEnd.col)}`;

      renderAll();
      addTableJournal("copy_range", `${sourceSheet.name}:${sourceRangeText} -> ${targetSheet.name}:${targetRangeText}, ячеек ${parsedUpdates.length}${skipped ? `, пропущено ${skipped}` : ""}`);
      addChangesJournal("ai.copy_range", `${sourceSheet.id}:${sourceRangeText} -> ${targetSheet.id}:${targetRangeText}`);
      return {
        ok: true,
        source_sheet: { id: sourceSheet.id, name: sourceSheet.name },
        target_sheet: { id: targetSheet.id, name: targetSheet.name },
        source_range: sourceRangeText,
        target_range: targetRangeText,
        applied: parsedUpdates.length,
        skipped,
      };
    }

    if (name === "fill_range") {
      const sheet = resolveAgentSheet(args);
      if (!sheet) {
        addTableJournal("fill_range", "Ошибка: лист не найден");
        return { ok: false, error: "sheet not found" };
      }

      const parsed = parseA1Range(args?.range || "");
      if (!parsed) {
        addTableJournal("fill_range", "Ошибка: некорректный диапазон");
        return { ok: false, error: "bad range" };
      }

      const hasValue = Object.prototype.hasOwnProperty.call(args || {}, "value");
      const hasFormula = Object.prototype.hasOwnProperty.call(args || {}, "formula");
      if (!hasValue && !hasFormula) {
        addTableJournal("fill_range", "Ошибка: нужно передать value или formula");
        return { ok: false, error: "value or formula required" };
      }

      const rowCount = parsed.r2 - parsed.r1 + 1;
      const colCount = parsed.c2 - parsed.c1 + 1;
      const totalCells = rowCount * colCount;
      if (totalCells > MAX_WRITE_CELLS) {
        addTableJournal("fill_range", `Ошибка: слишком много ячеек (${totalCells}, лимит ${MAX_WRITE_CELLS})`);
        return { ok: false, error: `too many cells: ${totalCells} > ${MAX_WRITE_CELLS}` };
      }

      const value = hasValue ? normalizeMatrixCellValue(args?.value) : null;
      const formula = hasFormula ? String(args?.formula || "") : "";
      const parsedUpdates = [];
      for (let r = parsed.r1; r <= parsed.r2; r += 1) {
        for (let c = parsed.c1; c <= parsed.c2; c += 1) {
          parsedUpdates.push({ row: r, col: c, value, formula });
        }
      }

      const marketTouches = countMarketTouches(sheet, parsedUpdates);
      if (marketTouches > 0) {
        const verified = marketVerificationModule.ensureMarketVerification(turnCtx, args?.verification, "fill_range");
        if (!verified.ok) return { ok: false, error: verified.error };
      }

      for (const item of parsedUpdates) {
        setAgentSheetCell(sheet.id, item.row, item.col, item.value, item.formula);
      }

      renderAll();
      const rangeText = `${toA1(parsed.r1, parsed.c1)}:${toA1(parsed.r2, parsed.c2)}`;
      addTableJournal("fill_range", `${sheet.name}: ${rangeText}, ячеек ${parsedUpdates.length}`);
      addChangesJournal("ai.fill_range", `${sheet.id}:${rangeText}`);
      return {
        ok: true,
        sheet: { id: sheet.id, name: sheet.name },
        range: rangeText,
        applied: parsedUpdates.length,
      };
    }

    if (name === "replace_in_range") {
      const sheet = resolveAgentSheet(args);
      if (!sheet) {
        addTableJournal("replace_in_range", "Ошибка: лист не найден");
        return { ok: false, error: "sheet not found" };
      }

      const search = String(args?.search || "");
      if (!search) {
        addTableJournal("replace_in_range", "Ошибка: пустой search");
        return { ok: false, error: "search required" };
      }

      const parsed = args?.range
        ? parseA1Range(args.range)
        : {
          r1: 1,
          c1: 1,
          r2: Math.max(1, sheet.rows.length),
          c2: Math.max(1, sheet.cols.length),
        };
      if (!parsed) {
        addTableJournal("replace_in_range", "Ошибка: некорректный диапазон");
        return { ok: false, error: "bad range" };
      }

      const replaceWith = String(args?.replace ?? "");
      const matchCase = Boolean(args?.match_case);
      const wholeCell = Boolean(args?.whole_cell);
      const inFormulas = Boolean(args?.in_formulas);
      const maxChanges = normalizeReplaceMaxChanges(args?.max_changes);

      const parsedUpdates = [];
      let replacementHits = 0;
      let truncated = false;

      for (let r = parsed.r1; r <= parsed.r2; r += 1) {
        for (let c = parsed.c1; c <= parsed.c2; c += 1) {
          const cell = sheet.rows[r - 1]?.cells[c - 1] || null;
          const currValue = cell?.value;
          const currFormula = String(cell?.formula || "");
          let nextValue = currValue ?? null;
          let nextFormula = currFormula;
          let changed = false;

          if (currValue !== null && currValue !== undefined) {
            const replacedValue = replaceTextValue(currValue, search, replaceWith, { matchCase, wholeCell });
            if (replacedValue.changed) {
              nextValue = replacedValue.text;
              replacementHits += replacedValue.replacements;
              changed = true;
            }
          }

          if (inFormulas && currFormula) {
            const replacedFormula = replaceTextValue(currFormula, search, replaceWith, { matchCase, wholeCell });
            if (replacedFormula.changed) {
              nextFormula = replacedFormula.text;
              replacementHits += replacedFormula.replacements;
              changed = true;
            }
          }

          if (!changed) continue;
          parsedUpdates.push({ row: r, col: c, value: nextValue, formula: nextFormula });

          if (parsedUpdates.length >= maxChanges) {
            truncated = true;
            break;
          }
        }
        if (truncated) break;
      }

      const rangeText = `${toA1(parsed.r1, parsed.c1)}:${toA1(parsed.r2, parsed.c2)}`;
      if (!parsedUpdates.length) {
        addTableJournal("replace_in_range", `${sheet.name}: "${search}" -> совпадений нет`);
        return {
          ok: false,
          error: "no matches",
          sheet: { id: sheet.id, name: sheet.name },
          range: rangeText,
          applied: 0,
        };
      }

      const marketTouches = countMarketTouches(sheet, parsedUpdates);
      if (marketTouches > 0) {
        const verified = marketVerificationModule.ensureMarketVerification(turnCtx, args?.verification, "replace_in_range");
        if (!verified.ok) return { ok: false, error: verified.error };
      }

      for (const item of parsedUpdates) {
        setAgentSheetCell(sheet.id, item.row, item.col, item.value, item.formula);
      }

      renderAll();
      addTableJournal("replace_in_range", `${sheet.name}: "${search}" -> "${replaceWith}", ячеек ${parsedUpdates.length}${truncated ? "+" : ""}`);
      addChangesJournal("ai.replace_in_range", `${sheet.id}:${rangeText}`);
      return {
        ok: true,
        sheet: { id: sheet.id, name: sheet.name },
        range: rangeText,
        applied: parsedUpdates.length,
        replacements: replacementHits,
        truncated,
      };
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
