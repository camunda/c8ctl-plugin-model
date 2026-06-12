import { test } from 'node:test';
import assert from 'node:assert/strict';
import { append } from '../commands/append.js';
import { readState } from '../state.js';
import { tmpDir, cleanup, setupModel, getStatus } from './helpers.js';

const ELEMENT_TYPES: Array<[string, string]> = [
  ['start-event', 'startEvent'],
  ['end-event', 'endEvent'],
  ['task', 'task'],
  ['user-task', 'userTask'],
  ['service-task', 'serviceTask'],
  ['script-task', 'scriptTask'],
  ['send-task', 'sendTask'],
  ['receive-task', 'receiveTask'],
  ['manual-task', 'manualTask'],
  ['business-rule-task', 'businessRuleTask'],
  ['exclusive-gateway', 'exclusiveGateway'],
  ['parallel-gateway', 'parallelGateway'],
  ['inclusive-gateway', 'inclusiveGateway'],
  ['event-based-gateway', 'eventBasedGateway'],
  ['call-activity', 'callActivity'],
  ['sub-process', 'subProcess'],
  ['ad-hoc-sub-process', 'adHocSubProcess'],
  ['timer-start-event', 'startEvent'],
  ['message-start-event', 'startEvent'],
  ['signal-start-event', 'startEvent'],
  ['error-start-event', 'startEvent'],
  ['escalation-start-event', 'startEvent'],
  ['compensation-start-event', 'startEvent'],
  ['conditional-start-event', 'startEvent'],
  ['timer-intermediate-catch-event', 'intermediateCatchEvent'],
  ['message-intermediate-catch-event', 'intermediateCatchEvent'],
  ['signal-intermediate-catch-event', 'intermediateCatchEvent'],
  ['conditional-intermediate-catch-event', 'intermediateCatchEvent'],
  ['link-intermediate-catch-event', 'intermediateCatchEvent'],
  ['message-intermediate-throw-event', 'intermediateThrowEvent'],
  ['signal-intermediate-throw-event', 'intermediateThrowEvent'],
  ['escalation-intermediate-throw-event', 'intermediateThrowEvent'],
  ['compensation-intermediate-throw-event', 'intermediateThrowEvent'],
  ['link-intermediate-throw-event', 'intermediateThrowEvent'],
  ['message-end-event', 'endEvent'],
  ['signal-end-event', 'endEvent'],
  ['error-end-event', 'endEvent'],
  ['escalation-end-event', 'endEvent'],
  ['terminate-end-event', 'endEvent'],
  ['compensation-end-event', 'endEvent'],
  ['cancel-end-event', 'endEvent'],
];

for (const [type, expectedType] of ELEMENT_TYPES) {
  test(`append ${type} creates element and sequence flow`, async () => {
    const cwd = tmpDir();
    try {
      await setupModel('proc', cwd);
      await append([type, 'My Label'], cwd);

      const status = await getStatus(cwd);
      const proc = status['process'] as Record<string, unknown>;
      const elements = proc['elements'] as Array<Record<string, unknown>>;
      const newEl = elements.find((e) => e['name'] === 'My Label');
      assert.ok(newEl, `element named 'My Label' should exist`);
      assert.equal(newEl['type'], expectedType);

      const flows = proc['flows'] as Array<Record<string, unknown>>;
      const flow = flows.find((f) => f['target'] === newEl['id']);
      assert.ok(flow, 'sequence flow to new element should exist');
      assert.equal(flow['source'], 'StartEvent_1');
    } finally {
      cleanup(cwd);
    }
  });
}

test('append user-task emits zeebe:UserTask marker', async () => {
  const cwd = tmpDir();
  try {
    await setupModel('proc', cwd);
    await append(['user-task', 'Review'], cwd);

    const status = await getStatus(cwd);
    const proc = status['process'] as Record<string, unknown>;
    const elements = proc['elements'] as Array<Record<string, unknown>>;
    const el = elements.find((e) => e['id'] === 'Activity_1');
    const zeebe = el?.['zeebe'] as Record<string, unknown>;
    assert.equal(zeebe?.['userTask'], true, 'zeebe:UserTask marker should be present');
  } finally {
    cleanup(cwd);
  }
});

