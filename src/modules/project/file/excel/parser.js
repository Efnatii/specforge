export class ProjectFileExcelSheetParserModule {
  constructor({ stateApi, valueApi }) {
    if (!stateApi) throw new Error("ProjectFileExcelSheetParserModule requires stateApi");
    if (!valueApi) throw new Error("ProjectFileExcelSheetParserModule requires valueApi");
    this._state = stateApi;
    this._values = valueApi;
  }

  parseSheetPositions(ws, vatRate, kind) {
    if (!ws) return [];

    const layout = this._values.detectPositionLayout(ws);
    const maxRows = Math.max(ws.rowCount, layout.startRow + 3);
    const out = [];
    let started = false;
    let emptyRun = 0;

    for (let r = layout.startRow; r <= maxRows; r += 1) {
      const rowText = this._values.rowLooseText(ws, r, layout.maxCols);
      if (this._values.isPositionsStopRow(rowText, kind)) {
        if (started) break;
        continue;
      }

      const idx = this._values.excelCellNum(ws, r, layout.cols.idx);
      const schematic = this._values.excelCellText(ws, r, layout.cols.schematic);
      const name = this._values.excelCellText(ws, r, layout.cols.name);
      const manufacturer = this._values.excelCellText(ws, r, layout.cols.manufacturer);
      const article = this._values.excelCellText(ws, r, layout.cols.article);
      const qtyRaw = this._values.excelCellNum(ws, r, layout.cols.qty);
      const unit = this._values.excelCellText(ws, r, layout.cols.unit);
      const priceCatalogRaw = this._values.excelCellNum(ws, r, layout.cols.priceCatalog);
      const basePriceRaw = this._values.excelCellNum(ws, r, layout.cols.basePrice);

      const hasIdentity = Boolean(schematic || name || manufacturer || article);
      const hasNumbers = Number.isFinite(idx) || Number.isFinite(qtyRaw) || Number.isFinite(priceCatalogRaw) || Number.isFinite(basePriceRaw);
      if (!hasIdentity && !hasNumbers) {
        emptyRun += 1;
        if (started && emptyRun >= 3) break;
        continue;
      }
      emptyRun = 0;

      const markup = this._state.normalizePercentDecimal(this._values.excelCellNum(ws, r, layout.cols.markup));
      const discount = this._state.normalizePercentDecimal(this._values.excelCellNum(ws, r, layout.cols.discount));
      const fromBase = Number.isFinite(basePriceRaw) ? basePriceRaw * (1 + markup) * (1 + vatRate) : NaN;
      const catalogPrice = Number.isFinite(priceCatalogRaw) ? priceCatalogRaw : (Number.isFinite(fromBase) ? fromBase : 0);

      if (!Number.isFinite(idx) && !hasIdentity) continue;
      started = true;

      const position = this._state.createPosition();
      position.schematic = schematic;
      position.name = name;
      position.manufacturer = manufacturer;
      position.article = article;
      position.qty = this._state.num(qtyRaw, 1);
      position.unit = unit || "шт";
      position.priceCatalogVatMarkup = this._state.round2(catalogPrice);
      position.markup = markup;
      position.discount = discount;
      position.supplier = this._values.excelCellText(ws, r, layout.cols.supplier);
      position.note = this._values.excelCellText(ws, r, layout.cols.note);
      out.push(position);
    }

    return out;
  }

  parseLabor(ws) {
    const result = {};
    const maxRows = Math.max(ws.rowCount, 20);
    const maxCols = Math.max(19, ws.actualColumnCount || ws.columnCount || 19);

    const dev = this._values.findCellByText(ws, /разработка\s*схем/i, maxRows, maxCols);
    if (dev) {
      const nums = this._values.rowNumbers(ws, dev.row, dev.col + 1, maxCols);
      if (nums.length > 0) result.devCoeff = this._values.normalizeCoeff(nums[0]);
      if (nums.length > 1) result.devHours = this._state.num(nums[1], 0);
      if (nums.length > 2) result.devRate = this._state.num(nums[2], 0);
    }

    const assm = this._values.findCellByText(ws, /работа\s*по\s*сборке/i, maxRows, maxCols);
    if (assm) {
      const nums = this._values.rowNumbers(ws, assm.row, assm.col + 1, maxCols);
      if (nums.length > 0) result.assmCoeff = this._values.normalizeCoeff(nums[0]);
      if (nums.length > 1) result.assmHours = this._state.num(nums[1], 0);
      if (nums.length > 2) result.assmRate = this._state.num(nums[2], 0);
    }

    const profit = this._values.findCellByText(ws, /прибыл/i, maxRows, maxCols);
    if (profit) {
      const nums = this._values.rowNumbers(ws, profit.row, profit.col + 1, maxCols);
      if (nums.length > 0) result.profitCoeff = this._state.normalizePercentDecimal(nums[0]);
    }

    return result;
  }

  parseManualConsumables(ws) {
    const maxRows = Math.max(ws.rowCount, 20);
    const maxCols = Math.max(19, ws.actualColumnCount || ws.columnCount || 19);
    const hit = this._values.findCellByText(ws, /расходн\w*\s*материал/i, maxRows, maxCols);
    if (!hit) return { noDisc: 0, disc: 0 };

    const fixedNoDisc = this._values.excelCellNum(ws, hit.row, 11);
    const fixedDisc = this._values.excelCellNum(ws, hit.row, 17);
    if (Number.isFinite(fixedNoDisc) || Number.isFinite(fixedDisc)) {
      return {
        noDisc: this._state.num(fixedNoDisc, 0),
        disc: this._state.num(fixedDisc, 0),
      };
    }

    const nums = this._values.rowNumbers(ws, hit.row, hit.col + 1, maxCols);
    if (nums.length >= 2) {
      return {
        noDisc: this._state.num(nums[0], 0),
        disc: this._state.num(nums[nums.length - 1], 0),
      };
    }
    if (nums.length === 1) {
      const value = this._state.num(nums[0], 0);
      return { noDisc: value, disc: value };
    }

    return { noDisc: 0, disc: 0 };
  }

  isSummarySheetName(name) {
    return /^общ/i.test(String(name || "").trim());
  }

  isMainAssemblySheetName(name) {
    return /^осн\.?\s*мат\.?/i.test(String(name || "").trim());
  }

  isConsumableAssemblySheetName(name) {
    return /^расх\.?\s*мат\.?/i.test(String(name || "").trim());
  }

  isProjectConsumablesSheetName(name) {
    return /^расходник/i.test(String(name || "").trim());
  }

  stripMainPrefix(name) {
    return String(name || "").replace(/^осн\.?\s*мат\.?\s*/i, "").trim();
  }

  stripConsumablePrefix(name) {
    return String(name || "").replace(/^расх\.?\s*мат\.?\s*/i, "").trim();
  }

  applySettingsFromTitle(settings, titleRaw) {
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

  parseAssemblyFullName(titleRaw, settings, fallback) {
    const title = String(titleRaw || "").split("|")[0].trim();
    if (!title) return fallback || "Сборка";

    const order = settings.orderNumber ? this._values.escapeReg(settings.orderNumber) : "[0-9A-Za-zА-Яа-я-]+";
    const req = settings.requestNumber ? this._values.escapeReg(settings.requestNumber) : "[^)]+";
    const match = title.match(new RegExp(`^${order}\\s+(.+?)\\s*\\(${req}\\)`));
    if (match && match[1]) return match[1].trim();
    return fallback || "Сборка";
  }
}
