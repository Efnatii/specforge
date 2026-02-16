export class AgentRuntimeStateToolSchemaModule {
  constructor(ctx) {
    Object.assign(this, createAgentRuntimeStateToolSchemaInternal(ctx));
  }
}

function createAgentRuntimeStateToolSchemaInternal(ctx) {
  void ctx;

  function buildInteractionTools() {
    return [
      {
        type: "function",
        name: "ask_user_question",
        description: "Задать пользователю уточняющий вопрос в структурированном виде (без текста-вопроса в обычном ответе)",
        parameters: {
          type: "object",
          properties: {
            question: { type: "string", description: "Короткий конкретный вопрос к пользователю" },
            options: {
              type: "array",
              description: "Варианты ответа (2-6), без нумерации и служебного текста",
              minItems: 2,
              maxItems: 6,
              items: { type: "string" },
            },
            allow_custom: {
              type: "boolean",
              description: "Разрешить пользователю ввести свой ответ вручную",
            },
          },
          required: ["question"],
          additionalProperties: false,
        },
      },
    ];
  }

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

  function buildAttachmentTools() {
    return [
      {
        type: "function",
        name: "list_attachments",
        description: "Return metadata for user-attached files available to the AI",
        parameters: {
          type: "object",
          properties: {},
          additionalProperties: false,
        },
      },
      {
        type: "function",
        name: "read_attachment",
        description: "Read text content from an attached file by id or name",
        parameters: {
          type: "object",
          properties: {
            attachment_id: { type: "string" },
            attachment_name: { type: "string" },
            offset: { type: "number", description: "Character offset for paginated reading" },
            max_chars: { type: "number", description: "Max characters to return (200..60000)" },
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
    buildInteractionTools,
    buildSettingsTools,
    buildAttachmentTools,
    buildStatePathTools,
  };
}
