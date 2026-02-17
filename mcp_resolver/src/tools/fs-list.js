import { z } from "zod";
import { resolveWorkspacePath, listEntries } from "../filesystem/index.js";

export const metadata = {
  title: "Workspace Listing",
  description: "List files and directories inside the workspace.",
  inputSchema: z.object({
    path: z.string().optional()
  }),
  annotations: {
    readOnlyHint: true
  }
};

export async function handler({ path: requestedPath }, extra) {
  const target = resolveWorkspacePath(requestedPath);
  const entries = await listEntries(target);
  const result = { path: target, entries };
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
