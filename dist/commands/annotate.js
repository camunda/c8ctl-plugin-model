import { addTextAnnotation, loadFile, saveFile, getElementById } from '../bpmn.js';
import { readState } from '../state.js';
const ELEMENT_ID_PATTERN = /^[A-Za-z]+_\d+$/;
export async function annotate(args, cwd, logger) {
    if (args.length === 0) {
        throw new Error('Usage: c8ctl model annotate <text> [elementId]');
    }
    const lastArg = args[args.length - 1];
    const hasExplicitTarget = ELEMENT_ID_PATTERN.test(lastArg);
    const textParts = hasExplicitTarget ? args.slice(0, -1) : args;
    const text = textParts.join(' ');
    if (!text)
        throw new Error('Usage: c8ctl model annotate <text> [elementId]');
    const state = readState(cwd);
    const elementId = hasExplicitTarget ? lastArg : state.cursor;
    const { moddle, definitions } = await loadFile(state.file);
    if (!getElementById(definitions, elementId)) {
        throw new Error(`Element '${elementId}' not found`);
    }
    const annotation = addTextAnnotation(moddle, definitions, text, elementId);
    await saveFile(state.file, moddle, definitions);
    logger?.success(`Added text annotation '${text}' (${annotation.id}) on ${elementId}`);
}
