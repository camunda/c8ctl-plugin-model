import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { BpmnModdle } from 'bpmn-moddle';
import { recomputeLayout } from './layout.js';
const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const zeebeDescriptor = require('zeebe-bpmn-moddle/resources/zeebe');
export function createModdle() {
    return new BpmnModdle({ zeebe: zeebeDescriptor });
}
export async function loadFile(filePath) {
    const xml = readFileSync(filePath, 'utf-8');
    const moddle = createModdle();
    const { rootElement: definitions } = await moddle.fromXML(xml);
    return { moddle, definitions };
}
export async function saveFile(filePath, moddle, definitions) {
    recomputeLayout(moddle, definitions);
    const { xml } = await moddle.toXML(definitions, { format: true });
    writeFileSync(filePath, xml);
}
export function createMinimalBpmn(moddle, processName) {
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
export function getProcess(definitions) {
    const process = definitions.rootElements?.find((e) => e.$type === 'bpmn:Process');
    if (!process)
        throw new Error('No process found in BPMN file');
    return process;
}
function isSubProcessLike(el) {
    return el.$type === 'bpmn:SubProcess' || el.$type === 'bpmn:AdHocSubProcess';
}
function collectAllFlowElements(container) {
    const result = [];
    for (const el of container.flowElements ?? []) {
        result.push(el);
        if (isSubProcessLike(el))
            result.push(...collectAllFlowElements(el));
    }
    return result;
}
function findInContainer(container, id) {
    for (const el of container.flowElements ?? []) {
        if (el.id === id)
            return el;
        if (isSubProcessLike(el)) {
            const found = findInContainer(el, id);
            if (found)
                return found;
        }
    }
    return undefined;
}
function findContainerOfHelper(container, id) {
    for (const el of container.flowElements ?? []) {
        if (el.id === id)
            return container;
        if (isSubProcessLike(el)) {
            const found = findContainerOfHelper(el, id);
            if (found)
                return found;
        }
    }
    return undefined;
}
export function getElementById(definitions, id) {
    const process = getProcess(definitions);
    return findInContainer(process, id);
}
export function findContainerOf(definitions, id) {
    const process = getProcess(definitions);
    return findContainerOfHelper(process, id);
}
function normalizeBpmnType(type) {
    const camel = type.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    const capitalized = camel.charAt(0).toUpperCase() + camel.slice(1);
    return `bpmn:${capitalized}`;
}
const TYPED_EVENT_GROUPS = [
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
const DEF_TYPE_TO_TRIGGER = {
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
function parseElementType(type) {
    if (type === 'event-sub-process') {
        return { bpmnType: 'bpmn:SubProcess', extraProps: { triggeredByEvent: true } };
    }
    if (type === 'intermediate-catch-event') {
        throw new Error(`'intermediate-catch-event' is not supported — use a typed variant: ` +
            `timer-intermediate-catch-event, message-intermediate-catch-event, ` +
            `signal-intermediate-catch-event, conditional-intermediate-catch-event, ` +
            `link-intermediate-catch-event`);
    }
    for (const { suffix, bpmnType, defs } of TYPED_EVENT_GROUPS) {
        if (type.endsWith(suffix)) {
            const trigger = type.slice(0, -suffix.length);
            if (trigger === '')
                return { bpmnType };
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
function nextId(process, prefix) {
    let max = 0;
    for (const el of collectAllFlowElements(process)) {
        const m = el.id?.match(new RegExp(`^${prefix}_(\\d+)$`));
        if (m)
            max = Math.max(max, parseInt(m[1], 10));
    }
    return `${prefix}_${max + 1}`;
}
function nextEventDefId(process) {
    let max = 0;
    for (const el of collectAllFlowElements(process)) {
        for (const def of (el.eventDefinitions ?? [])) {
            const m = def.id?.match(/^EventDefinition_(\d+)$/);
            if (m)
                max = Math.max(max, parseInt(m[1], 10));
        }
    }
    return `EventDefinition_${max + 1}`;
}
function idPrefix(bpmnType) {
    const local = bpmnType.replace('bpmn:', '');
    if (local.endsWith('Gateway'))
        return 'Gateway';
    if (local.endsWith('Event'))
        return local.includes('Start') ? 'StartEvent' : local.includes('End') ? 'EndEvent' : 'Event';
    return 'Activity';
}
export function addElement(moddle, definitions, type, name, sourceId) {
    const { bpmnType, defType, extraProps } = parseElementType(type);
    const process = getProcess(definitions);
    const prefix = idPrefix(bpmnType);
    const newId = nextId(process, prefix);
    const elProps = { id: newId, name, ...extraProps };
    if (defType) {
        elProps.eventDefinitions = [moddle.create(defType, { id: nextEventDefId(process) })];
    }
    const newEl = moddle.create(bpmnType, elProps);
    const source = getElementById(definitions, sourceId);
    if (!source)
        throw new Error(`Source element '${sourceId}' not found`);
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
export function addChildElement(moddle, definitions, parentId, type, name) {
    const process = getProcess(definitions);
    const parent = getElementById(definitions, parentId);
    if (!parent)
        throw new Error(`Parent element '${parentId}' not found`);
    const { bpmnType, defType, extraProps } = parseElementType(type);
    const prefix = idPrefix(bpmnType);
    const newId = nextId(process, prefix);
    const elProps = { id: newId, name, incoming: [], outgoing: [], ...extraProps };
    if (defType) {
        elProps.eventDefinitions = [moddle.create(defType, { id: nextEventDefId(process) })];
    }
    const newEl = moddle.create(bpmnType, elProps);
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
export function createElement(moddle, definitions, type, name) {
    const process = getProcess(definitions);
    const { bpmnType, defType, extraProps } = parseElementType(type);
    const prefix = idPrefix(bpmnType);
    const newId = nextId(process, prefix);
    const elProps = { id: newId, name, incoming: [], outgoing: [], ...extraProps };
    if (defType) {
        elProps.eventDefinitions = [moddle.create(defType, { id: nextEventDefId(process) })];
    }
    const newEl = moddle.create(bpmnType, elProps);
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
export function connectElements(moddle, definitions, sourceId, targetId, conditionExpression) {
    const process = getProcess(definitions);
    const source = getElementById(definitions, sourceId);
    if (!source)
        throw new Error(`Source element '${sourceId}' not found`);
    const target = getElementById(definitions, targetId);
    if (!target)
        throw new Error(`Target element '${targetId}' not found`);
    const sourceContainer = findContainerOfHelper(process, sourceId) ?? process;
    const targetContainer = findContainerOfHelper(process, targetId) ?? process;
    if (sourceContainer !== targetContainer) {
        throw new Error(`'${sourceId}' and '${targetId}' are in different scopes and cannot be connected`);
    }
    const flowId = nextId(process, 'Flow');
    const flowProps = { id: flowId, sourceRef: source, targetRef: target };
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
const BOUNDARY_EVENT_DEF_TYPES = {
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
function assertActivity(el, prop) {
    if (!ACTIVITY_TYPES.has(el.$type)) {
        throw new Error(`'${prop}' can only be set on activities`);
    }
}
function assertStartEvent(el, prop) {
    if (el.$type !== 'bpmn:StartEvent') {
        throw new Error(`'${prop}' can only be set on start events`);
    }
}
function parseBoundaryEventType(eventType) {
    const isNonInterrupting = eventType.startsWith('non-interrupting-');
    const base = isNonInterrupting ? eventType.slice('non-interrupting-'.length) : eventType;
    const defType = BOUNDARY_EVENT_DEF_TYPES[base];
    if (!defType) {
        throw new Error(`Unknown boundary event type '${base}'. Supported: ${Object.keys(BOUNDARY_EVENT_DEF_TYPES).join(', ')}`);
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
export function addBoundaryEvent(moddle, definitions, eventType, name, hostId) {
    const process = getProcess(definitions);
    const host = getElementById(definitions, hostId);
    if (!host)
        throw new Error(`Host element '${hostId}' not found`);
    if (!VALID_HOST_TYPES.has(host.$type)) {
        throw new Error(`'${hostId}' is ${host.$type} — boundary events can only be attached to activities`);
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
function getOrCreateExtensionElements(moddle, el) {
    if (!el.extensionElements) {
        el.extensionElements = moddle.create('bpmn:ExtensionElements', { values: [] });
    }
    return el.extensionElements;
}
function getOrCreateZeebeChild(moddle, el, zeebeType) {
    const ext = getOrCreateExtensionElements(moddle, el);
    let child = (ext.values ?? []).find((v) => v.$type === zeebeType);
    if (!child) {
        child = moddle.create(zeebeType, {});
        ext.values = [...(ext.values ?? []), child];
    }
    return child;
}
export function updateElementProperty(moddle, el, prop, values) {
    if (prop === 'name') {
        el.name = values[0];
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
        const inputs = ioMapping.inputParameters ?? [];
        const existing = inputs.find((i) => i.target === target);
        if (existing) {
            existing.source = source;
        }
        else {
            const input = moddle.create('zeebe:Input', { source, target });
            ioMapping.inputParameters = [...inputs, input];
        }
        return;
    }
    if (prop === 'zeebe:output') {
        assertActivity(el, prop);
        const [source, target] = values;
        const ioMapping = getOrCreateZeebeChild(moddle, el, 'zeebe:IoMapping');
        const outputs = ioMapping.outputParameters ?? [];
        const existing = outputs.find((o) => o.source === source);
        if (existing) {
            existing.target = target;
        }
        else {
            const output = moddle.create('zeebe:Output', { source, target });
            ioMapping.outputParameters = [...outputs, output];
        }
        return;
    }
    if (prop === 'zeebe:header') {
        assertActivity(el, prop);
        const [key, value] = values;
        const headers = getOrCreateZeebeChild(moddle, el, 'zeebe:TaskHeaders');
        const existing = (headers.values ?? []).find((h) => h.key === key);
        if (existing) {
            existing.value = value;
        }
        else {
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
        const existing = (props.properties ?? []).find((p) => p.name === name);
        if (existing) {
            existing.value = value;
        }
        else {
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
        }
        else {
            el.loopCharacteristics.isSequential = isSequential;
        }
        return;
    }
    if (prop.startsWith('zeebe:loopCharacteristics.')) {
        assertActivity(el, prop);
        const key = prop.slice('zeebe:loopCharacteristics.'.length);
        const validKeys = ['inputCollection', 'inputElement', 'outputCollection', 'outputElement'];
        if (!validKeys.includes(key)) {
            throw new Error(`Unknown zeebe:loopCharacteristics property '${key}'. Supported: ${validKeys.join(', ')}`);
        }
        const loopChar = getOrCreateZeebeChild(moddle, el, 'zeebe:LoopCharacteristics');
        loopChar[key] = values[0];
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
    throw new Error(`Unknown property '${prop}'. Supported: name, zeebe:taskDefinition.type, zeebe:taskDefinition.retries, ` +
        `zeebe:calledDecision.decisionId, zeebe:calledDecision.resultVariable, ` +
        `zeebe:input, zeebe:output, zeebe:header, zeebe:property, isInterrupting, multi-instance.type, ` +
        `zeebe:loopCharacteristics.inputCollection, zeebe:loopCharacteristics.inputElement, ` +
        `zeebe:loopCharacteristics.outputCollection, zeebe:loopCharacteristics.outputElement, ` +
        `ad-hoc.ordering, ad-hoc.cancelRemainingInstances`);
}
function extractZeebe(el) {
    const values = el.extensionElements?.values ?? [];
    if (values.length === 0)
        return undefined;
    const result = {};
    for (const v of values) {
        const type = v.$type ?? '';
        if (type === 'zeebe:TaskDefinition') {
            result['taskDefinition'] = { type: v.type, retries: v.retries };
        }
        else if (type === 'zeebe:IoMapping') {
            result['ioMapping'] = {
                inputs: (v.inputParameters ?? []).map((i) => ({ source: i.source, target: i.target })),
                outputs: (v.outputParameters ?? []).map((o) => ({ source: o.source, target: o.target })),
            };
        }
        else if (type === 'zeebe:TaskHeaders') {
            result['taskHeaders'] = (v.values ?? []).map((h) => ({ key: h.key, value: h.value }));
        }
        else if (type === 'zeebe:Properties') {
            result['properties'] = (v.properties ?? []).map((p) => ({ name: p.name, value: p.value }));
        }
        else if (type === 'zeebe:CalledDecision') {
            const cd = {};
            if (v.decisionId != null)
                cd['decisionId'] = v.decisionId;
            if (v.resultVariable != null)
                cd['resultVariable'] = v.resultVariable;
            if (Object.keys(cd).length > 0)
                result['calledDecision'] = cd;
        }
        else if (type === 'zeebe:LoopCharacteristics') {
            const lc = {};
            if (v.inputCollection != null)
                lc['inputCollection'] = v.inputCollection;
            if (v.inputElement != null)
                lc['inputElement'] = v.inputElement;
            if (v.outputCollection != null)
                lc['outputCollection'] = v.outputCollection;
            if (v.outputElement != null)
                lc['outputElement'] = v.outputElement;
            if (Object.keys(lc).length > 0)
                result['loopCharacteristics'] = lc;
        }
    }
    return Object.keys(result).length > 0 ? result : undefined;
}
function toElementJson(e) {
    const local = e.$type.replace('bpmn:', '');
    const type = local.charAt(0).toLowerCase() + local.slice(1);
    const defs = e.eventDefinitions ?? [];
    const eventDefinition = defs.length > 0 ? (DEF_TYPE_TO_TRIGGER[defs[0].$type] ?? defs[0].$type) : undefined;
    const entry = {
        id: e.id,
        type,
        name: e.name,
        ...(eventDefinition ? { eventDefinition } : {}),
        ...(e.attachedToRef
            ? {
                attachedToRef: e.attachedToRef?.id ?? e.attachedToRef,
                cancelActivity: e.cancelActivity,
                outgoing: (e.outgoing ?? []).map((f) => f.id),
            }
            : {
                incoming: (e.incoming ?? []).map((f) => f.id),
                outgoing: (e.outgoing ?? []).map((f) => f.id),
            }),
    };
    const zeebe = extractZeebe(e);
    if (zeebe)
        entry['zeebe'] = zeebe;
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
    return entry;
}
function toContainerJson(container) {
    const flowElements = container.flowElements ?? [];
    const elements = flowElements
        .filter((e) => e.$type !== 'bpmn:SequenceFlow')
        .map(toElementJson);
    const flows = flowElements
        .filter((e) => e.$type === 'bpmn:SequenceFlow')
        .map((e) => ({
        id: e.id,
        source: e.sourceRef?.id ?? e.sourceRef,
        target: e.targetRef?.id ?? e.targetRef,
        ...(e.conditionExpression ? { condition: e.conditionExpression.body } : {}),
    }));
    return { elements, flows };
}
export function toStatusJson(definitions, cursor) {
    const process = getProcess(definitions);
    const { elements, flows } = toContainerJson(process);
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
