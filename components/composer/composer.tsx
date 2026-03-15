type ComposerProps = {
  placeholder?: string;
  showModelChip?: boolean;
  showReasoningChip?: boolean;
};

export function Composer({
  placeholder = "发一句话，或上传文件开始",
  showModelChip = true,
  showReasoningChip = true,
}: ComposerProps) {
  return (
    <div className="w-full max-w-[1040px] rounded-[28px] border border-line-strong bg-surface px-4 pt-4 pb-3 shadow-soft">
      <textarea
        className="min-h-[88px] w-full resize-none border-0 bg-transparent text-[18px] leading-8 text-text outline-none placeholder:text-[#a0a097]"
        placeholder={placeholder}
        readOnly
      />

      <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <button className="flex h-9 w-9 items-center justify-center rounded-full border border-transparent text-muted-strong transition hover:bg-surface-muted">
            <PlusIcon />
          </button>
          {showReasoningChip ? (
            <button className="rounded-full border border-line bg-surface-muted px-4 py-2 text-sm text-[#247cff] transition hover:bg-[#f0f4ff]">
              推理增强
            </button>
          ) : null}
          {showModelChip ? (
            <button className="rounded-full border border-line bg-surface-muted px-4 py-2 text-sm text-[#247cff] transition hover:bg-[#f0f4ff]">
              模型
            </button>
          ) : null}
        </div>

        <div className="flex items-center justify-end gap-2">
          <button className="flex h-11 w-11 items-center justify-center rounded-full bg-[#111111] text-white transition hover:bg-[#262626]">
            <SendIcon />
          </button>
        </div>
      </div>
    </div>
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
