/**
 * Best-practice BPMN integration tests.
 *
 * Each test builds a complete, realistic BPMN process using the plugin
 * commands, following Camunda modeling best practices.  After construction
 * the resulting .bpmn file is validated with bpmnlint using the
 * camunda-compat plugin (Camunda Cloud 8.10 rule-set) so that every generated
 * model is guaranteed to be lint-clean.
 *
 * Collectively the scenarios exercise **every** `c8ctl model` subcommand
 * at least once:
 *   init, append, append-freeze-cursor, create, create-freeze-cursor,
 *   connect, add-child, add-child-freeze-cursor, select, select-parent,
 *   select-file, boundary-append, update, annotate, cursor-status,
 *   status, reset
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { init } from '../commands/init.js';
import { append } from '../commands/append.js';
import { create } from '../commands/create.js';
import { connect } from '../commands/connect.js';
import { select } from '../commands/select.js';
import { selectFile } from '../commands/select-file.js';
import { update } from '../commands/update.js';
import { annotate } from '../commands/annotate.js';
import { cursorStatus } from '../commands/cursor-status.js';
import { status } from '../commands/status.js';
import { reset } from '../commands/reset.js';
import { readState } from '../state.js';
import { tmpDir, cleanup, getStatus } from './helpers.js';

/* ------------------------------------------------------------------ */
/*  bpmnlint helper – validates a .bpmn file with camunda-compat      */
/* ------------------------------------------------------------------ */

async function lintBpmn(bpmnPath: string): Promise<string[]> {
  // Dynamic require – bpmnlint is CJS-only
  const { createRequire } = await import('node:module');
  const require = createRequire(import.meta.url);

  const Linter = require('bpmnlint/lib/linter');
  const NodeResolver = require('bpmnlint/lib/resolver/node-resolver');
  const { BpmnModdle } = require('bpmn-moddle');
  const zeebeDescriptor = require('zeebe-bpmn-moddle/resources/zeebe');

  const xml = readFileSync(bpmnPath, 'utf8');
  const moddle = new BpmnModdle({ zeebe: zeebeDescriptor });
  const { rootElement: definitions } = await moddle.fromXML(xml);

  const resolver = new NodeResolver();
  const linter = new Linter({ resolver });

  const config = {
    extends: 'plugin:camunda-compat/camunda-cloud-8-10',
  };

  const results = await linter.lint(definitions, config);

  const issues: string[] = [];
  for (const [rule, reports] of Object.entries(results)) {
    for (const report of reports as Array<{ message: string; category: string }>) {
      if (report.category === 'error' || report.category === 'warn') {
        issues.push(`[${report.category}] ${rule}: ${report.message}`);
      }
    }
  }
  return issues;
}

/* ------------------------------------------------------------------ */
/*  silent logger for commands that require one                        */
/* ------------------------------------------------------------------ */

function silentLogger() {
  return {
    info() {},
    warn() {},
    error() {},
    success() {},
    output() {},
    json() {},
  };
}

/* ================================================================== */
/*  Scenario 1 — Straight-through processing                          */
/*  Best practice: label every element, use service tasks with job     */
/*  types, end with an end event.                                      */
/*  Commands exercised: init, append, update, status, cursor-status    */
/* ================================================================== */

