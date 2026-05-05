import { loadFile, findContainerOf, getProcess } from '../bpmn.js';
import { readState, writeState } from '../state.js';
import type { CommandLogger } from '../logger.js';

export async function selectParent(_args: string[], cwd: string, logger?: CommandLogger): Promise<void> {
  const state = readState(cwd);
  const { definitions } = await loadFile(state.file);

  const process = getProcess(definitions);
  const container = findContainerOf(definitions, state.cursor);

  if (!container || container.id === process.id) {
    throw new Error(`Element '${state.cursor}' has no parent subprocess`);
  }

  writeState(cwd, { ...state, cursor: container.id });
  logger?.info(`Cursor: ${container.id}`);
}
