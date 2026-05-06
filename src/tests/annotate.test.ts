import { test } from 'node:test';
import assert from 'node:assert/strict';
import { annotate } from '../commands/annotate.js';
import { append } from '../commands/append.js';
import { readState } from '../state.js';
import { tmpDir, cleanup, setupModel, getStatus } from './helpers.js';

test('annotate adds text annotation to cursor element', async () => {
  const cwd = tmpDir();
  try {
    await setupModel('proc', cwd);

    await annotate(['This is important'], cwd);

    const status = await getStatus(cwd);
    const proc = status['process'] as Record<string, unknown>;
    const artifacts = proc['artifacts'] as Array<Record<string, unknown>>;
    assert.ok(artifacts, 'artifacts should exist');
    assert.equal(artifacts.length, 1);
    assert.equal(artifacts[0]['type'], 'textAnnotation');
    assert.equal(artifacts[0]['text'], 'This is important');
    assert.equal(artifacts[0]['associatedTo'], 'StartEvent_1');
  } finally {
    cleanup(cwd);
  }
});

test('annotate adds text annotation to specified element', async () => {
  const cwd = tmpDir();
  try {
    await setupModel('proc', cwd);
    await append(['user-task', 'Review'], cwd);

    await annotate(['Must complete in 24h', 'StartEvent_1'], cwd);

    const status = await getStatus(cwd);
    const proc = status['process'] as Record<string, unknown>;
    const artifacts = proc['artifacts'] as Array<Record<string, unknown>>;
    assert.ok(artifacts, 'artifacts should exist');
    assert.equal(artifacts.length, 1);
    assert.equal(artifacts[0]['associatedTo'], 'StartEvent_1');
  } finally {
    cleanup(cwd);
  }
});

test('annotate does not move cursor', async () => {
  const cwd = tmpDir();
  try {
    await setupModel('proc', cwd);
    await append(['user-task', 'Review'], cwd);
    const stateBefore = readState(cwd);

    await annotate(['Important note'], cwd);

    const stateAfter = readState(cwd);
    assert.equal(stateAfter.cursor, stateBefore.cursor, 'cursor must not move');
  } finally {
    cleanup(cwd);
  }
});

test('annotate throws when element not found', async () => {
  const cwd = tmpDir();
  try {
    await setupModel('proc', cwd);
    await assert.rejects(() => annotate(['some text', 'Activity_99'], cwd), /not found/);
  } finally {
    cleanup(cwd);
  }
});

test('annotate throws without required arguments', async () => {
  const cwd = tmpDir();
  try {
    await setupModel('proc', cwd);
    await assert.rejects(() => annotate([], cwd), /Usage/);
  } finally {
    cleanup(cwd);
  }
});

test('annotate multiple annotations on same element', async () => {
  const cwd = tmpDir();
  try {
    await setupModel('proc', cwd);
    await annotate(['First note'], cwd);
    await annotate(['Second note'], cwd);

    const status = await getStatus(cwd);
    const proc = status['process'] as Record<string, unknown>;
    const artifacts = proc['artifacts'] as Array<Record<string, unknown>>;
    assert.ok(artifacts, 'artifacts should exist');
    assert.equal(artifacts.length, 2);
    assert.equal(artifacts[0]['text'], 'First note');
    assert.equal(artifacts[1]['text'], 'Second note');
  } finally {
    cleanup(cwd);
  }
});

test('annotate generates unique IDs', async () => {
  const cwd = tmpDir();
  try {
    await setupModel('proc', cwd);
    await annotate(['Note A'], cwd);
    await annotate(['Note B'], cwd);

    const status = await getStatus(cwd);
    const proc = status['process'] as Record<string, unknown>;
    const artifacts = proc['artifacts'] as Array<Record<string, unknown>>;
    const ids = artifacts.map((a) => a['id']);
    assert.equal(new Set(ids).size, ids.length, 'all annotation IDs should be unique');
  } finally {
    cleanup(cwd);
  }
});
