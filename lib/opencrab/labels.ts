import type {
  BrowserConnectionMode,
  CodexBrowserSessionStatus,
  CodexReasoningEffort,
  CodexSandboxMode,
} from "@/lib/resources/opencrab-api-types";

export function formatBrowserSessionLabel(value: CodexBrowserSessionStatus | null) {
  return getBrowserSessionPresentation(value).label;
}

export function getBrowserSessionPresentation(value: CodexBrowserSessionStatus | null) {
  if (!value) {
    return {
      label: "检查中",
      tone: "neutral" as const,
      detail: "OpenCrab 正在读取浏览器连接状态。",
      recoveryHint: "稍等片刻，或切回窗口后再看一次。",
    };
  }

  if (value.ok) {
    return {
      label: "已就绪",
      tone: "positive" as const,
      detail: value.message,
      recoveryHint: "现在可以直接让 OpenCrab 打开网页、抓取页面或填写表单。",
    };
  }

  switch (value.status) {
    case "launching":
      return {
        label: "连接中",
        tone: "warning" as const,
        detail: value.message,
        recoveryHint:
          value.mode === "current-browser"
            ? "如果 Chrome 弹出允许连接或远程调试相关提示，请点允许。"
            : "等待 OpenCrab 把独立浏览器拉起即可。",
      };
    case "missing_browser":
      return {
        label: "未找到 Chrome",
        tone: "critical" as const,
        detail: value.message,
        recoveryHint: "先安装 Google Chrome，再重新检查浏览器连接。",
      };
    default:
      return {
        label: value.mode === "current-browser" ? "等待当前浏览器" : "未连接",
        tone: "warning" as const,
        detail: value.message,
        recoveryHint:
          value.mode === "current-browser"
            ? "先确认 Chrome 已经打开；如果刚刚才打开，等 1-2 秒或点“重新检查浏览器连接”。"
            : "点“立即重连浏览器”，让 OpenCrab 再试一次。",
      };
  }
}

export function formatReasoningEffortLabel(value: CodexReasoningEffort | string) {
  switch (value) {
    case "minimal":
      return "最简";
    case "low":
      return "低";
    case "medium":
      return "中";
    case "high":
      return "高";
    case "xhigh":
      return "极高";
    default:
      return value;
  }
}

export function formatSandboxModeLabel(value: CodexSandboxMode | string) {
  switch (value) {
    case "read-only":
      return "只读";
    case "workspace-write":
      return "可写工作区";
    case "danger-full-access":
      return "完全访问";
    default:
      return value;
  }
}

export function formatSandboxModeDescription(value: CodexSandboxMode) {
  switch (value) {
    case "read-only":
      return "只读取当前工作区和上下文，不改动文件。";
    case "workspace-write":
      return "只在当前工作区内读写，适合大多数日常开发。";
    case "danger-full-access":
      return "允许跨目录完全访问，需要你明确知道边界风险。";
    default:
      return "";
  }
}

export function formatBrowserConnectionModeLabel(value: BrowserConnectionMode) {
  return value === "current-browser" ? "当前浏览器" : "独立浏览器";
}
