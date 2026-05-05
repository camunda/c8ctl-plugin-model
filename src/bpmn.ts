import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { BpmnModdle } from 'bpmn-moddle';
import { recomputeLayout } from './layout.js';

const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const zeebeDescriptor: any = require('zeebe-bpmn-moddle/resources/zeebe');

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ModdleElement = any;

export function createModdle(): BpmnModdle {
  return new BpmnModdle({ zeebe: zeebeDescriptor });
}

export async function loadFile(filePath: string): Promise<{ moddle: BpmnModdle; definitions: ModdleElement }> {
  const xml = readFileSync(filePath, 'utf-8');
  const moddle = createModdle();
  const { rootElement: definitions } = await moddle.fromXML(xml);
  return { moddle, definitions };
}

export async function saveFile(filePath: string, moddle: BpmnModdle, definitions: ModdleElement): Promise<void> {
  recomputeLayout(moddle, definitions);
  const { xml } = await moddle.toXML(definitions, { format: true });
  writeFileSync(filePath, xml);
}

export function createMinimalBpmn(moddle: BpmnModdle, processName: string): ModdleElement {
  const startEvent = moddle.create('bpmn:StartEvent', { id: 'StartEvent_1', name: 'Start' });

  const process = moddle.create('bpmn:Process', {
    id: processName,
    name: processName,
    isExecutable: true,
    flowElements: [startEvent],
  });

  // DI
  const startShape = moddle.create('bpmndi:BPMNShape', {
    id: 'StartEvent_1_di',
    bpmnElement: startEvent,
    bounds: moddle.create('dc:Bounds', { x: 132, y: 232, width: 36, height: 36 }),
  });

  const plane = moddle.create('bpmndi:BPMNPlane', {
    id: 'BPMNPlane_1',
    bpmnElement: process,
    planeElement: [startShape],
  });

  const diagram = moddle.create('bpmndi:BPMNDiagram', {
    id: 'BPMNDiagram_1',
    plane,
  });

  const definitions = moddle.create('bpmn:Definitions', {
    id: 'Definitions_1',
    targetNamespace: 'http://bpmn.io/schema/bpmn',
    rootElements: [process],
    diagrams: [diagram],
  });

  return definitions;
}

export function getProcess(definitions: ModdleElement): ModdleElement {
  const process = definitions.rootElements?.find((e: ModdleElement) => e.$type === 'bpmn:Process');
  if (!process) throw new Error('No process found in BPMN file');
  return process;
}

export function getElementById(definitions: ModdleElement, id: string): ModdleElement | undefined {
  const process = getProcess(definitions);
  return (process.flowElements ?? []).find((e: ModdleElement) => e.id === id);
}

function normalizeBpmnType(type: string): string {
  const camel = type.replace(/-([a-z])/g, (_: string, c: string) => c.toUpperCase());
  const capitalized = camel.charAt(0).toUpperCase() + camel.slice(1);
  return `bpmn:${capitalized}`;
}

const TYPED_EVENT_GROUPS: Array<{ suffix: string; bpmnType: string; defs: Record<string, string> }> = [
  {
    suffix: '-intermediate-catch-event',
    bpmnType: 'bpmn:IntermediateCatchEvent',
    defs: {
      timer: 'bpmn:TimerEventDefinition',
      message: 'bpmn:MessageEventDefinition',
      signal: 'bpmn:SignalEventDefinition',
      conditional: 'bpmn:ConditionalEventDefinition',
      link: 'bpmn:LinkEventDefinition',
    },
  },
  {
    suffix: '-intermediate-throw-event',
    bpmnType: 'bpmn:IntermediateThrowEvent',
    defs: {
      message: 'bpmn:MessageEventDefinition',
      signal: 'bpmn:SignalEventDefinition',
      escalation: 'bpmn:EscalationEventDefinition',
      compensation: 'bpmn:CompensateEventDefinition',
      link: 'bpmn:LinkEventDefinition',
    },
  },
  {
    suffix: '-end-event',
    bpmnType: 'bpmn:EndEvent',
    defs: {
      message: 'bpmn:MessageEventDefinition',
      signal: 'bpmn:SignalEventDefinition',
      error: 'bpmn:ErrorEventDefinition',
      escalation: 'bpmn:EscalationEventDefinition',
      terminate: 'bpmn:TerminateEventDefinition',
      compensation: 'bpmn:CompensateEventDefinition',
      cancel: 'bpmn:CancelEventDefinition',
    },
  },
];

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

