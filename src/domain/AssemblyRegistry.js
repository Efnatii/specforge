import { TkpModel } from "./TkpModel.js";

export class AssemblyRegistry {
  constructor({ eventBus, idbStore, scheduler }) {
    this.eventBus = eventBus;
    this.idbStore = idbStore;
    this.scheduler = scheduler;
    this.model = TkpModel.createDefault();
  }

  async restore() {
    const saved = await this.idbStore.get("tkpModel");
    this.model = TkpModel.sanitize(saved);
    this.emit();
    return this.model;
  }

  getModel() {
    return structuredClone(this.model);
  }

  setModel(nextModel) {
    this.model = TkpModel.sanitize(nextModel);
    this.model.lastUpdatedTs = Date.now();
    this.emit();
    this.persistDebounced();
  }

  addAssembly(payload = {}) {
    const candidate = {
      abbr: this.validateAbbr(payload.abbr || `ASM_${this.model.assemblies.length + 1}`),
      name: String(payload.name || ""),
      qty: payload.qty === undefined ? 1 : Number(payload.qty),
      unit: String(payload.unit || "компл."),
      comment: String(payload.comment || ""),
      include: payload.include !== false
    };

    this.model.assemblies.push(candidate);
    this.sortAssemblies();
    this.model.lastUpdatedTs = Date.now();
    this.emit();
    this.persistDebounced();
    return candidate;
  }

  updateAssembly(abbr, patch) {
    const item = this.model.assemblies.find((entry) => entry.abbr === abbr);
    if (!item) {
      return false;
    }

    Object.assign(item, patch);
    if (patch.abbr) {
      item.abbr = this.validateAbbr(patch.abbr);
    }

    this.model.lastUpdatedTs = Date.now();
    this.sortAssemblies();
    this.emit();
    this.persistDebounced();
    return true;
  }

  removeAssembly(abbr) {
    const next = this.model.assemblies.filter((entry) => entry.abbr !== abbr);
    if (next.length === this.model.assemblies.length) {
      return false;
    }

    this.model.assemblies = next;
    this.model.lastUpdatedTs = Date.now();
    this.emit();
    this.persistDebounced();
    return true;
  }

  duplicateAssembly(abbr) {
    const source = this.model.assemblies.find((entry) => entry.abbr === abbr);
    if (!source) {
      return null;
    }

    let index = 1;
    let nextAbbr = `${source.abbr}_${index}`;
    while (this.model.assemblies.some((entry) => entry.abbr === nextAbbr)) {
      index += 1;
      nextAbbr = `${source.abbr}_${index}`;
    }

    return this.addAssembly({ ...source, abbr: nextAbbr });
  }

  validateAbbr(abbrRaw) {
    const normalized = String(abbrRaw || "").trim().replace(/\s+/g, "_");
    const cleaned = normalized.replace(/[^A-Za-zА-Яа-я0-9_-]/g, "");
    if (!cleaned) {
      throw new Error("Invalid assembly abbreviation");
    }
    return cleaned;
  }

  sortAssemblies() {
    this.model.assemblies.sort((a, b) => a.abbr.localeCompare(b.abbr, "ru"));
  }

  emit() {
    this.eventBus.emit("ASSEMBLIES_CHANGED", this.getModel());
  }

  persistDebounced() {
    this.scheduler.debounce("persist_tkp_model", async () => {
      await this.idbStore.put("tkpModel", this.model);
    }, 350);
  }
}
