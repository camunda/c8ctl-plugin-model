import { test } from 'node:test';
import assert from 'node:assert/strict';
import { append } from '../commands/append.js';
import { boundaryAppend } from '../commands/boundary-append.js';
import { create } from '../commands/create.js';
import { update } from '../commands/update.js';
import { tmpDir, cleanup, setupModel, getStatus } from './helpers.js';

async function setupWithTask(cwd: string): Promise<void> {
  await setupModel('proc', cwd);
  await append(['user-task', 'Review'], cwd); // Activity_1
}

async function setupWithGateway(cwd: string): Promise<void> {
  await setupModel('proc', cwd);
  await append(['exclusive-gateway', 'Decision'], cwd); // Gateway_1
}

async function setupWithEndEvent(cwd: string): Promise<void> {
  await setupModel('proc', cwd);
  await append(['end-event', 'End'], cwd); // EndEvent_1
}

async function setupWithSubProcess(cwd: string): Promise<void> {
  await setupModel('proc', cwd);
  await append(['sub-process', 'Sub'], cwd); // Activity_1
}

async function setupWithCallActivity(cwd: string): Promise<void> {
  await setupModel('proc', cwd);
  await append(['call-activity', 'Call'], cwd); // Activity_1
}

async function setupWithAdHoc(cwd: string): Promise<void> {
  await setupModel('proc', cwd);
  await append(['ad-hoc-sub-process', 'Ad Hoc'], cwd); // Activity_1
}

test('update name on cursor element', async () => {
  const cwd = tmpDir();
  try {
    await setupWithTask(cwd);
    await update(['name', 'Updated Name'], cwd);

    const status = await getStatus(cwd);
    const proc = status['process'] as Record<string, unknown>;
    const elements = proc['elements'] as Array<Record<string, unknown>>;
    const el = elements.find((e) => e['id'] === 'Activity_1');
    assert.equal(el?.['name'], 'Updated Name');
  } finally {
    cleanup(cwd);
  }
});

test('update name with explicit elementId', async () => {
  const cwd = tmpDir();
  try {
    await setupWithTask(cwd);
    await append(['service-task', 'Execute'], cwd); // Activity_2, cursor → Activity_2
    await update(['Activity_1', 'name', 'Renamed'], cwd); // target Activity_1 explicitly

    const status = await getStatus(cwd);
    const proc = status['process'] as Record<string, unknown>;
    const elements = proc['elements'] as Array<Record<string, unknown>>;
    const el = elements.find((e) => e['id'] === 'Activity_1');
    assert.equal(el?.['name'], 'Renamed');
  } finally {
    cleanup(cwd);
  }
});

test('update zeebe:taskDefinition.type', async () => {
  const cwd = tmpDir();
  try {
    await setupWithTask(cwd);
    await update(['zeebe:taskDefinition.type', 'my-job-type'], cwd);

    const status = await getStatus(cwd);
    const proc = status['process'] as Record<string, unknown>;
    const elements = proc['elements'] as Array<Record<string, unknown>>;
    const el = elements.find((e) => e['id'] === 'Activity_1');
    const zeebe = el?.['zeebe'] as Record<string, unknown>;
    const td = zeebe?.['taskDefinition'] as Record<string, unknown>;
    assert.equal(td?.['type'], 'my-job-type');
  } finally {
    cleanup(cwd);
  }
});

test('update zeebe:taskDefinition.retries', async () => {
  const cwd = tmpDir();
  try {
    await setupWithTask(cwd);
    await update(['zeebe:taskDefinition.retries', '5'], cwd);

    const status = await getStatus(cwd);
    const proc = status['process'] as Record<string, unknown>;
    const elements = proc['elements'] as Array<Record<string, unknown>>;
    const el = elements.find((e) => e['id'] === 'Activity_1');
    const zeebe = el?.['zeebe'] as Record<string, unknown>;
    const td = zeebe?.['taskDefinition'] as Record<string, unknown>;
    assert.equal(td?.['retries'], '5');
  } finally {
    cleanup(cwd);
  }
});

test('update zeebe:input adds new input mapping', async () => {
  const cwd = tmpDir();
  try {
    await setupWithTask(cwd);
    await update(['zeebe:input', '=vars.x', 'localX'], cwd);

    const status = await getStatus(cwd);
    const proc = status['process'] as Record<string, unknown>;
    const elements = proc['elements'] as Array<Record<string, unknown>>;
    const el = elements.find((e) => e['id'] === 'Activity_1');
    const zeebe = el?.['zeebe'] as Record<string, unknown>;
    const ioMapping = zeebe?.['ioMapping'] as Record<string, unknown>;
    const inputs = ioMapping?.['inputs'] as Array<Record<string, unknown>>;
    const input = inputs?.find((i) => i['target'] === 'localX');
    assert.ok(input, 'input mapping should exist');
    assert.equal(input['source'], '=vars.x');
  } finally {
    cleanup(cwd);
  }
});

test('update zeebe:input updates existing mapping by target', async () => {
  const cwd = tmpDir();
  try {
    await setupWithTask(cwd);
    await update(['zeebe:input', '=vars.x', 'localX'], cwd);
    await update(['zeebe:input', '=vars.y', 'localX'], cwd); // update same target

    const status = await getStatus(cwd);
    const proc = status['process'] as Record<string, unknown>;
    const elements = proc['elements'] as Array<Record<string, unknown>>;
    const el = elements.find((e) => e['id'] === 'Activity_1');
    const zeebe = el?.['zeebe'] as Record<string, unknown>;
    const ioMapping = zeebe?.['ioMapping'] as Record<string, unknown>;
    const inputs = ioMapping?.['inputs'] as Array<Record<string, unknown>>;
    const matching = inputs?.filter((i) => i['target'] === 'localX');
    assert.equal(matching?.length, 1, 'should not duplicate');
    assert.equal(matching?.[0]?.['source'], '=vars.y');
  } finally {
    cleanup(cwd);
  }
});

test('update zeebe:output adds new output mapping', async () => {
  const cwd = tmpDir();
  try {
    await setupWithTask(cwd);
    await update(['zeebe:output', '=result', 'output'], cwd);

    const status = await getStatus(cwd);
    const proc = status['process'] as Record<string, unknown>;
    const elements = proc['elements'] as Array<Record<string, unknown>>;
    const el = elements.find((e) => e['id'] === 'Activity_1');
    const zeebe = el?.['zeebe'] as Record<string, unknown>;
    const ioMapping = zeebe?.['ioMapping'] as Record<string, unknown>;
    const outputs = ioMapping?.['outputs'] as Array<Record<string, unknown>>;
    const out = outputs?.find((o) => o['source'] === '=result');
    assert.ok(out, 'output mapping should exist');
    assert.equal(out['target'], 'output');
  } finally {
    cleanup(cwd);
  }
});

