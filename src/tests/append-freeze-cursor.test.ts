import { test } from 'node:test';
import assert from 'node:assert/strict';
import { append } from '../commands/append.js';
import { appendFreezeCursor } from '../commands/append-freeze-cursor.js';
import { readState } from '../state.js';
import { tmpDir, cleanup, setupModel, getStatus } from './helpers.js';

const ELEMENT_TYPES: Array<[string, string]> = [
  ['startEvent', 'startEvent'],
  ['endEvent', 'endEvent'],
  ['task', 'task'],
  ['userTask', 'userTask'],
  ['serviceTask', 'serviceTask'],
  ['scriptTask', 'scriptTask'],
  ['exclusiveGateway', 'exclusiveGateway'],
  ['parallelGateway', 'parallelGateway'],
  ['inclusiveGateway', 'inclusiveGateway'],
  ['callActivity', 'callActivity'],
  ['subProcess', 'subProcess'],
  ['intermediateCatchEvent', 'intermediateCatchEvent'],
  ['intermediateThrowEvent', 'intermediateThrowEvent'],
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
    await appendFreezeCursor(['endEvent', 'End'], cwd);

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
    await append(['exclusiveGateway', 'Decision'], cwd); // cursor → Gateway_1
    await appendFreezeCursor(['endEvent', 'Rejected', 'StartEvent_1'], cwd); // from StartEvent_1, cursor stays at Gateway_1

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
      () => appendFreezeCursor(['userTask', 'Task', 'Activity_99'], cwd),
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
    await assert.rejects(() => appendFreezeCursor(['userTask'], cwd), /Usage/);
    await assert.rejects(() => appendFreezeCursor([], cwd), /Usage/);
  } finally {
    cleanup(cwd);
  }
});
