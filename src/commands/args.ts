/**
 * Matches auto-generated element IDs such as `Activity_1`, `Gateway_2`, `BoundaryEvent_3`.
 * Used to distinguish explicit element ID arguments from labels in command arg lists.
 */
export const ELEMENT_ID_PATTERN = /^[A-Za-z]+_\d+$/;

/**
 * Extracts `--id <value>` from an args array and returns the value and the
 * remaining args with the flag and its value removed.
 */
export function extractIdFlag(args: string[]): { id: string | undefined; remaining: string[] } {
  const idx = args.indexOf('--id');
  if (idx === -1 || idx + 1 >= args.length) return { id: undefined, remaining: args };
  const id = args[idx + 1];
  const remaining = [...args.slice(0, idx), ...args.slice(idx + 2)];
  return { id, remaining };
}
