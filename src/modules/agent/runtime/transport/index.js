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

  function payloadHasReasoning(payload) {
    return Boolean(payload?.reasoning && typeof payload.reasoning === "object");
  }

  function payloadHasReasoningSummary(payload) {
    if (!payloadHasReasoning(payload)) return false;
    return Object.prototype.hasOwnProperty.call(payload.reasoning, "summary");
  }

  function payloadHasTextVerbosity(payload) {
    const verbosity = String(payload?.text?.verbosity || "").trim();
    return Boolean(verbosity);
  }

  function payloadHasServiceTier(payload) {
    const tier = String(payload?.service_tier || "").trim().toLowerCase();
    return tier === "default" || tier === "flex" || tier === "priority";
  }

  function withoutReasoning(payload) {
    if (!payloadHasReasoning(payload)) return payload;
    const next = { ...payload };
    delete next.reasoning;
    return next;
  }

  function withoutReasoningSummary(payload) {
    if (!payloadHasReasoningSummary(payload)) return payload;
    const reasoning = { ...payload.reasoning };
    delete reasoning.summary;
    const next = { ...payload };
    if (Object.keys(reasoning).length) next.reasoning = reasoning;
    else delete next.reasoning;
    return next;
  }

  function withoutTextVerbosity(payload) {
    if (!payloadHasTextVerbosity(payload)) return payload;
    const text = payload?.text && typeof payload.text === "object" ? { ...payload.text } : null;
    if (text) delete text.verbosity;
    const next = { ...payload };
    if (text && Object.keys(text).length) next.text = text;
    else delete next.text;
    return next;
  }

  function withDefaultServiceTier(payload) {
    if (!payloadHasServiceTier(payload)) return payload;
    const current = String(payload?.service_tier || "").trim().toLowerCase();
    if (current === "default") {
      const next = { ...payload };
      delete next.service_tier;
      return next;
    }
    return { ...payload, service_tier: "default" };
  }

  function withLowerReasoningEffort(payload) {
    if (!payloadHasReasoning(payload)) return null;
    const reasoning = payload.reasoning && typeof payload.reasoning === "object" ? { ...payload.reasoning } : null;
    if (!reasoning) return null;
    const effort = String(reasoning.effort || "").trim().toLowerCase();
    let lowered = "";
    if (effort === "xhigh") lowered = "high";
    else if (effort === "high") lowered = "medium";
    else if (effort === "medium") lowered = "low";
    else if (effort === "minimal" || effort === "none") lowered = "low";
    if (!lowered || lowered === effort) return null;
    reasoning.effort = lowered;
    return { ...payload, reasoning };
  }

  function isUnsupportedText(text) {
    if (!text) return false;
    return text.includes("unsupported")
      || text.includes("not supported")
      || text.includes("unknown")
      || text.includes("invalid")
      || text.includes("not allowed")
      || text.includes("not available");
  }

  function isReasoningSummaryUnsupportedError(err) {
    const text = String(err?.message || "").toLowerCase();
    if (!text || !isUnsupportedText(text)) return false;
    if (text.includes("reasoning.summary")) return true;
    return text.includes("reasoning") && text.includes("summary");
  }

  function isReasoningEffortUnsupportedError(err) {
    const text = String(err?.message || "").toLowerCase();
    if (!text || !isUnsupportedText(text)) return false;
    if (text.includes("reasoning.effort")) return true;
    return text.includes("reasoning") && text.includes("effort");
  }

  function isReasoningUnsupportedError(err) {
    const text = String(err?.message || "").toLowerCase();
    if (!text || !isUnsupportedText(text)) return false;
    if (!text.includes("reasoning")) return false;
    if (text.includes("reasoning.summary")) return false;
    if (text.includes("reasoning.effort")) return false;
    return true;
  }

  function isTextVerbosityUnsupportedError(err) {
    const text = String(err?.message || "").toLowerCase();
    if (!text || !isUnsupportedText(text)) return false;
    if (text.includes("text.verbosity")) return true;
    return text.includes("text") && text.includes("verbosity");
  }

  function isServiceTierUnsupportedError(err) {
    const text = String(err?.message || "").toLowerCase();
    if (!text || !isUnsupportedText(text)) return false;
    if (text.includes("service_tier")) return true;
    return text.includes("service tier");
  }

  function payloadDigest(payload) {
    try {
      return JSON.stringify(payload);
    } catch {
      return "";
    }
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
    let currentPayload = payload;
    for (let retry = 0; retry < 8; retry += 1) {
      try {
        return await callWithPreferredTransport(currentPayload, options);
      } catch (err) {
        if (!err?.no_fallback) throw err;

        let nextPayload = null;
        let fallbackEvent = "openai.param.fallback";
        let fallbackMessage = "";

        if (payloadHasServiceTier(currentPayload) && isServiceTierUnsupportedError(err)) {
          nextPayload = withDefaultServiceTier(currentPayload);
          fallbackMessage = "service_tier reset to default";
        } else if (payloadHasReasoningSummary(currentPayload) && isReasoningSummaryUnsupportedError(err)) {
          nextPayload = withoutReasoningSummary(currentPayload);
          fallbackMessage = "reasoning.summary disabled for this model";
        } else if (payloadHasTextVerbosity(currentPayload) && isTextVerbosityUnsupportedError(err)) {
          nextPayload = withoutTextVerbosity(currentPayload);
          fallbackMessage = "text.verbosity disabled for this model";
        } else if (payloadHasReasoning(currentPayload) && isReasoningEffortUnsupportedError(err)) {
          nextPayload = withLowerReasoningEffort(currentPayload) || withoutReasoning(currentPayload);
          fallbackMessage = nextPayload?.reasoning
            ? `reasoning.effort lowered to ${String(nextPayload.reasoning.effort || "")}`
            : "reasoning disabled for this model";
        } else if (payloadHasReasoning(currentPayload) && isReasoningUnsupportedError(err)) {
          nextPayload = withoutReasoning(currentPayload);
          fallbackMessage = "reasoning disabled for this model";
        } else if (payloadHasComputerUseTool(currentPayload) && isComputerUseUnsupportedError(err)) {
          nextPayload = withoutComputerUseTool(currentPayload);
          fallbackEvent = "openai.tool.fallback";
          fallbackMessage = "computer_use_preview disabled for this model";
        } else {
          throw err;
        }

        if (!nextPayload || payloadDigest(nextPayload) === payloadDigest(currentPayload)) throw err;

        addExternalJournal(fallbackEvent, fallbackMessage, {
          level: "warning",
          status: "error",
          turn_id: options?.turnId || app.ai.turnId || "",
          meta: { reason: String(err?.message || err || "unsupported parameter") },
        });

        currentPayload = nextPayload;
      }
    }
    throw new Error("openai fallback retry limit reached");
  }

  return {
    callOpenAiResponses,
    callOpenAiResponsesJson: jsonTransport.callOpenAiResponsesJson,
    callOpenAiResponsesStream: streamTransport.callOpenAiResponsesStream,
  };
}
