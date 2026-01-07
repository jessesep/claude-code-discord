/**
 * Process Manager for Bot and Server
 * Handles finding, killing, and restarting bot/server processes
 */

import { detectPlatform } from "./platform.ts";

export interface ProcessInfo {
  pid: number;
  command: string;
  type: 'bot' | 'server' | 'unknown';
}

/**
 * Find all running bot and server processes
 */
export async function findBotProcesses(): Promise<ProcessInfo[]> {
  const processes: ProcessInfo[] = [];
  const platform = detectPlatform();

  try {
    if (platform === "windows") {
      // Windows: Use tasklist
      const cmd = new Deno.Command("tasklist", {
        args: ["/FO", "CSV", "/NH"],
        stdout: "piped",
        stderr: "piped",
      });

      const output = await cmd.output();
      const text = new TextDecoder().decode(output.stdout);
      const lines = text.split("\n");

      for (const line of lines) {
        if (line.includes("deno.exe") || line.includes("node.exe")) {
          const parts = line.split(",");
          if (parts.length >= 2) {
            const pid = parseInt(parts[1].replace(/"/g, ""));
            const command = parts[0].replace(/"/g, "");
            if (!isNaN(pid) && (command.includes("index.ts") || command.includes("deno"))) {
              processes.push({
                pid,
                command: line,
                type: command.includes("index.ts") ? "bot" : "unknown",
              });
            }
          }
        }
      }
    } else {
      // Unix-like: Use ps
      const cmd = new Deno.Command("ps", {
        args: ["aux"],
        stdout: "piped",
        stderr: "piped",
      });

      const output = await cmd.output();
      const text = new TextDecoder().decode(output.stdout);
      const lines = text.split("\n");

      for (const line of lines) {
        if (line.includes("deno") && (line.includes("index.ts") || line.includes("--allow-all"))) {
          const parts = line.trim().split(/\s+/);
          if (parts.length >= 2) {
            const pid = parseInt(parts[1]);
            if (!isNaN(pid)) {
              processes.push({
                pid,
                command: line,
                type: line.includes("index.ts") ? "bot" : "unknown",
              });
            }
          }
        }
      }
    }
  } catch (error) {
    console.error("Error finding processes:", error);
  }

  return processes;
}

/**
 * Find process using port 8000 (web server)
 */
export async function findPortProcess(port: number): Promise<ProcessInfo | null> {
  const platform = detectPlatform();

  try {
    if (platform === "windows") {
      // Windows: Use netstat
      const cmd = new Deno.Command("netstat", {
        args: ["-ano"],
        stdout: "piped",
        stderr: "piped",
      });

      const output = await cmd.output();
      const text = new TextDecoder().decode(output.stdout);
      const lines = text.split("\n");

      for (const line of lines) {
        if (line.includes(`:${port}`) && line.includes("LISTENING")) {
          const parts = line.trim().split(/\s+/);
          const pid = parseInt(parts[parts.length - 1]);
          if (!isNaN(pid)) {
            return {
              pid,
              command: `Port ${port} listener`,
              type: "server",
            };
          }
        }
      }
    } else {
      // Unix-like: Use lsof
      const cmd = new Deno.Command("lsof", {
        args: ["-ti", `:${port}`],
        stdout: "piped",
        stderr: "piped",
      });

      const output = await cmd.output();
      if (output.success) {
        const text = new TextDecoder().decode(output.stdout).trim();
        const pid = parseInt(text);
        if (!isNaN(pid)) {
          return {
            pid,
            command: `Port ${port} listener`,
            type: "server",
          };
        }
      }
    }
  } catch (error) {
    // lsof might not be available, try alternative
    console.debug("Error finding port process:", error);
  }

  return null;
}

/**
 * Kill a process by PID
 */
export async function killProcess(pid: number, force: boolean = false): Promise<boolean> {
  const platform = detectPlatform();

  try {
    if (platform === "windows") {
      const signal = force ? "SIGKILL" : "SIGINT";
      const cmd = new Deno.Command("taskkill", {
        args: force ? ["/F", "/PID", pid.toString()] : ["/PID", pid.toString()],
        stdout: "piped",
        stderr: "piped",
      });

      const output = await cmd.output();
      return output.success;
    } else {
      // Unix-like: Use kill
      const signal = force ? "SIGKILL" : "SIGTERM";
      const cmd = new Deno.Command("kill", {
        args: force ? ["-9", pid.toString()] : ["-15", pid.toString()],
        stdout: "piped",
        stderr: "piped",
      });

      const output = await cmd.output();
      return output.success;
    }
  } catch (error) {
    console.error(`Error killing process ${pid}:`, error);
    return false;
  }
}

/**
 * Kill all bot and server processes
 */
export async function killAllBotProcesses(force: boolean = false): Promise<number> {
  let killed = 0;

  // Find and kill bot processes
  const botProcesses = await findBotProcesses();
  for (const proc of botProcesses) {
    if (await killProcess(proc.pid, force)) {
      killed++;
      console.log(`Killed bot process: PID ${proc.pid}`);
    }
  }

  // Find and kill server process (port 8000)
  const serverProcess = await findPortProcess(8000);
  if (serverProcess) {
    if (await killProcess(serverProcess.pid, force)) {
      killed++;
      console.log(`Killed server process: PID ${serverProcess.pid}`);
    }
  }

  return killed;
}

/**
 * Wait for processes to fully terminate
 */
export async function waitForTermination(maxWait: number = 5000): Promise<void> {
  const startTime = Date.now();
  while (Date.now() - startTime < maxWait) {
    const processes = await findBotProcesses();
    const serverProcess = await findPortProcess(8000);
    
    if (processes.length === 0 && !serverProcess) {
      return; // All processes terminated
    }
    
    await new Promise(resolve => setTimeout(resolve, 200));
  }
}
