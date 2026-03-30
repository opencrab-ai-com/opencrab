"use client";

import { useEffect, useState } from "react";
import {
  DialogActions,
  DialogHeader,
  DialogPrimaryButton,
  DialogSecondaryButton,
  DialogShell,
} from "@/components/ui/dialog";
import { pickLocalDirectory } from "@/lib/resources/opencrab-api";

type WorkspacePickerDialogProps = {
  title: string;
  description: string;
  initialValue?: string | null;
  placeholder?: string;
  confirmLabel?: string;
  allowEmpty?: boolean;
  defaultHint?: string | null;
  onClose: () => void;
  onConfirm: (value: string | null) => Promise<void> | void;
};

export function WorkspacePickerDialog({
  title,
  description,
  initialValue,
  placeholder = "~/OpenCrab/workspaces/example",
  confirmLabel = "保存",
  allowEmpty = false,
  defaultHint = null,
  onClose,
  onConfirm,
}: WorkspacePickerDialogProps) {
  const [value, setValue] = useState(initialValue?.trim() || "");
  const [isPicking, setIsPicking] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    setValue(initialValue?.trim() || "");
  }, [initialValue]);

  async function handlePickDirectory() {
    setIsPicking(true);
    setErrorMessage(null);

    try {
      const result = await pickLocalDirectory({
        title,
        defaultPath: value.trim() || initialValue || undefined,
      });

      if (result.path) {
        setValue(result.path);
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "打开目录选择器失败。");
    } finally {
      setIsPicking(false);
    }
  }

  async function handleConfirm() {
    const trimmedValue = value.trim();

    if (!allowEmpty && !trimmedValue) {
      setErrorMessage("请先选择工作区目录。");
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    try {
      await onConfirm(trimmedValue || null);
      onClose();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "保存工作区失败。");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <DialogShell onClose={() => (isSaving ? null : onClose())} panelClassName="max-w-[560px]">
      <DialogHeader title={title} description={description} />

      <div className="mt-6 space-y-4">
        <label className="block">
          <span className="text-[13px] font-medium text-text">工作区目录</span>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input
              value={value}
              onChange={(event) => setValue(event.target.value)}
              placeholder={placeholder}
              className="min-w-0 flex-1 rounded-[18px] border border-line bg-surface px-4 py-3 text-[14px] text-text outline-none transition focus:border-text"
              disabled={isSaving}
            />
            <button
              type="button"
              onClick={() => void handlePickDirectory()}
              disabled={isSaving || isPicking}
              className="rounded-[18px] border border-line bg-surface-muted px-4 py-3 text-[13px] font-medium text-text transition hover:bg-[#efeff1] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isPicking ? "打开中..." : "选择目录"}
            </button>
          </div>
        </label>

        {allowEmpty && defaultHint ? (
          <p className="text-[12px] leading-6 text-muted-strong">
            留空后会恢复默认工作区：{defaultHint}
          </p>
        ) : null}

        {errorMessage ? <p className="text-[13px] text-[#a34942]">{errorMessage}</p> : null}
      </div>

      <DialogActions>
        {allowEmpty ? (
          <DialogSecondaryButton
            onClick={() => {
              setValue("");
              setErrorMessage(null);
            }}
            disabled={isSaving}
          >
            恢复默认
          </DialogSecondaryButton>
        ) : null}
        <DialogSecondaryButton onClick={onClose} disabled={isSaving}>
          取消
        </DialogSecondaryButton>
        <DialogPrimaryButton
          onClick={() => void handleConfirm()}
          disabled={isSaving || (!allowEmpty && !value.trim())}
        >
          {isSaving ? "保存中..." : confirmLabel}
        </DialogPrimaryButton>
      </DialogActions>
    </DialogShell>
  );
}