test('update zeebe:output updates existing mapping by source', async () => {
  const cwd = tmpDir();
  try {
    await setupWithTask(cwd);
    await update(['zeebe:output', '=result', 'outA'], cwd);
    await update(['zeebe:output', '=result', 'outB'], cwd); // update same source

    const status = await getStatus(cwd);
    const proc = status['process'] as Record<string, unknown>;
    const elements = proc['elements'] as Array<Record<string, unknown>>;
    const el = elements.find((e) => e['id'] === 'Activity_1');
    const zeebe = el?.['zeebe'] as Record<string, unknown>;
    const ioMapping = zeebe?.['ioMapping'] as Record<string, unknown>;
    const outputs = ioMapping?.['outputs'] as Array<Record<string, unknown>>;
    const matching = outputs?.filter((o) => o['source'] === '=result');
    assert.equal(matching?.length, 1, 'should not duplicate');
    assert.equal(matching?.[0]?.['target'], 'outB');
  } finally {
    cleanup(cwd);
  }
});

test('update zeebe:header adds new task header', async () => {
  const cwd = tmpDir();
  try {
    await setupWithTask(cwd);
    await update(['zeebe:header', 'timeout', '30s'], cwd);

    const status = await getStatus(cwd);
    const proc = status['process'] as Record<string, unknown>;
    const elements = proc['elements'] as Array<Record<string, unknown>>;
    const el = elements.find((e) => e['id'] === 'Activity_1');
    const zeebe = el?.['zeebe'] as Record<string, unknown>;
    const headers = zeebe?.['taskHeaders'] as Array<Record<string, unknown>>;
    const header = headers?.find((h) => h['key'] === 'timeout');
    assert.ok(header, 'task header should exist');
    assert.equal(header['value'], '30s');
  } finally {
    cleanup(cwd);
  }
});

test('update zeebe:header updates existing header by key', async () => {
  const cwd = tmpDir();
  try {
    await setupWithTask(cwd);
    await update(['zeebe:header', 'timeout', '30s'], cwd);
    await update(['zeebe:header', 'timeout', '60s'], cwd);

    const status = await getStatus(cwd);
    const proc = status['process'] as Record<string, unknown>;
    const elements = proc['elements'] as Array<Record<string, unknown>>;
    const el = elements.find((e) => e['id'] === 'Activity_1');
    const zeebe = el?.['zeebe'] as Record<string, unknown>;
    const headers = zeebe?.['taskHeaders'] as Array<Record<string, unknown>>;
    const matching = headers?.filter((h) => h['key'] === 'timeout');
    assert.equal(matching?.length, 1, 'should not duplicate');
    assert.equal(matching?.[0]?.['value'], '60s');
  } finally {
    cleanup(cwd);
  }
});

test('update zeebe:property adds new zeebe property', async () => {
  const cwd = tmpDir();
  try {
    await setupWithTask(cwd);
    await update(['zeebe:property', 'customProp', 'someValue'], cwd);

    const status = await getStatus(cwd);
    const proc = status['process'] as Record<string, unknown>;
    const elements = proc['elements'] as Array<Record<string, unknown>>;
    const el = elements.find((e) => e['id'] === 'Activity_1');
    const zeebe = el?.['zeebe'] as Record<string, unknown>;
    const props = zeebe?.['properties'] as Array<Record<string, unknown>>;
    const prop = props?.find((p) => p['name'] === 'customProp');
    assert.ok(prop, 'zeebe property should exist');
    assert.equal(prop['value'], 'someValue');
  } finally {
    cleanup(cwd);
  }
});

test('update zeebe:property updates existing property by name', async () => {
  const cwd = tmpDir();
  try {
    await setupWithTask(cwd);
    await update(['zeebe:property', 'customProp', 'v1'], cwd);
    await update(['zeebe:property', 'customProp', 'v2'], cwd);

    const status = await getStatus(cwd);
    const proc = status['process'] as Record<string, unknown>;
    const elements = proc['elements'] as Array<Record<string, unknown>>;
    const el = elements.find((e) => e['id'] === 'Activity_1');
    const zeebe = el?.['zeebe'] as Record<string, unknown>;
    const props = zeebe?.['properties'] as Array<Record<string, unknown>>;
    const matching = props?.filter((p) => p['name'] === 'customProp');
    assert.equal(matching?.length, 1, 'should not duplicate');
    assert.equal(matching?.[0]?.['value'], 'v2');
  } finally {
    cleanup(cwd);
  }
});

test('update multi-instance.type parallel sets parallel loop characteristics', async () => {
  const cwd = tmpDir();
  try {
    await setupWithTask(cwd);
    await update(['multi-instance.type', 'parallel'], cwd);

    const status = await getStatus(cwd);
    const proc = status['process'] as Record<string, unknown>;
    const elements = proc['elements'] as Array<Record<string, unknown>>;
    const el = elements.find((e) => e['id'] === 'Activity_1');
    const lc = el?.['loopCharacteristics'] as Record<string, unknown>;
    assert.equal(lc?.['type'], 'multiInstance');
    assert.equal(lc?.['isSequential'], false);
  } finally {
    cleanup(cwd);
  }
});

test('update multi-instance.type sequential sets sequential loop characteristics', async () => {
  const cwd = tmpDir();
  try {
    await setupWithTask(cwd);
    await update(['multi-instance.type', 'sequential'], cwd);

    const status = await getStatus(cwd);
    const proc = status['process'] as Record<string, unknown>;
    const elements = proc['elements'] as Array<Record<string, unknown>>;
    const el = elements.find((e) => e['id'] === 'Activity_1');
    const lc = el?.['loopCharacteristics'] as Record<string, unknown>;
    assert.equal(lc?.['type'], 'multiInstance');
    assert.equal(lc?.['isSequential'], true);
  } finally {
    cleanup(cwd);
  }
});

test('update multi-instance.type can switch between parallel and sequential', async () => {
  const cwd = tmpDir();
  try {
    await setupWithTask(cwd);
    await update(['multi-instance.type', 'parallel'], cwd);
    await update(['multi-instance.type', 'sequential'], cwd);

    const status = await getStatus(cwd);
    const proc = status['process'] as Record<string, unknown>;
    const elements = proc['elements'] as Array<Record<string, unknown>>;
    const el = elements.find((e) => e['id'] === 'Activity_1');
    const lc = el?.['loopCharacteristics'] as Record<string, unknown>;
    assert.equal(lc?.['isSequential'], true);
  } finally {
    cleanup(cwd);
  }
});

