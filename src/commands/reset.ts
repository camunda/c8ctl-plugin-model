import { deleteState, stateExists } from '../state.js';
import type { CommandLogger } from '../logger.js';

export async function reset(_args: string[], cwd: string, logger?: CommandLogger): Promise<void> {
  if (!stateExists()) {
    logger?.warn('No active model found.');
    return;
  }
  deleteState();
  logger?.success('Model state cleared. The .bpmn file is kept.');
}
