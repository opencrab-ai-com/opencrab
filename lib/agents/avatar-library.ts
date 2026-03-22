import { createAvatar } from "@dicebear/core";
import {
  avataaars,
  botttsNeutral,
  openPeeps,
} from "@dicebear/collection";

export type AgentAvatarStyle =
  | "cartoon-person"
  | "sketch-person"
  | "robot"
  | "robot-soft"
  | "animal-cat"
  | "animal-bear";

export type AgentAvatarOption = {
  id: string;
  dataUrl: string;
  style: AgentAvatarStyle;
  label: string;
};

const AVATAR_STYLE_ORDER: Array<{
  style: AgentAvatarStyle;
  label: string;
}> = [
  { style: "cartoon-person", label: "卡通人物" },
  { style: "sketch-person", label: "手绘人物" },
  { style: "robot", label: "机器人" },
  { style: "robot-soft", label: "机器人" },
  { style: "animal-cat", label: "萌宠" },
  { style: "animal-bear", label: "萌宠" },
];

const ANIMAL_PALETTES = [
  { background: "#fff6ef", primary: "#f0b38b", secondary: "#f7d7bf", stroke: "#8e5535" },
  { background: "#f7f4ff", primary: "#ceb9ff", secondary: "#e8dcff", stroke: "#5f4a9e" },
  { background: "#eef8ff", primary: "#a9d3f5", secondary: "#d7edff", stroke: "#3d6f96" },
  { background: "#f3fbf3", primary: "#acd8b7", secondary: "#dff2e4", stroke: "#477050" },
  { background: "#fff8ea", primary: "#f2c76a", secondary: "#fde9b6", stroke: "#8d6922" },
];

export function createAgentAvatarDataUrl(input: {
  name: string;
  seed: string;
  variant?: number;
  style?: AgentAvatarStyle;
}) {
  const variant = input.variant ?? 0;
  const style =
    input.style ??
    AVATAR_STYLE_ORDER[Math.abs(hashString(`${input.seed}:${input.name}`)) % AVATAR_STYLE_ORDER.length].style;
  const seed = `${input.seed}:${variant}:${style}:${input.name}`;

  switch (style) {
    case "cartoon-person":
      return createDiceBearDataUrl(avataaars, seed, {
        backgroundColor: ["d8e2ff", "dff4ea", "ffe5d1", "efe3ff"],
        backgroundType: ["solid"],
      });
    case "sketch-person":
      return createDiceBearDataUrl(openPeeps, seed, {
        backgroundColor: ["e6eefc", "f5eadf", "e6f3ea"],
      });
    case "robot":
      return createDiceBearDataUrl(botttsNeutral, seed, {
        backgroundColor: ["dbe9ff", "ede9ff", "e4f5ef"],
      });
    case "robot-soft":
      return createDiceBearDataUrl(botttsNeutral, `${seed}:soft`, {
        backgroundColor: ["fff0d8", "ffe4ec", "eef6ff"],
      });
    case "animal-cat":
      return createAnimalAvatarDataUrl({ seed, kind: "cat", name: input.name });
    case "animal-bear":
      return createAnimalAvatarDataUrl({ seed, kind: "bear", name: input.name });
    default:
      return createDiceBearDataUrl(avataaars, seed, {
        backgroundColor: ["d8e2ff", "dff4ea", "ffe5d1"],
        backgroundType: ["solid"],
      });
  }
}

export function buildAgentAvatarOptions(input: {
  name: string;
  seed: string;
  count?: number;
}) {
  const count = input.count ?? AVATAR_STYLE_ORDER.length;

  return Array.from({ length: count }, (_, index) => {
    const styleMeta = AVATAR_STYLE_ORDER[index % AVATAR_STYLE_ORDER.length];

    return {
      id: `${input.seed}:${styleMeta.style}:${index}`,
      dataUrl: createAgentAvatarDataUrl({
        name: input.name,
        seed: input.seed,
        variant: index,
        style: styleMeta.style,
      }),
      style: styleMeta.style,
      label: styleMeta.label,
    };
  });
}

