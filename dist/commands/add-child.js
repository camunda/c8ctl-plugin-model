import { addChildElement, loadFile, saveFile, getElementById } from '../bpmn.js';
import { readState, writeState } from '../state.js';
export async function addChild(args, cwd, logger) {
    const [type, ...rest] = args;
    if (!type || rest.length === 0) {
        throw new Error('Usage: c8ctl model add-child <type> <label>');
    }
    const label = rest.join(' ');
    const state = readState();
    const { moddle, definitions } = await loadFile(state.file);
    const parent = getElementById(definitions, state.cursor);
    if (!parent)
        throw new Error(`Cursor element '${state.cursor}' not found`);
    if (parent.$type !== 'bpmn:SubProcess' && parent.$type !== 'bpmn:AdHocSubProcess') {
        throw new Error(`'${state.cursor}' is ${parent.$type} — add-child requires a sub-process`);
    }
    const newEl = addChildElement(moddle, definitions, state.cursor, type, label);
    await saveFile(state.file, moddle, definitions);
    writeState({ ...state, cursor: newEl.id });
    logger?.success(`Added ${newEl.$type} '${label}' (${newEl.id}) inside ${state.cursor}`);
    logger?.info(`Cursor: ${newEl.id}`);
}
