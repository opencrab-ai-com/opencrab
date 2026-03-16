import {
  getChannelDetail,
  markChannelError,
  updateChannelRecord,
} from "@/lib/channels/channel-store";
import { verifyFeishuApp } from "@/lib/channels/feishu";
import { getFeishuSecrets } from "@/lib/channels/secret-store";

export async function syncFeishuChannelState() {
  const feishuSecrets = getFeishuSecrets();

  if (!feishuSecrets.appId || !feishuSecrets.appSecret) {
    return {
      ok: true,
      detail: getChannelDetail("feishu"),
      message: "还没有配置飞书 App ID 和 App Secret。",
    };
  }

  try {
    const app = await verifyFeishuApp();
    const now = new Date().toISOString();

    updateChannelRecord("feishu", {
      status: "ready",
      lastError: null,
      configSummary: {
        appId: app.appId,
        credentialsVerified: true,
        lastVerifiedAt: now,
      },
    });

    return {
      ok: true,
      detail: getChannelDetail("feishu"),
      message: "飞书配置已校验通过，tenant access token 可正常获取。",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "飞书状态同步失败。";
    markChannelError("feishu", message);
    updateChannelRecord("feishu", {
      configSummary: {
        credentialsVerified: false,
      },
    });

    return {
      ok: false,
      detail: getChannelDetail("feishu"),
      message,
    };
  }
}
