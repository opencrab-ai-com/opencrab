"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type {
  CodexModelOption,
  CodexReasoningEffort,
  UploadedAttachment,
} from "@/lib/resources/opencrab-api-types";

export type ComposerSubmitInput = {
  content: string;
  attachments: UploadedAttachment[];
};

type ComposerProps = {
  placeholder?: string;
  value?: string;
  onChange?: (value: string) => void;
  onSubmit?: (value: ComposerSubmitInput) => boolean | void | Promise<boolean | void>;
  onUploadFiles?: (files: File[]) => Promise<UploadedAttachment[]>;
  onStop?: () => void;
  submitLabel?: string;
  autoFocus?: boolean;
  disabled?: boolean;
  isUploading?: boolean;
  isStreaming?: boolean;
  modelOptions: CodexModelOption[];
  selectedModel: string;
  selectedReasoningEffort: CodexReasoningEffort;
  onModelChange: (model: string) => Promise<void>;
  onReasoningEffortChange: (effort: CodexReasoningEffort) => Promise<void>;
};

export function Composer({
  placeholder = "发一句话，或上传文件开始",
  value,
  onChange,
  onSubmit,
  onUploadFiles,
  onStop,
  submitLabel = "发送",
  autoFocus = false,
  disabled = false,
  isUploading = false,
  isStreaming = false,
  modelOptions,
  selectedModel,
  selectedReasoningEffort,
  onModelChange,
  onReasoningEffortChange,
}: ComposerProps) {
  const [internalValue, setInternalValue] = useState(value ?? "");
  const [attachments, setAttachments] = useState<UploadedAttachment[]>([]);
  const [isUploadMenuOpen, setIsUploadMenuOpen] = useState(false);
  const [activeMenu, setActiveMenu] = useState<null | "model" | "reasoning">(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const textInputRef = useRef<HTMLInputElement | null>(null);
  const currentValue = value ?? internalValue;

  const selectedModelOption = useMemo(
    () => modelOptions.find((item) => item.id === selectedModel) || modelOptions[0] || null,
    [modelOptions, selectedModel],
  );
  const reasoningOptions = selectedModelOption?.reasoningOptions || [];
  const selectedReasoningOption =
    reasoningOptions.find((item) => item.effort === selectedReasoningEffort) || reasoningOptions[0] || null;

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsUploadMenuOpen(false);
        setActiveMenu(null);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, []);

  function handleChange(nextValue: string) {
    if (typeof value !== "string") {
      setInternalValue(nextValue);
    }

    onChange?.(nextValue);
  }

  async function handleSubmit() {
    const trimmedValue = currentValue.trim();

    if ((!trimmedValue && attachments.length === 0) || disabled) {
      return;
    }

    const result = await onSubmit?.({
      content: trimmedValue,
      attachments,
    });

    if (result === false) {
      return;
    }

    if (typeof value !== "string") {
      setInternalValue("");
    }

    setAttachments([]);
  }

  async function handleFilesSelected(fileList: FileList | null) {
    const files = Array.from(fileList || []);

    if (!files.length || !onUploadFiles) {
      return;
    }

    const uploaded = await onUploadFiles(files);

    if (uploaded.length > 0) {
      setAttachments((current) => [...current, ...uploaded]);
    }

    setIsUploadMenuOpen(false);
  }

  function removeAttachment(attachmentId: string) {
    setAttachments((current) => current.filter((item) => item.id !== attachmentId));
  }

  return (
    <div
      ref={containerRef}
      className="w-full max-w-[1040px] rounded-[28px] border border-line-strong bg-surface px-4 pt-4 pb-3 shadow-soft"
    >
      {attachments.length > 0 ? (
        <div className="mb-3 flex flex-wrap gap-2">
          {attachments.map((attachment) => (
            <button
              key={attachment.id}
              type="button"
              onClick={() => removeAttachment(attachment.id)}
              className="flex items-center gap-2 rounded-full border border-line bg-surface-muted px-3 py-1.5 text-[13px] text-text transition hover:bg-[#f0efe9]"
            >
              <AttachmentKindIcon kind={attachment.kind} />
              <span>{attachment.name}</span>
              <span className="text-muted-strong">×</span>
            </button>
          ))}
        </div>
      ) : null}

      <textarea
        id="opencrab-composer"
        name="opencrab_composer"
        className="min-h-[88px] w-full resize-none border-0 bg-transparent text-[18px] leading-8 text-text outline-none placeholder:text-[#a0a097] disabled:cursor-not-allowed"
        placeholder={placeholder}
        value={currentValue}
        disabled={disabled || isStreaming}
        onChange={(event) => handleChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            void handleSubmit();
          }
        }}
        autoFocus={autoFocus}
      />

      <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setIsUploadMenuOpen((current) => !current);
                setActiveMenu(null);
              }}
              className="flex h-11 w-11 items-center justify-center rounded-full border border-[#0b66da] text-[#0b66da] transition hover:bg-[#eef5ff] disabled:opacity-50"
              disabled={disabled || isUploading || isStreaming}
              aria-label="添加文件"
            >
              <PlusIcon />
            </button>

            {isUploadMenuOpen ? (
              <div className="absolute bottom-[calc(100%+10px)] left-0 z-20 min-w-[168px] rounded-[20px] border border-line bg-surface p-2 shadow-[0_18px_48px_rgba(15,23,42,0.14)]">
                <button
                  type="button"
                  onClick={() => imageInputRef.current?.click()}
                  className="flex w-full items-center gap-3 rounded-[14px] px-3 py-2.5 text-left text-[14px] text-text transition hover:bg-surface-muted"
                >
                  <ImageIcon />
                  <span>上传图片</span>
                </button>
                <button
                  type="button"
                  onClick={() => textInputRef.current?.click()}
                  className="flex w-full items-center gap-3 rounded-[14px] px-3 py-2.5 text-left text-[14px] text-text transition hover:bg-surface-muted"
                >
                  <TextFileIcon />
                  <span>上传文本文件</span>
                </button>
              </div>
            ) : null}

            <input
              ref={imageInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              multiple
              className="hidden"
              onChange={(event) => void handleFilesSelected(event.target.files)}
            />
            <input
              ref={textInputRef}
              type="file"
              accept=".txt,.md,.markdown,.json,.csv,.ts,.tsx,.js,.jsx,.py,.html,.css,.xml,.yml,.yaml,text/*,application/json"
              multiple
              className="hidden"
              onChange={(event) => void handleFilesSelected(event.target.files)}
            />
          </div>

          <DropdownChip
            label={selectedReasoningOption?.label || "推理强度"}
            valueLabel={selectedReasoningOption ? undefined : "推理强度"}
            isOpen={activeMenu === "reasoning"}
            onToggle={() => {
              setActiveMenu((current) => (current === "reasoning" ? null : "reasoning"));
              setIsUploadMenuOpen(false);
            }}
            disabled={disabled || isStreaming || reasoningOptions.length === 0}
          >
            {reasoningOptions.map((option) => (
              <MenuItem
                key={option.effort}
                title={option.label}
                description={option.description}
                isActive={option.effort === selectedReasoningEffort}
                compact
                onClick={async () => {
                  await onReasoningEffortChange(option.effort);
                  setActiveMenu(null);
                }}
              />
            ))}
          </DropdownChip>

          <DropdownChip
            label={selectedModelOption?.label || "模型"}
            valueLabel={selectedModelOption ? undefined : "模型"}
            isOpen={activeMenu === "model"}
            onToggle={() => {
              setActiveMenu((current) => (current === "model" ? null : "model"));
              setIsUploadMenuOpen(false);
            }}
            disabled={disabled || isStreaming || modelOptions.length === 0}
          >
            {modelOptions.map((option) => (
              <MenuItem
                key={option.id}
                title={option.label}
                description=""
                isActive={option.id === selectedModel}
                compact
                onClick={async () => {
                  await onModelChange(option.id);
                  setActiveMenu(null);
                }}
              />
            ))}
          </DropdownChip>

          {isUploading ? <p className="text-[13px] text-muted-strong">正在上传附件...</p> : null}
        </div>

        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => {
              if (isStreaming) {
                onStop?.();
                return;
              }

              void handleSubmit();
            }}
            disabled={isStreaming ? false : (!currentValue.trim() && attachments.length === 0) || disabled}
            aria-label={submitLabel}
            className={`flex h-11 w-11 items-center justify-center rounded-full text-white transition ${
              isStreaming
                ? "bg-[#d45745] hover:bg-[#bf4635]"
                : "bg-[#111111] hover:bg-[#262626] disabled:cursor-not-allowed disabled:bg-[#c9c9c5]"
            }`}
          >
            {isStreaming ? <StopIcon /> : <SendIcon />}
          </button>
        </div>
      </div>
    </div>
  );
}