test('update multi-instance.type throws for invalid value', async () => {
  const cwd = tmpDir();
  try {
    await setupWithTask(cwd);
    await assert.rejects(() => update(['multi-instance.type', 'loop'], cwd), /parallel.*sequential|sequential.*parallel/);
  } finally {
    cleanup(cwd);
  }
});

test('update zeebe:loopCharacteristics sets input and output collections', async () => {
  const cwd = tmpDir();
  try {
    await setupWithTask(cwd);
    await update(['multi-instance.type', 'parallel'], cwd);
    await update(['zeebe:loopCharacteristics.inputCollection', '=items'], cwd);
    await update(['zeebe:loopCharacteristics.inputElement', 'item'], cwd);
    await update(['zeebe:loopCharacteristics.outputCollection', 'results'], cwd);
    await update(['zeebe:loopCharacteristics.outputElement', '=result'], cwd);

    const status = await getStatus(cwd);
    const proc = status['process'] as Record<string, unknown>;
    const elements = proc['elements'] as Array<Record<string, unknown>>;
    const el = elements.find((e) => e['id'] === 'Activity_1');
    const zeebe = el?.['zeebe'] as Record<string, unknown>;
    const zlc = zeebe?.['loopCharacteristics'] as Record<string, unknown>;
    assert.equal(zlc?.['inputCollection'], '=items');
    assert.equal(zlc?.['inputElement'], 'item');
    assert.equal(zlc?.['outputCollection'], 'results');
    assert.equal(zlc?.['outputElement'], '=result');
  } finally {
    cleanup(cwd);
  }
});

test('update ad-hoc.ordering sets ordering on ad-hoc sub-process', async () => {
  const cwd = tmpDir();
  try {
    await setupModel('proc', cwd);
    await append(['ad-hoc-sub-process', 'My Ad Hoc'], cwd); // Activity_1

    await update(['ad-hoc.ordering', 'Sequential'], cwd);

    const status = await getStatus(cwd);
    const proc = status['process'] as Record<string, unknown>;
    const elements = proc['elements'] as Array<Record<string, unknown>>;
    const el = elements.find((e) => e['id'] === 'Activity_1');
    assert.equal(el?.['ordering'], 'Sequential');
  } finally {
    cleanup(cwd);
  }
});

test('update ad-hoc.cancelRemainingInstances sets to false', async () => {
  const cwd = tmpDir();
  try {
    await setupModel('proc', cwd);
    await append(['ad-hoc-sub-process', 'My Ad Hoc'], cwd);

    await update(['ad-hoc.cancelRemainingInstances', 'false'], cwd);

    const status = await getStatus(cwd);
    const proc = status['process'] as Record<string, unknown>;
    const elements = proc['elements'] as Array<Record<string, unknown>>;
    const el = elements.find((e) => e['id'] === 'Activity_1');
    assert.equal(el?.['cancelRemainingInstances'], false);
  } finally {
    cleanup(cwd);
  }
});

test('update isInterrupting false marks start event as non-interrupting', async () => {
  const cwd = tmpDir();
  try {
    await setupModel('proc', cwd);
    await create(['error-start-event', 'On Error'], cwd); // StartEvent_2, cursor → StartEvent_2

    await update(['isInterrupting', 'false'], cwd);

    const status = await getStatus(cwd);
    const proc = status['process'] as Record<string, unknown>;
    const elements = proc['elements'] as Array<Record<string, unknown>>;
    const el = elements.find((e) => e['id'] === 'StartEvent_2');
    assert.equal(el?.['isInterrupting'], false);
  } finally {
    cleanup(cwd);
  }
});

test('update ad-hoc.ordering throws on non-ad-hoc element', async () => {
  const cwd = tmpDir();
  try {
    await setupWithTask(cwd);
    await assert.rejects(() => update(['ad-hoc.ordering', 'Sequential'], cwd), /ad-hoc sub-process/);
  } finally {
    cleanup(cwd);
  }
});

test('update ad-hoc.cancelRemainingInstances throws on non-ad-hoc element', async () => {
  const cwd = tmpDir();
  try {
    await setupWithTask(cwd);
    await assert.rejects(() => update(['ad-hoc.cancelRemainingInstances', 'false'], cwd), /ad-hoc sub-process/);
  } finally {
    cleanup(cwd);
  }
});

test('update throws for unknown property', async () => {
  const cwd = tmpDir();
  try {
    await setupWithTask(cwd);
    await assert.rejects(
      () => update(['unknownProp', 'value'], cwd),
      /Unknown property/,
    );
  } finally {
    cleanup(cwd);
  }
});

test('update throws when element not found', async () => {
  const cwd = tmpDir();
  try {
    await setupWithTask(cwd);
    await assert.rejects(
      () => update(['Activity_99', 'name', 'X'], cwd),
      /not found/,
    );
  } finally {
    cleanup(cwd);
  }
});

test('update throws without property and value', async () => {
  const cwd = tmpDir();
  try {
    await setupWithTask(cwd);
    await assert.rejects(() => update([], cwd), /Usage/);
  } finally {
    cleanup(cwd);
  }
});

// --- zeebe:taskDefinition (activities only) ---

test('update zeebe:taskDefinition.type on sub-process', async () => {
  const cwd = tmpDir();
  try {
    await setupWithSubProcess(cwd);
    await update(['zeebe:taskDefinition.type', 'my-job'], cwd);

    const status = await getStatus(cwd);
    const proc = status['process'] as Record<string, unknown>;
    const elements = proc['elements'] as Array<Record<string, unknown>>;
    const el = elements.find((e) => e['id'] === 'Activity_1');
    const zeebe = el?.['zeebe'] as Record<string, unknown>;
    const td = zeebe?.['taskDefinition'] as Record<string, unknown>;
    assert.equal(td?.['type'], 'my-job');
  } finally {
    cleanup(cwd);
  }
});

test('update zeebe:taskDefinition.type on call-activity', async () => {
  const cwd = tmpDir();
  try {
    await setupWithCallActivity(cwd);
    await update(['zeebe:taskDefinition.type', 'my-job'], cwd);

    const status = await getStatus(cwd);
    const proc = status['process'] as Record<string, unknown>;
    const elements = proc['elements'] as Array<Record<string, unknown>>;
    const el = elements.find((e) => e['id'] === 'Activity_1');
    const zeebe = el?.['zeebe'] as Record<string, unknown>;
    const td = zeebe?.['taskDefinition'] as Record<string, unknown>;
    assert.equal(td?.['type'], 'my-job');
  } finally {
    cleanup(cwd);
  }
});

