import { createElement, loadFile, saveFile } from '../bpmn.js';
import { readState } from '../state.js';

export async function createFreezeCursor(args: string[], cwd: string): Promise<void> {
  const [type, ...rest] = args;
  if (!type || rest.length === 0) {
    throw new Error('Usage: c8ctl model create-freeze-cursor <type> <label>');
  }

  const label = rest.join(' ');
  const state = readState(cwd);

  const { moddle, definitions } = await loadFile(state.file);
  const newEl = createElement(moddle, definitions, type, label);
  await saveFile(state.file, moddle, definitions);

  console.log(`Created ${newEl.$type} '${label}' (${newEl.id})`);
  console.log(`Cursor: ${state.cursor} (unchanged)`);
}
