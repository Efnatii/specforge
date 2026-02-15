import { AppAgentFoundationCompositionModule } from "./agent-foundation.js";
import { AppAgentRuntimeCompositionModule } from "./agent-runtime.js";

export class AppAgentCompositionModule {
  constructor({
    config,
    dom,
    windowRef,
  }) {
    if (!config) throw new Error("AppAgentCompositionModule requires config");
    if (!dom) throw new Error("AppAgentCompositionModule requires dom");
    if (!windowRef) throw new Error("AppAgentCompositionModule requires windowRef");
    this._config = config;
    this._dom = dom;
    this._window = windowRef;
  }

  compose({ core, journal, uiBase }) {
    if (!core) throw new Error("AppAgentCompositionModule.compose requires core");
    if (!journal) throw new Error("AppAgentCompositionModule.compose requires journal");
    if (!uiBase) throw new Error("AppAgentCompositionModule.compose requires uiBase");

    const foundation = new AppAgentFoundationCompositionModule({
      config: this._config,
      dom: this._dom,
      windowRef: this._window,
    }).compose({ core, journal });

    const { agentPromptModule } = new AppAgentRuntimeCompositionModule({
      config: this._config,
      dom: this._dom,
      windowRef: this._window,
    }).compose({
      core,
      journal,
      uiBase,
      foundation,
    });

    const { agentAttachmentModule, applyAgentSheetOverrides } = foundation;
    return {
      agentAttachmentModule,
      agentPromptModule,
      applyAgentSheetOverrides,
    };
  }
}
