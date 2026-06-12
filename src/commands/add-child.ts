import { addChildElement, loadFile, saveFile, getElementById } from '../bpmn.js';
import type { EventRefOptions } from '../bpmn.js';
import { readState, writeState } from '../state.js';
import { parseArgs, flagString } from '../args.js';
import type { CommandLogger } from '../logger.js';

export async function addChild(args: string[], cwd: string, logger?: CommandLogger): Promise<void> {
  const { positional, flags } = parseArgs(args);
  const [type, ...rest] = positional;
  if (!type || rest.length === 0) {
    throw new Error('Usage: c8ctl model add-child <type> <label>');
  }

  const label = rest.join(' ');
  const state = readState();

  const { moddle, definitions } = await loadFile(state.file);
  const parent = getElementById(definitions, state.cursor);
  if (!parent) throw new Error(`Cursor element '${state.cursor}' not found`);
  if (parent.$type !== 'bpmn:SubProcess' && parent.$type !== 'bpmn:AdHocSubProcess') {
    throw new Error(`'${state.cursor}' is ${parent.$type} — add-child requires a sub-process`);
  }

  const eventRefOpts: EventRefOptions = {};
  const sigName = flagString(flags, 'signal-name');
  const msgName = flagString(flags, 'message-name');
  if (sigName) eventRefOpts.signalName = sigName;
  if (msgName) eventRefOpts.messageName = msgName;

  const newEl = addChildElement(moddle, definitions, state.cursor, type, label, eventRefOpts);
  await saveFile(state.file, moddle, definitions);

  writeState({ ...state, cursor: newEl.id });
  logger?.success(`Added ${newEl.$type} '${label}' (${newEl.id}) inside ${state.cursor}`);
  logger?.info(`Cursor: ${newEl.id}`);
}
