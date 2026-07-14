import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addChild } from '../commands/add-child.js';
import { append } from '../commands/append.js';
import { readState } from '../state.js';
import { tmpDir, cleanup, setupModel, getStatus } from './helpers.js';
test('add-child adds element inside subprocess and moves cursor', async () => {
    const cwd = tmpDir();
    try {
        await setupModel('proc', cwd);
        await append(['sub-process', 'My Sub'], cwd); // Activity_1, cursor → Activity_1
        await addChild(['user-task', 'Inner Task'], cwd); // Activity_2, cursor → Activity_2
        const state = readState();
        assert.equal(state.cursor, 'Activity_2');
        const status = await getStatus(cwd);
        const proc = status['process'];
        const elements = proc['elements'];
        const sub = elements.find((e) => e['id'] === 'Activity_1');
        assert.ok(sub, 'subprocess should exist at top level');
        const children = sub['children'];
        assert.ok(children?.some((c) => c['id'] === 'Activity_2'), 'Activity_2 should be inside subprocess');
    }
    finally {
        cleanup(cwd);
    }
});
test('add-child throws when cursor is not a subprocess', async () => {
    const cwd = tmpDir();
    try {
        await setupModel('proc', cwd);
        await assert.rejects(() => addChild(['user-task', 'Task'], cwd), /sub-process/);
    }
    finally {
        cleanup(cwd);
    }
});
test('append after add-child chains inside subprocess', async () => {
    const cwd = tmpDir();
    try {
        await setupModel('proc', cwd);
        await append(['sub-process', 'My Sub'], cwd); // Activity_1, cursor → Activity_1
        await addChild(['start-event', 'Inner Start'], cwd); // StartEvent_2, cursor → StartEvent_2
        await append(['end-event', 'Inner End'], cwd); // EndEvent_1, cursor → EndEvent_1
        const state = readState();
        assert.equal(state.cursor, 'EndEvent_1');
        const status = await getStatus(cwd);
        const proc = status['process'];
        const elements = proc['elements'];
        const sub = elements.find((e) => e['id'] === 'Activity_1');
        const children = sub?.['children'];
        assert.ok(children?.some((c) => c['id'] === 'EndEvent_1'), 'EndEvent_1 should be inside subprocess');
        const childFlows = sub?.['childFlows'];
        const flow = childFlows?.find((f) => f['source'] === 'StartEvent_2' && f['target'] === 'EndEvent_1');
        assert.ok(flow, 'flow from StartEvent_2 to EndEvent_1 should exist inside subprocess');
    }
    finally {
        cleanup(cwd);
    }
});
test('add-child element IDs are globally unique', async () => {
    const cwd = tmpDir();
    try {
        await setupModel('proc', cwd);
        await append(['sub-process', 'My Sub'], cwd); // Activity_1
        await addChild(['user-task', 'Task A'], cwd); // Activity_2, cursor → Activity_2
        await append(['user-task', 'Task B'], cwd); // Activity_3 inside subprocess
        const status = await getStatus(cwd);
        const proc = status['process'];
        const elements = proc['elements'];
        const sub = elements.find((e) => e['id'] === 'Activity_1');
        const children = sub?.['children'];
        const ids = children?.map((c) => c['id']) ?? [];
        assert.equal(new Set(ids).size, ids.length, 'child IDs must be unique');
        assert.ok(ids.includes('Activity_2'), 'Activity_2 should exist');
        assert.ok(ids.includes('Activity_3'), 'Activity_3 should exist');
    }
    finally {
        cleanup(cwd);
    }
});
test('add-child throws without required arguments', async () => {
    const cwd = tmpDir();
    try {
        await setupModel('proc', cwd);
        await append(['sub-process', 'My Sub'], cwd);
        await assert.rejects(() => addChild(['user-task'], cwd), /Usage/);
        await assert.rejects(() => addChild([], cwd), /Usage/);
    }
    finally {
        cleanup(cwd);
    }
});
