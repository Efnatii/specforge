import { AppCoreCompositionModule } from "./core.js";
import { AppJournalCompositionModule } from "./journal.js";
import { AppUiBaseCompositionModule } from "./ui-base.js";
import { AppUiLifecycleCompositionModule } from "./ui-lifecycle.js";
import { AppAgentCompositionModule } from "./agent.js";

export class AppCompositionModule {
  constructor({
    dom,
    config,
    windowRef,
    documentRef,
    fetchFn,
  }) {
    if (!dom) throw new Error("AppCompositionModule requires dom");
    if (!config) throw new Error("AppCompositionModule requires config");
    if (!windowRef) throw new Error("AppCompositionModule requires windowRef");
    if (!documentRef) throw new Error("AppCompositionModule requires documentRef");
    if (typeof fetchFn !== "function") throw new Error("AppCompositionModule requires fetchFn()");

    this._dom = dom;
    this._config = config;
    this._window = windowRef;
    this._document = documentRef;
    this._fetch = fetchFn;
  }

  async start() {
    const core = new AppCoreCompositionModule({
      dom: this._dom,
      config: this._config,
      windowRef: this._window,
      documentRef: this._document,
      fetchFn: (...args) => this._fetch(...args),
    }).compose();

    const journal = new AppJournalCompositionModule({
      config: this._config,
      dom: this._dom,
    }).compose({
      app: core.app,
      projectMutationModule: core.projectMutationModule,
      appFormattingModule: core.appFormattingModule,
      appIdentityModule: core.appIdentityModule,
    });

    const uiBase = new AppUiBaseCompositionModule({
      dom: this._dom,
      config: this._config,
      windowRef: this._window,
      documentRef: this._document,
      fetchFn: (...args) => this._fetch(...args),
    }).compose({ core, journal });

    const agent = new AppAgentCompositionModule({
      config: this._config,
      dom: this._dom,
      windowRef: this._window,
    }).compose({ core, journal, uiBase });

    const { appBootstrapModule } = new AppUiLifecycleCompositionModule({
      dom: this._dom,
      windowRef: this._window,
      documentRef: this._document,
    }).compose({
      core,
      journal,
      uiBase,
      agent,
    });

    try {
      await appBootstrapModule.start({
        templatePath: this._config.templateReportPath,
        stylePath: this._config.templateStylesPath,
      });
    } catch (err) {
      console.error(err);
      core.toastModule.show("Ошибка загрузки шаблона");
      throw err;
    }

    return { app: core.app };
  }
}
