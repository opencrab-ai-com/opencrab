import type { ChannelDetail } from "@/lib/channels/types";

export type ChannelFormField = {
  name: string;
  label: string;
  placeholder: string;
  type: string;
  helper: string;
};

export type ChannelFormGroups = {
  primary: ChannelFormField[];
  advanced: ChannelFormField[];
};

export function buildChannelFormGroups(channelId: ChannelDetail["id"]): ChannelFormGroups {
  if (channelId === "telegram") {
    return {
      primary: [
        {
          name: "botToken",
          label: "Bot Token",
          placeholder: "123456:AA...",
          type: "password",
          helper: "从 BotFather 获取。保存后，OpenCrab 会先校验 token，并在已有公网地址时自动设置 webhook。",
        },
      ],
      advanced: [
        {
          name: "webhookSecret",
          label: "Webhook Secret",
          placeholder: "可选，用于校验 Telegram header",
          type: "password",
          helper: "可选；开启后需要和 Telegram setWebhook 的 secret_token 保持一致。",
        },
      ],
    };
  }

  return {
    primary: [
      {
        name: "appId",
        label: "App ID",
        placeholder: "cli_xxx",
        type: "text",
        helper: "飞书开放平台应用的 app_id。",
      },
      {
        name: "appSecret",
        label: "App Secret",
        placeholder: "飞书应用密钥",
        type: "password",
        helper: "用于换取 tenant_access_token，并启动飞书长连接。",
      },
    ],
    advanced: [
      {
        name: "verificationToken",
        label: "Verification Token（兼容 Webhook）",
        placeholder: "可选，仅兼容 Webhook 模式时使用",
        type: "password",
        helper: "默认长连接模式不需要；只有你仍在使用飞书 Webhook 兼容入口时才需要保持一致。",
      },
      {
        name: "encryptKey",
        label: "Encrypt Key（兼容 Webhook）",
        placeholder: "可选，仅兼容 Webhook 模式时使用",
        type: "password",
        helper: "如果你启用了飞书 Webhook 加密，这里需要和开放平台中的 Encrypt Key 保持一致。",
      },
    ],
  };
}

export function buildChannelConfiguredHints(channel: ChannelDetail) {
  if (channel.id === "telegram") {
    return [
      channel.configSummary.hasBotToken ? "Bot Token 已保存" : "还没填写 Bot Token",
      channel.configSummary.webhookConfigured ? "已连接成功" : "连接会自动完成",
    ];
  }

  return [
    channel.configSummary.hasAppId ? "App ID 已配置" : "App ID 未配置",
    channel.configSummary.hasAppSecret ? "App Secret 已配置" : "App Secret 未配置",
    channel.configSummary.socketConnected ? "长连接已启动" : "长连接会自动启动",
    channel.configSummary.hasVerificationToken && channel.configSummary.hasEncryptKey
      ? "兼容 Webhook 密钥已齐"
      : "兼容 Webhook 可选",
  ];
}
