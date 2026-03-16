import type {
  BrowserConnectionMode,
  CodexBrowserSessionStatus,
  CodexReasoningEffort,
  CodexSandboxMode,
} from "@/lib/resources/opencrab-api-types";

export function formatBrowserSessionLabel(value: Pick<CodexBrowserSessionStatus, "ok" | "status"> | null) {
  if (!value) {
    return "检查中";
  }

  if (value.ok) {
    return "已就绪";
  }

  switch (value.status) {
    case "launching":
      return "启动中";
    case "missing_browser":
      return "未找到 Chrome";
    default:
      return "未连接";
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

export function formatBrowserConnectionModeLabel(value: BrowserConnectionMode) {
  return value === "current-browser" ? "当前浏览器" : "独立浏览器";
}
