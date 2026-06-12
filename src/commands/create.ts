import { createElement, loadFile, saveFile } from '../bpmn.js';
import type { EventRefOptions } from '../bpmn.js';
import { readState, writeState } from '../state.js';
import { parseArgs, flagString } from '../args.js';
import type { CommandLogger } from '../logger.js';

export async function create(args: string[], cwd: string, logger?: CommandLogger): Promise<void> {
  const { positional, flags } = parseArgs(args);
  const [type, ...rest] = positional;
  if (!type || rest.length === 0) {
    throw new Error('Usage: c8ctl model create <type> <label>');
  }

  const label = rest.join(' ');
  const state = readState();

  const eventRefOpts: EventRefOptions = {};
  const sigName = flagString(flags, 'signal-name');
  const msgName = flagString(flags, 'message-name');
  if (sigName) eventRefOpts.signalName = sigName;
  if (msgName) eventRefOpts.messageName = msgName;

  const { moddle, definitions } = await loadFile(state.file);
  const newEl = createElement(moddle, definitions, type, label, eventRefOpts);
  await saveFile(state.file, moddle, definitions);

  writeState({ ...state, cursor: newEl.id });
  logger?.success(`Created ${newEl.$type} '${label}' (${newEl.id})`);
  logger?.info(`Cursor: ${newEl.id}`);
}
