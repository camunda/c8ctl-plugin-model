import { test } from 'node:test';
import assert from 'node:assert/strict';
import { connect } from '../commands/connect.js';
import { create } from '../commands/create.js';
import { append } from '../commands/append.js';
import { readState } from '../state.js';
import { tmpDir, cleanup, setupModel, getStatus } from './helpers.js';

test('connect creates sequence flow between two elements', async () => {
  const cwd = tmpDir();
  try {
    await setupModel('proc', cwd);
    await create(['end-event', 'End'], cwd); // EndEvent_1, no incoming flow

    await connect(['StartEvent_1', 'EndEvent_1'], cwd);

    const status = await getStatus(cwd);
    const proc = status['process'] as Record<string, unknown>;
    const flows = proc['flows'] as Array<Record<string, unknown>>;
    const flow = flows.find((f) => f['source'] === 'StartEvent_1' && f['target'] === 'EndEvent_1');
    assert.ok(flow, 'flow should exist');
  } finally {
    cleanup(cwd);
  }
});

test('connect moves cursor to target', async () => {
  const cwd = tmpDir();
  try {
    await setupModel('proc', cwd);
    await create(['end-event', 'End'], cwd); // cursor → EndEvent_1
    await connect(['StartEvent_1', 'EndEvent_1'], cwd);

    const state = readState();
    assert.equal(state.cursor, 'EndEvent_1');
  } finally {
    cleanup(cwd);
  }
});

test('connect with condition stores condition on flow', async () => {
  const cwd = tmpDir();
  try {
    await setupModel('proc', cwd);
    await append(['exclusive-gateway', 'Decision'], cwd); // Gateway_1
    await create(['end-event', 'Approved'], cwd); // EndEvent_1
    await create(['end-event', 'Rejected'], cwd); // EndEvent_2

    await connect(['Gateway_1', 'EndEvent_1', '=approved'], cwd);
    await connect(['Gateway_1', 'EndEvent_2', '=!approved'], cwd);

    const status = await getStatus(cwd);
    const proc = status['process'] as Record<string, unknown>;
    const flows = proc['flows'] as Array<Record<string, unknown>>;
    const approvedFlow = flows.find((f) => f['source'] === 'Gateway_1' && f['target'] === 'EndEvent_1');
    assert.equal(approvedFlow?.['condition'], '=approved');
    const rejectedFlow = flows.find((f) => f['source'] === 'Gateway_1' && f['target'] === 'EndEvent_2');
    assert.equal(rejectedFlow?.['condition'], '=!approved');
  } finally {
    cleanup(cwd);
  }
});

test('connect throws when source not found', async () => {
  const cwd = tmpDir();
  try {
    await setupModel('proc', cwd);
    await create(['end-event', 'End'], cwd);
    await assert.rejects(() => connect(['Activity_99', 'EndEvent_1'], cwd), /not found/);
  } finally {
    cleanup(cwd);
  }
});

test('connect throws when target not found', async () => {
  const cwd = tmpDir();
  try {
    await setupModel('proc', cwd);
    await assert.rejects(() => connect(['StartEvent_1', 'Activity_99'], cwd), /not found/);
  } finally {
    cleanup(cwd);
  }
});

test('connect throws when elements are in different scopes', async () => {
  const cwd = tmpDir();
  try {
    await setupModel('proc', cwd);
    await append(['sub-process', 'My Sub'], cwd); // Activity_1
    await create(['end-event', 'End'], cwd); // EndEvent_1 at top level — cursor → EndEvent_1

    // Add a child inside the subprocess
    // Select Activity_1 first
    const { select } = await import('../commands/select.js');
    await select(['Activity_1'], cwd);
    const { addChild } = await import('../commands/add-child.js');
    await addChild(['start-event', 'Inner Start'], cwd); // StartEvent_2 inside Activity_1

    await assert.rejects(
      () => connect(['StartEvent_2', 'EndEvent_1'], cwd),
      /different scopes/,
    );
  } finally {
    cleanup(cwd);
  }
});

test('connect throws without required arguments', async () => {
  const cwd = tmpDir();
  try {
    await setupModel('proc', cwd);
    await assert.rejects(() => connect(['StartEvent_1'], cwd), /Usage/);
    await assert.rejects(() => connect([], cwd), /Usage/);
  } finally {
    cleanup(cwd);
  }
});
