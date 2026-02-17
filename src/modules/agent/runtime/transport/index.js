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

  function payloadHasComputerUseTool(payload) {
    const tools = Array.isArray(payload?.tools) ? payload.tools : [];
    return tools.some((tool) => String(tool?.type || "") === "computer_use_preview");
  }

  function withoutComputerUseTool(payload) {
    const tools = Array.isArray(payload?.tools) ? payload.tools : [];
    return {
      ...payload,
      tools: tools.filter((tool) => String(tool?.type || "") !== "computer_use_preview"),
    };
  }

  function isComputerUseUnsupportedError(err) {
    const text = String(err?.message || "").toLowerCase();
    if (!text) return false;
    if (!text.includes("computer_use_preview") && !text.includes("computer_use")) return false;
    if (text.includes("unknown") || text.includes("unsupported") || text.includes("not supported")) return true;
    if (text.includes("invalid") || text.includes("not allowed")) return true;
    return false;
  }

  async function callWithPreferredTransport(payload, options = {}) {
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

  async function callOpenAiResponses(payload, options = {}) {
    try {
      return await callWithPreferredTransport(payload, options);
    } catch (err) {
      if (!err?.no_fallback || !payloadHasComputerUseTool(payload) || !isComputerUseUnsupportedError(err)) {
        throw err;
      }
      addExternalJournal("openai.tool.fallback", "computer_use_preview disabled for this model", {
        level: "warning",
        status: "error",
        turn_id: options?.turnId || app.ai.turnId || "",
        meta: { reason: String(err?.message || err || "unsupported computer_use_preview") },
      });
      return callWithPreferredTransport(withoutComputerUseTool(payload), options);
    }
  }

  return {
    callOpenAiResponses,
    callOpenAiResponsesJson: jsonTransport.callOpenAiResponsesJson,
    callOpenAiResponsesStream: streamTransport.callOpenAiResponsesStream,
  };
}
