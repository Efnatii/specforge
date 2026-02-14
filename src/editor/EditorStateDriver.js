const EDITS_KEY = "workbookEdits";

export class EditorStateDriver {
  constructor({ stateStore, idbStore, getWorkbook, auditLog }) {
    this.stateStore = stateStore;
    this.idbStore = idbStore;
    this.getWorkbook = getWorkbook;
    this.auditLog = auditLog;
    this.persistTimer = null;
  }

  async restoreEdits() {
    const edits = await this.idbStore.get(EDITS_KEY);
    if (!edits || typeof edits !== "object") {
      return;
    }

    this.updateState((draft) => {
      draft.edits = edits;
    });
  }

  async clearPersistedEdits() {
    if (this.persistTimer) {
      clearTimeout(this.persistTimer);
      this.persistTimer = null;
    }

    await this.idbStore.delete(EDITS_KEY);
  }

  clearHistory() {
    this.auditLog.clear();
    this.updateState((draft) => {
      draft.audit.recent = [];
      draft.editor.lastError = null;
      draft.editor.editMode = false;
      draft.editor.errors = {};
    });
  }

  setSelection(sheetId, addressA1) {
    this.setSelectionRange({
      sheetId,
      anchorAddressA1: addressA1,
      focusAddressA1: addressA1,
      range: null,
      mode: "cell"
    });
  }

  setSelectionRange({ sheetId, anchorAddressA1, focusAddressA1, range, mode = "cell" }) {
    this.updateState((draft) => {
      draft.editor.selection = {
        sheetId,
        addressA1: focusAddressA1,
        anchorAddressA1,
        focusAddressA1,
        range,
        mode
      };
      draft.editor.lastError = null;
    });
  }

  setEditMode(editMode) {
    this.updateState((draft) => {
      draft.editor.editMode = editMode;
    });
  }

  setError(sheetId, addressA1, message) {
    this.updateState((draft) => {
      draft.editor.lastError = message ? { addressA1, message } : null;
      if (!draft.editor.errors) {
        draft.editor.errors = {};
      }
      if (!draft.editor.errors[sheetId]) {
        draft.editor.errors[sheetId] = {};
      }
      if (message) {
        draft.editor.errors[sheetId][addressA1] = message;
      } else {
        delete draft.editor.errors[sheetId][addressA1];
      }
    });
  }

  applyCommand(command, direction, userAction) {
    return this.applyCommands([command], direction, userAction);
  }

  applyCommands(commands, direction, userAction, { auditEntry = null } = {}) {
    if (!Array.isArray(commands) || commands.length === 0) {
      return;
    }

    this.updateState((draft) => {
      for (const command of commands) {
        const sheetEdits = { ...(draft.edits[command.sheetId] || {}) };
        const value = direction === "next" ? command.nextValue : command.prevValue;
        const type = direction === "next" ? command.nextType : command.prevType;
        const baseline = this.getBaselineValue(command.sheetId, command.addressA1);

        if (this.valuesEqual(value, baseline)) {
          delete sheetEdits[command.addressA1];
        } else {
          sheetEdits[command.addressA1] = { value, type, updatedAtTs: Date.now() };
        }

        draft.edits[command.sheetId] = sheetEdits;
        if (draft.editor.errors?.[command.sheetId]) {
          delete draft.editor.errors[command.sheetId][command.addressA1];
        }
      }

      draft.editor.editMode = false;
      draft.editor.lastError = null;

      if (auditEntry) {
        this.auditLog.add(auditEntry);
      } else if (commands.length === 1) {
        const command = commands[0];
        this.auditLog.add({
          ts: Date.now(),
          userAction,
          sheetName: command.sheetName,
          addressA1: command.addressA1,
          before: direction === "next" ? command.prevValue : command.nextValue,
          after: direction === "next" ? command.nextValue : command.prevValue
        });
      } else {
        const first = commands[0];
        this.auditLog.add({
          ts: Date.now(),
          userAction,
          sheetName: first.sheetName,
          addressA1: first.addressA1,
          before: `${commands.length} cells`,
          after: `${direction === "next" ? "applied" : "reverted"}`
        });
      }

      draft.audit.recent = this.auditLog.getRecent(50);
    });

    this.schedulePersist();
  }

  schedulePersist() {
    if (this.persistTimer) {
      clearTimeout(this.persistTimer);
    }

    this.persistTimer = setTimeout(async () => {
      const edits = this.stateStore.getState().edits;
      await this.idbStore.set(EDITS_KEY, edits);
    }, 400);
  }

  getBaselineValue(sheetId, addressA1) {
    const workbook = this.getWorkbook();
    const sheet = workbook?.sheets?.find((item) => item.id === sheetId);

    for (const row of sheet?.rows || []) {
      for (const cell of row.cells || []) {
        if (cell.address === addressA1) {
          return cell.value ?? null;
        }
      }
    }

    return null;
  }

  valuesEqual(a, b) {
    if (a === b) {
      return true;
    }
    return Number.isNaN(a) && Number.isNaN(b);
  }

  updateState(mutator) {
    const draft = this.stateStore.getState();
    mutator(draft);
    this.stateStore.replace(draft);
  }
}