test('append moves cursor to new element', async () => {
  const cwd = tmpDir();
  try {
    await setupModel('proc', cwd);
    await append(['user-task', 'Review'], cwd);
    const state = readState();
    assert.equal(state.cursor, 'Activity_1');
  } finally {
    cleanup(cwd);
  }
});

test('append chains: each append uses current cursor as source', async () => {
  const cwd = tmpDir();
  try {
    await setupModel('proc', cwd);
    await append(['user-task', 'Step 1'], cwd);
    await append(['service-task', 'Step 2'], cwd);

    const status = await getStatus(cwd);
    const proc = status['process'] as Record<string, unknown>;
    const flows = proc['flows'] as Array<Record<string, unknown>>;

    const flow = flows.find((f) => f['source'] === 'Activity_1' && f['target'] === 'Activity_2');
    assert.ok(flow, 'flow from Activity_1 to Activity_2 should exist');
  } finally {
    cleanup(cwd);
  }
});

test('append with explicit sourceId uses that element as source', async () => {
  const cwd = tmpDir();
  try {
    await setupModel('proc', cwd);
    await append(['user-task', 'Branch A'], cwd); // Activity_1, cursor → Activity_1
    await append(['end-event', 'End A', 'StartEvent_1'], cwd); // from StartEvent_1, cursor → EndEvent_1

    const status = await getStatus(cwd);
    const proc = status['process'] as Record<string, unknown>;
    const flows = proc['flows'] as Array<Record<string, unknown>>;

    const flow = flows.find((f) => f['source'] === 'StartEvent_1' && f['target'] === 'EndEvent_1');
    assert.ok(flow, 'explicit source flow should exist');

    // cursor moved to EndEvent_1 (explicit source does not freeze cursor)
    const state = readState();
    assert.equal(state.cursor, 'EndEvent_1');
  } finally {
    cleanup(cwd);
  }
});

test('append supports multi-word labels', async () => {
  const cwd = tmpDir();
  try {
    await setupModel('proc', cwd);
    await append(['user-task', 'Review And Approve'], cwd);

    const status = await getStatus(cwd);
    const proc = status['process'] as Record<string, unknown>;
    const elements = proc['elements'] as Array<Record<string, unknown>>;
    const el = elements.find((e) => e['id'] === 'Activity_1');
    assert.equal(el?.['name'], 'Review And Approve');
  } finally {
    cleanup(cwd);
  }
});

test('append throws when source element not found', async () => {
  const cwd = tmpDir();
  try {
    await setupModel('proc', cwd);
    await assert.rejects(
      () => append(['user-task', 'Task', 'Activity_99'], cwd),
      /not found/,
    );
  } finally {
    cleanup(cwd);
  }
});

test('append typed event shows eventDefinition in status', async () => {
  const cwd = tmpDir();
  try {
    await setupModel('proc', cwd);
    await append(['timer-intermediate-catch-event', 'Wait'], cwd);

    const status = await getStatus(cwd);
    const proc = status['process'] as Record<string, unknown>;
    const elements = proc['elements'] as Array<Record<string, unknown>>;
    const el = elements.find((e) => e['name'] === 'Wait');
    assert.equal(el?.['type'], 'intermediateCatchEvent');
    assert.deepEqual(el?.['eventDefinition'], { type: 'timer' });
  } finally {
    cleanup(cwd);
  }
});

test('append typed end event shows eventDefinition in status', async () => {
  const cwd = tmpDir();
  try {
    await setupModel('proc', cwd);
    await append(['error-end-event', 'Fail'], cwd);

    const status = await getStatus(cwd);
    const proc = status['process'] as Record<string, unknown>;
    const elements = proc['elements'] as Array<Record<string, unknown>>;
    const el = elements.find((e) => e['name'] === 'Fail');
    assert.equal(el?.['type'], 'endEvent');
    assert.deepEqual(el?.['eventDefinition'], { type: 'error' });
  } finally {
    cleanup(cwd);
  }
});

