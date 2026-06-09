import { addElement, loadFile, saveFile, getElementById } from '../bpmn.js';
import { readState } from '../state.js';
import { ELEMENT_ID_PATTERN } from './append.js';
import type { CommandLogger } from '../logger.js';

export async function appendFreezeCursor(args: string[], cwd: string, logger?: CommandLogger): Promise<void> {
  const [type, ...rest] = args;
  if (!type || rest.length === 0) {
    throw new Error('Usage: c8ctl model append-freeze-cursor <type> <label> [sourceElementId]');
  }

  const lastArg = rest[rest.length - 1];
  const hasExplicitSource = ELEMENT_ID_PATTERN.test(lastArg);

  const labelParts = hasExplicitSource ? rest.slice(0, -1) : rest;
  const label = labelParts.join(' ');
  if (!label) throw new Error('Usage: c8ctl model append-freeze-cursor <type> <label> [sourceElementId]');

  const state = readState();
  const sourceId = hasExplicitSource ? lastArg : state.cursor;

  const { moddle, definitions } = await loadFile(state.file);
  if (!getElementById(definitions, sourceId)) {
    throw new Error(`Source element '${sourceId}' not found`);
  }

  const newEl = addElement(moddle, definitions, type, label, sourceId);
  await saveFile(state.file, moddle, definitions);

  logger?.success(`Appended ${newEl.$type} '${label}' (${newEl.id}) from ${sourceId}`);
  logger?.info(`Cursor: ${state.cursor} (unchanged)`);
}
