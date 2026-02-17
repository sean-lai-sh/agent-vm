import fs from "node:fs";
import path from "node:path";
import { WORKSPACE_ROOT } from "../config/constants.js";

export function resolveWorkspacePath(inputPath) {
  const safeInput = inputPath || ".";
  const resolved = path.resolve(WORKSPACE_ROOT, safeInput);
  if (resolved === WORKSPACE_ROOT) {
    return resolved;
  }
  if (!resolved.startsWith(WORKSPACE_ROOT + path.sep)) {
    throw new Error("Path escapes workspace");
  }
  return resolved;
}

export async function listEntries(targetPath) {
  const entries = await fs.promises.readdir(targetPath, { withFileTypes: true });
  return entries.map((entry) => {
    let type = "other";
    if (entry.isDirectory()) type = "dir";
    if (entry.isFile()) type = "file";
    if (entry.isSymbolicLink()) type = "symlink";
    return {
      name: entry.name,
      type
    };
  });
}

// Read file chunk at offset
export async function readFileChunk(filePath, offset, chunkSize, encoding = 'utf8') {
  const fd = await fs.promises.open(filePath, 'r');
  try {
    const stat = await fd.stat();
    const remainingBytes = stat.size - offset;
    const bytesToRead = Math.min(chunkSize, remainingBytes);
    const buffer = Buffer.allocUnsafe(bytesToRead);
    await fd.read(buffer, 0, bytesToRead, offset);

    return {
      content: buffer.toString(encoding),
      chunkSize: bytesToRead,
      hasMore: (offset + bytesToRead) < stat.size,
      totalSize: stat.size
    };
  } finally {
    await fd.close();
  }
}
