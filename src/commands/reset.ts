import { deleteState, stateExists } from '../state.js';

export async function reset(_args: string[], cwd: string): Promise<void> {
  if (!stateExists(cwd)) {
    console.log('No active model found in current directory.');
    return;
  }
  deleteState(cwd);
  console.log('Model state cleared. The .bpmn file is kept.');
}
