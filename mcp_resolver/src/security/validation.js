// Security: Validate command arguments for dangerous patterns
const DANGEROUS_PATTERNS = [
  /[;&|`$(){}[\]<>]/,  // Shell operators and substitution
  /\.\.\//,            // Path traversal
  /^-/                 // Leading dashes that could be flags
];

export function validateArgs(args) {
  for (const arg of args) {
    for (const pattern of DANGEROUS_PATTERNS) {
      if (pattern.test(arg)) {
        throw new Error(`Argument contains dangerous pattern: ${arg}`);
      }
    }
  }
}

// Security: Extract and validate base command
export function extractBaseCommand(command) {
  const trimmed = command.trim();
  const baseCommand = trimmed.split(/\s+/)[0];

  // Reject if contains path separators or shell operators
  if (/[/\\;&|`$<>]/.test(baseCommand)) {
    throw new Error('Command contains invalid characters');
  }

  return baseCommand;
}
