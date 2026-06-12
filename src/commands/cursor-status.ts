import { loadFile, getElementById, toEventDefinitionJson } from '../bpmn.js';
import { readState } from '../state.js';
import type { CommandLogger } from '../logger.js';

export async function cursorStatus(_args: string[], cwd: string, logger?: CommandLogger): Promise<void> {
  const state = readState();
  const { definitions } = await loadFile(state.file);
  const el = getElementById(definitions, state.cursor);

  const type = el ? (el.$type as string).replace('bpmn:', '') : 'unknown';
  const name = el?.name ?? '';

  const result: Record<string, unknown> = { cursor: state.cursor, type, name, file: state.file };
  if (el) {
    const eventDefinition = toEventDefinitionJson(el.eventDefinitions ?? []);
    if (eventDefinition) result['eventDefinition'] = eventDefinition;
  }

  logger?.json(result);
}
