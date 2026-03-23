import type { ReactNode } from "react";

type PageHeaderProps = {
  title: string;
  description?: string;
  descriptionClassName?: string;
  hideEyebrow?: boolean;
  className?: string;
  actions?: ReactNode;
};

export function PageHeader({
  title,
  description,
  descriptionClassName = "",
  hideEyebrow = true,
  className = "",
  actions,
}: PageHeaderProps) {
  return (
    <div className={`mb-8 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between ${className}`.trim()}>
      <div className="max-w-[720px]">
        {!hideEyebrow ? (
          <p className="text-[12px] font-medium uppercase tracking-[0.14em] text-muted">OpenCrab</p>
        ) : null}
        <h1
          className={`${hideEyebrow ? "" : "mt-2 "}text-[32px] font-semibold tracking-[-0.05em] text-text`}
        >
          {title}
        </h1>
        {description ? (
          <p
            className={`mt-2 text-[14px] leading-6 text-muted-strong ${descriptionClassName}`.trim()}
          >
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 justify-start lg:justify-end">{actions}</div> : null}
    </div>
  );
}
