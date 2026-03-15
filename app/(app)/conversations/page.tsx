import { Composer } from "@/components/composer/composer";

export default function ConversationsPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <div className="flex items-center px-6 pt-5 lg:px-8">
        <h1 className="text-[21px] font-semibold tracking-[-0.03em] text-text">OpenCrab</h1>
      </div>

      <section className="flex flex-1 flex-col items-center justify-center gap-8 px-6 pb-14 text-center lg:px-8">
        <div className="space-y-3">
          <h2 className="text-[40px] font-semibold tracking-[-0.05em] text-text sm:text-[52px]">
            选择一个对话，或开始新的对话
          </h2>
          <p className="text-[16px] text-muted-strong">历史对话和文件夹仍保留在左侧。</p>
        </div>

        <Composer />
      </section>
    </div>
  );
}
