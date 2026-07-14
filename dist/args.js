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
