/**
 * Matches auto-generated element IDs such as `Activity_1`, `Gateway_2`, `BoundaryEvent_3`.
 * Used to distinguish explicit element ID arguments from labels in command arg lists.
 */
export const ELEMENT_ID_PATTERN = /^[A-Za-z]+_\d+$/;

/** Re-exported from src/bpmn.ts — single source of truth for xsd:ID validation. */
export { BPMN_ID_PATTERN } from '../bpmn.js';

/**
 * Extracts `--id <value>` from an args array and returns the value and the
 * remaining args with the flag and its value removed.
 * Throws if `--id` is present but no value follows it.
 */
export function extractIdFlag(args: string[]): { id: string | undefined; remaining: string[] } {
  const idx = args.indexOf('--id');
  if (idx === -1) return { id: undefined, remaining: args };
  if (args.indexOf('--id', idx + 1) !== -1) {
    throw new Error('--id may only be specified once');
  }
  if (idx + 1 >= args.length || args[idx + 1].startsWith('--')) {
    throw new Error('--id requires a value');
  }
  const id = args[idx + 1];
  const remaining = [...args.slice(0, idx), ...args.slice(idx + 2)];
  return { id, remaining };
}
