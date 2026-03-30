import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export function getOpenCrabNodeExecutable(env = process.env) {
  return env.OPENCRAB_NODE_EXECUTABLE?.trim() || process.execPath;
}

export function buildOpenCrabNodeEnv(
  overrides: Record<string, string> = {},
  baseEnv: NodeJS.ProcessEnv = process.env,
) {
  const env: Record<string, string> = {};

  for (const [key, value] of Object.entries(baseEnv)) {
    if (typeof value === "string") {
      env[key] = value;
    }
  }

  return {
    ...env,
    ...overrides,
    ELECTRON_RUN_AS_NODE: "1",
  };
}

export async function execOpenCrabNodeScript(
  scriptPath: string,
  args: string[],
  input: {
    env?: NodeJS.ProcessEnv;
    cwd?: string;
  } = {},
) {
  return execFileAsync(getOpenCrabNodeExecutable(input.env), [scriptPath, ...args], {
    cwd: input.cwd,
    env: buildOpenCrabNodeEnv({}, input.env) as unknown as NodeJS.ProcessEnv,
  });
}