test('update zeebe:taskDefinition.type throws on exclusive-gateway', async () => {
  const cwd = tmpDir();
  try {
    await setupWithGateway(cwd);
    await assert.rejects(() => update(['zeebe:taskDefinition.type', 'my-job'], cwd), /activities/);
  } finally {
    cleanup(cwd);
  }
});

test('update zeebe:taskDefinition.type throws on end-event', async () => {
  const cwd = tmpDir();
  try {
    await setupWithEndEvent(cwd);
    await assert.rejects(() => update(['zeebe:taskDefinition.type', 'my-job'], cwd), /activities/);
  } finally {
    cleanup(cwd);
  }
});

test('update zeebe:taskDefinition.retries throws on exclusive-gateway', async () => {
  const cwd = tmpDir();
  try {
    await setupWithGateway(cwd);
    await assert.rejects(() => update(['zeebe:taskDefinition.retries', '3'], cwd), /activities/);
  } finally {
    cleanup(cwd);
  }
});

// --- zeebe:calledDecision (business-rule-task only) ---

test('update zeebe:calledDecision.decisionId on business-rule-task', async () => {
  const cwd = tmpDir();
  try {
    await setupModel('proc', cwd);
    await append(['business-rule-task', 'Evaluate'], cwd); // Activity_1

    await update(['zeebe:calledDecision.decisionId', 'my-decision'], cwd);

    const status = await getStatus(cwd);
    const proc = status['process'] as Record<string, unknown>;
    const elements = proc['elements'] as Array<Record<string, unknown>>;
    const el = elements.find((e) => e['id'] === 'Activity_1');
    const zeebe = el?.['zeebe'] as Record<string, unknown>;
    const cd = zeebe?.['calledDecision'] as Record<string, unknown>;
    assert.equal(cd?.['decisionId'], 'my-decision');
  } finally {
    cleanup(cwd);
  }
});

test('update zeebe:calledDecision.resultVariable on business-rule-task', async () => {
  const cwd = tmpDir();
  try {
    await setupModel('proc', cwd);
    await append(['business-rule-task', 'Evaluate'], cwd);

    await update(['zeebe:calledDecision.resultVariable', 'decisionResult'], cwd);

    const status = await getStatus(cwd);
    const proc = status['process'] as Record<string, unknown>;
    const elements = proc['elements'] as Array<Record<string, unknown>>;
    const el = elements.find((e) => e['id'] === 'Activity_1');
    const zeebe = el?.['zeebe'] as Record<string, unknown>;
    const cd = zeebe?.['calledDecision'] as Record<string, unknown>;
    assert.equal(cd?.['resultVariable'], 'decisionResult');
  } finally {
    cleanup(cwd);
  }
});

test('update zeebe:calledDecision sets both fields independently', async () => {
  const cwd = tmpDir();
  try {
    await setupModel('proc', cwd);
    await append(['business-rule-task', 'Evaluate'], cwd);

    await update(['zeebe:calledDecision.decisionId', 'my-decision'], cwd);
    await update(['zeebe:calledDecision.resultVariable', 'decisionResult'], cwd);

    const status = await getStatus(cwd);
    const proc = status['process'] as Record<string, unknown>;
    const elements = proc['elements'] as Array<Record<string, unknown>>;
    const el = elements.find((e) => e['id'] === 'Activity_1');
    const zeebe = el?.['zeebe'] as Record<string, unknown>;
    const cd = zeebe?.['calledDecision'] as Record<string, unknown>;
    assert.equal(cd?.['decisionId'], 'my-decision');
    assert.equal(cd?.['resultVariable'], 'decisionResult');
  } finally {
    cleanup(cwd);
  }
});

test('update zeebe:calledDecision.decisionId updates existing value', async () => {
  const cwd = tmpDir();
  try {
    await setupModel('proc', cwd);
    await append(['business-rule-task', 'Evaluate'], cwd);

    await update(['zeebe:calledDecision.decisionId', 'old-decision'], cwd);
    await update(['zeebe:calledDecision.decisionId', 'new-decision'], cwd);

    const status = await getStatus(cwd);
    const proc = status['process'] as Record<string, unknown>;
    const elements = proc['elements'] as Array<Record<string, unknown>>;
    const el = elements.find((e) => e['id'] === 'Activity_1');
    const zeebe = el?.['zeebe'] as Record<string, unknown>;
    const cd = zeebe?.['calledDecision'] as Record<string, unknown>;
    assert.equal(cd?.['decisionId'], 'new-decision');
  } finally {
    cleanup(cwd);
  }
});

test('update zeebe:calledDecision.decisionId throws on service-task', async () => {
  const cwd = tmpDir();
  try {
    await setupModel('proc', cwd);
    await append(['service-task', 'Do Work'], cwd);
    await assert.rejects(
      () => update(['zeebe:calledDecision.decisionId', 'my-decision'], cwd),
      /business-rule-task/,
    );
  } finally {
    cleanup(cwd);
  }
});

test('update zeebe:calledDecision.resultVariable throws on service-task', async () => {
  const cwd = tmpDir();
  try {
    await setupModel('proc', cwd);
    await append(['service-task', 'Do Work'], cwd);
    await assert.rejects(
      () => update(['zeebe:calledDecision.resultVariable', 'result'], cwd),
      /business-rule-task/,
    );
  } finally {
    cleanup(cwd);
  }
});

test('update zeebe:calledDecision.decisionId throws on exclusive-gateway', async () => {
  const cwd = tmpDir();
  try {
    await setupWithGateway(cwd);
    await assert.rejects(
      () => update(['zeebe:calledDecision.decisionId', 'my-decision'], cwd),
      /business-rule-task/,
    );
  } finally {
    cleanup(cwd);
  }
});

// --- zeebe:input / zeebe:output (activities only) ---

test('update zeebe:input throws on exclusive-gateway', async () => {
  const cwd = tmpDir();
  try {
    await setupWithGateway(cwd);
    await assert.rejects(() => update(['zeebe:input', '=x', 'localX'], cwd), /activities/);
  } finally {
    cleanup(cwd);
  }
});

test('update zeebe:output throws on exclusive-gateway', async () => {
  const cwd = tmpDir();
  try {
    await setupWithGateway(cwd);
    await assert.rejects(() => update(['zeebe:output', '=result', 'out'], cwd), /activities/);
  } finally {
    cleanup(cwd);
  }
});

test('update zeebe:input throws on end-event', async () => {
  const cwd = tmpDir();
  try {
    await setupWithEndEvent(cwd);
    await assert.rejects(() => update(['zeebe:input', '=x', 'localX'], cwd), /activities/);
  } finally {
    cleanup(cwd);
  }
});

