export class ProjectFileJsonModule {
  buildExportPayload({ state, sheetOverrides, developer, exportedAt = new Date().toISOString() }) {
    return {
      format: "specforge-kp/v1",
      developer: String(developer || ""),
      exportedAt,
      state,
      agent: {
        sheetOverrides: sheetOverrides || {},
      },
    };
  }

  parseImportedJsonText(text) {
    const parsed = JSON.parse(text);
    const stateRaw = parsed.state || parsed;
    const sheetOverridesRaw = parsed.agent?.sheetOverrides || stateRaw.agent?.sheetOverrides || {};
    return { stateRaw, sheetOverridesRaw };
  }

  buildExportName(settings) {
    const order = this._safeToken(settings?.orderNumber || "kp");
    const req = this._safeToken(settings?.requestNumber || "request");
    return `kp_${order}_${req}`;
  }

  _safeToken(value) {
    return String(value)
      .replace(/[\\/:*?"<>|\s]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40) || "x";
  }
}
