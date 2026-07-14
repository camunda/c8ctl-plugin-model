import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { init } from '../commands/init.js';
import { readState, deleteState } from '../state.js';
import { loadFile, toStatusJson } from '../bpmn.js';
export function tmpDir() {
    const dir = mkdtempSync(join(tmpdir(), 'c8ctl-test-'));
    process.env.C8CTL_STATE_FILE = join(dir, '.c8ctl-model.json');
    return dir;
}
export function cleanup(cwd) {
    deleteState();
    rmSync(cwd, { recursive: true, force: true });
    delete process.env.C8CTL_STATE_FILE;
}
export async function setupModel(name, cwd) {
    await init([name], cwd);
    return readState();
}
export async function getStatus(cwd) {
    const state = readState();
    const { definitions } = await loadFile(state.file);
    return toStatusJson(definitions, state.cursor);
}
