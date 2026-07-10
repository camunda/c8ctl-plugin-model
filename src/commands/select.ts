import { loadFile, getElementById, findContainerOf, getProcess } from '../bpmn.js';
import { readState, writeState } from '../state.js';
import { parseArgs } from '../args.js';
import type { CommandLogger } from '../logger.js';

export async function select(args: string[], cwd: string, logger?: CommandLogger): Promise<void> {
  const useParent = args.includes('--parent');
  const cleanArgs = args.filter(a => a !== '--parent');
  const { positional } = parseArgs(cleanArgs);

  const state = readState();
  const { definitions } = await loadFile(state.file);

  if (useParent) {
    const process = getProcess(definitions);
    const container = findContainerOf(definitions, state.cursor);
    if (!container || container.id === process.id) {
      throw new Error(`Element '${state.cursor}' has no parent subprocess`);
    }
    writeState({ ...state, cursor: container.id });
    logger?.info(`Cursor: ${container.id}`);
    return;
  }

  const id = positional[0];
  if (!id) throw new Error('Usage: c8ctl model select <elementId>');

  const el = getElementById(definitions, id);
  if (!el) throw new Error(`Element '${id}' not found`);

  writeState({ ...state, cursor: id });
  logger?.info(`Cursor: ${id} (${el.$type}, name: '${el.name ?? ''}')`);
}
