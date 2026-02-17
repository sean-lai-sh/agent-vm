import fs from "node:fs";
import { TOOL_CONFIG, EXEC_SECURITY_MODE } from "./constants.js";

export function loadToolConfig() {
  // Security mode defaults
  const modeDefaults = {
    strict: {
      validate_args: true,
      validate_command: true,
      restrict_environment: true,
      audit_enabled: true,
      block_dangerous: true,
      max_concurrent_executions: 3,
      require_whitelist: true
    },
    moderate: {
      validate_args: true,
      validate_command: true,
      restrict_environment: false,
      audit_enabled: true,
      block_dangerous: true,
      max_concurrent_executions: 10,
      require_whitelist: true
    },
    permissive: {
      validate_args: false,
      validate_command: false,
      restrict_environment: false,
      audit_enabled: true,
      block_dangerous: false,
      max_concurrent_executions: 20,
      require_whitelist: false
    }
  };

  const securityMode = EXEC_SECURITY_MODE;
  const defaults = modeDefaults[securityMode] || modeDefaults.strict;

  try {
    const raw = fs.readFileSync(TOOL_CONFIG, "utf8");
    const parsed = JSON.parse(raw);

    return {
      enabledTools: new Set(parsed.enabled_tools || ["fs.list", "fs.read", "fs.write"]),
      shellExecConfig: {
        ...defaults,
        ...(parsed.shell_exec_config || {}),
        security_mode: securityMode,
        // Ensure critical security settings from config
        allow_all: parsed.shell_exec_config?.allow_all ?? defaults.require_whitelist === false,
        allowed_commands: parsed.shell_exec_config?.allowed_commands || [],
        blocked_commands: parsed.shell_exec_config?.blocked_commands || [],
        max_timeout: parsed.shell_exec_config?.max_timeout || 300000,
        default_timeout: parsed.shell_exec_config?.default_timeout || 30000
      }
    };
  } catch (error) {
    return {
      enabledTools: new Set(["fs.list", "fs.read", "fs.write"]),
      shellExecConfig: {
        ...defaults,
        security_mode: securityMode,
        allow_all: false,
        allowed_commands: [],
        blocked_commands: [],
        max_timeout: 300000,
        default_timeout: 30000
      }
    };
  }
}