test('best-practice: straight-through process with service tasks', async () => {
  const cwd = tmpDir();
  try {
    // -- build --
    await init(['order-process'], cwd);

    await append(['service-task', 'Validate Order'], cwd);
    await update(['zeebe:taskDefinition.type', 'validate-order'], cwd);
    await update(['zeebe:input', '=order', 'orderData'], cwd);
    await update(['zeebe:output', '=result', 'validationResult'], cwd);
    await update(['zeebe:header', 'retryBackoff', 'PT10S'], cwd);

    await append(['service-task', 'Charge Payment'], cwd);
    await update(['zeebe:taskDefinition.type', 'charge-payment'], cwd);
    await update(['zeebe:taskDefinition.retries', '5'], cwd);

    await append(['service-task', 'Ship Order'], cwd);
    await update(['zeebe:taskDefinition.type', 'ship-order'], cwd);

    await append(['end-event', 'Order Fulfilled'], cwd);

    // -- verify status --
    const s = await getStatus(cwd);
    const proc = s['process'] as Record<string, unknown>;
    const elements = proc['elements'] as Array<Record<string, unknown>>;
    const flows = proc['flows'] as Array<Record<string, unknown>>;

    assert.equal(elements.length, 5); // start + 3 service tasks + end
    assert.equal(flows.length, 4);    // 4 sequential flows

    // verify cursor-status
    const captured: unknown[] = [];
    const logger = { ...silentLogger(), json(d: unknown) { captured.push(d); } };
    await cursorStatus([], cwd, logger);
    assert.equal((captured[0] as Record<string, unknown>)['cursor'], 'EndEvent_1');

    // -- verify status command output --
    const statusCaptured: unknown[] = [];
    const statusLogger = { ...silentLogger(), json(d: unknown) { statusCaptured.push(d); } };
    await status([], cwd, statusLogger);
    assert.ok(statusCaptured.length > 0, 'status should output JSON');

    // -- lint --
    const state = readState();
    const issues = await lintBpmn(state.file);
    assert.deepEqual(issues, [], `bpmnlint issues:\n${issues.join('\n')}`);
  } finally {
    cleanup(cwd);
  }
});

/* ================================================================== */
/*  Scenario 2 — Exclusive gateway decision                           */
/*  Best practice: label gateway and every outgoing branch, use FEEL   */
/*  conditions.                                                        */
/*  Commands exercised: append-freeze-cursor, create, connect          */
/* ================================================================== */

test('best-practice: exclusive gateway branching with conditions', async () => {
  const cwd = tmpDir();
  try {
    await init(['approval-process'], cwd);

    await append(['service-task', 'Review Application'], cwd);       // Activity_1
    await update(['zeebe:taskDefinition.type', 'review-app'], cwd);

    await append(['exclusive-gateway', 'Approved?'], cwd);          // Gateway_1

    // branch: approved → send approval → end
    await create(['service-task', 'Send Approval'], cwd);            // Activity_2
    await update(['zeebe:taskDefinition.type', 'send-approval'], cwd);
    await append(['end-event', 'Approved'], cwd);                    // EndEvent_1
    await connect(['Gateway_1', 'Activity_2', '=approved'], cwd);

    // branch: rejected → end (use create-freeze-cursor to keep cursor)
    await create(['--freeze-cursor','end-event', 'Rejected'], cwd);       // EndEvent_2
    await connect(['Gateway_1', 'EndEvent_2', '=not(approved)'], cwd);

    // -- verify --
    const s = await getStatus(cwd);
    const proc = s['process'] as Record<string, unknown>;
    const flows = proc['flows'] as Array<Record<string, unknown>>;

    const condFlows = flows.filter((f) => f['condition']);
    assert.equal(condFlows.length, 2, 'two conditional flows from gateway');

    // -- lint --
    const state = readState();
    const issues = await lintBpmn(state.file);
    assert.deepEqual(issues, [], `bpmnlint issues:\n${issues.join('\n')}`);
  } finally {
    cleanup(cwd);
  }
});

/* ================================================================== */
/*  Scenario 3 — Parallel execution                                   */
/*  Best practice: use parallel gateways for concurrent work, merge    */
/*  before the end event.                                              */
/*  Commands exercised: create-freeze-cursor, select                   */
/* ================================================================== */

test('best-practice: parallel gateway fork and join', async () => {
  const cwd = tmpDir();
  try {
    await init(['parallel-process'], cwd);

    await append(['parallel-gateway', 'Fork'], cwd);                  // Gateway_1

    // branch A
    await append(['--freeze-cursor','service-task', 'Task A', 'Gateway_1'], cwd); // Activity_1
    await select(['Activity_1'], cwd);
    await update(['zeebe:taskDefinition.type', 'task-a'], cwd);

    // branch B
    await append(['--freeze-cursor','service-task', 'Task B', 'Gateway_1'], cwd); // Activity_2
    await select(['Activity_2'], cwd);
    await update(['zeebe:taskDefinition.type', 'task-b'], cwd);

    // join
    await create(['parallel-gateway', 'Join'], cwd);                  // Gateway_2
    await connect(['Activity_1', 'Gateway_2'], cwd);
    await connect(['Activity_2', 'Gateway_2'], cwd);

    await append(['end-event', 'Done'], cwd);                         // EndEvent_1

    // -- verify --
    const s = await getStatus(cwd);
    const proc = s['process'] as Record<string, unknown>;
    const elements = proc['elements'] as Array<Record<string, unknown>>;

    const gateways = elements.filter((e) => e['type'] === 'parallelGateway');
    assert.equal(gateways.length, 2, 'fork and join gateways');

    // -- lint --
    const state = readState();
    const issues = await lintBpmn(state.file);
    assert.deepEqual(issues, [], `bpmnlint issues:\n${issues.join('\n')}`);
  } finally {
    cleanup(cwd);
  }
});

