export class AgentRuntimeJsonTransportModule {
  constructor(ctx) {
    Object.assign(this, createAgentRuntimeJsonTransportInternal(ctx));
  }
}

function createAgentRuntimeJsonTransportInternal(ctx) {
  const { app, deps } = ctx || {};
  if (!app) throw new Error("AgentRuntimeJsonTransportModule requires app");
  if (!deps) throw new Error("AgentRuntimeJsonTransportModule requires deps");

  const {
    addExternalJournal,
    disconnectOpenAi,
    uid,
    fetchFn,
  } = deps;

  if (typeof addExternalJournal !== "function") throw new Error("AgentRuntimeJsonTransportModule requires deps.addExternalJournal()");
  if (typeof disconnectOpenAi !== "function") throw new Error("AgentRuntimeJsonTransportModule requires deps.disconnectOpenAi()");
  if (typeof uid !== "function") throw new Error("AgentRuntimeJsonTransportModule requires deps.uid()");

  const fetch = fetchFn || ((...args) => globalThis.fetch(...args));

  async function callOpenAiResponsesJson(payload, options = {}) {
    const startedAt = Date.now();
    const isContinuation = Boolean(payload?.previous_response_id);
    const model = String(payload?.model || app.ai.model || "");
    const toolsCount = Array.isArray(payload?.tools) ? payload.tools.length : 0;
    const reasoningEffort = String(payload?.reasoning?.effort || "medium");
    const reasoningSummary = String(payload?.reasoning?.summary || "");
    const continuationHasTools = isContinuation ? toolsCount > 0 : false;
    const requestId = uid();
    app.ai.currentRequestId = requestId;

    addExternalJournal("request.start", `${isContinuation ? "continue" : "start"} model=${model} tools=${toolsCount} reasoning=${reasoningEffort}`, {
      turn_id: options?.turnId || app.ai.turnId || "",
      request_id: requestId,
      status: "start",
      meta: {
        stream: false,
        model,
        continuation: isContinuation,
        tools_count: toolsCount,
        continuation_has_tools: continuationHasTools,
        reasoning_effort: reasoningEffort,
        reasoning_summary: reasoningSummary || null,
      },
    });

    const res = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${app.ai.apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const body = await res.text();
      const ms = Date.now() - startedAt;
      const shortBody = String(body || "").replace(/\s+/g, " ").trim().slice(0, 800);
      addExternalJournal("request.error", `HTTP ${res.status} /v1/responses`, {
        level: "error",
        status: "error",
        turn_id: options?.turnId || app.ai.turnId || "",
        request_id: requestId,
        duration_ms: ms,
        meta: { status: res.status, body: shortBody },
      });
      if (res.status === 401 || res.status === 403) {
        disconnectOpenAi();
        const e = new Error("openai unauthorized");
        e.no_fallback = true;
        throw e;
      }
      const e = new Error(`openai ${res.status}: ${shortBody || "unknown error"}`);
      e.no_fallback = true;
      throw e;
    }

    const parsed = await res.json();
    const ms = Date.now() - startedAt;
    const outCount = Array.isArray(parsed?.output) ? parsed.output.length : 0;
    const responseId = String(parsed?.id || "");

    addExternalJournal("request.complete", `HTTP 200 /v1/responses (json), output=${outCount}`, {
      turn_id: options?.turnId || app.ai.turnId || "",
      request_id: requestId,
      response_id: responseId,
      duration_ms: ms,
      status: "completed",
      meta: { output_count: outCount, model },
    });

    const hasWebSearch = Array.isArray(parsed?.output) && parsed.output.some((item) => String(item?.type || "").includes("web_search"));
    if (hasWebSearch) {
      addExternalJournal("web.search", "OpenAI выполнил web_search tool", {
        turn_id: options?.turnId || app.ai.turnId || "",
        request_id: requestId,
        response_id: responseId,
        status: "completed",
      });
    }

    if (typeof options?.onEvent === "function") {
      options.onEvent("response.completed", { response: parsed, __request_id: requestId });
    }
    parsed.__request_id = requestId;
    app.ai.currentRequestId = requestId;
    return parsed;
  }

  return { callOpenAiResponsesJson };
}
