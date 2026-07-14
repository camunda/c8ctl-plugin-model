import { loadFile, getElementById } from '../bpmn.js';
import { readState } from '../state.js';
export async function cursorStatus(_args, cwd, logger) {
    const state = readState();
    const { definitions } = await loadFile(state.file);
    const el = getElementById(definitions, state.cursor);
    const type = el ? el.$type.replace('bpmn:', '') : 'unknown';
    const name = el?.name ?? '';
    logger?.json({ cursor: state.cursor, type, name, file: state.file });
}
