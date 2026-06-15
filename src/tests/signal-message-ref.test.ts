import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { append } from '../commands/append.js';
import { create } from '../commands/create.js';
import { update } from '../commands/update.js';
import { cursorStatus } from '../commands/cursor-status.js';
import { readState } from '../state.js';
import { loadFile, getElementById } from '../bpmn.js';
import { tmpDir, cleanup, setupModel, getStatus } from './helpers.js';

// --- append with --signal-name ---

test('append signal-intermediate-throw-event with --signal-name creates signal ref', async () => {
  const cwd = tmpDir();
  try {
    await setupModel('proc', cwd);
    await append(['signal-intermediate-throw-event', 'Subscription activated', '--signal-name', 'subscriptionActivated'], cwd);

    const status = await getStatus(cwd);
    const proc = status['process'] as Record<string, unknown>;
    const elements = proc['elements'] as Array<Record<string, unknown>>;
    const el = elements.find((e) => e['name'] === 'Subscription activated');
    assert.ok(el, 'element should exist');
    assert.equal(el['type'], 'intermediateThrowEvent');
    const evDef = el['eventDefinition'] as Record<string, unknown>;
    assert.equal(evDef['type'], 'signal');
    assert.equal(evDef['signalRef'], 'subscriptionActivated');
  } finally {
    cleanup(cwd);
  }
});

test('append signal-intermediate-throw-event with --signal-name declares bpmn:Signal in XML', async () => {
  const cwd = tmpDir();
  try {
    await setupModel('proc', cwd);
    await append(['signal-intermediate-throw-event', 'Notify', '--signal-name', 'mySignal'], cwd);

    const state = readState();
    const xml = readFileSync(state.file, 'utf-8');
    assert.ok(xml.includes('<bpmn:signal '), 'should declare bpmn:signal element');
    assert.ok(xml.includes('name="mySignal"'), 'signal name should appear');
  } finally {
    cleanup(cwd);
  }
});

test('append message-intermediate-catch-event with --message-name creates message ref', async () => {
  const cwd = tmpDir();
  try {
    await setupModel('proc', cwd);
    await append(['message-intermediate-catch-event', 'Await Payment', '--message-name', 'paymentReceived'], cwd);

    const status = await getStatus(cwd);
    const proc = status['process'] as Record<string, unknown>;
    const elements = proc['elements'] as Array<Record<string, unknown>>;
    const el = elements.find((e) => e['name'] === 'Await Payment');
    assert.ok(el, 'element should exist');
    const evDef = el['eventDefinition'] as Record<string, unknown>;
    assert.equal(evDef['type'], 'message');
    assert.equal(evDef['messageRef'], 'paymentReceived');
  } finally {
    cleanup(cwd);
  }
});

test('append signal-intermediate-catch-event with --signal-name creates signal ref', async () => {
  const cwd = tmpDir();
  try {
    await setupModel('proc', cwd);
    await append(['signal-intermediate-catch-event', 'Wait Signal', '--signal-name', 'mySignal'], cwd);

    const status = await getStatus(cwd);
    const proc = status['process'] as Record<string, unknown>;
    const elements = proc['elements'] as Array<Record<string, unknown>>;
    const el = elements.find((e) => e['name'] === 'Wait Signal');
    assert.ok(el, 'element should exist');
    const evDef = el['eventDefinition'] as Record<string, unknown>;
    assert.equal(evDef['type'], 'signal');
    assert.equal(evDef['signalRef'], 'mySignal');
  } finally {
    cleanup(cwd);
  }
});

test('append reuses existing bpmn:Signal when appending twice with same signal name', async () => {
  const cwd = tmpDir();
  try {
    await setupModel('proc', cwd);
    await append(['signal-intermediate-throw-event', 'Throw 1', '--signal-name', 'mySignal'], cwd);
    await append(['signal-intermediate-catch-event', 'Catch 1', '--signal-name', 'mySignal', 'StartEvent_1'], cwd);

    const state = readState();
    const xml = readFileSync(state.file, 'utf-8');
    const matches = xml.match(/id="Signal_mySignal"/g);
    assert.equal(matches?.length, 1, 'should only declare one bpmn:Signal for the same name');
  } finally {
    cleanup(cwd);
  }
});

