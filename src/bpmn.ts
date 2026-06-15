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

function isSubProcessLike(el: ModdleElement): boolean {
  return el.$type === 'bpmn:SubProcess' || el.$type === 'bpmn:AdHocSubProcess';
}

function collectAllFlowElements(container: ModdleElement): ModdleElement[] {
  const result: ModdleElement[] = [];
  for (const el of container.flowElements ?? []) {
    result.push(el);
    if (isSubProcessLike(el)) result.push(...collectAllFlowElements(el));
  }
  return result;
}

function findInContainer(container: ModdleElement, id: string): ModdleElement | undefined {
  for (const el of container.flowElements ?? []) {
    if (el.id === id) return el;
    if (isSubProcessLike(el)) {
      const found = findInContainer(el, id);
      if (found) return found;
    }
  }
  return undefined;
}

function findContainerOfHelper(container: ModdleElement, id: string): ModdleElement | undefined {
  for (const el of container.flowElements ?? []) {
    if (el.id === id) return container;
    if (isSubProcessLike(el)) {
      const found = findContainerOfHelper(el, id);
      if (found) return found;
    }
  }
  return undefined;
}

export function getElementById(definitions: ModdleElement, id: string): ModdleElement | undefined {
  const process = getProcess(definitions);
  return findInContainer(process, id);
}

