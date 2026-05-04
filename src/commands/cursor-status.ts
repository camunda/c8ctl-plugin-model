import { loadFile, getElementById } from '../bpmn.js';
import { readState } from '../state.js';

export async function cursorStatus(_args: string[], cwd: string): Promise<void> {
  const state = readState(cwd);
  const { definitions } = await loadFile(state.file);
  const el = getElementById(definitions, state.cursor);

  const type = el ? (el.$type as string).replace('bpmn:', '') : 'unknown';
  const name = el?.name ?? '';

  console.log(JSON.stringify({ cursor: state.cursor, type, name, file: state.file }, null, 2));
}
