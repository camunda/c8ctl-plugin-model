import { addElement, loadFile, saveFile, getElementById, renameElementId } from '../bpmn.js';
import { readState, writeState } from '../state.js';
import { parseArgs, parseEventRefFlags } from '../args.js';
import type { CommandLogger } from '../logger.js';
import { ELEMENT_ID_PATTERN, extractIdFlag } from './args.js';

export { ELEMENT_ID_PATTERN };

export async function append(args: string[], cwd: string, logger?: CommandLogger): Promise<void> {
  const { id: customId, remaining: argsAfterIdFlag } = extractIdFlag(args);
  const { positional, flags } = parseArgs(argsAfterIdFlag);
  const [type, ...rest] = positional;
  if (!type || rest.length === 0) {
    throw new Error('Usage: c8ctl model append <type> <label> [sourceElementId] [--id <id>]');
  }

  const state = readState();
  const { moddle, definitions } = await loadFile(state.file);

  // Treat the last arg as an explicit sourceElementId only if it actually resolves
  // to an existing element — avoids mis-parsing single-word labels like "Application".
  const lastArg = rest[rest.length - 1];
  const hasExplicitSource = rest.length > 1 && !!getElementById(definitions, lastArg);

  const labelParts = hasExplicitSource ? rest.slice(0, -1) : rest;
  const label = labelParts.join(' ');
  if (!label) throw new Error('Usage: c8ctl model append <type> <label> [sourceElementId] [--id <id>]');

  const sourceId = hasExplicitSource ? lastArg : state.cursor;
  if (!hasExplicitSource && !getElementById(definitions, sourceId)) {
    throw new Error(`Source element '${sourceId}' not found`);
  }

  const eventRefOpts = parseEventRefFlags(flags);
  const newEl = addElement(moddle, definitions, type, label, sourceId, eventRefOpts);
  if (customId !== undefined) {
    renameElementId(definitions, newEl, customId);
  }
  await saveFile(state.file, moddle, definitions);

  const finalId = customId ?? newEl.id;
  writeState({ ...state, cursor: finalId });
  logger?.success(`Appended ${newEl.$type} '${label}' (${finalId})`);
  logger?.info(`Cursor: ${finalId}`);
}
