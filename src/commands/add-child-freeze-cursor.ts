import { addChildElement, loadFile, saveFile, getElementById } from '../bpmn.js';
import { readState } from '../state.js';
import type { CommandLogger } from '../logger.js';

export async function addChildFreezeCursor(args: string[], cwd: string, logger?: CommandLogger): Promise<void> {
  const [type, ...rest] = args;
  if (!type || rest.length === 0) {
    throw new Error('Usage: c8ctl model add-child-freeze-cursor <type> <label>');
  }

  const label = rest.join(' ');
  const state = readState(cwd);

  const { moddle, definitions } = await loadFile(state.file);
  const parent = getElementById(definitions, state.cursor);
  if (!parent) throw new Error(`Cursor element '${state.cursor}' not found`);
  if (parent.$type !== 'bpmn:SubProcess' && parent.$type !== 'bpmn:AdHocSubProcess') {
    throw new Error(`'${state.cursor}' is ${parent.$type} — add-child-freeze-cursor requires a sub-process`);
  }

  const newEl = addChildElement(moddle, definitions, state.cursor, type, label);
  await saveFile(state.file, moddle, definitions);

  logger?.success(`Added ${newEl.$type} '${label}' (${newEl.id}) inside ${state.cursor}`);
  logger?.info(`Cursor: ${state.cursor} (unchanged)`);
}
