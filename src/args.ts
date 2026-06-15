export interface ParsedArgs {
  positional: string[];
  flags: Record<string, string | boolean>;
}

export function parseArgs(args: string[]): ParsedArgs {
  const positional: string[] = [];
  const flags: Record<string, string | boolean> = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = args[i + 1];
      if (next !== undefined && !next.startsWith('--')) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = true;
      }
    } else {
      positional.push(arg);
    }
  }

  return { positional, flags };
}

export function flagString(flags: Record<string, string | boolean>, key: string): string | undefined {
  const v = flags[key];
  return typeof v === 'string' ? v : undefined;
}

export interface EventRefFlags {
  signalName?: string;
  messageName?: string;
}

export function parseEventRefFlags(flags: Record<string, string | boolean>): EventRefFlags {
  const result: EventRefFlags = {};
  if (flags['signal-name'] === true) {
    throw new Error('--signal-name requires a value');
  }
  if (flags['message-name'] === true) {
    throw new Error('--message-name requires a value');
  }
  const sigName = flagString(flags, 'signal-name');
  const msgName = flagString(flags, 'message-name');
  if (sigName && msgName) {
    throw new Error('--signal-name and --message-name cannot be used together');
  }
  if (sigName) result.signalName = sigName;
  if (msgName) result.messageName = msgName;
  return result;
}
