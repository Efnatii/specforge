import { AgentRuntimeJsonTransportModule } from "./json.js";
import { AgentRuntimeStreamTransportModule } from "./stream.js";

export class AgentRuntimeTransportModule {
  constructor(ctx) {
    Object.assign(this, createAgentRuntimeTransportInternal(ctx));
  }
}

function createAgentRuntimeTransportInternal(ctx) {
  const { app, deps } = ctx || {};
  if (!app) throw new Error("AgentRuntimeTransportModule requires app");
  if (!deps) throw new Error("AgentRuntimeTransportModule requires deps");

  const {
    addExternalJournal,
    compactForTool,
    disconnectOpenAi,
    uid,
    num,
    fetchFn,
    parseSseEvent,
  } = deps;

  if (typeof addExternalJournal !== "function") throw new Error("AgentRuntimeTransportModule requires deps.addExternalJournal()");

  const jsonTransport = new AgentRuntimeJsonTransportModule({
    app,
    deps: {
      addExternalJournal,
      disconnectOpenAi,
      uid,
      fetchFn,
    },
  });

  const streamTransport = new AgentRuntimeStreamTransportModule({
    app,
    deps: {
      addExternalJournal,
      compactForTool,
      disconnectOpenAi,
      uid,
      num,
      fetchFn,
      parseSseEvent,
    },
  });

  async function callOpenAiResponses(payload, options = {}) {
    const preferStream = app.ai.streaming !== false;
    if (!preferStream) return jsonTransport.callOpenAiResponsesJson(payload, options);

    try {
      return await streamTransport.callOpenAiResponsesStream(payload, options);
    } catch (err) {
      if (err?.no_fallback) throw err;
      addExternalJournal("openai.stream.fallback", String(err?.message || err), {
        level: "warning",
        status: "error",
        turn_id: options?.turnId || app.ai.turnId || "",
        meta: { reason: String(err?.message || err || "stream failed") },
      });
      return jsonTransport.callOpenAiResponsesJson(payload, options);
    }
  }

  return {
    callOpenAiResponses,
    callOpenAiResponsesJson: jsonTransport.callOpenAiResponsesJson,
    callOpenAiResponsesStream: streamTransport.callOpenAiResponsesStream,
  };
}
