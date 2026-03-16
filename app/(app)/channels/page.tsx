import Link from "next/link";
import { AppPage } from "@/components/ui/app-page";
import { PageHeader } from "@/components/ui/page-header";
import { ensureChannelStartupSync } from "@/lib/channels/channel-startup";
import {
  getChannelOverviewList,
  getPublicBaseUrl,
  getChannelStatusLabel,
} from "@/lib/channels/channel-store";
import {
  syncAllChannelConfigsFromSecrets,
} from "@/lib/channels/secret-store";
import type { ChannelOverview } from "@/lib/channels/types";

export const dynamic = "force-dynamic";

export default async function ChannelsPage() {
  syncAllChannelConfigsFromSecrets();
  void ensureChannelStartupSync();

  const channels = getChannelOverviewList();
  const publicBaseUrl = getPublicBaseUrl();

  return (
    <AppPage width="wide" contentClassName="space-y-8">
      <PageHeader title="Channels" />

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
                      {channel.id === "telegram" ? "Bot 私聊入口" : "企业协作入口"}
                    </div>
                  </div>
                </div>
                <p className="mt-4 max-w-[46ch] text-[14px] leading-6 text-muted-strong">
                  {channel.id === "telegram"
                    ? "适合先跑通 Bot 私聊链路，配置简单，回推也直接。"
                    : "支持飞书事件订阅与机器人回消息，适合作为企业内协作入口。"}
                </p>
                {channel.id === "telegram" ? (
                  <div className="mt-3 space-y-1 text-[12px] text-muted">
                    <div>Bot：{channel.configSummary.botUsername || "还没校验到 Bot 身份"}</div>
                    <div>
                      Webhook：
                      {channel.configSummary.webhookConfigured
                        ? " 已连接"
                        : channel.configSummary.webhookSetupMode === "pending_public_url"
                          ? " 等待一键生成地址"
                          : channel.configSummary.hasBotToken
                            ? " 待绑定"
                            : " 未配置"}
                    </div>
                    <div>下一步：{buildNextStepHint(channel, publicBaseUrl)}</div>
                  </div>
                ) : (
                  <div className="mt-3 space-y-1 text-[12px] text-muted">
                    <div>App：{channel.configSummary.appId || "还没有配置 App ID"}</div>
                    <div>
                      凭证：
                      {channel.configSummary.credentialsVerified
                        ? " 已校验"
                        : channel.configSummary.hasAppId && channel.configSummary.hasAppSecret
                          ? " 待校验"
                          : " 未配置"}
                    </div>
                    <div>下一步：{buildNextStepHint(channel, publicBaseUrl)}</div>
                  </div>
                )}
              </div>
              <StatusBadge channel={channel} />
            </div>

            <div className="mt-6 flex flex-wrap gap-2">
              <CapabilityPill>
                {channel.id === "telegram" ? "Webhook + sendMessage" : "事件订阅 + 回推消息"}
              </CapabilityPill>
              <CapabilityPill>自动会话绑定</CapabilityPill>
              <CapabilityPill>最近事件追踪</CapabilityPill>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <MetricCard label="会话绑定" value={`${channel.bindingCount}`} />
              <MetricCard label="最近事件" value={`${channel.recentEventCount}`} />
            </div>

            <div className="mt-4 rounded-[18px] border border-line bg-[#fbfaf6] px-4 py-4">
              <div className="text-[11px] uppercase tracking-[0.12em] text-muted">Webhook</div>
              <div className="mt-2 break-all font-mono text-[12px] leading-6 text-muted-strong">
                {channel.configSummary.webhookUrl || channel.configSummary.webhookPath}
              </div>
              {channel.id === "telegram" && channel.configSummary.currentWebhookUrl ? (
                <div className="mt-3 text-[12px] text-muted">
                  当前 Telegram 地址：
                  <span className="ml-1 break-all font-mono text-[11px]">
                    {channel.configSummary.currentWebhookUrl}
                  </span>
                </div>
              ) : null}
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

function CapabilityPill({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-line bg-background px-3 py-1.5 text-[12px] text-muted-strong">
      {children}
    </span>
  );
}

function StatusBadge({ channel }: { channel: ChannelOverview }) {
  const tone =
    channel.status === "ready"
      ? "border-[#cfe7d4] bg-[#eef8f0] text-[#23633a]"
      : channel.status === "error"
        ? "border-[#f3d0cb] bg-[#fff3f1] text-[#b42318]"
        : "border-line bg-surface-muted text-muted-strong";

  return (
    <span
      className={`shrink-0 rounded-full border px-3 py-1.5 text-[12px] font-medium ${tone}`}
    >
      {getChannelStatusLabel(channel.status)}
    </span>
  );
}

function buildNextStepHint(channel: ChannelOverview, publicBaseUrl: string | null) {
  if (channel.id === "telegram") {
    if (!channel.configSummary.hasBotToken) {
      return "先填 Bot Token";
    }

    if (!publicBaseUrl) {
      return "进入详情页一键生成公网地址";
    }

    if (!channel.configSummary.webhookConfigured) {
      return "进入详情页重新绑定 Webhook";
    }

    return "可以开始真实消息联调";
  }

  if (!channel.configSummary.hasAppId || !channel.configSummary.hasAppSecret) {
    return "先填 App ID 和 App Secret";
  }

  if (!channel.configSummary.credentialsVerified) {
    return "进入详情页刷新飞书凭证状态";
  }

  if (!publicBaseUrl) {
    return "进入详情页一键生成公网地址";
  }

  return "去飞书开放平台完成事件订阅";
}
