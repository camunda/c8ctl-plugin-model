import { loadFile, getElementById } from '../bpmn.js';
import { readState } from '../state.js';
import type { CommandLogger } from '../logger.js';

const DEF_TYPE_TO_TRIGGER: Record<string, string> = {
  'bpmn:TimerEventDefinition': 'timer',
  'bpmn:MessageEventDefinition': 'message',
  'bpmn:SignalEventDefinition': 'signal',
  'bpmn:ConditionalEventDefinition': 'conditional',
  'bpmn:LinkEventDefinition': 'link',
  'bpmn:EscalationEventDefinition': 'escalation',
  'bpmn:CompensateEventDefinition': 'compensation',
  'bpmn:ErrorEventDefinition': 'error',
  'bpmn:TerminateEventDefinition': 'terminate',
  'bpmn:CancelEventDefinition': 'cancel',
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildEventDefinition(el: any): Record<string, unknown> | undefined {
  const defs = el.eventDefinitions ?? [];
  if (defs.length === 0) return undefined;
  const def = defs[0];
  const type = DEF_TYPE_TO_TRIGGER[def.$type as string] ?? def.$type;
  const result: Record<string, unknown> = { type };

  if (def.signalRef) {
    result['signalRef'] = def.signalRef.name ?? def.signalRef.id ?? def.signalRef;
  }
  if (def.messageRef) {
    result['messageRef'] = def.messageRef.name ?? def.messageRef.id ?? def.messageRef;
  }
  if (def.condition?.body) {
    result['condition'] = def.condition.body;
  }
  if (def.timeCycle?.body) {
    result['timerCycle'] = def.timeCycle.body;
  }
  if (def.timeDuration?.body) {
    result['timerDuration'] = def.timeDuration.body;
  }
  if (def.timeDate?.body) {
    result['timerDate'] = def.timeDate.body;
  }

  return result;
}

export async function cursorStatus(_args: string[], cwd: string, logger?: CommandLogger): Promise<void> {
  const state = readState();
  const { definitions } = await loadFile(state.file);
  const el = getElementById(definitions, state.cursor);

  const type = el ? (el.$type as string).replace('bpmn:', '') : 'unknown';
  const name = el?.name ?? '';

  const result: Record<string, unknown> = { cursor: state.cursor, type, name, file: state.file };
  if (el) {
    const eventDefinition = buildEventDefinition(el);
    if (eventDefinition) result['eventDefinition'] = eventDefinition;
  }

  logger?.json(result);
}
