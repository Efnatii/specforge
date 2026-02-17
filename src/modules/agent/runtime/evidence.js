export class AgentRuntimeWebEvidenceModule {
  constructor(ctx) {
    Object.assign(this, createAgentRuntimeWebEvidenceInternal(ctx));
  }
}

function createAgentRuntimeWebEvidenceInternal(ctx) {
  void ctx;

  function updateAgentTurnWebEvidence(turnCtx, response) {
    if (!turnCtx || !response) return;
    const evidence = extractWebSearchEvidence(response);
    if (evidence.used) turnCtx.webSearchUsed = true;
    for (const q of evidence.queries) pushUnique(turnCtx.webSearchQueries, q, 20);
    for (const u of evidence.urls) pushUnique(turnCtx.webSearchUrls, u, 60);
  }

  function extractWebSearchEvidence(response) {
    const out = { used: false, queries: [], urls: [] };
    const pushUrl = (raw) => {
      const cleaned = normalizeHttpUrl(raw);
      if (!cleaned) return;
      pushUnique(out.urls, cleaned, 60);
    };
    const pushQuery = (raw) => {
      const txt = String(raw || "").replace(/\s+/g, " ").trim();
      if (!txt) return;
      pushUnique(out.queries, txt.slice(0, 300), 20);
    };

    for (const item of response?.output || []) {
      const type = String(item?.type || "");
      if (type.includes("web_search")) {
        out.used = true;
        pushQuery(item?.query);
        pushQuery(item?.search_query);
        pushQuery(item?.q);
        pushQuery(item?.action?.query);
        if (Array.isArray(item?.action?.queries)) {
          for (const query of item.action.queries) pushQuery(query);
        }
        if (Array.isArray(item?.action?.sources)) {
          for (const source of item.action.sources) {
            pushUrl(source?.url || source?.link || source?.uri);
          }
        }
      }
      if (item?.type !== "message") continue;
      for (const c of item.content || []) {
        if (Array.isArray(c?.annotations)) {
          for (const a of c.annotations) {
            pushUrl(a?.url || a?.uri || a?.link);
          }
        }
        if (typeof c?.text === "string") {
          for (const url of c.text.match(/https?:\/\/[^\s)]+/g) || []) pushUrl(url);
        }
      }
    }
    return out;
  }

  function normalizeHttpUrl(raw) {
    const txt = String(raw || "").trim();
    if (!txt) return "";
    try {
      const url = new URL(txt);
      if (url.protocol !== "http:" && url.protocol !== "https:") return "";
      return url.toString();
    } catch {
      return "";
    }
  }

  function pushUnique(target, value, max = 50) {
    if (!Array.isArray(target)) return;
    const v = String(value || "").trim();
    if (!v) return;
    if (!target.includes(v)) target.push(v);
    if (target.length > max) target.splice(0, target.length - max);
  }

  return {
    updateAgentTurnWebEvidence,
    extractWebSearchEvidence,
    normalizeHttpUrl,
    pushUnique,
  };
}
