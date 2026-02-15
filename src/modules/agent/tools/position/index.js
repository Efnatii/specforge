import { AgentAssemblyPositionToolsModule } from "../assembly/position.js";
import { AgentProjectPositionToolsModule } from "./project.js";

export class AgentPositionToolsModule {
  constructor(ctx) {
    this._facade = createAgentPositionToolsInternal(ctx);
    this.tryExecute = this.tryExecute.bind(this);
  }

  async tryExecute(name, args, turnCtx = null) {
    return this._facade.tryExecute(name, args, turnCtx);
  }
}

function createAgentPositionToolsInternal(ctx) {
  const { app, deps } = ctx || {};
  if (!app) throw new Error("AgentPositionToolsModule requires app");
  if (!deps) throw new Error("AgentPositionToolsModule requires deps");

  const {
    marketVerificationModule,
    addTableJournal,
    addChangesJournal,
    renderAll,
    deletePosition,
    makePosition,
    makeAssembly,
    deriveAbbr,
    uid,
    num,
    resolveAgentAssembly,
    normalizeAgentPositionList,
    compactForTool,
  } = deps;

  if (!marketVerificationModule) throw new Error("AgentPositionToolsModule requires marketVerificationModule");
  if (typeof addTableJournal !== "function") throw new Error("AgentPositionToolsModule requires addTableJournal()");
  if (typeof addChangesJournal !== "function") throw new Error("AgentPositionToolsModule requires addChangesJournal()");
  if (typeof renderAll !== "function") throw new Error("AgentPositionToolsModule requires renderAll()");
  if (typeof deletePosition !== "function") throw new Error("AgentPositionToolsModule requires deletePosition()");
  if (typeof makePosition !== "function") throw new Error("AgentPositionToolsModule requires makePosition()");
  if (typeof makeAssembly !== "function") throw new Error("AgentPositionToolsModule requires makeAssembly()");
  if (typeof deriveAbbr !== "function") throw new Error("AgentPositionToolsModule requires deriveAbbr()");
  if (typeof uid !== "function") throw new Error("AgentPositionToolsModule requires uid()");
  if (typeof num !== "function") throw new Error("AgentPositionToolsModule requires num()");
  if (typeof resolveAgentAssembly !== "function") throw new Error("AgentPositionToolsModule requires resolveAgentAssembly()");
  if (typeof normalizeAgentPositionList !== "function") throw new Error("AgentPositionToolsModule requires normalizeAgentPositionList()");
  if (typeof compactForTool !== "function") throw new Error("AgentPositionToolsModule requires compactForTool()");

  function appendVerificationToPosition(position, verification) {
    if (!position || !verification) return;
    const urls = Array.isArray(verification.sources) ? verification.sources.map((s) => s.url).slice(0, 3) : [];
    const docs = Array.isArray(verification.attachments) ? verification.attachments.map((d) => d.name).slice(0, 3) : [];
    if (!urls.length && !docs.length) return;
    const mode = String(verification.via || "unknown");
    const chunks = [];
    if (verification.query) chunks.push(verification.query);
    if (urls.length) chunks.push(`web: ${urls.join(" ; ")}`);
    if (docs.length) chunks.push(`docs: ${docs.join(" ; ")}`);
    const suffix = `[verified:${mode}] ${chunks.join(" | ")}`.trim();
    const prev = String(position.note || "").trim();
    const next = prev ? `${prev}\n${suffix}` : suffix;
    position.note = next.slice(0, 4000);
  }

  function normalizeAgentRatio(raw, fallback = 0) {
    const n = num(raw, fallback);
    if (n > 1 && n <= 100) return n / 100;
    return n;
  }

  function applyAgentPositionPatch(position, args) {
    if (!position || !args || typeof args !== "object") return [];
    const changed = [];
    const str = (v) => String(v || "").trim();

    if (args.name !== undefined) {
      position.name = str(args.name);
      changed.push("name");
    }
    if (args.qty !== undefined) {
      position.qty = num(args.qty, position.qty);
      changed.push("qty");
    }
    if (args.unit !== undefined) {
      const u = str(args.unit);
      if (u) {
        position.unit = u;
        changed.push("unit");
      }
    }
    if (args.manufacturer !== undefined) {
      position.manufacturer = str(args.manufacturer);
      changed.push("manufacturer");
    }
    if (args.article !== undefined) {
      position.article = str(args.article);
      changed.push("article");
    }
    if (args.schematic !== undefined) {
      position.schematic = str(args.schematic);
      changed.push("schematic");
    }
    if (args.supplier !== undefined) {
      position.supplier = str(args.supplier);
      changed.push("supplier");
    }
    if (args.note !== undefined) {
      position.note = String(args.note || "").trim();
      changed.push("note");
    }
    if (args.price_catalog_vat_markup !== undefined) {
      position.priceCatalogVatMarkup = num(args.price_catalog_vat_markup, position.priceCatalogVatMarkup);
      changed.push("price_catalog_vat_markup");
    }
    if (args.markup !== undefined) {
      position.markup = normalizeAgentRatio(args.markup, position.markup);
      changed.push("markup");
    }
    if (args.discount !== undefined) {
      position.discount = normalizeAgentRatio(args.discount, position.discount);
      changed.push("discount");
    }
    return changed;
  }

  const assemblyPositionTools = new AgentAssemblyPositionToolsModule({
    app,
    deps: {
      marketVerificationModule,
      addTableJournal,
      addChangesJournal,
      renderAll,
      deletePosition,
      makePosition,
      makeAssembly,
      deriveAbbr,
      uid,
      resolveAgentAssembly,
      normalizeAgentPositionList,
      compactForTool,
      applyAgentPositionPatch,
      appendVerificationToPosition,
    },
  });

  const projectPositionTools = new AgentProjectPositionToolsModule({
    app,
    deps: {
      marketVerificationModule,
      addTableJournal,
      addChangesJournal,
      renderAll,
      deletePosition,
      makePosition,
      uid,
      compactForTool,
      applyAgentPositionPatch,
      appendVerificationToPosition,
    },
  });

  async function tryExecute(name, args, turnCtx = null) {
    if (name === "read_position" || name === "duplicate_position") {
      const listRaw = String(args?.list || "").trim().toLowerCase();
      if (listRaw === "project") {
        return projectPositionTools.tryExecute(name, args, turnCtx);
      }
      return assemblyPositionTools.tryExecute(name, args, turnCtx);
    }

    const assemblyResult = await assemblyPositionTools.tryExecute(name, args, turnCtx);
    if (assemblyResult !== undefined) return assemblyResult;

    return projectPositionTools.tryExecute(name, args, turnCtx);
  }

  return { tryExecute };
}
