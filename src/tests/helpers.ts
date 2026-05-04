import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { init } from '../commands/init.js';
import { readState } from '../state.js';
import type { CursorState } from '../state.js';
import { loadFile, toStatusJson } from '../bpmn.js';

export function tmpDir(): string {
  return mkdtempSync(join(tmpdir(), 'c8ctl-test-'));
}

export function cleanup(cwd: string): void {
  rmSync(cwd, { recursive: true, force: true });
}

export async function setupModel(name: string, cwd: string): Promise<CursorState> {
  await init([name], cwd);
  return readState(cwd);
}

export async function getStatus(cwd: string): Promise<ReturnType<typeof toStatusJson>> {
  const state = readState(cwd);
  const { definitions } = await loadFile(state.file);
  return toStatusJson(definitions, state.cursor);
}
