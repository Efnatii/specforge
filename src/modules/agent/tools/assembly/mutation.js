export class AgentAssemblyMutationToolsModule {
  constructor(ctx) {
    this._facade = createAgentAssemblyMutationToolsInternal(ctx);
    this.tryExecute = this.tryExecute.bind(this);
  }

  async tryExecute(name, args, turnCtx = null) {
    return this._facade.tryExecute(name, args, turnCtx);
  }
}

function createAgentAssemblyMutationToolsInternal(ctx) {
  const { app, deps } = ctx || {};
  if (!app) throw new Error("AgentAssemblyMutationToolsModule requires app");
  if (!deps) throw new Error("AgentAssemblyMutationToolsModule requires deps");

  const {
    addTableJournal,
    addChangesJournal,
    renderAll,
    makePosition,
    makeAssembly,
    deriveAbbr,
    keepAbbr,
    nextCopyAssemblyName,
    uid,
    num,
    resolveAgentAssembly,
  } = deps;

  if (typeof addTableJournal !== "function") throw new Error("AgentAssemblyMutationToolsModule requires addTableJournal()");
  if (typeof addChangesJournal !== "function") throw new Error("AgentAssemblyMutationToolsModule requires addChangesJournal()");
  if (typeof renderAll !== "function") throw new Error("AgentAssemblyMutationToolsModule requires renderAll()");
  if (typeof makePosition !== "function") throw new Error("AgentAssemblyMutationToolsModule requires makePosition()");
  if (typeof makeAssembly !== "function") throw new Error("AgentAssemblyMutationToolsModule requires makeAssembly()");
  if (typeof deriveAbbr !== "function") throw new Error("AgentAssemblyMutationToolsModule requires deriveAbbr()");
  if (typeof keepAbbr !== "function") throw new Error("AgentAssemblyMutationToolsModule requires keepAbbr()");
  if (typeof nextCopyAssemblyName !== "function") throw new Error("AgentAssemblyMutationToolsModule requires nextCopyAssemblyName()");
  if (typeof uid !== "function") throw new Error("AgentAssemblyMutationToolsModule requires uid()");
  if (typeof num !== "function") throw new Error("AgentAssemblyMutationToolsModule requires num()");
  if (typeof resolveAgentAssembly !== "function") throw new Error("AgentAssemblyMutationToolsModule requires resolveAgentAssembly()");

  async function tryExecute(name, args, turnCtx = null) {
    void turnCtx;

    if (name === "bulk_delete_assemblies") {
      const scope = String(args?.scope || "").trim().toLowerCase() === "all" ? "all" : "filtered";
      let targets = [];
      if (scope === "all") {
        targets = [...app.state.assemblies];
      } else {
        const idSet = new Set((Array.isArray(args?.assembly_ids) ? args.assembly_ids : []).map((x) => String(x || "").trim()).filter(Boolean));
        const nameSet = new Set((Array.isArray(args?.assembly_names) ? args.assembly_names : []).map((x) => String(x || "").trim().toLowerCase()).filter(Boolean));
        const match = String(args?.match || "").trim().toLowerCase();
        targets = app.state.assemblies.filter((a) => {
          if (idSet.has(a.id)) return true;
          const full = String(a.fullName || "").trim().toLowerCase();
          const abbr = String(a.abbreviation || "").trim().toLowerCase();
          if (nameSet.has(full) || nameSet.has(abbr)) return true;
          if (match && (full.includes(match) || abbr.includes(match))) return true;
          return false;
        });
      }

      if (!targets.length) {
        addTableJournal("bulk_delete_assemblies", "Ничего не удалено: цели не найдены");
        return { ok: true, applied: 0, scope, deleted_count: 0, warnings: ["no targets"], entity: { type: "assembly_collection" } };
      }

      const targetIds = new Set(targets.map((a) => a.id));
      app.state.assemblies = app.state.assemblies.filter((a) => !targetIds.has(a.id));
      if (targetIds.has(app.ai.lastAssemblyId)) {
        app.ai.lastAssemblyId = app.state.assemblies.length ? app.state.assemblies[app.state.assemblies.length - 1].id : "";
      }
      app.ui.treeSel = { type: "settings" };
      app.ui.activeSheetId = "summary";
      renderAll();
      addTableJournal("bulk_delete_assemblies", `Удалено сборок: ${targets.length}`, {
        meta: {
          scope,
          deleted: targets.map((a) => ({ id: a.id, full_name: a.fullName })),
        },
      });
      addChangesJournal("assembly.delete.bulk", `scope=${scope}, count=${targets.length}`);
      return {
        ok: true,
        applied: targets.length,
        scope,
        deleted_count: targets.length,
        deleted: targets.map((a) => ({ id: a.id, full_name: a.fullName })),
        entity: { type: "assembly_collection" },
        warnings: [],
      };
    }

    if (name === "create_assembly") {
      const fullName = String(args?.full_name || "").trim();
      if (!fullName) {
        addTableJournal("create_assembly", "Ошибка: full_name required");
        return { ok: false, error: "full_name required" };
      }

      const existing = app.state.assemblies.find((a) => String(a.fullName || "").trim().toLowerCase() === fullName.toLowerCase());
      if (existing) {
        addTableJournal("create_assembly", `Пропуск: сборка уже существует (${existing.fullName})`);
        app.ai.lastAssemblyId = existing.id;
        return {
          ok: true,
          created: false,
          assembly: {
            id: existing.id,
            full_name: existing.fullName,
            abbreviation: existing.abbreviation,
          },
        };
      }

      const assembly = makeAssembly(app.state.assemblies.length + 1);
      assembly.fullName = fullName;

      const abbr = keepAbbr(args?.abbreviation);
      if (abbr) {
        assembly.abbreviation = abbr;
        assembly.abbrManual = true;
      } else {
        assembly.abbreviation = deriveAbbr(fullName);
        assembly.abbrManual = false;
      }

      assembly.separateConsumables = Boolean(args?.separate_consumables);
      if (assembly.separateConsumables && (!Array.isArray(assembly.consumable) || !assembly.consumable.length)) {
        assembly.consumable = [makePosition()];
      }

      app.state.assemblies.push(assembly);
      app.ai.lastAssemblyId = assembly.id;
      app.ui.treeSel = { type: "assembly", id: assembly.id };
      app.ui.activeSheetId = `assembly:${assembly.id}:main`;
      renderAll();
      addTableJournal("create_assembly", `Создана сборка ${assembly.fullName} (${assembly.id})`);
      addChangesJournal("assembly.add", `${assembly.id}:${assembly.fullName}`);
      return {
        ok: true,
        created: true,
        assembly: {
          id: assembly.id,
          full_name: assembly.fullName,
          abbreviation: assembly.abbreviation,
        },
      };
    }

    if (name === "update_assembly") {
      const assembly = resolveAgentAssembly(args);
      if (!assembly) {
        addTableJournal("update_assembly", "Ошибка: сборка не найдена");
        return { ok: false, error: "assembly not found" };
      }

      const changed = [];
      if (args?.full_name !== undefined) {
        assembly.fullName = String(args.full_name || "").trim();
        if (!assembly.abbrManual) assembly.abbreviation = deriveAbbr(assembly.fullName);
        changed.push("full_name");
      }
      if (args?.abbreviation !== undefined) {
        assembly.abbreviation = keepAbbr(args.abbreviation);
        changed.push("abbreviation");
      }
      if (args?.abbr_manual !== undefined) {
        assembly.abbrManual = Boolean(args.abbr_manual);
        if (!assembly.abbrManual) assembly.abbreviation = deriveAbbr(assembly.fullName);
        changed.push("abbr_manual");
      }
      if (args?.separate_consumables !== undefined) {
        assembly.separateConsumables = Boolean(args.separate_consumables);
        if (assembly.separateConsumables && !assembly.consumable.length) assembly.consumable = [makePosition()];
        changed.push("separate_consumables");
      }
      if (args?.manual_cons_no_disc !== undefined) {
        assembly.manualConsNoDisc = num(args.manual_cons_no_disc, assembly.manualConsNoDisc);
        changed.push("manual_cons_no_disc");
      }
      if (args?.manual_cons_disc !== undefined) {
        assembly.manualConsDisc = num(args.manual_cons_disc, assembly.manualConsDisc);
        changed.push("manual_cons_disc");
      }
      if (args?.labor && typeof args.labor === "object") {
        for (const key of ["devCoeff", "devHours", "devRate", "assmCoeff", "assmHours", "assmRate", "profitCoeff"]) {
          if (args.labor[key] === undefined) continue;
          assembly.labor[key] = num(args.labor[key], assembly.labor[key]);
          changed.push(`labor.${key}`);
        }
      }

      if (!changed.length) {
        addTableJournal("update_assembly", "Ошибка: нет полей для изменения");
        return { ok: false, error: "no fields to update" };
      }

      renderAll();
      addTableJournal("update_assembly", `${assembly.fullName}: ${changed.join(", ")}`);
      addChangesJournal("assembly.update", `${assembly.id}: ${changed.join(", ")}`);
      return { ok: true, assembly: { id: assembly.id, full_name: assembly.fullName }, changed };
    }

    if (name === "duplicate_assembly") {
      const source = resolveAgentAssembly(args);
      if (!source) {
        addTableJournal("duplicate_assembly", "Ошибка: сборка не найдена");
        return { ok: false, error: "assembly not found" };
      }

      const copy = {
        ...source,
        id: uid(),
        fullName: nextCopyAssemblyName(source.fullName || "Сборка"),
        main: Array.isArray(source.main) && source.main.length ? source.main.map((p) => ({ ...p, id: uid() })) : [makePosition()],
        consumable: Array.isArray(source.consumable) && source.consumable.length ? source.consumable.map((p) => ({ ...p, id: uid() })) : [makePosition()],
        labor: { ...source.labor },
        manualConsNoDisc: num(source.manualConsNoDisc, 0),
        manualConsDisc: num(source.manualConsDisc, 0),
      };
      const srcIdx = app.state.assemblies.findIndex((a) => a.id === source.id);
      if (srcIdx >= 0) app.state.assemblies.splice(srcIdx + 1, 0, copy);
      else app.state.assemblies.push(copy);

      app.ai.lastAssemblyId = copy.id;
      app.ui.treeSel = { type: "assembly", id: copy.id };
      app.ui.activeSheetId = `assembly:${copy.id}:main`;
      renderAll();
      addTableJournal("duplicate_assembly", `${source.fullName} -> ${copy.fullName}`);
      addChangesJournal("assembly.duplicate", `${source.id} -> ${copy.id}`);
      return {
        ok: true,
        source: { id: source.id, full_name: source.fullName },
        copy: { id: copy.id, full_name: copy.fullName },
      };
    }

    if (name === "delete_assembly") {
      const assembly = resolveAgentAssembly(args);
      if (!assembly) {
        addTableJournal("delete_assembly", "Ошибка: сборка не найдена");
        return { ok: false, error: "assembly not found" };
      }

      app.state.assemblies = app.state.assemblies.filter((x) => x.id !== assembly.id);
      if (app.ai.lastAssemblyId === assembly.id) app.ai.lastAssemblyId = app.state.assemblies.length ? app.state.assemblies[app.state.assemblies.length - 1].id : "";
      app.ui.treeSel = { type: "settings" };
      app.ui.activeSheetId = "summary";
      renderAll();
      addTableJournal("delete_assembly", `Удалена сборка ${assembly.fullName}`);
      addChangesJournal("assembly.delete", assembly.fullName || assembly.id);
      return { ok: true, deleted: { id: assembly.id, full_name: assembly.fullName } };
    }

    return undefined;
  }

  return { tryExecute };
}
