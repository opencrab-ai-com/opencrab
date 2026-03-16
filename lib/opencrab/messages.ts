export function buildUserMessagePreview(content: string | undefined, attachmentNames: string[]) {
  const parts = [];

  if (content) {
    parts.push(content);
  }

  if (attachmentNames.length > 0) {
    parts.push(`附件：${attachmentNames.join("、")}`);
  }

  return parts.join("\n");
}

export function formatClientMessageTime() {
  const time = new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date());

  return `今天 ${time}`;
}

export function getUserFacingError(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : typeof error === "string" ? error : fallback;

  if (/codex login/i.test(message) || /登录状态/i.test(message)) {
    return "当前没有可用的 Codex 登录状态。请先在本机终端执行 codex login，然后回到 OpenCrab 重试。";
  }

  if (/缺少消息内容或附件/.test(message)) {
    return "请先输入内容，或至少上传一个图片/文本附件。";
  }

  if (/找不到对应对话/.test(message)) {
    return "当前对话已经不存在了，请重新选择或新建一个对话。";
  }

  return message || fallback;
}
