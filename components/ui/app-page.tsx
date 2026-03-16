import type { ReactNode } from "react";

type AppPageProps = {
  children: ReactNode;
  width?: "default" | "wide";
  className?: string;
  contentClassName?: string;
};

const WIDTH_CLASS = {
  default: "max-w-[920px]",
  wide: "max-w-[1180px]",
};

export function AppPage({
  children,
  width = "default",
  className = "",
  contentClassName = "",
}: AppPageProps) {
  return (
    <div
      className={`min-h-screen px-6 py-8 lg:h-full lg:min-h-0 lg:overflow-y-auto lg:px-10 ${className}`.trim()}
    >
      <div className={`mx-auto ${WIDTH_CLASS[width]} ${contentClassName}`.trim()}>{children}</div>
    </div>
  );
}