// --- create with --signal-name / --message-name ---

test('create signal-start-event with --signal-name creates signal ref', async () => {
  const cwd = tmpDir();
  try {
    await setupModel('proc', cwd);
    await create(['signal-start-event', 'On Signal', '--signal-name', 'startSig'], cwd);

    const status = await getStatus(cwd);
    const proc = status['process'] as Record<string, unknown>;
    const elements = proc['elements'] as Array<Record<string, unknown>>;
    const el = elements.find((e) => e['name'] === 'On Signal');
    assert.ok(el, 'element should exist');
    const evDef = el['eventDefinition'] as Record<string, unknown>;
    assert.equal(evDef['type'], 'signal');
    assert.equal(evDef['signalRef'], 'startSig');
  } finally {
    cleanup(cwd);
  }
});

test('create message-end-event with --message-name creates message ref', async () => {
  const cwd = tmpDir();
  try {
    await setupModel('proc', cwd);
    await create(['message-end-event', 'Send Confirmation', '--message-name', 'confirmOrder'], cwd);

    const status = await getStatus(cwd);
    const proc = status['process'] as Record<string, unknown>;
    const elements = proc['elements'] as Array<Record<string, unknown>>;
    const el = elements.find((e) => e['name'] === 'Send Confirmation');
    assert.ok(el, 'element should exist');
    const evDef = el['eventDefinition'] as Record<string, unknown>;
    assert.equal(evDef['type'], 'message');
    assert.equal(evDef['messageRef'], 'confirmOrder');
  } finally {
    cleanup(cwd);
  }
});

// --- update signalRef ---

test('update signalRef sets signal reference on existing signal event', async () => {
  const cwd = tmpDir();
  try {
    await setupModel('proc', cwd);
    await append(['signal-intermediate-throw-event', 'Throw'], cwd); // Event_1

    await update(['signalRef', 'subscriptionActivated'], cwd);

    const status = await getStatus(cwd);
    const proc = status['process'] as Record<string, unknown>;
    const elements = proc['elements'] as Array<Record<string, unknown>>;
    const el = elements.find((e) => e['name'] === 'Throw');
    const evDef = el?.['eventDefinition'] as Record<string, unknown>;
    assert.equal(evDef['signalRef'], 'subscriptionActivated');
  } finally {
    cleanup(cwd);
  }
});

test('update signalRef auto-declares bpmn:Signal at definitions level', async () => {
  const cwd = tmpDir();
  try {
    await setupModel('proc', cwd);
    await append(['signal-intermediate-throw-event', 'Throw'], cwd);

    await update(['signalRef', 'myNewSignal'], cwd);

    const state = readState();
    const xml = readFileSync(state.file, 'utf-8');
    assert.ok(xml.includes('name="myNewSignal"'), 'signal should be declared');
  } finally {
    cleanup(cwd);
  }
});

test('update signalRef with explicit element ID', async () => {
  const cwd = tmpDir();
  try {
    await setupModel('proc', cwd);
    await append(['signal-intermediate-throw-event', 'Throw'], cwd); // Event_1
    await append(['end-event', 'End'], cwd); // cursor moves to EndEvent_1

    await update(['Event_1', 'signalRef', 'explicitSig'], cwd);

    const state = readState();
    const { definitions } = await loadFile(state.file);
    const el = getElementById(definitions, 'Event_1');
    assert.ok(el);
    const sigDef = el.eventDefinitions[0];
    assert.equal(sigDef.signalRef.name, 'explicitSig');
  } finally {
    cleanup(cwd);
  }
});

test('update signalRef throws on element without signal event definition', async () => {
  const cwd = tmpDir();
  try {
    await setupModel('proc', cwd);
    await append(['user-task', 'Review'], cwd);
    await assert.rejects(
      () => update(['signalRef', 'someSignal'], cwd),
      /does not have a signal event definition/,
    );
  } finally {
    cleanup(cwd);
  }
});

// --- update messageRef ---

