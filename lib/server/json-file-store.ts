import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { ensureRuntimeLockForPath } from "@/lib/runtime/runtime-lock";

type SyncJsonFileStoreOptions<T> = {
  filePath: string;
  seed: () => T;
  normalize?: (value: Partial<T>) => T;
};

export function createSyncJsonFileStore<T>(options: SyncJsonFileStoreOptions<T>) {
  const normalize = options.normalize ?? ((value: Partial<T>) => value as T);

  function ensureFile() {
    const dirPath = path.dirname(options.filePath);

    if (!existsSync(dirPath)) {
      ensureRuntimeLockForPath(options.filePath);
      mkdirSync(dirPath, { recursive: true });
    }

    if (!existsSync(options.filePath)) {
      ensureRuntimeLockForPath(options.filePath);
      writeSerialized(options.seed());
    }
  }

  function read(): T {
    ensureFile();

    try {
      const raw = readFileSync(options.filePath, "utf8");
      const parsed = JSON.parse(raw) as Partial<T>;
      const normalized = normalize(parsed);
      const serialized = JSON.stringify(normalized, null, 2);

      if (serialized !== raw) {
        ensureRuntimeLockForPath(options.filePath);
        writeSerialized(normalized);
      }

      return normalized;
    } catch {
      ensureRuntimeLockForPath(options.filePath);
      backupCorruptFile(options.filePath);
      const seed = options.seed();
      writeSerialized(seed);
      return seed;
    }
  }

  function write(state: T) {
    ensureFile();
    ensureRuntimeLockForPath(options.filePath);
    writeSerialized(state);
  }

  function mutate<TResult>(mutator: (state: T) => TResult) {
    const state = read();
    const result = mutator(state);
    write(state);
    return structuredClone(result);
  }

  function writeSerialized(value: T) {
    writeFileAtomically(options.filePath, JSON.stringify(value, null, 2));
  }

  return {
    ensureFile,
    read,
    write,
    mutate,
  };
}

function writeFileAtomically(filePath: string, content: string) {
  const tempPath = path.join(
    path.dirname(filePath),
    `.${path.basename(filePath)}.${process.pid}.${crypto.randomUUID()}.tmp`,
  );

  try {
    writeFileSync(tempPath, content, "utf8");
    renameSync(tempPath, filePath);
  } finally {
    if (existsSync(tempPath)) {
      rmSync(tempPath, { force: true });
    }
  }
}

function backupCorruptFile(filePath: string) {
  if (!existsSync(filePath)) {
    return;
  }

  const backupPath = path.join(
    path.dirname(filePath),
    `${path.basename(filePath, path.extname(filePath))}.corrupt.${Date.now()}${path.extname(filePath) || ".json"}`,
  );

  try {
    renameSync(filePath, backupPath);
  } catch {
    // Ignore backup failures here and let the store self-heal with a new seed file.
  }
}
