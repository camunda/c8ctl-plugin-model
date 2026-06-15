import { test } from 'node:test';
import assert from 'node:assert/strict';
import { append } from '../commands/append.js';
import { boundaryAppend } from '../commands/boundary-append.js';
import { readState } from '../state.js';
import { tmpDir, cleanup, setupModel, getStatus } from './helpers.js';

async function setupWithTask(cwd: string): Promise<void> {
  await setupModel('proc', cwd);
  await append(['user-task', 'Review'], cwd); // Activity_1, cursor → Activity_1
}

const INTERRUPTING_TYPES = ['timer', 'error', 'message', 'signal', 'escalation', 'cancel', 'conditional'];
const NON_INTERRUPTING_TYPES = [
  'non-interrupting-timer',
  'non-interrupting-message',
  'non-interrupting-signal',
  'non-interrupting-escalation',
  'non-interrupting-conditional',
];

for (const type of INTERRUPTING_TYPES) {
  test(`boundary-append ${type} creates interrupting boundary event`, async () => {
    const cwd = tmpDir();
    try {
      await setupWithTask(cwd);
      await boundaryAppend([type, 'My Boundary'], cwd);

      const status = await getStatus(cwd);
      const proc = status['process'] as Record<string, unknown>;
      const elements = proc['elements'] as Array<Record<string, unknown>>;
      const be = elements.find((e) => e['type'] === 'boundaryEvent');
      assert.ok(be, 'boundary event should exist');
      assert.equal(be['cancelActivity'], true, `${type} should be interrupting`);
      assert.equal(be['attachedToRef'], 'Activity_1');
      assert.equal(be['name'], 'My Boundary');
    } finally {
      cleanup(cwd);
    }
  });
}

for (const type of NON_INTERRUPTING_TYPES) {
  test(`boundary-append ${type} creates non-interrupting boundary event`, async () => {
    const cwd = tmpDir();
    try {
      await setupWithTask(cwd);
      await boundaryAppend([type, 'My Boundary'], cwd);

      const status = await getStatus(cwd);
      const proc = status['process'] as Record<string, unknown>;
      const elements = proc['elements'] as Array<Record<string, unknown>>;
      const be = elements.find((e) => e['type'] === 'boundaryEvent');
      assert.ok(be, 'boundary event should exist');
      assert.equal(be['cancelActivity'], false, `${type} should be non-interrupting`);
      assert.equal(be['attachedToRef'], 'Activity_1');
    } finally {
      cleanup(cwd);
    }
  });
}

test('boundary-append non-interrupting-compensation creates non-interrupting boundary event', async () => {
  const cwd = tmpDir();
  try {
    await setupWithTask(cwd);
    await boundaryAppend(['non-interrupting-compensation', 'Compensate'], cwd);

    const status = await getStatus(cwd);
    const proc = status['process'] as Record<string, unknown>;
    const elements = proc['elements'] as Array<Record<string, unknown>>;
    const be = elements.find((e) => e['type'] === 'boundaryEvent');
    assert.equal(be?.['cancelActivity'], false);
  } finally {
    cleanup(cwd);
  }
});

test('boundary-append moves cursor to new boundary event', async () => {
  const cwd = tmpDir();
  try {
    await setupWithTask(cwd);
    await boundaryAppend(['timer', 'Timeout'], cwd);
    const state = readState();
    assert.equal(state.cursor, 'BoundaryEvent_1');
  } finally {
    cleanup(cwd);
  }
});

test('boundary-append with explicit hostId attaches to specified element', async () => {
  const cwd = tmpDir();
  try {
    await setupWithTask(cwd); // Activity_1, cursor → Activity_1
    await append(['service-task', 'Execute'], cwd); // Activity_2, cursor → Activity_2
    await boundaryAppend(['timer', 'Timeout', 'Activity_1'], cwd); // attach to Activity_1

    const status = await getStatus(cwd);
    const proc = status['process'] as Record<string, unknown>;
    const elements = proc['elements'] as Array<Record<string, unknown>>;
    const be = elements.find((e) => e['type'] === 'boundaryEvent');
    assert.equal(be?.['attachedToRef'], 'Activity_1');
    // cursor moves to boundary event regardless
    const state = readState();
    assert.equal(state.cursor, 'BoundaryEvent_1');
  } finally {
    cleanup(cwd);
  }
});

test('boundary-append multiple boundary events on same host spread horizontally', async () => {
  const cwd = tmpDir();
  try {
    await setupWithTask(cwd);
    await boundaryAppend(['timer', 'Timeout'], cwd); // BoundaryEvent_1
    await boundaryAppend(['non-interrupting-message', 'Escalation', 'Activity_1'], cwd); // BoundaryEvent_2

    const status = await getStatus(cwd);
    const proc = status['process'] as Record<string, unknown>;
    const elements = proc['elements'] as Array<Record<string, unknown>>;
    const boundaryEvents = elements.filter((e) => e['type'] === 'boundaryEvent');
    assert.equal(boundaryEvents.length, 2);
    assert.ok(boundaryEvents.every((be) => be['attachedToRef'] === 'Activity_1'));
  } finally {
    cleanup(cwd);
  }
});