type DropdownChipProps = {
  label: string;
  valueLabel?: string;
  isOpen: boolean;
  onToggle: () => void;
  disabled?: boolean;
  children: React.ReactNode;
};

function DropdownChip({
  label,
  valueLabel,
  isOpen,
  onToggle,
  disabled = false,
  children,
}: DropdownChipProps) {
  return (
    <div className="relative">
      <button
        type="button"
        onClick={onToggle}
        disabled={disabled}
        className="flex min-h-11 items-center gap-2 rounded-full border border-line bg-surface-muted px-4 py-2 text-[15px] text-[#247cff] transition hover:bg-[#f0f4ff] disabled:opacity-50"
      >
        <span>{valueLabel || label}</span>
        <ChevronDownIcon />
      </button>

      {isOpen ? (
        <div className="absolute bottom-[calc(100%+10px)] left-0 z-20 max-h-[280px] min-w-[180px] overflow-y-auto rounded-[18px] border border-line bg-surface p-1.5 shadow-[0_18px_48px_rgba(15,23,42,0.14)]">
          {children}
        </div>
      ) : null}
    </div>
  );
}

type MenuItemProps = {
  title: string;
  description: string;
  isActive: boolean;
  compact?: boolean;
  onClick: () => void | Promise<void>;
};

function MenuItem({ title, description, isActive, compact = false, onClick }: MenuItemProps) {
  return (
    <button
      type="button"
      onClick={() => void onClick()}
      className={`flex w-full flex-col items-start gap-1 rounded-[12px] px-3 ${compact ? "py-2" : "py-2.5"} text-left transition ${
        isActive ? "bg-[#eef5ff]" : "hover:bg-surface-muted"
      }`}
    >
      <span className={`${compact ? "text-[13px]" : "text-[14px]"} font-medium text-text`}>{title}</span>
      {!compact && description ? (
        <span className="text-[12px] leading-5 text-muted-strong">{description}</span>
      ) : null}
    </button>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px] stroke-current" strokeWidth="1.8">
      <path d="M12 5v14M5 12h14" strokeLinecap="round" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px] stroke-current" strokeWidth="1.8">
      <path d="m5 12 13-6-3 6 3 6z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-[16px] w-[16px] fill-current">
      <rect x="7" y="7" width="10" height="10" rx="2.5" />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4 fill-none stroke-current" strokeWidth="1.8">
      <path d="m5.5 7.5 4.5 5 4.5-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ImageIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4 fill-none stroke-current" strokeWidth="1.8">
      <rect x="2.5" y="3.5" width="15" height="13" rx="2.5" />
      <circle cx="7" cy="8" r="1.5" />
      <path d="m17.5 13-3.5-3.5L7 16.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TextFileIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4 fill-none stroke-current" strokeWidth="1.8">
      <path d="M6 2.5h5l3 3V16a1.5 1.5 0 0 1-1.5 1.5h-6A1.5 1.5 0 0 1 5 16V4A1.5 1.5 0 0 1 6.5 2.5" />
      <path d="M11 2.5V6h3.5" />
      <path d="M7.5 9h5M7.5 12h5M7.5 15H11" strokeLinecap="round" />
    </svg>
  );
}

function AttachmentKindIcon({ kind }: { kind: UploadedAttachment["kind"] }) {
  return kind === "image" ? <ImageIcon /> : <TextFileIcon />;
}
