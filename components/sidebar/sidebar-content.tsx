"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useOpenCrabApp } from "@/components/app-shell/opencrab-provider";
import {
  DialogActions,
  DialogHeader,
  DialogPrimaryButton,
  DialogSecondaryButton,
  DialogShell,
} from "@/components/ui/dialog";
import type { ConversationItem } from "@/lib/seed-data";
import { getSkillViewModels } from "@/lib/view-models/skills";
import { buildSidebarViewModel } from "@/lib/view-models/conversations";

type DeleteTarget =
  | {
      kind: "folder";
      id: string;
      title: string;
      description: string;
      shouldRedirect: boolean;
    }
  | {
      kind: "conversation";
      id: string;
      title: string;
      description: string;
      shouldRedirect: boolean;
    };

type CreateFolderDialogState = {
  name: string;
  isSubmitting: boolean;
};

type RenameDialogState =
  | {
      kind: "folder";
      id: string;
      value: string;
      isSubmitting: boolean;
    }
  | {
      kind: "conversation";
      id: string;
      value: string;
      isSubmitting: boolean;
    };

export function SidebarContent() {
  const pathname = usePathname();
  const router = useRouter();
  const {
    folders,
    conversations,
    conversationMessages,
    expandedFolders,
    isHydrated,
    isMutating,
    errorMessage,
    clearError,
    toggleFolder,
    createFolder,
    renameFolder,
    deleteFolder,
    renameConversation,
    deleteConversation,
    moveConversation,
  } = useOpenCrabApp();
  const [draggingConversationId, setDraggingConversationId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [createFolderDialog, setCreateFolderDialog] = useState<CreateFolderDialogState | null>(null);
  const [renameDialog, setRenameDialog] = useState<RenameDialogState | null>(null);
  const [openActionMenu, setOpenActionMenu] = useState<null | {
    kind: "folder" | "conversation";
    id: string;
  }>(null);

  const isConversationArea = pathname === "/" || pathname.startsWith("/conversations");
  const isSkillsArea = pathname === "/skills" || pathname.startsWith("/skills/");
  const activeConversationId = pathname.startsWith("/conversations/") ? pathname.split("/")[2] : null;
  const activeSkillId = pathname.startsWith("/skills/") ? pathname.split("/")[2] : null;
  const skillViewModels = useMemo(() => getSkillViewModels(), []);

  const sidebarViewModel = useMemo(
    () =>
      buildSidebarViewModel({
        folders,
        conversations,
        conversationMessages,
        expandedFolders,
      }),
    [conversationMessages, conversations, expandedFolders, folders],
  );

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      const target = event.target as HTMLElement | null;

      if (!target?.closest("[data-sidebar-action-root='true']")) {
        setOpenActionMenu(null);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, []);

  if (isSkillsArea) {
    return <SkillsSidebar skills={skillViewModels} activeSkillId={activeSkillId} />;
  }

  if (!isConversationArea) {
    return <div className="h-full" />;
  }

  function handleOpenCreateFolderDialog() {
    setCreateFolderDialog({
      name: "",
      isSubmitting: false,
    });
  }

  function handleDeleteFolder(folderId: string) {
    const folder = folders.find((item) => item.id === folderId);
    const relatedConversations = conversations.filter((item) => item.folderId === folderId);
    setDeleteTarget({
      kind: "folder",
      id: folderId,
      title: `删除文件夹“${folder?.name ?? ""}”`,
      description: `删除后会同时移除里面的 ${relatedConversations.length} 条对话，这个操作无法撤销。`,
      shouldRedirect:
        !!activeConversationId && relatedConversations.some((item) => item.id === activeConversationId),
    });
  }

  function handleDeleteConversation(conversationId: string) {
    const currentConversation = conversations.find((item) => item.id === conversationId);
    setDeleteTarget({
      kind: "conversation",
      id: conversationId,
      title: `删除对话“${currentConversation?.title ?? ""}”`,
      description: "删除后将不再保留这段历史内容，这个操作无法撤销。",
      shouldRedirect: activeConversationId === conversationId,
    });
  }

  function handleOpenRenameFolderDialog(folderId: string) {
    const folder = folders.find((item) => item.id === folderId);

    if (!folder) {
      return;
    }

    setRenameDialog({
      kind: "folder",
      id: folderId,
      value: folder.name,
      isSubmitting: false,
    });
  }

  function handleOpenRenameConversationDialog(conversationId: string) {
    const conversation = conversations.find((item) => item.id === conversationId);

    if (!conversation) {
      return;
    }

    setRenameDialog({
      kind: "conversation",
      id: conversationId,
      value: conversation.title,
      isSubmitting: false,
    });
  }

  async function handleDropToFolder(folderId: string) {
    if (!draggingConversationId) {
      return;
    }

    try {
      await moveConversation(draggingConversationId, folderId);
    } catch {
      return;
    } finally {
      setDraggingConversationId(null);
    }
  }

  async function handleDropToRecent() {
    if (!draggingConversationId) {
      return;
    }

    try {
      await moveConversation(draggingConversationId, null);
    } catch {
      return;
    } finally {
      setDraggingConversationId(null);
    }
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) {
      return;
    }

    if (deleteTarget.kind === "folder") {
      try {
        await deleteFolder(deleteTarget.id);
      } catch {
        return;
      }
    } else {
      try {
        await deleteConversation(deleteTarget.id);
      } catch {
        return;
      }
    }

    if (deleteTarget.shouldRedirect) {
      router.push("/conversations");
    }

    setDeleteTarget(null);
  }

  async function handleConfirmCreateFolder() {
    if (!createFolderDialog) {
      return;
    }

    const name = createFolderDialog.name.trim();

    if (!name) {
      return;
    }

    setCreateFolderDialog((current) => (current ? { ...current, isSubmitting: true } : current));

    try {
      await createFolder(name);
      setCreateFolderDialog(null);
    } catch {
      setCreateFolderDialog((current) => (current ? { ...current, isSubmitting: false } : current));
    }
  }

  async function handleConfirmRename() {
    if (!renameDialog) {
      return;
    }

    const value = renameDialog.value.trim();

    if (!value) {
      return;
    }

    setRenameDialog((current) => (current ? { ...current, isSubmitting: true } : current));

    try {
      if (renameDialog.kind === "folder") {
        await renameFolder(renameDialog.id, value);
      } else {
        await renameConversation(renameDialog.id, value);
      }
      setRenameDialog(null);
    } catch {
      setRenameDialog((current) => (current ? { ...current, isSubmitting: false } : current));
    }
  }

  return (
    <>
      {errorMessage ? (
        <SidebarStatusBanner tone="error" actionLabel="关闭" onAction={clearError}>
          {errorMessage}
        </SidebarStatusBanner>
      ) : null}

      {!errorMessage && isMutating ? (
        <SidebarStatusBanner tone="neutral">正在保存更改...</SidebarStatusBanner>
      ) : null}

      <SidebarSection
        title="对话文件夹"
        action={
          <button
            type="button"
            onClick={handleOpenCreateFolderDialog}
            className="flex h-[26px] w-[26px] items-center justify-center rounded-lg text-muted transition hover:bg-surface"
            aria-label="新建文件夹"
          >
            ＋
          </button>
        }
      >
        {sidebarViewModel.folders.map((folder) => {
          const folderConversations = folder.conversations;
          const isExpanded = folder.isExpanded;

          return (
            <div key={folder.id} className="rounded-xl">
              <FolderRow
                id={folder.id}
                name={folder.name}
                count={folderConversations.length}
                isExpanded={isExpanded}
                isMenuOpen={openActionMenu?.kind === "folder" && openActionMenu.id === folder.id}
                onToggle={() => toggleFolder(folder.id)}
                onRename={() => handleOpenRenameFolderDialog(folder.id)}
                onDelete={() => handleDeleteFolder(folder.id)}
                onMenuToggle={() =>
                  setOpenActionMenu((current) =>
                    current?.kind === "folder" && current.id === folder.id
                      ? null
                      : { kind: "folder", id: folder.id },
                  )
                }
                onDrop={() => {
                  void handleDropToFolder(folder.id);
                }}
              />

              {isExpanded ? (
                <div id={`folder-${folder.id}`} className="mt-0.5 ml-4 flex flex-col gap-0.5 border-l border-line pl-2.5">
                  {folderConversations.length > 0 ? (
                    folderConversations.map((item) => (
                      <ConversationRow
                        key={item.id}
                        conversation={item}
                        isActive={activeConversationId === item.id}
                        onRename={handleOpenRenameConversationDialog}
                        onDelete={handleDeleteConversation}
                        isMenuOpen={
                          openActionMenu?.kind === "conversation" && openActionMenu.id === item.id
                        }
                        onMenuToggle={() =>
                          setOpenActionMenu((current) =>
                            current?.kind === "conversation" && current.id === item.id
                              ? null
                              : { kind: "conversation", id: item.id },
                          )
                        }
                        onDragStart={setDraggingConversationId}
                        onDragEnd={() => setDraggingConversationId(null)}
                      />
                    ))
                  ) : (
                    <div className="px-3 py-2 text-[11px] text-muted">拖动对话到这里</div>
                  )}
                </div>
              ) : null}
            </div>
          );
        })}
      </SidebarSection>

      <SidebarSection
        title="最近对话"
        onDragOver={(event) => event.preventDefault()}
        onDrop={() => {
          void handleDropToRecent();
        }}
      >
        {sidebarViewModel.recentConversations.length > 0 ? (
          sidebarViewModel.recentConversations.map((item) => (
            <ConversationRow
              key={item.id}
              conversation={item}
              isActive={activeConversationId === item.id}
              onRename={handleOpenRenameConversationDialog}
              onDelete={handleDeleteConversation}
              isMenuOpen={
                openActionMenu?.kind === "conversation" && openActionMenu.id === item.id
              }
              onMenuToggle={() =>
                setOpenActionMenu((current) =>
                  current?.kind === "conversation" && current.id === item.id
                    ? null
                    : { kind: "conversation", id: item.id },
                )
              }
              onDragStart={setDraggingConversationId}
              onDragEnd={() => setDraggingConversationId(null)}
            />
          ))
        ) : (
          <div className="px-3 py-2 text-[11px] text-muted">
            {isHydrated ? "拖动文件夹里的对话回到这里" : "正在加载对话..."}
          </div>
        )}
      </SidebarSection>

      {deleteTarget ? (
        <DeleteDialog
          title={deleteTarget.title}
          description={deleteTarget.description}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={handleConfirmDelete}
        />
      ) : null}

      {createFolderDialog ? (
        <CreateFolderDialog
          value={createFolderDialog.name}
          isSubmitting={createFolderDialog.isSubmitting}
          onChange={(name) =>
            setCreateFolderDialog((current) => (current ? { ...current, name } : current))
          }
          onCancel={() => setCreateFolderDialog(null)}
          onConfirm={handleConfirmCreateFolder}
        />
      ) : null}

      {renameDialog ? (
        <RenameDialog
          title={renameDialog.kind === "folder" ? "重命名文件夹" : "重命名对话"}
          description={
            renameDialog.kind === "folder"
              ? "修改这个文件夹的名称，不会影响里面的对话内容。"
              : "给这段对话换一个更清晰的标题，方便后续查找。"
          }
          confirmLabel="保存"
          value={renameDialog.value}
          isSubmitting={renameDialog.isSubmitting}
          onChange={(value) =>
            setRenameDialog((current) => (current ? { ...current, value } : current))
          }
          onCancel={() => setRenameDialog(null)}
          onConfirm={handleConfirmRename}
        />
      ) : null}
    </>
  );
}