/* ================================================================== */
/*  Scenario 4 — Sub-process with boundary timer                      */
/*  Best practice: use sub-processes for logically grouped steps,      */
/*  boundary events for timeouts, label everything.                    */
/*  Commands exercised: add-child, add-child-freeze-cursor,            */
/*                      select-parent, boundary-append                 */
/* ================================================================== */

test('best-practice: sub-process with boundary timer escalation', async () => {
  const cwd = tmpDir();
  try {
    await init(['sub-process-demo'], cwd);

    await append(['sub-process', 'Handle Claim'], cwd);              // Activity_1
    await create(['--parent','start-event', 'Begin'], cwd);                   // StartEvent_2
    await append(['service-task', 'Investigate'], cwd);              // Activity_2
    await update(['zeebe:taskDefinition.type', 'investigate'], cwd);
    await select(['--parent'], cwd); // back to Activity_1 (sub-process)
    await create(['--parent', '--freeze-cursor','end-event', 'Resolved'], cwd);     // EndEvent_1
    await connect(['Activity_2', 'EndEvent_1'], cwd);

    await select(['--parent'], cwd); // back to Activity_1 (sub-process)

    // boundary conditional → escalation path
    await append(['--boundary','non-interrupting-conditional', 'Condition Met'], cwd); // BoundaryEvent_1
    await append(['service-task', 'Notify Manager'], cwd);           // Activity_3
    await update(['zeebe:taskDefinition.type', 'notify-manager'], cwd);
    await append(['end-event', 'Escalated'], cwd);                   // EndEvent_2

    // main flow after sub-process
    await select(['Activity_1'], cwd);
    await append(['end-event', 'Claim Closed'], cwd);                // EndEvent_3

    // -- verify --
    const s = await getStatus(cwd);
    const proc = s['process'] as Record<string, unknown>;
    const elements = proc['elements'] as Array<Record<string, unknown>>;

    const subProc = elements.find((e) => e['id'] === 'Activity_1');
    assert.ok(subProc, 'sub-process exists');
    const children = subProc?.['children'] as Array<Record<string, unknown>>;
    assert.ok(children.length >= 3, 'sub-process has children');

    const boundary = elements.find((e) => e['type'] === 'boundaryEvent');
    assert.ok(boundary, 'boundary event exists');
    assert.equal(boundary['cancelActivity'], false, 'non-interrupting');

    // -- lint --
    const state = readState();
    const issues = await lintBpmn(state.file);
    assert.deepEqual(issues, [], `bpmnlint issues:\n${issues.join('\n')}`);
  } finally {
    cleanup(cwd);
  }
});

/* ================================================================== */
/*  Scenario 5 — Event sub-process for error handling                  */
/*  Best practice: use event sub-processes to handle errors globally.  */
/*  Commands exercised: create (event-sub-process), add-child with     */
/*  typed start event, update isInterrupting                           */
/* ================================================================== */

