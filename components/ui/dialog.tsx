"use client";

import { useEffect } from "react";
import { buttonClassName } from "@/components/ui/button";

type DialogShellProps = {
  children: React.ReactNode;
  onClose: () => void;
  panelClassName?: string;
};

type DialogHeaderProps = {
  title: string;
  description?: string;
};

type DialogActionsProps = {
  children: React.ReactNode;
};

type DialogButtonProps = {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
};

export function DialogShell({ children, onClose, panelClassName }: DialogShellProps) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-[rgba(17,17,17,0.16)] backdrop-blur-[2px]"
      onClick={onClose}
      role="presentation"
    >
      <div className="flex min-h-full items-start justify-center p-4 sm:items-center">
        <div
          className={`w-full max-w-[420px] rounded-[28px] border border-line bg-surface px-6 py-6 shadow-[0_24px_80px_rgba(15,23,42,0.16)] ${panelClassName || ""}`}
          onClick={(event) => event.stopPropagation()}
          role="dialog"
          aria-modal="true"
        >
          {children}
        </div>
      </div>
    </div>
  );
}

export function DialogHeader({ title, description }: DialogHeaderProps) {
  return (
    <div className="space-y-3">
      <p className="text-[13px] text-muted">OpenCrab</p>
      <h3 className="text-[22px] font-semibold tracking-[-0.04em] text-text">{title}</h3>
      {description ? <p className="text-[14px] leading-6 text-muted-strong">{description}</p> : null}
    </div>
  );
}

export function DialogActions({ children }: DialogActionsProps) {
  return <div className="mt-7 flex items-center justify-end gap-3">{children}</div>;
}

export function DialogSecondaryButton({ children, onClick, disabled }: DialogButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={buttonClassName({
        variant: "secondary",
        className: "bg-surface-muted hover:bg-[#efeff1]",
      })}
    >
      {children}
    </button>
  );
}

export function DialogPrimaryButton({ children, onClick, disabled }: DialogButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={buttonClassName({
        variant: "primary",
        className: "hover:bg-[#2b2b2f] disabled:bg-[#d4d4db]",
      })}
    >
      {children}
    </button>
  );
}
