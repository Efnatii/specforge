export class AgentProjectPositionToolsModule {
  constructor(ctx) {
    this._facade = createAgentProjectPositionToolsInternal(ctx);
    this.tryExecute = this.tryExecute.bind(this);
  }

  async tryExecute(name, args, turnCtx = null) {
    return this._facade.tryExecute(name, args, turnCtx);
  }
}

function createAgentProjectPositionToolsInternal(ctx) {
  const { app, deps } = ctx || {};
  if (!app) throw new Error("AgentProjectPositionToolsModule requires app");
  if (!deps) throw new Error("AgentProjectPositionToolsModule requires deps");

  const {
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
  } = deps;

  if (!marketVerificationModule) throw new Error("AgentProjectPositionToolsModule requires marketVerificationModule");
  if (typeof addTableJournal !== "function") throw new Error("AgentProjectPositionToolsModule requires addTableJournal()");
  if (typeof addChangesJournal !== "function") throw new Error("AgentProjectPositionToolsModule requires addChangesJournal()");
  if (typeof renderAll !== "function") throw new Error("AgentProjectPositionToolsModule requires renderAll()");
  if (typeof deletePosition !== "function") throw new Error("AgentProjectPositionToolsModule requires deletePosition()");
  if (typeof makePosition !== "function") throw new Error("AgentProjectPositionToolsModule requires makePosition()");
  if (typeof uid !== "function") throw new Error("AgentProjectPositionToolsModule requires uid()");
  if (typeof compactForTool !== "function") throw new Error("AgentProjectPositionToolsModule requires compactForTool()");
  if (typeof applyAgentPositionPatch !== "function") throw new Error("AgentProjectPositionToolsModule requires applyAgentPositionPatch()");
  if (typeof appendVerificationToPosition !== "function") throw new Error("AgentProjectPositionToolsModule requires appendVerificationToPosition()");

  async function tryExecute(name, args, turnCtx = null) {
    if (name === "read_position") {
      const listRaw = String(args?.list || "").trim().toLowerCase();
      if (listRaw !== "project") return undefined;

      const posId = String(args?.position_id || "").trim();
      if (!posId) {
        addTableJournal("read_position", "Ошибка: position_id required");
        return { ok: false, applied: 0, entity: { type: "position" }, warnings: [], error: "position_id required" };
      }

      const pos = app.state.projectConsumables.find((p) => p.id === posId) || null;
      if (!pos) {
        addTableJournal("read_position", "Ошибка: позиция не найдена");
        return { ok: false, applied: 0, entity: { type: "position" }, warnings: [], error: "position not found" };
      }
      addTableJournal("read_position", `project.${pos.id}`);
      return {
        ok: true,
        applied: 0,
        entity: { type: "position", id: pos.id },
        warnings: [],
        position: compactForTool(pos),
        list: "project",
      };
    }

    if (name === "duplicate_position") {
      const listRaw = String(args?.list || "").trim().toLowerCase();
      if (listRaw !== "project") return undefined;

      const posId = String(args?.position_id || "").trim();
      if (!posId) {
        addTableJournal("duplicate_position", "Ошибка: position_id required");
        return { ok: false, applied: 0, entity: { type: "position" }, warnings: [], error: "position_id required" };
      }

      const arr = app.state.projectConsumables;
      const idx = arr.findIndex((p) => p.id === posId);
      if (idx < 0) {
        addTableJournal("duplicate_position", "Ошибка: позиция не найдена");
        return { ok: false, applied: 0, entity: { type: "position" }, warnings: [], error: "position not found" };
      }
      const src = arr[idx];
      const copy = { ...src, id: uid() };
      arr.splice(idx + 1, 0, copy);
      app.ui.treeSel = { type: "projpos", pos: copy.id };
      app.ui.activeSheetId = "project-consumables";
      renderAll();
      addTableJournal("duplicate_position", `project: ${src.id} -> ${copy.id}`);
      addChangesJournal("project.position.duplicate", `${src.id} -> ${copy.id}`);
      return {
        ok: true,
        applied: 1,
        entity: { type: "position", id: copy.id },
        warnings: [],
        list: "project",
        source: { id: src.id, name: src.name },
        copy: { id: copy.id, name: copy.name },
      };
    }

    if (name === "add_project_position") {
      const baseName = String(args?.name || "").trim();
      if (!baseName) {
        addTableJournal("add_project_position", "Ошибка: name required");
        return { ok: false, error: "name required" };
      }

      const verified = marketVerificationModule.ensureMarketVerification(turnCtx, args?.verification, "add_project_position");
      if (!verified.ok) return { ok: false, error: verified.error };

      if (!app.state.hasProjectConsumables) app.state.hasProjectConsumables = true;
      const pos = makePosition();
      applyAgentPositionPatch(pos, args);
      pos.name = baseName;
      appendVerificationToPosition(pos, verified.verification);
      app.state.projectConsumables.push(pos);
      app.ui.treeSel = { type: "projpos", pos: pos.id };
      app.ui.activeSheetId = "project-consumables";
      renderAll();
      addTableJournal("add_project_position", `project: ${pos.name}, qty=${pos.qty} ${pos.unit}`);
      addChangesJournal("project.position.add", pos.id);
      return { ok: true, position: { id: pos.id, name: pos.name, qty: pos.qty, unit: pos.unit } };
    }

    if (name === "list_project_positions") {
      const includeDetails = Boolean(args?.include_details);
      const positions = app.state.projectConsumables.map((p) => (includeDetails ? compactForTool(p) : {
        id: p.id,
        name: p.name,
        qty: p.qty,
        unit: p.unit,
        manufacturer: p.manufacturer,
        article: p.article,
      }));
      addTableJournal("list_project_positions", `Получено позиций: ${positions.length}`);
      return {
        ok: true,
        applied: 0,
        entity: { type: "project_positions" },
        warnings: [],
        enabled: Boolean(app.state.hasProjectConsumables),
        positions,
      };
    }

    if (name === "update_project_position") {
      const posId = String(args?.position_id || "");
      const pos = app.state.projectConsumables.find((p) => p.id === posId) || null;
      if (!pos) {
        addTableJournal("update_project_position", "Ошибка: позиция не найдена");
        return { ok: false, error: "position not found" };
      }

      if (marketVerificationModule.isMarketFieldTouched(args)) {
        const verified = marketVerificationModule.ensureMarketVerification(turnCtx, args?.verification, "update_project_position");
        if (!verified.ok) return { ok: false, error: verified.error };
        appendVerificationToPosition(pos, verified.verification);
      }

      const changed = applyAgentPositionPatch(pos, args);
      if (!changed.length) {
        addTableJournal("update_project_position", "Ошибка: нет полей для изменения");
        return { ok: false, error: "no fields to update" };
      }
      app.ui.treeSel = { type: "projpos", pos: pos.id };
      app.ui.activeSheetId = "project-consumables";
      renderAll();
      addTableJournal("update_project_position", `${pos.id}: ${changed.join(", ")}`);
      addChangesJournal("project.position.update", pos.id);
      return { ok: true, changed, position: { id: pos.id, name: pos.name } };
    }

    if (name === "delete_project_position") {
      const posId = String(args?.position_id || "");
      const exists = app.state.projectConsumables.some((p) => p.id === posId);
      if (!exists) {
        addTableJournal("delete_project_position", "Ошибка: позиция не найдена");
        return { ok: false, error: "position not found" };
      }
      deletePosition("project", "project", posId);
      addTableJournal("delete_project_position", `Удалена позиция ${posId}`);
      return { ok: true, deleted: { position_id: posId } };
    }

    if (name === "toggle_project_consumables") {
      app.state.hasProjectConsumables = Boolean(args?.enabled);
      if (app.state.hasProjectConsumables && !app.state.projectConsumables.length) {
        app.state.projectConsumables = [makePosition()];
      }
      app.ui.treeSel = { type: "projlist" };
      if (app.state.hasProjectConsumables) app.ui.activeSheetId = "project-consumables";
      renderAll();
      addTableJournal("toggle_project_consumables", app.state.hasProjectConsumables ? "Включено" : "Выключено");
      addChangesJournal("project.consumables", app.state.hasProjectConsumables ? "включены" : "выключены");
      return { ok: true, enabled: app.state.hasProjectConsumables };
    }

    return undefined;
  }

  return { tryExecute };
}
