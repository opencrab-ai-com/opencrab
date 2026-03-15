type DetailCardProps = {
  title: string;
  description: string;
  meta?: string;
};

export function DetailCard({ title, description, meta }: DetailCardProps) {
  return (
    <div className="rounded-[24px] border border-line bg-surface p-6 shadow-soft">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-[20px] font-semibold tracking-[-0.03em] text-text">{title}</h2>
          <p className="mt-3 text-[15px] leading-7 text-muted-strong">{description}</p>
        </div>
        {meta ? (
          <div className="rounded-full border border-line bg-surface-muted px-4 py-2 text-sm text-muted-strong">
            {meta}
          </div>
        ) : null}
      </div>
    </div>
  );
}
