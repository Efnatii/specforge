export class AgentRuntimeStreamTransportModule {
  constructor(ctx) {
    Object.assign(this, createAgentRuntimeStreamTransportInternal(ctx));
  }
}

function createAgentRuntimeStreamTransportInternal(ctx) {
  const { app, deps } = ctx || {};
  if (!app) throw new Error("AgentRuntimeStreamTransportModule requires app");
  if (!deps) throw new Error("AgentRuntimeStreamTransportModule requires deps");

  const {
    addExternalJournal,
    compactForTool,
    disconnectOpenAi,
    uid,
    num,
    fetchFn,
    parseSseEvent,
  } = deps;

  if (typeof addExternalJournal !== "function") throw new Error("AgentRuntimeStreamTransportModule requires deps.addExternalJournal()");
  if (typeof compactForTool !== "function") throw new Error("AgentRuntimeStreamTransportModule requires deps.compactForTool()");
  if (typeof disconnectOpenAi !== "function") throw new Error("AgentRuntimeStreamTransportModule requires deps.disconnectOpenAi()");
  if (typeof uid !== "function") throw new Error("AgentRuntimeStreamTransportModule requires deps.uid()");
  if (typeof num !== "function") throw new Error("AgentRuntimeStreamTransportModule requires deps.num()");
  if (typeof parseSseEvent !== "function") throw new Error("AgentRuntimeStreamTransportModule requires deps.parseSseEvent()");

  const fetch = fetchFn || ((...args) => globalThis.fetch(...args));

  async function callOpenAiResponsesStream(payload, options = {}) {
    const startedAt = Date.now();
    const model = String(payload?.model || app.ai.model || "");
    const isContinuation = Boolean(payload?.previous_response_id);
    const toolsCount = Array.isArray(payload?.tools) ? payload.tools.length : 0;
    const continuationHasTools = isContinuation ? toolsCount > 0 : false;
    const requestId = uid();
    const turnId = options?.turnId || app.ai.turnId || "";
    app.ai.currentRequestId = requestId;
    const timeoutMs = Math.max(30000, num(options?.timeout_ms, 180000));

    addExternalJournal("request.start", `${isContinuation ? "continue" : "start"} model=${model} tools=${toolsCount}`, {
      turn_id: turnId,
      request_id: requestId,
      status: "start",
      meta: {
        stream: true,
        model,
        continuation: isContinuation,
        tools_count: toolsCount,
        continuation_has_tools: continuationHasTools,
      },
    });

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort("timeout"), timeoutMs);
    let res = null;
    try {
      res = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
          Authorization: `Bearer ${app.ai.apiKey}`,
        },
        body: JSON.stringify({ ...payload, stream: true }),
        signal: controller.signal,
      });
    } catch (err) {
      clearTimeout(timer);
      throw new Error(`stream transport failed: ${String(err?.message || err)}`);
    }

    const headerRequestId = String(res.headers.get("x-request-id") || "");
    const reqId = headerRequestId || requestId;
    const ct = String(res.headers.get("content-type") || "").toLowerCase();

    if (!res.ok) {
      clearTimeout(timer);
      const body = await res.text();
      const ms = Date.now() - startedAt;
      const shortBody = String(body || "").replace(/\s+/g, " ").trim().slice(0, 800);
      addExternalJournal("request.error", `HTTP ${res.status} /v1/responses (stream)`, {
        level: "error",
        status: "error",
        turn_id: turnId,
        request_id: reqId,
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

    if (!ct.includes("text/event-stream") || !res.body) {
      clearTimeout(timer);
      let parsed = null;
      try {
        parsed = await res.json();
      } catch {
        const body = await res.text();
        throw new Error(`stream expected event-stream, got: ${ct || "unknown"} (${String(body).slice(0, 240)})`);
      }
      const ms = Date.now() - startedAt;
      const outCount = Array.isArray(parsed?.output) ? parsed.output.length : 0;
      addExternalJournal("request.complete", `HTTP 200 /v1/responses (stream->json), output=${outCount}`, {
        turn_id: turnId,
        request_id: reqId,
        response_id: String(parsed?.id || ""),
        duration_ms: ms,
        status: "completed",
        meta: { output_count: outCount, model, stream_fallback: "content_type" },
      });
      parsed.__request_id = reqId;
      app.ai.currentRequestId = reqId;
      return parsed;
    }

    const decoder = new TextDecoder("utf-8");
    const reader = res.body.getReader();
    let buf = "";
    let completed = null;
    let failed = null;
    let responseId = "";
    let deltaCounter = 0;
    let deltaChars = 0;

    try {
      while (true) {
        const step = await reader.read();
        if (step.done) break;
        buf += decoder.decode(step.value, { stream: true });
        buf = buf.replace(/\r\n/g, "\n");

        let sepIdx = buf.indexOf("\n\n");
        while (sepIdx >= 0) {
          const rawEvent = buf.slice(0, sepIdx);
          buf = buf.slice(sepIdx + 2);
          sepIdx = buf.indexOf("\n\n");
          const parsedEvent = parseSseEvent(rawEvent);
          if (!parsedEvent) continue;
          const eventName = parsedEvent.event || String(parsedEvent.data?.type || "");
          const eventData = parsedEvent.data || {};
          if (eventData?.response?.id) responseId = String(eventData.response.id);
          if (eventData?.id) responseId = String(eventData.id);

          if (typeof options?.onEvent === "function") {
            options.onEvent(eventName, { ...eventData, __request_id: reqId });
          }

          if (eventName === "response.output_text.delta") {
            const delta = String(eventData?.delta || "");
            if (delta) {
              deltaCounter += 1;
              deltaChars += delta.length;
              if (typeof options?.onDelta === "function") options.onDelta(delta);
            }
          } else if (eventName === "response.output_item.added") {
            addExternalJournal("stream.event", "response.output_item.added", {
              turn_id: turnId,
              request_id: reqId,
              response_id: responseId,
              status: "streaming",
              meta: compactForTool(eventData?.item || eventData),
            });
          } else if (eventName === "response.completed") {
            completed = eventData?.response || eventData;
            if (!responseId && completed?.id) responseId = String(completed.id);
          } else if (eventName === "response.failed") {
            failed = eventData?.error || eventData;
          }
        }
      }
      if (buf.trim()) {
        const parsedEvent = parseSseEvent(buf);
        if (parsedEvent) {
          const eventName = parsedEvent.event || String(parsedEvent.data?.type || "");
          const eventData = parsedEvent.data || {};
          if (eventName === "response.completed") {
            completed = eventData?.response || eventData;
            if (!responseId && completed?.id) responseId = String(completed.id);
          } else if (eventName === "response.failed") {
            failed = eventData?.error || eventData;
          }
        }
      }
    } finally {
      clearTimeout(timer);
    }

    if (failed) {
      const ms = Date.now() - startedAt;
      addExternalJournal("request.error", "response.failed", {
        level: "error",
        status: "error",
        turn_id: turnId,
        request_id: reqId,
        response_id: responseId,
        duration_ms: ms,
        meta: compactForTool(failed),
      });
      throw new Error(`openai stream failed: ${String(failed?.message || failed || "unknown")}`);
    }
    if (!completed) throw new Error("openai stream ended without response.completed");

    const ms = Date.now() - startedAt;
    const outCount = Array.isArray(completed?.output) ? completed.output.length : 0;
    addExternalJournal("request.complete", `HTTP 200 /v1/responses (stream), output=${outCount}`, {
      turn_id: turnId,
      request_id: reqId,
      response_id: responseId || String(completed?.id || ""),
      duration_ms: ms,
      status: "completed",
      meta: {
        output_count: outCount,
        model,
        stream: true,
        delta_count: deltaCounter,
        delta_chars: deltaChars,
      },
    });

    const hasWebSearch = Array.isArray(completed?.output) && completed.output.some((item) => String(item?.type || "").includes("web_search"));
    if (hasWebSearch) {
      addExternalJournal("web.search", "OpenAI выполнил web_search tool", {
        turn_id: turnId,
        request_id: reqId,
        response_id: responseId || String(completed?.id || ""),
        status: "completed",
      });
    }

    completed.__request_id = reqId;
    app.ai.currentRequestId = reqId;
    return completed;
  }

  return { callOpenAiResponsesStream };
}
