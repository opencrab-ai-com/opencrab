type StatusCardProps = {
  label: string;
  value: string;
};

export function StatusCard({ label, value }: StatusCardProps) {
  return (
    <div className="rounded-[16px] border border-line bg-surface px-4 py-3">
      <div className="text-[11px] text-muted">{label}</div>
      <div className="mt-1 text-[13px] font-medium text-text">{value}</div>
    </div>
  );
}