export function normalizeAgentAvatarDataUrl(input: string | null | undefined) {
  if (!input) {
    return null;
  }

  const trimmed = input.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function shouldReplaceWithModernAvatar(input: string | null | undefined) {
  if (!input) {
    return true;
  }

  const decoded = safeDecodeDataUrl(input);

  if (!decoded) {
    return false;
  }

  return decoded.includes("M16 92c18-20 38-30 62-30") || decoded.includes("text-anchor=\"middle\"");
}

export function getAgentInitials(name: string) {
  const cleaned = name.replace(/\s+/g, "").trim();

  if (!cleaned) {
    return "OC";
  }

  const glyphs = Array.from(cleaned);
  return glyphs.slice(0, Math.min(2, glyphs.length)).join("").toUpperCase();
}

function createDiceBearDataUrl(
  style: Parameters<typeof createAvatar>[0],
  seed: string,
  options: Record<string, unknown>,
) {
  return createAvatar(style, {
    seed,
    size: 120,
    radius: 24,
    ...options,
  }).toDataUri();
}

function createAnimalAvatarDataUrl(input: {
  seed: string;
  name: string;
  kind: "cat" | "bear";
}) {
  const hash = Math.abs(hashString(`${input.seed}:${input.kind}`));
  const palette = ANIMAL_PALETTES[hash % ANIMAL_PALETTES.length];
  const earInset = 14 + (hash % 8);
  const eyeY = 52 + (hash % 6);
  const muzzleY = 70 + (hash % 4);
  const blush = hash % 2 === 0;
  const svg =
    input.kind === "cat"
      ? `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120">
          <rect width="120" height="120" rx="28" fill="${palette.background}" />
          <path d="M22 44 34 ${earInset}l18 24Z" fill="${palette.primary}" />
          <path d="M98 44 86 ${earInset} 68 38Z" fill="${palette.primary}" />
          <path d="M32 46c0-18 12-30 28-30s28 12 28 30v24c0 18-12 30-28 30S32 88 32 70Z" fill="${palette.primary}" />
          <path d="M40 50c0-12 8-20 20-20s20 8 20 20v18c0 12-8 20-20 20s-20-8-20-20Z" fill="${palette.secondary}" opacity="0.72" />
          <circle cx="46" cy="${eyeY}" r="4" fill="${palette.stroke}" />
          <circle cx="74" cy="${eyeY}" r="4" fill="${palette.stroke}" />
          <path d="M54 ${muzzleY}c3 4 9 4 12 0" stroke="${palette.stroke}" stroke-width="3" stroke-linecap="round" />
          <path d="M60 ${muzzleY - 4}l-4 5h8Z" fill="${palette.stroke}" />
          <path d="M22 66h18M18 74h18M80 66h18M84 74h18" stroke="${palette.stroke}" stroke-width="2.4" stroke-linecap="round" opacity="0.75" />
          ${blush ? `<circle cx="36" cy="70" r="5" fill="#ffb3bf" opacity="0.4" /><circle cx="84" cy="70" r="5" fill="#ffb3bf" opacity="0.4" />` : ""}
        </svg>
      `
      : `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120">
          <rect width="120" height="120" rx="28" fill="${palette.background}" />
          <circle cx="32" cy="34" r="16" fill="${palette.primary}" />
          <circle cx="88" cy="34" r="16" fill="${palette.primary}" />
          <circle cx="60" cy="62" r="38" fill="${palette.primary}" />
          <circle cx="60" cy="68" r="24" fill="${palette.secondary}" opacity="0.86" />
          <circle cx="46" cy="${eyeY}" r="4" fill="${palette.stroke}" />
          <circle cx="74" cy="${eyeY}" r="4" fill="${palette.stroke}" />
          <ellipse cx="60" cy="${muzzleY}" rx="10" ry="8" fill="${palette.secondary}" />
          <path d="M56 ${muzzleY}c2 3 6 3 8 0" stroke="${palette.stroke}" stroke-width="3" stroke-linecap="round" />
          <circle cx="60" cy="${muzzleY - 3}" r="3" fill="${palette.stroke}" />
          ${blush ? `<circle cx="38" cy="72" r="5" fill="#ffb3bf" opacity="0.35" /><circle cx="82" cy="72" r="5" fill="#ffb3bf" opacity="0.35" />` : ""}
        </svg>
      `;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg.replace(/\s+/g, " ").trim())}`;
}

function hashString(value: string) {
  let hash = 0;

  for (const char of value) {
    hash = (hash << 5) - hash + char.charCodeAt(0);
    hash |= 0;
  }

  return hash;
}

function safeDecodeDataUrl(input: string) {
  const marker = "data:image/svg+xml";

  if (!input.startsWith(marker)) {
    return null;
  }

  const commaIndex = input.indexOf(",");

  if (commaIndex === -1) {
    return null;
  }

  try {
    return decodeURIComponent(input.slice(commaIndex + 1));
  } catch {
    return null;
  }
}
