import { AgentRuntimePromptModule } from "./prompt.js";
import { AgentRuntimePolicyModule } from "./policy.js";
import { AgentRuntimeToolSpecModule } from "./schema/spec.js";
import { AgentRuntimeResponsesModule } from "./responses.js";
import { AgentRuntimeTurnModule } from "./turn.js";

const FILE_SEARCH_MAX_AGE_MS = 60 * 60 * 1000;

function normalizeModelId(value) {
  return String(value || "").trim().toLowerCase();
}

function isGpt5Family(modelId) {
  return /^gpt-5(?:[.-]|$)/.test(modelId);
}

function parseGpt5Minor(modelId) {
  const m = String(modelId || "").match(/^gpt-5(?:\.(\d+))?(?:[.-]|$)/);
  if (!m) return null;
  if (!m[1]) return 0;
  const n = Number.parseInt(m[1], 10);
  return Number.isFinite(n) ? n : 0;
}

function isOReasoningFamily(modelId) {
  return /^o(?:1|3|4)(?:[.-]|$)/.test(modelId);
}

function isComputerUsePreviewModel(modelId) {
  return /^computer-use-preview(?:[.-]|$)/.test(modelId);
}

function modelReasoningCapabilities(modelIdRaw) {
  const modelId = normalizeModelId(modelIdRaw);
  const gpt5 = isGpt5Family(modelId);
  const oFamily = isOReasoningFamily(modelId);
  const computerUse = isComputerUsePreviewModel(modelId);
  const supportsReasoning = gpt5 || oFamily || computerUse;
  if (!supportsReasoning) {
    return {
      supportsReasoning: false,
      effortValues: [],
      summaryValues: [],
    };
  }

  let effortValues = ["low", "medium", "high"];
  const gpt5Minor = gpt5 ? parseGpt5Minor(modelId) : null;
  if (gpt5) {
    // Keep explicit variants first; generic branches below cover newer gpt-5.x models.
    if (/^gpt-5\.2-pro(?:[.-]|$)/.test(modelId)) effortValues = ["medium", "high", "xhigh"];
    else if (/^gpt-5-pro(?:[.-]|$)/.test(modelId)) effortValues = ["high"];
    else if (/^gpt-5\.2-codex(?:[.-]|$)/.test(modelId)) effortValues = ["low", "medium", "high", "xhigh"];
    else if (/^gpt-5\.1-codex-max(?:[.-]|$)/.test(modelId)) effortValues = ["none", "medium", "high", "xhigh"];
    else if (gpt5Minor !== null && gpt5Minor >= 2) effortValues = ["none", "low", "medium", "high", "xhigh"];
    else if (gpt5Minor !== null && gpt5Minor >= 1) effortValues = ["none", "low", "medium", "high"];
    else effortValues = ["minimal", "low", "medium", "high"];
  }

  const summaryValues = computerUse
    || (gpt5 && gpt5Minor !== null && gpt5Minor >= 2)
    || oFamily
    ? ["auto", "concise", "detailed"]
    : ["auto", "detailed"];

  return {
    supportsReasoning: true,
    effortValues,
    summaryValues,
  };
}

function normalizeReasoningEffortForModel(value, capabilities) {
  const effort = String(value || "").trim().toLowerCase();
  const allowed = Array.isArray(capabilities?.effortValues) ? capabilities.effortValues : [];
  if (!allowed.length) return "medium";
  if (allowed.includes(effort)) return effort;
  if (effort === "none" && allowed.includes("minimal")) return "minimal";
  if ((effort === "none" || effort === "minimal") && allowed.includes("low")) return "low";
  if (effort === "xhigh" && allowed.includes("high")) return "high";
  if (allowed.includes("medium")) return "medium";
  return allowed[0];
}

function reasoningEffortRank(value) {
  const effort = String(value || "").trim().toLowerCase();
  if (effort === "none") return 0;
  if (effort === "minimal") return 1;
  if (effort === "low") return 2;
  if (effort === "medium") return 3;
  if (effort === "high") return 4;
  if (effort === "xhigh") return 5;
  return -1;
}

function maxReasoningEffort(aRaw, bRaw) {
  const a = String(aRaw || "").trim().toLowerCase();
  const b = String(bRaw || "").trim().toLowerCase();
  return reasoningEffortRank(b) > reasoningEffortRank(a) ? b : a;
}

function normalizeReasoningDepthOption(value, fallback = "balanced") {
  const mode = String(value || "").trim().toLowerCase();
  if (mode === "fast" || mode === "balanced" || mode === "deep") return mode;
  const fb = String(fallback || "").trim().toLowerCase();
  if (fb === "fast" || fb === "balanced" || fb === "deep") return fb;
  return "balanced";
}

function normalizeReasoningVerifyOption(value, fallback = "basic") {
  const mode = String(value || "").trim().toLowerCase();
  if (mode === "off" || mode === "basic" || mode === "strict") return mode;
  const fb = String(fallback || "").trim().toLowerCase();
  if (fb === "off" || fb === "basic" || fb === "strict") return fb;
  return "basic";
}

function apiEffortFloorByDepthAndVerify(depthRaw, verifyRaw, capabilities) {
  const depth = normalizeReasoningDepthOption(depthRaw, "balanced");
  const verify = normalizeReasoningVerifyOption(verifyRaw, "basic");
  let target = "";
  if (depth === "deep" && verify === "strict") target = "xhigh";
  else if (depth === "deep" || verify === "strict") target = "high";
  if (!target) return "";
  return normalizeReasoningEffortForModel(target, capabilities);
}

