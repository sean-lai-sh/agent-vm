// Security: Create safe environment for command execution
export function createSafeEnvironment() {
  return {
    PATH: '/usr/local/bin:/usr/bin:/bin',
    HOME: '/home/agent',
    USER: 'agent',
    LANG: 'C.UTF-8'
  };
}