type SidebarSectionProps = {
  title: string;
  action?: React.ReactNode;
  onDragOver?: React.DragEventHandler<HTMLElement>;
  onDrop?: React.DragEventHandler<HTMLElement>;
  children: React.ReactNode;
};

function SidebarSection({ title, action, onDragOver, onDrop, children }: SidebarSectionProps) {
  return (
    <section className="mt-2" onDragOver={onDragOver} onDrop={onDrop}>
      <div className="mb-0.5 flex min-h-7 items-center justify-between px-3 text-[13px] text-muted">
        <span>{title}</span>
        {action ?? <span className="text-[18px] leading-none">›</span>}
      </div>
      <div className="flex flex-col gap-0.5">{children}</div>
    </section>
  );
}

function SkillsSidebar({
  skills,
  activeSkillId,
}: {
  skills: ReturnType<typeof getSkillViewModels>;
  activeSkillId: string | null;
}) {
  const enabledCount = skills.filter((skill) => skill.isEnabled).length;

  return (
    <>
      <SidebarSection
        title="Skills"
        action={
          <span className="rounded-full border border-line bg-surface px-2.5 py-1 text-[11px] text-muted-strong">
            {enabledCount}/{skills.length} 已启用
          </span>
        }
      >
        <Link
          href="/skills"
          className={`flex min-h-10 items-center justify-between rounded-xl px-3 text-[13px] transition ${
            !activeSkillId ? "bg-surface font-medium text-text" : "text-text hover:bg-surface-muted"
          }`}
        >
          <span>总览</span>
          <span className="text-[12px] text-muted">全部</span>
        </Link>

        {skills.map((skill) => (
          <Link
            key={skill.id}
            href={`/skills/${skill.id}`}
            className={`flex min-h-12 items-center justify-between gap-3 rounded-xl px-3 transition ${
              activeSkillId === skill.id
                ? "bg-surface text-text"
                : "text-text hover:bg-surface-muted"
            }`}
          >
            <span className="min-w-0">
              <span className="flex items-center gap-2 text-[13px] font-medium">
                <span
                  className={`h-2 w-2 rounded-full ${
                    skill.isEnabled ? "bg-[#2d8a4b]" : "bg-[#b5b5ad]"
                  }`}
                />
                <span className="truncate">{skill.name}</span>
              </span>
              <span className="mt-1 block truncate text-[12px] text-muted">{skill.category}</span>
            </span>
            <span className="shrink-0 text-[12px] text-muted">{skill.status}</span>
          </Link>
        ))}
      </SidebarSection>

      <SidebarSection title="说明">
        <div className="rounded-xl border border-line bg-surface px-3 py-3 text-[12px] leading-6 text-muted-strong">
          Skills 当前只做能力说明和边界整理，不在这里直接做复杂配置。
        </div>
      </SidebarSection>
    </>
  );
}

