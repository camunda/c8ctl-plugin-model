import { addChildElement, loadFile, saveFile, getElementById } from '../bpmn.js';
import { readState, writeState } from '../state.js';

export async function addChild(args: string[], cwd: string): Promise<void> {
  const [type, ...rest] = args;
  if (!type || rest.length === 0) {
    throw new Error('Usage: c8ctl model add-child <type> <label>');
  }

  const label = rest.join(' ');
  const state = readState(cwd);

  const { moddle, definitions } = await loadFile(state.file);
  const parent = getElementById(definitions, state.cursor);
  if (!parent) throw new Error(`Cursor element '${state.cursor}' not found`);
  if (parent.$type !== 'bpmn:SubProcess' && parent.$type !== 'bpmn:AdHocSubProcess') {
    throw new Error(`'${state.cursor}' is ${parent.$type} — add-child requires a sub-process`);
  }

  const newEl = addChildElement(moddle, definitions, state.cursor, type, label);
  await saveFile(state.file, moddle, definitions);

  writeState(cwd, { ...state, cursor: newEl.id });
  console.log(`Added ${newEl.$type} '${label}' (${newEl.id}) inside ${state.cursor}`);
  console.log(`Cursor: ${newEl.id}`);
}
