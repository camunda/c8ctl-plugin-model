import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';

export interface CursorState {
  file: string;
  cursor: string;
}

const STATE_FILE = '.c8ctl-model.json';

export function readState(cwd: string): CursorState {
  const path = join(cwd, STATE_FILE);
  if (!existsSync(path)) {
    throw new Error('No model found in current directory. Run: c8ctl model init <name>');
  }
  return JSON.parse(readFileSync(path, 'utf-8')) as CursorState;
}

export function writeState(cwd: string, state: CursorState): void {
  writeFileSync(join(cwd, STATE_FILE), JSON.stringify(state, null, 2));
}

export function deleteState(cwd: string): void {
  const path = join(cwd, STATE_FILE);
  if (existsSync(path)) unlinkSync(path);
}

export function stateExists(cwd: string): boolean {
  return existsSync(join(cwd, STATE_FILE));
}
