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
    AI_CONTINUE_PROMPT_RE,
    AI_SHORT_ACK_PROMPT_RE,
    AI_MUTATION_INTENT_RE,
    AI_ACTIONABLE_VERB_RE,
    AI_TOOL_NAME_HINTS,
  } = config;

  const {
    addChangesJournal,
    activeSheet,
    selectionText,
    toA1,
    colToName,
    agentCellValueText,
    summarizeChatChunk,
    mergeChatSummary,
  } = deps;

  if (!Number.isFinite(CHAT_CONTEXT_RECENT_MESSAGES) || CHAT_CONTEXT_RECENT_MESSAGES < 1) {
    throw new Error("AgentRuntimePromptModule requires config.CHAT_CONTEXT_RECENT_MESSAGES");
  }
  if (!(AI_CONTINUE_PROMPT_RE instanceof RegExp)) throw new Error("AgentRuntimePromptModule requires config.AI_CONTINUE_PROMPT_RE");
  if (!(AI_SHORT_ACK_PROMPT_RE instanceof RegExp)) throw new Error("AgentRuntimePromptModule requires config.AI_SHORT_ACK_PROMPT_RE");
  if (!(AI_MUTATION_INTENT_RE instanceof RegExp)) throw new Error("AgentRuntimePromptModule requires config.AI_MUTATION_INTENT_RE");
  if (!(AI_ACTIONABLE_VERB_RE instanceof RegExp)) throw new Error("AgentRuntimePromptModule requires config.AI_ACTIONABLE_VERB_RE");
  if (!Array.isArray(AI_TOOL_NAME_HINTS)) throw new Error("AgentRuntimePromptModule requires config.AI_TOOL_NAME_HINTS");

  if (typeof addChangesJournal !== "function") throw new Error("AgentRuntimePromptModule requires deps.addChangesJournal()");
  if (typeof activeSheet !== "function") throw new Error("AgentRuntimePromptModule requires deps.activeSheet()");
  if (typeof selectionText !== "function") throw new Error("AgentRuntimePromptModule requires deps.selectionText()");
  if (typeof toA1 !== "function") throw new Error("AgentRuntimePromptModule requires deps.toA1()");
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
      addChangesJournal("ai.prompt.continue", "Использована последняя задача", { meta: { task: lastTask.slice(0, 220) } });
      return {
        text: `Продолжи и заверши предыдущую задачу пользователя без уточнений и без вопросов: ${lastTask}`,
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

  function buildChatHistoryContext(maxMessages = CHAT_CONTEXT_RECENT_MESSAGES, maxChars = 12000) {
    const src = Array.isArray(app.ai.chatJournal) ? app.ai.chatJournal : [];
    if (!src.length) return "";

    const olderCount = Math.max(0, src.length - maxMessages);
    const summaryStart = Math.min(app.ai.chatSummaryCount, olderCount);
    const remainder = src.slice(summaryStart, olderCount);

    let summary = String(app.ai.chatSummary || "").trim();
    if (remainder.length) {
      const remainderSummary = summarizeChatChunk(remainder);
      summary = mergeChatSummary(summary, remainderSummary);
    }

    const recent = src.slice(-maxMessages);
    const lines = [];
    if (summary) lines.push(`summary: ${summary}`);

    for (const item of recent) {
      const kind = String(item?.kind || "").trim();
      const text = String(item?.text || "").replace(/\s+/g, " ").trim();
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
    const s = activeSheet();

    if (app.ai.options.currentSheet && s) {
      out.push(`Текущий лист (${s.name}, id=${s.id}):\n${serializeSheetPreview(s, 40, 12, 10000)}`);
    }

    if (app.ai.options.allSheets) {
      const blocks = app.workbook.sheets.map((sh) => {
        const preview = serializeSheetPreview(sh, 18, 10, 2200);
        return `Лист ${sh.name} (id=${sh.id}, строк=${sh.rows.length}, колонок=${sh.cols.length}):\n${preview}`;
      });
      out.push(`Все листы:\n${blocks.join("\n\n")}`);
    }

    const sel = app.ui.selection;
    if (app.ai.options.selection && sel && s && sel.sheet === s.id) {
      const r1 = Math.min(sel.sr, sel.er);
      const r2 = Math.max(sel.sr, sel.er);
      const c1 = Math.min(sel.sc, sel.ec);
      const c2 = Math.max(sel.sc, sel.ec);
      out.push(`Выделение ${toA1(r1, c1)}:${toA1(r2, c2)} на листе ${s.name}:\n${selectionText(s, sel)}`);
    }

    if (app.ai.attachments.length) {
      const files = app.ai.attachments.map((f) => {
        if (f.text) {
          const tail = f.truncated ? "\n[обрезано]" : "";
          return `Файл: ${f.name} (${f.size} байт)\n${f.text}${tail}`;
        }
        return `Файл: ${f.name} (${f.size} байт), тип: ${f.type}`;
      });
      out.push(`Прикрепленные файлы:\n${files.join("\n\n")}`);
    }

    return out.join("\n\n").slice(0, 120000);
  }

  function buildAgentInput(userText) {
    const parts = [];
    const chatCtx = buildChatHistoryContext();
    if (chatCtx) parts.push(`История диалога:\n${chatCtx}`);

    parts.push(`Текущий запрос пользователя:\n${userText}`);

    const ctx = buildAgentContextText();
    if (ctx) parts.push(`Контекст проекта:\n${ctx}`);

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
