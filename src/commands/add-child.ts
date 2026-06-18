import { addChildElement, loadFile, saveFile, getElementById, renameElementId } from '../bpmn.js';
import { readState, writeState } from '../state.js';
import { parseArgs, parseEventRefFlags } from '../args.js';
import type { CommandLogger } from '../logger.js';
import { extractIdFlag } from './args.js';

export async function addChild(args: string[], cwd: string, logger?: CommandLogger): Promise<void> {
  const { id: customId, remaining: argsAfterIdFlag } = extractIdFlag(args);
  const { positional, flags } = parseArgs(argsAfterIdFlag);
  const [type, ...rest] = positional;
  if (!type || rest.length === 0) {
    throw new Error('Usage: c8ctl model add-child <type> <label> [--id <id>]');
  }

  const label = rest.join(' ');
  const state = readState();

  const { moddle, definitions } = await loadFile(state.file);
  const parent = getElementById(definitions, state.cursor);
  if (!parent) throw new Error(`Cursor element '${state.cursor}' not found`);
  if (parent.$type !== 'bpmn:SubProcess' && parent.$type !== 'bpmn:AdHocSubProcess') {
    throw new Error(`'${state.cursor}' is ${parent.$type} — add-child requires a sub-process`);
  }

  const eventRefOpts = parseEventRefFlags(flags);
  const newEl = addChildElement(moddle, definitions, state.cursor, type, label, eventRefOpts);
  if (customId !== undefined) {
    renameElementId(definitions, newEl, customId);
  }
  await saveFile(state.file, moddle, definitions);

  const finalId = customId ?? newEl.id;
  writeState({ ...state, cursor: finalId });
  logger?.success(`Added ${newEl.$type} '${label}' (${finalId}) inside ${state.cursor}`);
  logger?.info(`Cursor: ${finalId}`);
}
