import { loadFile, saveFile, getElementById, updateElementProperty, renameElementId } from '../bpmn.js';
import { readState, writeState } from '../state.js';
import type { CommandLogger } from '../logger.js';

// Matches any valid BPMN element ID (xsd:ID: starts with letter or underscore,
// followed by letters, digits, underscores, hyphens, or dots; no colon allowed).
const BPMN_ID_RE = /^[A-Za-z_][\w.-]*$/;

// Known property-name patterns for the update command.
// Used to distinguish an explicit element-ID first arg from a property name.
function looksLikeProperty(s: string): boolean {
  if (/^(?:name|id|isInterrupting|documentation)$/.test(s)) return true;
  if (s.startsWith('zeebe:') || s.startsWith('timer.') ||
      s.startsWith('ad-hoc.') || s.startsWith('multi-instance.')) return true;
  return false;
}

export async function update(args: string[], cwd: string, logger?: CommandLogger): Promise<void> {
  let targetId: string | undefined;
  let remaining = args;

  // If first positional looks like a BPMN ID (not a property name) and there
  // are at least 3 args (elementId + property + value), treat it as an explicit
  // element target. This supports both auto-generated IDs (Activity_1) and
  // semantic IDs (ReviewTask, ApprovalDecision).
  if (args.length >= 3 && BPMN_ID_RE.test(args[0]) && looksLikeProperty(args[1])) {
    targetId = args[0];
    remaining = args.slice(1);
  }

  const [prop, ...values] = remaining;
  if (!prop || values.length === 0) {
    throw new Error(
      'Usage: c8ctl model update [elementId] <property> <value...>\n' +
        'Properties: name, id, signalRef <name>, messageRef <name>,\n' +
        '            zeebe:taskDefinition.type, zeebe:taskDefinition.retries,\n' +
        '            zeebe:input <source> <target>, zeebe:output <source> <target>,\n' +
        '            zeebe:header <key> <value>, zeebe:property <name> <value>,\n' +
        '            timer.timeDuration <ISO-8601>, timer.timeCycle <ISO-8601>, timer.timeDate <ISO-8601>',
    );
  }

  const state = readState();
  const resolvedId = targetId ?? state.cursor;

  const { moddle, definitions } = await loadFile(state.file);
  const el = getElementById(definitions, resolvedId);
  if (!el) throw new Error(`Element '${resolvedId}' not found`);

  if (prop === 'id') {
    if (values.length !== 1) {
      throw new Error('Usage: c8ctl model update [elementId] id <new-id>');
    }
    const newId = values[0];
    renameElementId(definitions, el, newId);
    await saveFile(state.file, moddle, definitions);
    const newState = state.cursor === resolvedId ? { ...state, cursor: newId } : state;
    writeState(newState);
    logger?.success(`Renamed ID '${resolvedId}' to '${newId}'`);
    logger?.info(`Cursor: ${newState.cursor}`);
  } else {
    updateElementProperty(moddle, el, prop, values, definitions, logger);
    await saveFile(state.file, moddle, definitions);
    logger?.success(`Updated '${prop}' on ${el.id}`);
  }
}