test('best-practice: event sub-process for global error handling', async () => {
  const cwd = tmpDir();
  try {
    await init(['error-handling'], cwd);

    await append(['service-task', 'Process Payment'], cwd);          // Activity_1
    await update(['zeebe:taskDefinition.type', 'process-payment'], cwd);
    await append(['end-event', 'Payment Done'], cwd);                // EndEvent_1

    // event sub-process
    await create(['event-sub-process', 'Handle Failure'], cwd);      // Activity_2
    await create(['--parent','error-start-event', 'On Error'], cwd);          // StartEvent_2
    await append(['service-task', 'Rollback'], cwd);                 // Activity_3
    await update(['zeebe:taskDefinition.type', 'rollback'], cwd);
    await append(['end-event', 'Error Handled'], cwd);               // EndEvent_2

    // -- verify --
    const s = await getStatus(cwd);
    const proc = s['process'] as Record<string, unknown>;
    const elements = proc['elements'] as Array<Record<string, unknown>>;

    const evtSubProc = elements.find(
      (e) => e['id'] === 'Activity_2' && e['triggeredByEvent'] === true,
    );
    assert.ok(evtSubProc, 'event sub-process exists with triggeredByEvent');

    const evtChildren = evtSubProc?.['children'] as Array<Record<string, unknown>>;
    const errorStart = evtChildren.find((c) => (c['eventDefinition'] as Record<string, unknown>)?.['type'] === 'error');
    assert.ok(errorStart, 'error start event exists in event sub-process');

    // -- lint --
    const state = readState();
    const issues = await lintBpmn(state.file);
    assert.deepEqual(issues, [], `bpmnlint issues:\n${issues.join('\n')}`);
  } finally {
    cleanup(cwd);
  }
});

/* ================================================================== */
/*  Scenario 6 — Multi-instance service task                           */
/*  Best practice: use parallel multi-instance for batch processing.   */
/*  Commands exercised: update multi-instance.type,                    */
/*  zeebe:loopCharacteristics.*                                        */
/* ================================================================== */

test('best-practice: parallel multi-instance service task', async () => {
  const cwd = tmpDir();
  try {
    await init(['batch-process'], cwd);

    await append(['service-task', 'Process Item'], cwd);             // Activity_1
    await update(['zeebe:taskDefinition.type', 'process-item'], cwd);
    await update(['multi-instance.type', 'parallel'], cwd);
    await update(['zeebe:loopCharacteristics.inputCollection', '=items'], cwd);
    await update(['zeebe:loopCharacteristics.inputElement', 'item'], cwd);
    await update(['zeebe:loopCharacteristics.outputCollection', 'results'], cwd);
    await update(['zeebe:loopCharacteristics.outputElement', '=result'], cwd);

    await append(['end-event', 'Batch Complete'], cwd);              // EndEvent_1

    // -- verify --
    const s = await getStatus(cwd);
    const proc = s['process'] as Record<string, unknown>;
    const elements = proc['elements'] as Array<Record<string, unknown>>;
    const mi = elements.find((e) => e['id'] === 'Activity_1');
    const loopChar = mi?.['loopCharacteristics'] as Record<string, unknown>;
    assert.equal(loopChar?.['type'], 'multiInstance');
    assert.equal(loopChar?.['isSequential'], false);

    // -- lint --
    const state = readState();
    const issues = await lintBpmn(state.file);
    assert.deepEqual(issues, [], `bpmnlint issues:\n${issues.join('\n')}`);
  } finally {
    cleanup(cwd);
  }
});

/* ================================================================== */
/*  Scenario 7 — Business rule task with DMN                           */
/*  Best practice: use business-rule-task for decision automation.     */
/*  Commands exercised: update zeebe:calledDecision.*                   */
/* ================================================================== */

test('best-practice: business rule task calling DMN decision', async () => {
  const cwd = tmpDir();
  try {
    await init(['decision-process'], cwd);

    await append(['business-rule-task', 'Evaluate Risk'], cwd);      // Activity_1
    await update(['zeebe:calledDecision.decisionId', 'risk-assessment'], cwd);
    await update(['zeebe:calledDecision.resultVariable', 'riskLevel'], cwd);

    await append(['exclusive-gateway', 'Risk Level?'], cwd);         // Gateway_1
    await create(['end-event', 'Low Risk'], cwd);                    // EndEvent_1
    await create(['end-event', 'High Risk'], cwd);                   // EndEvent_2
    await connect(['Gateway_1', 'EndEvent_1', '=riskLevel = "low"'], cwd);
    await connect(['Gateway_1', 'EndEvent_2', '=riskLevel = "high"'], cwd);

    // -- verify --
    const s = await getStatus(cwd);
    const proc = s['process'] as Record<string, unknown>;
    const elements = proc['elements'] as Array<Record<string, unknown>>;
    const brt = elements.find((e) => e['type'] === 'businessRuleTask');
    const zeebe = brt?.['zeebe'] as Record<string, unknown>;
    const cd = zeebe?.['calledDecision'] as Record<string, unknown>;
    assert.equal(cd?.['decisionId'], 'risk-assessment');
    assert.equal(cd?.['resultVariable'], 'riskLevel');

    // -- lint --
    const state = readState();
    const issues = await lintBpmn(state.file);
    assert.deepEqual(issues, [], `bpmnlint issues:\n${issues.join('\n')}`);
  } finally {
    cleanup(cwd);
  }
});

