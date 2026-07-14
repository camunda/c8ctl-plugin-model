import { loadFile, getElementById, toEventDefinitionJson } from '../bpmn.js';
import { readState } from '../state.js';
export async function cursorStatus(_args, cwd, logger) {
    const state = readState();
    const { definitions } = await loadFile(state.file);
    const el = getElementById(definitions, state.cursor);
    const type = el ? el.$type.replace('bpmn:', '') : 'unknown';
    const name = el?.name ?? '';
    const result = { cursor: state.cursor, type, name, file: state.file };
    if (el) {
        const eventDefinition = toEventDefinitionJson(el.eventDefinitions ?? []);
        if (eventDefinition)
            result['eventDefinition'] = eventDefinition;
    }
    logger?.json(result);
}
