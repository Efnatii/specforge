export class EditTransaction {
  constructor({ title, stateDriver, undoStack, userAction = "edit", onCommitted = null, onRolledBack = null }) {
    this.title = title;
    this.stateDriver = stateDriver;
    this.undoStack = undoStack;
    this.userAction = userAction;
    this.onCommitted = onCommitted;
    this.onRolledBack = onRolledBack;
    this.commands = [];
    this.active = true;

    this.undoStack.beginBatch(title);
  }

  add(command) {
    if (!this.active) {
      throw new Error("Transaction already closed");
    }

    this.commands.push(command);
    this.undoStack.push(command);
  }

  commit({ auditEntry = null } = {}) {
    if (!this.active) {
      return { applied: 0 };
    }

    this.active = false;
    this.undoStack.commitBatch();

    if (this.commands.length > 0) {
      this.stateDriver.applyCommands(this.commands, "next", this.userAction, { auditEntry });
      this.onCommitted?.(this.commands);
    }

    return { applied: this.commands.length };
  }

  rollback() {
    if (!this.active) {
      return;
    }

    this.active = false;
    this.undoStack.rollbackBatch();
    this.onRolledBack?.();
  }
}