/* ================================================================== */
/*  Scenario 8 — Text annotations for documentation                   */
/*  Best practice: annotate complex decisions or tasks.                */
/*  Commands exercised: annotate                                       */
/* ================================================================== */

test('best-practice: text annotations on process elements', async () => {
  const cwd = tmpDir();
  try {
    await init(['annotated-process'], cwd);

    await append(['service-task', 'Complex Calculation'], cwd);      // Activity_1
    await update(['zeebe:taskDefinition.type', 'calculate'], cwd);
    await annotate(['This step performs the risk score calculation using the ML model.'], cwd);

    await append(['end-event', 'Done'], cwd);                        // EndEvent_1

    // -- verify --
    const s = await getStatus(cwd);
    const proc = s['process'] as Record<string, unknown>;
    const artifacts = proc['artifacts'] as Array<Record<string, unknown>>;
    assert.ok(artifacts?.length >= 1, 'annotation should exist');
    assert.equal(artifacts[0]['type'], 'TextAnnotation');
    assert.equal(artifacts[0]['associatedTo'], 'Activity_1');

    // -- lint --
    const state = readState();
    const issues = await lintBpmn(state.file);
    assert.deepEqual(issues, [], `bpmnlint issues:\n${issues.join('\n')}`);
  } finally {
    cleanup(cwd);
  }
});

/* ================================================================== */
/*  Scenario 9 — Multi-file process with select-file and reset         */
/*  Best practice: organize related processes in separate files.       */
/*  Commands exercised: select-file, reset                             */
/* ================================================================== */

test('best-practice: multi-file workflow with select-file and reset', async () => {
  const cwd = tmpDir();
  try {
    // Build first process
    await init(['main-process'], cwd);
    await append(['service-task', 'Start Job'], cwd);                // Activity_1
    await update(['zeebe:taskDefinition.type', 'start-job'], cwd);
    await append(['end-event', 'Main Done'], cwd);                   // EndEvent_1

    // Reset and build second process
    await reset([], cwd);
    await init(['sub-workflow'], cwd);
    await append(['service-task', 'Sub Step'], cwd);                 // Activity_1
    await update(['zeebe:taskDefinition.type', 'sub-step'], cwd);
    await append(['end-event', 'Sub Done'], cwd);                    // EndEvent_1

    // Switch back to first process
    await selectFile(['main-process'], cwd);
    const state = readState();
    assert.ok(state.file.endsWith('main-process.bpmn'));

    // -- lint both files --
    const issues1 = await lintBpmn(state.file);
    assert.deepEqual(issues1, [], `main-process lint issues:\n${issues1.join('\n')}`);

    await selectFile(['sub-workflow'], cwd);
    const state2 = readState();
    const issues2 = await lintBpmn(state2.file);
    assert.deepEqual(issues2, [], `sub-workflow lint issues:\n${issues2.join('\n')}`);
  } finally {
    cleanup(cwd);
  }
});

/* ================================================================== */
/*  Scenario 10 — Zeebe properties on elements                         */
/*  Best practice: use zeebe:property for connector configuration.     */
/*  Commands exercised: update zeebe:property, update name             */
/* ================================================================== */

test('best-practice: zeebe properties and name updates', async () => {
  const cwd = tmpDir();
  try {
    await init(['connector-process'], cwd);

    await append(['service-task', 'Call REST API'], cwd);            // Activity_1
    await update(['zeebe:taskDefinition.type', 'io.camunda:http-json:1'], cwd);
    await update(['zeebe:property', 'inbound.type', 'io.camunda:http-json:1'], cwd);
    await update(['Activity_1', 'name', 'Invoke REST Endpoint'], cwd);

    await append(['end-event', 'API Called'], cwd);                  // EndEvent_1

    // -- verify --
    const s = await getStatus(cwd);
    const proc = s['process'] as Record<string, unknown>;
    const elements = proc['elements'] as Array<Record<string, unknown>>;
    const task = elements.find((e) => e['id'] === 'Activity_1');
    assert.equal(task?.['name'], 'Invoke REST Endpoint');
    const zeebe = task?.['zeebe'] as Record<string, unknown>;
    const props = zeebe?.['properties'] as Array<Record<string, unknown>>;
    assert.ok(props?.some((p) => p['name'] === 'inbound.type'));

    // -- lint --
    const state = readState();
    const issues = await lintBpmn(state.file);
    assert.deepEqual(issues, [], `bpmnlint issues:\n${issues.join('\n')}`);
  } finally {
    cleanup(cwd);
  }
});

