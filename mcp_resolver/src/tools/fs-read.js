import fs from "node:fs";
import { z } from "zod";
import { resolveWorkspacePath, readFileChunk, createCursor, parseCursor, hashFilePrefix } from "../filesystem/index.js";
import { MAX_ENTRY_BYTES, CHUNK_SIZE } from "../config/constants.js";

export const metadata = {
  title: "Workspace Read",
  description: "Read a file inside the workspace. Automatically chunks large files with cursor-based pagination.",
  inputSchema: z.object({
    path: z.string(),
    encoding: z.string().optional(),
    cursor: z.string().optional()
  }),
  annotations: {
    readOnlyHint: true
  }
};

export async function handler({ path: requestedPath, encoding, cursor }, extra) {
  const target = resolveWorkspacePath(requestedPath);
  const stat = await fs.promises.stat(target);

  if (!stat.isFile()) {
    throw new Error("Path is not a file");
  }

  const resolvedEncoding = encoding || "utf8";
  let offset = 0;
  let expectedHash = null;

  // Parse cursor if provided
  if (cursor) {
    const parsed = parseCursor(cursor);

    if (parsed.type !== 'file') {
      throw new Error("Invalid cursor type for file read");
    }

    if (parsed.path !== target) {
      throw new Error("Cursor path mismatch");
    }

    offset = parsed.offset;
    expectedHash = parsed.hash;

    // Verify file hasn't changed
    const currentHash = await hashFilePrefix(target);
    if (currentHash !== expectedHash) {
      throw new Error("File modified during read, please restart from beginning");
    }
  }

  // Check if chunking is needed
  if (stat.size <= CHUNK_SIZE && offset === 0) {
    // Small file - use original behavior
    const content = await fs.promises.readFile(target, { encoding: resolvedEncoding });

    if (Buffer.byteLength(content, resolvedEncoding) > MAX_ENTRY_BYTES) {
      throw new Error("Response exceeds max entry size");
    }

    const result = {
      path: target,
      bytes: stat.size,
      encoding: resolvedEncoding,
      content
    };

    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      structuredContent: result
    };
  }

  // Large file - return chunk
  const fileHash = expectedHash || await hashFilePrefix(target);
  const chunk = await readFileChunk(target, offset, CHUNK_SIZE, resolvedEncoding);

  const result = {
    path: target,
    bytes: stat.size,
    encoding: resolvedEncoding,
    content: chunk.content,
    chunkOffset: offset,
    chunkSize: chunk.chunkSize,
    hasMore: chunk.hasMore,
    nextCursor: chunk.hasMore
      ? createCursor('file', target, offset + chunk.chunkSize, fileHash)
      : undefined
  };

  return {
    content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    structuredContent: result
  };
}