type ConversationRowProps = {
  conversation: ConversationItem;
  isActive: boolean;
  isMenuOpen: boolean;
  onRename: (conversationId: string) => void;
  onDelete: (conversationId: string) => void;
  onMenuToggle: () => void;
  onDragStart: (conversationId: string) => void;
  onDragEnd: () => void;
};

function ConversationRow({
  conversation,
  isActive,
  isMenuOpen,
  onRename,
  onDelete,
  onMenuToggle,
  onDragStart,
  onDragEnd,
}: ConversationRowProps) {
  return (
    <div
      draggable
      onDragStart={() => onDragStart(conversation.id)}
      onDragEnd={onDragEnd}
      className={`group/row relative flex min-h-8 min-w-0 items-center justify-between gap-2 rounded-xl pl-3 pr-2 text-[13px] transition ${
        isActive ? "bg-surface text-text" : "text-text hover:bg-surface-muted"
      }`}
    >
      <Link
        href={`/conversations/${conversation.id}`}
        className="flex min-h-8 min-w-0 flex-1 items-center gap-3 overflow-hidden"
      >
        <span className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
          {conversation.source && conversation.source !== "local" ? (
            <span className="shrink-0 rounded-full border border-line bg-background px-1.5 py-0.5 text-[10px] font-medium text-muted-strong">
              {conversation.source === "telegram" ? "TG" : "FS"}
            </span>
          ) : null}
          <span className="block min-w-0 truncate text-[13px]">{conversation.title}</span>
        </span>
        <span className="shrink-0 pl-2 text-[12px] text-muted">{conversation.timeLabel}</span>
      </Link>
      <RowActionMenu
        label={conversation.title}
        kind="conversation"
        isOpen={isMenuOpen}
        onToggle={onMenuToggle}
        onRename={() => onRename(conversation.id)}
        onDelete={() => onDelete(conversation.id)}
      />
    </div>
  );
}

