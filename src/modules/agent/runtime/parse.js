export class AgentRuntimeResponseParseModule {
  constructor(ctx) {
    Object.assign(this, createAgentRuntimeResponseParseInternal(ctx));
  }
}

function createAgentRuntimeResponseParseInternal(ctx) {
  const { deps } = ctx || {};
  if (!deps) throw new Error("AgentRuntimeResponseParseModule requires deps");

  const { parseJsonSafe } = deps;
  if (typeof parseJsonSafe !== "function") throw new Error("AgentRuntimeResponseParseModule requires deps.parseJsonSafe()");

  function parseSseEvent(raw) {
    const src = String(raw || "").trim();
    if (!src) return null;
    const lines = src.split(/\r?\n/);
    let eventName = "";
    const dataLines = [];

    for (const line of lines) {
      if (line.startsWith(":")) continue;
      if (line.startsWith("event:")) {
        eventName = line.slice(6).trim();
        continue;
      }
      if (line.startsWith("data:")) {
        dataLines.push(line.slice(5).trimStart());
      }
    }

    if (!dataLines.length) return null;
    const dataRaw = dataLines.join("\n").trim();
    if (!dataRaw || dataRaw === "[DONE]") return null;
    const data = parseJsonSafe(dataRaw, { raw: dataRaw });
    return { event: eventName, data };
  }

  function extractAgentFunctionCalls(response) {
    const out = [];
    for (const item of response?.output || []) {
      if (item?.type === "function_call" && item.name && item.call_id) out.push(item);
    }
    return out;
  }

  function extractAgentText(response) {
    if (typeof response?.output_text === "string" && response.output_text.trim()) return response.output_text.trim();

    const parts = [];
    for (const item of response?.output || []) {
      if (item?.type !== "message") continue;
      for (const c of item.content || []) {
        if ((c.type === "output_text" || c.type === "text") && typeof c.text === "string") parts.push(c.text);
      }
    }
    return parts.join("\n").trim();
  }

  return {
    parseSseEvent,
    extractAgentFunctionCalls,
    extractAgentText,
  };
}
