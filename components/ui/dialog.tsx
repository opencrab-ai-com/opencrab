"use client";

import { useEffect } from "react";

type DialogShellProps = {
  children: React.ReactNode;
  onClose: () => void;
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

export function DialogShell({ children, onClose }: DialogShellProps) {
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(17,17,17,0.16)] p-4 backdrop-blur-[2px]"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-[420px] rounded-[28px] border border-line bg-surface px-6 py-6 shadow-[0_24px_80px_rgba(15,23,42,0.16)]"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {children}
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
      className="rounded-full border border-line bg-surface-muted px-5 py-2.5 text-[13px] font-medium text-text transition hover:bg-[#ecece7] disabled:cursor-not-allowed disabled:opacity-60"
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
      className="rounded-full bg-[#111111] px-5 py-2.5 text-[13px] font-medium text-white transition hover:bg-[#262626] disabled:cursor-not-allowed disabled:bg-[#c9c9c5]"
    >
      {children}
    </button>
  );
}
