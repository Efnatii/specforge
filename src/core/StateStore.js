const STATE_CHANGED = "STATE_CHANGED";

export class StateStore {
  constructor(eventBus, initialState) {
    this.eventBus = eventBus;
    this.state = structuredClone(initialState);
  }

  getState() {
    return structuredClone(this.state);
  }

  replace(nextState) {
    this.state = structuredClone(nextState);
    this.eventBus.emit(STATE_CHANGED, this.getState());
    return this.getState();
  }

  update(patch) {
    const nextState = StateStore.mergeDeep(this.state, patch);
    this.state = nextState;
    this.eventBus.emit(STATE_CHANGED, this.getState());
    return this.getState();
  }

  static mergeDeep(target, source) {
    if (!StateStore.isPlainObject(target) || !StateStore.isPlainObject(source)) {
      return structuredClone(source);
    }

    const result = { ...target };

    for (const [key, sourceValue] of Object.entries(source)) {
      const targetValue = result[key];
      if (StateStore.isPlainObject(sourceValue) && StateStore.isPlainObject(targetValue)) {
        result[key] = StateStore.mergeDeep(targetValue, sourceValue);
        continue;
      }

      result[key] = structuredClone(sourceValue);
    }

    return result;
  }

  static isPlainObject(value) {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
  }
}

export { STATE_CHANGED };
