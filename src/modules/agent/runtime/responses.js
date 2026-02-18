import { AgentRuntimeResponseParseModule } from "./parse.js";
import { AgentRuntimeTransportModule } from "./transport/index.js";
import { AgentRuntimeWebEvidenceModule } from "./evidence.js";

export class AgentRuntimeResponsesModule {
  constructor(ctx) {
    Object.assign(this, createAgentRuntimeResponsesInternal(ctx));
  }
}

function createAgentRuntimeResponsesInternal(ctx) {
  const { app, deps } = ctx || {};
  if (!app) throw new Error("AgentRuntimeResponsesModule requires app");
  if (!deps) throw new Error("AgentRuntimeResponsesModule requires deps");

  const {
    addExternalJournal,
    compactForTool,
    disconnectOpenAi,
    uid,
    num,
    fetchFn,
    parseJsonSafe,
  } = deps;

  const parseFacade = new AgentRuntimeResponseParseModule({
    deps: { parseJsonSafe },
  });

  const transportFacade = new AgentRuntimeTransportModule({
    app,
    deps: {
      addExternalJournal,
      compactForTool,
      disconnectOpenAi,
      uid,
      num,
      fetchFn,
      parseSseEvent: parseFacade.parseSseEvent,
    },
  });

  const webEvidenceFacade = new AgentRuntimeWebEvidenceModule({});

  return {
    callOpenAiResponses: transportFacade.callOpenAiResponses,
    callOpenAiResponsesJson: transportFacade.callOpenAiResponsesJson,
    callOpenAiResponsesStream: transportFacade.callOpenAiResponsesStream,
    cancelOpenAiResponse: transportFacade.cancelOpenAiResponse,
    compactOpenAiResponse: transportFacade.compactOpenAiResponse,
    parseSseEvent: parseFacade.parseSseEvent,
    extractAgentFunctionCalls: parseFacade.extractAgentFunctionCalls,
    extractAgentText: parseFacade.extractAgentText,
    updateAgentTurnWebEvidence: webEvidenceFacade.updateAgentTurnWebEvidence,
    extractWebSearchEvidence: webEvidenceFacade.extractWebSearchEvidence,
    normalizeHttpUrl: webEvidenceFacade.normalizeHttpUrl,
    pushUnique: webEvidenceFacade.pushUnique,
  };
}
