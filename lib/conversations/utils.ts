export function buildConversationTitle(content: string) {
  return content.replace(/\s+/g, " ").trim().slice(0, 24) || "新对话";
}

export function formatMessageTime(date: Date) {
  return `今天 ${date.toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })}`;
}
