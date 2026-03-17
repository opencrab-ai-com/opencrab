"use client";

import type { SkillIconName } from "@/lib/resources/opencrab-api-types";

export function SkillIcon({
  icon,
  className = "",
}: {
  icon: SkillIconName;
  className?: string;
}) {
  const tone = getSkillIconTone(icon);

  return (
    <div
      className={`flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-[16px] ${className}`.trim()}
      style={{ background: tone.background, color: tone.foreground }}
    >
      <GlyphIcon glyph={icon} />
    </div>
  );
}

function getSkillIconTone(icon: SkillIconName) {
  switch (icon) {
    case "image":
      return {
        background: "linear-gradient(135deg, #83d7ff 0%, #a7e1ff 62%, #ffe39a 62%, #ffe39a 100%)",
        foreground: "#ffffff",
      };
    case "book":
      return { background: "#fff3e7", foreground: "#f07c51" };
    case "pdf":
      return { background: "#ff5c58", foreground: "#ffffff" };
    case "playwright":
      return { background: "#f4f4f2", foreground: "#2d8cff" };
    case "camera":
      return { background: "#f2f2f2", foreground: "#3992f3" };
    case "puzzle":
      return { background: "#fff1ea", foreground: "#ff9b4a" };
    case "mic":
      return { background: "#f4eeff", foreground: "#8a67ff" };
    case "sora":
      return { background: "#0d4eb3", foreground: "#ffffff" };
    case "dotnet":
      return { background: "#5b3ed6", foreground: "#ffffff" };
    case "cloud":
      return { background: "#fff1e5", foreground: "#ff7f1d" };
    case "doc":
      return { background: "#f6f6f6", foreground: "#a1a1aa" };
    case "figma":
      return { background: "#161616", foreground: "#ffffff" };
    case "cube":
      return { background: "#f4f0ff", foreground: "#8f63ff" };
    case "gamepad":
      return { background: "#f4f4f2", foreground: "#7b7f89" };
    case "github":
      return { background: "#ffffff", foreground: "#111111" };
  }
}

