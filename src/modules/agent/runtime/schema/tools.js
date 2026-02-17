import { AgentRuntimeAssemblyToolSchemaModule } from "./assembly.js";
import { AgentRuntimePositionToolSchemaModule } from "./position.js";
import { AgentRuntimeSheetToolSchemaModule } from "./sheet.js";
import { AgentRuntimeStateToolSchemaModule } from "./state.js";

export class AgentRuntimeToolSchemaModule {
  constructor(ctx) {
    Object.assign(this, createAgentRuntimeToolSchemaInternal(ctx));
  }
}

function createAgentRuntimeToolSchemaInternal(ctx) {
  const { app } = ctx || {};
  if (!app) throw new Error("AgentRuntimeToolSchemaModule requires app");

  const sheetSchemaFacade = new AgentRuntimeSheetToolSchemaModule({});
  const assemblySchemaFacade = new AgentRuntimeAssemblyToolSchemaModule({});
  const positionSchemaFacade = new AgentRuntimePositionToolSchemaModule({});
  const stateSchemaFacade = new AgentRuntimeStateToolSchemaModule({});

  function verificationParam() {
    return {
      type: "object",
      properties: {
        query: { type: "string", description: "Поисковый запрос для web_search (обязателен для web-подтверждения)" },
        sources: {
          type: "array",
          description: "Ссылки из web_search, подтверждающие позицию (для web-подтверждения минимум 2 URL)",
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              url: { type: "string" },
            },
            required: ["url"],
            additionalProperties: false,
          },
        },
        attachments: {
          type: "array",
          description: "Подтверждение из прикрепленных файлов/документов (используй id/name существующих attachments)",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              name: { type: "string" },
              excerpt: { type: "string" },
            },
            additionalProperties: false,
          },
        },
        notes: { type: "string", description: "Краткая заметка о проверке источников" },
      },
      additionalProperties: false,
    };
  }

  function normalizeWebSearchCountry(value, fallback = "RU") {
    const raw = String(value || "").trim().toUpperCase();
    if (/^[A-Z]{2}$/.test(raw)) return raw;
    const fb = String(fallback || "").trim().toUpperCase();
    return /^[A-Z]{2}$/.test(fb) ? fb : "RU";
  }

  function normalizeWebSearchContextSize(value, fallback = "high") {
    const raw = String(value || "").trim().toLowerCase();
    if (raw === "low" || raw === "medium" || raw === "high") return raw;
    const fb = String(fallback || "").trim().toLowerCase();
    if (fb === "low" || fb === "medium" || fb === "high") return fb;
    return "high";
  }

  function agentToolsSpec() {
    const verifySchema = verificationParam();
    const allowQuestions = app?.ai?.options?.allowQuestions !== false;
    const tools = [
      ...sheetSchemaFacade.buildSheetNavigationTools(),
      ...(allowQuestions ? stateSchemaFacade.buildInteractionTools() : []),
      ...stateSchemaFacade.buildAttachmentTools(),
      ...assemblySchemaFacade.buildAssemblyCoreTools(),
      ...stateSchemaFacade.buildSettingsTools(),
      ...assemblySchemaFacade.buildAssemblyManagementTools(),
      ...positionSchemaFacade.buildPositionTools(verifySchema),
      ...sheetSchemaFacade.buildSheetRangeTools(verifySchema),
      ...stateSchemaFacade.buildStatePathTools(verifySchema),
    ];

    if (app.ai.options.webSearch) {
      tools.push({
        type: "web_search",
        user_location: {
          type: "approximate",
          country: normalizeWebSearchCountry(app?.ai?.options?.webSearchCountry, "RU"),
        },
        search_context_size: normalizeWebSearchContextSize(app?.ai?.options?.webSearchContextSize, "high"),
      });
      tools.push({
        type: "computer_use_preview",
        display_width: 1366,
        display_height: 768,
        environment: "browser",
      });
    }

    const hasAttachments = Array.isArray(app?.ai?.attachments) && app.ai.attachments.length > 0;
    const vectorStoreId = String(app?.ai?.fileSearch?.vectorStoreId || "").trim();
    if (hasAttachments && vectorStoreId) {
      tools.push({
        type: "file_search",
        vector_store_ids: [vectorStoreId],
        max_num_results: 8,
      });
    }
    return tools;
  }

  return { agentToolsSpec };
}
