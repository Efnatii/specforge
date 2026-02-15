export class AgentAssemblyQueryToolsModule {
  constructor(ctx) {
    this._facade = createAgentAssemblyQueryToolsInternal(ctx);
    this.tryExecute = this.tryExecute.bind(this);
  }

  async tryExecute(name, args, turnCtx = null) {
    return this._facade.tryExecute(name, args, turnCtx);
  }
}

function createAgentAssemblyQueryToolsInternal(ctx) {
  const { app, deps } = ctx || {};
  if (!app) throw new Error("AgentAssemblyQueryToolsModule requires app");
  if (!deps) throw new Error("AgentAssemblyQueryToolsModule requires deps");

  const {
    addTableJournal,
    activeSheet,
    num,
    resolveAgentAssembly,
    normalizeAgentPositionList,
    compactForTool,
  } = deps;

  if (typeof addTableJournal !== "function") throw new Error("AgentAssemblyQueryToolsModule requires addTableJournal()");
  if (typeof activeSheet !== "function") throw new Error("AgentAssemblyQueryToolsModule requires activeSheet()");
  if (typeof num !== "function") throw new Error("AgentAssemblyQueryToolsModule requires num()");
  if (typeof resolveAgentAssembly !== "function") throw new Error("AgentAssemblyQueryToolsModule requires resolveAgentAssembly()");
  if (typeof normalizeAgentPositionList !== "function") throw new Error("AgentAssemblyQueryToolsModule requires normalizeAgentPositionList()");
  if (typeof compactForTool !== "function") throw new Error("AgentAssemblyQueryToolsModule requires compactForTool()");

  async function tryExecute(name, args, turnCtx = null) {
    void turnCtx;

    if (name === "list_assemblies") {
      const assemblies = app.state.assemblies.map((a) => ({
        id: a.id,
        full_name: a.fullName,
        abbreviation: a.abbreviation,
        main_count: Array.isArray(a.main) ? a.main.length : 0,
        consumable_count: Array.isArray(a.consumable) ? a.consumable.length : 0,
        separate_consumables: Boolean(a.separateConsumables),
      }));
      addTableJournal("list_assemblies", `Получено сборок: ${assemblies.length}`);
      return { ok: true, assemblies };
    }

    if (name === "resolve_target_context") {
      const assembly = resolveAgentAssembly(args);
      const listRaw = String(args?.list || "").trim().toLowerCase();
      const list = listRaw === "project" ? "project" : normalizeAgentPositionList(args?.list);
      let position = null;
      if (args?.position_id) {
        const posId = String(args.position_id || "").trim();
        if (list === "project") {
          position = app.state.projectConsumables.find((p) => p.id === posId) || null;
        } else if (assembly) {
          const arr = list === "consumable" ? assembly.consumable : assembly.main;
          position = arr.find((p) => p.id === posId) || null;
        }
      }
      const sheet = activeSheet();
      const result = {
        ok: true,
        applied: 0,
        entity: { type: "context" },
        warnings: [],
        context: {
          active_sheet: sheet ? { id: sheet.id, name: sheet.name } : null,
          tree_selection: compactForTool(app.ui.treeSel || {}),
          assembly: assembly ? { id: assembly.id, full_name: assembly.fullName, abbreviation: assembly.abbreviation } : null,
          list,
          position: position ? { id: position.id, name: position.name } : null,
        },
      };
      addTableJournal("resolve_target_context", `Контекст: лист=${result.context.active_sheet?.name || "-"}, list=${list}`);
      return result;
    }

    if (name === "read_assembly") {
      const assembly = resolveAgentAssembly(args);
      if (!assembly) {
        addTableJournal("read_assembly", "Ошибка: сборка не найдена");
        return { ok: false, error: "assembly not found" };
      }
      const includePositions = Boolean(args?.include_positions);
      const result = {
        ok: true,
        assembly: {
          id: assembly.id,
          full_name: assembly.fullName,
          abbreviation: assembly.abbreviation,
          abbr_manual: Boolean(assembly.abbrManual),
          separate_consumables: Boolean(assembly.separateConsumables),
          manual_cons_no_disc: num(assembly.manualConsNoDisc, 0),
          manual_cons_disc: num(assembly.manualConsDisc, 0),
          labor: { ...assembly.labor },
          main_count: Array.isArray(assembly.main) ? assembly.main.length : 0,
          consumable_count: Array.isArray(assembly.consumable) ? assembly.consumable.length : 0,
        },
      };
      if (includePositions) {
        result.assembly.main = compactForTool(assembly.main);
        result.assembly.consumable = compactForTool(assembly.consumable);
      }
      addTableJournal("read_assembly", `Чтение сборки ${assembly.fullName}`);
      return result;
    }

    return undefined;
  }

  return { tryExecute };
}