test('boundary-append throws when host is not an activity', async () => {
  const cwd = tmpDir();
  try {
    await setupModel('proc', cwd); // cursor on StartEvent_1
    await assert.rejects(
      () => boundaryAppend(['timer', 'Timeout'], cwd),
      /boundary events can only be attached to activities/,
    );
  } finally {
    cleanup(cwd);
  }
});

test('boundary-append throws for non-interrupting-error', async () => {
  const cwd = tmpDir();
  try {
    await setupWithTask(cwd);
    await assert.rejects(
      () => boundaryAppend(['non-interrupting-error', 'Err'], cwd),
      /always interrupting/,
    );
  } finally {
    cleanup(cwd);
  }
});

test('boundary-append throws for non-interrupting-cancel', async () => {
  const cwd = tmpDir();
  try {
    await setupWithTask(cwd);
    await assert.rejects(
      () => boundaryAppend(['non-interrupting-cancel', 'Cancel'], cwd),
      /always interrupting/,
    );
  } finally {
    cleanup(cwd);
  }
});

test('boundary-append throws for plain compensation (must use non-interrupting- prefix)', async () => {
  const cwd = tmpDir();
  try {
    await setupWithTask(cwd);
    await assert.rejects(
      () => boundaryAppend(['compensation', 'Comp'], cwd),
      /always non-interrupting/,
    );
  } finally {
    cleanup(cwd);
  }
});

test('boundary-append throws for unknown event type', async () => {
  const cwd = tmpDir();
  try {
    await setupWithTask(cwd);
    await assert.rejects(
      () => boundaryAppend(['unknownType', 'Event'], cwd),
      /Unknown boundary event type/,
    );
  } finally {
    cleanup(cwd);
  }
});

test('boundary-append treats unresolvable last token as part of label', async () => {
  const cwd = tmpDir();
  try {
    await setupWithTask(cwd);
    await boundaryAppend(['timer', 'Timeout Activity_99'], cwd);

    const status = await getStatus(cwd);
    const proc = status['process'] as Record<string, unknown>;
    const elements = proc['elements'] as Array<Record<string, unknown>>;
    const be = elements.find((e) => e['type'] === 'boundaryEvent');
    assert.equal(be?.['name'], 'Timeout Activity_99', 'unresolvable token should be part of label');
  } finally {
    cleanup(cwd);
  }
});

test('boundary-append appended flow from boundary event works', async () => {
  const cwd = tmpDir();
  try {
    await setupWithTask(cwd);
    await boundaryAppend(['timer', 'Timeout'], cwd); // BoundaryEvent_1, cursor → BoundaryEvent_1
    await append(['end-event', 'Timed Out'], cwd); // from BoundaryEvent_1

    const status = await getStatus(cwd);
    const proc = status['process'] as Record<string, unknown>;
    const flows = proc['flows'] as Array<Record<string, unknown>>;
    const flow = flows.find((f) => f['source'] === 'BoundaryEvent_1' && f['target'] === 'EndEvent_1');
    assert.ok(flow, 'flow from boundary event to end should exist');
  } finally {
    cleanup(cwd);
  }
});

// --- --id flag ---

test('boundary-append --id sets semantic element ID', async () => {
  const cwd = tmpDir();
  try {
    await setupWithTask(cwd);
    await boundaryAppend(['timer', 'Timeout', '--id', 'BoundaryEvent_Timeout'], cwd);

    const status = await getStatus(cwd);
    const proc = status['process'] as Record<string, unknown>;
    const elements = proc['elements'] as Array<Record<string, unknown>>;
    assert.ok(elements.find((e) => e['id'] === 'BoundaryEvent_Timeout'), 'semantic ID should exist');
    const state = readState(cwd);
    assert.equal(state.cursor, 'BoundaryEvent_Timeout');
  } finally {
    cleanup(cwd);
  }
});

test('boundary-append --id rejects invalid ID', async () => {
  const cwd = tmpDir();
  try {
    await setupWithTask(cwd);
    await assert.rejects(() => boundaryAppend(['timer', 'Timeout', '--id', '1bad'], cwd), /Invalid ID/);
  } finally {
    cleanup(cwd);
  }
});

test('boundary-append accepts semantic hostElementId', async () => {
  const cwd = tmpDir();
  try {
    await setupModel('proc', cwd);
    await append(['user-task', 'Review', '--id', 'ReviewTask'], cwd);
    await boundaryAppend(['timer', 'Timeout', 'ReviewTask'], cwd);

    const status = await getStatus(cwd);
    const proc = status['process'] as Record<string, unknown>;
    const elements = proc['elements'] as Array<Record<string, unknown>>;
    const be = elements.find((e) => e['type'] === 'boundaryEvent');
    assert.equal(be?.['attachedToRef'], 'ReviewTask', 'boundary event should be attached to semantic host ID');
  } finally {
    cleanup(cwd);
  }
});