function normalizeReasoningSummaryForModel(value, capabilities) {
  const mode = String(value || "").trim().toLowerCase();
  if (mode === "off") return "off";
  const allowed = Array.isArray(capabilities?.summaryValues) ? capabilities.summaryValues : [];
  if (!allowed.length) return "off";
  if (allowed.includes(mode)) return mode;
  if ((mode === "concise" || mode === "detailed") && allowed.includes("auto")) return "auto";
  if (allowed.includes("auto")) return "auto";
  return allowed[0];
}

function supportsTextVerbosity(modelIdRaw) {
  return isGpt5Family(normalizeModelId(modelIdRaw));
}

function normalizeTextVerbosity(value, modelIdRaw) {
  if (!supportsTextVerbosity(modelIdRaw)) return "";
  const brevity = String(value || "").trim().toLowerCase();
  if (brevity === "short") return "low";
  if (brevity === "detailed") return "high";
  return "medium";
}

function normalizeServiceTierOption(value, fallback = "standard") {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "flex" || raw === "standard" || raw === "priority") return raw;
  const fb = String(fallback || "").trim().toLowerCase();
  if (fb === "flex" || fb === "standard" || fb === "priority") return fb;
  return "standard";
}

function toResponsesServiceTier(value) {
  const tier = normalizeServiceTierOption(value, "standard");
  if (tier === "flex" || tier === "priority") return tier;
  return "default";
}

function normalizeOnAutoOff(value, fallback = "auto") {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "on" || raw === "auto" || raw === "off") return raw;
  const fb = String(fallback || "").trim().toLowerCase();
  if (fb === "on" || fb === "auto" || fb === "off") return fb;
  return "auto";
}

function normalizeOffAutoOn(value, fallback = "off") {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "off" || raw === "auto" || raw === "on") return raw;
  const fb = String(fallback || "").trim().toLowerCase();
  if (fb === "off" || fb === "auto" || fb === "on") return fb;
  return "off";
}

function normalizeOptionalTextMode(value, fallback = "auto") {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "auto" || raw === "off" || raw === "custom") return raw;
  const fb = String(fallback || "").trim().toLowerCase();
  if (fb === "auto" || fb === "off" || fb === "custom") return fb;
  return "auto";
}

function normalizePositiveInt(value, fallback = 0, min = 1, max = 2000000) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) {
    const fb = Number(fallback);
    if (!Number.isFinite(fb) || fb <= 0) return 0;
    return Math.max(min, Math.min(max, Math.round(fb)));
  }
  return Math.max(min, Math.min(max, Math.round(n)));
}

function normalizeShortString(value, maxLen = 128) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, maxLen);
}

function normalizeTokenLike(value, fallback = "", maxLen = 64) {
  const raw = normalizeShortString(value, maxLen).toLowerCase().replace(/[^a-z0-9._:-]+/g, "-").replace(/^-+|-+$/g, "");
  if (raw) return raw;
  return normalizeShortString(fallback, maxLen).toLowerCase().replace(/[^a-z0-9._:-]+/g, "-").replace(/^-+|-+$/g, "");
}

function normalizePromptCacheRetention(value, fallback = "default") {
  const raw = normalizeShortString(value, 64).toLowerCase().replace(/_/g, "-");
  if (raw === "default" || raw === "in-memory" || raw === "24h") return raw;
  const fb = normalizeShortString(fallback, 64).toLowerCase().replace(/_/g, "-");
  if (fb === "default" || fb === "in-memory" || fb === "24h") return fb;
  return "default";
}

function boolOption(value, fallback = false) {
  if (typeof value === "boolean") return value;
  if (value === undefined || value === null) return Boolean(fallback);
  const raw = String(value).trim().toLowerCase();
  if (raw === "1" || raw === "true" || raw === "on" || raw === "yes") return true;
  if (raw === "0" || raw === "false" || raw === "off" || raw === "no") return false;
  return Boolean(fallback);
}

const SPECFORGE_STRUCTURED_OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    summary: { type: "string", description: "Краткий итог и ключевые решения" },
    positions: {
      type: "array",
      description: "Позиции спецификации",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          schematic: { type: "string" },
          name: { type: "string" },
          manufacturer: { type: "string" },
          article: { type: "string" },
          qty: { type: "number" },
          unit: { type: "string" },
          supplier: { type: "string" },
          note: { type: "string" },
          source: { type: "string" },
          confidence: { type: "string" },
        },
        required: ["name"],
      },
    },
    validation: {
      type: "array",
      items: { type: "string" },
      description: "Проверки и предупреждения",
    },
    missing_data: {
      type: "array",
      items: { type: "string" },
      description: "Каких данных не хватает для полного результата",
    },
  },
  required: ["summary", "positions"],
};

