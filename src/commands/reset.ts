import { deleteState, stateExists } from '../state.js';
import type { CommandLogger } from '../logger.js';

export async function reset(_args: string[], cwd: string, logger?: CommandLogger): Promise<void> {
  if (!stateExists(cwd)) {
    logger?.warn('No active model found in current directory.');
    return;
  }
  deleteState(cwd);
  logger?.success('Model state cleared. The .bpmn file is kept.');
}
