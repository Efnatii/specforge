export class ProjectMutationModule {
  constructor({ stateApi, createId }) {
    if (!stateApi) throw new Error("ProjectMutationModule requires stateApi");
    if (typeof createId !== "function") throw new Error("ProjectMutationModule requires createId()");
    this._stateApi = stateApi;
    this._createId = createId;
  }

  createPosition() {
    return this._stateApi.createPosition();
  }

  createAssembly(index = 1) {
    return this._stateApi.createAssembly(index);
  }

  deriveAbbr(name) {
    return this._stateApi.deriveAbbr(name);
  }

  keepAbbr(value) {
    return this._stateApi.keepAbbr(value);
  }

  num(value, fallback = 0) {
    return this._stateApi.num(value, fallback);
  }

  pctToDec(value) {
    return this._stateApi.pctToDec(value);
  }

  normalizePercentDecimal(value, fallback = 0) {
    return this._stateApi.normalizePercentDecimal(value, fallback);
  }

  findAssemblyById(state, id) {
    return state?.assemblies?.find((assembly) => assembly.id === id) || null;
  }

  getPositionRef(state, { assemblyId, list, posId }) {
    if (list === "project") return state?.projectConsumables?.find((position) => position.id === posId) || null;
    const assembly = this.findAssemblyById(state, assemblyId);
    if (!assembly) return null;
    const arr = list === "main" ? assembly.main : assembly.consumable;
    return Array.isArray(arr) ? arr.find((position) => position.id === posId) || null : null;
  }

  applySettingField(state, { field, value }) {
    if (!state?.settings) return { ok: false };
    if (field === "vatRate") state.settings.vatRate = this.pctToDec(value);
    else if (field === "totalMode") state.settings.totalMode = value === "withDiscount" ? "withDiscount" : "withoutDiscount";
    else state.settings[field] = String(value || "");
    return { ok: true, field };
  }

  applyAssemblyField(state, { assemblyId, field, value, checked }) {
    const assembly = this.findAssemblyById(state, assemblyId);
    if (!assembly) return { ok: false };

    if (field === "abbrManual" || field === "separateConsumables") {
      assembly[field] = Boolean(checked);
      if (field === "abbrManual" && !assembly.abbrManual) assembly.abbreviation = this.deriveAbbr(assembly.fullName);
    } else if (field === "fullName") {
      assembly.fullName = String(value || "").trim();
      if (!assembly.abbrManual) assembly.abbreviation = this.deriveAbbr(assembly.fullName);
    } else if (field === "abbreviation") {
      assembly.abbreviation = this.keepAbbr(value);
    } else {
      assembly[field] = this.num(value);
    }

    return { ok: true, assemblyId: assembly.id, field };
  }

  applyLaborField(state, { assemblyId, field, value }) {
    const assembly = this.findAssemblyById(state, assemblyId);
    if (!assembly) return { ok: false };
    assembly.labor[field] = this.num(value);
    return { ok: true, assemblyId: assembly.id, field };
  }

  applyPositionField(state, { assemblyId, list, posId, field, value }) {
    const position = this.getPositionRef(state, { assemblyId, list, posId });
    if (!position) return { ok: false };

    if (field === "qty" || field === "priceCatalogVatMarkup") position[field] = this.num(value);
    else if (field === "markup" || field === "discount") position[field] = this.pctToDec(value);
    else position[field] = String(value || "");

    return { ok: true, positionId: position.id, list: list || "", field };
  }

  addPosition(state, { assemblyId, list }) {
    const assembly = this.findAssemblyById(state, assemblyId);
    if (!assembly) return { ok: false };
    if (!Array.isArray(assembly.main)) assembly.main = [];
    if (!Array.isArray(assembly.consumable)) assembly.consumable = [];
    const arr = list === "main" ? assembly.main : assembly.consumable;
    const position = this.createPosition();
    arr.push(position);
    return {
      ok: true,
      assemblyId,
      list,
      position,
      treeSel: { type: "pos", id: assemblyId, list, pos: position.id },
    };
  }

  addProjectPosition(state) {
    if (!state?.hasProjectConsumables) return { ok: false };
    if (!Array.isArray(state.projectConsumables)) state.projectConsumables = [];
    const position = this.createPosition();
    state.projectConsumables.push(position);
    return {
      ok: true,
      position,
      treeSel: { type: "projpos", pos: position.id },
    };
  }

  addPositionBySelection(state, selection) {
    const sel = selection || {};
    if (sel.type === "list" || sel.type === "pos") {
      const result = this.addPosition(state, { assemblyId: sel.id, list: sel.list });
      return { handled: true, ...result };
    }
    if (sel.type === "projlist" || sel.type === "projpos") {
      if (!state.hasProjectConsumables) state.hasProjectConsumables = true;
      const result = this.addProjectPosition(state);
      return { handled: true, ...result };
    }
    return { handled: false, ok: false };
  }

  toggleProjectConsumables(state, { enabled } = {}) {
    state.hasProjectConsumables = enabled === undefined ? !state.hasProjectConsumables : Boolean(enabled);
    return {
      ok: true,
      enabled: state.hasProjectConsumables,
      treeSel: { type: "projlist" },
    };
  }

  deleteAssembly(state, { assemblyId, lastAssemblyId = "" }) {
    const deleted = this.findAssemblyById(state, assemblyId);
    if (!deleted) return { ok: false };

    state.assemblies = state.assemblies.filter((assembly) => assembly.id !== assemblyId);
    const nextLastAssemblyId = lastAssemblyId === assemblyId
      ? (state.assemblies.length ? state.assemblies[state.assemblies.length - 1].id : "")
      : String(lastAssemblyId || "");

    return {
      ok: true,
      deleted,
      nextLastAssemblyId,
      treeSel: { type: "settings" },
      activeSheetId: "summary",
    };
  }

  duplicateAssembly(state, { assemblyId }) {
    const source = this.findAssemblyById(state, assemblyId);
    if (!source) return { ok: false };

    const copy = {
      ...source,
      id: this._newId(),
      fullName: this.nextCopyAssemblyName(state, source.fullName || "Сборка"),
      main: Array.isArray(source.main) && source.main.length
        ? source.main.map((position) => ({ ...position, id: this._newId() }))
        : [],
      consumable: Array.isArray(source.consumable) && source.consumable.length
        ? source.consumable.map((position) => ({ ...position, id: this._newId() }))
        : [],
      labor: { ...source.labor },
      manualConsNoDisc: this.num(source.manualConsNoDisc, 0),
      manualConsDisc: this.num(source.manualConsDisc, 0),
    };

    const srcIdx = state.assemblies.findIndex((assembly) => assembly.id === source.id);
    if (srcIdx >= 0) state.assemblies.splice(srcIdx + 1, 0, copy);
    else state.assemblies.push(copy);

    return {
      ok: true,
      source,
      copy,
      treeSel: { type: "assembly", id: copy.id },
      activeSheetId: `assembly:${copy.id}:main`,
    };
  }

  duplicatePosition(state, { assemblyId, list, posId }) {
    if (list === "project") {
      if (!Array.isArray(state.projectConsumables)) state.projectConsumables = [];
      const arr = state.projectConsumables;
      const idx = arr.findIndex((position) => position.id === posId);
      if (idx < 0) return { ok: false };
      const source = arr[idx];
      const copy = { ...source, id: this._newId() };
      arr.splice(idx + 1, 0, copy);
      return {
        ok: true,
        source,
        copy,
        treeSel: { type: "projpos", pos: copy.id },
      };
    }

    const assembly = this.findAssemblyById(state, assemblyId);
    if (!assembly) return { ok: false };
    const arr = list === "main" ? assembly.main : assembly.consumable;
    const idx = arr.findIndex((position) => position.id === posId);
    if (idx < 0) return { ok: false };
    const source = arr[idx];
    const copy = { ...source, id: this._newId() };
    arr.splice(idx + 1, 0, copy);
    return {
      ok: true,
      source,
      copy,
      treeSel: { type: "pos", id: assemblyId, list, pos: copy.id },
    };
  }

  deletePosition(state, { assemblyId, list, posId }) {
    if (list === "project") {
      if (!Array.isArray(state.projectConsumables)) state.projectConsumables = [];
      const arr = state.projectConsumables;
      const idx = arr.findIndex((position) => position.id === posId);
      if (idx < 0) return { ok: false };
      arr.splice(idx, 1);
      return {
        ok: true,
        treeSel: { type: "projlist" },
        changeKind: "project.position.delete",
        changeValue: posId,
      };
    }

    const assembly = this.findAssemblyById(state, assemblyId);
    if (!assembly) return { ok: false };
    if (!Array.isArray(assembly.main)) assembly.main = [];
    if (!Array.isArray(assembly.consumable)) assembly.consumable = [];
    const arr = list === "main" ? assembly.main : assembly.consumable;
    const idx = arr.findIndex((position) => position.id === posId);
    if (idx < 0) return { ok: false };
    arr.splice(idx, 1);
    return {
      ok: true,
      treeSel: { type: "list", id: assemblyId, list },
      changeKind: "position.delete",
      changeValue: `${assemblyId}.${list}.${posId}`,
    };
  }

  movePosition(
    state,
    {
      sourceAssemblyId,
      sourceList,
      sourcePosId,
      targetAssemblyId,
      targetList,
      targetPosId,
    },
  ) {
    const srcList = String(sourceList || "");
    const dstList = String(targetList || "");
    const srcPosId = String(sourcePosId || "");
    const dstPosId = String(targetPosId || "");
    if (!srcPosId || !dstPosId || srcPosId === dstPosId) return { ok: false };

    if (srcList === "project" || dstList === "project") {
      if (srcList !== "project" || dstList !== "project") return { ok: false };
      if (!Array.isArray(state.projectConsumables)) state.projectConsumables = [];
      const arr = state.projectConsumables;
      const srcIdx = arr.findIndex((position) => position.id === srcPosId);
      const dstIdx = arr.findIndex((position) => position.id === dstPosId);
      if (srcIdx < 0 || dstIdx < 0 || srcIdx === dstIdx) return { ok: false };
      const [moving] = arr.splice(srcIdx, 1);
      const insertIdx = dstIdx;
      arr.splice(insertIdx, 0, moving);
      return {
        ok: true,
        treeSel: { type: "projpos", pos: srcPosId },
        changeKind: "project.position.move",
        changeValue: `${srcPosId} -> ${dstPosId}`,
      };
    }

    if (srcList !== dstList || sourceAssemblyId !== targetAssemblyId) return { ok: false };
    const assembly = this.findAssemblyById(state, sourceAssemblyId);
    if (!assembly) return { ok: false };
    const arr = srcList === "main" ? assembly.main : assembly.consumable;
    if (!Array.isArray(arr)) return { ok: false };

    const srcIdx = arr.findIndex((position) => position.id === srcPosId);
    const dstIdx = arr.findIndex((position) => position.id === dstPosId);
    if (srcIdx < 0 || dstIdx < 0 || srcIdx === dstIdx) return { ok: false };
    const [moving] = arr.splice(srcIdx, 1);
    const insertIdx = dstIdx;
    arr.splice(insertIdx, 0, moving);

    return {
      ok: true,
      treeSel: { type: "pos", id: sourceAssemblyId, list: srcList, pos: srcPosId },
      changeKind: "position.move",
      changeValue: `${sourceAssemblyId}.${srcList}.${srcPosId} -> ${targetPosId}`,
    };
  }

  nextCopyAssemblyName(state, base) {
    const src = String(base || "").trim() || "Сборка";
    const used = new Set((state?.assemblies || []).map((assembly) => String(assembly.fullName || "").trim()));

    let name = `${src} (копия)`;
    if (!used.has(name)) return name;

    let idx = 2;
    while (used.has(`${src} (копия ${idx})`)) idx += 1;
    return `${src} (копия ${idx})`;
  }

  _newId() {
    return String(this._createId());
  }
}
