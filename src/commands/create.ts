import { createElement, loadFile, saveFile, renameElementId } from '../bpmn.js';
import { readState, writeState } from '../state.js';
import { parseArgs, parseEventRefFlags } from '../args.js';
import type { CommandLogger } from '../logger.js';
import { extractIdFlag } from './args.js';

export async function create(args: string[], cwd: string, logger?: CommandLogger): Promise<void> {
  const { id: customId, remaining: argsAfterIdFlag } = extractIdFlag(args);
  const { positional, flags } = parseArgs(argsAfterIdFlag);
  const [type, ...rest] = positional;
  if (!type || rest.length === 0) {
    throw new Error('Usage: c8ctl model create <type> <label> [--id <id>]');
  }

  const label = rest.join(' ');
  const state = readState();

  const eventRefOpts = parseEventRefFlags(flags);
  const { moddle, definitions } = await loadFile(state.file);
  const newEl = createElement(moddle, definitions, type, label, eventRefOpts);
  if (customId !== undefined) {
    renameElementId(definitions, newEl, customId);
  }
  await saveFile(state.file, moddle, definitions);

  const finalId = customId ?? newEl.id;
  writeState({ ...state, cursor: finalId });
  logger?.success(`Created ${newEl.$type} '${label}' (${finalId})`);
  logger?.info(`Cursor: ${finalId}`);
}
