import { createElement, loadFile, saveFile } from '../bpmn.js';
import { readState, writeState } from '../state.js';
export async function create(args, cwd, logger) {
    const [type, ...rest] = args;
    if (!type || rest.length === 0) {
        throw new Error('Usage: c8ctl model create <type> <label>');
    }
    const label = rest.join(' ');
    const state = readState();
    const { moddle, definitions } = await loadFile(state.file);
    const newEl = createElement(moddle, definitions, type, label);
    await saveFile(state.file, moddle, definitions);
    writeState({ ...state, cursor: newEl.id });
    logger?.success(`Created ${newEl.$type} '${label}' (${newEl.id})`);
    logger?.info(`Cursor: ${newEl.id}`);
}
