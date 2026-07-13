import { test } from 'node:test';
import assert from 'node:assert/strict';
import { create } from '../commands/create.js';
import { append } from '../commands/append.js';
import { select } from '../commands/select.js';
import { readState } from '../state.js';
import { loadFile } from '../bpmn.js';
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
      await append(['--boundary',type, 'My Boundary'], cwd);

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
      await append(['--boundary',type, 'My Boundary'], cwd);

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
    await append(['--boundary','non-interrupting-compensation', 'Compensate'], cwd);

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
    await append(['--boundary','timer', 'Timeout'], cwd);
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
    await append(['--boundary','timer', 'Timeout', 'Activity_1'], cwd); // attach to Activity_1

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
    await append(['--boundary','timer', 'Timeout'], cwd); // BoundaryEvent_1
    await append(['--boundary','non-interrupting-message', 'Escalation', 'Activity_1'], cwd); // BoundaryEvent_2

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
      () => append(['--boundary','timer', 'Timeout'], cwd),
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
      () => append(['--boundary','non-interrupting-error', 'Err'], cwd),
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
      () => append(['--boundary','non-interrupting-cancel', 'Cancel'], cwd),
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
      () => append(['--boundary','compensation', 'Comp'], cwd),
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
      () => append(['--boundary','unknownType', 'Event'], cwd),
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
    await append(['--boundary','timer', 'Timeout Activity_99'], cwd);

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
    await append(['--boundary','timer', 'Timeout'], cwd); // BoundaryEvent_1, cursor → BoundaryEvent_1
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
    await append(['--boundary','timer', 'Timeout', '--id', 'BoundaryEvent_Timeout'], cwd);

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
    await assert.rejects(() => append(['--boundary','timer', 'Timeout', '--id', '1bad'], cwd), /Invalid ID/);
  } finally {
    cleanup(cwd);
  }
});

test('boundary-append accepts semantic hostElementId', async () => {
  const cwd = tmpDir();
  try {
    await setupModel('proc', cwd);
    await append(['user-task', 'Review', '--id', 'ReviewTask'], cwd);
    await append(['--boundary','timer', 'Timeout', 'ReviewTask'], cwd);

    const status = await getStatus(cwd);
    const proc = status['process'] as Record<string, unknown>;
    const elements = proc['elements'] as Array<Record<string, unknown>>;
    const be = elements.find((e) => e['type'] === 'boundaryEvent');
    assert.equal(be?.['attachedToRef'], 'ReviewTask', 'boundary event should be attached to semantic host ID');
  } finally {
    cleanup(cwd);
  }
});

// --- nested host (inside subprocess / ad-hoc-subprocess) ---

test('boundary-append on nested host places event inside subprocess flowElements', async () => {
  const cwd = tmpDir();
  try {
    await setupModel('proc', cwd);
    await append(['sub-process', 'My Sub'], cwd); // Activity_1, cursor → Activity_1
    await create(['--parent', 'service-task', 'Tool A'], cwd); // Activity_2, cursor → Activity_2
    await append(['--boundary', 'error', 'Tool Error'], cwd); // BoundaryEvent_1, attached to Activity_2

    const status = await getStatus(cwd);
    const proc = status['process'] as Record<string, unknown>;
    const rootElements = proc['elements'] as Array<Record<string, unknown>>;

    // boundary event must NOT appear at root level
    assert.ok(!rootElements.some((e) => e['type'] === 'boundaryEvent'), 'boundary event should not be in root flowElements');

    // boundary event must appear inside the subprocess
    const sub = rootElements.find((e) => e['id'] === 'Activity_1');
    const children = sub?.['children'] as Array<Record<string, unknown>>;
    const be = children?.find((c) => c['type'] === 'boundaryEvent');
    assert.ok(be, 'boundary event should be in subprocess children');
    assert.equal(be?.['attachedToRef'], 'Activity_2');
  } finally {
    cleanup(cwd);
  }
});

test('boundary-append on nested host produces non-zero DI bounds', async () => {
  const cwd = tmpDir();
  try {
    await setupModel('proc', cwd);
    await append(['sub-process', 'My Sub'], cwd);
    await create(['--parent', 'service-task', 'Tool A'], cwd); // Activity_2
    await append(['--boundary', 'error', 'Tool Error'], cwd); // BoundaryEvent_1

    const state = readState();
    const { definitions } = await loadFile(state.file);
    const plane = definitions.diagrams?.[0]?.plane;
    const beShape = (plane?.planeElement ?? []).find((pe: Record<string, unknown>) => {
      const ref = pe['bpmnElement'] as Record<string, unknown> | string | undefined;
      const id = typeof ref === 'string' ? ref : ref?.['id'];
      return id === 'BoundaryEvent_1';
    });
    assert.ok(beShape, 'BoundaryEvent_1 DI shape should exist');
    const bounds = beShape['bounds'] as Record<string, unknown>;
    assert.ok(bounds, 'BoundaryEvent_1 should have bounds');
    assert.equal(typeof bounds['x'], 'number', 'bounds.x should be a number');
    assert.equal(typeof bounds['y'], 'number', 'bounds.y should be a number');
    assert.ok((bounds['x'] as number) !== 0 || (bounds['y'] as number) !== 0, 'boundary event should not be stuck at (0,0)');
  } finally {
    cleanup(cwd);
  }
});

test('boundary-append on nested host: select-parent reaches the subprocess', async () => {
  const cwd = tmpDir();
  try {
    await setupModel('proc', cwd);
    await append(['sub-process', 'My Sub'], cwd); // Activity_1
    await create(['--parent', 'service-task', 'Tool A'], cwd); // Activity_2
    await append(['--boundary', 'error', 'Tool Error'], cwd); // BoundaryEvent_1, cursor → BoundaryEvent_1

    await select(['--parent'], cwd);
    const state = readState();
    assert.equal(state.cursor, 'Activity_1', 'select-parent from nested boundary event should reach subprocess');
  } finally {
    cleanup(cwd);
  }
});
