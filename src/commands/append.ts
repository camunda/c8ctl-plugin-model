import { addElement, loadFile, saveFile, getElementById, renameElementId } from '../bpmn.js';
import { readState, writeState } from '../state.js';
import type { CommandLogger } from '../logger.js';
import { ELEMENT_ID_PATTERN, extractIdFlag } from './args.js';

export { ELEMENT_ID_PATTERN };

export async function append(args: string[], cwd: string, logger?: CommandLogger): Promise<void> {
  const { id: customId, remaining: argsWithoutId } = extractIdFlag(args);
  const [type, ...rest] = argsWithoutId;
  if (!type || rest.length === 0) {
    throw new Error('Usage: c8ctl model append <type> <label> [sourceElementId] [--id <id>]');
  }

  const lastArg = rest[rest.length - 1];
  const hasExplicitSource = ELEMENT_ID_PATTERN.test(lastArg);

  const labelParts = hasExplicitSource ? rest.slice(0, -1) : rest;
  const label = labelParts.join(' ');
  if (!label) throw new Error('Usage: c8ctl model append <type> <label> [sourceElementId] [--id <id>]');

  const state = readState(cwd);
  const sourceId = hasExplicitSource ? lastArg : state.cursor;

  const { moddle, definitions } = await loadFile(state.file);
  if (!getElementById(definitions, sourceId)) {
    throw new Error(`Source element '${sourceId}' not found`);
  }

  const newEl = addElement(moddle, definitions, type, label, sourceId);
  if (customId !== undefined) {
    renameElementId(definitions, newEl, customId);
  }
  await saveFile(state.file, moddle, definitions);

  const finalId = customId ?? newEl.id;
  writeState(cwd, { ...state, cursor: finalId });
  logger?.success(`Appended ${newEl.$type} '${label}' (${finalId})`);
  logger?.info(`Cursor: ${finalId}`);
}
