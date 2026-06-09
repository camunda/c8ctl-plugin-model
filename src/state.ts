import { readFileSync, writeFileSync, existsSync, unlinkSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

export interface CursorState {
  file: string;
  cursor: string;
}

function getStatePath(cwd?: string): string {
  if (process.env.C8CTL_STATE_FILE) return process.env.C8CTL_STATE_FILE;
  if (cwd) return join(cwd, '.c8ctl-model.json');
  const home = homedir();
  let dir: string;
  if (process.platform === 'darwin') {
    dir = join(home, 'Library', 'Application Support', 'camunda-modeler');
  } else if (process.platform === 'win32') {
    dir = join(process.env.APPDATA ?? join(home, 'AppData', 'Roaming'), 'camunda-modeler');
  } else {
    dir = join(process.env.XDG_CONFIG_HOME ?? join(home, '.config'), 'camunda-modeler');
  }
  return join(dir, 'c8ctl-model.json');
}

export function readState(cwd?: string): CursorState {
  const path = getStatePath(cwd);
  if (!existsSync(path)) {
    throw new Error('No model found. Run: c8ctl model init <name>');
  }
  return JSON.parse(readFileSync(path, 'utf-8')) as CursorState;
}

export function writeState(state: CursorState): void {
  const path = getStatePath();
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, JSON.stringify(state, null, 2));
}

export function deleteState(): void {
  const path = getStatePath();
  if (existsSync(path)) unlinkSync(path);
}

export function stateExists(): boolean {
  return existsSync(getStatePath());
}
