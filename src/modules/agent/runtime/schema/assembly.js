export class AgentRuntimeAssemblyToolSchemaModule {
  constructor(ctx) {
    Object.assign(this, createAgentRuntimeAssemblyToolSchemaInternal(ctx));
  }
}

function createAgentRuntimeAssemblyToolSchemaInternal(ctx) {
  void ctx;

  function buildAssemblyCoreTools() {
    return [
      {
        type: "function",
        name: "list_assemblies",
        description: "Вернуть список сборок проекта",
        parameters: {
          type: "object",
          properties: {},
          additionalProperties: false,
        },
      },
      {
        type: "function",
        name: "bulk_delete_assemblies",
        description: "Удалить несколько сборок или все сборки проекта без подтверждения",
        parameters: {
          type: "object",
          properties: {
            scope: { type: "string", enum: ["all", "filtered"], description: "all удаляет все, filtered удаляет по фильтрам" },
            assembly_ids: { type: "array", items: { type: "string" } },
            assembly_names: { type: "array", items: { type: "string" } },
            match: { type: "string", description: "Фрагмент имени для фильтрации" },
          },
          additionalProperties: false,
        },
      },
      {
        type: "function",
        name: "resolve_target_context",
        description: "Определить целевой контекст: активный лист, выбранная сборка, список и позиция",
        parameters: {
          type: "object",
          properties: {
            assembly_id: { type: "string" },
            assembly_name: { type: "string" },
            list: { type: "string", enum: ["main", "consumable", "project"] },
            position_id: { type: "string" },
          },
          additionalProperties: false,
        },
      },
    ];
  }

  function buildAssemblyManagementTools() {
    return [
      {
        type: "function",
        name: "read_assembly",
        description: "Прочитать данные сборки",
        parameters: {
          type: "object",
          properties: {
            assembly_id: { type: "string" },
            assembly_name: { type: "string" },
            include_positions: { type: "boolean" },
          },
          additionalProperties: false,
        },
      },
      {
        type: "function",
        name: "create_assembly",
        description: "Создать новую сборку",
        parameters: {
          type: "object",
          properties: {
            full_name: { type: "string", description: "Полное имя сборки" },
            abbreviation: { type: "string", description: "Аббревиатура сборки (опционально)" },
            separate_consumables: { type: "boolean", description: "Включить отдельный список расходников" },
          },
          required: ["full_name"],
          additionalProperties: false,
        },
      },
      {
        type: "function",
        name: "update_assembly",
        description: "Изменить параметры сборки",
        parameters: {
          type: "object",
          properties: {
            assembly_id: { type: "string" },
            assembly_name: { type: "string" },
            full_name: { type: "string" },
            abbreviation: { type: "string" },
            abbr_manual: { type: "boolean" },
            separate_consumables: { type: "boolean" },
            manual_cons_no_disc: { type: "number" },
            manual_cons_disc: { type: "number" },
            labor: {
              type: "object",
              properties: {
                devCoeff: { type: "number" },
                devHours: { type: "number" },
                devRate: { type: "number" },
                assmCoeff: { type: "number" },
                assmHours: { type: "number" },
                assmRate: { type: "number" },
                profitCoeff: { type: "number" },
              },
              additionalProperties: false,
            },
          },
          additionalProperties: false,
        },
      },
      {
        type: "function",
        name: "duplicate_assembly",
        description: "Дублировать сборку",
        parameters: {
          type: "object",
          properties: {
            assembly_id: { type: "string" },
            assembly_name: { type: "string" },
          },
          additionalProperties: false,
        },
      },
      {
        type: "function",
        name: "delete_assembly",
        description: "Удалить сборку",
        parameters: {
          type: "object",
          properties: {
            assembly_id: { type: "string" },
            assembly_name: { type: "string" },
          },
          additionalProperties: false,
        },
      },
    ];
  }

  return {
    buildAssemblyCoreTools,
    buildAssemblyManagementTools,
  };
}
