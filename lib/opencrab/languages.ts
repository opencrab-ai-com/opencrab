import type { AppLanguage } from "@/lib/seed-data";

export const APP_LANGUAGE_OPTIONS: Array<{
  value: AppLanguage;
  label: string;
}> = [
  { value: "zh-Hans", label: "简体中文" },
  { value: "en", label: "English" },
];

const APP_LANGUAGE_PROMPT_INSTRUCTION: Record<AppLanguage, string> = {
  "zh-Hans":
    "默认工作语言使用简体中文。除非用户明确要求其他语言，否则所有对话、总结、改写、标题、说明文字和其他文本输出都优先使用简体中文。",
  en: "Default working language is English. Unless the user explicitly asks for another language, use English for replies, summaries, rewrites, titles, explanatory text, and other text outputs.",
};

export function resolveAppLanguage(value: string | null | undefined): AppLanguage {
  if (value === "en" || value === "zh-Hans") {
    return value;
  }

  return "zh-Hans";
}

export function getAppLanguagePromptInstruction(value: string | null | undefined) {
  return APP_LANGUAGE_PROMPT_INSTRUCTION[resolveAppLanguage(value)];
}
