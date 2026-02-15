import { AgentAssemblyQueryToolsModule } from "./query.js";
import { AgentAssemblyMutationToolsModule } from "./mutation.js";

export class AgentAssemblyToolsModule {
  constructor(ctx) {
    this._facade = createAgentAssemblyToolsInternal(ctx);
    this.tryExecute = this.tryExecute.bind(this);
  }

  async tryExecute(name, args, turnCtx = null) {
    return this._facade.tryExecute(name, args, turnCtx);
  }
}

function createAgentAssemblyToolsInternal(ctx) {
  const { app, deps } = ctx || {};
  if (!app) throw new Error("AgentAssemblyToolsModule requires app");
  if (!deps) throw new Error("AgentAssemblyToolsModule requires deps");

  const {
    addTableJournal,
    addChangesJournal,
    renderAll,
    activeSheet,
    makePosition,
    makeAssembly,
    deriveAbbr,
    keepAbbr,
    nextCopyAssemblyName,
    uid,
    num,
    resolveAgentAssembly,
    normalizeAgentPositionList,
    compactForTool,
  } = deps;

  if (typeof addTableJournal !== "function") throw new Error("AgentAssemblyToolsModule requires addTableJournal()");
  if (typeof addChangesJournal !== "function") throw new Error("AgentAssemblyToolsModule requires addChangesJournal()");
  if (typeof renderAll !== "function") throw new Error("AgentAssemblyToolsModule requires renderAll()");
  if (typeof activeSheet !== "function") throw new Error("AgentAssemblyToolsModule requires activeSheet()");
  if (typeof makePosition !== "function") throw new Error("AgentAssemblyToolsModule requires makePosition()");
  if (typeof makeAssembly !== "function") throw new Error("AgentAssemblyToolsModule requires makeAssembly()");
  if (typeof deriveAbbr !== "function") throw new Error("AgentAssemblyToolsModule requires deriveAbbr()");
  if (typeof keepAbbr !== "function") throw new Error("AgentAssemblyToolsModule requires keepAbbr()");
  if (typeof nextCopyAssemblyName !== "function") throw new Error("AgentAssemblyToolsModule requires nextCopyAssemblyName()");
  if (typeof uid !== "function") throw new Error("AgentAssemblyToolsModule requires uid()");
  if (typeof num !== "function") throw new Error("AgentAssemblyToolsModule requires num()");
  if (typeof resolveAgentAssembly !== "function") throw new Error("AgentAssemblyToolsModule requires resolveAgentAssembly()");
  if (typeof normalizeAgentPositionList !== "function") throw new Error("AgentAssemblyToolsModule requires normalizeAgentPositionList()");
  if (typeof compactForTool !== "function") throw new Error("AgentAssemblyToolsModule requires compactForTool()");

  const queryTools = new AgentAssemblyQueryToolsModule({
    app,
    deps: {
      addTableJournal,
      activeSheet,
      num,
      resolveAgentAssembly,
      normalizeAgentPositionList,
      compactForTool,
    },
  });

  const mutationTools = new AgentAssemblyMutationToolsModule({
    app,
    deps: {
      addTableJournal,
      addChangesJournal,
      renderAll,
      makePosition,
      makeAssembly,
      deriveAbbr,
      keepAbbr,
      nextCopyAssemblyName,
      uid,
      num,
      resolveAgentAssembly,
    },
  });

  async function tryExecute(name, args, turnCtx = null) {
    const queryResult = await queryTools.tryExecute(name, args, turnCtx);
    if (queryResult !== undefined) return queryResult;
    return mutationTools.tryExecute(name, args, turnCtx);
  }

  return { tryExecute };
}
