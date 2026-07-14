import { createElement, addChildElement, loadFile, saveFile, getElementById, renameElementId } from '../bpmn.js';
import { readState, writeState } from '../state.js';
import { parseArgs, parseEventRefFlags } from '../args.js';
import { extractIdFlag, applyZeebeFlags } from './args.js';
const BOOLEAN_FLAGS = ['--freeze-cursor', '--parent'];
export async function create(args, cwd, logger) {
    const { id: customId, remaining: argsAfterIdFlag } = extractIdFlag(args);
    const freezeCursor = argsAfterIdFlag.includes('--freeze-cursor');
    const useParent = argsAfterIdFlag.includes('--parent');
    const cleanArgs = argsAfterIdFlag.filter(a => !BOOLEAN_FLAGS.includes(a));
    const { positional, flags } = parseArgs(cleanArgs);
    const [type, ...rest] = positional;
    if (!type) {
        throw new Error('Usage: c8ctl model create <type> [label] [--name <label>] [--parent] [--freeze-cursor] [--id <id>]');
    }
    const nameFlag = typeof flags['name'] === 'string' ? flags['name'] : undefined;
    const label = nameFlag ?? rest.join(' ');
    if (!label) {
        throw new Error('Usage: c8ctl model create <type> <label> [--id <id>]');
    }
    const state = readState();
    const eventRefOpts = parseEventRefFlags(flags);
    const { moddle, definitions } = await loadFile(state.file);
    let newEl;
    if (useParent) {
        const parent = getElementById(definitions, state.cursor);
        if (!parent)
            throw new Error(`Cursor element '${state.cursor}' not found`);
        if (parent.$type !== 'bpmn:SubProcess' && parent.$type !== 'bpmn:AdHocSubProcess') {
            throw new Error(`'${state.cursor}' is ${parent.$type} — --parent requires a sub-process`);
        }
        newEl = addChildElement(moddle, definitions, state.cursor, type, label, eventRefOpts);
    }
    else {
        newEl = createElement(moddle, definitions, type, label, eventRefOpts);
    }
    if (customId !== undefined) {
        renameElementId(definitions, newEl, customId);
    }
    applyZeebeFlags(moddle, newEl, cleanArgs, definitions, logger);
    await saveFile(state.file, moddle, definitions);
    const finalId = customId ?? newEl.id;
    if (!freezeCursor)
        writeState({ ...state, cursor: finalId });
    const modeLabel = useParent ? ` inside ${state.cursor}` : '';
    logger?.success(`Created ${newEl.$type} '${label}' (${finalId})${modeLabel}`);
    logger?.info(freezeCursor ? `Cursor: ${state.cursor} (unchanged)` : `Cursor: ${finalId}`);
}
