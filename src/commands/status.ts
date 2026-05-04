import { loadFile, toStatusJson } from '../bpmn.js';
import { readState } from '../state.js';

export async function status(_args: string[], cwd: string): Promise<void> {
  const state = readState(cwd);
  const { definitions } = await loadFile(state.file);
  const json = toStatusJson(definitions, state.cursor);
  console.log(JSON.stringify(json, null, 2));
}