export class AgentRuntimeModule {
  constructor(ctx) {
    const {
      app,
      config,
      deps,
    } = ctx || {};

    if (!app) throw new Error("AgentRuntimeModule requires app");
    if (!config) throw new Error("AgentRuntimeModule requires config");
    if (!deps) throw new Error("AgentRuntimeModule requires deps");

    const {
      CHAT_CONTEXT_RECENT_MESSAGES,
      CHAT_CONTEXT_MAX_CHARS,
      CHAT_CONTEXT_MESSAGE_MAX_CHARS,
      CHAT_SUMMARY_CHUNK_SIZE,
      AI_CONTINUE_PROMPT_RE,
      AI_SHORT_ACK_PROMPT_RE,
      AI_MUTATION_INTENT_RE,
      AI_ACTIONABLE_VERB_RE,
      AI_ANALYSIS_INTENT_RE,
      AI_TOOL_NAME_HINTS,
      AI_INCOMPLETE_RESPONSE_RE,
      AGENT_MAX_FORCED_RETRIES,
      AGENT_MAX_TOOL_ROUNDS,
    } = config;

    const {
      addChangesJournal,
      activeSheet,
      selectionText,
      toA1,
      colToName,
      agentCellValueText,
      currentAiModelMeta,
      executeAgentTool,
      addExternalJournal,
      addTableJournal,
      compactForTool,
      disconnectOpenAi,
      uid,
      num,
      summarizeChatChunk,
      mergeChatSummary,
      fetchFn,
    } = deps;

    this._app = app;
    this._fetch = fetchFn || ((...args) => globalThis.fetch(...args));
    this._addExternalJournal = addExternalJournal;
    this._disconnectOpenAi = disconnectOpenAi;
    this._toolSpecModule = new AgentRuntimeToolSpecModule({ app });
    this.buildAgentResponsesPayload = this.buildAgentResponsesPayload.bind(this);
    this.ensureFileSearchReady = this.ensureFileSearchReady.bind(this);
    this._fileSearchCleanupTimer = 0;

    const promptModule = new AgentRuntimePromptModule({
      app,
      config: {
        CHAT_CONTEXT_RECENT_MESSAGES,
        CHAT_CONTEXT_MAX_CHARS,
        CHAT_CONTEXT_MESSAGE_MAX_CHARS,
        CHAT_SUMMARY_CHUNK_SIZE,
        AI_CONTINUE_PROMPT_RE,
        AI_SHORT_ACK_PROMPT_RE,
        AI_MUTATION_INTENT_RE,
        AI_ACTIONABLE_VERB_RE,
        AI_ANALYSIS_INTENT_RE,
        AI_TOOL_NAME_HINTS,
      },
      deps: {
        addChangesJournal,
        activeSheet,
        selectionText,
        toA1,
        colToName,
        agentCellValueText,
        summarizeChatChunk,
        mergeChatSummary,
      },
    });

    const policyModule = new AgentRuntimePolicyModule({
      app,
      config: {
        AI_INCOMPLETE_RESPONSE_RE,
      },
      deps: {
        num,
      },
    });

    const responsesModule = new AgentRuntimeResponsesModule({
      app,
      deps: {
        addExternalJournal,
        compactForTool,
        disconnectOpenAi,
        uid,
        num,
        fetchFn,
        parseJsonSafe: policyModule.parseJsonSafe,
      },
    });

    const turnModule = new AgentRuntimeTurnModule({
      app,
      config: {
        AGENT_MAX_FORCED_RETRIES,
        AGENT_MAX_TOOL_ROUNDS,
        AI_MUTATION_INTENT_RE,
        AI_ANALYSIS_INTENT_RE,
      },
      deps: {
        currentAiModelMeta,
        executeAgentTool,
        addExternalJournal,
        addTableJournal,
        compactForTool,
        num,
        isActionableAgentPrompt: promptModule.isActionableAgentPrompt,
        estimateExpectedMutationCount: policyModule.estimateExpectedMutationCount,
        resolveTaskProfile: policyModule.resolveTaskProfile,
        buildAgentResponsesPayload: this.buildAgentResponsesPayload,
        callOpenAiResponses: responsesModule.callOpenAiResponses,
        agentSystemPrompt: this._toolSpecModule.agentSystemPrompt,
        extractAgentFunctionCalls: responsesModule.extractAgentFunctionCalls,
        extractAgentText: responsesModule.extractAgentText,
        isAgentTextIncomplete: policyModule.isAgentTextIncomplete,
        shouldForceAgentContinuation: policyModule.shouldForceAgentContinuation,
        buildAgentRetryReason: policyModule.buildAgentRetryReason,
        buildAgentContinuationInstruction: policyModule.buildAgentContinuationInstruction,
        sanitizeAgentOutputText: policyModule.sanitizeAgentOutputText,
        parseJsonSafe: policyModule.parseJsonSafe,
        summarizeToolArgs: policyModule.summarizeToolArgs,
        normalizeToolResult: policyModule.normalizeToolResult,
        isMutationToolName: policyModule.isMutationToolName,
        updateAgentTurnWebEvidence: responsesModule.updateAgentTurnWebEvidence,
        prepareToolResources: this.ensureFileSearchReady,
        compactOpenAiResponse: responsesModule.compactOpenAiResponse,
      },
    });

    this.normalizeAgentPrompt = promptModule.normalizeAgentPrompt;
    this.isActionableAgentPrompt = promptModule.isActionableAgentPrompt;
    this.buildAgentInput = promptModule.buildAgentInput;
    this.buildChatHistoryContext = promptModule.buildChatHistoryContext;
    this.buildAgentContextText = promptModule.buildAgentContextText;
    this.serializeSheetPreview = promptModule.serializeSheetPreview;

    this.runOpenAiAgentTurn = turnModule.runOpenAiAgentTurn;

    this.estimateExpectedMutationCount = policyModule.estimateExpectedMutationCount;
    this.looksLikePseudoToolText = policyModule.looksLikePseudoToolText;
    this.isAgentTextIncomplete = policyModule.isAgentTextIncomplete;
    this.shouldForceAgentContinuation = policyModule.shouldForceAgentContinuation;
    this.buildAgentRetryReason = policyModule.buildAgentRetryReason;
    this.buildAgentContinuationInstruction = policyModule.buildAgentContinuationInstruction;
    this.sanitizeAgentOutputText = policyModule.sanitizeAgentOutputText;
    this.summarizeToolArgs = policyModule.summarizeToolArgs;
    this.normalizeToolResult = policyModule.normalizeToolResult;
    this.parseJsonSafe = policyModule.parseJsonSafe;
    this.parseJsonValue = policyModule.parseJsonValue;
    this.isMutationToolName = policyModule.isMutationToolName;

    this.agentSystemPrompt = this._toolSpecModule.agentSystemPrompt;
    this.agentToolsSpec = this._toolSpecModule.agentToolsSpec;

    this.callOpenAiResponses = responsesModule.callOpenAiResponses;
    this.callOpenAiResponsesJson = responsesModule.callOpenAiResponsesJson;
    this.callOpenAiResponsesStream = responsesModule.callOpenAiResponsesStream;
    this.cancelOpenAiResponse = responsesModule.cancelOpenAiResponse;
    this.compactOpenAiResponse = responsesModule.compactOpenAiResponse;
    this.parseSseEvent = responsesModule.parseSseEvent;
    this.extractAgentFunctionCalls = responsesModule.extractAgentFunctionCalls;
    this.extractAgentText = responsesModule.extractAgentText;
    this.updateAgentTurnWebEvidence = responsesModule.updateAgentTurnWebEvidence;
    this.extractWebSearchEvidence = responsesModule.extractWebSearchEvidence;
    this.normalizeHttpUrl = responsesModule.normalizeHttpUrl;
    this.pushUnique = responsesModule.pushUnique;
  }

