import { loadFile, findContainerOf, getProcess } from '../bpmn.js';
import { readState, writeState } from '../state.js';
export async function selectParent(_args, cwd, logger) {
    const state = readState();
    const { definitions } = await loadFile(state.file);
    const process = getProcess(definitions);
    const container = findContainerOf(definitions, state.cursor);
    if (!container || container.id === process.id) {
        throw new Error(`Element '${state.cursor}' has no parent subprocess`);
    }
    writeState({ ...state, cursor: container.id });
    logger?.info(`Cursor: ${container.id}`);
}
