import { existsSync, readFileSync } from "node:fs";
import type {
  CodexModelOption,
  CodexOptionsResponse,
  CodexReasoningEffort,
} from "@/lib/resources/opencrab-api-types";
import { OPENCRAB_CODEX_MODELS_CACHE_PATH } from "@/lib/resources/runtime-paths";

const MODELS_CACHE_PATH = OPENCRAB_CODEX_MODELS_CACHE_PATH;

const FALLBACK_OPTIONS: CodexOptionsResponse = {
  models: [
    {
      id: "gpt-5.4",
      label: "GPT-5.4",
      description: "Latest frontier agentic coding model.",
      defaultReasoningEffort: "medium",
      reasoningOptions: [
        createReasoningOption("low", "Fast responses with lighter reasoning"),
        createReasoningOption("medium", "Balances speed and reasoning depth for everyday tasks"),
        createReasoningOption("high", "Greater reasoning depth for complex problems"),
        createReasoningOption("xhigh", "Extra high reasoning depth for complex problems"),
      ],
    },
  ],
  defaultModel: "gpt-5.4",
};

type CachedModel = {
  slug?: string;
  display_name?: string;
  description?: string;
  default_reasoning_level?: CodexReasoningEffort;
  supported_reasoning_levels?: Array<{
    effort?: CodexReasoningEffort;
    description?: string;
  }>;
  visibility?: string;
  supported_in_api?: boolean;
};

type CachedReasoningOption = {
  effort?: CodexReasoningEffort;
  description?: string;
};

export function getCodexOptions(): CodexOptionsResponse {
  if (!existsSync(MODELS_CACHE_PATH)) {
    return FALLBACK_OPTIONS;
  }

  try {
    const raw = JSON.parse(readFileSync(MODELS_CACHE_PATH, "utf8")) as
      | CachedModel[]
      | { data?: CachedModel[]; models?: CachedModel[]; items?: CachedModel[] };
    const cachedModels = Array.isArray(raw)
      ? raw
      : raw.data || raw.models || raw.items || [];

    const models = cachedModels
      .filter((model) => model.slug && model.supported_in_api !== false && model.visibility !== "hidden")
      .map((model) => {
        const reasoningOptions = (model.supported_reasoning_levels || [])
          .filter(hasSupportedReasoningEffort)
          .map((item) => createReasoningOption(item.effort, item.description || ""));

        const defaultReasoningEffort = isReasoningEffort(model.default_reasoning_level)
          ? model.default_reasoning_level
          : reasoningOptions[0]?.effort || "medium";

        return {
          id: model.slug!,
          label: model.display_name || model.slug!,
          description: model.description || "",
          defaultReasoningEffort,
          reasoningOptions:
            reasoningOptions.length > 0
              ? reasoningOptions
              : [createReasoningOption(defaultReasoningEffort, "")],
        } satisfies CodexModelOption;
      });

    if (models.length === 0) {
      return FALLBACK_OPTIONS;
    }

    return {
      models,
      defaultModel: resolvePreferredModelOption(models, process.env.OPENCRAB_CODEX_MODEL)?.id || models[0].id,
    };
  } catch {
    return FALLBACK_OPTIONS;
  }
}

export function resolvePreferredModelOption(
  models: CodexModelOption[],
  preferredModelId?: string | null,
) {
  const preferredId = preferredModelId?.trim();

  if (preferredId) {
    const exactMatch = models.find((model) => model.id === preferredId);

    if (exactMatch) {
      return exactMatch;
    }
  }

  return models[0] || FALLBACK_OPTIONS.models[0];
}

export function resolvePreferredReasoningEffort(
  model: CodexModelOption | null | undefined,
  preferredEffort?: CodexReasoningEffort | null,
) {
  if (!model) {
    return preferredEffort || "medium";
  }

  if (preferredEffort && model.reasoningOptions.some((item) => item.effort === preferredEffort)) {
    return preferredEffort;
  }

  return model.defaultReasoningEffort;
}

function createReasoningOption(effort: CodexReasoningEffort, description: string) {
  return {
    effort,
    label: getReasoningLabel(effort),
    description,
  };
}

function getReasoningLabel(effort: CodexReasoningEffort) {
  switch (effort) {
    case "minimal":
      return "极低";
    case "low":
      return "低";
    case "medium":
      return "中";
    case "high":
      return "高";
    case "xhigh":
      return "极高";
  }
}

function isReasoningEffort(value: string | undefined): value is CodexReasoningEffort {
  return value === "minimal" || value === "low" || value === "medium" || value === "high" || value === "xhigh";
}

function hasSupportedReasoningEffort(
  item: CachedReasoningOption,
): item is { effort: CodexReasoningEffort; description?: string } {
  return isReasoningEffort(item.effort);
}