type FolderRowProps = {
  id: string;
  name: string;
  count: number;
  isExpanded: boolean;
  isMenuOpen: boolean;
  onToggle: () => void;
  onRename: () => void;
  onDelete: () => void;
  onMenuToggle: () => void;
  onDrop: () => void;
};

function FolderRow({
  id,
  name,
  count,
  isExpanded,
  isMenuOpen,
  onToggle,
  onRename,
  onDelete,
  onMenuToggle,
  onDrop,
}: FolderRowProps) {
  return (
    <div
      className="group/folder relative"
      onDragOver={(event) => event.preventDefault()}
      onDrop={onDrop}
    >
      <div className="flex min-h-8 items-center gap-2 rounded-xl px-2.5 text-text transition hover:bg-surface-muted">
        <button
          type="button"
          onClick={onToggle}
          className="flex min-h-8 flex-1 items-center gap-2 overflow-hidden text-left"
          aria-expanded={isExpanded}
          aria-controls={`folder-${id}`}
        >
          <span className="text-muted-strong">
            <FolderIcon />
          </span>
          <span className="truncate text-[14px] font-medium">{name}</span>
          <span className="ml-auto flex items-center gap-1.5 text-[12px] text-muted">
            <span>{count}</span>
            <span className={`transition ${isExpanded ? "rotate-90" : ""}`}>›</span>
          </span>
        </button>

        <RowActionMenu
          label={name}
          kind="folder"
          isOpen={isMenuOpen}
          onToggle={onMenuToggle}
          onRename={onRename}
          onDelete={onDelete}
        />
      </div>
    </div>
  );
}

