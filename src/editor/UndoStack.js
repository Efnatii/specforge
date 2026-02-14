export class UndoStack {
  constructor(limit = 200) {
    this.limit = limit;
    this.undoItems = [];
    this.redoItems = [];
    this.batch = null;
  }

  beginBatch(title = "Batch") {
    if (this.batch) {
      throw new Error("Undo batch already opened");
    }

    this.batch = { kind: "batch", title, commands: [], ts: Date.now() };
  }

  push(command) {
    if (this.batch) {
      this.batch.commands.push(command);
      return;
    }

    this.pushItem(command);
  }

  commitBatch() {
    if (!this.batch) {
      return;
    }

    const item = this.batch;
    this.batch = null;
    if (!item.commands.length) {
      return;
    }

    this.pushItem(item);
  }

  rollbackBatch() {
    this.batch = null;
  }

  undo() {
    if (this.undoItems.length === 0) {
      return null;
    }

    const item = this.undoItems.pop();
    this.redoItems.push(item);
    return item;
  }

  redo() {
    if (this.redoItems.length === 0) {
      return null;
    }

    const item = this.redoItems.pop();
    this.undoItems.push(item);
    return item;
  }

  clear() {
    this.undoItems = [];
    this.redoItems = [];
    this.batch = null;
  }

  pushItem(item) {
    this.undoItems.push(item);
    if (this.undoItems.length > this.limit) {
      this.undoItems.shift();
    }
    this.redoItems = [];
  }
}
