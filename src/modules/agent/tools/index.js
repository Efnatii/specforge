import { AgentSheetToolsModule } from "./sheet.js";
import { AgentStateToolsModule } from "./state.js";
import { AgentEntityToolsModule } from "./entity.js";

export class AgentToolsModule {
  constructor(ctx) {
    const { app, deps } = ctx || {};
    if (!app) throw new Error("AgentToolsModule requires app");
    if (!deps) throw new Error("AgentToolsModule requires deps");

    const {
      marketVerificationModule,
      gridApi,
      stateAccessApi,
      addTableJournal,
      addChangesJournal,
      renderAll,
      renderTabs,
      renderSheet,
      activeSheet,
      selectionText,
      assemblyById,
      deletePosition,
      makePosition,
      makeAssembly,
      deriveAbbr,
      keepAbbr,
      normalizePercentDecimal,
      nextCopyAssemblyName,
      uid,
      num,
    } = deps;

    const sheetTools = new AgentSheetToolsModule({
      app,
      deps: {
        marketVerificationModule,
        gridApi,
        stateAccessApi,
        addTableJournal,
        addChangesJournal,
        renderAll,
        renderTabs,
        renderSheet,
        activeSheet,
        selectionText,
      },
    });

    const stateTools = new AgentStateToolsModule({
      app,
      deps: {
        marketVerificationModule,
        gridApi,
        stateAccessApi,
        addTableJournal,
        addChangesJournal,
        renderAll,
        num,
        normalizePercentDecimal,
      },
    });

    const entityTools = new AgentEntityToolsModule({
      app,
      deps: {
        marketVerificationModule,
        gridApi,
        addTableJournal,
        addChangesJournal,
        renderAll,
        activeSheet,
        assemblyById,
        deletePosition,
        makePosition,
        makeAssembly,
        deriveAbbr,
        keepAbbr,
        nextCopyAssemblyName,
        uid,
        num,
      },
    });

    this._moduleFacades = [sheetTools, stateTools, entityTools];
    this.executeAgentTool = this.executeAgentTool.bind(this);
  }

  async executeAgentTool(name, args, turnCtx = null) {
    for (const moduleFacade of this._moduleFacades) {
      const result = await moduleFacade.tryExecute(name, args, turnCtx);
      if (result !== undefined) return result;
    }
    return { ok: false, error: `unknown tool: ${name}` };
  }
}
