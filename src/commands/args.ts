/**
 * Matches *auto-generated* element IDs only (`Activity_1`, `Gateway_2`, etc.).
 * Do NOT use this to validate or detect semantic IDs — use BPMN_ID_PATTERN for that.
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

/** Maps CLI flag names to their updateElementProperty path and repeat/split behaviour. */
export const FLAG_TO_PROP: Record<string, { prop: string; repeated?: true; splitChar?: string }> = {
  'name':                     { prop: 'name' },
  'task-type':                { prop: 'zeebe:taskDefinition.type' },
  'task-retries':             { prop: 'zeebe:taskDefinition.retries' },
  'input':                    { prop: 'zeebe:input',   repeated: true, splitChar: '=' },
  'output':                   { prop: 'zeebe:output',  repeated: true, splitChar: '=' },
  'header':                   { prop: 'zeebe:header',  repeated: true, splitChar: '=' },
  'ext-property':             { prop: 'zeebe:property', repeated: true, splitChar: '=' },
  'assignee':                 { prop: 'zeebe:assignmentDefinition.assignee' },
  'candidate-groups':         { prop: 'zeebe:assignmentDefinition.candidateGroups' },
  'candidate-users':          { prop: 'zeebe:assignmentDefinition.candidateUsers' },
  'due-date':                 { prop: 'zeebe:taskSchedule.dueDate' },
  'follow-up-date':           { prop: 'zeebe:taskSchedule.followUpDate' },
  'priority':                 { prop: 'zeebe:priorityDefinition.priority' },
  'user-task-disabled':       { prop: 'zeebe:userTask.disabled' },
  'form-id':                  { prop: 'zeebe:formDefinition.formId' },
  'form-key':                 { prop: 'zeebe:formDefinition.formKey' },
  'form-external-ref':        { prop: 'zeebe:formDefinition.externalReference' },
  'form-binding-type':        { prop: 'zeebe:formDefinition.bindingType' },
  'form-version-tag':         { prop: 'zeebe:formDefinition.versionTag' },
  'script-expression':        { prop: 'zeebe:script.expression' },
  'script-result-var':        { prop: 'zeebe:script.resultVariable' },
  'decision-id':              { prop: 'zeebe:calledDecision.decisionId' },
  'decision-result':          { prop: 'zeebe:calledDecision.resultVariable' },
  'decision-binding-type':    { prop: 'zeebe:calledDecision.bindingType' },
  'decision-version-tag':     { prop: 'zeebe:calledDecision.versionTag' },
  'called-process-id':        { prop: 'zeebe:calledElement.processId' },
  'called-process-id-expr':   { prop: 'zeebe:calledElement.processIdExpression' },
  'propagate-all-child-vars': { prop: 'zeebe:calledElement.propagateAllChildVariables' },
  'propagate-all-parent-vars':{ prop: 'zeebe:calledElement.propagateAllParentVariables' },
  'called-binding-type':      { prop: 'zeebe:calledElement.bindingType' },
  'called-version-tag':       { prop: 'zeebe:calledElement.versionTag' },
  'execution-listener':       { prop: 'zeebe:executionListener', repeated: true, splitChar: '=' },
  'task-listener':            { prop: 'zeebe:taskListener',      repeated: true, splitChar: '=' },
  'signal-name':              { prop: 'signalRef' },
  'message-name':             { prop: 'messageRef' },
  'correlation-key':          { prop: 'zeebe:subscription.correlationKey' },
  'is-interrupting':          { prop: 'isInterrupting' },
  'time-duration':            { prop: 'timer.timeDuration' },
  'time-cycle':               { prop: 'timer.timeCycle' },
  'time-date':                { prop: 'timer.timeDate' },
  'condition-variable-names': { prop: 'zeebe:conditionalFilter.variableNames' },
  'condition-variable-events':{ prop: 'zeebe:conditionalFilter.variableEvents' },
  'multi-instance':           { prop: 'multi-instance.type' },
  'loop-input-collection':    { prop: 'zeebe:loopCharacteristics.inputCollection' },
  'loop-input-element':       { prop: 'zeebe:loopCharacteristics.inputElement' },
  'loop-output-collection':   { prop: 'zeebe:loopCharacteristics.outputCollection' },
  'loop-output-element':      { prop: 'zeebe:loopCharacteristics.outputElement' },
  'linked-resource':          { prop: 'zeebe:linkedResource', repeated: true, splitChar: '=' },
  'adhoc-ordering':           { prop: 'ad-hoc.ordering' },
  'adhoc-cancel-remaining':   { prop: 'ad-hoc.cancelRemainingInstances' },
  'adhoc-output-collection':  { prop: 'zeebe:adHoc.outputCollection' },
  'adhoc-output-element':     { prop: 'zeebe:adHoc.outputElement' },
  'adhoc-active-elements':    { prop: 'zeebe:adHoc.activeElementsCollection' },
};

/** Flags consumed at the command layer — never forwarded to updateElementProperty. */
export const COMMAND_ONLY_FLAGS = new Set(['id', 'freeze-cursor', 'boundary', 'parent']);

import { flagStrings, parseArgs } from '../args.js';
import { updateElementProperty } from '../bpmn.js';
import type { CommandLogger } from '../logger.js';
import type { BpmnModdle } from 'bpmn-moddle';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ModdleElement = any;

/**
 * Applies all Zeebe property flags present in rawArgs to el.
 * Skips COMMAND_ONLY_FLAGS. Handles repeated flags (--input, --output, etc.)
 * and splitChar for "key=value" formats.
 */
export function applyZeebeFlags(
  moddle: BpmnModdle,
  el: ModdleElement,
  rawArgs: string[],
  definitions: ModdleElement,
  logger?: CommandLogger,
): void {
  const { flags } = parseArgs(rawArgs);
  for (const [flagName, { prop, repeated, splitChar }] of Object.entries(FLAG_TO_PROP)) {
    if (COMMAND_ONLY_FLAGS.has(flagName)) continue;
    if (repeated) {
      const vals = flagStrings(rawArgs, flagName);
      for (const v of vals) {
        const values = splitChar
          ? (() => { const idx = v.lastIndexOf(splitChar); return idx === -1 ? [v] : [v.slice(0, idx), v.slice(idx + 1)]; })()
          : [v];
        updateElementProperty(moddle, el, prop, values, definitions, logger);
      }
    } else {
      const raw = flags[flagName];
      if (raw === undefined) continue;
      const value = typeof raw === 'string' ? raw : '';
      updateElementProperty(moddle, el, prop, [value], definitions, logger);
    }
  }
}
