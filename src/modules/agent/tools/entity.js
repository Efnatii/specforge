import { AgentAssemblyToolsModule } from "./assembly/index.js";
import { AgentPositionToolsModule } from "./position/index.js";

export class AgentEntityToolsModule {
  constructor(ctx) {
    this._facade = createAgentEntityToolsInternal(ctx);
    this.tryExecute = this.tryExecute.bind(this);
  }

  async tryExecute(name, args, turnCtx = null) {
    return this._facade.tryExecute(name, args, turnCtx);
  }
}

function createAgentEntityToolsInternal(ctx) {
  const { app, deps } = ctx || {};
  if (!app) throw new Error("AgentEntityToolsModule requires app");
  if (!deps) throw new Error("AgentEntityToolsModule requires deps");

  const {
    marketVerificationModule,
    gridApi,
    addTableJournal,
    addChangesJournal,
    renderAll,
    activeSheet,
    assemblyById,
    deletePosition,
    makePosition,
    makeAssembly,
    deriveAbbr,
    keepAbbr,
    nextCopyAssemblyName,
    uid,
    num,
  } = deps;

  if (!marketVerificationModule) throw new Error("AgentEntityToolsModule requires marketVerificationModule");
  if (!gridApi) throw new Error("AgentEntityToolsModule requires gridApi");
  if (typeof addTableJournal !== "function") throw new Error("AgentEntityToolsModule requires addTableJournal()");
  if (typeof addChangesJournal !== "function") throw new Error("AgentEntityToolsModule requires addChangesJournal()");
  if (typeof renderAll !== "function") throw new Error("AgentEntityToolsModule requires renderAll()");
  if (typeof activeSheet !== "function") throw new Error("AgentEntityToolsModule requires activeSheet()");
  if (typeof assemblyById !== "function") throw new Error("AgentEntityToolsModule requires assemblyById()");
  if (typeof deletePosition !== "function") throw new Error("AgentEntityToolsModule requires deletePosition()");
  if (typeof makePosition !== "function") throw new Error("AgentEntityToolsModule requires makePosition()");
  if (typeof makeAssembly !== "function") throw new Error("AgentEntityToolsModule requires makeAssembly()");
  if (typeof deriveAbbr !== "function") throw new Error("AgentEntityToolsModule requires deriveAbbr()");
  if (typeof keepAbbr !== "function") throw new Error("AgentEntityToolsModule requires keepAbbr()");
  if (typeof nextCopyAssemblyName !== "function") throw new Error("AgentEntityToolsModule requires nextCopyAssemblyName()");
  if (typeof uid !== "function") throw new Error("AgentEntityToolsModule requires uid()");
  if (typeof num !== "function") throw new Error("AgentEntityToolsModule requires num()");
  if (typeof gridApi.compactForTool !== "function") throw new Error("AgentEntityToolsModule requires gridApi.compactForTool()");

  const compactForTool = (...args) => gridApi.compactForTool(...args);

  function resolveAgentAssembly(args) {
    const id = String(args?.assembly_id || "").trim();
    const nameRaw = String(args?.assembly_name || "").trim();
    const explicitTarget = Boolean(id || nameRaw);
    if (id) {
      const byId = assemblyById(id);
      if (byId) {
        app.ai.lastAssemblyId = byId.id;
        return byId;
      }
    }

    if (nameRaw) {
      const name = nameRaw.toLowerCase();
      const exact = app.state.assemblies.find((a) => {
        const full = String(a.fullName || "").trim().toLowerCase();
        const abbr = String(a.abbreviation || "").trim().toLowerCase();
        return full === name || abbr === name;
      });
      if (exact) {
        app.ai.lastAssemblyId = exact.id;
        return exact;
      }

      const partial = app.state.assemblies.find((a) => {
        const full = String(a.fullName || "").trim().toLowerCase();
        const abbr = String(a.abbreviation || "").trim().toLowerCase();
        return full.includes(name) || name.includes(full) || abbr.includes(name) || name.includes(abbr);
      });
      if (partial) {
        app.ai.lastAssemblyId = partial.id;
        return partial;
      }
    }

    const rememberedId = String(app.ai.lastAssemblyId || "").trim();
    if (rememberedId) {
      const remembered = assemblyById(rememberedId);
      if (remembered) {
        app.ai.lastAssemblyId = remembered.id;
        if (explicitTarget) {
          addTableJournal("agent.fallback", `assembly fallback -> remembered (${remembered.fullName})`, {
            status: "running",
            meta: { requested_id: id || null, requested_name: nameRaw || null, resolved_id: remembered.id, reason: "remembered" },
          });
        }
        return remembered;
      }
    }

    const selId = String(app.ui?.treeSel?.id || "").trim();
    if (selId) {
      const selected = assemblyById(selId);
      if (selected) {
        app.ai.lastAssemblyId = selected.id;
        if (explicitTarget) {
          addTableJournal("agent.fallback", `assembly fallback -> selected (${selected.fullName})`, {
            status: "running",
            meta: { requested_id: id || null, requested_name: nameRaw || null, resolved_id: selected.id, reason: "selected" },
          });
        }
        return selected;
      }
    }

    const activeId = String(app.ui?.activeSheetId || "").trim();
    const m = activeId.match(/^assembly:([^:]+):/);
    if (m?.[1]) {
      const bySheet = assemblyById(m[1]);
      if (bySheet) {
        app.ai.lastAssemblyId = bySheet.id;
        if (explicitTarget) {
          addTableJournal("agent.fallback", `assembly fallback -> active sheet (${bySheet.fullName})`, {
            status: "running",
            meta: { requested_id: id || null, requested_name: nameRaw || null, resolved_id: bySheet.id, reason: "active_sheet" },
          });
        }
        return bySheet;
      }
    }

    if (app.state.assemblies.length === 1) {
      app.ai.lastAssemblyId = app.state.assemblies[0].id;
      if (explicitTarget) {
        addTableJournal("agent.fallback", `assembly fallback -> only assembly (${app.state.assemblies[0].fullName})`, {
          status: "running",
          meta: { requested_id: id || null, requested_name: nameRaw || null, resolved_id: app.state.assemblies[0].id, reason: "single" },
        });
      }
      return app.state.assemblies[0];
    }

    if (app.state.assemblies.length > 1) {
      const fallback = app.state.assemblies[app.state.assemblies.length - 1];
      app.ai.lastAssemblyId = fallback.id;
      if (explicitTarget) {
        addTableJournal("agent.fallback", `assembly fallback -> last (${fallback.fullName})`, {
          status: "running",
          meta: { requested_id: id || null, requested_name: nameRaw || null, resolved_id: fallback.id, reason: "last" },
        });
      }
      return fallback;
    }

    return null;
  }

  function normalizeAgentPositionList(raw) {
    const txt = String(raw || "").trim().toLowerCase();
    if (!txt) return "main";
    if (txt === "cons" || txt === "consumable" || txt === "consumables" || txt === "расходники" || txt === "расходные") return "consumable";
    return "main";
  }

  const assemblyTools = new AgentAssemblyToolsModule({
    app,
    deps: {
      addTableJournal,
      addChangesJournal,
      renderAll,
      activeSheet,
      makePosition,
      makeAssembly,
      deriveAbbr,
      keepAbbr,
      nextCopyAssemblyName,
      uid,
      num,
      resolveAgentAssembly,
      normalizeAgentPositionList,
      compactForTool,
    },
  });

  const positionTools = new AgentPositionToolsModule({
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
      num,
      resolveAgentAssembly,
      normalizeAgentPositionList,
      compactForTool,
    },
  });

  async function tryExecute(name, args, turnCtx = null) {
    const assemblyResult = await assemblyTools.tryExecute(name, args, turnCtx);
    if (assemblyResult !== undefined) return assemblyResult;

    return positionTools.tryExecute(name, args, turnCtx);
  }

  return { tryExecute };
}
