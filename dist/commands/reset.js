import { deleteState, stateExists } from '../state.js';
export async function reset(_args, cwd, logger) {
    if (!stateExists()) {
        logger?.warn('No active model found.');
        return;
    }
    deleteState();
    logger?.success('Model state cleared. The .bpmn file is kept.');
}
