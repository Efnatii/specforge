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
        query: { type: "string", description: "Поисковый запрос (если подтверждение через web_search)" },
        sources: {
          type: "array",
          description: "Ссылки из web_search, подтверждающие существование товара",
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
          description: "Подтверждение из прикрепленных файлов/документов",
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
        notes: { type: "string" },
      },
      additionalProperties: false,
    };
  }

  function agentToolsSpec() {
    const verifySchema = verificationParam();
    const tools = [
      ...sheetSchemaFacade.buildSheetNavigationTools(),
      ...assemblySchemaFacade.buildAssemblyCoreTools(),
      ...stateSchemaFacade.buildSettingsTools(),
      ...assemblySchemaFacade.buildAssemblyManagementTools(),
      ...positionSchemaFacade.buildPositionTools(verifySchema),
      ...sheetSchemaFacade.buildSheetRangeTools(verifySchema),
      ...stateSchemaFacade.buildStatePathTools(verifySchema),
    ];

    if (app.ai.options.webSearch) tools.push({ type: "web_search_preview" });
    return tools;
  }

  return { agentToolsSpec };
}