  _ensureFileSearchState() {
    if (!this._app.ai.fileSearch || typeof this._app.ai.fileSearch !== "object") {
      this._app.ai.fileSearch = {
        vectorStoreId: "",
        attachmentsSignature: "",
        syncedAt: 0,
      };
    }
    return this._app.ai.fileSearch;
  }

  _resetFileSearchState(state = this._ensureFileSearchState()) {
    state.vectorStoreId = "";
    state.attachmentsSignature = "";
    state.syncedAt = 0;
    return state;
  }

  _isFileSearchExpired(state = this._ensureFileSearchState(), nowTs = Date.now()) {
    const syncedAt = Math.max(0, Number(state?.syncedAt || 0));
    if (!syncedAt) return false;
    return (nowTs - syncedAt) >= FILE_SEARCH_MAX_AGE_MS;
  }

  _clearFileSearchCleanupTimer() {
    if (!this._fileSearchCleanupTimer) return;
    if (typeof globalThis.clearTimeout === "function") {
      globalThis.clearTimeout(this._fileSearchCleanupTimer);
    }
    this._fileSearchCleanupTimer = 0;
  }

  _scheduleFileSearchCleanup(vectorStoreId, syncedAt = Date.now(), turnId = "") {
    this._clearFileSearchCleanupTimer();
    const id = String(vectorStoreId || "").trim();
    if (!id) return;
    if (typeof globalThis.setTimeout !== "function") return;

    const elapsed = Math.max(0, Date.now() - Math.max(0, Number(syncedAt || 0)));
    const delayMs = Math.max(1000, FILE_SEARCH_MAX_AGE_MS - elapsed);
    this._fileSearchCleanupTimer = globalThis.setTimeout(() => {
      this._fileSearchCleanupTimer = 0;
      void (async () => {
        try {
          await this._deleteVectorStore(id, {
            turnId: String(turnId || this._app.ai.turnId || ""),
            reason: "ttl_1h",
          });
          const state = this._ensureFileSearchState();
          if (String(state.vectorStoreId || "").trim() === id) this._resetFileSearchState(state);
        } catch (err) {
          if (err?.no_fallback) return;
        }
      })();
    }, delayMs);
  }

