import { test } from 'node:test';
import assert from 'node:assert/strict';
import { document } from '../commands/document.js';
import { append } from '../commands/append.js';
import { readState } from '../state.js';
import { tmpDir, cleanup, setupModel, getStatus } from './helpers.js';

test('document sets documentation on cursor element', async () => {
  const cwd = tmpDir();
  try {
    await setupModel('proc', cwd);

    await document(['Reviewer must approve within 24h'], cwd);

    const status = await getStatus(cwd);
    const proc = status['process'] as Record<string, unknown>;
    const elements = proc['elements'] as Array<Record<string, unknown>>;
    const startEvent = elements.find((e) => e['id'] === 'StartEvent_1');
    assert.ok(startEvent, 'start event should exist');
    const doc = startEvent['documentation'] as Record<string, unknown>;
    assert.ok(doc, 'documentation should be set');
    assert.equal(doc['text'], 'Reviewer must approve within 24h');
  } finally {
    cleanup(cwd);
  }
});

test('document sets documentation on specified element', async () => {
  const cwd = tmpDir();
  try {
    await setupModel('proc', cwd);
    await append(['user-task', 'Review'], cwd);

    await document(['Check the receipt', 'StartEvent_1'], cwd);

    const status = await getStatus(cwd);
    const proc = status['process'] as Record<string, unknown>;
    const elements = proc['elements'] as Array<Record<string, unknown>>;
    const startEvent = elements.find((e) => e['id'] === 'StartEvent_1');
    assert.ok(startEvent, 'start event should exist');
    const doc = startEvent['documentation'] as Record<string, unknown>;
    assert.ok(doc, 'documentation should be set on StartEvent_1');
    assert.equal(doc['text'], 'Check the receipt');
  } finally {
    cleanup(cwd);
  }
});

test('document replaces existing documentation (idempotent)', async () => {
  const cwd = tmpDir();
  try {
    await setupModel('proc', cwd);

    await document(['Original text'], cwd);
    await document(['Updated text'], cwd);

    const status = await getStatus(cwd);
    const proc = status['process'] as Record<string, unknown>;
    const elements = proc['elements'] as Array<Record<string, unknown>>;
    const startEvent = elements.find((e) => e['id'] === 'StartEvent_1');
    assert.ok(startEvent, 'start event should exist');
    const doc = startEvent['documentation'] as Record<string, unknown>;
    assert.ok(doc, 'documentation should be set');
    assert.equal(doc['text'], 'Updated text');
  } finally {
    cleanup(cwd);
  }
});

test('document sets textFormat when --format is provided', async () => {
  const cwd = tmpDir();
  try {
    await setupModel('proc', cwd);

    await document(['**Important**', '--format', 'text/markdown'], cwd);

    const status = await getStatus(cwd);
    const proc = status['process'] as Record<string, unknown>;
    const elements = proc['elements'] as Array<Record<string, unknown>>;
    const startEvent = elements.find((e) => e['id'] === 'StartEvent_1');
    assert.ok(startEvent, 'start event should exist');
    const doc = startEvent['documentation'] as Record<string, unknown>;
    assert.ok(doc, 'documentation should be set');
    assert.equal(doc['text'], '**Important**');
    assert.equal(doc['textFormat'], 'text/markdown');
  } finally {
    cleanup(cwd);
  }
});

test('document does not move cursor', async () => {
  const cwd = tmpDir();
  try {
    await setupModel('proc', cwd);
    await append(['user-task', 'Review'], cwd);
    const stateBefore = readState(cwd);

    await document(['Some docstring'], cwd);

    const stateAfter = readState(cwd);
    assert.equal(stateAfter.cursor, stateBefore.cursor, 'cursor must not move');
  } finally {
    cleanup(cwd);
  }
});

test('document throws when element not found', async () => {
  const cwd = tmpDir();
  try {
    await setupModel('proc', cwd);
    await assert.rejects(() => document(['some text', 'Activity_99'], cwd), /not found/);
  } finally {
    cleanup(cwd);
  }
});

test('document throws without required arguments', async () => {
  const cwd = tmpDir();
  try {
    await setupModel('proc', cwd);
    await assert.rejects(() => document([], cwd), /Usage/);
  } finally {
    cleanup(cwd);
  }
});

test('document clears textFormat when updating without --format', async () => {
  const cwd = tmpDir();
  try {
    await setupModel('proc', cwd);

    await document(['**Important**', '--format', 'text/markdown'], cwd);
    await document(['Plain text now'], cwd);

    const status = await getStatus(cwd);
    const proc = status['process'] as Record<string, unknown>;
    const elements = proc['elements'] as Array<Record<string, unknown>>;
    const startEvent = elements.find((e) => e['id'] === 'StartEvent_1');
    assert.ok(startEvent, 'start event should exist');
    const doc = startEvent['documentation'] as Record<string, unknown>;
    assert.ok(doc, 'documentation should be set');
    assert.equal(doc['text'], 'Plain text now');
    assert.equal(doc['textFormat'], undefined, 'textFormat should be cleared when not provided');
  } finally {
    cleanup(cwd);
  }
});

test('document omits text/plain textFormat from status output', async () => {
  const cwd = tmpDir();
  try {
    await setupModel('proc', cwd);

    await document(['Some text', '--format', 'text/plain'], cwd);

    const status = await getStatus(cwd);
    const proc = status['process'] as Record<string, unknown>;
    const elements = proc['elements'] as Array<Record<string, unknown>>;
    const startEvent = elements.find((e) => e['id'] === 'StartEvent_1');
    assert.ok(startEvent, 'start event should exist');
    const doc = startEvent['documentation'] as Record<string, unknown>;
    assert.ok(doc, 'documentation should be set');
    assert.equal(doc['text'], 'Some text');
    assert.equal(doc['textFormat'], undefined, 'text/plain textFormat should be omitted from status output');
  } finally {
    cleanup(cwd);
  }
});

test('document accepts --format flag before text argument', async () => {
  const cwd = tmpDir();
  try {
    await setupModel('proc', cwd);

    await document(['--format', 'text/markdown', '**Bold**'], cwd);

    const status = await getStatus(cwd);
    const proc = status['process'] as Record<string, unknown>;
    const elements = proc['elements'] as Array<Record<string, unknown>>;
    const startEvent = elements.find((e) => e['id'] === 'StartEvent_1');
    assert.ok(startEvent, 'start event should exist');
    const doc = startEvent['documentation'] as Record<string, unknown>;
    assert.ok(doc, 'documentation should be set');
    assert.equal(doc['text'], '**Bold**');
    assert.equal(doc['textFormat'], 'text/markdown');
  } finally {
    cleanup(cwd);
  }
});

test('document sets documentation on a non-start-event element via cursor', async () => {
  const cwd = tmpDir();
  try {
    await setupModel('proc', cwd);
    await append(['user-task', 'Review'], cwd);
    const state = readState(cwd);
    const userTaskId = state.cursor;

    await document(['Complete within SLA'], cwd);

    const status = await getStatus(cwd);
    const proc = status['process'] as Record<string, unknown>;
    const elements = proc['elements'] as Array<Record<string, unknown>>;
    const userTask = elements.find((e) => e['id'] === userTaskId);
    assert.ok(userTask, 'user task should exist');
    const doc = userTask['documentation'] as Record<string, unknown>;
    assert.ok(doc, 'documentation should be set on user task');
    assert.equal(doc['text'], 'Complete within SLA');
  } finally {
    cleanup(cwd);
  }
});