type RowActionMenuProps = {
  label: string;
  kind: "folder" | "conversation";
  isOpen: boolean;
  onToggle: () => void;
  onRename: () => void;
  onDelete: () => void;
};

function RowActionMenu({ label, kind, isOpen, onToggle, onRename, onDelete }: RowActionMenuProps) {
  return (
    <div data-sidebar-action-root="true" className="relative shrink-0">
      <button
        type="button"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onToggle();
        }}
        className={`flex h-7 w-7 items-center justify-center rounded-lg transition ${
          isOpen
            ? "bg-surface text-[#6f6f68] opacity-100"
            : "bg-transparent text-[#8a8a84] opacity-0 group-hover/folder:bg-surface group-hover/folder:text-[#6f6f68] group-hover/folder:opacity-100 group-focus-within/folder:bg-surface group-focus-within/folder:text-[#6f6f68] group-focus-within/folder:opacity-100 group-hover/row:bg-surface group-hover/row:text-[#6f6f68] group-hover/row:opacity-100 group-focus-within/row:bg-surface group-focus-within/row:text-[#6f6f68] group-focus-within/row:opacity-100"
        }`}
        style={{ visibility: "visible" }}
        aria-label={`${kind === "folder" ? "文件夹" : "对话"} ${label} 更多操作`}
      >
        <span aria-hidden="true" className="translate-y-[-1px] text-[18px] leading-none">
          ...
        </span>
      </button>

      {isOpen ? (
        <div className="absolute top-[calc(100%+8px)] right-0 z-20 min-w-[132px] rounded-[18px] border border-line bg-surface p-1.5 shadow-[0_16px_36px_rgba(15,23,42,0.14)]">
        <button
          type="button"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onRename();
          }}
          className="flex w-full items-center gap-2 rounded-[10px] px-3 py-2 text-left text-[12px] text-text transition hover:bg-surface-muted"
        >
          <EditIcon />
          <span>重命名</span>
        </button>
        <div className="my-1 h-px bg-line" />
        <button
          type="button"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onDelete();
          }}
          className="flex w-full items-center gap-2 rounded-[10px] px-3 py-2 text-left text-[12px] text-[#a34942] transition hover:bg-[#fff6f5]"
        >
          <TrashIcon />
          <span>删除</span>
        </button>
        </div>
      ) : null}
    </div>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-[14px] w-[14px] stroke-current" strokeWidth="1.8">
      <path d="M4.5 7.5h15M9 4.5h6M8.5 7.5v10.5M15.5 7.5v10.5M6.5 7.5l.6 11a1.5 1.5 0 0 0 1.5 1.4h6.8a1.5 1.5 0 0 0 1.5-1.4l.6-11" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-[14px] w-[14px] stroke-current" strokeWidth="1.8">
      <path
        d="M4.5 16.8V19.5h2.7L17.9 8.8l-2.7-2.7L4.5 16.8zM13.9 6.8l2.7 2.7M14.8 5.2l1.1-1.1a1.5 1.5 0 0 1 2.1 0l1 1a1.5 1.5 0 0 1 0 2.1l-1.1 1.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function FolderIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-[16px] w-[16px] fill-none stroke-current" strokeWidth="1.9">
      <path
        d="M3.75 8.25A2.25 2.25 0 0 1 6 6h4.05l1.35 1.6H18A2.25 2.25 0 0 1 20.25 9.85v6.4A2.25 2.25 0 0 1 18 18.5H6a2.25 2.25 0 0 1-2.25-2.25z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M3.9 9h16.2" strokeLinecap="round" />
    </svg>
  );
}

