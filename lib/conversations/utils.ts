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

export function formatConversationMessageTimestamp(value?: string | Date | null, now = new Date()) {
  if (!value) {
    return "时间未知";
  }

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "时间未知";
  }

  const nowDate = startOfDay(now);
  const targetDate = startOfDay(date);
  const diffDays = Math.round((nowDate.getTime() - targetDate.getTime()) / 86400000);
  const timePart = date.toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  if (diffDays === 0) {
    return `今天 ${timePart}`;
  }

  if (diffDays === 1) {
    return `昨天 ${timePart}`;
  }

  if (date.getFullYear() === now.getFullYear()) {
    return `${date.getMonth() + 1}月${date.getDate()}日 ${timePart}`;
  }

  return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()} ${timePart}`;
}

export function formatConversationTimeLabel(value: string | Date, now = new Date()) {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "刚刚";
  }

  const nowDate = startOfDay(now);
  const targetDate = startOfDay(date);
  const diffDays = Math.round((nowDate.getTime() - targetDate.getTime()) / 86400000);

  if (diffDays === 0) {
    return date.toLocaleTimeString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  }

  if (diffDays === 1) {
    return "昨天";
  }

  if (date.getFullYear() === now.getFullYear()) {
    return `${date.getMonth() + 1}月${date.getDate()}日`;
  }

  return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}
