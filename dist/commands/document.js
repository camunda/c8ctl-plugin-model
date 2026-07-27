import { setDocumentation, loadFile, saveFile, getElementById } from '../bpmn.js';
import { readState } from '../state.js';
const ELEMENT_ID_PATTERN = /^[A-Za-z]+_\d+$/;
export async function document(args, cwd, logger) {
    if (args.length === 0) {
        throw new Error('Usage: c8ctl model document <text> [elementId] [--format <mime>]');
    }
    // Parse --format flag
    let textFormat;
    const formatIdx = args.indexOf('--format');
    let filteredArgs = args;
    if (formatIdx !== -1) {
        if (formatIdx + 1 >= args.length) {
            throw new Error('Usage: c8ctl model document <text> [elementId] [--format <mime>]');
        }
        textFormat = args[formatIdx + 1];
        filteredArgs = [...args.slice(0, formatIdx), ...args.slice(formatIdx + 2)];
    }
    if (filteredArgs.length === 0) {
        throw new Error('Usage: c8ctl model document <text> [elementId] [--format <mime>]');
    }
    const lastArg = filteredArgs[filteredArgs.length - 1];
    const hasExplicitTarget = ELEMENT_ID_PATTERN.test(lastArg);
    const textParts = hasExplicitTarget ? filteredArgs.slice(0, -1) : filteredArgs;
    const text = textParts.join(' ');
    if (!text)
        throw new Error('Usage: c8ctl model document <text> [elementId] [--format <mime>]');
    const state = readState();
    const elementId = hasExplicitTarget ? lastArg : state.cursor;
    const { moddle, definitions } = await loadFile(state.file);
    if (!getElementById(definitions, elementId)) {
        throw new Error(`Element '${elementId}' not found`);
    }
    setDocumentation(moddle, definitions, text, elementId, textFormat);
    await saveFile(state.file, moddle, definitions);
    logger?.success(`Set documentation on ${elementId}`);
}
