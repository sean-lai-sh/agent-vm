import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { resolveWorkspacePath } from "../filesystem/index.js";
import { MAX_WRITE_BYTES } from "../config/constants.js";

export const metadata = {
  title: "Workspace Write",
  description: "Write a file inside the workspace.",
  inputSchema: z.object({
    path: z.string(),
    content: z.string(),
    encoding: z.string().optional(),
    create_dirs: z.boolean().optional()
  }),
  annotations: {
    readOnlyHint: false
  }
};

export async function handler({ path: requestedPath, content, encoding, create_dirs }, extra) {
  if (Buffer.byteLength(content, "utf8") > MAX_WRITE_BYTES) {
    throw new Error("Write exceeds max write size");
  }
  const target = resolveWorkspacePath(requestedPath);
  const resolvedEncoding = encoding || "utf8";
  if (create_dirs !== false) {
    await fs.promises.mkdir(path.dirname(target), { recursive: true });
  }
  await fs.promises.writeFile(target, content, { encoding: resolvedEncoding });
  const stat = await fs.promises.stat(target);
  const result = { path: target, bytes: stat.size, encoding: resolvedEncoding };
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(result, null, 2)
      }
    ],
    structuredContent: result
  };
}