// --- zeebe:header (activities only) ---

test('update zeebe:header throws on exclusive-gateway', async () => {
  const cwd = tmpDir();
  try {
    await setupWithGateway(cwd);
    await assert.rejects(() => update(['zeebe:header', 'timeout', '30s'], cwd), /activities/);
  } finally {
    cleanup(cwd);
  }
});

// --- zeebe:property (any element) ---

test('update zeebe:property on exclusive-gateway', async () => {
  const cwd = tmpDir();
  try {
    await setupWithGateway(cwd);
    await update(['zeebe:property', 'meta', 'val'], cwd);

    const status = await getStatus(cwd);
    const proc = status['process'] as Record<string, unknown>;
    const elements = proc['elements'] as Array<Record<string, unknown>>;
    const el = elements.find((e) => e['id'] === 'Gateway_1');
    const zeebe = el?.['zeebe'] as Record<string, unknown>;
    const props = zeebe?.['properties'] as Array<Record<string, unknown>>;
    const prop = props?.find((p) => p['name'] === 'meta');
    assert.ok(prop, 'zeebe property should exist on gateway');
    assert.equal(prop['value'], 'val');
  } finally {
    cleanup(cwd);
  }
});

test('update zeebe:property on end-event', async () => {
  const cwd = tmpDir();
  try {
    await setupWithEndEvent(cwd);
    await update(['zeebe:property', 'meta', 'val'], cwd);

    const status = await getStatus(cwd);
    const proc = status['process'] as Record<string, unknown>;
    const elements = proc['elements'] as Array<Record<string, unknown>>;
    const el = elements.find((e) => e['id'] === 'EndEvent_1');
    const zeebe = el?.['zeebe'] as Record<string, unknown>;
    const props = zeebe?.['properties'] as Array<Record<string, unknown>>;
    const prop = props?.find((p) => p['name'] === 'meta');
    assert.ok(prop, 'zeebe property should exist on end event');
    assert.equal(prop['value'], 'val');
  } finally {
    cleanup(cwd);
  }
});

// --- isInterrupting (start events only) ---

test('update isInterrupting true on start-event', async () => {
  const cwd = tmpDir();
  try {
    await setupModel('proc', cwd);
    await create(['error-start-event', 'On Error'], cwd); // StartEvent_2
    await update(['isInterrupting', 'false'], cwd);
    await update(['isInterrupting', 'true'], cwd);

    const status = await getStatus(cwd);
    const proc = status['process'] as Record<string, unknown>;
    const elements = proc['elements'] as Array<Record<string, unknown>>;
    const el = elements.find((e) => e['id'] === 'StartEvent_2');
    assert.notEqual(el?.['isInterrupting'], false);
  } finally {
    cleanup(cwd);
  }
});

test('update isInterrupting throws on user-task', async () => {
  const cwd = tmpDir();
  try {
    await setupWithTask(cwd);
    await assert.rejects(() => update(['isInterrupting', 'false'], cwd), /start events/);
  } finally {
    cleanup(cwd);
  }
});

test('update isInterrupting throws on exclusive-gateway', async () => {
  const cwd = tmpDir();
  try {
    await setupWithGateway(cwd);
    await assert.rejects(() => update(['isInterrupting', 'false'], cwd), /start events/);
  } finally {
    cleanup(cwd);
  }
});

// --- multi-instance.type (activities only) ---

test('update multi-instance.type on sub-process', async () => {
  const cwd = tmpDir();
  try {
    await setupWithSubProcess(cwd);
    await update(['multi-instance.type', 'parallel'], cwd);

    const status = await getStatus(cwd);
    const proc = status['process'] as Record<string, unknown>;
    const elements = proc['elements'] as Array<Record<string, unknown>>;
    const el = elements.find((e) => e['id'] === 'Activity_1');
    const lc = el?.['loopCharacteristics'] as Record<string, unknown>;
    assert.equal(lc?.['type'], 'multiInstance');
    assert.equal(lc?.['isSequential'], false);
  } finally {
    cleanup(cwd);
  }
});

test('update multi-instance.type on call-activity', async () => {
  const cwd = tmpDir();
  try {
    await setupWithCallActivity(cwd);
    await update(['multi-instance.type', 'sequential'], cwd);

    const status = await getStatus(cwd);
    const proc = status['process'] as Record<string, unknown>;
    const elements = proc['elements'] as Array<Record<string, unknown>>;
    const el = elements.find((e) => e['id'] === 'Activity_1');
    const lc = el?.['loopCharacteristics'] as Record<string, unknown>;
    assert.equal(lc?.['isSequential'], true);
  } finally {
    cleanup(cwd);
  }
});

test('update multi-instance.type throws on exclusive-gateway', async () => {
  const cwd = tmpDir();
  try {
    await setupWithGateway(cwd);
    await assert.rejects(() => update(['multi-instance.type', 'parallel'], cwd), /activities/);
  } finally {
    cleanup(cwd);
  }
});

test('update multi-instance.type throws on end-event', async () => {
  const cwd = tmpDir();
  try {
    await setupWithEndEvent(cwd);
    await assert.rejects(() => update(['multi-instance.type', 'parallel'], cwd), /activities/);
  } finally {
    cleanup(cwd);
  }
});

// --- zeebe:loopCharacteristics (activities only) ---

test('update zeebe:loopCharacteristics.inputCollection throws on exclusive-gateway', async () => {
  const cwd = tmpDir();
  try {
    await setupWithGateway(cwd);
    await assert.rejects(
      () => update(['zeebe:loopCharacteristics.inputCollection', '=items'], cwd),
      /activities/,
    );
  } finally {
    cleanup(cwd);
  }
});

// --- ad-hoc.ordering ---

test('update ad-hoc.ordering Parallel sets ordering on ad-hoc sub-process', async () => {
  const cwd = tmpDir();
  try {
    await setupWithAdHoc(cwd);
    await update(['ad-hoc.ordering', 'Parallel'], cwd);

    const status = await getStatus(cwd);
    const proc = status['process'] as Record<string, unknown>;
    const elements = proc['elements'] as Array<Record<string, unknown>>;
    const el = elements.find((e) => e['id'] === 'Activity_1');
    assert.equal(el?.['ordering'], 'Parallel');
  } finally {
    cleanup(cwd);
  }
});

test('update ad-hoc.ordering throws for invalid value', async () => {
  const cwd = tmpDir();
  try {
    await setupWithAdHoc(cwd);
    await assert.rejects(() => update(['ad-hoc.ordering', 'Loop'], cwd), /Sequential.*Parallel|Parallel.*Sequential/);
  } finally {
    cleanup(cwd);
  }
});

