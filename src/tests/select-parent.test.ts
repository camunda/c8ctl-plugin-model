import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addChild } from '../commands/add-child.js';
import { selectParent } from '../commands/select-parent.js';
import { append } from '../commands/append.js';
import { readState } from '../state.js';
import { tmpDir, cleanup, setupModel } from './helpers.js';

test('select-parent moves cursor from child to parent subprocess', async () => {
  const cwd = tmpDir();
  try {
    await setupModel('proc', cwd);
    await append(['sub-process', 'My Sub'], cwd); // Activity_1, cursor → Activity_1
    await addChild(['user-task', 'Inner Task'], cwd); // Activity_2, cursor → Activity_2

    await selectParent([], cwd);
    const state = readState(cwd);
    assert.equal(state.cursor, 'Activity_1');
  } finally {
    cleanup(cwd);
  }
});

test('select-parent from top-level element throws', async () => {
  const cwd = tmpDir();
  try {
    await setupModel('proc', cwd);
    await assert.rejects(() => selectParent([], cwd), /no parent subprocess/);
  } finally {
    cleanup(cwd);
  }
});

test('select-parent enables appending at parent scope after navigating inside', async () => {
  const cwd = tmpDir();
  try {
    await setupModel('proc', cwd);
    await append(['sub-process', 'My Sub'], cwd); // Activity_1, cursor → Activity_1
    await addChild(['start-event', 'Inner Start'], cwd); // StartEvent_2, cursor → StartEvent_2
    await selectParent([], cwd); // cursor → Activity_1
    await append(['end-event', 'End'], cwd); // EndEvent_1 at top level

    const state = readState(cwd);
    assert.equal(state.cursor, 'EndEvent_1');
  } finally {
    cleanup(cwd);
  }
});
