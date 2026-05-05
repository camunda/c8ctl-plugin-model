import { test } from 'node:test';
import assert from 'node:assert/strict';
import { append } from '../commands/append.js';
import { update } from '../commands/update.js';
import { tmpDir, cleanup, setupModel, getStatus } from './helpers.js';

async function setupWithTask(cwd: string): Promise<void> {
  await setupModel('proc', cwd);
  await append(['user-task', 'Review'], cwd); // Activity_1
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
