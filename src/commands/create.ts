import { createElement, loadFile, saveFile, renameElementId } from '../bpmn.js';
import { readState, writeState } from '../state.js';
import type { CommandLogger } from '../logger.js';
import { extractIdFlag } from './args.js';

export async function create(args: string[], cwd: string, logger?: CommandLogger): Promise<void> {
  const { id: customId, remaining: argsWithoutId } = extractIdFlag(args);
  const [type, ...rest] = argsWithoutId;
  if (!type || rest.length === 0) {
    throw new Error('Usage: c8ctl model create <type> <label> [--id <id>]');
  }

  const label = rest.join(' ');
  const state = readState();

  const { moddle, definitions } = await loadFile(state.file);
  const newEl = createElement(moddle, definitions, type, label);
  if (customId !== undefined) {
    renameElementId(definitions, newEl, customId);
  }
  await saveFile(state.file, moddle, definitions);

  const finalId = customId ?? newEl.id;
  writeState({ ...state, cursor: finalId });
  logger?.success(`Created ${newEl.$type} '${label}' (${finalId})`);
  logger?.info(`Cursor: ${finalId}`);
}
