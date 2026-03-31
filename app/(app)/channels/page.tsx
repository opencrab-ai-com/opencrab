import Link from "next/link";
import { AppPage } from "@/components/ui/app-page";
import { PageHeader } from "@/components/ui/page-header";
import { StatusPill as UnifiedStatusPill } from "@/components/ui/pill";
import {
  getChannelOverviewList,
  getChannelStatusLabel,
} from "@/lib/channels/channel-store";
import { ensureChannelRuntimeReady } from "@/lib/runtime/runtime-startup";
import type { ChannelOverview } from "@/lib/channels/types";

export const dynamic = "force-dynamic";

export default async function ChannelsPage() {
  ensureChannelRuntimeReady();

  const channels = getChannelOverviewList();

  return (
    <AppPage width="wide" contentClassName="space-y-8">
      <PageHeader
        title="渠道"
        description="配置和管理 OpenCrab 可用的消息入口。"
      />

      <div className="grid gap-5 lg:grid-cols-2">
        {channels.map((channel) => (
          <Link
            key={channel.id}
            href={`/channels/${channel.id}`}
            className="group rounded-[28px] border border-line bg-surface p-6 shadow-soft transition hover:-translate-y-0.5 hover:border-text/20"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-[14px] border border-line bg-surface-muted text-[16px] font-semibold text-text">
                    {channel.id === "telegram" ? "TG" : "FS"}
                  </div>
                  <div>
                    <h2 className="text-[22px] font-semibold tracking-[-0.04em] text-text">
                      {channel.name}
                    </h2>
                    <div className="mt-1 text-[12px] text-muted">
                      {channel.id === "telegram" ? "Telegram 私聊入口" : "企业协作入口"}
                    </div>
                  </div>
                </div>
                <p className="mt-4 max-w-[46ch] text-[14px] leading-6 text-muted-strong">
                  {channel.id === "telegram"
                    ? "适合先跑通 Telegram 私聊链路，配置简单，回推也直接。"
                    : "默认使用飞书长连接收消息，不需要公网地址，适合作为企业内协作入口。"}
                </p>
                <div className="mt-4 rounded-[18px] border border-line bg-background px-4 py-4">
                  <div className="text-[12px] font-medium text-text">
                    {buildChannelHeadline(channel)}
                  </div>
                  <div className="mt-2 text-[13px] leading-6 text-muted">
                    {buildChannelDescription(channel)}
                  </div>
                </div>
              </div>
              <StatusBadge channel={channel} />
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <MetricCard label="会话绑定" value={`${channel.bindingCount}`} />
              <MetricCard label="最近事件" value={`${channel.recentEventCount}`} />
            </div>

            {channel.lastError ? (
              <p className="mt-4 rounded-[14px] border border-[#f3d0cb] bg-[#fff3f1] px-3 py-2 text-[13px] text-[#b42318]">
                最近错误：{channel.lastError}
              </p>
            ) : null}

            <div className="mt-5 flex items-center justify-between text-[13px] text-muted-strong">
              <span>查看配置、绑定关系和最近事件</span>
              <span className="transition group-hover:translate-x-0.5">进入详情 {"->"}</span>
            </div>
          </Link>
        ))}
      </div>
    </AppPage>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[18px] border border-line bg-background px-4 py-4">
      <div className="text-[11px] text-muted">{label}</div>
      <div className="mt-2 text-[24px] font-semibold tracking-[-0.04em] text-text">{value}</div>
    </div>
  );
}

function StatusBadge({ channel }: { channel: ChannelOverview }) {
  const tone =
    channel.status === "ready"
      ? "success"
      : channel.status === "connecting"
        ? "info"
        : channel.status === "error"
          ? "danger"
          : "neutral";

  return <UnifiedStatusPill tone={tone}>{getChannelStatusLabel(channel.status)}</UnifiedStatusPill>;
}

function buildChannelHeadline(channel: ChannelOverview) {
  if (channel.id === "telegram") {
    return channel.configSummary.botUsername
      ? `当前机器人：${channel.configSummary.botUsername}`
      : "还没有绑定 Telegram 机器人";
  }

  return channel.configSummary.appId
    ? `当前应用：${channel.configSummary.appId}`
    : "还没有配置飞书应用";
}

function buildChannelDescription(channel: ChannelOverview) {
  if (channel.id === "telegram") {
    if (!channel.configSummary.hasBotToken) {
      return "填入机器人令牌后，OpenCrab 会尽量帮你自动连上 Telegram。";
    }

  if (channel.status === "disconnected") {
    return "凭证已经保存，但当前没有连上。进入详情页后可以重新连接或断开。";
  }

  if (channel.status === "connecting") {
    return "OpenCrab 已经开始尝试连 Telegram，但还在等待平台确认当前连接状态。";
  }

  if (channel.status === "ready") {
    return "已经连上 Telegram，可以直接给机器人发消息，OpenCrab 会自动创建或续接对话。";
  }

    return "正在等待连接完成，或者需要重新检查当前 webhook 状态。";
  }

  if (!channel.configSummary.hasAppId || !channel.configSummary.hasAppSecret) {
    return "先填应用 ID 和应用密钥，OpenCrab 会自动校验并启动飞书长连接。";
  }

  if (channel.status === "disconnected") {
    return "凭证已经保存，但长连接当前未启动。进入详情页后可以重新连接或断开。";
  }

  if (channel.status === "connecting") {
    return "凭证已通过，OpenCrab 正在建立飞书长连接。请保持应用运行，然后回到飞书开放平台点保存。";
  }

  if (channel.status === "ready") {
    return "飞书长连接已经就绪，适合接企业内部的协作消息。";
  }

  return "OpenCrab 正在校验或恢复飞书连接，必要时可以进入详情页手动检查。";
}
