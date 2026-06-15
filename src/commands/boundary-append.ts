import { addBoundaryEvent, loadFile, saveFile, getElementById, renameElementId } from '../bpmn.js';
import { readState, writeState } from '../state.js';
import type { CommandLogger } from '../logger.js';
import { extractIdFlag } from './args.js';

export async function boundaryAppend(args: string[], cwd: string, logger?: CommandLogger): Promise<void> {
  const { id: customId, remaining: argsWithoutId } = extractIdFlag(args);
  const [eventType, ...rest] = argsWithoutId;
  if (!eventType || rest.length === 0) {
    throw new Error(
      'Usage: c8ctl model boundary-append <eventType> <label> [hostElementId] [--id <id>]\n' +
        'Event types: timer, error, message, signal, escalation, compensation, conditional, cancel\n' +
        'Prefix with non-interrupting- for non-interrupting variants where applicable',
    );
  }

  const state = readState();
  const { moddle, definitions } = await loadFile(state.file);

  // Treat the last arg as an explicit hostElementId only if it actually resolves
  // to an existing element — avoids mis-parsing single-word labels like "Timeout".
  const lastArg = rest[rest.length - 1];
  const hasExplicitHost = rest.length > 1 && !!getElementById(definitions, lastArg);

  const labelParts = hasExplicitHost ? rest.slice(0, -1) : rest;
  const label = labelParts.join(' ');
  if (!label) throw new Error('Usage: c8ctl model boundary-append <eventType> <label> [hostElementId] [--id <id>]');

  const hostId = hasExplicitHost ? lastArg : state.cursor;

  const boundaryEvent = addBoundaryEvent(moddle, definitions, eventType, label, hostId);
  if (customId !== undefined) {
    renameElementId(definitions, boundaryEvent, customId);
  }
  await saveFile(state.file, moddle, definitions);

  const finalId = customId ?? boundaryEvent.id;
  writeState({ ...state, cursor: finalId });

  const interruptingLabel = boundaryEvent.cancelActivity ? 'interrupting' : 'non-interrupting';
  const baseType = eventType.startsWith('non-interrupting-') ? eventType.slice('non-interrupting-'.length) : eventType;
  logger?.success(`Appended ${interruptingLabel} ${baseType} boundary event '${label}' (${finalId}) on ${hostId}`);
  logger?.info(`Cursor: ${finalId}`);
}
