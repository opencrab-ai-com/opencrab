import { Composer } from "@/components/composer/composer";

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col">
      <div className="flex items-center px-6 pt-5 lg:px-8">
        <h1 className="text-[21px] font-semibold tracking-[-0.03em] text-text">OpenCrab</h1>
      </div>

      <section className="flex flex-1 flex-col items-center justify-center gap-8 px-6 pb-14 text-center lg:px-8">
        <div className="space-y-3">
          <h2 className="text-[44px] font-semibold tracking-[-0.05em] text-text sm:text-[56px]">
            今天你想处理什么？
          </h2>
          <p className="text-[16px] text-muted-strong">发一句话，或上传文件开始。</p>
        </div>

        <Composer />
      </section>
    </div>
  );
}