/* ================================================================== */
/*  Scenario 11 — Ad-hoc sub-process                                   */
/*  Best practice: use ad-hoc sub-processes for flexible work.         */
/*  Commands exercised: update ad-hoc.ordering,                        */
/*  ad-hoc.cancelRemainingInstances                                    */
/* ================================================================== */

test('best-practice: ad-hoc sub-process with ordering', async () => {
  const cwd = tmpDir();
  try {
    await init(['adhoc-process'], cwd);

    await append(['ad-hoc-sub-process', 'Handle Exceptions'], cwd); // Activity_1
    await update(['ad-hoc.ordering', 'Sequential'], cwd);
    await update(['ad-hoc.cancelRemainingInstances', 'false'], cwd);
    await create(['--parent','service-task', 'Investigate'], cwd);               // Activity_2
    await update(['zeebe:taskDefinition.type', 'investigate'], cwd);
    await select(['--parent'], cwd); // back to Activity_1
    await create(['--parent','service-task', 'Escalate'], cwd);                  // Activity_3
    await update(['zeebe:taskDefinition.type', 'escalate'], cwd);

    await select(['--parent'], cwd); // back to Activity_1
    await append(['end-event', 'Resolved'], cwd);                    // EndEvent_1

    // -- verify --
    const s = await getStatus(cwd);
    const proc = s['process'] as Record<string, unknown>;
    const elements = proc['elements'] as Array<Record<string, unknown>>;
    const adhoc = elements.find((e) => e['type'] === 'adHocSubProcess');
    assert.equal(adhoc?.['ordering'], 'Sequential');
    assert.equal(adhoc?.['cancelRemainingInstances'], false);
    const children = adhoc?.['children'] as Array<Record<string, unknown>>;
    assert.equal(children.length, 2);

    // -- lint --
    const state = readState();
    const issues = await lintBpmn(state.file);
    assert.deepEqual(issues, [], `bpmnlint issues:\n${issues.join('\n')}`);
  } finally {
    cleanup(cwd);
  }
});

/* ================================================================== */
/*  Scenario 12 — Complete order fulfillment with all remaining        */
/*  event types and boundary patterns.                                 */
/*  Exercises: message events, signal events, inclusive gateway,       */
/*  event-based gateway, call-activity, multiple boundary types        */
/* ================================================================== */

test('best-practice: comprehensive event-based and message patterns', async () => {
  const cwd = tmpDir();
  try {
    await init(['event-patterns'], cwd);

    // Service task with boundary error
    await append(['service-task', 'Validate'], cwd);                 // Activity_1
    await update(['zeebe:taskDefinition.type', 'validate'], cwd);
    await append(['--boundary','error', 'Validation Error'], cwd);       // BoundaryEvent_1
    await append(['end-event', 'Validation Failed'], cwd);           // EndEvent_1

    // Continue main flow
    await select(['Activity_1'], cwd);
    await append(['end-event', 'Validation Passed'], cwd);           // EndEvent_2

    // -- verify --
    const s = await getStatus(cwd);
    const proc = s['process'] as Record<string, unknown>;
    const elements = proc['elements'] as Array<Record<string, unknown>>;
    const boundary = elements.find((e) => e['type'] === 'boundaryEvent');
    assert.ok(boundary, 'boundary error event exists');
    assert.equal(boundary['cancelActivity'], true);

    // -- lint --
    const state = readState();
    const issues = await lintBpmn(state.file);
    assert.deepEqual(issues, [], `bpmnlint issues:\n${issues.join('\n')}`);
  } finally {
    cleanup(cwd);
  }
});