// --- ad-hoc.cancelRemainingInstances ---

test('update ad-hoc.cancelRemainingInstances true', async () => {
  const cwd = tmpDir();
  try {
    await setupWithAdHoc(cwd);
    await update(['ad-hoc.cancelRemainingInstances', 'false'], cwd);
    await update(['ad-hoc.cancelRemainingInstances', 'true'], cwd);

    const status = await getStatus(cwd);
    const proc = status['process'] as Record<string, unknown>;
    const elements = proc['elements'] as Array<Record<string, unknown>>;
    const el = elements.find((e) => e['id'] === 'Activity_1');
    assert.equal(el?.['cancelRemainingInstances'], true);
  } finally {
    cleanup(cwd);
  }
});

// --- timer.timeDuration / timer.timeCycle / timer.timeDate ---

async function setupWithTimerBoundary(cwd: string): Promise<void> {
  await setupModel('proc', cwd);
  await append(['user-task', 'Review'], cwd); // Activity_1
  await boundaryAppend(['timer', 'Timeout'], cwd); // BoundaryEvent_1, cursor → BoundaryEvent_1
}

test('update timer.timeDuration sets duration on boundary timer event', async () => {
  const cwd = tmpDir();
  try {
    await setupWithTimerBoundary(cwd);
    await update(['timer.timeDuration', 'PT1H'], cwd);

    const status = await getStatus(cwd);
    const proc = status['process'] as Record<string, unknown>;
    const elements = proc['elements'] as Array<Record<string, unknown>>;
    const el = elements.find((e) => e['id'] === 'BoundaryEvent_1');
    const timer = el?.['timer'] as Record<string, unknown>;
    assert.equal(timer?.['timeDuration'], 'PT1H');
    assert.equal(timer?.['timeCycle'], undefined);
    assert.equal(timer?.['timeDate'], undefined);
  } finally {
    cleanup(cwd);
  }
});

test('update timer.timeCycle sets cycle on boundary timer event', async () => {
  const cwd = tmpDir();
  try {
    await setupWithTimerBoundary(cwd);
    await update(['timer.timeCycle', 'R/PT1H'], cwd);

    const status = await getStatus(cwd);
    const proc = status['process'] as Record<string, unknown>;
    const elements = proc['elements'] as Array<Record<string, unknown>>;
    const el = elements.find((e) => e['id'] === 'BoundaryEvent_1');
    const timer = el?.['timer'] as Record<string, unknown>;
    assert.equal(timer?.['timeCycle'], 'R/PT1H');
    assert.equal(timer?.['timeDuration'], undefined);
    assert.equal(timer?.['timeDate'], undefined);
  } finally {
    cleanup(cwd);
  }
});

test('update timer.timeDate sets date on boundary timer event', async () => {
  const cwd = tmpDir();
  try {
    await setupWithTimerBoundary(cwd);
    await update(['timer.timeDate', '2025-12-31T23:59:59Z'], cwd);

    const status = await getStatus(cwd);
    const proc = status['process'] as Record<string, unknown>;
    const elements = proc['elements'] as Array<Record<string, unknown>>;
    const el = elements.find((e) => e['id'] === 'BoundaryEvent_1');
    const timer = el?.['timer'] as Record<string, unknown>;
    assert.equal(timer?.['timeDate'], '2025-12-31T23:59:59Z');
    assert.equal(timer?.['timeDuration'], undefined);
    assert.equal(timer?.['timeCycle'], undefined);
  } finally {
    cleanup(cwd);
  }
});

test('update timer property clears previously set timer property (mutual exclusion)', async () => {
  const cwd = tmpDir();
  try {
    await setupWithTimerBoundary(cwd);
    await update(['timer.timeDuration', 'PT1H'], cwd);
    await update(['timer.timeCycle', 'R/PT30M'], cwd);

    const status = await getStatus(cwd);
    const proc = status['process'] as Record<string, unknown>;
    const elements = proc['elements'] as Array<Record<string, unknown>>;
    const el = elements.find((e) => e['id'] === 'BoundaryEvent_1');
    const timer = el?.['timer'] as Record<string, unknown>;
    assert.equal(timer?.['timeCycle'], 'R/PT30M');
    assert.equal(timer?.['timeDuration'], undefined);
  } finally {
    cleanup(cwd);
  }
});

test('update timer.timeDuration on timer-intermediate-catch-event', async () => {
  const cwd = tmpDir();
  try {
    await setupModel('proc', cwd);
    await append(['timer-intermediate-catch-event', 'Wait'], cwd); // Event_1

    await update(['timer.timeDuration', 'PT5M'], cwd);

    const status = await getStatus(cwd);
    const proc = status['process'] as Record<string, unknown>;
    const elements = proc['elements'] as Array<Record<string, unknown>>;
    const el = elements.find((e) => e['id'] === 'Event_1');
    const timer = el?.['timer'] as Record<string, unknown>;
    assert.equal(timer?.['timeDuration'], 'PT5M');
  } finally {
    cleanup(cwd);
  }
});

test('update timer.timeDuration on timer-start-event', async () => {
  const cwd = tmpDir();
  try {
    await setupModel('proc', cwd);
    await create(['timer-start-event', 'Scheduled Start'], cwd); // StartEvent_2

    await update(['timer.timeDuration', 'PT10M'], cwd);

    const status = await getStatus(cwd);
    const proc = status['process'] as Record<string, unknown>;
    const elements = proc['elements'] as Array<Record<string, unknown>>;
    const el = elements.find((e) => e['id'] === 'StartEvent_2');
    const timer = el?.['timer'] as Record<string, unknown>;
    assert.equal(timer?.['timeDuration'], 'PT10M');
  } finally {
    cleanup(cwd);
  }
});

test('update timer.timeDuration with FEEL expression (= prefix)', async () => {
  const cwd = tmpDir();
  try {
    await setupWithTimerBoundary(cwd);
    await update(['timer.timeDuration', '=duration("PT1H")'], cwd);

    const status = await getStatus(cwd);
    const proc = status['process'] as Record<string, unknown>;
    const elements = proc['elements'] as Array<Record<string, unknown>>;
    const el = elements.find((e) => e['id'] === 'BoundaryEvent_1');
    const timer = el?.['timer'] as Record<string, unknown>;
    assert.equal(timer?.['timeDuration'], '=duration("PT1H")');
  } finally {
    cleanup(cwd);
  }
});

