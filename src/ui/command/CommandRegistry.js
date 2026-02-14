export class CommandRegistry {
  constructor({ stateStore, context = {} } = {}) {
    this.stateStore = stateStore;
    this.context = context;
    this.commands = new Map();
  }

  register(definition) {
    if (!definition?.id) {
      throw new Error("Command id is required");
    }
    this.commands.set(definition.id, definition);
  }

  registerMany(definitions = []) {
    for (const definition of definitions) {
      this.register(definition);
    }
  }

  list({ query = "", state = this.stateStore?.getState?.() } = {}) {
    const normalized = String(query || "").trim().toLowerCase();
    const output = [];
    for (const command of this.commands.values()) {
      const title = this.resolveTitle(command);
      const matches = !normalized
        || title.toLowerCase().includes(normalized)
        || command.id.toLowerCase().includes(normalized)
        || String(command.hotkey || "").toLowerCase().includes(normalized);
      if (!matches) {
        continue;
      }
      const enabled = this.isEnabled(command, state);
      output.push({ ...command, title, enabled });
    }
    return output;
  }

  async execute(id, runtimeContext = {}) {
    const command = this.commands.get(id);
    if (!command) {
      return false;
    }
    const state = this.stateStore?.getState?.();
    if (!this.isEnabled(command, state)) {
      return false;
    }
    await command.run?.({ ...this.context, ...runtimeContext, state });
    return true;
  }

  getByHotkey(hotkey) {
    const normalized = String(hotkey || "").toLowerCase();
    for (const command of this.commands.values()) {
      if (String(command.hotkey || "").toLowerCase() === normalized) {
        return command;
      }
    }
    return null;
  }

  isEnabled(command, state) {
    if (typeof command.whenEnabled !== "function") {
      return true;
    }
    return Boolean(command.whenEnabled(state || {}));
  }

  resolveTitle(command) {
    if (this.context.i18n && command.titleKey) {
      return this.context.i18n.t(command.titleKey);
    }
    return command.id;
  }
}
