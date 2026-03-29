import { existsSync, statSync } from "node:fs";
import path from "node:path";
import type { ChildProcess } from "node:child_process";
import { BrowserWindow, dialog, shell } from "electron";
import type { OpenDialogOptions } from "electron";

const LOCAL_FILES_BRIDGE_REQUEST_KIND = "opencrab:desktop-local-files:request";
const LOCAL_FILES_BRIDGE_RESPONSE_KIND = "opencrab:desktop-local-files:response";

type LocalFilesBridgeRequest =
  | {
      kind: typeof LOCAL_FILES_BRIDGE_REQUEST_KIND;
      requestId: string;
      action: "pick-directory";
      payload: {
        title: string;
        defaultPath: string | null;
      };
    }
  | {
      kind: typeof LOCAL_FILES_BRIDGE_REQUEST_KIND;
      requestId: string;
      action: "reveal-path";
      payload: {
        targetPath: string;
      };
    };

type LocalFilesBridgeResponse = {
  kind: typeof LOCAL_FILES_BRIDGE_RESPONSE_KIND;
  requestId: string;
  ok: boolean;
  result?: Record<string, unknown>;
  error?: string;
};

export function registerDesktopLocalFilesIpc(child: ChildProcess) {
  const handleMessage = (message: unknown) => {
    if (!isLocalFilesBridgeRequest(message)) {
      return;
    }

    void handleLocalFilesBridgeRequest(child, message);
  };

  const cleanup = () => {
    child.removeListener("message", handleMessage);
    child.removeListener("exit", cleanup);
  };

  child.on("message", handleMessage);
  child.once("exit", cleanup);

  return cleanup;
}

async function handleLocalFilesBridgeRequest(
  child: ChildProcess,
  message: LocalFilesBridgeRequest,
) {
  try {
    const result =
      message.action === "pick-directory"
        ? await pickDirectoryFromDesktop(message.payload)
        : await revealPathFromDesktop(message.payload.targetPath);

    sendLocalFilesBridgeResponse(child, {
      kind: LOCAL_FILES_BRIDGE_RESPONSE_KIND,
      requestId: message.requestId,
      ok: true,
      result,
    });
  } catch (error) {
    sendLocalFilesBridgeResponse(child, {
      kind: LOCAL_FILES_BRIDGE_RESPONSE_KIND,
      requestId: message.requestId,
      ok: false,
      error: error instanceof Error ? error.message : "桌面原生文件能力调用失败。",
    });
  }
}

async function pickDirectoryFromDesktop(input: {
  title: string;
  defaultPath: string | null;
}) {
  const focusedWindow = BrowserWindow.getFocusedWindow();
  const options: OpenDialogOptions = {
    title: input.title,
    defaultPath: normalizeExistingPath(input.defaultPath),
    buttonLabel: "选择目录",
    properties: ["openDirectory", "createDirectory"],
  };
  const result = focusedWindow
    ? await dialog.showOpenDialog(focusedWindow, options)
    : await dialog.showOpenDialog(options);

  return {
    path: result.canceled ? null : result.filePaths[0] ?? null,
    cancelled: result.canceled,
  };
}

async function revealPathFromDesktop(targetPath: string) {
  if (!existsSync(targetPath)) {
    throw new Error("文件不存在，无法打开所在目录。");
  }

  const stats = statSync(targetPath);

  if (stats.isDirectory()) {
    const errorMessage = await shell.openPath(targetPath);

    if (errorMessage) {
      throw new Error(errorMessage);
    }

    return {
      path: targetPath,
      revealMode: "open-directory",
    };
  }

  shell.showItemInFolder(targetPath);
  return {
    path: targetPath,
    revealMode: "reveal-item",
  };
}

function sendLocalFilesBridgeResponse(
  child: ChildProcess,
  message: LocalFilesBridgeResponse,
) {
  if (!child.connected) {
    return;
  }

  try {
    child.send(message);
  } catch {
    // Ignore send failures during shutdown.
  }
}

function normalizeExistingPath(value: string | null) {
  if (!value) {
    return undefined;
  }

  const resolved = path.resolve(value);
  return existsSync(resolved) ? resolved : undefined;
}

function isLocalFilesBridgeRequest(
  message: unknown,
): message is LocalFilesBridgeRequest {
  if (!message || typeof message !== "object") {
    return false;
  }

  const candidate = message as Partial<LocalFilesBridgeRequest>;

  return (
    candidate.kind === LOCAL_FILES_BRIDGE_REQUEST_KIND &&
    typeof candidate.requestId === "string" &&
    (candidate.action === "pick-directory" || candidate.action === "reveal-path")
  );
}
