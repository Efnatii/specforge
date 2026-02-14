export class TemplateFingerprint {
  async hashBufferSha256(arrayBuffer) {
    const hash = await crypto.subtle.digest("SHA-256", arrayBuffer);
    const bytes = Array.from(new Uint8Array(hash));
    return bytes.map((item) => item.toString(16).padStart(2, "0")).join("");
  }

  buildStructureFingerprint(normalizedWorkbook) {
    return {
      v: 1,
      sheets: (normalizedWorkbook?.sheets || []).map((sheet) => ({
        name: sheet.name,
        mergesCount: (sheet.merges || []).length,
        colsCount: (sheet.cols || []).length,
        rowsCount: (sheet.rows || []).length
      }))
    };
  }

  compareStructure(a, b) {
    if (!a || !b) {
      return { ok: false, reason: "Missing structure fingerprint" };
    }

    if (!this.hasGeneralSheet(a) || !this.hasGeneralSheet(b)) {
      return { ok: false, reason: "Missing required sheet 'Общее'" };
    }

    const pairCheckA = this.validateSheetPairs(a.sheets);
    if (!pairCheckA.ok) {
      return pairCheckA;
    }

    const pairCheckB = this.validateSheetPairs(b.sheets);
    if (!pairCheckB.ok) {
      return pairCheckB;
    }

    const mapA = this.toSheetMap(a.sheets);
    const mapB = this.toSheetMap(b.sheets);

    if (mapA.size !== mapB.size) {
      return { ok: false, reason: "Sheet count mismatch" };
    }

    for (const [name, itemA] of mapA.entries()) {
      const itemB = mapB.get(name);
      if (!itemB) {
        return { ok: false, reason: `Missing sheet '${name}'` };
      }

      if (itemA.mergesCount !== itemB.mergesCount) {
        return { ok: false, reason: `Merges mismatch in '${name}'` };
      }

      if (itemA.colsCount !== itemB.colsCount) {
        return { ok: false, reason: `Columns mismatch in '${name}'` };
      }

      if (itemA.rowsCount !== itemB.rowsCount) {
        return { ok: false, reason: `Rows mismatch in '${name}'` };
      }
    }

    return { ok: true, reason: "Compatible" };
  }

  hasGeneralSheet(fingerprint) {
    return (fingerprint.sheets || []).some((sheet) => sheet.name === "Общее");
  }

  toSheetMap(sheets) {
    const map = new Map();
    for (const sheet of sheets || []) {
      map.set(sheet.name, sheet);
    }
    return map;
  }

  validateSheetPairs(sheets) {
    const names = (sheets || []).map((item) => item.name);
    const assemblyNames = new Set();
    const consumableAbbrs = new Set();

    for (const name of names) {
      if (name === "Общее") {
        continue;
      }

      if (name.startsWith("Расход. мат. ")) {
        consumableAbbrs.add(name.replace(/^Расход\. мат\.\s+/, ""));
      } else {
        assemblyNames.add(name);
      }
    }

    for (const abbr of consumableAbbrs) {
      if (!assemblyNames.has(abbr)) {
        return { ok: false, reason: `Missing assembly sheet '${abbr}'` };
      }
    }

    for (const name of assemblyNames) {
      if (!consumableAbbrs.has(name)) {
        return { ok: false, reason: `Missing consumables sheet 'Расход. мат. ${name}'` };
      }
    }

    return { ok: true, reason: "Pair scheme is valid" };
  }
}
