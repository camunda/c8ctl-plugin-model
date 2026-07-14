import { test } from 'node:test';
import assert from 'node:assert/strict';
import { append } from '../commands/append.js';
import { select } from '../commands/select.js';
import { readState } from '../state.js';
import { tmpDir, cleanup, setupModel } from './helpers.js';
test('select moves cursor to specified element', async () => {
    const cwd = tmpDir();
    try {
        await setupModel('proc', cwd);
        await append(['user-task', 'Review'], cwd); // Activity_1, cursor → Activity_1
        await select(['StartEvent_1'], cwd);
        const state = readState();
        assert.equal(state.cursor, 'StartEvent_1');
    }
    finally {
        cleanup(cwd);
    }
});
test('select preserves file path in state', async () => {
    const cwd = tmpDir();
    try {
        await setupModel('proc', cwd);
        const before = readState();
        await append(['user-task', 'Review'], cwd);
        await select(['StartEvent_1'], cwd);
        const after = readState();
        assert.equal(after.file, before.file);
    }
    finally {
        cleanup(cwd);
    }
});
test('select throws when element not found', async () => {
    const cwd = tmpDir();
    try {
        await setupModel('proc', cwd);
        await assert.rejects(() => select(['Activity_99'], cwd), /not found/);
    }
    finally {
        cleanup(cwd);
    }
});
test('select throws without element id argument', async () => {
    const cwd = tmpDir();
    try {
        await setupModel('proc', cwd);
        await assert.rejects(() => select([], cwd), /Usage/);
    }
    finally {
        cleanup(cwd);
    }
});
test('select throws when no model is initialized', async () => {
    const cwd = tmpDir();
    try {
        await assert.rejects(() => select(['StartEvent_1'], cwd), /No model found/);
    }
    finally {
        cleanup(cwd);
    }
});