test('append intermediate-catch-event throws and directs to typed variants', async () => {
  const cwd = tmpDir();
  try {
    await setupModel('proc', cwd);
    await assert.rejects(
      () => append(['intermediate-catch-event', 'Catch'], cwd),
      /typed variant/,
    );
  } finally {
    cleanup(cwd);
  }
});

test('append intermediate-throw-event throws and directs to typed variants', async () => {
  const cwd = tmpDir();
  try {
    await setupModel('proc', cwd);
    await assert.rejects(
      () => append(['intermediate-throw-event', 'Throw'], cwd),
      /typed variant/,
    );
  } finally {
    cleanup(cwd);
  }
});

test('append multiple typed events get unique EventDefinition IDs', async () => {
  const cwd = tmpDir();
  try {
    await setupModel('proc', cwd);
    await append(['timer-intermediate-catch-event', 'Timer'], cwd);
    await append(['message-intermediate-catch-event', 'Message'], cwd);

    const { loadFile, getProcess: gp } = await import('../bpmn.js');
    const { readState } = await import('../state.js');
    const state = readState();
    const { definitions } = await loadFile(state.file);
    const process = gp(definitions);
    const defs = (process.flowElements as Array<Record<string, unknown>>)
      .flatMap((el) => (el['eventDefinitions'] as Array<Record<string, unknown>> | undefined) ?? [])
      .map((d) => d['id'] as string);
    assert.equal(new Set(defs).size, defs.length, 'all EventDefinition IDs must be unique');
  } finally {
    cleanup(cwd);
  }
});

test('append throws for unknown typed event trigger', async () => {
  const cwd = tmpDir();
  try {
    await setupModel('proc', cwd);
    await assert.rejects(
      () => append(['link-end-event', 'End'], cwd),
      /Unknown typed event/,
    );
  } finally {
    cleanup(cwd);
  }
});

test('append throws without required arguments', async () => {
  const cwd = tmpDir();
  try {
    await setupModel('proc', cwd);
    await assert.rejects(() => append(['user-task'], cwd), /Usage/);
    await assert.rejects(() => append([], cwd), /Usage/);
  } finally {
    cleanup(cwd);
  }
});


// --- --id flag ---

test('append --id sets semantic element ID', async () => {
  const cwd = tmpDir();
  try {
    await setupModel('proc', cwd);
    await append(['user-task', 'Review', '--id', 'ReviewTask'], cwd);

    const status = await getStatus(cwd);
    const proc = status['process'] as Record<string, unknown>;
    const elements = proc['elements'] as Array<Record<string, unknown>>;
    assert.ok(elements.find((e) => e['id'] === 'ReviewTask'), 'ReviewTask element should exist');
    const state = readState(cwd);
    assert.equal(state.cursor, 'ReviewTask');
  } finally {
    cleanup(cwd);
  }
});

test('append --id rejects invalid ID format', async () => {
  const cwd = tmpDir();
  try {
    await setupModel('proc', cwd);
    await assert.rejects(() => append(['user-task', 'Review', '--id', '1invalid'], cwd), /Invalid ID/);
  } finally {
    cleanup(cwd);
  }
});

test('append --id rejects duplicate ID', async () => {
  const cwd = tmpDir();
  try {
    await setupModel('proc', cwd);
    await assert.rejects(() => append(['user-task', 'Review', '--id', 'StartEvent_1'], cwd), /already used/);
  } finally {
    cleanup(cwd);
  }
});

test('append --id without value throws error', async () => {
  const cwd = tmpDir();
  try {
    await setupModel('proc', cwd);
    await assert.rejects(() => append(['user-task', 'Review', '--id'], cwd), /--id requires a value/);
  } finally {
    cleanup(cwd);
  }
});
