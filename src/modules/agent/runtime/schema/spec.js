import { AgentRuntimeSystemPromptModule } from "./system.js";
import { AgentRuntimeToolSchemaModule } from "./tools.js";

export class AgentRuntimeToolSpecModule {
  constructor(ctx) {
    Object.assign(this, createAgentRuntimeToolSpecInternal(ctx));
  }
}

function createAgentRuntimeToolSpecInternal(ctx) {
  const { app } = ctx || {};
  if (!app) throw new Error("AgentRuntimeToolSpecModule requires app");

  const systemPromptFacade = new AgentRuntimeSystemPromptModule({ app });
  const toolSchemaFacade = new AgentRuntimeToolSchemaModule({ app });

  return {
    agentSystemPrompt: systemPromptFacade.agentSystemPrompt,
    agentToolsSpec: toolSchemaFacade.agentToolsSpec,
  };
}
