import { loadFile, findContainerOf, getProcess } from '../bpmn.js';
import { readState, writeState } from '../state.js';

export async function selectParent(_args: string[], cwd: string): Promise<void> {
  const state = readState(cwd);
  const { definitions } = await loadFile(state.file);

  const process = getProcess(definitions);
  const container = findContainerOf(definitions, state.cursor);

  if (!container || container.id === process.id) {
    throw new Error(`Element '${state.cursor}' has no parent subprocess`);
  }

  writeState(cwd, { ...state, cursor: container.id });
  console.log(`Cursor: ${container.id}`);
}
