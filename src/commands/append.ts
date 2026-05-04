import { addElement, loadFile, saveFile, getElementById } from '../bpmn.js';
import { readState, writeState } from '../state.js';

const ELEMENT_ID_PATTERN = /^[A-Za-z]+_\d+$/;

export async function append(args: string[], cwd: string): Promise<void> {
  const [type, ...rest] = args;
  if (!type || rest.length === 0) {
    throw new Error('Usage: c8ctl model append <type> <label> [sourceElementId]');
  }

  // If last arg matches element ID pattern, treat it as explicit source (cursor unchanged)
  const lastArg = rest[rest.length - 1];
  const hasExplicitSource = ELEMENT_ID_PATTERN.test(lastArg);

  const labelParts = hasExplicitSource ? rest.slice(0, -1) : rest;
  const label = labelParts.join(' ');
  if (!label) throw new Error('Usage: c8ctl model append <type> <label> [sourceElementId]');

  const state = readState(cwd);
  const sourceId = hasExplicitSource ? lastArg : state.cursor;

  const { moddle, definitions } = await loadFile(state.file);

  // Validate source exists
  if (!getElementById(definitions, sourceId)) {
    throw new Error(`Source element '${sourceId}' not found`);
  }

  const newEl = addElement(moddle, definitions, type, label, sourceId);
  await saveFile(state.file, moddle, definitions);

  if (!hasExplicitSource) {
    writeState(cwd, { ...state, cursor: newEl.id });
    console.log(`Appended ${newEl.$type} '${label}' (${newEl.id})`);
    console.log(`Cursor: ${newEl.id}`);
  } else {
    console.log(`Appended ${newEl.$type} '${label}' (${newEl.id}) from ${sourceId}`);
    console.log(`Cursor: ${state.cursor} (unchanged)`);
  }
}
