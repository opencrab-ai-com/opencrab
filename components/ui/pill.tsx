import type { ReactNode } from "react";

type PillTone = "neutral" | "success" | "info" | "warning" | "danger" | "accent";
type PillSize = "sm" | "md";

const BASE_CLASS_NAME =
  "inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-full border font-medium leading-none";

const SIZE_CLASS_NAME: Record<PillSize, string> = {
  sm: "h-6 px-2.5 text-[11px]",
  md: "h-8 px-3 text-[12px]",
};

const TONE_CLASS_NAME: Record<PillTone, string> = {
  neutral: "border-line bg-surface-muted text-muted-strong",
  success: "border-[#dbe8de] bg-[#eef8f0] text-[#6c776d]",
  info: "border-[#dce4f2] bg-[#eff4fb] text-[#687385]",
  warning: "border-[#eadfce] bg-[#faf4e8] text-[#7b7466]",
  danger: "border-[#edd9d5] bg-[#fcf2f1] text-[#7e6f6b]",
  accent: "border-[#eedfd8] bg-[#faf1ec] text-[#7e726c]",
};

export function pillClassName({
  tone = "neutral",
  size = "md",
  className = "",
}: {
  tone?: PillTone;
  size?: PillSize;
  className?: string;
}) {
  return [BASE_CLASS_NAME, SIZE_CLASS_NAME[size], TONE_CLASS_NAME[tone], className]
    .filter(Boolean)
    .join(" ");
}

export function MetaPill({
  children,
  size = "md",
  className = "",
}: {
  children: ReactNode;
  size?: PillSize;
  className?: string;
}) {
  return <span className={pillClassName({ tone: "neutral", size, className })}>{children}</span>;
}

export function StatusPill({
  children,
  tone,
  size = "md",
  className = "",
}: {
  children: ReactNode;
  tone: PillTone;
  size?: PillSize;
  className?: string;
}) {
  return <span className={pillClassName({ tone, size, className })}>{children}</span>;
}
