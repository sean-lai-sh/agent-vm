import fs from "node:fs";

// File hash for consistency check
export async function hashFilePrefix(filePath, bytesToHash = 4096) {
  const { createHash } = await import("node:crypto");
  const fd = await fs.promises.open(filePath, 'r');
  try {
    const buffer = Buffer.allocUnsafe(Math.min(bytesToHash, 4096));
    const { bytesRead } = await fd.read(buffer, 0, buffer.length, 0);
    return createHash('sha256')
      .update(buffer.slice(0, bytesRead))
      .digest('hex')
      .slice(0, 16);
  } finally {
    await fd.close();
  }
}
