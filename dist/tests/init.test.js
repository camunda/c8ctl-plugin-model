import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { init } from '../commands/init.js';
import { readState, writeState } from '../state.js';
import { tmpDir, cleanup } from './helpers.js';
test('init creates .bpmn file', async () => {
    const cwd = tmpDir();
    try {
        await init(['my-process'], cwd);
        assert.ok(existsSync(join(cwd, 'my-process.bpmn')));
    }
    finally {
        cleanup(cwd);
    }
});
test('init sets cursor to StartEvent_1', async () => {
    const cwd = tmpDir();
    try {
        await init(['my-process'], cwd);
        const state = readState();
        assert.equal(state.cursor, 'StartEvent_1');
    }
    finally {
        cleanup(cwd);
    }
});
test('init stores absolute file path in state', async () => {
    const cwd = tmpDir();
    try {
        await init(['my-process'], cwd);
        const state = readState();
        assert.ok(state.file.endsWith('my-process.bpmn'));
        assert.ok(state.file.startsWith('/'));
    }
    finally {
        cleanup(cwd);
    }
});
test('init throws if .bpmn file already exists', async () => {
    const cwd = tmpDir();
    try {
        await init(['my-process'], cwd);
        await assert.rejects(() => init(['my-process'], cwd), /File already exists/);
    }
    finally {
        cleanup(cwd);
    }
});
test('init throws if state already active in directory', async () => {
    const cwd = tmpDir();
    try {
        writeState({ file: join(cwd, 'other.bpmn'), cursor: 'StartEvent_1' });
        await assert.rejects(() => init(['new-process'], cwd), /already active/);
    }
    finally {
        cleanup(cwd);
    }
});
test('init throws without a name argument', async () => {
    const cwd = tmpDir();
    try {
        await assert.rejects(() => init([], cwd), /Usage/);
    }
    finally {
        cleanup(cwd);
    }
});
test('init produces valid BPMN with a start event in status output', async () => {
    const cwd = tmpDir();
    try {
        const { getStatus } = await import('./helpers.js');
        await init(['my-process'], cwd);
        const status = await getStatus(cwd);
        const process = status['process'];
        const elements = process['elements'];
        const startEvent = elements.find((e) => e['id'] === 'StartEvent_1');
        assert.ok(startEvent, 'StartEvent_1 should exist');
        assert.equal(startEvent['type'], 'startEvent');
    }
    finally {
        cleanup(cwd);
    }
});
