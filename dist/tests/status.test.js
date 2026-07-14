import { test } from 'node:test';
import assert from 'node:assert/strict';
import { append } from '../commands/append.js';
import { update } from '../commands/update.js';
import { tmpDir, cleanup, setupModel, getStatus } from './helpers.js';
test('status output contains cursor field', async () => {
    const cwd = tmpDir();
    try {
        await setupModel('proc', cwd);
        const status = await getStatus(cwd);
        assert.equal(status['cursor'], 'StartEvent_1');
    }
    finally {
        cleanup(cwd);
    }
});
test('status output contains process id and name', async () => {
    const cwd = tmpDir();
    try {
        await setupModel('proc', cwd);
        const status = await getStatus(cwd);
        const proc = status['process'];
        assert.equal(proc['id'], 'proc');
        assert.equal(proc['name'], 'proc');
    }
    finally {
        cleanup(cwd);
    }
});
test('status lists all elements excluding sequence flows', async () => {
    const cwd = tmpDir();
    try {
        await setupModel('proc', cwd);
        await append(['user-task', 'Review'], cwd);
        await append(['end-event', 'Done'], cwd);
        const status = await getStatus(cwd);
        const proc = status['process'];
        const elements = proc['elements'];
        const flows = proc['flows'];
        assert.equal(elements.length, 3); // StartEvent_1, Activity_1, EndEvent_1
        assert.equal(flows.length, 2);
    }
    finally {
        cleanup(cwd);
    }
});
test('status lists sequence flows with source and target', async () => {
    const cwd = tmpDir();
    try {
        await setupModel('proc', cwd);
        await append(['end-event', 'Done'], cwd);
        const status = await getStatus(cwd);
        const proc = status['process'];
        const flows = proc['flows'];
        const flow = flows[0];
        assert.ok('id' in flow);
        assert.equal(flow['source'], 'StartEvent_1');
        assert.equal(flow['target'], 'EndEvent_1');
    }
    finally {
        cleanup(cwd);
    }
});
test('status shows zeebe extension data on elements', async () => {
    const cwd = tmpDir();
    try {
        await setupModel('proc', cwd);
        await append(['service-task', 'Execute'], cwd);
        await update(['zeebe:taskDefinition.type', 'my-worker'], cwd);
        const status = await getStatus(cwd);
        const proc = status['process'];
        const elements = proc['elements'];
        const el = elements.find((e) => e['id'] === 'Activity_1');
        const zeebe = el?.['zeebe'];
        const td = zeebe?.['taskDefinition'];
        assert.equal(td?.['type'], 'my-worker');
    }
    finally {
        cleanup(cwd);
    }
});
test('status shows boundary event with attachedToRef and cancelActivity', async () => {
    const cwd = tmpDir();
    try {
        await setupModel('proc', cwd);
        await append(['user-task', 'Review'], cwd); // Activity_1
        await append(['--boundary', 'timer', 'Timeout'], cwd); // BoundaryEvent_1 (interrupting)
        await append(['--boundary', 'non-interrupting-message', 'Escalation', 'Activity_1'], cwd); // BoundaryEvent_2
        const status = await getStatus(cwd);
        const proc = status['process'];
        const elements = proc['elements'];
        const timerBe = elements.find((e) => e['id'] === 'BoundaryEvent_1');
        assert.equal(timerBe?.['attachedToRef'], 'Activity_1');
        assert.equal(timerBe?.['cancelActivity'], true);
        assert.ok(!('incoming' in (timerBe ?? {})), 'boundary events should not have incoming field');
        const msgBe = elements.find((e) => e['id'] === 'BoundaryEvent_2');
        assert.equal(msgBe?.['attachedToRef'], 'Activity_1');
        assert.equal(msgBe?.['cancelActivity'], false);
    }
    finally {
        cleanup(cwd);
    }
});
test('status cursor reflects current cursor position', async () => {
    const cwd = tmpDir();
    try {
        await setupModel('proc', cwd);
        await append(['user-task', 'Review'], cwd); // cursor → Activity_1
        const status = await getStatus(cwd);
        assert.equal(status['cursor'], 'Activity_1');
    }
    finally {
        cleanup(cwd);
    }
});
test('status elements include incoming and outgoing flow ids for non-boundary elements', async () => {
    const cwd = tmpDir();
    try {
        await setupModel('proc', cwd);
        await append(['end-event', 'Done'], cwd);
        const status = await getStatus(cwd);
        const proc = status['process'];
        const elements = proc['elements'];
        const flows = proc['flows'];
        const startEl = elements.find((e) => e['id'] === 'StartEvent_1');
        const endEl = elements.find((e) => e['id'] === 'EndEvent_1');
        assert.ok(Array.isArray(startEl?.['outgoing']));
        assert.equal((startEl?.['outgoing']).length, 1);
        assert.equal((startEl?.['outgoing'])[0], flows[0]['id']);
        assert.ok(Array.isArray(endEl?.['incoming']));
        assert.equal((endEl?.['incoming']).length, 1);
    }
    finally {
        cleanup(cwd);
    }
});