function parseElementType(type: string): { bpmnType: string; defType?: string } {
  for (const { suffix, bpmnType, defs } of TYPED_EVENT_GROUPS) {
    if (type.endsWith(suffix)) {
      const trigger = type.slice(0, -suffix.length);
      if (trigger === '') return { bpmnType };
      const defType = defs[trigger];
      if (!defType) {
        const valid = Object.keys(defs).map((k) => `'${k}${suffix}'`).join(', ');
        throw new Error(`Unknown typed event '${type}'. Supported: ${valid}`);
      }
      return { bpmnType, defType };
    }
  }
  return { bpmnType: normalizeBpmnType(type) };
}

function nextId(process: ModdleElement, prefix: string): string {
  let max = 0;
  for (const el of process.flowElements ?? []) {
    const m = (el.id as string)?.match(new RegExp(`^${prefix}_(\\d+)$`));
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `${prefix}_${max + 1}`;
}

function nextEventDefId(process: ModdleElement): string {
  let max = 0;
  for (const el of process.flowElements ?? []) {
    for (const def of (el.eventDefinitions ?? []) as ModdleElement[]) {
      const m = (def.id as string)?.match(/^EventDefinition_(\d+)$/);
      if (m) max = Math.max(max, parseInt(m[1], 10));
    }
  }
  return `EventDefinition_${max + 1}`;
}

function idPrefix(bpmnType: string): string {
  const local = bpmnType.replace('bpmn:', '');
  if (local.endsWith('Gateway')) return 'Gateway';
  if (local.endsWith('Event')) return local.includes('Start') ? 'StartEvent' : local.includes('End') ? 'EndEvent' : 'Event';
  return 'Activity';
}

export function addElement(
  moddle: BpmnModdle,
  definitions: ModdleElement,
  type: string,
  name: string,
  sourceId: string,
): ModdleElement {
  const { bpmnType, defType } = parseElementType(type);
  const process = getProcess(definitions);

  const prefix = idPrefix(bpmnType);
  const newId = nextId(process, prefix);
  const elProps: Record<string, unknown> = { id: newId, name };
  if (defType) {
    elProps.eventDefinitions = [moddle.create(defType, { id: nextEventDefId(process) })];
  }
  const newEl = moddle.create(bpmnType, elProps);

  const source = getElementById(definitions, sourceId);
  if (!source) throw new Error(`Source element '${sourceId}' not found`);

  const flowId = nextId(process, 'Flow');
  const flow = moddle.create('bpmn:SequenceFlow', {
    id: flowId,
    sourceRef: source,
    targetRef: newEl,
  });

  source.outgoing = [...(source.outgoing ?? []), flow];
  newEl.incoming = [flow];
  newEl.outgoing = [];

  process.flowElements = [...(process.flowElements ?? []), newEl, flow];

  // Add DI for new element
  const diagram = definitions.diagrams?.[0];
  const plane = diagram?.plane;
  if (plane) {
    const shape = moddle.create('bpmndi:BPMNShape', {
      id: `${newId}_di`,
      bpmnElement: newEl,
      bounds: moddle.create('dc:Bounds', { x: 0, y: 0, width: 100, height: 80 }),
    });
    const edge = moddle.create('bpmndi:BPMNEdge', {
      id: `${flowId}_di`,
      bpmnElement: flow,
      waypoint: [],
    });
    plane.planeElement = [...(plane.planeElement ?? []), shape, edge];
  }

  return newEl;
}

const BOUNDARY_EVENT_DEF_TYPES: Record<string, string> = {
  timer: 'bpmn:TimerEventDefinition',
  error: 'bpmn:ErrorEventDefinition',
  message: 'bpmn:MessageEventDefinition',
  signal: 'bpmn:SignalEventDefinition',
  escalation: 'bpmn:EscalationEventDefinition',
  compensation: 'bpmn:CompensateEventDefinition',
  conditional: 'bpmn:ConditionalEventDefinition',
  cancel: 'bpmn:CancelEventDefinition',
};

const ALWAYS_INTERRUPTING = new Set(['error', 'cancel']);
const ALWAYS_NON_INTERRUPTING = new Set(['compensation']);

const VALID_HOST_TYPES = new Set([
  'bpmn:Task', 'bpmn:UserTask', 'bpmn:ServiceTask', 'bpmn:ScriptTask',
  'bpmn:SendTask', 'bpmn:ReceiveTask', 'bpmn:ManualTask', 'bpmn:BusinessRuleTask',
  'bpmn:SubProcess', 'bpmn:CallActivity', 'bpmn:AdHocSubProcess',
]);

function parseBoundaryEventType(eventType: string): { defType: string; cancelActivity: boolean } {
  const isNonInterrupting = eventType.startsWith('non-interrupting-');
  const base = isNonInterrupting ? eventType.slice('non-interrupting-'.length) : eventType;

  const defType = BOUNDARY_EVENT_DEF_TYPES[base];
  if (!defType) {
    throw new Error(
      `Unknown boundary event type '${base}'. Supported: ${Object.keys(BOUNDARY_EVENT_DEF_TYPES).join(', ')}`,
    );
  }
  if (isNonInterrupting && ALWAYS_INTERRUPTING.has(base)) {
    throw new Error(`'${base}' boundary events are always interrupting`);
  }
  if (!isNonInterrupting && ALWAYS_NON_INTERRUPTING.has(base)) {
    throw new Error(`'${base}' boundary events are always non-interrupting — use 'non-interrupting-${base}'`);
  }

  const cancelActivity = ALWAYS_NON_INTERRUPTING.has(base) ? false : !isNonInterrupting;
  return { defType, cancelActivity };
}

export function addBoundaryEvent(
  moddle: BpmnModdle,
  definitions: ModdleElement,
  eventType: string,
  name: string,
  hostId: string,
): ModdleElement {
  const process = getProcess(definitions);
  const host = getElementById(definitions, hostId);
  if (!host) throw new Error(`Host element '${hostId}' not found`);
  if (!VALID_HOST_TYPES.has(host.$type as string)) {
    throw new Error(
      `'${hostId}' is ${host.$type} — boundary events can only be attached to activities`,
    );
  }

  const { defType, cancelActivity } = parseBoundaryEventType(eventType);

  const eventDef = moddle.create(defType, { id: nextEventDefId(process) });

  const boundaryId = nextId(process, 'BoundaryEvent');
  const boundaryEvent = moddle.create('bpmn:BoundaryEvent', {
    id: boundaryId,
    name,
    attachedToRef: host,
    cancelActivity,
    eventDefinitions: [eventDef],
    outgoing: [],
  });

  process.flowElements = [...(process.flowElements ?? []), boundaryEvent];

  const diagram = definitions.diagrams?.[0];
  const plane = diagram?.plane;
  if (plane) {
    const shape = moddle.create('bpmndi:BPMNShape', {
      id: `${boundaryId}_di`,
      bpmnElement: boundaryEvent,
      bounds: moddle.create('dc:Bounds', { x: 0, y: 0, width: 36, height: 36 }),
    });
    plane.planeElement = [...(plane.planeElement ?? []), shape];
  }

  return boundaryEvent;
}

function getOrCreateExtensionElements(moddle: BpmnModdle, el: ModdleElement): ModdleElement {
  if (!el.extensionElements) {
    el.extensionElements = moddle.create('bpmn:ExtensionElements', { values: [] });
  }
  return el.extensionElements;
}

function getOrCreateZeebeChild(moddle: BpmnModdle, el: ModdleElement, zeebeType: string): ModdleElement {
  const ext = getOrCreateExtensionElements(moddle, el);
  let child = (ext.values ?? []).find((v: ModdleElement) => v.$type === zeebeType);
  if (!child) {
    child = moddle.create(zeebeType, {});
    ext.values = [...(ext.values ?? []), child];
  }
  return child;
}

export function updateElementProperty(
  moddle: BpmnModdle,
  el: ModdleElement,
  prop: string,
  values: string[],
): void {
  if (prop === 'name') {
    el.name = values[0];
    return;
  }

  if (prop === 'zeebe:taskDefinition.type') {
    const td = getOrCreateZeebeChild(moddle, el, 'zeebe:TaskDefinition');
    td.type = values[0];
    return;
  }

  if (prop === 'zeebe:taskDefinition.retries') {
    const td = getOrCreateZeebeChild(moddle, el, 'zeebe:TaskDefinition');
    td.retries = values[0];
    return;
  }

  if (prop === 'zeebe:input') {
    const [source, target] = values;
    const ioMapping = getOrCreateZeebeChild(moddle, el, 'zeebe:IoMapping');
    const inputs: ModdleElement[] = ioMapping.inputParameters ?? [];
    const existing = inputs.find((i: ModdleElement) => i.target === target);
    if (existing) {
      existing.source = source;
    } else {
      const input = moddle.create('zeebe:Input', { source, target });
      ioMapping.inputParameters = [...inputs, input];
    }
    return;
  }

  if (prop === 'zeebe:output') {
    const [source, target] = values;
    const ioMapping = getOrCreateZeebeChild(moddle, el, 'zeebe:IoMapping');
    const outputs: ModdleElement[] = ioMapping.outputParameters ?? [];
    const existing = outputs.find((o: ModdleElement) => o.source === source);
    if (existing) {
      existing.target = target;
    } else {
      const output = moddle.create('zeebe:Output', { source, target });
      ioMapping.outputParameters = [...outputs, output];
    }
    return;
  }

  if (prop === 'zeebe:header') {
    const [key, value] = values;
    const headers = getOrCreateZeebeChild(moddle, el, 'zeebe:TaskHeaders');
    const existing = (headers.values ?? []).find((h: ModdleElement) => h.key === key);
    if (existing) {
      existing.value = value;
    } else {
      const header = moddle.create('zeebe:Header', { key, value });
      headers.values = [...(headers.values ?? []), header];
    }
    return;
  }

  if (prop === 'zeebe:property') {
    const [name, value] = values;
    const props = getOrCreateZeebeChild(moddle, el, 'zeebe:Properties');
    const existing = (props.properties ?? []).find((p: ModdleElement) => p.name === name);
    if (existing) {
      existing.value = value;
    } else {
      const property = moddle.create('zeebe:Property', { name, value });
      props.properties = [...(props.properties ?? []), property];
    }
    return;
  }

  throw new Error(`Unknown property '${prop}'. Supported: name, zeebe:taskDefinition.type, zeebe:taskDefinition.retries, zeebe:input, zeebe:output, zeebe:header, zeebe:property`);
}

function extractZeebe(el: ModdleElement): Record<string, unknown> | undefined {
  const values: ModdleElement[] = el.extensionElements?.values ?? [];
  if (values.length === 0) return undefined;

  const result: Record<string, unknown> = {};

  for (const v of values) {
    const type: string = v.$type ?? '';
    if (type === 'zeebe:TaskDefinition') {
      result['taskDefinition'] = { type: v.type, retries: v.retries };
    } else if (type === 'zeebe:IoMapping') {
      result['ioMapping'] = {
        inputs: (v.inputParameters ?? []).map((i: ModdleElement) => ({ source: i.source, target: i.target })),
        outputs: (v.outputParameters ?? []).map((o: ModdleElement) => ({ source: o.source, target: o.target })),
      };
    } else if (type === 'zeebe:TaskHeaders') {
      result['taskHeaders'] = (v.values ?? []).map((h: ModdleElement) => ({ key: h.key, value: h.value }));
    } else if (type === 'zeebe:Properties') {
      result['properties'] = (v.properties ?? []).map((p: ModdleElement) => ({ name: p.name, value: p.value }));
    }
  }

  return Object.keys(result).length > 0 ? result : undefined;
}

export function toStatusJson(definitions: ModdleElement, cursor: string): Record<string, unknown> {
  const process = getProcess(definitions);
  const flowElements: ModdleElement[] = process.flowElements ?? [];

  const elements = flowElements
    .filter((e: ModdleElement) => e.$type !== 'bpmn:SequenceFlow')
    .map((e: ModdleElement) => {
      const local = (e.$type as string).replace('bpmn:', '');
      const type = local.charAt(0).toLowerCase() + local.slice(1);
      const defs: ModdleElement[] = e.eventDefinitions ?? [];
      const eventDefinition = defs.length > 0 ? (DEF_TYPE_TO_TRIGGER[defs[0].$type as string] ?? defs[0].$type) : undefined;
      const entry: Record<string, unknown> = {
        id: e.id,
        type,
        name: e.name,
        ...(eventDefinition ? { eventDefinition } : {}),
        ...(e.attachedToRef
          ? {
              attachedToRef: e.attachedToRef?.id ?? e.attachedToRef,
              cancelActivity: e.cancelActivity,
              outgoing: (e.outgoing ?? []).map((f: ModdleElement) => f.id),
            }
          : {
              incoming: (e.incoming ?? []).map((f: ModdleElement) => f.id),
              outgoing: (e.outgoing ?? []).map((f: ModdleElement) => f.id),
            }),
      };
      const zeebe = extractZeebe(e);
      if (zeebe) entry['zeebe'] = zeebe;
      return entry;
    });

  const flows = flowElements
    .filter((e: ModdleElement) => e.$type === 'bpmn:SequenceFlow')
    .map((e: ModdleElement) => ({
      id: e.id,
      source: e.sourceRef?.id ?? e.sourceRef,
      target: e.targetRef?.id ?? e.targetRef,
      ...(e.conditionExpression ? { condition: e.conditionExpression.body } : {}),
    }));

  return {
    cursor,
    process: {
      id: process.id,
      name: process.name,
      elements,
      flows,
    },
  };
}
