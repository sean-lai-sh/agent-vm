import * as fsList from "./fs-list.js";
import * as fsRead from "./fs-read.js";
import * as fsWrite from "./fs-write.js";
import * as shellExec from "./shell-exec.js";

export function registerTools(server, config) {
  const { enabledTools, shellExecConfig } = config;

  const maybeRegister = (name, metadata, handler) => {
    if (!enabledTools.has(name)) {
      return;
    }
    server.registerTool(name, metadata, handler);
  };

  // Register fs.list
  maybeRegister("fs.list", fsList.metadata, fsList.handler);

  // Register fs.read
  maybeRegister("fs.read", fsRead.metadata, fsRead.handler);

  // Register fs.write
  maybeRegister("fs.write", fsWrite.metadata, fsWrite.handler);

  // Register shell.exec (needs special handling for server and config)
  maybeRegister(
    "shell.exec",
    shellExec.metadata,
    async (params, extra) => shellExec.handler(params, extra, server, shellExecConfig)
  );
}
