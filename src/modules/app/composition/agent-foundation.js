import { AgentAttachmentModule } from "../../agent/tools/attachment.js";
import { MarketVerificationModule } from "../../agent/tools/market-verification.js";
import { AgentGridModule } from "../../agent/tools/grid.js";
import { AgentStateAccessModule } from "../../agent/tools/state-access.js";

export class AppAgentFoundationCompositionModule {
  constructor({
    config,
    dom,
    windowRef,
  }) {
    if (!config) throw new Error("AppAgentFoundationCompositionModule requires config");
    if (!dom) throw new Error("AppAgentFoundationCompositionModule requires dom");
    if (!windowRef) throw new Error("AppAgentFoundationCompositionModule requires windowRef");
    this._config = config;
    this._dom = dom;
    this._window = windowRef;
  }

  compose({ core, journal }) {
    if (!core) throw new Error("AppAgentFoundationCompositionModule.compose requires core");
    if (!journal) throw new Error("AppAgentFoundationCompositionModule.compose requires journal");

    const {
      app,
      appIdentityModule,
      projectMutationModule,
      templateModule,
      toastModule,
    } = core;

    const {
      addChangesJournal,
      saveAiOptions,
      renderAiUi,
      addTableJournal,
    } = journal;

    const {
      marketVerificationMinSources,
      marketVerificationMaxSources,
      positionMarketFields,
    } = this._config;

    const agentAttachmentModule = new AgentAttachmentModule({
      app,
      dom: this._dom,
      addChangesJournal,
      saveAiOptions,
      renderAiUi,
      toast: (text) => toastModule.show(text),
      createId: () => appIdentityModule.createId(),
      num: (value, fallback = 0) => projectMutationModule.num(value, fallback),
    });

    const marketVerificationModule = new MarketVerificationModule({
      config: {
        minSources: marketVerificationMinSources,
        maxSources: marketVerificationMaxSources,
        marketFields: positionMarketFields,
      },
      deps: {
        getMinSources: () => Number(app?.ai?.options?.factCheckMinSources || marketVerificationMinSources || 2),
        getAttachments: () => app.ai.attachments,
        isWebSearchEnabled: () => Boolean(app.ai.options.webSearch),
        normalizeHttpUrl: (raw) => {
          const txt = String(raw || "").trim();
          if (!txt) return "";
          try {
            const url = new URL(txt);
            if (url.protocol !== "http:" && url.protocol !== "https:") return "";
            return url.toString();
          } catch {
            return "";
          }
        },
        addTableJournal,
      },
    });

    const agentGridModule = new AgentGridModule({
      num: (value, fallback = 0) => projectMutationModule.num(value, fallback),
      decodeAddr: (...args) => templateModule.decodeAddr(...args),
    });

    const agentStateAccessModule = new AgentStateAccessModule({
      getState: () => app.state,
      getWorkbook: () => app.workbook,
      getSheetOverrides: () => app.ai.sheetOverrides,
      setSheetOverrides: (next) => {
        app.ai.sheetOverrides = next && typeof next === "object" ? next : {};
      },
    });

    return {
      agentAttachmentModule,
      marketVerificationModule,
      agentGridModule,
      agentStateAccessModule,
      colToName: (...args) => agentGridModule.colToName(...args),
      toA1: (...args) => agentGridModule.toA1(...args),
      agentCellValueText: (...args) => agentGridModule.agentCellValueText(...args),
      compactForTool: (...args) => agentGridModule.compactForTool(...args),
      applyAgentSheetOverrides: (...args) => agentStateAccessModule.applyAgentSheetOverrides(...args),
    };
  }
}
