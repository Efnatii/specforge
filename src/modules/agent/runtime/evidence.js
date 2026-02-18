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

    scanIncludeEvidence(response?.include, out, pushQuery, pushUrl);
    return out;
  }

  function scanIncludeEvidence(includeRoot, out, pushQuery, pushUrl) {
    if (!includeRoot || typeof includeRoot !== "object") return;
    const queue = [includeRoot];
    const seen = new Set();
    let visited = 0;
    const VISIT_LIMIT = 3000;

    while (queue.length && visited < VISIT_LIMIT) {
      const node = queue.shift();
      visited += 1;
      if (!node || typeof node !== "object") continue;
      if (seen.has(node)) continue;
      seen.add(node);

      if (Array.isArray(node)) {
        for (let i = 0; i < node.length && i < 400; i += 1) {
          queue.push(node[i]);
        }
        continue;
      }

      const type = String(node?.type || node?.tool || node?.name || "").toLowerCase();
      if (type.includes("web_search")) out.used = true;

      pushQuery(node?.query);
      pushQuery(node?.search_query);
      pushQuery(node?.q);
      pushQuery(node?.action?.query);
      if (Array.isArray(node?.action?.queries)) {
        for (const query of node.action.queries) pushQuery(query);
      }

      if (Array.isArray(node?.action?.sources)) {
        for (const source of node.action.sources) {
          pushUrl(source?.url || source?.link || source?.uri || source?.source_url);
        }
      }
      if (Array.isArray(node?.sources)) {
        for (const source of node.sources) {
          pushUrl(source?.url || source?.link || source?.uri || source?.source_url);
          pushQuery(source?.query || source?.title || source?.name);
        }
      }
      if (Array.isArray(node?.results)) {
        for (const result of node.results) {
          pushUrl(result?.url || result?.link || result?.uri || result?.source_url);
          pushQuery(result?.query || result?.title || result?.name);
          if (result && typeof result === "object") queue.push(result);
        }
      }

      pushUrl(node?.url || node?.uri || node?.link || node?.source_url);
      if (typeof node?.text === "string") {
        for (const url of node.text.match(/https?:\/\/[^\s)]+/g) || []) pushUrl(url);
      }

      for (const value of Object.values(node)) {
        if (value && typeof value === "object") queue.push(value);
      }
    }
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
