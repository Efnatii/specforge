export class AgentRuntimeSheetToolSchemaModule {
  constructor(ctx) {
    Object.assign(this, createAgentRuntimeSheetToolSchemaInternal(ctx));
  }
}

function createAgentRuntimeSheetToolSchemaInternal(ctx) {
  void ctx;

  function buildSheetNavigationTools() {
    return [
      {
        type: "function",
        name: "list_sheets",
        description: "Вернуть список листов текущей таблицы",
        parameters: {
          type: "object",
          properties: {},
          additionalProperties: false,
        },
      },
      {
        type: "function",
        name: "set_active_sheet",
        description: "Переключить активный лист таблицы",
        parameters: {
          type: "object",
          properties: {
            sheet_id: { type: "string" },
            sheet_name: { type: "string" },
          },
          additionalProperties: false,
        },
      },
    ];
  }

  function buildSheetRangeTools(verificationParam) {
    return [
      {
        type: "function",
        name: "read_range",
        description: "Прочитать диапазон ячеек с листа",
        parameters: {
          type: "object",
          properties: {
            sheet_id: { type: "string" },
            sheet_name: { type: "string" },
            range: { type: "string", description: "A1 или A1:C20" },
            include_formulas: { type: "boolean" },
          },
          additionalProperties: false,
        },
      },
      {
        type: "function",
        name: "write_cells",
        description: "Записать значения в ячейки листа",
        parameters: {
          type: "object",
          properties: {
            sheet_id: { type: "string" },
            sheet_name: { type: "string" },
            updates: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  address: { type: "string", description: "A1" },
                  value: { type: ["string", "number", "boolean", "null"] },
                  formula: { type: "string" },
                },
                required: ["address"],
                additionalProperties: false,
              },
            },
            verification: verificationParam,
          },
          required: ["updates"],
          additionalProperties: false,
        },
      },
      {
        type: "function",
        name: "clear_range",
        description: "Очистить значения/формулы в диапазоне листа",
        parameters: {
          type: "object",
          properties: {
            sheet_id: { type: "string" },
            sheet_name: { type: "string" },
            range: { type: "string", description: "A1 или A1:C20" },
          },
          required: ["range"],
          additionalProperties: false,
        },
      },
      {
        type: "function",
        name: "clear_sheet_overrides",
        description: "Очистить AI-изменения на листе или во всей таблице",
        parameters: {
          type: "object",
          properties: {
            sheet_id: { type: "string" },
            all: { type: "boolean" },
          },
          additionalProperties: false,
        },
      },
      {
        type: "function",
        name: "get_selection",
        description: "Получить текущую выделенную область пользователя",
        parameters: {
          type: "object",
          properties: {},
          additionalProperties: false,
        },
      },
    ];
  }

  return {
    buildSheetNavigationTools,
    buildSheetRangeTools,
  };
}