test('update messageRef sets message reference on existing message event', async () => {
  const cwd = tmpDir();
  try {
    await setupModel('proc', cwd);
    await append(['message-intermediate-catch-event', 'Wait'], cwd); // Event_1

    await update(['messageRef', 'orderConfirmed'], cwd);

    const status = await getStatus(cwd);
    const proc = status['process'] as Record<string, unknown>;
    const elements = proc['elements'] as Array<Record<string, unknown>>;
    const el = elements.find((e) => e['name'] === 'Wait');
    const evDef = el?.['eventDefinition'] as Record<string, unknown>;
    assert.equal(evDef['messageRef'], 'orderConfirmed');
  } finally {
    cleanup(cwd);
  }
});

test('update messageRef auto-declares bpmn:Message at definitions level', async () => {
  const cwd = tmpDir();
  try {
    await setupModel('proc', cwd);
    await append(['message-intermediate-catch-event', 'Wait'], cwd);

    await update(['messageRef', 'myNewMessage'], cwd);

    const state = readState();
    const xml = readFileSync(state.file, 'utf-8');
    assert.ok(xml.includes('name="myNewMessage"'), 'message should be declared');
  } finally {
    cleanup(cwd);
  }
});

test('update messageRef throws on element without message event definition', async () => {
  const cwd = tmpDir();
  try {
    await setupModel('proc', cwd);
    await append(['timer-intermediate-catch-event', 'Wait'], cwd);
    await assert.rejects(
      () => update(['messageRef', 'someMessage'], cwd),
      /does not have a message event definition/,
    );
  } finally {
    cleanup(cwd);
  }
});

// --- cursor-status includes eventDefinition ---

test('cursor-status includes eventDefinition for signal event with ref', async () => {
  const cwd = tmpDir();
  try {
    await setupModel('proc', cwd);
    await append(['signal-intermediate-throw-event', 'Throw', '--signal-name', 'mySig'], cwd);

    const logs: Record<string, unknown>[] = [];
    const logger = { json: (obj: Record<string, unknown>) => { logs.push(obj); } } as any;
    await cursorStatus([], cwd, logger);

    assert.equal(logs.length, 1);
    const result = logs[0];
    const evDef = result['eventDefinition'] as Record<string, unknown>;
    assert.equal(evDef['type'], 'signal');
    assert.equal(evDef['signalRef'], 'mySig');
  } finally {
    cleanup(cwd);
  }
});

test('cursor-status includes eventDefinition for message event with ref', async () => {
  const cwd = tmpDir();
  try {
    await setupModel('proc', cwd);
    await append(['message-intermediate-catch-event', 'Wait', '--message-name', 'myMsg'], cwd);

    const logs: Record<string, unknown>[] = [];
    const logger = { json: (obj: Record<string, unknown>) => { logs.push(obj); } } as any;
    await cursorStatus([], cwd, logger);

    assert.equal(logs.length, 1);
    const result = logs[0];
    const evDef = result['eventDefinition'] as Record<string, unknown>;
    assert.equal(evDef['type'], 'message');
    assert.equal(evDef['messageRef'], 'myMsg');
  } finally {
    cleanup(cwd);
  }
});

test('cursor-status omits eventDefinition for non-event elements', async () => {
  const cwd = tmpDir();
  try {
    await setupModel('proc', cwd);
    await append(['user-task', 'Review'], cwd);

    const logs: Record<string, unknown>[] = [];
    const logger = { json: (obj: Record<string, unknown>) => { logs.push(obj); } } as any;
    await cursorStatus([], cwd, logger);

    const result = logs[0];
    assert.equal(result['eventDefinition'], undefined);
  } finally {
    cleanup(cwd);
  }
});

// --- status output with event definitions ---

test('status eventDefinition is an object with type field', async () => {
  const cwd = tmpDir();
  try {
    await setupModel('proc', cwd);
    await append(['timer-intermediate-catch-event', 'Timer'], cwd);

    const status = await getStatus(cwd);
    const proc = status['process'] as Record<string, unknown>;
    const elements = proc['elements'] as Array<Record<string, unknown>>;
    const el = elements.find((e) => e['name'] === 'Timer');
    const evDef = el?.['eventDefinition'] as Record<string, unknown>;
    assert.equal(typeof evDef, 'object');
    assert.equal(evDef['type'], 'timer');
  } finally {
    cleanup(cwd);
  }
});