  _safeAttachmentFileName(rawName, idx = 0) {
    const base = String(rawName || `attachment-${idx + 1}`)
      .replace(/[\\/:*?"<>|]+/g, "_")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 80);
    if (!base) return `attachment-${idx + 1}.txt`;
    return /\.(txt|md|csv|json|xml|yaml|yml)$/i.test(base) ? base : `${base}.txt`;
  }

  _buildFileSearchDocs() {
    const attachments = Array.isArray(this._app?.ai?.attachments) ? this._app.ai.attachments : [];
    const docs = [];
    for (let i = 0; i < attachments.length; i += 1) {
      const file = attachments[i] || {};
      const name = String(file?.name || `attachment-${i + 1}`).trim() || `attachment-${i + 1}`;
      const parser = String(file?.parser || "").trim();
      const parseError = String(file?.parse_error || "").trim();
      const textRaw = String(file?.text || "");
      const text = textRaw.slice(0, 180000);
      const meta = [
        `name: ${name}`,
        `id: ${String(file?.id || "").trim()}`,
        `type: ${String(file?.type || "application/octet-stream").trim()}`,
        `size: ${Math.max(0, Number(file?.size || 0))}`,
        `parser: ${parser || "n/a"}`,
        `truncated: ${Boolean(file?.truncated) ? "yes" : "no"}`,
      ];
      if (parseError) meta.push(`parse_error: ${parseError.slice(0, 240)}`);
      const body = text.trim()
        ? `Extracted content:\n${text}`
        : "Extracted content: unavailable";
      docs.push({
        attachmentId: String(file?.id || "").trim() || `idx-${i}`,
        name,
        fileName: this._safeAttachmentFileName(name, i),
        content: `${meta.join("\n")}\n\n${body}`.slice(0, 200000),
      });
    }
    return docs;
  }

  _fileSearchSignature(docs) {
    return docs
      .map((doc) => {
        const prefix = String(doc?.content || "").slice(0, 160).replace(/\s+/g, " ").trim();
        return `${doc?.attachmentId || ""}:${doc?.fileName || ""}:${String(doc?.content || "").length}:${prefix}`;
      })
      .join("|")
      .slice(0, 16000);
  }

  async _openAiJson(url, options = {}) {
    const method = String(options?.method || "GET").toUpperCase();
    const headers = { Authorization: `Bearer ${this._app.ai.apiKey}` };
    const init = { method, headers };
    if (options?.contentType) headers["Content-Type"] = options.contentType;
    if (options?.body !== undefined) init.body = options.body;

    const res = await this._fetch(url, init);
    if (!res.ok) {
      const bodyText = String(await res.text()).replace(/\s+/g, " ").trim().slice(0, 800);
      if (res.status === 401 || res.status === 403) {
        this._disconnectOpenAi();
        const e = new Error("openai unauthorized");
        e.no_fallback = true;
        throw e;
      }
      throw new Error(`openai ${res.status}: ${bodyText || "unknown error"}`);
    }
    return res.json();
  }

  async _uploadOpenAiFile(fileName, content) {
    if (typeof FormData !== "function" || typeof Blob !== "function") {
      throw new Error("file upload is unavailable in this environment");
    }
    const form = new FormData();
    form.append("purpose", "assistants");
    form.append("file", new Blob([String(content || "")], { type: "text/plain" }), fileName);

    const res = await this._fetch("https://api.openai.com/v1/files", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this._app.ai.apiKey}`,
      },
      body: form,
    });
    if (!res.ok) {
      const bodyText = String(await res.text()).replace(/\s+/g, " ").trim().slice(0, 800);
      if (res.status === 401 || res.status === 403) {
        this._disconnectOpenAi();
        const e = new Error("openai unauthorized");
        e.no_fallback = true;
        throw e;
      }
      throw new Error(`openai ${res.status}: ${bodyText || "file upload failed"}`);
    }
    return res.json();
  }

  async _deleteVectorStore(vectorStoreId, options = {}) {
    const id = String(vectorStoreId || "").trim();
    if (!id) return false;
    const turnId = String(options?.turnId || this._app.ai.turnId || "");
    const reason = String(options?.reason || "cleanup").trim() || "cleanup";

    try {
      const res = await this._fetch(`https://api.openai.com/v1/vector_stores/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${this._app.ai.apiKey}`,
        },
      });
      if (res.status === 401 || res.status === 403) {
        this._disconnectOpenAi();
        const e = new Error("openai unauthorized");
        e.no_fallback = true;
        throw e;
      }
      if (!res.ok && res.status !== 404) {
        const bodyText = String(await res.text()).replace(/\s+/g, " ").trim().slice(0, 800);
        throw new Error(`vector_store delete failed ${res.status}: ${bodyText || "unknown error"}`);
      }
      this._addExternalJournal("file_search.cleanup", `deleted vector_store=${id}`, {
        turn_id: turnId,
        status: "completed",
        meta: {
          reason,
          vector_store_id: id,
          http_status: res.status,
        },
      });
      return true;
    } catch (err) {
      if (err?.no_fallback) throw err;
      this._addExternalJournal("file_search.cleanup.error", String(err?.message || err), {
        turn_id: turnId,
        level: "warning",
        status: "error",
        meta: {
          reason,
          vector_store_id: id,
        },
      });
      return false;
    }
  }

  async ensureFileSearchReady(options = {}) {
    const docs = this._buildFileSearchDocs();
    const turnId = String(options?.turnId || this._app.ai.turnId || "");
    const state = this._ensureFileSearchState();
    const currentVectorStoreId = String(state.vectorStoreId || "").trim();

    if (!docs.length) {
      this._clearFileSearchCleanupTimer();
      if (currentVectorStoreId) {
        await this._deleteVectorStore(currentVectorStoreId, {
          turnId,
          reason: "no_attachments",
        });
      }
      this._resetFileSearchState(state);
      return "";
    }

    const signature = this._fileSearchSignature(docs);
    const ttlExpired = this._isFileSearchExpired(state);

    if (currentVectorStoreId && state.attachmentsSignature === signature && !ttlExpired) {
      this._scheduleFileSearchCleanup(currentVectorStoreId, state.syncedAt, turnId);
      return currentVectorStoreId;
    }

    if (currentVectorStoreId) {
      this._clearFileSearchCleanupTimer();
      await this._deleteVectorStore(currentVectorStoreId, {
        turnId,
        reason: ttlExpired ? "ttl_1h" : "attachments_changed",
      });
      this._resetFileSearchState(state);
    }

    const startedAt = Date.now();
    this._addExternalJournal("file_search.sync", `start files=${docs.length}`, {
      turn_id: turnId,
      status: "running",
      meta: { files: docs.length },
    });

    const vectorStore = await this._openAiJson("https://api.openai.com/v1/vector_stores", {
      method: "POST",
      contentType: "application/json",
      body: JSON.stringify({
        name: `specforge-${Date.now()}`,
        expires_after: { anchor: "last_active_at", days: 1 },
      }),
    });
    const vectorStoreId = String(vectorStore?.id || "").trim();
    if (!vectorStoreId) throw new Error("vector_store_id is missing");

    for (let i = 0; i < docs.length; i += 1) {
      const doc = docs[i];
      const file = await this._uploadOpenAiFile(doc.fileName, doc.content);
      const fileId = String(file?.id || "").trim();
      if (!fileId) throw new Error(`file_id is missing for ${doc.fileName}`);
      await this._openAiJson(`https://api.openai.com/v1/vector_stores/${vectorStoreId}/files`, {
        method: "POST",
        contentType: "application/json",
        body: JSON.stringify({ file_id: fileId }),
      });
    }

    state.vectorStoreId = vectorStoreId;
    state.attachmentsSignature = signature;
    state.syncedAt = Date.now();
    this._scheduleFileSearchCleanup(vectorStoreId, state.syncedAt, turnId);

    this._addExternalJournal("file_search.sync", `completed files=${docs.length}`, {
      turn_id: turnId,
      status: "completed",
      duration_ms: Date.now() - startedAt,
      meta: { files: docs.length, vector_store_id: vectorStoreId },
    });

    return vectorStoreId;
  }

  buildAgentResponsesPayload(options = {}) {
    const normalizeToolsMode = (value) => {
      const mode = String(value || "").trim().toLowerCase();
      if (mode === "none" || mode === "auto" || mode === "prefer" || mode === "require") return mode;
      return "auto";
    };
    const normalizeReasoningMaxTokens = (value) => {
      const n = Number(value);
      if (!Number.isFinite(n) || n <= 0) return 0;
      return Math.max(1, Math.round(n));
    };
    const model = String(options?.model || this._app.ai.model || "");
    const runtimeOverrides = this._app?.ai?.runtimeProfile?.overrides;
    const getRuntimeAwareOption = (key, fallback = undefined) => {
      if (runtimeOverrides && Object.prototype.hasOwnProperty.call(runtimeOverrides, key)) {
        return runtimeOverrides[key];
      }
      const value = this._app?.ai?.options?.[key];
      return value === undefined ? fallback : value;
    };
    const reasoningCapabilities = modelReasoningCapabilities(model);
    const reasoningEnabled = getRuntimeAwareOption("reasoning", true) !== false && reasoningCapabilities.supportsReasoning;
    const reasoningDepth = normalizeReasoningDepthOption(getRuntimeAwareOption("reasoningDepth", "balanced"), "balanced");
    const reasoningVerify = normalizeReasoningVerifyOption(getRuntimeAwareOption("reasoningVerify", "basic"), "basic");
    let reasoningEffort = normalizeReasoningEffortForModel(getRuntimeAwareOption("reasoningEffort", "medium"), reasoningCapabilities);
    const apiEffortFloor = apiEffortFloorByDepthAndVerify(reasoningDepth, reasoningVerify, reasoningCapabilities);
    if (apiEffortFloor) reasoningEffort = maxReasoningEffort(reasoningEffort, apiEffortFloor);
    const reasoningSummary = normalizeReasoningSummaryForModel(getRuntimeAwareOption("reasoningSummary", "auto"), reasoningCapabilities);
    const textVerbosity = normalizeTextVerbosity(getRuntimeAwareOption("brevityMode", "normal"), model);
    const serviceTier = toResponsesServiceTier(getRuntimeAwareOption("serviceTier", "standard"));
    const toolsMode = normalizeToolsMode(getRuntimeAwareOption("toolsMode", "auto"));
    const reasoningMaxTokens = normalizeReasoningMaxTokens(getRuntimeAwareOption("reasoningMaxTokens", 0));
    const runtimeModeRaw = String(this._app?.ai?.runtimeProfile?.mode || "").trim().toLowerCase();
    const runtimeSelectedProfileRaw = String(this._app?.ai?.runtimeProfile?.selected || "").trim().toLowerCase();
    const taskProfileModeRaw = String(this._app?.ai?.options?.taskProfile || "auto").trim().toLowerCase();
    const noReasoningProfileRaw = String(this._app?.ai?.options?.noReasoningProfile || "standard").trim().toLowerCase();
    const noReasoningAliases = {
      auto: "standard",
      fast: "quick",
      balanced: "standard",
      bulk: "concise",
      longrun: "detailed",
      price_search: "sources",
      proposal: "json",
      source_audit: "sources",
      accurate: "cautious",
      research: "sources",
      spec_strict: "json",
    };
    const noReasoningAllowed = new Set(["quick", "standard", "concise", "detailed", "json", "sources", "cautious", "tool_free", "custom"]);
    const mappedNoReasoningProfile = noReasoningAliases[noReasoningProfileRaw] || noReasoningProfileRaw;
    const noReasoningProfile = noReasoningAllowed.has(mappedNoReasoningProfile) ? mappedNoReasoningProfile : "standard";
    const runtimeModeAllowed = new Set([
      "auto",
      "fast",
      "balanced",
      "bulk",
      "longrun",
      "price_search",
      "proposal",
      "source_audit",
      "accurate",
      "research",
      "spec_strict",
      "custom",
      "no_reasoning",
      "no_reasoning_custom",
    ]);
    const taskSelectedAllowed = new Set([
      "fast",
      "balanced",
      "bulk",
      "longrun",
      "price_search",
      "proposal",
      "source_audit",
      "accurate",
      "research",
      "spec_strict",
      "custom",
    ]);
    const taskModeAllowed = new Set([
      "auto",
      "fast",
      "balanced",
      "bulk",
      "longrun",
      "price_search",
      "proposal",
      "source_audit",
      "accurate",
      "research",
      "spec_strict",
      "custom",
    ]);
    const runtimeMode = runtimeModeAllowed.has(runtimeModeRaw) ? runtimeModeRaw : "";
    const taskProfileMode = taskModeAllowed.has(taskProfileModeRaw) ? taskProfileModeRaw : "auto";
    const reasoningDisabledByOption = getRuntimeAwareOption("reasoning", true) === false;
    const effectiveProfileMode = reasoningDisabledByOption
      ? (
          runtimeMode === "no_reasoning" || runtimeMode === "no_reasoning_custom"
            ? runtimeMode
            : (noReasoningProfile === "custom" ? "no_reasoning_custom" : "no_reasoning")
        )
      : (runtimeMode || taskProfileMode);
    const runtimeSelectedProfileNoReasoning = noReasoningAliases[runtimeSelectedProfileRaw] || runtimeSelectedProfileRaw;
    let runtimeSelectedProfile = (effectiveProfileMode === "no_reasoning" || effectiveProfileMode === "no_reasoning_custom")
      ? (noReasoningAllowed.has(runtimeSelectedProfileNoReasoning) ? runtimeSelectedProfileNoReasoning : "")
      : (taskSelectedAllowed.has(runtimeSelectedProfileRaw) ? runtimeSelectedProfileRaw : "");
    if (!runtimeSelectedProfile) {
      if (effectiveProfileMode === "no_reasoning" || effectiveProfileMode === "no_reasoning_custom") {
        runtimeSelectedProfile = noReasoningProfile;
      } else if (taskProfileMode !== "auto") {
        runtimeSelectedProfile = taskProfileMode;
      }
    }
    const toolsRaw = toolsMode === "none" ? [] : this._toolSpecModule.agentToolsSpec();
    const supportsComputerUse = isComputerUsePreviewModel(model);
    const tools = supportsComputerUse
      ? toolsRaw
      : toolsRaw.filter((tool) => String(tool?.type || "") !== "computer_use_preview");
    const toolChoice = toolsMode === "none"
      ? "none"
      : toolsMode === "require"
        ? "required"
        : "auto";
    const payload = {
      model,
      tools,
    };
    payload.tool_choice = toolChoice;
    if (toolsMode !== "none") payload.parallel_tool_calls = true;
    if (reasoningEnabled) {
      const reasoning = {
        effort: reasoningEffort,
      };
      if (reasoningSummary !== "off") reasoning.summary = reasoningSummary;
      payload.reasoning = reasoning;
    }
    let textPayload = null;
    if (textVerbosity) textPayload = { ...(textPayload || {}), verbosity: textVerbosity };
    const structuredSpecOutput = boolOption(getRuntimeAwareOption("structuredSpecOutput", false), false);
    if (structuredSpecOutput) {
      textPayload = {
        ...(textPayload || {}),
        format: {
          type: "json_schema",
          name: "specforge_structured_output",
          strict: true,
          schema: SPECFORGE_STRUCTURED_OUTPUT_SCHEMA,
        },
      };
    }
    if (textPayload) payload.text = textPayload;
    if (reasoningMaxTokens > 0) payload.max_output_tokens = reasoningMaxTokens;
    if (serviceTier === "flex" || serviceTier === "priority") payload.service_tier = serviceTier;
    const hasComputerUse = Array.isArray(tools) && tools.some((tool) => String(tool?.type || "") === "computer_use_preview");
    const safeTruncationAuto = boolOption(getRuntimeAwareOption("safeTruncationAuto", false), false);
    if (hasComputerUse || safeTruncationAuto) payload.truncation = "auto";

    const profileToken = normalizeTokenLike(runtimeSelectedProfile || effectiveProfileMode || "auto", "auto", 24) || "auto";
    const modelToken = normalizeTokenLike(model || this._app?.ai?.model || "model", "model", 32) || "model";
    const turnToken = normalizeTokenLike(options?.turnId || this._app?.ai?.turnId || "turn", "turn", 24) || "turn";
    const autoPromptVersion = normalizeTokenLike(
      globalThis?.__SPECFORGE_PROMPT_VERSION__ || "",
      `v1-${profileToken}`,
      24,
    ) || `v1-${profileToken}`;

    const promptCacheKeyMode = normalizeOptionalTextMode(getRuntimeAwareOption("promptCacheKeyMode", "auto"), "auto");
    const promptCacheKeyCustom = normalizeShortString(getRuntimeAwareOption("promptCacheKey", ""), 240);
    const promptCacheKeyAuto = normalizeShortString(`sf:${profileToken}:${modelToken}:${autoPromptVersion}`, 240);
    const promptCacheKey = promptCacheKeyMode === "custom"
      ? promptCacheKeyCustom
      : promptCacheKeyMode === "auto"
        ? promptCacheKeyAuto
        : "";

    const promptCacheRetentionMode = normalizeOptionalTextMode(getRuntimeAwareOption("promptCacheRetentionMode", "auto"), "auto");
    const promptCacheRetentionCustom = normalizePromptCacheRetention(getRuntimeAwareOption("promptCacheRetention", "default"), "default");
    const useConversationState = boolOption(getRuntimeAwareOption("useConversationState", false), false);
    const heavyProfileForCache = new Set(["spec_strict", "research", "accurate", "source_audit", "proposal", "price_search", "longrun"]);
    const heavyCacheSession = heavyProfileForCache.has(runtimeSelectedProfile)
      || reasoningMaxTokens >= 12000
      || useConversationState
      || structuredSpecOutput;
    const promptCacheRetentionAuto = heavyCacheSession ? "24h" : "in-memory";
    const promptCacheRetention = promptCacheRetentionMode === "custom"
      ? promptCacheRetentionCustom
      : promptCacheRetentionMode === "auto"
        ? promptCacheRetentionAuto
        : "";

    const safetyIdentifierMode = normalizeOptionalTextMode(getRuntimeAwareOption("safetyIdentifierMode", "auto"), "auto");
    const safetyIdentifierCustom = normalizeShortString(getRuntimeAwareOption("safetyIdentifier", ""), 240);
    const safetyIdentifierAuto = normalizeShortString(`sf.${profileToken}.${turnToken}`, 240);
    const safetyIdentifier = safetyIdentifierMode === "custom"
      ? safetyIdentifierCustom
      : safetyIdentifierMode === "auto"
        ? safetyIdentifierAuto
        : "";

    if (promptCacheKey) payload.prompt_cache_key = promptCacheKey;
    if (promptCacheKey && promptCacheRetention && promptCacheRetention !== "default") payload.prompt_cache_retention = promptCacheRetention;
    if (safetyIdentifier) payload.safety_identifier = safetyIdentifier;

    const backgroundMode = normalizeOnAutoOff(getRuntimeAwareOption("backgroundMode", "auto"), "auto");
    const backgroundTokenThreshold = normalizePositiveInt(getRuntimeAwareOption("backgroundTokenThreshold", 12000), 12000, 1, 2000000);
    const backgroundPreferredProfiles = new Set(["bulk", "price_search"]);
    const isBulkProfile = backgroundPreferredProfiles.has(runtimeSelectedProfile);
    const allowBackground = options?.allowBackground !== false;
    const exceedsTokenThreshold = reasoningMaxTokens > 0 && reasoningMaxTokens >= backgroundTokenThreshold;
    const backgroundAuto = isBulkProfile || exceedsTokenThreshold;
    if (allowBackground && (backgroundMode === "on" || (backgroundMode === "auto" && backgroundAuto))) {
      payload.background = true;
    }

    const includeMode = normalizeOffAutoOn(getRuntimeAwareOption("includeSourcesMode", "off"), "off");
    const citationsMode = String(getRuntimeAwareOption("citationsMode", "off")).trim().toLowerCase();
    const hasWebSearchTool = Array.isArray(tools) && tools.some((tool) => String(tool?.type || "") === "web_search");
    const hasFileSearchTool = Array.isArray(tools) && tools.some((tool) => String(tool?.type || "") === "file_search");
    const include = [];
    const includeWhenAuto = citationsMode === "on"
      || runtimeSelectedProfile === "research"
      || runtimeSelectedProfile === "accurate"
      || runtimeSelectedProfile === "source_audit"
      || runtimeSelectedProfile === "spec_strict"
      || runtimeSelectedProfile === "price_search";
    if (hasWebSearchTool && (includeMode === "on" || (includeMode === "auto" && includeWhenAuto))) {
      include.push("web_search_call.action.sources");
    }
    if (hasFileSearchTool && (includeMode === "on" || includeMode === "auto")) {
      include.push("file_search_call.results");
    }
    if (include.length) payload.include = include;

    const metadataEnabled = boolOption(getRuntimeAwareOption("metadataEnabled", true), true);
    if (metadataEnabled) {
      const metadataPromptVersionMode = normalizeOptionalTextMode(getRuntimeAwareOption("metadataPromptVersionMode", "auto"), "auto");
      const metadataPromptVersionCustom = normalizeShortString(getRuntimeAwareOption("metadataPromptVersion", "v1"), 48);
      const metadataPromptVersion = metadataPromptVersionMode === "off"
        ? ""
        : metadataPromptVersionMode === "custom"
          ? metadataPromptVersionCustom
          : autoPromptVersion;

      const metadataFrontendBuildMode = normalizeOptionalTextMode(getRuntimeAwareOption("metadataFrontendBuildMode", "auto"), "auto");
      const metadataFrontendBuildCustom = normalizeShortString(getRuntimeAwareOption("metadataFrontendBuild", ""), 64);
      const metadataFrontendBuild = metadataFrontendBuildMode === "off"
        ? ""
        : metadataFrontendBuildMode === "custom"
          ? metadataFrontendBuildCustom
          : normalizeShortString(globalThis?.__SPECFORGE_BUILD__ || "web", 64);

      const includeSize = include.length;
      const effortRank = Math.max(0, reasoningEffortRank(reasoningEffort));
      const profileCost = runtimeSelectedProfile === "spec_strict" || runtimeSelectedProfile === "accurate"
        ? 2
        : runtimeSelectedProfile === "source_audit" || runtimeSelectedProfile === "research"
          ? 1
          : 0;
      const resourceScore = effortRank
        + (reasoningDepth === "deep" ? 2 : reasoningDepth === "balanced" ? 1 : 0)
        + (reasoningVerify === "strict" ? 2 : reasoningVerify === "basic" ? 1 : 0)
        + (structuredSpecOutput ? 2 : 0)
        + (payload.background ? 1 : 0)
        + (reasoningMaxTokens >= 16000 ? 2 : reasoningMaxTokens >= 8000 ? 1 : 0)
        + (includeSize > 0 ? 1 : 0)
        + profileCost;
      const resourceTier = resourceScore >= 10 ? "high" : resourceScore >= 6 ? "medium" : "low";

      const metadata = {};
      const pushMeta = (key, value, maxLen = 96) => {
        if (!key || Object.keys(metadata).length >= 16) return;
        const clean = normalizeShortString(value, maxLen);
        if (!clean) return;
        metadata[key] = clean;
      };
      pushMeta("profile_mode", effectiveProfileMode || "auto", 32);
      pushMeta("profile_selected", runtimeSelectedProfile || "", 32);
      pushMeta("depth", reasoningDepth, 16);
      pushMeta("verify", reasoningVerify, 16);
      pushMeta("summary", reasoningSummary || "off", 16);
      pushMeta("service_tier_req", serviceTier, 16);
      pushMeta("prompt_version", metadataPromptVersion, 48);
      pushMeta("frontend_build", metadataFrontendBuild, 64);
      pushMeta("turn_id", options?.turnId || this._app.ai.turnId || "", 80);
      pushMeta("background", payload.background ? "on" : "off", 8);
      pushMeta("stream_mode", this._app.ai.streaming === false ? "json" : "stream", 12);
      pushMeta("compat_cache", boolOption(getRuntimeAwareOption("compatCache", true), true) ? "on" : "off", 8);
      pushMeta("resource_tier", resourceTier, 12);
      pushMeta("resource_score", String(resourceScore), 8);
      pushMeta("prompt_cache", promptCacheKey ? "on" : "off", 8);
      if (options?.previousResponseId) pushMeta("continuation", "yes", 8);
      if (Object.keys(metadata).length) payload.metadata = metadata;
    }

    const previousResponseId = String(options?.previousResponseId || "").trim();
    if (previousResponseId) payload.previous_response_id = previousResponseId;
    if (!previousResponseId) {
      const instructions = String(options?.instructions || "").trim();
      if (instructions) payload.instructions = instructions;
    }
    if (options?.input !== undefined) payload.input = options.input;
    return payload;
  }
}
