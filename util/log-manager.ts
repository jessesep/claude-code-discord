import * as path from "https://deno.land/std/path/mod.ts";

export interface LogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  module: string;
  message: string;
  details?: any;
}

export class LogManager {
  private static instance: LogManager;
  private logDir: string;
  private currentLogFile: string;

  private constructor() {
    this.logDir = path.join(Deno.cwd(), 'logs');
    this.currentLogFile = path.join(this.logDir, `bot_${new Date().toISOString().split('T')[0]}.log`);
    this.ensureLogDir();
  }

  static getInstance(): LogManager {
    if (!LogManager.instance) {
      LogManager.instance = new LogManager();
    }
    return LogManager.instance;
  }

  private async ensureLogDir() {
    try {
      await Deno.mkdir(this.logDir, { recursive: true });
    } catch (e) {
      if (!(e instanceof Deno.errors.AlreadyExists)) throw e;
    }
  }

  async log(level: LogEntry['level'], module: string, message: string, details?: any) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      module,
      message,
      details
    };

    const logLine = JSON.stringify(entry) + '\n';
    console.log(`[${entry.timestamp}] [${level.toUpperCase()}] [${module}] ${message}`);

    try {
      await Deno.writeTextFile(this.currentLogFile, logLine, { append: true });
    } catch (error) {
      console.error(`[LogManager] Failed to write to log file: ${error}`);
    }
  }

  info(module: string, message: string, details?: any) { return this.log('info', module, message, details); }
  warn(module: string, message: string, details?: any) { return this.log('warn', module, message, details); }
  error(module: string, message: string, details?: any) { return this.log('error', module, message, details); }
  debug(module: string, message: string, details?: any) { return this.log('debug', module, message, details); }

  async getRecentLogs(limit: number = 100): Promise<LogEntry[]> {
    try {
      const content = await Deno.readTextFile(this.currentLogFile);
      const lines = content.trim().split('\n');
      return lines.slice(-limit).map(line => JSON.parse(line));
    } catch {
      return [];
    }
  }
}