// --- end-to-end: signal throw → signal catch pattern ---

test('end-to-end: signal throw and catch share same signalRef', async () => {
  const cwd = tmpDir();
  try {
    await setupModel('proc', cwd);
    await append(['signal-intermediate-throw-event', 'Throw Signal', '--signal-name', 'orderShipped'], cwd);
    await create(['signal-intermediate-catch-event', 'Catch Signal', '--signal-name', 'orderShipped'], cwd);

    const status = await getStatus(cwd);
    const proc = status['process'] as Record<string, unknown>;
    const elements = proc['elements'] as Array<Record<string, unknown>>;

    const throwEl = elements.find((e) => e['name'] === 'Throw Signal');
    const catchEl = elements.find((e) => e['name'] === 'Catch Signal');

    const throwDef = throwEl?.['eventDefinition'] as Record<string, unknown>;
    const catchDef = catchEl?.['eventDefinition'] as Record<string, unknown>;

    assert.equal(throwDef['signalRef'], 'orderShipped');
    assert.equal(catchDef['signalRef'], 'orderShipped');
  } finally {
    cleanup(cwd);
  }
});

// --- ID sanitization ---

test('signal name with spaces is sanitized in XML id attribute', async () => {
  const cwd = tmpDir();
  try {
    await setupModel('proc', cwd);
    await append(['signal-intermediate-throw-event', 'Notify', '--signal-name', 'my signal name'], cwd);

    const state = readState();
    const xml = readFileSync(state.file, 'utf-8');
    assert.ok(xml.includes('id="Signal_my_signal_name"'), 'id should have spaces replaced with underscores');
    assert.ok(xml.includes('name="my signal name"'), 'name attribute should preserve original value');
  } finally {
    cleanup(cwd);
  }
});

test('message name with special chars is sanitized in XML id attribute', async () => {
  const cwd = tmpDir();
  try {
    await setupModel('proc', cwd);
    await append(['message-intermediate-catch-event', 'Wait', '--message-name', 'order:confirmed!'], cwd);

    const state = readState();
    const xml = readFileSync(state.file, 'utf-8');
    assert.ok(xml.includes('id="Message_order_confirmed_"'), 'id should have invalid chars replaced');
    assert.ok(xml.includes('name="order:confirmed!"'), 'name attribute should preserve original value');
  } finally {
    cleanup(cwd);
  }
});

// --- flag/event-type mismatch validation ---

test('--signal-name on message event throws clear error', async () => {
  const cwd = tmpDir();
  try {
    await setupModel('proc', cwd);
    await assert.rejects(
      () => append(['message-intermediate-catch-event', 'Wait', '--signal-name', 'badSignal'], cwd),
      /--signal-name can only be used with signal events/,
    );
  } finally {
    cleanup(cwd);
  }
});

test('--message-name on signal event throws clear error', async () => {
  const cwd = tmpDir();
  try {
    await setupModel('proc', cwd);
    await assert.rejects(
      () => append(['signal-intermediate-throw-event', 'Throw', '--message-name', 'badMessage'], cwd),
      /--message-name can only be used with message events/,
    );
  } finally {
    cleanup(cwd);
  }
});

test('--signal-name on timer event throws clear error', async () => {
  const cwd = tmpDir();
  try {
    await setupModel('proc', cwd);
    await assert.rejects(
      () => append(['timer-intermediate-catch-event', 'Wait', '--signal-name', 'badSignal'], cwd),
      /--signal-name can only be used with signal events/,
    );
  } finally {
    cleanup(cwd);
  }
});

test('--signal-name without value throws clear error', async () => {
  const cwd = tmpDir();
  try {
    await setupModel('proc', cwd);
    await assert.rejects(
      () => append(['signal-intermediate-throw-event', 'Throw', '--signal-name'], cwd),
      /--signal-name requires a value/,
    );
  } finally {
    cleanup(cwd);
  }
});

test('--message-name without value throws clear error', async () => {
  const cwd = tmpDir();
  try {
    await setupModel('proc', cwd);
    await assert.rejects(
      () => append(['message-intermediate-catch-event', 'Wait', '--message-name'], cwd),
      /--message-name requires a value/,
    );
  } finally {
    cleanup(cwd);
  }
});
