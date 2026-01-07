/**
 * Instance Lock
 * 
 * Prevents multiple instances of the bot from running simultaneously.
 * Uses a PID file to track the running instance.
 */

const LOCK_FILE = '.bot.pid';

/**
 * Check if another instance is already running
 */
export async function isInstanceRunning(): Promise<boolean> {
  try {
    const pid = await Deno.readTextFile(LOCK_FILE);
    const pidNum = parseInt(pid.trim(), 10);
    
    if (isNaN(pidNum)) {
      return false;
    }

    // Check if process is still running
    try {
      // On Unix, sending signal 0 checks if process exists
      Deno.kill(pidNum, "SIGCONT");
      return true;
    } catch {
      // Process not running, stale PID file
      return false;
    }
  } catch {
    // No lock file
    return false;
  }
}

/**
 * Acquire the instance lock
 * Returns true if lock acquired, false if another instance is running
 */
export async function acquireInstanceLock(): Promise<boolean> {
  if (await isInstanceRunning()) {
    return false;
  }

  // Write our PID
  await Deno.writeTextFile(LOCK_FILE, Deno.pid.toString());
  return true;
}

/**
 * Release the instance lock (Synchronous for exit handlers)
 */
export function releaseInstanceLock(): void {
  try {
    const pid = Deno.readTextFileSync(LOCK_FILE);
    // Only remove if it's our PID
    if (parseInt(pid.trim(), 10) === Deno.pid) {
      Deno.removeSync(LOCK_FILE);
    }
  } catch {
    // Ignore errors
  }
}

/**
 * Force kill any existing instance and acquire lock
 */
export async function forceAcquireLock(): Promise<void> {
  try {
    const pid = await Deno.readTextFile(LOCK_FILE);
    const pidNum = parseInt(pid.trim(), 10);
    
    if (!isNaN(pidNum) && pidNum !== Deno.pid) {
      console.log(`[Lock] Killing existing instance (PID: ${pidNum})...`);
      try {
        Deno.kill(pidNum, "SIGTERM");
        // Wait a bit for it to die
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch {
        // Process might already be dead
      }
    }
  } catch {
    // No lock file
  }

  // Write our PID
  await Deno.writeTextFile(LOCK_FILE, Deno.pid.toString());
  console.log(`[Lock] Instance lock acquired (PID: ${Deno.pid})`);
}
