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
    return "OpenCrab 当前还没有完成本机执行环境准备，请先完成初始登录后再回来重试。";
  }

  if (/缺少消息内容或附件/.test(message)) {
    return "请先输入内容，或至少上传一个图片/文本附件。";
  }

  if (/找不到对应对话/.test(message)) {
    return "当前对话已经不存在了，请重新选择或新建一个对话。";
  }

  return message || fallback;
}
