export class TkpSyncService {
  constructor(bindingMap) {
    this.bindingMap = bindingMap;
  }

  buildWorkbookPatchFromModel({ tkpModel, workbookSnapshot, editsOverlay }) {
    const map = this.bindingMap.get();
    const changes = [];

    const commonSheet = workbookSnapshot.sheets.find((sheet) => sheet.name === map.commonSheet.name);
    if (!commonSheet) {
      throw new Error(`Лист '${map.commonSheet.name}' не найден`);
    }

    this.pushChange(changes, commonSheet, editsOverlay, map.commonSheet.meta.orderNo, tkpModel.meta.orderNo, "sync meta.orderNo");
    this.pushChange(changes, commonSheet, editsOverlay, map.commonSheet.meta.requestNo, tkpModel.meta.requestNo, "sync meta.requestNo");
    this.pushChange(changes, commonSheet, editsOverlay, map.commonSheet.meta.modifiedDate, tkpModel.meta.modifiedDate, "sync meta.modifiedDate");

    const rows = tkpModel.assemblies.filter((item) => item.include !== false);
    if (rows.length > map.commonSheet.assembliesTable.maxRows) {
      throw new Error(`Количество сборок превышает maxRows (${map.commonSheet.assembliesTable.maxRows})`);
    }

    for (let i = 0; i < map.commonSheet.assembliesTable.maxRows; i += 1) {
      const rowNum = map.commonSheet.assembliesTable.startRow + i;
      const rowModel = rows[i] || null;
      this.syncAssemblyRow(changes, commonSheet, editsOverlay, rowNum, rowModel, map.commonSheet.assembliesTable.cols);
    }

    for (const assembly of rows) {
      const asmSheet = workbookSnapshot.sheets.find((sheet) => sheet.name === assembly.abbr);
      const conSheet = workbookSnapshot.sheets.find((sheet) => sheet.name === `Расход. мат. ${assembly.abbr}`);

      if (asmSheet) {
        this.syncHeader(changes, asmSheet, editsOverlay, map.assemblySheet.header, assembly, "assembly header");
      }

      if (conSheet) {
        this.syncHeader(changes, conSheet, editsOverlay, map.consumablesSheet.header, assembly, "consumables header");
      }
    }

    return {
      title: "Синхронизация модели в книгу",
      changes,
      stats: { cellsChanged: changes.length }
    };
  }

  readModelFromWorkbook({ workbookSnapshot, editsOverlay }) {
    const map = this.bindingMap.get();
    const common = workbookSnapshot.sheets.find((sheet) => sheet.name === map.commonSheet.name);
    if (!common) {
      throw new Error(`Лист '${map.commonSheet.name}' не найден`);
    }

    const result = {
      meta: {
        orderNo: this.readEffective(common, editsOverlay, map.commonSheet.meta.orderNo) || "",
        requestNo: this.readEffective(common, editsOverlay, map.commonSheet.meta.requestNo) || "",
        title: "КП Общая",
        modifiedDate: this.readEffective(common, editsOverlay, map.commonSheet.meta.modifiedDate) || ""
      },
      assemblies: [],
      lastUpdatedTs: Date.now()
    };

    for (let i = 0; i < map.commonSheet.assembliesTable.maxRows; i += 1) {
      const rowNum = map.commonSheet.assembliesTable.startRow + i;
      const abbr = this.readEffective(common, editsOverlay, `${map.commonSheet.assembliesTable.cols.abbr}${rowNum}`);
      const name = this.readEffective(common, editsOverlay, `${map.commonSheet.assembliesTable.cols.name}${rowNum}`);
      const qty = this.readEffective(common, editsOverlay, `${map.commonSheet.assembliesTable.cols.qty}${rowNum}`);
      const unit = this.readEffective(common, editsOverlay, `${map.commonSheet.assembliesTable.cols.unit}${rowNum}`);
      const comment = this.readEffective(common, editsOverlay, `${map.commonSheet.assembliesTable.cols.comment}${rowNum}`);

      if (!abbr && !name && !qty && !comment) {
        continue;
      }

      result.assemblies.push({
        abbr: String(abbr || "").trim(),
        name: String(name || "").trim(),
        qty: qty === null || qty === undefined || qty === "" ? null : Number(qty),
        unit: String(unit || "компл."),
        comment: String(comment || ""),
        include: true
      });
    }

    return result;
  }

  applyPatchPlan(patchPlan, workbookSnapshot, currentEdits) {
    const sheetIdByName = new Map((workbookSnapshot.sheets || []).map((sheet) => [sheet.name, sheet.id]));
    const nextEdits = structuredClone(currentEdits || {});

    for (const change of patchPlan.changes || []) {
      const sheetId = sheetIdByName.get(change.sheetName);
      if (!sheetId) {
        continue;
      }

      if (!nextEdits[sheetId]) {
        nextEdits[sheetId] = {};
      }

      nextEdits[sheetId][change.addressA1] = {
        value: change.after,
        type: typeof change.after,
        updatedAtTs: Date.now()
      };
    }

    return nextEdits;
  }

  syncAssemblyRow(changes, sheet, edits, rowNum, modelRow, cols) {
    this.pushChange(changes, sheet, edits, `${cols.abbr}${rowNum}`, modelRow?.abbr || null, "sync assemblies table abbr");
    this.pushChange(changes, sheet, edits, `${cols.name}${rowNum}`, modelRow?.name || null, "sync assemblies table name");
    this.pushChange(changes, sheet, edits, `${cols.qty}${rowNum}`, modelRow?.qty ?? null, "sync assemblies table qty");
    this.pushChange(changes, sheet, edits, `${cols.unit}${rowNum}`, modelRow?.unit || null, "sync assemblies table unit");
    this.pushChange(changes, sheet, edits, `${cols.comment}${rowNum}`, modelRow?.comment || null, "sync assemblies table comment");
  }

  syncHeader(changes, sheet, edits, headerMap, modelRow, reasonPrefix) {
    this.pushChange(changes, sheet, edits, headerMap.abbr, modelRow?.abbr || null, `${reasonPrefix} abbr`);
    this.pushChange(changes, sheet, edits, headerMap.name, modelRow?.name || null, `${reasonPrefix} name`);
    this.pushChange(changes, sheet, edits, headerMap.qty, modelRow?.qty ?? null, `${reasonPrefix} qty`);
  }

  pushChange(changes, sheet, edits, addressA1, after, reason) {
    const before = this.readEffective(sheet, edits, addressA1);
    if (this.equals(before, after)) {
      return;
    }

    changes.push({
      sheetName: sheet.name,
      addressA1,
      before,
      after,
      reason
    });
  }

  readEffective(sheet, editsOverlay, addressA1) {
    const sheetEdits = editsOverlay?.[sheet.id] || {};
    if (Object.prototype.hasOwnProperty.call(sheetEdits, addressA1)) {
      return sheetEdits[addressA1]?.value ?? null;
    }

    for (const row of sheet.rows || []) {
      for (const cell of row.cells || []) {
        if (cell.address === addressA1) {
          return cell.value ?? null;
        }
      }
    }

    return null;
  }

  equals(a, b) {
    return a === b || (a == null && b == null);
  }
}


