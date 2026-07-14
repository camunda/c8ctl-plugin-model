import { loadFile, getElementById } from '../bpmn.js';
import { readState, writeState } from '../state.js';
export async function select(args, cwd, logger) {
    const id = args[0];
    if (!id)
        throw new Error('Usage: c8ctl model select <elementId>');
    const state = readState();
    const { definitions } = await loadFile(state.file);
    const el = getElementById(definitions, id);
    if (!el)
        throw new Error(`Element '${id}' not found`);
    writeState({ ...state, cursor: id });
    logger?.info(`Cursor: ${id} (${el.$type}, name: '${el.name ?? ''}')`);
}
