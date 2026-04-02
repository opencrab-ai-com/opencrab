"use client";

import { useEffect, useState } from "react";
import {
  DialogActions,
  DialogHeader,
  DialogPrimaryButton,
  DialogSecondaryButton,
  DialogShell,
} from "@/components/ui/dialog";

type FeishuChatSessionDialogProps = {
  title: string;
  description: string;
  initialValue?: string | null;
  placeholder?: string;
  confirmLabel?: string;
  clearLabel?: string;
  onClose: () => void;
  onConfirm: (value: string | null) => Promise<void> | void;
};

export function FeishuChatSessionDialog({
  title,
  description,
  initialValue,
  placeholder = "oc_team_room_001",
  confirmLabel = "保存绑定",
  clearLabel = "清空绑定",
  onClose,
  onConfirm,
}: FeishuChatSessionDialogProps) {
  const [value, setValue] = useState(initialValue?.trim() || "");
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    setValue(initialValue?.trim() || "");
  }, [initialValue]);

  async function handleConfirm() {
    const trimmedValue = value.trim();

    setIsSaving(true);
    setErrorMessage(null);

    try {
      await onConfirm(trimmedValue || null);
      onClose();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "保存飞书会话绑定失败。");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <DialogShell onClose={() => (isSaving ? null : onClose())} panelClassName="max-w-[560px]">
      <DialogHeader title={title} description={description} />

      <div className="mt-6 space-y-4">
        <label className="block">
          <span className="text-[13px] font-medium text-text">飞书群聊会话 ID</span>
          <textarea
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder={placeholder}
            rows={3}
            className="mt-3 min-h-[108px] w-full resize-none rounded-[18px] border border-line bg-surface px-4 py-3 text-[14px] leading-6 text-text outline-none transition focus:border-text"
            disabled={isSaving}
          />
        </label>

        <p className="text-[12px] leading-6 text-muted-strong">
          留空后会清空当前绑定。保存后，后续同一个飞书群聊会话发来的消息就会接回这条对话。
        </p>

        {errorMessage ? <p className="text-[13px] text-[#a34942]">{errorMessage}</p> : null}
      </div>

      <DialogActions>
        <DialogSecondaryButton
          onClick={() => {
            setValue("");
            setErrorMessage(null);
          }}
          disabled={isSaving}
        >
          {clearLabel}
        </DialogSecondaryButton>
        <DialogSecondaryButton onClick={onClose} disabled={isSaving}>
          取消
        </DialogSecondaryButton>
        <DialogPrimaryButton onClick={() => void handleConfirm()} disabled={isSaving}>
          {isSaving ? "保存中..." : confirmLabel}
        </DialogPrimaryButton>
      </DialogActions>
    </DialogShell>
  );
}
