export class ProjectUiActionModule {
  constructor({
    app,
    mutationApi,
    renderAll,
    renderTree,
    renderInspector,
    renderTabs,
    renderSheet,
    addChangesJournal,
    toast,
    openSettingsDialog,
  }) {
    if (!app) throw new Error("ProjectUiActionModule requires app");
    if (!mutationApi) throw new Error("ProjectUiActionModule requires mutationApi");
    if (typeof renderAll !== "function") throw new Error("ProjectUiActionModule requires renderAll()");
    if (typeof renderTree !== "function") throw new Error("ProjectUiActionModule requires renderTree()");
    if (typeof renderInspector !== "function") throw new Error("ProjectUiActionModule requires renderInspector()");
    if (typeof renderTabs !== "function") throw new Error("ProjectUiActionModule requires renderTabs()");
    if (typeof renderSheet !== "function") throw new Error("ProjectUiActionModule requires renderSheet()");
    if (typeof addChangesJournal !== "function") throw new Error("ProjectUiActionModule requires addChangesJournal()");
    if (typeof toast !== "function") throw new Error("ProjectUiActionModule requires toast()");
    if (typeof openSettingsDialog !== "function") throw new Error("ProjectUiActionModule requires openSettingsDialog()");

    this._app = app;
    this._mutationApi = mutationApi;
    this._renderAll = renderAll;
    this._renderTree = renderTree;
    this._renderInspector = renderInspector;
    this._renderTabs = renderTabs;
    this._renderSheet = renderSheet;
    this._addChangesJournal = addChangesJournal;
    this._toast = toast;
    this._openSettingsDialog = openSettingsDialog;
  }

  assemblyById(id) {
    return this._mutationApi.findAssemblyById(this._app.state, id);
  }

  getPositionRef(assemblyId, list, posId) {
    return this._mutationApi.getPositionRef(this._app.state, { assemblyId, list, posId });
  }

  onTreeClick(e) {
    const actionBtn = e.target.closest("[data-tree-action]");
    if (actionBtn) {
      e.preventDefault();
      e.stopPropagation();
      const action = String(actionBtn.dataset.treeAction || "");
      if (action === "open-settings") this._openSettingsDialog();
      else if (action === "dup-assembly") this.duplicateAssembly(actionBtn.dataset.id);
      else if (action === "del-assembly") this.deleteAssembly(actionBtn.dataset.id);
      else if (action === "add-pos") this.addPosition(actionBtn.dataset.id, actionBtn.dataset.list);
      else if (action === "del-pos") this.deletePosition(actionBtn.dataset.id, actionBtn.dataset.list, actionBtn.dataset.pos);
      else if (action === "dup-pos") this.duplicatePosition(actionBtn.dataset.id, actionBtn.dataset.list, actionBtn.dataset.pos);
      else if (action === "toggle-proj") this.toggleProjectConsumables();
      else if (action === "add-proj-pos") this.addProjectPosition();
      return;
    }

    const n = e.target.closest("[data-node]");
    if (!n) return;
    const t = n.dataset.node;

    if (t === "settings") {
      this._app.ui.treeSel = { type: "settings" };
    } else if (t === "assembly") {
      this._app.ui.treeSel = { type: "assembly", id: n.dataset.id };
      this._app.ui.activeSheetId = `assembly:${n.dataset.id}:main`;
    } else if (t === "list") {
      const list = n.dataset.list;
      this._app.ui.treeSel = { type: "list", id: n.dataset.id, list };
      this._app.ui.activeSheetId = list === "cons" ? `assembly:${n.dataset.id}:cons` : `assembly:${n.dataset.id}:main`;
    } else if (t === "pos") {
      const list = n.dataset.list;
      this._app.ui.treeSel = { type: "pos", id: n.dataset.id, list, pos: n.dataset.pos };
      this._app.ui.activeSheetId = list === "cons" ? `assembly:${n.dataset.id}:cons` : `assembly:${n.dataset.id}:main`;
    } else if (t === "projlist") {
      this._app.ui.treeSel = { type: "projlist" };
      if (this._app.state.hasProjectConsumables) this._app.ui.activeSheetId = "project-consumables";
    } else if (t === "projpos") {
      this._app.ui.treeSel = { type: "projpos", pos: n.dataset.pos };
      if (this._app.state.hasProjectConsumables) this._app.ui.activeSheetId = "project-consumables";
    }

    this._renderTree();
    this._renderInspector();
    this._renderTabs();
    this._renderSheet();
  }

  onInspectorClick(e) {
    const a = e.target.closest("[data-action]");
    if (!a) return;
    const action = a.dataset.action;

    if (action === "open-settings") {
      this._openSettingsDialog();
      return;
    }

    if (action === "del-assembly") {
      this.deleteAssembly(a.dataset.id);
      return;
    }

    if (action === "add-pos") {
      this.addPosition(a.dataset.id, a.dataset.list);
      return;
    }

    if (action === "del-pos") {
      this.deletePosition(a.dataset.id, a.dataset.list, a.dataset.pos);
      return;
    }

    if (action === "toggle-proj") {
      this.toggleProjectConsumables();
      return;
    }

    if (action === "add-proj-pos") this.addProjectPosition();
  }

