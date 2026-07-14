import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { selectFile } from '../commands/select-file.js';
import { init } from '../commands/init.js';
import { append } from '../commands/append.js';
import { readState } from '../state.js';
import { tmpDir, cleanup, setupModel } from './helpers.js';
test('select-file switches to another .bpmn file', async () => {
    const cwd = tmpDir();
    try {
        const { reset } = await import('../commands/reset.js');
        await init(['proc-a'], cwd);
        await reset([], cwd);
        await init(['proc-b'], cwd);
        // Active file is proc-b; switch to proc-a.
        await selectFile(['proc-a'], cwd);
        const state = readState();
        assert.ok(state.file.endsWith('proc-a.bpmn'));
    }
    finally {
        cleanup(cwd);
    }
});
test('select-file accepts path with .bpmn extension', async () => {
    const cwd = tmpDir();
    try {
        await setupModel('proc-a', cwd);
        const { reset } = await import('../commands/reset.js');
        await reset([], cwd);
        await setupModel('proc-b', cwd);
        await selectFile(['proc-a.bpmn'], cwd);
        const state = readState();
        assert.ok(state.file.endsWith('proc-a.bpmn'));
    }
    finally {
        cleanup(cwd);
    }
});
test('select-file preserves cursor when element exists in new file', async () => {
    const cwd = tmpDir();
    try {
        // Both files share StartEvent_1 (created by init)
        await setupModel('proc-a', cwd);
        const { reset } = await import('../commands/reset.js');
        await reset([], cwd);
        await setupModel('proc-b', cwd);
        // cursor is StartEvent_1 in proc-b; switch to proc-a which also has StartEvent_1
        await selectFile(['proc-a'], cwd);
        const state = readState();
        assert.equal(state.cursor, 'StartEvent_1');
    }
    finally {
        cleanup(cwd);
    }
});
test('select-file resets cursor to first element when cursor not in new file', async () => {
    const cwd = tmpDir();
    try {
        await setupModel('proc-a', cwd);
        await append(['user-task', 'Review'], cwd); // Activity_1 in proc-a, cursor → Activity_1
        const { reset } = await import('../commands/reset.js');
        await reset([], cwd);
        await setupModel('proc-b', cwd); // proc-b only has StartEvent_1
        // Switch to proc-a which has Activity_1; cursor in proc-b state is StartEvent_1 — preserved
        // To get the reset path, do it the other way:
        // cursor is StartEvent_1 (proc-b). switch to proc-a — StartEvent_1 exists → preserved.
        // That doesn't hit the reset path. We need proc-b cursor to be an ID missing from proc-a.
        // Manually set cursor to something that won't exist in proc-a.
        const { writeState } = await import('../state.js');
        const state = readState();
        writeState({ ...state, cursor: 'Activity_99' });
        await selectFile(['proc-b'], cwd); // proc-b has no Activity_99
        const after = readState();
        assert.equal(after.cursor, 'StartEvent_1'); // reset to first element
        assert.ok(after.file.endsWith('proc-b.bpmn'));
    }
    finally {
        cleanup(cwd);
    }
});
test('select-file throws when file not found', async () => {
    const cwd = tmpDir();
    try {
        await setupModel('proc', cwd);
        await assert.rejects(() => selectFile(['nonexistent'], cwd), /File not found/);
    }
    finally {
        cleanup(cwd);
    }
});
test('select-file throws without argument', async () => {
    const cwd = tmpDir();
    try {
        await setupModel('proc', cwd);
        await assert.rejects(() => selectFile([], cwd), /Usage/);
    }
    finally {
        cleanup(cwd);
    }
});
test('select-file succeeds when no model state exists and sets cursor to first element', async () => {
    const cwd = tmpDir();
    try {
        await setupModel('proc', cwd);
        const { reset } = await import('../commands/reset.js');
        await reset([], cwd);
        await selectFile(['proc'], cwd);
        const state = readState();
        assert.ok(state.file.endsWith('proc.bpmn'));
        assert.ok(state.cursor.length > 0);
    }
    finally {
        cleanup(cwd);
    }
});
test('select-file accepts an absolute path', async () => {
    const cwd = tmpDir();
    try {
        await setupModel('proc-a', cwd);
        const { reset } = await import('../commands/reset.js');
        await reset([], cwd);
        await setupModel('proc-b', cwd);
        const absPath = join(cwd, 'proc-a.bpmn');
        await selectFile([absPath], cwd);
        const state = readState();
        assert.equal(state.file, absPath);
    }
    finally {
        cleanup(cwd);
    }
});
