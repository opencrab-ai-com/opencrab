"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { TaskDetail, TaskSchedule } from "@/lib/resources/opencrab-api-types";

type TaskFormValue = {
  name: string;
  prompt: string;
  timezone: string | null;
  schedule: TaskSchedule;
};

type TaskFormProps = {
  initialTask?: TaskDetail | null;
  initialValue?: Partial<TaskFormValue> | null;
  title?: string;
  description?: string;
  submitLabel: string;
  isSubmitting?: boolean;
  message?: string | null;
  messageTone?: "default" | "success" | "error";
  onSubmit: (value: TaskFormValue) => Promise<void>;
};

const PRESET_OPTIONS = [
  { value: "daily", label: "每天" },
  { value: "weekdays", label: "工作日" },
  { value: "weekly", label: "每周" },
  { value: "interval", label: "每隔几分钟" },
] as const;

export function TaskForm({
  initialTask = null,
  initialValue = null,
  title,
  description,
  submitLabel,
  isSubmitting = false,
  message = null,
  messageTone = "default",
  onSubmit,
}: TaskFormProps) {
  const seed = initialValue ?? initialTask;
  const [name, setName] = useState(seed?.name || "");
  const [prompt, setPrompt] = useState(seed?.prompt || "");
  const [preset, setPreset] = useState<TaskSchedule["preset"]>(
    seed?.schedule?.preset || "daily",
  );
  const [time, setTime] = useState(seed?.schedule?.time || "09:00");
  const [weekday, setWeekday] = useState(seed?.schedule?.weekday ?? 1);
  const [intervalMinutes, setIntervalMinutes] = useState(
    seed?.schedule?.intervalMinutes ?? ((seed?.schedule?.intervalHours ?? 0) > 0
      ? (seed?.schedule?.intervalHours as number) * 60
      : 5),
  );

  async function handleSubmit() {
    await onSubmit({
      name,
      prompt,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || null,
      schedule:
        preset === "interval"
          ? {
              preset,
              intervalMinutes,
            }
          : preset === "weekly"
            ? {
                preset,
                time,
                weekday,
              }
            : {
                preset,
                time,
              },
    });
  }

  const resolvedTitle = title ?? (initialTask ? "定时任务设置" : "新建定时任务");
  const resolvedDescription =
    description ?? "只需要告诉 OpenCrab：这个定时任务做什么、什么时候做。";

  return (
    <section className="rounded-[24px] border border-line bg-surface p-6 shadow-soft">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-[18px] font-semibold tracking-[-0.03em] text-text">
            {resolvedTitle}
          </h2>
          <p className="mt-2 text-[14px] leading-6 text-muted-strong">
            {resolvedDescription}
          </p>
        </div>
        <Button
          onClick={() => void handleSubmit()}
          disabled={isSubmitting}
          variant="primary"
          className="shrink-0"
        >
          {isSubmitting ? "保存中..." : submitLabel}
        </Button>
      </div>

      <div className="mt-6 grid gap-4">
        <label className="block">
          <span className="text-[12px] font-medium text-muted-strong">定时任务名称</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="例如：每天整理产品日报"
            className="mt-2 h-12 w-full rounded-[16px] border border-line bg-background px-4 text-[14px] text-text outline-none transition focus:border-text"
          />
        </label>

        <label className="block">
          <span className="text-[12px] font-medium text-muted-strong">要做什么</span>
          <textarea
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            rows={5}
            placeholder="例如：每天早上整理昨天的对话重点，输出一份简洁的进展摘要和待办建议。"
            className="mt-2 w-full rounded-[16px] border border-line bg-background px-4 py-3 text-[14px] leading-7 text-text outline-none transition focus:border-text"
          />
        </label>

        <div className="grid gap-4 md:grid-cols-[1.2fr_1fr]">
          <label className="block">
            <span className="text-[12px] font-medium text-muted-strong">什么时候执行</span>
            <select
              value={preset}
              onChange={(event) => setPreset(event.target.value as TaskSchedule["preset"])}
              className="mt-2 h-12 w-full rounded-[16px] border border-line bg-background px-4 text-[14px] text-text outline-none transition focus:border-text"
            >
              {PRESET_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          {preset === "interval" ? (
            <label className="block">
              <span className="text-[12px] font-medium text-muted-strong">执行间隔</span>
              <div className="mt-2 flex items-center gap-3 rounded-[16px] border border-line bg-background px-4">
                <input
                  value={intervalMinutes}
                  onChange={(event) => setIntervalMinutes(Number(event.target.value) || 1)}
                  type="number"
                  min={1}
                  max={1440}
                  className="h-12 w-full bg-transparent text-[14px] text-text outline-none"
                />
                <span className="text-[13px] text-muted">分钟</span>
              </div>
            </label>
          ) : (
            <label className="block">
              <span className="text-[12px] font-medium text-muted-strong">
                {preset === "weekly" ? "星期和时间" : "执行时间"}
              </span>
              <div className={`mt-2 grid gap-3 ${preset === "weekly" ? "grid-cols-[0.9fr_1fr]" : ""}`}>
                {preset === "weekly" ? (
                  <select
                    value={weekday}
                    onChange={(event) => setWeekday(Number(event.target.value))}
                    className="h-12 rounded-[16px] border border-line bg-background px-4 text-[14px] text-text outline-none transition focus:border-text"
                  >
                    {["周日", "周一", "周二", "周三", "周四", "周五", "周六"].map((label, index) => (
                      <option key={label} value={index}>
                        {label}
                      </option>
                    ))}
                  </select>
                ) : null}
                <input
                  value={time}
                  onChange={(event) => setTime(event.target.value)}
                  type="time"
                  className="h-12 rounded-[16px] border border-line bg-background px-4 text-[14px] text-text outline-none transition focus:border-text"
                />
              </div>
            </label>
          )}
        </div>
      </div>

      {message ? (
        <p
          className={`mt-4 rounded-[16px] border px-4 py-3 text-[13px] ${
            messageTone === "success"
              ? "border-[#cfe7d4] bg-[#eef8f0] text-[#23633a]"
              : messageTone === "error"
                ? "border-[#f3d0cb] bg-[#fff3f1] text-[#b42318]"
                : "border-line bg-background text-muted-strong"
          }`}
        >
          {message}
        </p>
      ) : null}
    </section>
  );
}