  onInspectorChange(e) {
    const t = e.target;
    const role = t.dataset.role;

    if (role === "setting") {
      const f = t.dataset.field;
      const changed = this._mutationApi.applySettingField(this._app.state, { field: f, value: t.value });
      if (!changed.ok) return;
      this._renderAll();
      this._addChangesJournal("settings.update", f);
      return;
    }

    if (role === "assembly") {
      const f = t.dataset.field;
      const changed = this._mutationApi.applyAssemblyField(this._app.state, {
        assemblyId: t.dataset.id,
        field: f,
        value: t.value,
        checked: t.checked,
      });
      if (!changed.ok) return;
      this._renderAll();
      this._addChangesJournal("assembly.update", `${changed.assemblyId}.${f}`);
      return;
    }

    if (role === "labor") {
      const changed = this._mutationApi.applyLaborField(this._app.state, {
        assemblyId: t.dataset.id,
        field: t.dataset.field,
        value: t.value,
      });
      if (!changed.ok) return;
      this._renderAll();
      this._addChangesJournal("labor.update", `${changed.assemblyId}.${changed.field}`);
      return;
    }

    if (role === "pos" || role === "project-pos") {
      const changed = this._mutationApi.applyPositionField(this._app.state, {
        assemblyId: t.dataset.id,
        list: t.dataset.list,
        posId: t.dataset.pos,
        field: t.dataset.field,
        value: t.value,
      });
      if (!changed.ok) return;
      this._renderAll();
      this._addChangesJournal("position.update", `${changed.list}.${changed.field}`);
    }
  }

  addPositionBySelection() {
    const result = this._mutationApi.addPositionBySelection(this._app.state, this._app.ui.treeSel);
    if (!result.handled || !result.ok) return false;

    this._app.ui.treeSel = result.treeSel;
    this._renderAll();

    if (result.assemblyId && result.list && result.position?.id) {
      this._addChangesJournal("position.add", `${result.assemblyId}.${result.list}.${result.position.id}`);
      this._toast("Позиция добавлена");
    }

    return true;
  }

  addAssembly() {
    const assembly = this._mutationApi.createAssembly(this._app.state.assemblies.length + 1);
    this._app.state.assemblies.push(assembly);
    this._app.ui.treeSel = { type: "assembly", id: assembly.id };
    this._app.ui.activeSheetId = `assembly:${assembly.id}:main`;
    this._renderAll();
    this._addChangesJournal("assembly.add", assembly.fullName || assembly.id);
    this._toast("Сборка добавлена");
  }

  addPosition(assemblyId, list) {
    const result = this._mutationApi.addPosition(this._app.state, { assemblyId, list });
    if (!result.ok) return;
    this._app.ui.treeSel = result.treeSel;
    this._renderAll();
    this._addChangesJournal("position.add", `${assemblyId}.${list}.${result.position.id}`);
    this._toast("Позиция добавлена");
  }

  addProjectPosition() {
    const result = this._mutationApi.addProjectPosition(this._app.state);
    if (!result.ok) return;
    this._app.ui.treeSel = result.treeSel;
    this._renderAll();
    this._addChangesJournal("project.position.add", result.position.id);
    this._toast("Позиция добавлена");
  }

  toggleProjectConsumables() {
    const result = this._mutationApi.toggleProjectConsumables(this._app.state);
    this._app.ui.treeSel = result.treeSel;
    this._renderAll();
    this._addChangesJournal("project.consumables", result.enabled ? "включены" : "выключены");
  }

  deleteAssembly(assemblyId) {
    const result = this._mutationApi.deleteAssembly(this._app.state, {
      assemblyId,
      lastAssemblyId: this._app.ai.lastAssemblyId,
    });
    if (!result.ok) return;

    this._app.ai.lastAssemblyId = result.nextLastAssemblyId;
    this._app.ui.treeSel = result.treeSel;
    this._app.ui.activeSheetId = result.activeSheetId;
    this._renderAll();
    this._addChangesJournal("assembly.delete", result.deleted.fullName || assemblyId || "");
    this._toast("Сборка удалена");
  }

  duplicateAssembly(assemblyId) {
    const result = this._mutationApi.duplicateAssembly(this._app.state, { assemblyId });
    if (!result.ok) return;

    this._app.ai.lastAssemblyId = result.copy.id;
    this._app.ui.treeSel = result.treeSel;
    this._app.ui.activeSheetId = result.activeSheetId;
    this._renderAll();
    this._addChangesJournal("assembly.duplicate", `${result.source.id} -> ${result.copy.id}`);
    this._toast("Сборка продублирована");
  }

  duplicatePosition(assemblyId, list, posId) {
    const result = this._mutationApi.duplicatePosition(this._app.state, { assemblyId, list, posId });
    if (!result.ok) return;

    this._app.ui.treeSel = result.treeSel;
    this._renderAll();
    if (list === "project") {
      this._addChangesJournal("project.position.duplicate", `${result.source.id} -> ${result.copy.id}`);
    } else {
      this._addChangesJournal("position.duplicate", `${assemblyId}.${list}.${result.source.id} -> ${result.copy.id}`);
    }
    this._toast("Позиция продублирована");
  }

  nextCopyAssemblyName(base) {
    return this._mutationApi.nextCopyAssemblyName(this._app.state, base);
  }

  deletePosition(assemblyId, list, posId) {
    const result = this._mutationApi.deletePosition(this._app.state, { assemblyId, list, posId });
    if (!result.ok) return;
    this._app.ui.treeSel = result.treeSel;
    this._renderAll();
    this._addChangesJournal(result.changeKind, result.changeValue);
  }
}