export function findContainerOf(definitions: ModdleElement, id: string): ModdleElement | undefined {
  const process = getProcess(definitions);
  return findContainerOfHelper(process, id);
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
  {
    suffix: '-start-event',
    bpmnType: 'bpmn:StartEvent',
    defs: {
      timer: 'bpmn:TimerEventDefinition',
      message: 'bpmn:MessageEventDefinition',
      signal: 'bpmn:SignalEventDefinition',
      error: 'bpmn:ErrorEventDefinition',
      escalation: 'bpmn:EscalationEventDefinition',
      compensation: 'bpmn:CompensateEventDefinition',
      conditional: 'bpmn:ConditionalEventDefinition',
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

function parseElementType(type: string): { bpmnType: string; defType?: string; extraProps?: Record<string, unknown> } {
  if (type === 'event-sub-process') {
    return { bpmnType: 'bpmn:SubProcess', extraProps: { triggeredByEvent: true } };
  }
  if (type === 'intermediate-catch-event') {
    throw new Error(
      `'intermediate-catch-event' is not supported — use a typed variant: ` +
      `timer-intermediate-catch-event, message-intermediate-catch-event, ` +
      `signal-intermediate-catch-event, conditional-intermediate-catch-event, ` +
      `link-intermediate-catch-event`,
    );
  }
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
  const pattern = new RegExp(`^${prefix}_(\\d+)$`);
  for (const el of collectAllFlowElements(process)) {
    const m = (el.id as string)?.match(pattern);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  for (const art of (process.artifacts ?? []) as ModdleElement[]) {
    const m = (art.id as string)?.match(pattern);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `${prefix}_${max + 1}`;
}

function nextEventDefId(process: ModdleElement): string {
  let max = 0;
  for (const el of collectAllFlowElements(process)) {
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

function addZeebeUserTaskMarker(moddle: BpmnModdle, el: ModdleElement): void {
  const ext = getOrCreateExtensionElements(moddle, el);
  const existing = (ext.values ?? []).find((v: ModdleElement) => v.$type === 'zeebe:UserTask');
  if (!existing) {
    ext.values = [...(ext.values ?? []), moddle.create('zeebe:UserTask', {})];
  }
}

/** Sanitize a user-provided name into a valid XML NCName for use as an id attribute. */
function sanitizeId(name: string): string {
  return name.replace(/[^a-zA-Z0-9_.-]/g, '_').replace(/^([^a-zA-Z_])/, '_$1');
}

function uniqueRootId(definitions: ModdleElement, base: string): string {
  const existing = new Set((definitions.rootElements ?? []).map((e: ModdleElement) => e.id as string));
  if (!existing.has(base)) return base;
  let i = 1;
  while (existing.has(`${base}_${i}`)) i++;
  return `${base}_${i}`;
}

function getOrDeclareSignal(moddle: BpmnModdle, definitions: ModdleElement, signalName: string): ModdleElement {
  const existing = (definitions.rootElements ?? []).find(
    (e: ModdleElement) => e.$type === 'bpmn:Signal' && e.name === signalName,
  );
  if (existing) return existing;
  const id = uniqueRootId(definitions, `Signal_${sanitizeId(signalName)}`);
  const signal = moddle.create('bpmn:Signal', { id, name: signalName });
  definitions.rootElements = [...(definitions.rootElements ?? []), signal];
  return signal;
}

function getOrDeclareMessage(moddle: BpmnModdle, definitions: ModdleElement, messageName: string): ModdleElement {
  const existing = (definitions.rootElements ?? []).find(
    (e: ModdleElement) => e.$type === 'bpmn:Message' && e.name === messageName,
  );
  if (existing) return existing;
  const id = uniqueRootId(definitions, `Message_${sanitizeId(messageName)}`);
  const message = moddle.create('bpmn:Message', { id, name: messageName });
  definitions.rootElements = [...(definitions.rootElements ?? []), message];
  return message;
}

export interface EventRefOptions {
  signalName?: string;
  messageName?: string;
}

function applyEventRef(
  moddle: BpmnModdle,
  definitions: ModdleElement,
  el: ModdleElement,
  opts: EventRefOptions,
): void {
  const defs: ModdleElement[] = el.eventDefinitions ?? [];
  if (defs.length === 0) {
    if (opts.signalName) throw new Error(`--signal-name requires a signal event definition, but element '${el.id}' has none`);
    if (opts.messageName) throw new Error(`--message-name requires a message event definition, but element '${el.id}' has none`);
    return;
  }
  const eventDef = defs[0];
  if (opts.signalName) {
    if (eventDef.$type !== 'bpmn:SignalEventDefinition') {
      throw new Error(`--signal-name can only be used with signal events, but element '${el.id}' has ${eventDef.$type}`);
    }
    const signal = getOrDeclareSignal(moddle, definitions, opts.signalName);
    eventDef.signalRef = signal;
  }
  if (opts.messageName) {
    if (eventDef.$type !== 'bpmn:MessageEventDefinition') {
      throw new Error(`--message-name can only be used with message events, but element '${el.id}' has ${eventDef.$type}`);
    }
    const message = getOrDeclareMessage(moddle, definitions, opts.messageName);
    eventDef.messageRef = message;
  }
}

export function addElement(
  moddle: BpmnModdle,
  definitions: ModdleElement,
  type: string,
  name: string,
  sourceId: string,
  eventRefOpts?: EventRefOptions,
): ModdleElement {
  const { bpmnType, defType, extraProps } = parseElementType(type);
  const process = getProcess(definitions);

  const prefix = idPrefix(bpmnType);
  const newId = nextId(process, prefix);
  const elProps: Record<string, unknown> = { id: newId, name, ...extraProps };
  if (defType) {
    elProps.eventDefinitions = [moddle.create(defType, { id: nextEventDefId(process) })];
  }
  const newEl = moddle.create(bpmnType, elProps);
  if (bpmnType === 'bpmn:UserTask') addZeebeUserTaskMarker(moddle, newEl);
  if (eventRefOpts) applyEventRef(moddle, definitions, newEl, eventRefOpts);

  const source = getElementById(definitions, sourceId);
  if (!source) throw new Error(`Source element '${sourceId}' not found`);

  const container = findContainerOfHelper(process, sourceId) ?? process;

  const flowId = nextId(process, 'Flow');
  const flow = moddle.create('bpmn:SequenceFlow', {
    id: flowId,
    sourceRef: source,
    targetRef: newEl,
  });

  source.outgoing = [...(source.outgoing ?? []), flow];
  newEl.incoming = [flow];
  newEl.outgoing = [];

  container.flowElements = [...(container.flowElements ?? []), newEl, flow];

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

export function addChildElement(
  moddle: BpmnModdle,
  definitions: ModdleElement,
  parentId: string,
  type: string,
  name: string,
  eventRefOpts?: EventRefOptions,
): ModdleElement {
  const process = getProcess(definitions);
  const parent = getElementById(definitions, parentId);
  if (!parent) throw new Error(`Parent element '${parentId}' not found`);

  const { bpmnType, defType, extraProps } = parseElementType(type);
  const prefix = idPrefix(bpmnType);
  const newId = nextId(process, prefix);
  const elProps: Record<string, unknown> = { id: newId, name, incoming: [], outgoing: [], ...extraProps };
  if (defType) {
    elProps.eventDefinitions = [moddle.create(defType, { id: nextEventDefId(process) })];
  }
  const newEl = moddle.create(bpmnType, elProps);
  if (bpmnType === 'bpmn:UserTask') addZeebeUserTaskMarker(moddle, newEl);
  if (eventRefOpts) applyEventRef(moddle, definitions, newEl, eventRefOpts);

  parent.flowElements = [...(parent.flowElements ?? []), newEl];

  const diagram = definitions.diagrams?.[0];
  const plane = diagram?.plane;
  if (plane) {
    const shape = moddle.create('bpmndi:BPMNShape', {
      id: `${newId}_di`,
      bpmnElement: newEl,
      bounds: moddle.create('dc:Bounds', { x: 0, y: 0, width: 100, height: 80 }),
    });
    plane.planeElement = [...(plane.planeElement ?? []), shape];
  }

  return newEl;
}

export function createElement(
  moddle: BpmnModdle,
  definitions: ModdleElement,
  type: string,
  name: string,
  eventRefOpts?: EventRefOptions,
): ModdleElement {
  const process = getProcess(definitions);
  const { bpmnType, defType, extraProps } = parseElementType(type);
  const prefix = idPrefix(bpmnType);
  const newId = nextId(process, prefix);
  const elProps: Record<string, unknown> = { id: newId, name, incoming: [], outgoing: [], ...extraProps };
  if (defType) {
    elProps.eventDefinitions = [moddle.create(defType, { id: nextEventDefId(process) })];
  }
  const newEl = moddle.create(bpmnType, elProps);
  if (bpmnType === 'bpmn:UserTask') addZeebeUserTaskMarker(moddle, newEl);
  if (eventRefOpts) applyEventRef(moddle, definitions, newEl, eventRefOpts);

  process.flowElements = [...(process.flowElements ?? []), newEl];

  const diagram = definitions.diagrams?.[0];
  const plane = diagram?.plane;
  if (plane) {
    const shape = moddle.create('bpmndi:BPMNShape', {
      id: `${newId}_di`,
      bpmnElement: newEl,
      bounds: moddle.create('dc:Bounds', { x: 0, y: 0, width: 100, height: 80 }),
    });
    plane.planeElement = [...(plane.planeElement ?? []), shape];
  }

  return newEl;
}

export function connectElements(
  moddle: BpmnModdle,
  definitions: ModdleElement,
  sourceId: string,
  targetId: string,
  conditionExpression?: string,
): ModdleElement {
  const process = getProcess(definitions);
  const source = getElementById(definitions, sourceId);
  if (!source) throw new Error(`Source element '${sourceId}' not found`);
  const target = getElementById(definitions, targetId);
  if (!target) throw new Error(`Target element '${targetId}' not found`);

  const sourceContainer = findContainerOfHelper(process, sourceId) ?? process;
  const targetContainer = findContainerOfHelper(process, targetId) ?? process;
  if (sourceContainer !== targetContainer) {
    throw new Error(`'${sourceId}' and '${targetId}' are in different scopes and cannot be connected`);
  }

  const flowId = nextId(process, 'Flow');
  const flowProps: Record<string, unknown> = { id: flowId, sourceRef: source, targetRef: target };
  if (conditionExpression) {
    flowProps.conditionExpression = moddle.create('bpmn:FormalExpression', { body: conditionExpression });
  }
  const flow = moddle.create('bpmn:SequenceFlow', flowProps);

  source.outgoing = [...(source.outgoing ?? []), flow];
  target.incoming = [...(target.incoming ?? []), flow];

  sourceContainer.flowElements = [...(sourceContainer.flowElements ?? []), flow];

  const diagram = definitions.diagrams?.[0];
  const plane = diagram?.plane;
  if (plane) {
    const edge = moddle.create('bpmndi:BPMNEdge', {
      id: `${flowId}_di`,
      bpmnElement: flow,
      waypoint: [],
    });
    plane.planeElement = [...(plane.planeElement ?? []), edge];
  }

  return flow;
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

const ACTIVITY_TYPES = new Set([
  'bpmn:Task', 'bpmn:UserTask', 'bpmn:ServiceTask', 'bpmn:ScriptTask',
  'bpmn:SendTask', 'bpmn:ReceiveTask', 'bpmn:ManualTask', 'bpmn:BusinessRuleTask',
  'bpmn:SubProcess', 'bpmn:CallActivity', 'bpmn:AdHocSubProcess',
]);

const VALID_HOST_TYPES = ACTIVITY_TYPES;

const FORM_DEFINITION_EXCLUSIVE_KEYS = ['formId', 'formKey', 'externalReference'];

function assertActivity(el: ModdleElement, prop: string): void {
  if (!ACTIVITY_TYPES.has(el.$type as string)) {
    throw new Error(`'${prop}' can only be set on activities`);
  }
}

function assertStartEvent(el: ModdleElement, prop: string): void {
  if (el.$type !== 'bpmn:StartEvent') {
    throw new Error(`'${prop}' can only be set on start events`);
  }
}

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

export function addTextAnnotation(
  moddle: BpmnModdle,
  definitions: ModdleElement,
  text: string,
  elementId: string,
): ModdleElement {
  const process = getProcess(definitions);
  const target = getElementById(definitions, elementId);
  if (!target) throw new Error(`Element '${elementId}' not found`);

  const annotationId = nextId(process, 'TextAnnotation');
  const annotation = moddle.create('bpmn:TextAnnotation', {
    id: annotationId,
    text,
  });

  const associationId = nextId(process, 'Association');
  const association = moddle.create('bpmn:Association', {
    id: associationId,
    sourceRef: target,
    targetRef: annotation,
  });

  process.artifacts = [...(process.artifacts ?? []), annotation, association];

  const diagram = definitions.diagrams?.[0];
  const plane = diagram?.plane;
  if (plane) {
    const shape = moddle.create('bpmndi:BPMNShape', {
      id: `${annotationId}_di`,
      bpmnElement: annotation,
      bounds: moddle.create('dc:Bounds', { x: 0, y: 0, width: 100, height: 30 }),
    });
    const edge = moddle.create('bpmndi:BPMNEdge', {
      id: `${associationId}_di`,
      bpmnElement: association,
      waypoint: [],
    });
    plane.planeElement = [...(plane.planeElement ?? []), shape, edge];
  }

  return annotation;
}

export function setDocumentation(
  moddle: BpmnModdle,
  definitions: ModdleElement,
  text: string,
  elementId: string,
  textFormat?: string,
): void {
  const target = getElementById(definitions, elementId);
  if (!target) throw new Error(`Element '${elementId}' not found`);

  const existing: ModdleElement[] = target.documentation ?? [];
  if (existing.length > 0) {
    existing[0].text = text;
    // Explicitly set or clear textFormat so the result is idempotent
    if (textFormat !== undefined) {
      existing[0].textFormat = textFormat;
    } else {
      delete existing[0].textFormat;
    }
  } else {
    const props: Record<string, unknown> = { text };
    if (textFormat !== undefined) props['textFormat'] = textFormat;
    const docElement = moddle.create('bpmn:Documentation', props);
    target.documentation = [docElement];
  }
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
  definitions?: ModdleElement,
  logger?: { warn(message: string): void },
): void {
  if (prop === 'name') {
    el.name = values[0];
    return;
  }

  if (prop === 'signalRef') {
    const defs: ModdleElement[] = el.eventDefinitions ?? [];
    const sigDef = defs.find((d: ModdleElement) => d.$type === 'bpmn:SignalEventDefinition');
    if (!sigDef) throw new Error(`Element '${el.id}' does not have a signal event definition`);
    if (!definitions) throw new Error(`'signalRef' requires definitions context`);
    const signal = getOrDeclareSignal(moddle, definitions, values.join(' '));
    sigDef.signalRef = signal;
    return;
  }

  if (prop === 'messageRef') {
    const defs: ModdleElement[] = el.eventDefinitions ?? [];
    const msgDef = defs.find((d: ModdleElement) => d.$type === 'bpmn:MessageEventDefinition');
    if (!msgDef) throw new Error(`Element '${el.id}' does not have a message event definition`);
    if (!definitions) throw new Error(`'messageRef' requires definitions context`);
    const message = getOrDeclareMessage(moddle, definitions, values.join(' '));
    msgDef.messageRef = message;
    return;
  }

  if (prop === 'zeebe:taskDefinition.type') {
    assertActivity(el, prop);
    const td = getOrCreateZeebeChild(moddle, el, 'zeebe:TaskDefinition');
    td.type = values[0];
    return;
  }

  if (prop === 'zeebe:taskDefinition.retries') {
    assertActivity(el, prop);
    const td = getOrCreateZeebeChild(moddle, el, 'zeebe:TaskDefinition');
    td.retries = values[0];
    return;
  }

  if (prop === 'zeebe:input') {
    assertActivity(el, prop);
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
    assertActivity(el, prop);
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
    assertActivity(el, prop);
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

  if (prop === 'zeebe:calledDecision.decisionId') {
    if (el.$type !== 'bpmn:BusinessRuleTask') {
      throw new Error(`'zeebe:calledDecision.decisionId' can only be set on business-rule-task`);
    }
    const cd = getOrCreateZeebeChild(moddle, el, 'zeebe:CalledDecision');
    cd.decisionId = values[0];
    return;
  }

  if (prop === 'zeebe:calledDecision.resultVariable') {
    if (el.$type !== 'bpmn:BusinessRuleTask') {
      throw new Error(`'zeebe:calledDecision.resultVariable' can only be set on business-rule-task`);
    }
    const cd = getOrCreateZeebeChild(moddle, el, 'zeebe:CalledDecision');
    cd.resultVariable = values[0];
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

  if (prop === 'isInterrupting') {
    assertStartEvent(el, prop);
    el.isInterrupting = values[0] !== 'false';
    return;
  }

  if (prop === 'multi-instance.type') {
    assertActivity(el, prop);
    const type = values[0];
    if (type !== 'parallel' && type !== 'sequential') {
      throw new Error(`'multi-instance.type' must be 'parallel' or 'sequential'`);
    }
    const isSequential = type === 'sequential';
    if (!el.loopCharacteristics || el.loopCharacteristics.$type !== 'bpmn:MultiInstanceLoopCharacteristics') {
      el.loopCharacteristics = moddle.create('bpmn:MultiInstanceLoopCharacteristics', { isSequential });
    } else {
      el.loopCharacteristics.isSequential = isSequential;
    }
    return;
  }

  if (prop.startsWith('zeebe:loopCharacteristics.')) {
    assertActivity(el, prop);
    const key = prop.slice('zeebe:loopCharacteristics.'.length);
    const validKeys = ['inputCollection', 'inputElement', 'outputCollection', 'outputElement'];
    if (!validKeys.includes(key)) {
      throw new Error(
        `Unknown zeebe:loopCharacteristics property '${key}'. Supported: ${validKeys.join(', ')}`,
      );
    }
    if (!el.loopCharacteristics || el.loopCharacteristics.$type !== 'bpmn:MultiInstanceLoopCharacteristics') {
      throw new Error(`Set 'multi-instance.type' to 'parallel' or 'sequential' before setting zeebe:loopCharacteristics properties`);
    }
    const loopChar = getOrCreateZeebeChild(moddle, el.loopCharacteristics, 'zeebe:LoopCharacteristics');
    loopChar[key] = values[0];
    return;
  }

  if (prop === 'zeebe:userTask.disabled') {
    if (el.$type !== 'bpmn:UserTask') {
      throw new Error(`'zeebe:userTask.disabled' can only be set on user-task`);
    }
    const disabled = values[0] !== 'false';
    if (disabled) {
      if (el.extensionElements) {
        el.extensionElements.values = (el.extensionElements.values ?? []).filter(
          (v: ModdleElement) => v.$type !== 'zeebe:UserTask',
        );
      }
    } else {
      addZeebeUserTaskMarker(moddle, el);
    }
    return;
  }

  if (prop.startsWith('zeebe:adHoc.')) {
    if (el.$type !== 'bpmn:AdHocSubProcess') {
      throw new Error(`'${prop}' can only be set on ad-hoc sub-processes`);
    }
    const key = prop.slice('zeebe:adHoc.'.length);
    const validKeys = ['outputCollection', 'outputElement', 'activeElementsCollection'];
    if (!validKeys.includes(key)) {
      throw new Error(
        `Unknown zeebe:adHoc property '${key}'. Supported: ${validKeys.join(', ')}`,
      );
    }
    const adHoc = getOrCreateZeebeChild(moddle, el, 'zeebe:AdHoc');
    adHoc[key] = values[0];
    return;
  }

  if (prop === 'ad-hoc.ordering') {
    const ordering = values[0];
    if (ordering !== 'Sequential' && ordering !== 'Parallel') {
      throw new Error(`'ad-hoc.ordering' must be 'Sequential' or 'Parallel'`);
    }
    if (el.$type !== 'bpmn:AdHocSubProcess') {
      throw new Error(`'ad-hoc.ordering' can only be set on ad-hoc sub-processes`);
    }
    el.ordering = ordering;
    return;
  }

  if (prop === 'ad-hoc.cancelRemainingInstances') {
    if (el.$type !== 'bpmn:AdHocSubProcess') {
      throw new Error(`'ad-hoc.cancelRemainingInstances' can only be set on ad-hoc sub-processes`);
    }
    el.cancelRemainingInstances = values[0] !== 'false';
    return;
  }

  if (prop === 'timer.timeDuration' || prop === 'timer.timeCycle' || prop === 'timer.timeDate') {
    const eventDefs: ModdleElement[] = el.eventDefinitions ?? [];
    const timerDef = eventDefs.find((d: ModdleElement) => d.$type === 'bpmn:TimerEventDefinition');
    if (!timerDef) {
      throw new Error(`'${prop}' can only be set on elements with a bpmn:timerEventDefinition`);
    }
    const key = prop.slice('timer.'.length) as 'timeDuration' | 'timeCycle' | 'timeDate';
    const expr = moddle.create('bpmn:FormalExpression', { body: values[0] });
    timerDef.timeDuration = undefined;
    timerDef.timeCycle = undefined;
    timerDef.timeDate = undefined;
    timerDef[key] = expr;
    return;
  }

  if (prop.startsWith('zeebe:formDefinition.')) {
    if (el.$type !== 'bpmn:UserTask') {
      throw new Error(`'${prop}' can only be set on user tasks`);
    }
    const key = prop.slice('zeebe:formDefinition.'.length);
    const validKeys = ['formId', 'formKey', 'externalReference', 'bindingType', 'versionTag'];
    if (!validKeys.includes(key)) {
      throw new Error(
        `Unknown zeebe:formDefinition property '${key}'. Supported: ${validKeys.join(', ')}`,
      );
    }
    const fd = getOrCreateZeebeChild(moddle, el, 'zeebe:FormDefinition');
    if (FORM_DEFINITION_EXCLUSIVE_KEYS.includes(key)) {
      for (const other of FORM_DEFINITION_EXCLUSIVE_KEYS) {
        if (other !== key && fd[other] != null) {
          logger?.warn(`Clearing '${other}' because it is mutually exclusive with '${key}'`);
          fd[other] = undefined;
        }
      }
    }
    fd[key] = values[0];
    return;
  }

  throw new Error(
    `Unknown property '${prop}'. Supported: name, signalRef, messageRef, ` +
    `zeebe:taskDefinition.type, zeebe:taskDefinition.retries, ` +
    `zeebe:calledDecision.decisionId, zeebe:calledDecision.resultVariable, ` +
    `zeebe:input, zeebe:output, zeebe:header, zeebe:property, zeebe:userTask.disabled, ` +
    `isInterrupting, multi-instance.type, ` +
    `zeebe:loopCharacteristics.inputCollection, zeebe:loopCharacteristics.inputElement, ` +
    `zeebe:loopCharacteristics.outputCollection, zeebe:loopCharacteristics.outputElement, ` +
    `ad-hoc.ordering, ad-hoc.cancelRemainingInstances, ` +
    `timer.timeDuration, timer.timeCycle, timer.timeDate, ` +
    `zeebe:formDefinition.formId, zeebe:formDefinition.formKey, zeebe:formDefinition.externalReference, ` +
    `zeebe:formDefinition.bindingType, zeebe:formDefinition.versionTag, ` +
    `zeebe:adHoc.outputCollection, zeebe:adHoc.outputElement, zeebe:adHoc.activeElementsCollection`,
  );
}

function extractZeebe(el: ModdleElement): Record<string, unknown> | undefined {
  const values: ModdleElement[] = el.extensionElements?.values ?? [];
  // Also check loopCharacteristics extension elements for zeebe:LoopCharacteristics
  const loopExtValues: ModdleElement[] = el.loopCharacteristics?.extensionElements?.values ?? [];
  const allValues = [...values, ...loopExtValues];
  if (allValues.length === 0) return undefined;

  const result: Record<string, unknown> = {};

  for (const v of allValues) {
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
    } else if (type === 'zeebe:CalledDecision') {
      const cd: Record<string, string> = {};
      if (v.decisionId != null) cd['decisionId'] = v.decisionId;
      if (v.resultVariable != null) cd['resultVariable'] = v.resultVariable;
      if (Object.keys(cd).length > 0) result['calledDecision'] = cd;
    } else if (type === 'zeebe:UserTask') {
      result['userTask'] = true;
    } else if (type === 'zeebe:LoopCharacteristics') {
      const lc: Record<string, string> = {};
      if (v.inputCollection != null) lc['inputCollection'] = v.inputCollection;
      if (v.inputElement != null) lc['inputElement'] = v.inputElement;
      if (v.outputCollection != null) lc['outputCollection'] = v.outputCollection;
      if (v.outputElement != null) lc['outputElement'] = v.outputElement;
      if (Object.keys(lc).length > 0) result['loopCharacteristics'] = lc;
    } else if (type === 'zeebe:FormDefinition') {
      const fd: Record<string, string> = {};
      if (v.formId != null) fd['formId'] = v.formId;
      if (v.formKey != null) fd['formKey'] = v.formKey;
      if (v.externalReference != null) fd['externalReference'] = v.externalReference;
      if (v.bindingType != null) fd['bindingType'] = v.bindingType;
      if (v.versionTag != null) fd['versionTag'] = v.versionTag;
      if (Object.keys(fd).length > 0) result['formDefinition'] = fd;
    } else if (type === 'zeebe:AdHoc') {
      const ah: Record<string, string> = {};
      if (v.outputCollection != null) ah['outputCollection'] = v.outputCollection;
      if (v.outputElement != null) ah['outputElement'] = v.outputElement;
      if (v.activeElementsCollection != null) ah['activeElementsCollection'] = v.activeElementsCollection;
      if (Object.keys(ah).length > 0) result['adHoc'] = ah;
    }
  }

  return Object.keys(result).length > 0 ? result : undefined;
}

export function toEventDefinitionJson(defs: ModdleElement[]): Record<string, unknown> | undefined {
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
  if (def.condition?.body !== undefined) {
    result['condition'] = def.condition.body;
  }
  if (def.timeCycle?.body !== undefined) {
    result['timerCycle'] = def.timeCycle.body;
  }
  if (def.timeDuration?.body !== undefined) {
    result['timerDuration'] = def.timeDuration.body;
  }
  if (def.timeDate?.body !== undefined) {
    result['timerDate'] = def.timeDate.body;
  }

  return result;
}

function toElementJson(e: ModdleElement): Record<string, unknown> {
  const local = (e.$type as string).replace('bpmn:', '');
  const type = local.charAt(0).toLowerCase() + local.slice(1);
  const defs: ModdleElement[] = e.eventDefinitions ?? [];
  const eventDefinition = toEventDefinitionJson(defs);
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
  if (eventDefinition?.type === 'timer' && defs.length > 0) {
    const timerDef = defs[0];
    const timerEntry: Record<string, unknown> = {};
    if (timerDef.timeDuration?.body !== undefined) timerEntry['timeDuration'] = timerDef.timeDuration.body;
    if (timerDef.timeCycle?.body !== undefined) timerEntry['timeCycle'] = timerDef.timeCycle.body;
    if (timerDef.timeDate?.body !== undefined) timerEntry['timeDate'] = timerDef.timeDate.body;
    if (Object.keys(timerEntry).length > 0) entry['timer'] = timerEntry;
  }
  const zeebe = extractZeebe(e);
  if (zeebe) entry['zeebe'] = zeebe;
  if (e.loopCharacteristics?.$type === 'bpmn:MultiInstanceLoopCharacteristics') {
    entry['loopCharacteristics'] = {
      type: 'multiInstance',
      isSequential: e.loopCharacteristics.isSequential ?? false,
    };
  }
  if (e.$type === 'bpmn:SubProcess' && e.triggeredByEvent) {
    entry['triggeredByEvent'] = true;
  }
  if (e.$type === 'bpmn:StartEvent' && e.isInterrupting === false) {
    entry['isInterrupting'] = false;
  }
  if (e.$type === 'bpmn:AdHocSubProcess') {
    entry['ordering'] = e.ordering ?? 'Parallel';
    entry['cancelRemainingInstances'] = e.cancelRemainingInstances ?? true;
  }
  if (isSubProcessLike(e)) {
    const { elements: children, flows: childFlows } = toContainerJson(e);
    entry['children'] = children;
    entry['childFlows'] = childFlows;
  }
  const docs: ModdleElement[] = e.documentation ?? [];
  if (docs.length > 0) {
    const doc = docs[0];
    const docEntry: Record<string, unknown> = { text: doc.text };
    // Omit textFormat when it is the BPMN-spec default ('text/plain') to keep
    // the status output concise; only non-default values are meaningful here.
    if (doc.textFormat !== undefined && doc.textFormat !== 'text/plain') {
      docEntry['textFormat'] = doc.textFormat;
    }
    entry['documentation'] = docEntry;
  }
  return entry;
}

function toContainerJson(container: ModdleElement): { elements: Record<string, unknown>[]; flows: Record<string, unknown>[] } {
  const flowElements: ModdleElement[] = container.flowElements ?? [];
  const elements = flowElements
    .filter((e: ModdleElement) => e.$type !== 'bpmn:SequenceFlow')
    .map(toElementJson);
  const flows = flowElements
    .filter((e: ModdleElement) => e.$type === 'bpmn:SequenceFlow')
    .map((e: ModdleElement) => ({
      id: e.id,
      source: e.sourceRef?.id ?? e.sourceRef,
      target: e.targetRef?.id ?? e.targetRef,
      ...(e.conditionExpression ? { condition: e.conditionExpression.body } : {}),
    }));
  return { elements, flows };
}

export function toStatusJson(definitions: ModdleElement, cursor: string): Record<string, unknown> {
  const process = getProcess(definitions);
  const { elements, flows } = toContainerJson(process);
  const artifacts = toArtifactsJson(process);
  const result: Record<string, unknown> = {
    cursor,
    process: {
      id: process.id,
      name: process.name,
      elements,
      flows,
      ...(artifacts.length > 0 ? { artifacts } : {}),
    },
  };
  return result;
}

function toArtifactsJson(process: ModdleElement): Record<string, unknown>[] {
  const arts: ModdleElement[] = process.artifacts ?? [];
  const annotations = arts.filter((a: ModdleElement) => a.$type === 'bpmn:TextAnnotation');
  const associations = arts.filter((a: ModdleElement) => a.$type === 'bpmn:Association');

  return annotations.map((a: ModdleElement) => {
    const assoc = associations.find(
      (asc: ModdleElement) => (asc.targetRef?.id ?? asc.targetRef) === a.id,
    );
    const entry: Record<string, unknown> = {
      id: a.id,
      type: 'TextAnnotation',
      text: a.text,
    };
    if (assoc) {
      entry['associatedTo'] = assoc.sourceRef?.id ?? assoc.sourceRef;
      entry['associationId'] = assoc.id;
    }
    return entry;
  });
}