test('update timer.timeDuration throws on non-timer element', async () => {
  const cwd = tmpDir();
  try {
    await setupWithTask(cwd);
    await assert.rejects(
      () => update(['timer.timeDuration', 'PT1H'], cwd),
      /bpmn:timerEventDefinition/,
    );
  } finally {
    cleanup(cwd);
  }
});

test('update timer.timeCycle throws on non-timer element', async () => {
  const cwd = tmpDir();
  try {
    await setupWithTask(cwd);
    await assert.rejects(
      () => update(['timer.timeCycle', 'R/PT1H'], cwd),
      /bpmn:timerEventDefinition/,
    );
  } finally {
    cleanup(cwd);
  }
});

test('update timer.timeDate throws on non-timer element', async () => {
  const cwd = tmpDir();
  try {
    await setupWithTask(cwd);
    await assert.rejects(
      () => update(['timer.timeDate', '2025-12-31T23:59:59Z'], cwd),
      /bpmn:timerEventDefinition/,
    );
  } finally {
    cleanup(cwd);
  }
});

test('update timer.timeDuration serializes xsi:type="bpmn:tFormalExpression" in XML', async () => {
  const cwd = tmpDir();
  try {
    await setupWithTimerBoundary(cwd);
    await update(['timer.timeDuration', 'PT1H'], cwd);

    const { readState } = await import('../state.js');
    const { readFileSync } = await import('node:fs');
    const state = readState(cwd);
    const xml = readFileSync(state.file, 'utf-8');
    assert.ok(xml.includes('xsi:type="bpmn:tFormalExpression"'), 'XML must include xsi:type="bpmn:tFormalExpression"');
    assert.ok(xml.includes('<bpmn:timeDuration'), 'XML must include <bpmn:timeDuration>');
    assert.ok(xml.includes('PT1H'), 'XML must include the expression value');
  } finally {
    cleanup(cwd);
  }
});

test('update timer.timeCycle serializes xsi:type="bpmn:tFormalExpression" in XML', async () => {
  const cwd = tmpDir();
  try {
    await setupWithTimerBoundary(cwd);
    await update(['timer.timeCycle', 'R/PT30M'], cwd);

    const { readState } = await import('../state.js');
    const { readFileSync } = await import('node:fs');
    const state = readState(cwd);
    const xml = readFileSync(state.file, 'utf-8');
    assert.ok(xml.includes('<bpmn:timeCycle'), 'XML must include <bpmn:timeCycle>');
    assert.ok(xml.includes('xsi:type="bpmn:tFormalExpression"'), 'XML must include xsi:type="bpmn:tFormalExpression"');
    assert.ok(xml.includes('R/PT30M'), 'XML must include the expression value');
  } finally {
    cleanup(cwd);
  }
});

test('update timer.timeDate serializes xsi:type="bpmn:tFormalExpression" in XML', async () => {
  const cwd = tmpDir();
  try {
    await setupWithTimerBoundary(cwd);
    await update(['timer.timeDate', '2025-12-31T23:59:59Z'], cwd);

    const { readState } = await import('../state.js');
    const { readFileSync } = await import('node:fs');
    const state = readState(cwd);
    const xml = readFileSync(state.file, 'utf-8');
    assert.ok(xml.includes('<bpmn:timeDate'), 'XML must include <bpmn:timeDate>');
    assert.ok(xml.includes('xsi:type="bpmn:tFormalExpression"'), 'XML must include xsi:type="bpmn:tFormalExpression"');
    assert.ok(xml.includes('2025-12-31T23:59:59Z'), 'XML must include the expression value');
  } finally {
    cleanup(cwd);
  }
});

test('update timer.timeDuration serializes previous element removed from XML on overwrite', async () => {
  const cwd = tmpDir();
  try {
    await setupWithTimerBoundary(cwd);
    await update(['timer.timeCycle', 'R/PT1H'], cwd);
    await update(['timer.timeDuration', 'PT2H'], cwd);

    const { readState } = await import('../state.js');
    const { readFileSync } = await import('node:fs');
    const state = readState(cwd);
    const xml = readFileSync(state.file, 'utf-8');
    assert.ok(xml.includes('<bpmn:timeDuration'), 'XML must include <bpmn:timeDuration>');
    assert.ok(!xml.includes('<bpmn:timeCycle'), 'XML must not include <bpmn:timeCycle> after overwrite');
  } finally {
    cleanup(cwd);
  }
});

test('update timer.timeCycle on timer-start-event', async () => {
  const cwd = tmpDir();
  try {
    await setupModel('proc', cwd);
    await create(['timer-start-event', 'Scheduled Start'], cwd); // StartEvent_2

    await update(['timer.timeCycle', 'R3/PT1H'], cwd);

    const status = await getStatus(cwd);
    const proc = status['process'] as Record<string, unknown>;
    const elements = proc['elements'] as Array<Record<string, unknown>>;
    const el = elements.find((e) => e['id'] === 'StartEvent_2');
    const timer = el?.['timer'] as Record<string, unknown>;
    assert.equal(timer?.['timeCycle'], 'R3/PT1H');
  } finally {
    cleanup(cwd);
  }
});

test('update timer.timeDate on timer-start-event', async () => {
  const cwd = tmpDir();
  try {
    await setupModel('proc', cwd);
    await create(['timer-start-event', 'Scheduled Start'], cwd); // StartEvent_2

    await update(['timer.timeDate', '2026-01-01T00:00:00Z'], cwd);

    const status = await getStatus(cwd);
    const proc = status['process'] as Record<string, unknown>;
    const elements = proc['elements'] as Array<Record<string, unknown>>;
    const el = elements.find((e) => e['id'] === 'StartEvent_2');
    const timer = el?.['timer'] as Record<string, unknown>;
    assert.equal(timer?.['timeDate'], '2026-01-01T00:00:00Z');
  } finally {
    cleanup(cwd);
  }
});

test('update timer.timeCycle on timer-intermediate-catch-event', async () => {
  const cwd = tmpDir();
  try {
    await setupModel('proc', cwd);
    await append(['timer-intermediate-catch-event', 'Wait'], cwd); // Event_1

    await update(['timer.timeCycle', '0 9 * * MON-FRI'], cwd);

    const status = await getStatus(cwd);
    const proc = status['process'] as Record<string, unknown>;
    const elements = proc['elements'] as Array<Record<string, unknown>>;
    const el = elements.find((e) => e['id'] === 'Event_1');
    const timer = el?.['timer'] as Record<string, unknown>;
    assert.equal(timer?.['timeCycle'], '0 9 * * MON-FRI');
  } finally {
    cleanup(cwd);
  }
});

