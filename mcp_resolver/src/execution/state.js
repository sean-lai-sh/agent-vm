// Track active shell executions for concurrency limiting
let activeExecutions = 0;

export function incrementActiveExecutions() {
  activeExecutions++;
}

export function decrementActiveExecutions() {
  activeExecutions--;
}

export function getActiveExecutions() {
  return activeExecutions;
}
