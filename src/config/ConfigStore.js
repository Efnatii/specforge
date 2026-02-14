import { BindingMap } from "../domain/BindingMap.js";
import { TemplateSchema } from "../editor/TemplateSchema.js";
import { Migrations } from "./Migrations.js";

const KEY_SCHEMA = "config.schema.override";
const KEY_BINDINGS = "config.bindings.override";

export class ConfigStore {
  constructor({ idbStore, baseUrl }) {
    this.idbStore = idbStore;
    this.baseUrl = baseUrl || "/";
    this.schemaDefault = null;
    this.bindingsDefault = null;
    this.schemaOverride = null;
    this.bindingsOverride = null;
  }

  async init() {
    const [schemaDefault, bindingsDefault, schemaOverride, bindingsOverride] = await Promise.all([
      this.fetchJson(`${this.baseUrl}assets/template.schema.json`),
      this.fetchJson(`${this.baseUrl}assets/binding.map.json`),
      this.idbStore.get(KEY_SCHEMA),
      this.idbStore.get(KEY_BINDINGS)
    ]);

    this.schemaDefault = schemaDefault;
    this.bindingsDefault = bindingsDefault;
    this.schemaOverride = schemaOverride?.json || null;
    this.bindingsOverride = bindingsOverride?.json || null;
  }

  getEffectiveSchema() {
    const migrated = Migrations.migrateSchema(this.schemaOverride || this.schemaDefault || {});
    const schema = new TemplateSchema(migrated);
    return { json: migrated, schema, meta: this.schemaOverride ? { source: "override" } : { source: "asset" } };
  }

  getEffectiveBindings() {
    const migrated = Migrations.migrateBindings(this.bindingsOverride || this.bindingsDefault || {});
    const bindings = new BindingMap(migrated);
    return { json: migrated, bindings, meta: this.bindingsOverride ? { source: "override" } : { source: "asset" } };
  }

  async setOverrideSchema(json, note = "") {
    const migrated = Migrations.migrateSchema(json);
    this.validateSchema(migrated);
    this.schemaOverride = migrated;
    await this.idbStore.set(KEY_SCHEMA, { savedAtTs: Date.now(), version: migrated.schemaVersion, note, json: migrated });
    return migrated;
  }

  async setOverrideBindings(json, note = "") {
    const migrated = Migrations.migrateBindings(json);
    this.validateBindings(migrated);
    this.bindingsOverride = migrated;
    await this.idbStore.set(KEY_BINDINGS, { savedAtTs: Date.now(), version: migrated.version, note, json: migrated });
    return migrated;
  }

  async clearOverrides() {
    this.schemaOverride = null;
    this.bindingsOverride = null;
    await Promise.all([this.idbStore.delete(KEY_SCHEMA), this.idbStore.delete(KEY_BINDINGS)]);
  }

  getHistory() {
    return [];
  }

  validateSchema(json) {
    if (!Number.isFinite(Number(json.schemaVersion))) {
      throw new Error("schemaVersion must be a number");
    }
    if (!Array.isArray(json.sheets)) {
      throw new Error("sheets[] is required");
    }
    for (const sheet of json.sheets) {
      if (!sheet.match || (typeof sheet.match !== "object")) {
        throw new Error("sheet.match is required");
      }
      if (!Array.isArray(sheet.editable)) {
        throw new Error("sheet.editable[] is required");
      }
    }
  }

  validateBindings(json) {
    if (!Number.isFinite(Number(json.version))) {
      throw new Error("version must be a number");
    }
    if (!json.commonSheet?.name) {
      throw new Error("commonSheet.name is required");
    }
    const table = json.commonSheet?.assembliesTable;
    if (table && (Number(table.startRow) <= 0 || Number(table.maxRows) <= 0)) {
      throw new Error("assembliesTable startRow/maxRows must be > 0");
    }
  }

  async fetchJson(url) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) {
        return {};
      }
      return await res.json();
    } catch {
      return {};
    }
  }
}
