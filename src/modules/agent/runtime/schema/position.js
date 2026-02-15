export class AgentRuntimePositionToolSchemaModule {
  constructor(ctx) {
    Object.assign(this, createAgentRuntimePositionToolSchemaInternal(ctx));
  }
}

function createAgentRuntimePositionToolSchemaInternal(ctx) {
  void ctx;

  function buildPositionTools(verificationParam) {
    return [
      {
        type: "function",
        name: "list_positions",
        description: "Список позиций выбранной сборки",
        parameters: {
          type: "object",
          properties: {
            assembly_id: { type: "string" },
            assembly_name: { type: "string" },
            list: { type: "string", enum: ["main", "consumable"], description: "main или consumable" },
            include_details: { type: "boolean" },
          },
          additionalProperties: false,
        },
      },
      {
        type: "function",
        name: "add_position",
        description: "Добавить позицию в сборку",
        parameters: {
          type: "object",
          properties: {
            assembly_id: { type: "string", description: "ID сборки" },
            assembly_name: { type: "string", description: "Имя или аббревиатура сборки" },
            list: { type: "string", enum: ["main", "consumable"], description: "main или consumable" },
            name: { type: "string", description: "Наименование позиции" },
            qty: { type: "number", description: "Количество" },
            unit: { type: "string", description: "Ед. изм., например шт" },
            manufacturer: { type: "string" },
            article: { type: "string" },
            schematic: { type: "string" },
            supplier: { type: "string" },
            note: { type: "string" },
            price_catalog_vat_markup: { type: "number", description: "Цена каталожная без НДС" },
            markup: { type: "number", description: "Наценка (0..1 или 0..100)" },
            discount: { type: "number", description: "Скидка (0..1 или 0..100)" },
            verification: verificationParam,
          },
          required: ["name", "verification"],
          additionalProperties: false,
        },
      },
      {
        type: "function",
        name: "read_position",
        description: "Прочитать одну позицию по ID",
        parameters: {
          type: "object",
          properties: {
            assembly_id: { type: "string" },
            assembly_name: { type: "string" },
            list: { type: "string", enum: ["main", "consumable", "project"] },
            position_id: { type: "string" },
          },
          required: ["position_id"],
          additionalProperties: false,
        },
      },
      {
        type: "function",
        name: "update_position",
        description: "Изменить позицию внутри сборки",
        parameters: {
          type: "object",
          properties: {
            assembly_id: { type: "string" },
            assembly_name: { type: "string" },
            list: { type: "string", enum: ["main", "consumable"], description: "main или consumable" },
            position_id: { type: "string" },
            name: { type: "string" },
            qty: { type: "number" },
            unit: { type: "string" },
            manufacturer: { type: "string" },
            article: { type: "string" },
            schematic: { type: "string" },
            supplier: { type: "string" },
            note: { type: "string" },
            price_catalog_vat_markup: { type: "number" },
            markup: { type: "number" },
            discount: { type: "number" },
            verification: verificationParam,
          },
          required: ["position_id"],
          additionalProperties: false,
        },
      },
      {
        type: "function",
        name: "delete_position",
        description: "Удалить позицию из сборки",
        parameters: {
          type: "object",
          properties: {
            assembly_id: { type: "string" },
            assembly_name: { type: "string" },
            list: { type: "string", enum: ["main", "consumable"], description: "main или consumable" },
            position_id: { type: "string" },
          },
          required: ["position_id"],
          additionalProperties: false,
        },
      },
      {
        type: "function",
        name: "duplicate_position",
        description: "Дублировать позицию в сборке или проектных расходниках",
        parameters: {
          type: "object",
          properties: {
            assembly_id: { type: "string" },
            assembly_name: { type: "string" },
            list: { type: "string", enum: ["main", "consumable", "project"] },
            position_id: { type: "string" },
          },
          required: ["position_id"],
          additionalProperties: false,
        },
      },
      {
        type: "function",
        name: "add_project_position",
        description: "Добавить позицию в проектные расходники",
        parameters: {
          type: "object",
          properties: {
            name: { type: "string" },
            qty: { type: "number" },
            unit: { type: "string" },
            manufacturer: { type: "string" },
            article: { type: "string" },
            schematic: { type: "string" },
            supplier: { type: "string" },
            note: { type: "string" },
            price_catalog_vat_markup: { type: "number" },
            markup: { type: "number" },
            discount: { type: "number" },
            verification: verificationParam,
          },
          required: ["name", "verification"],
          additionalProperties: false,
        },
      },
      {
        type: "function",
        name: "list_project_positions",
        description: "Список позиций листа проектных расходников",
        parameters: {
          type: "object",
          properties: {
            include_details: { type: "boolean" },
          },
          additionalProperties: false,
        },
      },
      {
        type: "function",
        name: "update_project_position",
        description: "Изменить позицию в проектных расходниках",
        parameters: {
          type: "object",
          properties: {
            position_id: { type: "string" },
            name: { type: "string" },
            qty: { type: "number" },
            unit: { type: "string" },
            manufacturer: { type: "string" },
            article: { type: "string" },
            schematic: { type: "string" },
            supplier: { type: "string" },
            note: { type: "string" },
            price_catalog_vat_markup: { type: "number" },
            markup: { type: "number" },
            discount: { type: "number" },
            verification: verificationParam,
          },
          required: ["position_id"],
          additionalProperties: false,
        },
      },
      {
        type: "function",
        name: "delete_project_position",
        description: "Удалить позицию из проектных расходников",
        parameters: {
          type: "object",
          properties: {
            position_id: { type: "string" },
          },
          required: ["position_id"],
          additionalProperties: false,
        },
      },
      {
        type: "function",
        name: "toggle_project_consumables",
        description: "Включить или выключить лист проектных расходников",
        parameters: {
          type: "object",
          properties: {
            enabled: { type: "boolean" },
          },
          required: ["enabled"],
          additionalProperties: false,
        },
      },
    ];
  }

  return { buildPositionTools };
}
