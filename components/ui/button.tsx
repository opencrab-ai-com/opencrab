import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
};

const BASE_CLASS_NAME =
  "inline-flex items-center justify-center rounded-full font-medium transition disabled:cursor-not-allowed disabled:opacity-60";

const SIZE_CLASS_NAME: Record<ButtonSize, string> = {
  sm: "h-9 px-4 text-[12px]",
  md: "h-10 px-4 text-[13px]",
};

const VARIANT_CLASS_NAME: Record<ButtonVariant, string> = {
  primary: "bg-text text-white shadow-[0_1px_2px_rgba(15,23,42,0.12)] hover:opacity-92",
  secondary: "border border-line bg-background text-text hover:border-text/20",
  ghost: "bg-transparent text-muted-strong hover:bg-surface-muted hover:text-text",
  danger: "border border-[#f3d0cb] bg-[#fff8f7] text-[#b42318] hover:border-[#e7b3ab]",
};

export function buttonClassName({
  variant = "secondary",
  size = "md",
  className = "",
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
}) {
  return [
    BASE_CLASS_NAME,
    SIZE_CLASS_NAME[size],
    VARIANT_CLASS_NAME[variant],
    className,
  ]
    .filter(Boolean)
    .join(" ");
}

export function Button({
  children,
  type = "button",
  variant = "secondary",
  size = "md",
  className = "",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClassName({ variant, size, className })}
      {...props}
    >
      {children}
    </button>
  );
}
