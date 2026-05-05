import { loadFile, toStatusJson } from '../bpmn.js';
import { readState } from '../state.js';
import type { CommandLogger } from '../logger.js';

export async function status(_args: string[], cwd: string, logger?: CommandLogger): Promise<void> {
  const state = readState(cwd);
  const { definitions } = await loadFile(state.file);
  const json = toStatusJson(definitions, state.cursor);
  logger?.json(json);
}
