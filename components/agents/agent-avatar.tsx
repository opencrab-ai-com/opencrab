"use client";

import Image from "next/image";
import { getAgentInitials } from "@/lib/agents/avatar-library";

export function AgentAvatar({
  src,
  name,
  size = 40,
  className = "",
}: {
  src?: string | null;
  name: string;
  size?: number;
  className?: string;
}) {
  const initials = getAgentInitials(name);

  return (
    <div
      className={`relative shrink-0 overflow-hidden rounded-[18px] border border-line bg-[#f6f4ef] ${className}`.trim()}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      {src ? (
        <Image
          src={src}
          alt=""
          fill
          unoptimized
          sizes={`${size}px`}
          className="object-cover"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-[linear-gradient(135deg,#eef4ff_0%,#fff4ea_100%)] text-[12px] font-semibold text-[#3056a0]">
          {initials}
        </div>
      )}
    </div>
  );
}