type DeleteDialogProps = {
  title: string;
  description: string;
  onCancel: () => void;
  onConfirm: () => void;
};

function DeleteDialog({ title, description, onCancel, onConfirm }: DeleteDialogProps) {
  return (
    <DialogShell onClose={onCancel}>
      <DialogHeader title={title} description={description} />
      <DialogActions>
        <DialogSecondaryButton onClick={onCancel}>取消</DialogSecondaryButton>
        <DialogPrimaryButton onClick={onConfirm}>确认删除</DialogPrimaryButton>
      </DialogActions>
    </DialogShell>
  );
}

type CreateFolderDialogProps = {
  value: string;
  isSubmitting: boolean;
  onChange: (value: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
};

function CreateFolderDialog({
  value,
  isSubmitting,
  onChange,
  onCancel,
  onConfirm,
}: CreateFolderDialogProps) {
  return (
    <DialogShell onClose={onCancel}>
      <DialogHeader
        title="新建文件夹"
        description="给这组对话起一个名字，方便后续整理和归档。"
      />

      <div className="mt-6">
        <input
          autoFocus
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void onConfirm();
            }
          }}
          placeholder="例如：产品讨论"
          className="h-12 w-full rounded-2xl border border-line bg-surface-muted px-4 text-[14px] text-text outline-none transition placeholder:text-[#a0a097] focus:border-[#d8d7d1] focus:bg-surface"
        />
      </div>

      <DialogActions>
        <DialogSecondaryButton onClick={onCancel}>取消</DialogSecondaryButton>
        <DialogPrimaryButton onClick={onConfirm} disabled={!value.trim() || isSubmitting}>
          创建
        </DialogPrimaryButton>
      </DialogActions>
    </DialogShell>
  );
}

type RenameDialogProps = {
  title: string;
  description: string;
  confirmLabel: string;
  value: string;
  isSubmitting: boolean;
  onChange: (value: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
};

function RenameDialog({
  title,
  description,
  confirmLabel,
  value,
  isSubmitting,
  onChange,
  onCancel,
  onConfirm,
}: RenameDialogProps) {
  return (
    <DialogShell onClose={onCancel}>
      <DialogHeader title={title} description={description} />

      <div className="mt-6">
        <input
          autoFocus
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void onConfirm();
            }
          }}
          className="h-12 w-full rounded-2xl border border-line bg-surface-muted px-4 text-[14px] text-text outline-none transition placeholder:text-[#a0a097] focus:border-[#d8d7d1] focus:bg-surface"
        />
      </div>

      <DialogActions>
        <DialogSecondaryButton onClick={onCancel}>取消</DialogSecondaryButton>
        <DialogPrimaryButton onClick={onConfirm} disabled={!value.trim() || isSubmitting}>
          {confirmLabel}
        </DialogPrimaryButton>
      </DialogActions>
    </DialogShell>
  );
}

type SidebarStatusBannerProps = {
  children: React.ReactNode;
  tone: "neutral" | "error";
  actionLabel?: string;
  onAction?: () => void;
};

function SidebarStatusBanner({
  children,
  tone,
  actionLabel,
  onAction,
}: SidebarStatusBannerProps) {
  return (
    <div
      className={`mb-2 rounded-2xl border px-3 py-2 text-[12px] ${
        tone === "error"
          ? "border-[#f0d5d2] bg-[#fff6f5] text-[#a34942]"
          : "border-line bg-surface text-muted-strong"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <span>{children}</span>
        {actionLabel && onAction ? (
          <button type="button" onClick={onAction} className="shrink-0 text-[11px] font-medium">
            {actionLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
}
