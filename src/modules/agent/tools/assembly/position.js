export class AgentAssemblyPositionToolsModule {
  constructor(ctx) {
    this._facade = createAgentAssemblyPositionToolsInternal(ctx);
    this.tryExecute = this.tryExecute.bind(this);
  }

  async tryExecute(name, args, turnCtx = null) {
    return this._facade.tryExecute(name, args, turnCtx);
  }
}

function createAgentAssemblyPositionToolsInternal(ctx) {
  const { app, deps } = ctx || {};
  if (!app) throw new Error("AgentAssemblyPositionToolsModule requires app");
  if (!deps) throw new Error("AgentAssemblyPositionToolsModule requires deps");

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
    resolveAgentAssembly,
    normalizeAgentPositionList,
    compactForTool,
    applyAgentPositionPatch,
    appendVerificationToPosition,
  } = deps;

  if (!marketVerificationModule) throw new Error("AgentAssemblyPositionToolsModule requires marketVerificationModule");
  if (typeof addTableJournal !== "function") throw new Error("AgentAssemblyPositionToolsModule requires addTableJournal()");
  if (typeof addChangesJournal !== "function") throw new Error("AgentAssemblyPositionToolsModule requires addChangesJournal()");
  if (typeof renderAll !== "function") throw new Error("AgentAssemblyPositionToolsModule requires renderAll()");
  if (typeof deletePosition !== "function") throw new Error("AgentAssemblyPositionToolsModule requires deletePosition()");
  if (typeof makePosition !== "function") throw new Error("AgentAssemblyPositionToolsModule requires makePosition()");
  if (typeof makeAssembly !== "function") throw new Error("AgentAssemblyPositionToolsModule requires makeAssembly()");
  if (typeof deriveAbbr !== "function") throw new Error("AgentAssemblyPositionToolsModule requires deriveAbbr()");
  if (typeof uid !== "function") throw new Error("AgentAssemblyPositionToolsModule requires uid()");
  if (typeof resolveAgentAssembly !== "function") throw new Error("AgentAssemblyPositionToolsModule requires resolveAgentAssembly()");
  if (typeof normalizeAgentPositionList !== "function") throw new Error("AgentAssemblyPositionToolsModule requires normalizeAgentPositionList()");
  if (typeof compactForTool !== "function") throw new Error("AgentAssemblyPositionToolsModule requires compactForTool()");
  if (typeof applyAgentPositionPatch !== "function") throw new Error("AgentAssemblyPositionToolsModule requires applyAgentPositionPatch()");
  if (typeof appendVerificationToPosition !== "function") throw new Error("AgentAssemblyPositionToolsModule requires appendVerificationToPosition()");

  async function tryExecute(name, args, turnCtx = null) {
    if (name === "list_positions") {
      const assembly = resolveAgentAssembly(args);
      if (!assembly) {
        if (!app.state.assemblies.length) {
          const listKey = normalizeAgentPositionList(args?.list);
          addTableJournal("list_positions", "Сборок нет, возвращен пустой список");
          return { ok: true, assembly: null, list: listKey, positions: [] };
        }
        addTableJournal("list_positions", "Ошибка: сборка не найдена");
        return { ok: false, error: "assembly not found" };
      }
      const listKey = normalizeAgentPositionList(args?.list);
      const arr = listKey === "consumable" ? assembly.consumable : assembly.main;
      const includeDetails = Boolean(args?.include_details);
      const positions = arr.map((p) => (includeDetails ? compactForTool(p) : {
        id: p.id,
        name: p.name,
        qty: p.qty,
        unit: p.unit,
        manufacturer: p.manufacturer,
        article: p.article,
      }));
      addTableJournal("list_positions", `${assembly.fullName}.${listKey}: ${positions.length}`);
      return {
        ok: true,
        assembly: { id: assembly.id, full_name: assembly.fullName },
        list: listKey,
        positions,
      };
    }

    if (name === "read_position") {
      const listRaw = String(args?.list || "").trim().toLowerCase();
      if (listRaw === "project") return undefined;

      const posId = String(args?.position_id || "").trim();
      if (!posId) {
        addTableJournal("read_position", "Ошибка: position_id required");
        return { ok: false, applied: 0, entity: { type: "position" }, warnings: [], error: "position_id required" };
      }

      const assembly = resolveAgentAssembly(args);
      if (!assembly) {
        addTableJournal("read_position", "Ошибка: сборка не найдена");
        return { ok: false, applied: 0, entity: { type: "position" }, warnings: [], error: "assembly not found" };
      }
      const listKey = normalizeAgentPositionList(args?.list);
      const arr = listKey === "consumable" ? assembly.consumable : assembly.main;
      const pos = arr.find((p) => p.id === posId) || null;
      if (!pos) {
        addTableJournal("read_position", "Ошибка: позиция не найдена");
        return { ok: false, applied: 0, entity: { type: "position" }, warnings: [], error: "position not found" };
      }
      addTableJournal("read_position", `${assembly.fullName}.${listKey}.${pos.id}`);
      return {
        ok: true,
        applied: 0,
        entity: { type: "position", id: pos.id },
        warnings: [],
        assembly: { id: assembly.id, full_name: assembly.fullName },
        list: listKey,
        position: compactForTool(pos),
      };
    }

    if (name === "add_position") {
      let assembly = resolveAgentAssembly(args);
      const listKey = normalizeAgentPositionList(args?.list);

      const baseName = String(args?.name || "").trim();
      if (!baseName) {
        addTableJournal("add_position", "Ошибка: name required");
        return { ok: false, error: "name required" };
      }

      const verified = marketVerificationModule.ensureMarketVerification(turnCtx, args?.verification, "add_position");
      if (!verified.ok) return { ok: false, error: verified.error };

      if (!assembly) {
        const autoName = String(args?.assembly_name || args?.assembly_id || "Новая сборка").trim() || "Новая сборка";
        assembly = makeAssembly(app.state.assemblies.length + 1);
        assembly.fullName = autoName;
        assembly.abbreviation = deriveAbbr(autoName);
        assembly.abbrManual = false;
        app.state.assemblies.push(assembly);
        app.ai.lastAssemblyId = assembly.id;
        addTableJournal("add_position", `Автосоздана сборка ${assembly.fullName} (${assembly.id})`);
        addChangesJournal("assembly.add.auto", `${assembly.id}:${assembly.fullName}`);
      }

      const target = listKey === "consumable" ? assembly.consumable : assembly.main;
      if (!Array.isArray(target)) {
        addTableJournal("add_position", "Ошибка: список позиций недоступен");
        return { ok: false, error: "target list unavailable" };
      }

      const position = makePosition();
      applyAgentPositionPatch(position, args);
      position.name = baseName;
      appendVerificationToPosition(position, verified.verification);

      target.push(position);
      app.ui.treeSel = { type: "pos", id: assembly.id, list: listKey === "consumable" ? "cons" : "main", pos: position.id };
      app.ui.activeSheetId = listKey === "consumable" ? `assembly:${assembly.id}:cons` : `assembly:${assembly.id}:main`;
      renderAll();
      addTableJournal("add_position", `${assembly.fullName}.${listKey}: ${position.name}, qty=${position.qty} ${position.unit}`);
      addChangesJournal("position.add", `${assembly.id}.${listKey}.${position.id}`);
      return {
        ok: true,
        assembly: {
          id: assembly.id,
          full_name: assembly.fullName,
        },
        list: listKey,
        position: {
          id: position.id,
          name: position.name,
          qty: position.qty,
          unit: position.unit,
        },
      };
    }

    if (name === "update_position") {
      const assembly = resolveAgentAssembly(args);
      if (!assembly) {
        addTableJournal("update_position", "Ошибка: сборка не найдена");
        return { ok: false, error: "assembly not found" };
      }
      const listKey = normalizeAgentPositionList(args?.list);
      const arr = listKey === "consumable" ? assembly.consumable : assembly.main;
      const pos = arr.find((p) => p.id === String(args?.position_id || "")) || null;
      if (!pos) {
        addTableJournal("update_position", "Ошибка: позиция не найдена");
        return { ok: false, error: "position not found" };
      }

      if (marketVerificationModule.isMarketFieldTouched(args)) {
        const verified = marketVerificationModule.ensureMarketVerification(turnCtx, args?.verification, "update_position");
        if (!verified.ok) return { ok: false, error: verified.error };
        appendVerificationToPosition(pos, verified.verification);
      }

      const changed = applyAgentPositionPatch(pos, args);
      if (!changed.length) {
        addTableJournal("update_position", "Ошибка: нет полей для изменения");
        return { ok: false, error: "no fields to update" };
      }

      app.ui.treeSel = { type: "pos", id: assembly.id, list: listKey === "consumable" ? "cons" : "main", pos: pos.id };
      app.ui.activeSheetId = listKey === "consumable" ? `assembly:${assembly.id}:cons` : `assembly:${assembly.id}:main`;
      renderAll();
      addTableJournal("update_position", `${assembly.fullName}.${listKey}.${pos.id}: ${changed.join(", ")}`);
      addChangesJournal("position.update", `${assembly.id}.${listKey}.${pos.id}`);
      return { ok: true, changed, position: { id: pos.id, name: pos.name } };
    }

    if (name === "delete_position") {
      const assembly = resolveAgentAssembly(args);
      if (!assembly) {
        addTableJournal("delete_position", "Ошибка: сборка не найдена");
        return { ok: false, error: "assembly not found" };
      }
      const listKey = normalizeAgentPositionList(args?.list);
      const listForDelete = listKey === "consumable" ? "cons" : "main";
      const arr = listForDelete === "main" ? assembly.main : assembly.consumable;
      const posId = String(args?.position_id || "");
      const exists = arr.some((p) => p.id === posId);
      if (!exists) {
        addTableJournal("delete_position", "Ошибка: позиция не найдена");
        return { ok: false, error: "position not found" };
      }
      deletePosition(assembly.id, listForDelete, posId);
      addTableJournal("delete_position", `${assembly.fullName}.${listKey}: удалена ${posId}`);
      return { ok: true, deleted: { assembly_id: assembly.id, list: listKey, position_id: posId } };
    }

    if (name === "duplicate_position") {
      const listRaw = String(args?.list || "").trim().toLowerCase();
      if (listRaw === "project") return undefined;

      const posId = String(args?.position_id || "").trim();
      if (!posId) {
        addTableJournal("duplicate_position", "Ошибка: position_id required");
        return { ok: false, applied: 0, entity: { type: "position" }, warnings: [], error: "position_id required" };
      }

      const assembly = resolveAgentAssembly(args);
      if (!assembly) {
        addTableJournal("duplicate_position", "Ошибка: сборка не найдена");
        return { ok: false, applied: 0, entity: { type: "position" }, warnings: [], error: "assembly not found" };
      }
      const listKey = normalizeAgentPositionList(args?.list);
      const arr = listKey === "consumable" ? assembly.consumable : assembly.main;
      const idx = arr.findIndex((p) => p.id === posId);
      if (idx < 0) {
        addTableJournal("duplicate_position", "Ошибка: позиция не найдена");
        return { ok: false, applied: 0, entity: { type: "position" }, warnings: [], error: "position not found" };
      }
      const src = arr[idx];
      const copy = { ...src, id: uid() };
      arr.splice(idx + 1, 0, copy);
      app.ui.treeSel = { type: "pos", id: assembly.id, list: listKey === "consumable" ? "cons" : "main", pos: copy.id };
      app.ui.activeSheetId = listKey === "consumable" ? `assembly:${assembly.id}:cons` : `assembly:${assembly.id}:main`;
      renderAll();
      addTableJournal("duplicate_position", `${assembly.fullName}.${listKey}: ${src.id} -> ${copy.id}`);
      addChangesJournal("position.duplicate", `${assembly.id}.${listKey}.${src.id} -> ${copy.id}`);
      return {
        ok: true,
        applied: 1,
        entity: { type: "position", id: copy.id },
        warnings: [],
        assembly: { id: assembly.id, full_name: assembly.fullName },
        list: listKey,
        source: { id: src.id, name: src.name },
        copy: { id: copy.id, name: copy.name },
      };
    }

    return undefined;
  }

  return { tryExecute };
}