function GlyphIcon({ glyph }: { glyph: SkillIconName }) {
  switch (glyph) {
    case "image":
      return (
        <svg viewBox="0 0 24 24" className="h-8 w-8">
          <circle cx="17.5" cy="7" r="3" fill="currentColor" />
          <path d="M4 18.5 9 12.5l4 3 2.5-2.5L20 18.5V20H4z" fill="currentColor" />
        </svg>
      );
    case "book":
      return (
        <svg viewBox="0 0 24 24" className="h-8 w-8 stroke-current" strokeWidth="1.8">
          <path d="M5.5 5.5h5.5a2 2 0 0 1 2 2V19a2 2 0 0 0-2-2H5.5z" />
          <path d="M18.5 5.5H13a2 2 0 0 0-2 2V19a2 2 0 0 1 2-2h5.5z" />
        </svg>
      );
    case "pdf":
      return (
        <svg viewBox="0 0 24 24" className="h-8 w-8">
          <path
            d="M7 3.5h7l4 4V20a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6 20V5A1.5 1.5 0 0 1 7.5 3.5Z"
            fill="currentColor"
          />
          <path fill="#fff" d="M8.6 16.8h1v-1h.8c.9 0 1.5-.5 1.5-1.3 0-.9-.6-1.3-1.6-1.3H8.6Zm1-1.8v-.9h.6c.5 0 .8.1.8.4 0 .4-.3.5-.8.5Zm3.2 1.8h1.4c1.2 0 2-.6 2-1.9s-.8-1.9-2-1.9h-1.4Zm1-1v-1.9h.4c.6 0 1 .3 1 1s-.4.9-1 .9Zm3 1h1v-1.1h1.4v-.8h-1.4v-.5h1.5v-.8h-2.5Z" />
        </svg>
      );
    case "playwright":
      return (
        <svg viewBox="0 0 24 24" className="h-8 w-8">
          <path
            d="M7 5.5c1.2-.5 2.2-.6 3.2-.4 1.1.2 1.8.8 2.1 1.8.2.8.1 1.5-.2 2.1-.4.7-1 1.3-1.8 1.6l1.9 6.6-2.1.7-2-7.1c-.8-.2-1.4-.6-1.8-1.2-.4-.6-.6-1.3-.5-2.1.1-.9.5-1.6 1.2-2Z"
            fill="currentColor"
          />
          <path
            d="M14 9.1c.5-.8 1.2-1.3 2.1-1.5.9-.2 1.8 0 2.6.5.8.5 1.3 1.2 1.5 2.1.2.8.1 1.7-.3 2.4-.4.8-1 1.4-1.9 1.8l.7 2.4-2.1.7-.7-2.4c-.8 0-1.5-.2-2.1-.7-.7-.5-1.1-1.1-1.3-2-.2-1.1 0-2.2.6-3.3Z"
            fill="currentColor"
            opacity="0.72"
          />
        </svg>
      );
    case "camera":
      return (
        <svg viewBox="0 0 24 24" className="h-8 w-8">
          <rect x="3.5" y="6" width="17" height="12.5" rx="2.5" fill="currentColor" />
          <circle cx="12" cy="12.25" r="3.25" fill="#fff" />
        </svg>
      );
    case "puzzle":
      return (
        <svg viewBox="0 0 24 24" className="h-8 w-8">
          <path
            d="M10 3.5a2.5 2.5 0 0 0-.3 5H6.5A1.5 1.5 0 0 0 5 10v3.2a2.5 2.5 0 1 0 0 4.8V20A1.5 1.5 0 0 0 6.5 21h3.2a2.5 2.5 0 1 1 4.8 0H18a1.5 1.5 0 0 0 1.5-1.5v-3.2a2.5 2.5 0 1 1 0-4.8V8.3A1.5 1.5 0 0 0 18 6.8h-3.2A2.5 2.5 0 0 0 10 3.5Z"
            fill="currentColor"
          />
        </svg>
      );
    case "mic":
      return (
        <svg viewBox="0 0 24 24" className="h-8 w-8 stroke-current" strokeWidth="1.8">
          <rect x="9" y="4.5" width="6" height="10" rx="3" />
          <path d="M6.5 11.5a5.5 5.5 0 0 0 11 0M12 17v3.5M8.5 20.5h7" strokeLinecap="round" />
        </svg>
      );
    case "sora":
      return (
        <svg viewBox="0 0 24 24" className="h-8 w-8">
          <circle cx="12" cy="12" r="8" fill="currentColor" opacity="0.24" />
          <circle cx="9" cy="10" r="1.5" fill="currentColor" />
          <circle cx="15" cy="10" r="1.5" fill="currentColor" />
          <path d="M8.5 14.5c1 1 2.2 1.5 3.5 1.5s2.5-.5 3.5-1.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" fill="none" />
        </svg>
      );
    case "dotnet":
      return <span className="text-[20px] font-semibold">.NET</span>;
    case "cloud":
      return (
        <svg viewBox="0 0 24 24" className="h-8 w-8">
          <path
            d="M8.5 18.5h8a3 3 0 0 0 .4-6 4.8 4.8 0 0 0-9.1-1.2A3.8 3.8 0 0 0 8.5 18.5Z"
            fill="currentColor"
          />
        </svg>
      );
    case "doc":
      return (
        <svg viewBox="0 0 24 24" className="h-8 w-8 stroke-current" strokeWidth="1.8">
          <path d="M7 4.5h7l4 4V19A1.5 1.5 0 0 1 16.5 20.5h-9A1.5 1.5 0 0 1 6 19V6A1.5 1.5 0 0 1 7.5 4.5Z" />
          <path d="M9 11h6M9 14.5h6M9 18h4" strokeLinecap="round" />
        </svg>
      );
    case "figma":
      return (
        <svg viewBox="0 0 24 24" className="h-8 w-8">
          <circle cx="9" cy="6.5" r="3.5" fill="#f24e1e" />
          <circle cx="15" cy="6.5" r="3.5" fill="#ff7262" />
          <circle cx="9" cy="12" r="3.5" fill="#a259ff" />
          <circle cx="15" cy="12" r="3.5" fill="#1abcfe" />
          <circle cx="9" cy="17.5" r="3.5" fill="#0acf83" />
        </svg>
      );
    case "cube":
      return (
        <svg viewBox="0 0 24 24" className="h-8 w-8">
          <path d="m12 3.5 7 4v9l-7 4-7-4v-9z" fill="currentColor" />
          <path d="M12 3.5v17M5 7.5l7 4 7-4" fill="none" stroke="currentColor" strokeWidth="1.4" />
        </svg>
      );
    case "gamepad":
      return (
        <svg viewBox="0 0 24 24" className="h-8 w-8 stroke-current" strokeWidth="1.8">
          <path d="M8 9H7a3.5 3.5 0 0 0-3.4 4.3l.7 3a2 2 0 0 0 3.3 1l1.6-1.4a4 4 0 0 1 5.6 0l1.6 1.4a2 2 0 0 0 3.3-1l.7-3A3.5 3.5 0 0 0 17 9h-1" strokeLinecap="round" />
          <path d="M8 12.5h-2M7 11.5v2M15.5 12h.01M17.5 13.5h.01" strokeLinecap="round" />
        </svg>
      );
    case "github":
      return (
        <svg viewBox="0 0 24 24" className="h-8 w-8">
          <path
            d="M12 3.8a8.2 8.2 0 0 0-2.6 16c.4.1.5-.2.5-.4v-1.5c-2.1.4-2.5-.9-2.5-.9-.4-.9-.9-1.1-.9-1.1-.7-.5 0-.5 0-.5.8.1 1.2.8 1.2.8.7 1.1 1.8.8 2.2.6.1-.5.3-.8.5-1-1.7-.2-3.5-.9-3.5-3.9 0-.9.3-1.6.8-2.2-.1-.2-.4-1 0-2 .1 0 .7-.2 2.3.8a8 8 0 0 1 4.2 0c1.6-1 2.2-.8 2.3-.8.4 1 .1 1.8 0 2 .5.6.8 1.3.8 2.2 0 3.1-1.8 3.7-3.6 3.9.3.2.6.7.6 1.5v2.2c0 .2.1.5.5.4A8.2 8.2 0 0 0 12 3.8Z"
            fill="currentColor"
          />
        </svg>
      );
  }
}
