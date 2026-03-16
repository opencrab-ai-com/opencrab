type PageHeaderProps = {
  title: string;
  description: string;
};

export function PageHeader({ title, description }: PageHeaderProps) {
  return (
    <div className="mb-10">
      <p className="text-[13px] text-muted">OpenCrab</p>
      <h1 className="mt-2 text-[28px] font-semibold tracking-[-0.04em] text-text">{title}</h1>
      <p className="mt-3 max-w-[640px] text-[14px] leading-6 text-muted-strong">{description}</p>
    </div>
  );
}
