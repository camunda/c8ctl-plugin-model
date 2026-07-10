import { test } from 'node:test';
import assert from 'node:assert/strict';
import { create } from '../commands/create.js';
import { readState } from '../state.js';
import { tmpDir, cleanup, setupModel, getStatus } from './helpers.js';

test('create adds standalone element with no incoming flow', async () => {
  const cwd = tmpDir();
  try {
    await setupModel('proc', cwd);
    await create(['user-task', 'Standalone Task'], cwd);

    const state = readState();
    assert.equal(state.cursor, 'Activity_1');

    const status = await getStatus(cwd);
    const proc = status['process'] as Record<string, unknown>;
    const elements = proc['elements'] as Array<Record<string, unknown>>;
    const el = elements.find((e) => e['id'] === 'Activity_1');
    assert.ok(el, 'element should exist');
    assert.equal(el?.['type'], 'userTask');

    const flows = proc['flows'] as Array<Record<string, unknown>>;
    assert.equal(flows.filter((f) => f['target'] === 'Activity_1').length, 0, 'no incoming flows');
  } finally {
    cleanup(cwd);
  }
});

test('create user-task emits zeebe:UserTask marker', async () => {
  const cwd = tmpDir();
  try {
    await setupModel('proc', cwd);
    await create(['user-task', 'Standalone Task'], cwd);

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

test('create event-sub-process sets triggeredByEvent', async () => {
  const cwd = tmpDir();
  try {
    await setupModel('proc', cwd);
    await create(['event-sub-process', 'Handle Error'], cwd);

    const status = await getStatus(cwd);
    const proc = status['process'] as Record<string, unknown>;
    const elements = proc['elements'] as Array<Record<string, unknown>>;
    const el = elements.find((e) => e['id'] === 'Activity_1');
    assert.equal(el?.['type'], 'subProcess');
    assert.equal(el?.['triggeredByEvent'], true);
  } finally {
    cleanup(cwd);
  }
});

test('create moves cursor to new element', async () => {
  const cwd = tmpDir();
  try {
    await setupModel('proc', cwd);
    await create(['end-event', 'Orphan End'], cwd);

    const state = readState();
    assert.equal(state.cursor, 'EndEvent_1');
  } finally {
    cleanup(cwd);
  }
});

test('create supports typed start events', async () => {
  const cwd = tmpDir();
  try {
    await setupModel('proc', cwd);
    await create(['error-start-event', 'On Error'], cwd);

    const status = await getStatus(cwd);
    const proc = status['process'] as Record<string, unknown>;
    const elements = proc['elements'] as Array<Record<string, unknown>>;
    const el = elements.find((e) => e['name'] === 'On Error');
    assert.ok(el, 'element should exist');
    assert.equal(el?.['type'], 'startEvent');
    assert.deepEqual(el?.['eventDefinition'], { type: 'error' });
  } finally {
    cleanup(cwd);
  }
});

test('create throws without required arguments', async () => {
  const cwd = tmpDir();
  try {
    await setupModel('proc', cwd);
    await assert.rejects(() => create(['user-task'], cwd), /Usage/);
    await assert.rejects(() => create([], cwd), /Usage/);
  } finally {
    cleanup(cwd);
  }
});

test('create-freeze-cursor adds element without moving cursor', async () => {
  const cwd = tmpDir();
  try {
    await setupModel('proc', cwd);
    const stateBefore = readState();
    await create(['--freeze-cursor','end-event', 'Orphan End'], cwd);

    const stateAfter = readState();
    assert.equal(stateAfter.cursor, stateBefore.cursor, 'cursor must not move');

    const status = await getStatus(cwd);
    const proc = status['process'] as Record<string, unknown>;
    const elements = proc['elements'] as Array<Record<string, unknown>>;
    assert.ok(elements.some((e) => e['id'] === 'EndEvent_1'), 'EndEvent_1 should exist');
  } finally {
    cleanup(cwd);
  }
});

test('create-freeze-cursor throws without required arguments', async () => {
  const cwd = tmpDir();
  try {
    await setupModel('proc', cwd);
    await assert.rejects(() => create(['--freeze-cursor','user-task'], cwd), /Usage/);
    await assert.rejects(() => create(['--freeze-cursor',], cwd), /Usage/);
  } finally {
    cleanup(cwd);
  }
});

// --- --id flag ---

test('create --id sets semantic element ID', async () => {
  const cwd = tmpDir();
  try {
    await setupModel('proc', cwd);
    await create(['end-event', 'Done', '--id', 'EndDone'], cwd);

    const status = await getStatus(cwd);
    const proc = status['process'] as Record<string, unknown>;
    const elements = proc['elements'] as Array<Record<string, unknown>>;
    assert.ok(elements.find((e) => e['id'] === 'EndDone'), 'EndDone element should exist');
    const state = readState(cwd);
    assert.equal(state.cursor, 'EndDone');
  } finally {
    cleanup(cwd);
  }
});

test('create --id rejects invalid ID', async () => {
  const cwd = tmpDir();
  try {
    await setupModel('proc', cwd);
    await assert.rejects(() => create(['end-event', 'Done', '--id', '1bad'], cwd), /Invalid ID/);
  } finally {
    cleanup(cwd);
  }
});
