import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { reset } from '../commands/reset.js';
import { stateExists, writeState } from '../state.js';
import { tmpDir, cleanup, setupModel } from './helpers.js';

test('reset removes state file', async () => {
  const cwd = tmpDir();
  try {
    await setupModel('proc', cwd);
    assert.ok(stateExists(cwd));
    await reset([], cwd);
    assert.ok(!stateExists(cwd));
  } finally {
    cleanup(cwd);
  }
});

test('reset keeps the .bpmn file', async () => {
  const cwd = tmpDir();
  try {
    await setupModel('proc', cwd);
    const bpmnPath = join(cwd, 'proc.bpmn');
    assert.ok(existsSync(bpmnPath));
    await reset([], cwd);
    assert.ok(existsSync(bpmnPath));
  } finally {
    cleanup(cwd);
  }
});

test('reset is a no-op when no state exists', async () => {
  const cwd = tmpDir();
  try {
    await assert.doesNotReject(() => reset([], cwd));
  } finally {
    cleanup(cwd);
  }
});

test('reset allows re-initializing the directory', async () => {
  const cwd = tmpDir();
  try {
    writeState(cwd, { file: join(cwd, 'old.bpmn'), cursor: 'StartEvent_1' });
    await reset([], cwd);
    // After reset, init should not throw about active model
    const { init } = await import('../commands/init.js');
    await assert.doesNotReject(() => init(['new-process'], cwd));
  } finally {
    cleanup(cwd);
  }
});
