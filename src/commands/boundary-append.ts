import { addBoundaryEvent, loadFile, saveFile } from '../bpmn.js';
import { readState, writeState } from '../state.js';
import type { CommandLogger } from '../logger.js';

const ELEMENT_ID_PATTERN = /^[A-Za-z]+_\d+$/;

export async function boundaryAppend(args: string[], cwd: string, logger?: CommandLogger): Promise<void> {
  const [eventType, ...rest] = args;
  if (!eventType || rest.length === 0) {
    throw new Error(
      'Usage: c8ctl model boundary-append <eventType> <label> [hostElementId]\n' +
        'Event types: timer, error, message, signal, escalation, compensation, conditional, cancel\n' +
        'Prefix with non-interrupting- for non-interrupting variants where applicable',
    );
  }

  const lastArg = rest[rest.length - 1];
  const hasExplicitHost = ELEMENT_ID_PATTERN.test(lastArg);

  const labelParts = hasExplicitHost ? rest.slice(0, -1) : rest;
  const label = labelParts.join(' ');
  if (!label) throw new Error('Usage: c8ctl model boundary-append <eventType> <label> [hostElementId]');

  const state = readState(cwd);
  const hostId = hasExplicitHost ? lastArg : state.cursor;

  const { moddle, definitions } = await loadFile(state.file);
  const boundaryEvent = addBoundaryEvent(moddle, definitions, eventType, label, hostId);
  await saveFile(state.file, moddle, definitions);

  writeState(cwd, { ...state, cursor: boundaryEvent.id });

  const interruptingLabel = boundaryEvent.cancelActivity ? 'interrupting' : 'non-interrupting';
  const baseType = eventType.startsWith('non-interrupting-') ? eventType.slice('non-interrupting-'.length) : eventType;
  logger?.success(`Appended ${interruptingLabel} ${baseType} boundary event '${label}' (${boundaryEvent.id}) on ${hostId}`);
  logger?.info(`Cursor: ${boundaryEvent.id}`);
}
