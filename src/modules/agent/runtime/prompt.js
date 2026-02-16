export class AgentRuntimePromptModule {
  constructor(ctx) {
    Object.assign(this, createAgentRuntimePromptInternal(ctx));
  }
}

function createAgentRuntimePromptInternal(ctx) {
  const { app, config, deps } = ctx || {};
  if (!app) throw new Error("AgentRuntimePromptModule requires app");
  if (!config) throw new Error("AgentRuntimePromptModule requires config");
  if (!deps) throw new Error("AgentRuntimePromptModule requires deps");

  const {
    CHAT_CONTEXT_RECENT_MESSAGES,
    CHAT_CONTEXT_MAX_CHARS,
    CHAT_CONTEXT_MESSAGE_MAX_CHARS,
    CHAT_SUMMARY_CHUNK_SIZE,
    AI_CONTINUE_PROMPT_RE,
    AI_SHORT_ACK_PROMPT_RE,
    AI_MUTATION_INTENT_RE,
    AI_ACTIONABLE_VERB_RE,
    AI_TOOL_NAME_HINTS,
  } = config;

  const {
    addChangesJournal,
    colToName,
    agentCellValueText,
    summarizeChatChunk,
    mergeChatSummary,
  } = deps;

  if (!Number.isFinite(CHAT_CONTEXT_RECENT_MESSAGES) || CHAT_CONTEXT_RECENT_MESSAGES < 1) {
    throw new Error("AgentRuntimePromptModule requires config.CHAT_CONTEXT_RECENT_MESSAGES");
  }
  if (!Number.isFinite(CHAT_CONTEXT_MAX_CHARS) || CHAT_CONTEXT_MAX_CHARS < 2000) {
    throw new Error("AgentRuntimePromptModule requires config.CHAT_CONTEXT_MAX_CHARS");
  }
  if (!Number.isFinite(CHAT_CONTEXT_MESSAGE_MAX_CHARS) || CHAT_CONTEXT_MESSAGE_MAX_CHARS < 200) {
    throw new Error("AgentRuntimePromptModule requires config.CHAT_CONTEXT_MESSAGE_MAX_CHARS");
  }
  if (!Number.isFinite(CHAT_SUMMARY_CHUNK_SIZE) || CHAT_SUMMARY_CHUNK_SIZE < 1) {
    throw new Error("AgentRuntimePromptModule requires config.CHAT_SUMMARY_CHUNK_SIZE");
  }
  if (!(AI_CONTINUE_PROMPT_RE instanceof RegExp)) throw new Error("AgentRuntimePromptModule requires config.AI_CONTINUE_PROMPT_RE");
  if (!(AI_SHORT_ACK_PROMPT_RE instanceof RegExp)) throw new Error("AgentRuntimePromptModule requires config.AI_SHORT_ACK_PROMPT_RE");
  if (!(AI_MUTATION_INTENT_RE instanceof RegExp)) throw new Error("AgentRuntimePromptModule requires config.AI_MUTATION_INTENT_RE");
  if (!(AI_ACTIONABLE_VERB_RE instanceof RegExp)) throw new Error("AgentRuntimePromptModule requires config.AI_ACTIONABLE_VERB_RE");
  if (!Array.isArray(AI_TOOL_NAME_HINTS)) throw new Error("AgentRuntimePromptModule requires config.AI_TOOL_NAME_HINTS");

  if (typeof addChangesJournal !== "function") throw new Error("AgentRuntimePromptModule requires deps.addChangesJournal()");
  if (typeof colToName !== "function") throw new Error("AgentRuntimePromptModule requires deps.colToName()");
  if (typeof agentCellValueText !== "function") throw new Error("AgentRuntimePromptModule requires deps.agentCellValueText()");
  if (typeof summarizeChatChunk !== "function") throw new Error("AgentRuntimePromptModule requires deps.summarizeChatChunk()");
  if (typeof mergeChatSummary !== "function") throw new Error("AgentRuntimePromptModule requires deps.mergeChatSummary()");

  function isActionableAgentPrompt(textRaw) {
    const text = String(textRaw || "").trim();
    if (!text) return false;
    if (AI_MUTATION_INTENT_RE.test(text) || AI_ACTIONABLE_VERB_RE.test(text)) return true;
    const lower = text.toLowerCase();
    return AI_TOOL_NAME_HINTS.some((tool) => lower.includes(tool));
  }

  function normalizeAgentPrompt(rawText) {
    const text = String(rawText || "").trim();
    if (!text) return { text: "", actionable: false, mode: "empty", usedPendingTask: false };

    const lastTask = String(app.ai.pendingTask || app.ai.lastActionablePrompt || app.ai.lastTaskPrompt || "").trim();
    const wantsContinue = AI_CONTINUE_PROMPT_RE.test(text) || AI_SHORT_ACK_PROMPT_RE.test(text);
    if (wantsContinue && lastTask) {
      addChangesJournal("ai.prompt.continue", "Used previous task", { meta: { task: lastTask.slice(0, 220) } });
      return {
        text: `Continue and finish the previous user task without clarifications and questions: ${lastTask}`,
        basePrompt: lastTask,
        actionable: true,
        mode: "continue-last-task",
        usedPendingTask: true,
      };
    }

    const actionable = isActionableAgentPrompt(text);
    return {
      text,
      basePrompt: text,
      actionable,
      mode: actionable ? "actionable" : "plain",
      usedPendingTask: false,
    };
  }

  function buildChatHistoryContext(maxMessages = CHAT_CONTEXT_RECENT_MESSAGES, maxChars = CHAT_CONTEXT_MAX_CHARS) {
    const src = Array.isArray(app.ai.chatJournal) ? app.ai.chatJournal : [];
    if (!src.length) return "";

    const olderCount = Math.max(0, src.length - maxMessages);
    const summaryStart = Math.min(app.ai.chatSummaryCount, olderCount);
    const remainder = src.slice(summaryStart, olderCount);

    let summary = String(app.ai.chatSummary || "").trim();
    if (remainder.length) {
      for (let i = 0; i < remainder.length; i += CHAT_SUMMARY_CHUNK_SIZE) {
        const chunk = remainder.slice(i, i + CHAT_SUMMARY_CHUNK_SIZE);
        const remainderSummary = summarizeChatChunk(chunk);
        summary = mergeChatSummary(summary, remainderSummary);
      }
    }

    const recent = src.slice(-maxMessages);
    const lines = [];
    if (summary) lines.push(`summary: ${summary}`);

    for (const item of recent) {
      const kind = String(item?.kind || "").trim();
      const rawText = String(item?.text || "").replace(/\s+/g, " ").trim();
      const text = rawText.length > CHAT_CONTEXT_MESSAGE_MAX_CHARS
        ? `${rawText.slice(0, CHAT_CONTEXT_MESSAGE_MAX_CHARS)}...`
        : rawText;
      if (!text) continue;
      const role = kind === "AI" ? "assistant" : "user";
      lines.push(`${role}: ${text}`);
    }

    return lines.join("\n").slice(0, maxChars);
  }

  function serializeSheetPreview(sheet, maxRows = 40, maxCols = 12, maxChars = 10000) {
    const rows = Math.min(maxRows, sheet.rows.length);
    const cols = Math.min(maxCols, sheet.cols.length);
    const lines = [];
    lines.push(new Array(cols).fill(0).map((_, i) => colToName(i + 1)).join("\t"));

    for (let r = 1; r <= rows; r += 1) {
      const vals = [];
      for (let c = 1; c <= cols; c += 1) {
        const cell = sheet.rows[r - 1]?.cells[c - 1];
        vals.push(agentCellValueText(cell));
      }
      lines.push(vals.join("\t"));
      if (lines.join("\n").length > maxChars) break;
    }
    return lines.join("\n").slice(0, maxChars);
  }

  function buildAgentContextText() {
    const out = [];

    if (app.ai.attachments.length) {
      const files = app.ai.attachments.map((f) => {
        const parser = String(f?.parser || "");
        const parseError = String(f?.parse_error || "").trim();
        const textChars = String(f?.text || "").length;
        const details = [];
        details.push(`id=${String(f?.id || "")}`);
        details.push(`size=${String(f?.size || 0)} bytes`);
        details.push(`type=${String(f?.type || "application/octet-stream")}`);
        details.push(`text=${textChars > 0 ? `${textChars} chars` : "unavailable"}`);
        if (parser) details.push(`parser=${parser}`);
        if (f?.truncated) details.push("truncated");
        if (parseError) details.push(`parse_error=${parseError.slice(0, 120)}`);
        return `- ${String(f?.name || "file")} (${details.join(", ")})`;
      });
      out.push(`Attached files:\n${files.join("\n")}\nUse list_attachments/read_attachment tools to inspect contents.`);
    }
    return out.join("\n\n").slice(0, 120000);
  }

  function buildAgentInput(userText) {
    const parts = [];
    const chatCtx = buildChatHistoryContext();
    if (chatCtx) parts.push(`Conversation history:\n${chatCtx}`);

    parts.push(`Current user request:\n${userText}`);

    const ctx = buildAgentContextText();
    if (ctx) parts.push(`Project context:\n${ctx}`);

    return parts.join("\n\n");
  }

  return {
    normalizeAgentPrompt,
    isActionableAgentPrompt,
    buildAgentInput,
    buildChatHistoryContext,
    buildAgentContextText,
    serializeSheetPreview,
  };
}