test('update timer.timeDate on timer-intermediate-catch-event', async () => {
  const cwd = tmpDir();
  try {
    await setupModel('proc', cwd);
    await append(['timer-intermediate-catch-event', 'Wait'], cwd); // Event_1

    await update(['timer.timeDate', '2025-06-15T08:00:00Z'], cwd);

    const status = await getStatus(cwd);
    const proc = status['process'] as Record<string, unknown>;
    const elements = proc['elements'] as Array<Record<string, unknown>>;
    const el = elements.find((e) => e['id'] === 'Event_1');
    const timer = el?.['timer'] as Record<string, unknown>;
    assert.equal(timer?.['timeDate'], '2025-06-15T08:00:00Z');
  } finally {
    cleanup(cwd);
  }
});

test('update timer.timeDuration on non-interrupting timer boundary event', async () => {
  const cwd = tmpDir();
  try {
    await setupModel('proc', cwd);
    await append(['user-task', 'Review'], cwd); // Activity_1
    await boundaryAppend(['non-interrupting-timer', 'Escalate'], cwd); // BoundaryEvent_1

    await update(['timer.timeDuration', 'PT2H'], cwd);

    const status = await getStatus(cwd);
    const proc = status['process'] as Record<string, unknown>;
    const elements = proc['elements'] as Array<Record<string, unknown>>;
    const el = elements.find((e) => e['id'] === 'BoundaryEvent_1');
    const timer = el?.['timer'] as Record<string, unknown>;
    assert.equal(timer?.['timeDuration'], 'PT2H');
  } finally {
    cleanup(cwd);
  }
});

test('update timer.timeDuration with explicit elementId targeting', async () => {
  const cwd = tmpDir();
  try {
    await setupModel('proc', cwd);
    await append(['user-task', 'Review'], cwd); // Activity_1
    await boundaryAppend(['timer', 'Timeout'], cwd); // BoundaryEvent_1, cursor → BoundaryEvent_1
    await append(['user-task', 'Approve'], cwd); // Activity_2, cursor → Activity_2

    await update(['BoundaryEvent_1', 'timer.timeDuration', 'PT30M'], cwd);

    const status = await getStatus(cwd);
    const proc = status['process'] as Record<string, unknown>;
    const elements = proc['elements'] as Array<Record<string, unknown>>;
    const el = elements.find((e) => e['id'] === 'BoundaryEvent_1');
    const timer = el?.['timer'] as Record<string, unknown>;
    assert.equal(timer?.['timeDuration'], 'PT30M');
  } finally {
    cleanup(cwd);
  }
});

test('update timer property mutual exclusion: timeCycle clears timeDate', async () => {
  const cwd = tmpDir();
  try {
    await setupWithTimerBoundary(cwd);
    await update(['timer.timeDate', '2025-12-31T23:59:59Z'], cwd);
    await update(['timer.timeCycle', 'R/PT1H'], cwd);

    const status = await getStatus(cwd);
    const proc = status['process'] as Record<string, unknown>;
    const elements = proc['elements'] as Array<Record<string, unknown>>;
    const el = elements.find((e) => e['id'] === 'BoundaryEvent_1');
    const timer = el?.['timer'] as Record<string, unknown>;
    assert.equal(timer?.['timeCycle'], 'R/PT1H');
    assert.equal(timer?.['timeDate'], undefined);
  } finally {
    cleanup(cwd);
  }
});

test('update timer property mutual exclusion: timeDate clears timeDuration', async () => {
  const cwd = tmpDir();
  try {
    await setupWithTimerBoundary(cwd);
    await update(['timer.timeDuration', 'PT4H'], cwd);
    await update(['timer.timeDate', '2026-03-01T12:00:00Z'], cwd);

    const status = await getStatus(cwd);
    const proc = status['process'] as Record<string, unknown>;
    const elements = proc['elements'] as Array<Record<string, unknown>>;
    const el = elements.find((e) => e['id'] === 'BoundaryEvent_1');
    const timer = el?.['timer'] as Record<string, unknown>;
    assert.equal(timer?.['timeDate'], '2026-03-01T12:00:00Z');
    assert.equal(timer?.['timeDuration'], undefined);
  } finally {
    cleanup(cwd);
  }
});

test('update timer.timeCycle with FEEL expression', async () => {
  const cwd = tmpDir();
  try {
    await setupModel('proc', cwd);
    await create(['timer-start-event', 'Scheduled'], cwd);

    await update(['timer.timeCycle', '=cycle(duration("PT1H"))'], cwd);

    const status = await getStatus(cwd);
    const proc = status['process'] as Record<string, unknown>;
    const elements = proc['elements'] as Array<Record<string, unknown>>;
    const el = elements.find((e) => e['id'] === 'StartEvent_2');
    const timer = el?.['timer'] as Record<string, unknown>;
    assert.equal(timer?.['timeCycle'], '=cycle(duration("PT1H"))');
  } finally {
    cleanup(cwd);
  }
});

test('update timer.timeDate with FEEL expression', async () => {
  const cwd = tmpDir();
  try {
    await setupWithTimerBoundary(cwd);
    await update(['timer.timeDate', '=date and time("2026-01-01T00:00:00Z")'], cwd);

    const status = await getStatus(cwd);
    const proc = status['process'] as Record<string, unknown>;
    const elements = proc['elements'] as Array<Record<string, unknown>>;
    const el = elements.find((e) => e['id'] === 'BoundaryEvent_1');
    const timer = el?.['timer'] as Record<string, unknown>;
    assert.equal(timer?.['timeDate'], '=date and time("2026-01-01T00:00:00Z")');
  } finally {
    cleanup(cwd);
  }
});

test('update timer.timeDuration throws on message boundary event', async () => {
  const cwd = tmpDir();
  try {
    await setupModel('proc', cwd);
    await append(['user-task', 'Review'], cwd); // Activity_1
    await boundaryAppend(['message', 'Msg'], cwd); // BoundaryEvent_1 (message, not timer)

    await assert.rejects(
      () => update(['timer.timeDuration', 'PT1H'], cwd),
      /bpmn:timerEventDefinition/,
    );
  } finally {
    cleanup(cwd);
  }
});

test('update timer.timeDuration throws on error boundary event', async () => {
  const cwd = tmpDir();
  try {
    await setupModel('proc', cwd);
    await append(['user-task', 'Review'], cwd); // Activity_1
    await boundaryAppend(['error', 'Err'], cwd); // BoundaryEvent_1 (error, not timer)

    await assert.rejects(
      () => update(['timer.timeDuration', 'PT1H'], cwd),
      /bpmn:timerEventDefinition/,
    );
  } finally {
    cleanup(cwd);
  }
});
