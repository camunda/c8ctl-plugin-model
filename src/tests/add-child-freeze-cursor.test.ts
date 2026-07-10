import { test } from 'node:test';
import assert from 'node:assert/strict';
import { create } from '../commands/create.js';
import { append } from '../commands/append.js';
import { readState } from '../state.js';
import { tmpDir, cleanup, setupModel, getStatus } from './helpers.js';

test('add-child-freeze-cursor adds element without moving cursor', async () => {
  const cwd = tmpDir();
  try {
    await setupModel('proc', cwd);
    await append(['sub-process', 'My Sub'], cwd); // Activity_1, cursor → Activity_1

    const stateBefore = readState();
    await create(['--parent', '--freeze-cursor','user-task', 'Inner Task'], cwd);

    const stateAfter = readState();
    assert.equal(stateAfter.cursor, stateBefore.cursor, 'cursor must not move');

    const status = await getStatus(cwd);
    const proc = status['process'] as Record<string, unknown>;
    const elements = proc['elements'] as Array<Record<string, unknown>>;
    const sub = elements.find((e) => e['id'] === 'Activity_1');
    const children = sub?.['children'] as Array<Record<string, unknown>>;
    assert.ok(children?.some((c) => c['type'] === 'userTask'), 'user task should be inside subprocess');
  } finally {
    cleanup(cwd);
  }
});

test('add-child-freeze-cursor throws when cursor is not a subprocess', async () => {
  const cwd = tmpDir();
  try {
    await setupModel('proc', cwd);
    await assert.rejects(() => create(['--parent', '--freeze-cursor','user-task', 'Task'], cwd), /sub-process/);
  } finally {
    cleanup(cwd);
  }
});

test('add-child-freeze-cursor throws without required arguments', async () => {
  const cwd = tmpDir();
  try {
    await setupModel('proc', cwd);
    await append(['sub-process', 'My Sub'], cwd);
    await assert.rejects(() => create(['--parent', '--freeze-cursor','user-task'], cwd), /Usage/);
    await assert.rejects(() => create(['--parent', '--freeze-cursor',], cwd), /Usage/);
  } finally {
    cleanup(cwd);
  }
});
