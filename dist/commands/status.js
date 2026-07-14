import { loadFile, toStatusJson } from '../bpmn.js';
import { readState } from '../state.js';
export async function status(_args, cwd, logger) {
    const state = readState();
    const { definitions } = await loadFile(state.file);
    const json = toStatusJson(definitions, state.cursor);
    logger?.json(json);
}
