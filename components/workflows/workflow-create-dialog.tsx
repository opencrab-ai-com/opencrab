"use client";

import { useEffect, useState } from "react";
import {
  DialogActions,
  DialogHeader,
  DialogPrimaryButton,
  DialogSecondaryButton,
  DialogShell,
} from "@/components/ui/dialog";
import type { WorkflowDetailResponse } from "@/lib/resources/opencrab-api-types";

type WorkflowCreateDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (workflowId: string) => void;
};

type CreateMode = "blank" | "ai";

export function WorkflowCreateDialog({
  isOpen,
  onClose,
  onCreated,
}: WorkflowCreateDialogProps) {
  const [mode, setMode] = useState<CreateMode>("blank");
  const [name, setName] = useState("内容周报流");
  const [goalPrompt, setGoalPrompt] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setMode("blank");
    setName("内容周报流");
    setGoalPrompt("");
    setIsSubmitting(false);
    setErrorMessage(null);
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  async function handleCreate() {
    const trimmedName = name.trim();
    const trimmedGoalPrompt = goalPrompt.trim();

    if (!trimmedName) {
      setErrorMessage("请输入工作流名称。");
      return;
    }

    if (mode === "ai" && !trimmedGoalPrompt) {
      setErrorMessage("请先描述你希望 AI 生成的流程目标。");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/workflows/draft", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mode,
          name: trimmedName,
          description:
            mode === "ai"
              ? "由 AI 生成初稿后，可在编辑器继续完善。"
              : "从这里开始搭建一个可复用的自动化流程。",
          ownerType: "person",
          ownerId: "person-self",
          goalPrompt: mode === "ai" ? trimmedGoalPrompt : undefined,
        }),
      });
      const payload = (await response.json()) as
        | WorkflowDetailResponse
        | { error?: string };

      if (!response.ok) {
        throw new Error(payload && "error" in payload ? payload.error || "创建工作流失败。" : "创建工作流失败。");
      }

      if (!("workflow" in payload)) {
        throw new Error("创建工作流失败。");
      }

      const workflowId = payload.workflow?.workflow.id;

      if (!workflowId) {
        throw new Error("创建工作流失败。");
      }

      onCreated(workflowId);
      onClose();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "创建工作流失败。");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <DialogShell onClose={isSubmitting ? () => {} : onClose} panelClassName="max-w-[560px]">
      <DialogHeader
        title="创建工作流"
        description="先选择起步方式，创建后会直接进入工作流详情编辑页。"
      />

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => setMode("blank")}
          disabled={isSubmitting}
          className={`rounded-[18px] border px-4 py-4 text-left transition ${
            mode === "blank"
              ? "border-text/30 bg-background"
              : "border-line bg-surface-muted hover:border-text/20"
          }`}
        >
          <p className="text-[15px] font-semibold text-text">空白画布</p>
          <p className="mt-1 text-[12px] leading-5 text-muted-strong">
            使用默认 Start / End 骨架，从零开始编辑。
          </p>
        </button>

        <button
          type="button"
          onClick={() => setMode("ai")}
          disabled={isSubmitting}
          className={`rounded-[18px] border px-4 py-4 text-left transition ${
            mode === "ai"
              ? "border-text/30 bg-background"
              : "border-line bg-surface-muted hover:border-text/20"
          }`}
        >
          <p className="text-[15px] font-semibold text-text">AI 生成初稿</p>
          <p className="mt-1 text-[12px] leading-5 text-muted-strong">
            先描述目标，再生成可编辑的节点草稿。
          </p>
        </button>
      </div>

      <div className="mt-4 space-y-3">
        <label className="block text-[13px] text-muted-strong">
          工作流名称
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            disabled={isSubmitting}
            className="mt-2 h-10 w-full rounded-full border border-line bg-background px-4 text-[14px] text-text outline-none transition focus:border-text/30"
            placeholder="输入工作流名称"
          />
        </label>

        {mode === "ai" ? (
          <label className="block text-[13px] text-muted-strong">
            想让 AI 先搭什么流程
            <textarea
              value={goalPrompt}
              onChange={(event) => setGoalPrompt(event.target.value)}
              disabled={isSubmitting}
              rows={5}
              className="mt-2 w-full rounded-[16px] border border-line bg-background px-4 py-3 text-[14px] leading-6 text-text outline-none transition focus:border-text/30"
              placeholder="例如：每周自动拉取项目进展，交给 Agent 整理成周报并发送到会话。"
            />
          </label>
        ) : null}
      </div>

      {errorMessage ? (
        <p className="mt-4 rounded-[12px] border border-[#edd9d5] bg-[#fcf2f1] px-3 py-2 text-[12px] text-[#7e6f6b]">
          {errorMessage}
        </p>
      ) : null}

      <DialogActions>
        <DialogSecondaryButton onClick={onClose} disabled={isSubmitting}>
          取消
        </DialogSecondaryButton>
        <DialogPrimaryButton onClick={() => void handleCreate()} disabled={isSubmitting}>
          {isSubmitting ? "创建中..." : mode === "ai" ? "生成并创建" : "创建工作流"}
        </DialogPrimaryButton>
      </DialogActions>
    </DialogShell>
  );
}
