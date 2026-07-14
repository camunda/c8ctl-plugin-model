export function parseArgs(args) {
    const positional = [];
    const flags = {};
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg.startsWith('--')) {
            const key = arg.slice(2);
            const next = args[i + 1];
            if (next !== undefined && !next.startsWith('--')) {
                flags[key] = next;
                i++;
            }
            else {
                flags[key] = true;
            }
        }
        else {
            positional.push(arg);
        }
    }
    return { positional, flags };
}
export function flagString(flags, key) {
    const v = flags[key];
    return typeof v === 'string' ? v : undefined;
}
export function flagStrings(args, flag) {
    const result = [];
    for (let i = 0; i < args.length; i++) {
        if (args[i] === `--${flag}` && i + 1 < args.length && !args[i + 1].startsWith('--')) {
            result.push(args[i + 1]);
        }
    }
    return result;
}
export function parseEventRefFlags(flags) {
    const result = {};
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
    if (sigName)
        result.signalName = sigName;
    if (msgName)
        result.messageName = msgName;
    return result;
}
