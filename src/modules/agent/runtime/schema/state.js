export class AgentRuntimeStateToolSchemaModule {
  constructor(ctx) {
    Object.assign(this, createAgentRuntimeStateToolSchemaInternal(ctx));
  }
}

function createAgentRuntimeStateToolSchemaInternal(ctx) {
  void ctx;

  function buildSettingsTools() {
    return [
      {
        type: "function",
        name: "read_settings",
        description: "Прочитать общие настройки проекта",
        parameters: {
          type: "object",
          properties: {},
          additionalProperties: false,
        },
      },
      {
        type: "function",
        name: "update_settings",
        description: "Изменить общие настройки проекта",
        parameters: {
          type: "object",
          properties: {
            order_number: { type: "string" },
            request_number: { type: "string" },
            change_date: { type: "string" },
            version: { type: "string" },
            vat_rate: { type: "number" },
            total_mode: { type: "string", enum: ["withoutDiscount", "withDiscount"] },
          },
          additionalProperties: false,
        },
      },
    ];
  }

  function buildStatePathTools(verificationParam) {
    return [
      {
        type: "function",
        name: "get_state",
        description: "Получить состояние проекта или путь внутри него",
        parameters: {
          type: "object",
          properties: {
            path: { type: "string", description: "Пример: assemblies[0].main[1].name" },
          },
          additionalProperties: false,
        },
      },
      {
        type: "function",
        name: "set_state_value",
        description: "Изменить значение в состоянии проекта по пути. value_json должен быть валидным JSON (например: 123, \"text\", true, null, {\"a\":1}, [1,2]).",
        parameters: {
          type: "object",
          properties: {
            path: { type: "string" },
            value_json: { type: "string" },
            verification: verificationParam,
          },
          required: ["path", "value_json"],
          additionalProperties: false,
        },
      },
    ];
  }

  return {
    buildSettingsTools,
    buildStatePathTools,
  };
}
