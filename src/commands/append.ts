import { addElement, addBoundaryEvent, loadFile, saveFile, getElementById, renameElementId } from '../bpmn.js';
import { readState, writeState } from '../state.js';
import { parseArgs, parseEventRefFlags } from '../args.js';
import type { CommandLogger } from '../logger.js';
import { ELEMENT_ID_PATTERN, extractIdFlag, applyZeebeFlags } from './args.js';

export { ELEMENT_ID_PATTERN };

const BOOLEAN_FLAGS = ['--freeze-cursor', '--boundary'];

export async function append(args: string[], cwd: string, logger?: CommandLogger): Promise<void> {
  const { id: customId, remaining: argsAfterIdFlag } = extractIdFlag(args);

  const freezeCursor = argsAfterIdFlag.includes('--freeze-cursor');
  const isBoundary = argsAfterIdFlag.includes('--boundary');
  const cleanArgs = argsAfterIdFlag.filter(a => !BOOLEAN_FLAGS.includes(a));

  const { positional, flags } = parseArgs(cleanArgs);
  const [type, ...rest] = positional;
  if (!type) {
    throw new Error('Usage: c8ctl model append <type> [label] [sourceId] [--name <label>] [--freeze-cursor] [--boundary] [--id <id>]');
  }

  const nameFlag = typeof flags['name'] === 'string' ? flags['name'] : undefined;

  const state = readState();
  const { moddle, definitions } = await loadFile(state.file);

  if (isBoundary) {
    // Boundary event mode: type is the boundary event type; label from --name or positional
    const lastArg = rest[rest.length - 1];
    const hasExplicitHost = rest.length > 1 && !!getElementById(definitions, lastArg);
    const labelParts = hasExplicitHost ? rest.slice(0, -1) : rest;
    const label = nameFlag ?? labelParts.join(' ');
    if (!label) throw new Error('Usage: c8ctl model append --boundary <eventType> <label> [hostId] [--name <label>]');

    const hostId = hasExplicitHost ? lastArg : state.cursor;

    const boundaryEvent = addBoundaryEvent(moddle, definitions, type, label, hostId);
    if (customId !== undefined) {
      renameElementId(definitions, boundaryEvent, customId);
    }
    applyZeebeFlags(moddle, boundaryEvent, cleanArgs, definitions, logger);
    await saveFile(state.file, moddle, definitions);

    const finalId = customId ?? boundaryEvent.id;
    if (!freezeCursor) writeState({ ...state, cursor: finalId });
    const interruptingLabel = boundaryEvent.cancelActivity ? 'interrupting' : 'non-interrupting';
    const baseType = type.startsWith('non-interrupting-') ? type.slice('non-interrupting-'.length) : type;
    logger?.success(`Appended ${interruptingLabel} ${baseType} boundary event '${label}' (${finalId}) on ${hostId}`);
    logger?.info(freezeCursor ? `Cursor: ${state.cursor} (unchanged)` : `Cursor: ${finalId}`);
    return;
  }

  // Normal append: label required (positional or --name)
  if (rest.length === 0 && !nameFlag) {
    throw new Error('Usage: c8ctl model append <type> <label> [sourceId] [--id <id>]');
  }

  // Treat the last positional as sourceElementId only if it resolves to an existing element
  const lastArg = rest[rest.length - 1];
  const hasExplicitSource = rest.length > 1 && !!getElementById(definitions, lastArg);
  const labelParts = hasExplicitSource ? rest.slice(0, -1) : rest;
  const label = nameFlag ?? labelParts.join(' ');
  if (!label) throw new Error('Usage: c8ctl model append <type> <label> [sourceId] [--id <id>]');

  const sourceId = hasExplicitSource ? lastArg : state.cursor;
  if (!hasExplicitSource && !getElementById(definitions, sourceId)) {
    throw new Error(`Source element '${sourceId}' not found`);
  }

  const eventRefOpts = parseEventRefFlags(flags);
  const newEl = addElement(moddle, definitions, type, label, sourceId, eventRefOpts);
  if (customId !== undefined) {
    renameElementId(definitions, newEl, customId);
  }
  applyZeebeFlags(moddle, newEl, cleanArgs, definitions, logger);
  await saveFile(state.file, moddle, definitions);

  const finalId = customId ?? newEl.id;
  if (!freezeCursor) writeState({ ...state, cursor: finalId });
  logger?.success(`Appended ${newEl.$type} '${label}' (${finalId})`);
  logger?.info(freezeCursor ? `Cursor: ${state.cursor} (unchanged)` : `Cursor: ${finalId}`);
}
