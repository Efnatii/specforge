export class WorkbookSheetLayoutModule {
  constructor({ sheetNames, math, calcApi }) {
    if (!sheetNames) throw new Error("WorkbookSheetLayoutModule requires sheetNames");
    if (!math) throw new Error("WorkbookSheetLayoutModule requires math helpers");
    if (!calcApi) throw new Error("WorkbookSheetLayoutModule requires calcApi");
    if (typeof calcApi.calcItem !== "function") throw new Error("WorkbookSheetLayoutModule requires calcApi.calcItem()");

    this._sheetNames = sheetNames;
    this._math = math;
    this._calcApi = calcApi;
  }

  readCellNum(sheet, row, col) {
    return this._num(sheet.rows[row - 1]?.cells[col - 1]?.value, 0);
  }

  buildSummarySheet(entries, templateSheet, state) {
    const rows = [];

    const row1 = this._sheetRow(templateSheet, 1, 1);
    this._copyRowValues(row1, templateSheet.rowValues[1]);
    rows.push(row1);

    for (let idx = 0; idx < entries.length; idx += 1) {
      const entry = entries[idx];
      const rowNumber = rows.length + 1;
      const row = this._sheetRow(templateSheet, 2, 2);
      const useDisc = state.settings.totalMode === "withDiscount";
      const total = useDisc ? entry.disc : entry.noDisc;
      const col = useDisc ? "Q" : "K";

      this._setRowCell(row, 1, idx + 1);
      this._setRowCell(row, 2, entry.label);
      this._setRowCell(row, 3, "к-т");
      this._setRowCell(row, 4, 1);
      this._setRowCell(row, 5, this._round2(total), `${this._quoteSheet(entry.sheetName)}!${col}${entry.totalRow}`);
      this._setRowCell(row, 6, state.settings.vatRate);
      this._setRowCell(row, 7, this._round2(total - total * state.settings.vatRate), `I${rowNumber}-H${rowNumber}`);
      this._setRowCell(row, 8, this._round2(total * state.settings.vatRate), `I${rowNumber}*F${rowNumber}`);
      this._setRowCell(row, 9, this._round2(total), `E${rowNumber}`);
      rows.push(row);
    }

    const totalRowNum = rows.length + 1;
    const totalRow = this._sheetRow(templateSheet, 3, 3);
    this._copyRowValues(totalRow, templateSheet.rowValues[3]);
    const sumFormula = totalRowNum > 2 ? `SUM(I2:I${totalRowNum - 1})` : "0";
    const sumValue = entries.reduce((sum, entry) => {
      return sum + (state.settings.totalMode === "withDiscount" ? entry.disc : entry.noDisc);
    }, 0);
    this._setRowCell(totalRow, 9, this._round2(sumValue), sumFormula);
    rows.push(totalRow);

    return {
      id: "summary",
      name: this._sheetNames.summary,
      cols: templateSheet.cols,
      rows,
      merges: [],
      freeze: { x: 0, y: 0 },
      zoom: templateSheet.view.zoom,
      meta: { totalRow: totalRowNum },
    };
  }

  buildMainSheet(id, name, assembly, metrics, templateSheet, consumablesRef, title, vatRate) {
    const rows = [];

    const row1 = this._sheetRow(templateSheet, 1, 1);
    this._setRowCell(row1, 1, title);
    rows.push(row1);

    const row2 = this._sheetRow(templateSheet, 2, 2);
    this._copyRowValues(row2, templateSheet.rowValues[2]);
    rows.push(row2);

    const posStart = rows.length + 1;
    for (let idx = 0; idx < metrics.main.length; idx += 1) {
      const item = metrics.main[idx];
      const rowNumber = rows.length + 1;
      const row = this._sheetRow(templateSheet, 3, 3);
      this._setRowCell(row, 1, idx + 1);
      this._setRowCell(row, 2, item.raw.schematic);
      this._setRowCell(row, 3, item.raw.name);
      this._setRowCell(row, 4, item.raw.manufacturer);
      this._setRowCell(row, 5, item.raw.article);
      this._setRowCell(row, 6, item.raw.qty);
      this._setRowCell(row, 7, item.raw.unit);
      this._setRowCell(row, 8, this._round2(item.baseNoVat));
      this._setRowCell(row, 9, this._round2(item.priceVat), `H${rowNumber}*(1+L${rowNumber})*(1+${vatRate})`);
      this._setRowCell(row, 10, this._round2(item.sumNoVat), `F${rowNumber}*H${rowNumber}*(1+L${rowNumber})`);
      this._setRowCell(row, 11, this._round2(item.sumVat), `F${rowNumber}*I${rowNumber}`);
      this._setRowCell(row, 12, item.raw.markup);
      this._setRowCell(row, 13, item.raw.discount);
      this._setRowCell(row, 14, this._round2(item.discPriceNoVat), `H${rowNumber}*(1-M${rowNumber})`);
      this._setRowCell(row, 15, this._round2(item.discPriceVat), `N${rowNumber}*(1+${vatRate})`);
      this._setRowCell(row, 16, this._round2(item.discSumNoVat), `F${rowNumber}*N${rowNumber}`);
      this._setRowCell(row, 17, this._round2(item.discSumVat), `F${rowNumber}*O${rowNumber}`);
      this._setRowCell(row, 18, item.raw.supplier);
      this._setRowCell(row, 19, item.raw.note);
      rows.push(row);
    }
    const posEnd = rows.length;

    rows.push(this._sheetRow(templateSheet, 4, 4));

    const row5 = this._sheetRow(templateSheet, 5, 5);
    this._copyRowValues(row5, templateSheet.rowValues[5]);
    rows.push(row5);

    const row6Num = rows.length + 1;
    const row6 = this._sheetRow(templateSheet, 6, 6);
    this._copyRowValues(row6, templateSheet.rowValues[6]);
    if (consumablesRef) {
      this._setRowCell(row6, 11, this._round2(metrics.consNoDisc), `${this._quoteSheet(consumablesRef.sheetName)}!$K$${consumablesRef.totalRow}`);
      this._setRowCell(row6, 17, this._round2(metrics.consDisc), `${this._quoteSheet(consumablesRef.sheetName)}!$Q$${consumablesRef.totalRow}`);
    } else {
      this._setRowCell(row6, 11, this._round2(metrics.consNoDisc));
      this._setRowCell(row6, 17, this._round2(metrics.consDisc));
    }
    rows.push(row6);

    const row7Num = rows.length + 1;
    const row7 = this._sheetRow(templateSheet, 7, 7);
    this._copyRowValues(row7, templateSheet.rowValues[7]);
    this._setRowCell(row7, 11, this._round2(metrics.baseNoDisc), `SUM(K${posStart}:K${posEnd})+K${row6Num}`);
    this._setRowCell(row7, 17, this._round2(metrics.baseDisc), `Q${row6Num}+SUM(Q${posStart}:Q${posEnd})`);
    rows.push(row7);

    const row8 = this._sheetRow(templateSheet, 8, 8);
    this._copyRowValues(row8, templateSheet.rowValues[8]);
    rows.push(row8);

    const row9Num = rows.length + 1;
    const row9 = this._sheetRow(templateSheet, 9, 9);
    this._copyRowValues(row9, templateSheet.rowValues[9]);
    this._setRowCell(row9, 6, assembly.labor.devCoeff);
    this._setRowCell(row9, 7, assembly.labor.devHours);
    this._setRowCell(row9, 8, this._round2(assembly.labor.devRate));
    this._setRowCell(row9, 9, this._round2(metrics.devTax), `H${row9Num}*0.6`);
    this._setRowCell(row9, 10, this._round2(metrics.devTotal), `G${row9Num}*(H${row9Num}+I${row9Num})`);
    this._setRowCell(row9, 11, this._round2(metrics.devCoeff), `J${row9Num}*F${row9Num}`);
    rows.push(row9);

    const row10Num = rows.length + 1;
    const row10 = this._sheetRow(templateSheet, 10, 10);
    this._copyRowValues(row10, templateSheet.rowValues[10]);
    this._setRowCell(row10, 6, assembly.labor.assmCoeff);
    this._setRowCell(row10, 7, assembly.labor.assmHours);
    this._setRowCell(row10, 8, this._round2(assembly.labor.assmRate));
    this._setRowCell(row10, 9, this._round2(metrics.assmTax), `H${row10Num}*0.6`);
    this._setRowCell(row10, 10, this._round2(metrics.assmTotal), `G${row10Num}*(H${row10Num}+I${row10Num})`);
    this._setRowCell(row10, 11, this._round2(metrics.assmCoeff), `J${row10Num}*F${row10Num}`);
    rows.push(row10);

    const row11Num = rows.length + 1;
    const row11 = this._sheetRow(templateSheet, 11, 11);
    this._copyRowValues(row11, templateSheet.rowValues[11]);
    this._setRowCell(row11, 6, assembly.labor.profitCoeff);
    this._setRowCell(row11, 11, this._round2(metrics.profitNoDisc), `(K${row10Num}+K${row9Num}+K${row7Num})*F${row11Num}`);
    this._setRowCell(row11, 17, this._round2(metrics.profitDisc), `(Q${row7Num}+K${row9Num}+K${row10Num})*F${row11Num}`);
    rows.push(row11);

    const row12 = this._sheetRow(templateSheet, 12, 12);
    this._copyRowValues(row12, templateSheet.rowValues[12]);
    rows.push(row12);

    const row13Num = rows.length + 1;
    const row13 = this._sheetRow(templateSheet, 13, 13);
    this._copyRowValues(row13, templateSheet.rowValues[13]);
    this._setRowCell(row13, 11, this._round2(metrics.totalNoDisc), `CEILING((SUM(K${row7Num}:K${row11Num})),1)`);
    this._setRowCell(row13, 17, this._round2(metrics.totalDisc), `Q${row11Num}+Q${row7Num}+K${row9Num}+K${row10Num}`);
    rows.push(row13);

    return {
      id,
      name,
      cols: templateSheet.cols,
      rows,
      merges: ["A1:G1"],
      freeze: { x: 0, y: 0 },
      zoom: templateSheet.view.zoom,
      meta: { totalRow: row13Num },
    };
  }

  buildConsumableSheet(id, name, positions, templateSheet, title, vatRate) {
    const rows = [];
    const items = positions.map((position) => this._calcApi.calcItem(position, vatRate));

    const row1 = this._sheetRow(templateSheet, 1, 1);
    this._setRowCell(row1, 1, title);
    rows.push(row1);

    const row2 = this._sheetRow(templateSheet, 2, 2);
    this._copyRowValues(row2, templateSheet.rowValues[2]);
    rows.push(row2);

    const posStart = rows.length + 1;
    for (let idx = 0; idx < items.length; idx += 1) {
      const item = items[idx];
      const rowNum = rows.length + 1;
      const row = this._sheetRow(templateSheet, 3, 3);
      this._setRowCell(row, 1, idx + 1);
      this._setRowCell(row, 2, item.raw.schematic);
      this._setRowCell(row, 3, item.raw.name);
      this._setRowCell(row, 4, item.raw.manufacturer);
      this._setRowCell(row, 5, item.raw.article);
      this._setRowCell(row, 6, item.raw.qty);
      this._setRowCell(row, 7, item.raw.unit);
      this._setRowCell(row, 8, this._round2(item.baseNoVat));
      this._setRowCell(row, 9, this._round2(item.priceVat), `H${rowNum}*(1+L${rowNum})*(1+${vatRate})`);
      this._setRowCell(row, 10, this._round2(item.sumNoVat), `F${rowNum}*H${rowNum}*(1+L${rowNum})`);
      this._setRowCell(row, 11, this._round2(item.sumVat), `F${rowNum}*I${rowNum}`);
      this._setRowCell(row, 12, item.raw.markup);
      this._setRowCell(row, 13, item.raw.discount);
      this._setRowCell(row, 14, this._round2(item.discPriceNoVat), `H${rowNum}*(1-M${rowNum})`);
      this._setRowCell(row, 15, this._round2(item.discPriceVat), `N${rowNum}*(1+${vatRate})`);
      this._setRowCell(row, 16, this._round2(item.discSumNoVat), `F${rowNum}*N${rowNum}`);
      this._setRowCell(row, 17, this._round2(item.discSumVat), `F${rowNum}*O${rowNum}`);
      this._setRowCell(row, 18, item.raw.supplier);
      this._setRowCell(row, 19, item.raw.note);
      rows.push(row);
    }
    const posEnd = rows.length;

    rows.push(this._sheetRow(templateSheet, 4, 4));

    const row5 = this._sheetRow(templateSheet, 5, 5);
    this._copyRowValues(row5, templateSheet.rowValues[5]);
    rows.push(row5);

    const row6Num = rows.length + 1;
    const row6 = this._sheetRow(templateSheet, 6, 6);
    this._copyRowValues(row6, templateSheet.rowValues[6]);
    const totalK = this._ceil1(items.reduce((sum, item) => sum + item.sumVat, 0));
    const totalQ = this._ceil1(items.reduce((sum, item) => sum + item.discSumVat, 0));
    this._setRowCell(row6, 11, this._round2(totalK), `CEILING((SUM(K${posStart}:K${posEnd})),1)`);
    this._setRowCell(row6, 17, this._round2(totalQ), `CEILING((SUM(Q${posStart}:Q${posEnd})),1)`);
    rows.push(row6);

    return {
      id,
      name,
      cols: templateSheet.cols,
      rows,
      merges: ["A1:G1"],
      freeze: { x: 0, y: 0 },
      zoom: templateSheet.view.zoom,
      meta: { totalRow: row6Num },
    };
  }

  _sheetRow(template, patternRow, heightRow = patternRow) {
    const pattern = template.rowStyles[patternRow] || new Array(template.maxCol).fill(0);
    const height = template.rowHeights[heightRow] || template.defaultRowHeight;
    return {
      height,
      cells: pattern.map((styleId) => ({ styleId: Number(styleId || 0), value: null, formula: "" })),
    };
  }

  _setRowCell(row, col, value, formula = "") {
    const cell = row.cells[col - 1];
    if (!cell) return;
    cell.value = this._normalizeCellValue(value);
    cell.formula = formula;
  }

  _copyRowValues(row, values) {
    if (!values) return;
    for (const [col, value] of Object.entries(values)) this._setRowCell(row, Number(col), value);
  }

  _quoteSheet(name) {
    return `'${String(name).replaceAll("'", "''")}'`;
  }

  _num(value, fallback = 0) {
    return this._math.num(value, fallback);
  }

  _round2(value) {
    return this._math.round2(value);
  }

  _ceil1(value) {
    return this._math.ceil1(value);
  }

  _normalizeCellValue(value) {
    return this._math.normalizeCellValue(value);
  }
}
