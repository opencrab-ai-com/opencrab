export function ChannelChecklistItem({
  title,
  description,
  mono = false,
}: {
  title: string;
  description: string;
  mono?: boolean;
}) {
  return (
    <div className="rounded-[16px] border border-line bg-background px-4 py-3">
      <div className="text-[13px] font-medium text-text">{title}</div>
      <div
        className={`mt-1 text-[13px] leading-6 text-muted-strong ${mono ? "break-all font-mono text-[12px]" : ""}`}
      >
        {description}
      </div>
    </div>
  );
}
