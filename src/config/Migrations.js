export class Migrations {
  static migrateSchema(input) {
    const current = input && typeof input === "object" ? structuredClone(input) : {};
    const version = Number(current.schemaVersion || current.version || 1);
    if (version === 1) {
      return { ...current, schemaVersion: 1 };
    }
    throw new Error(`Unsupported schema version: ${version}`);
  }

  static migrateBindings(input) {
    const current = input && typeof input === "object" ? structuredClone(input) : {};
    const version = Number(current.version || 1);
    if (version === 1) {
      return { ...current, version: 1 };
    }
    throw new Error(`Unsupported bindings version: ${version}`);
  }
}
