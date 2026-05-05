import { test } from 'node:test';
import assert from 'node:assert/strict';
import { append } from '../commands/append.js';
import { appendFreezeCursor } from '../commands/append-freeze-cursor.js';
import { readState } from '../state.js';
import { tmpDir, cleanup, setupModel, getStatus } from './helpers.js';

const ELEMENT_TYPES: Array<[string, string]> = [
  ['start-event', 'startEvent'],
  ['end-event', 'endEvent'],
  ['task', 'task'],
  ['user-task', 'userTask'],
  ['service-task', 'serviceTask'],
  ['script-task', 'scriptTask'],
  ['exclusive-gateway', 'exclusiveGateway'],
  ['parallel-gateway', 'parallelGateway'],
  ['inclusive-gateway', 'inclusiveGateway'],
  ['event-based-gateway', 'eventBasedGateway'],
  ['call-activity', 'callActivity'],
  ['sub-process', 'subProcess'],
  ['intermediate-catch-event', 'intermediateCatchEvent'],
  ['timer-intermediate-catch-event', 'intermediateCatchEvent'],
  ['message-intermediate-catch-event', 'intermediateCatchEvent'],
  ['signal-intermediate-catch-event', 'intermediateCatchEvent'],
  ['conditional-intermediate-catch-event', 'intermediateCatchEvent'],
  ['link-intermediate-catch-event', 'intermediateCatchEvent'],
  ['intermediate-throw-event', 'intermediateThrowEvent'],
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
  test(`append-freeze-cursor ${type} creates element without moving cursor`, async () => {
    const cwd = tmpDir();
    try {
      await setupModel('proc', cwd);
      const stateBefore = readState(cwd);
      await appendFreezeCursor([type, 'My Label'], cwd);

      const stateAfter = readState(cwd);
      assert.equal(stateAfter.cursor, stateBefore.cursor, 'cursor must not move');

      const status = await getStatus(cwd);
      const proc = status['process'] as Record<string, unknown>;
      const elements = proc['elements'] as Array<Record<string, unknown>>;
      const newEl = elements.find((e) => e['type'] === expectedType);
      assert.ok(newEl, `element of type '${expectedType}' should exist`);
    } finally {
      cleanup(cwd);
    }
  });
}

test('append-freeze-cursor creates sequence flow from source', async () => {
  const cwd = tmpDir();
  try {
    await setupModel('proc', cwd);
    await appendFreezeCursor(['end-event', 'End'], cwd);

    const status = await getStatus(cwd);
    const proc = status['process'] as Record<string, unknown>;
    const flows = proc['flows'] as Array<Record<string, unknown>>;
    const flow = flows.find((f) => f['source'] === 'StartEvent_1' && f['target'] === 'EndEvent_1');
    assert.ok(flow, 'sequence flow from StartEvent_1 to EndEvent_1 should exist');
  } finally {
    cleanup(cwd);
  }
});

test('append-freeze-cursor with explicit sourceId uses that element', async () => {
  const cwd = tmpDir();
  try {
    await setupModel('proc', cwd);
    await append(['exclusive-gateway', 'Decision'], cwd); // cursor → Gateway_1
    await appendFreezeCursor(['end-event', 'Rejected', 'StartEvent_1'], cwd); // from StartEvent_1, cursor stays at Gateway_1

    const state = readState(cwd);
    assert.equal(state.cursor, 'Gateway_1');

    const status = await getStatus(cwd);
    const proc = status['process'] as Record<string, unknown>;
    const flows = proc['flows'] as Array<Record<string, unknown>>;
    const flow = flows.find((f) => f['source'] === 'StartEvent_1' && f['target'] === 'EndEvent_1');
    assert.ok(flow, 'explicit source flow should exist');
  } finally {
    cleanup(cwd);
  }
});

test('append-freeze-cursor throws when source not found', async () => {
  const cwd = tmpDir();
  try {
    await setupModel('proc', cwd);
    await assert.rejects(
      () => appendFreezeCursor(['user-task', 'Task', 'Activity_99'], cwd),
      /not found/,
    );
  } finally {
    cleanup(cwd);
  }
});

test('append-freeze-cursor throws without required arguments', async () => {
  const cwd = tmpDir();
  try {
    await setupModel('proc', cwd);
    await assert.rejects(() => appendFreezeCursor(['user-task'], cwd), /Usage/);
    await assert.rejects(() => appendFreezeCursor([], cwd), /Usage/);
  } finally {
    cleanup(cwd);
  }
});
