import { test } from 'node:test';
import assert from 'node:assert/strict';
import { append } from '../commands/append.js';
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

test('append moves cursor to new element', async () => {
  const cwd = tmpDir();
  try {
    await setupModel('proc', cwd);
    await append(['userTask', 'Review'], cwd);
    const state = readState(cwd);
    assert.equal(state.cursor, 'Activity_1');
  } finally {
    cleanup(cwd);
  }
});

test('append chains: each append uses current cursor as source', async () => {
  const cwd = tmpDir();
  try {
    await setupModel('proc', cwd);
    await append(['userTask', 'Step 1'], cwd);
    await append(['serviceTask', 'Step 2'], cwd);

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
    await append(['userTask', 'Branch A'], cwd); // Activity_1, cursor → Activity_1
    await append(['endEvent', 'End A', 'StartEvent_1'], cwd); // from StartEvent_1, cursor → EndEvent_1

    const status = await getStatus(cwd);
    const proc = status['process'] as Record<string, unknown>;
    const flows = proc['flows'] as Array<Record<string, unknown>>;

    const flow = flows.find((f) => f['source'] === 'StartEvent_1' && f['target'] === 'EndEvent_1');
    assert.ok(flow, 'explicit source flow should exist');

    // cursor moved to EndEvent_1 (explicit source does not freeze cursor)
    const state = readState(cwd);
    assert.equal(state.cursor, 'EndEvent_1');
  } finally {
    cleanup(cwd);
  }
});

test('append supports multi-word labels', async () => {
  const cwd = tmpDir();
  try {
    await setupModel('proc', cwd);
    await append(['userTask', 'Review And Approve'], cwd);

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
      () => append(['userTask', 'Task', 'Activity_99'], cwd),
      /not found/,
    );
  } finally {
    cleanup(cwd);
  }
});

test('append throws without required arguments', async () => {
  const cwd = tmpDir();
  try {
    await setupModel('proc', cwd);
    await assert.rejects(() => append(['userTask'], cwd), /Usage/);
    await assert.rejects(() => append([], cwd), /Usage/);
  } finally {
    cleanup(cwd);
  }
});
