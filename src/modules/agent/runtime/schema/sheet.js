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
        name: "find_cells",
        description: "Найти ячейки по текстовому запросу на листе или в диапазоне",
        parameters: {
          type: "object",
          properties: {
            sheet_id: { type: "string" },
            sheet_name: { type: "string" },
            query: { type: "string", description: "Текст для поиска" },
            range: { type: "string", description: "A1:C50 (опционально)" },
            match_case: { type: "boolean" },
            in_formulas: { type: "boolean", description: "Искать также внутри формул" },
            max_results: { type: "number", description: "Максимум результатов (1..500)" },
          },
          required: ["query"],
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
        name: "write_matrix",
        description: "Записать прямоугольную матрицу значений, начиная с ячейки start_address",
        parameters: {
          type: "object",
          properties: {
            sheet_id: { type: "string" },
            sheet_name: { type: "string" },
            start_address: { type: "string", description: "Левая верхняя ячейка, например B3" },
            values: {
              type: "array",
              items: {
                type: "array",
                items: { type: ["string", "number", "boolean", "null"] },
              },
            },
            verification: verificationParam,
          },
          required: ["start_address", "values"],
          additionalProperties: false,
        },
      },
      {
        type: "function",
        name: "copy_range",
        description: "Скопировать диапазон из source_range в target_start на том же или другом листе",
        parameters: {
          type: "object",
          properties: {
            source_sheet_id: { type: "string" },
            source_sheet_name: { type: "string" },
            source_range: { type: "string", description: "A1:C20" },
            target_sheet_id: { type: "string" },
            target_sheet_name: { type: "string" },
            target_start: { type: "string", description: "Левая верхняя ячейка назначения, например E5" },
            include_values: { type: "boolean", description: "Копировать значения (по умолчанию true)" },
            include_formulas: { type: "boolean", description: "Копировать формулы (по умолчанию true)" },
            skip_empty: { type: "boolean", description: "Пропускать полностью пустые ячейки (по умолчанию true)" },
            verification: verificationParam,
          },
          required: ["source_range", "target_start"],
          additionalProperties: false,
        },
      },
      {
        type: "function",
        name: "fill_range",
        description: "Заполнить диапазон одним значением или формулой",
        parameters: {
          type: "object",
          properties: {
            sheet_id: { type: "string" },
            sheet_name: { type: "string" },
            range: { type: "string", description: "A1:C20" },
            value: { type: ["string", "number", "boolean", "null"] },
            formula: { type: "string", description: "Формула для всех ячеек диапазона" },
            verification: verificationParam,
          },
          required: ["range"],
          additionalProperties: false,
        },
      },
      {
        type: "function",
        name: "replace_in_range",
        description: "Поиск и замена текста в значениях/формулах диапазона",
        parameters: {
          type: "object",
          properties: {
            sheet_id: { type: "string" },
            sheet_name: { type: "string" },
            range: { type: "string", description: "A1:C20 (опционально, по умолчанию весь лист)" },
            search: { type: "string", description: "Что искать" },
            replace: { type: "string", description: "На что заменить" },
            match_case: { type: "boolean" },
            whole_cell: { type: "boolean", description: "Заменять только полное совпадение" },
            in_formulas: { type: "boolean", description: "Выполнять замену и в формулах" },
            max_changes: { type: "number", description: "Максимум изменений за вызов (1..6000)" },
            verification: verificationParam,
          },
          required: ["search"],
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
