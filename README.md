# c8ctl-plugin-model

A [c8ctl](https://github.com/camunda/c8ctl) plugin for building BPMN process models incrementally from the CLI.

The plugin exposes a `model` command with subcommands for creating, navigating, and updating a BPMN file. A cursor tracks the last-touched element so that `append` and `update` work without supplying an element ID every time. The `.bpmn` file is always the source of truth; `.c8ctl-model.json` stores only the cursor position and active file path.

## Installation

```sh
c8ctl load plugin --from file://${PWD}
```

## Usage

```sh
c8ctl model <subcommand> [args]
```

### Subcommands

| Subcommand | Description |
| --- | --- |
| `init <name>` | Create a new process model |
| `append <type> <label> [sourceId] [--freeze-cursor] [--boundary] [--id <id>] [flags…]` | Append an element after cursor with a sequence flow; `--boundary` attaches a boundary event to the host instead; `--freeze-cursor` keeps cursor |
| `create <type> <label> [--parent] [--freeze-cursor] [--id <id>] [flags…]` | Create a standalone element (no sequence flow); `--parent` adds as child of cursor sub-process; `--freeze-cursor` keeps cursor |
| `connect <sourceId> <targetId> [condition]` | Create a sequence flow between two elements; cursor moves to target |
| `update [elementId] <property> <value...>` | Update a BPMN or Zeebe property on the cursor element (positional style) |
| `update [elementId] --<flag> <value> ...` | Update one or more properties via flags (see flag table below) |
| `select <elementId>` | Move the cursor to a specific element |
| `select --parent` | Move the cursor to the parent sub-process of the active element |
| `select-file <path>` | Switch the active BPMN file |
| `cursor-status` | Print the current cursor element |
| `status` | Print a compact JSON view of the semantic model |
| `reset` | Clear the cursor state file (keeps the `.bpmn` file) |

### Examples

```sh
c8ctl model init my-process
c8ctl model append user-task "Review Application"
c8ctl model append exclusive-gateway "Approved?"
c8ctl model append --freeze-cursor end-event Rejected Gateway_1
c8ctl model create event-sub-process "Handle Error"
c8ctl model create --parent error-start-event "On Error"
c8ctl model create --parent service-task "Compensate"
c8ctl model select --parent
c8ctl model create end-event "Alternate End"
c8ctl model connect Gateway_1 EndEvent_1 "=approved"
c8ctl model append sub-process "Handle Exception"
c8ctl model create --parent start-event Start
c8ctl model create --parent --freeze-cursor end-event End
c8ctl model select --parent
c8ctl model append --boundary timer Timeout
c8ctl model append --boundary non-interrupting-message Escalation Activity_1
c8ctl model update zeebe:taskDefinition.type my-job-type
c8ctl model update Activity_2 name "Send Approval"
c8ctl model update zeebe:input "=vars.x" localX
c8ctl model update multi-instance.type parallel
c8ctl model update zeebe:loopCharacteristics.inputCollection "=items"
c8ctl model update ad-hoc.ordering Sequential
c8ctl model select Gateway_1
c8ctl model select-file other-process
c8ctl model cursor-status
c8ctl model status
c8ctl model reset
```

## Development

```sh
npm install
npm run build
npm test
```

## Coverage

### Element types — `append` / `create` (with `--parent` for child elements)

#### Tasks

| Type | ID prefix | Notes |
| --- | --- | --- |
| `task` | `Activity` | — |
| `user-task` | `Activity` | Adds `<zeebe:userTask />` marker (Zeebe user task, recommended for Camunda 8.5+) |
| `service-task` | `Activity` | — |
| `script-task` | `Activity` | — |
| `send-task` | `Activity` | — |
| `receive-task` | `Activity` | — |
| `manual-task` | `Activity` | — |
| `business-rule-task` | `Activity` | — |
| `call-activity` | `Activity` | — |
| `sub-process` | `Activity` | — |
| `ad-hoc-sub-process` | `Activity` | — |
| `event-sub-process` | `Activity` | — |

`event-sub-process` sets `triggeredByEvent=true`; prefer `create` since it has no incoming flow.

#### Gateways

| Type | ID prefix |
| --- | --- |
| `exclusive-gateway` | `Gateway` |
| `parallel-gateway` | `Gateway` |
| `inclusive-gateway` | `Gateway` |
| `event-based-gateway` | `Gateway` |

#### Start events

| Type | ID prefix |
| --- | --- |
| `start-event` | `StartEvent` |
| `timer-start-event` | `StartEvent` |
| `message-start-event` | `StartEvent` |
| `signal-start-event` | `StartEvent` |
| `error-start-event` | `StartEvent` |
| `escalation-start-event` | `StartEvent` |
| `compensation-start-event` | `StartEvent` |
| `conditional-start-event` | `StartEvent` |

#### Intermediate catch events

| Type | ID prefix |
| --- | --- |
| `timer-intermediate-catch-event` | `Event` |
| `message-intermediate-catch-event` | `Event` |
| `signal-intermediate-catch-event` | `Event` |
| `conditional-intermediate-catch-event` | `Event` |
| `link-intermediate-catch-event` | `Event` |

#### Intermediate throw events

| Type | ID prefix |
| --- | --- |
| `intermediate-throw-event` | `Event` |
| `message-intermediate-throw-event` | `Event` |
| `signal-intermediate-throw-event` | `Event` |
| `escalation-intermediate-throw-event` | `Event` |
| `compensation-intermediate-throw-event` | `Event` |
| `link-intermediate-throw-event` | `Event` |

#### End events

| Type | ID prefix |
| --- | --- |
| `end-event` | `EndEvent` |
| `message-end-event` | `EndEvent` |
| `signal-end-event` | `EndEvent` |
| `error-end-event` | `EndEvent` |
| `escalation-end-event` | `EndEvent` |
| `terminate-end-event` | `EndEvent` |
| `compensation-end-event` | `EndEvent` |
| `cancel-end-event` | `EndEvent` |

### Boundary event types — `append --boundary`

| Type | Interrupting |
| --- | --- |
| `timer` | yes (default) |
| `non-interrupting-timer` | no |
| `error` | always |
| `message` | yes (default) |
| `non-interrupting-message` | no |
| `signal` | yes (default) |
| `non-interrupting-signal` | no |
| `escalation` | yes (default) |
| `non-interrupting-escalation` | no |
| `non-interrupting-compensation` | always |
| `conditional` | yes (default) |
| `non-interrupting-conditional` | no |
| `cancel` | always |

Host element must be an activity (`task`, `user-task`, `service-task`, `script-task`, `call-activity`, `sub-process`, etc.). Gateways and events are rejected.

### Update properties — `update`

Both invocation styles target the cursor element by default; prefix with an element ID to target a different element.

#### Positional style

```sh
c8ctl model update [elementId] <property> <value...>
```

| Property | Value args | Upsert key | Notes |
| --- | --- | --- | --- |
| `name` | `<name>` | — | — |
| `id` | `<new-id>` | — | Renames the element ID; cursor updates if cursor was on that element |
| `signalRef` | `<signal-name>` | — | — |
| `messageRef` | `<message-name>` | — | — |
| `isInterrupting` | `true` \| `false` | — | Sets interrupting flag on start events inside event sub-processes; default `true` |
| `zeebe:taskDefinition.type` | `<type>` | — | — |
| `zeebe:taskDefinition.retries` | `<count>` | — | — |
| `zeebe:input` | `<source> <target>` | target | — |
| `zeebe:output` | `<source> <target>` | source | — |
| `zeebe:header` | `<key> <value>` | key | — |
| `zeebe:property` | `<name> <value>` | name | — |
| `zeebe:userTask.disabled` | `true` \| `false` | — | Only on `user-task`; `true` removes the `<zeebe:userTask />` marker (reverts to job-worker behavior) |
| `zeebe:calledDecision.decisionId` | `<decisionId>` | — | Only on `business-rule-task` |
| `zeebe:calledDecision.resultVariable` | `<variable>` | — | Only on `business-rule-task` |
| `zeebe:calledDecision.bindingType` | `latest` \| `deployment` \| `versionTag` | — | Only on `business-rule-task` |
| `zeebe:calledDecision.versionTag` | `<tag>` | — | Only on `business-rule-task`; meaningful when `bindingType=versionTag` |
| `zeebe:formDefinition.formId` | `<formId>` | — | Only on `user-task`; sets `formId` on `<zeebe:formDefinition>` (Camunda Form); clears `formKey`/`externalReference` |
| `zeebe:formDefinition.formKey` | `<formKey>` | — | Only on `user-task`; sets `formKey` (legacy key); clears `formId`/`externalReference` |
| `zeebe:formDefinition.externalReference` | `<url>` | — | Only on `user-task`; sets `externalReference`; clears `formId`/`formKey` |
| `zeebe:formDefinition.bindingType` | `latest` \| `deployment` \| `versionTag` | — | Only on `user-task` |
| `zeebe:formDefinition.versionTag` | `<tag>` | — | Only on `user-task`; meaningful when `bindingType=versionTag` |
| `timer.timeDuration` | `<ISO-8601>` | — | — |
| `timer.timeCycle` | `<ISO-8601>` | — | — |
| `timer.timeDate` | `<ISO-8601>` | — | — |
| `multi-instance.type` | `parallel` \| `sequential` | — | Creates or updates `bpmn:MultiInstanceLoopCharacteristics`; set this before zeebe loop properties |
| `zeebe:loopCharacteristics.inputCollection` | `<expression>` | — | Requires `multi-instance.type` to be set first |
| `zeebe:loopCharacteristics.inputElement` | `<variable>` | — | — |
| `zeebe:loopCharacteristics.outputCollection` | `<variable>` | — | — |
| `zeebe:loopCharacteristics.outputElement` | `<expression>` | — | — |
| `ad-hoc.ordering` | `Sequential` \| `Parallel` | — | Only on `ad-hoc-sub-process` elements |
| `ad-hoc.cancelRemainingInstances` | `true` \| `false` | — | Only on `ad-hoc-sub-process` elements; default `true` |
| `zeebe:adHoc.outputCollection` | `<variable-name>` | — | Only on `ad-hoc-sub-process`; sets `outputCollection` on `<zeebe:adHoc>` |
| `zeebe:adHoc.outputElement` | `<FEEL-expression>` | — | Only on `ad-hoc-sub-process`; sets `outputElement` on `<zeebe:adHoc>` |
| `zeebe:adHoc.activeElementsCollection` | `<FEEL-expression>` | — | Only on `ad-hoc-sub-process`; sets `activeElementsCollection` on `<zeebe:adHoc>` |

#### Flag style

```sh
c8ctl model update [elementId] --<flag> <value> [--<flag> <value> ...]
```

Flags marked **repeated** may be specified multiple times (e.g. `--input "=src=target"`). Key-value flags use `=` as the last separator.

| Flag | Property | Repeated | Notes |
| --- | --- | --- | --- |
| `--name <value>` | `name` | — | — |
| `--task-type <value>` | `zeebe:taskDefinition.type` | — | — |
| `--task-retries <count>` | `zeebe:taskDefinition.retries` | — | — |
| `--input <source>=<target>` | `zeebe:input` | yes | — |
| `--output <source>=<target>` | `zeebe:output` | yes | — |
| `--header <key>=<value>` | `zeebe:header` | yes | — |
| `--ext-property <name>=<value>` | `zeebe:property` | yes | — |
| `--assignee <value>` | `zeebe:assignmentDefinition.assignee` | — | Only on `user-task` |
| `--candidate-groups <value>` | `zeebe:assignmentDefinition.candidateGroups` | — | Only on `user-task` |
| `--candidate-users <value>` | `zeebe:assignmentDefinition.candidateUsers` | — | Only on `user-task` |
| `--due-date <value>` | `zeebe:taskSchedule.dueDate` | — | Only on `user-task` |
| `--follow-up-date <value>` | `zeebe:taskSchedule.followUpDate` | — | Only on `user-task` |
| `--priority <value>` | `zeebe:priorityDefinition.priority` | — | Only on `user-task` |
| `--user-task-disabled true\|false` | `zeebe:userTask.disabled` | — | Only on `user-task` |
| `--form-id <value>` | `zeebe:formDefinition.formId` | — | Clears `formKey`/`externalReference` |
| `--form-key <value>` | `zeebe:formDefinition.formKey` | — | Clears `formId`/`externalReference` |
| `--form-external-ref <url>` | `zeebe:formDefinition.externalReference` | — | Clears `formId`/`formKey` |
| `--form-binding-type latest\|deployment\|versionTag` | `zeebe:formDefinition.bindingType` | — | — |
| `--form-version-tag <tag>` | `zeebe:formDefinition.versionTag` | — | — |
| `--script-expression <expr>` | `zeebe:script.expression` | — | Only on `script-task` |
| `--script-result-var <var>` | `zeebe:script.resultVariable` | — | Only on `script-task` |
| `--decision-id <id>` | `zeebe:calledDecision.decisionId` | — | Only on `business-rule-task` |
| `--decision-result <var>` | `zeebe:calledDecision.resultVariable` | — | Only on `business-rule-task` |
| `--decision-binding-type latest\|deployment\|versionTag` | `zeebe:calledDecision.bindingType` | — | — |
| `--decision-version-tag <tag>` | `zeebe:calledDecision.versionTag` | — | — |
| `--called-process-id <id>` | `zeebe:calledElement.processId` | — | Only on `call-activity` |
| `--called-process-id-expr <expr>` | `zeebe:calledElement.processIdExpression` | — | Only on `call-activity` |
| `--propagate-all-child-vars true\|false` | `zeebe:calledElement.propagateAllChildVariables` | — | Only on `call-activity` |
| `--propagate-all-parent-vars true\|false` | `zeebe:calledElement.propagateAllParentVariables` | — | Only on `call-activity` |
| `--called-binding-type latest\|deployment\|versionTag` | `zeebe:calledElement.bindingType` | — | Only on `call-activity` |
| `--called-version-tag <tag>` | `zeebe:calledElement.versionTag` | — | Only on `call-activity` |
| `--execution-listener <event>=<type>` | `zeebe:executionListener` | yes | — |
| `--task-listener <event>=<type>` | `zeebe:taskListener` | yes | Only on `user-task` |
| `--signal-name <name>` | `signalRef` | — | — |
| `--message-name <name>` | `messageRef` | — | — |
| `--correlation-key <expr>` | `zeebe:subscription.correlationKey` | — | Only on message events |
| `--is-interrupting true\|false` | `isInterrupting` | — | — |
| `--time-duration <ISO-8601>` | `timer.timeDuration` | — | — |
| `--time-cycle <ISO-8601>` | `timer.timeCycle` | — | — |
| `--time-date <ISO-8601>` | `timer.timeDate` | — | — |
| `--condition-variable-names <value>` | `zeebe:conditionalFilter.variableNames` | — | Only on conditional events |
| `--condition-variable-events <value>` | `zeebe:conditionalFilter.variableEvents` | — | Only on conditional events |
| `--multi-instance parallel\|sequential` | `multi-instance.type` | — | — |
| `--loop-input-collection <expr>` | `zeebe:loopCharacteristics.inputCollection` | — | — |
| `--loop-input-element <var>` | `zeebe:loopCharacteristics.inputElement` | — | — |
| `--loop-output-collection <var>` | `zeebe:loopCharacteristics.outputCollection` | — | — |
| `--loop-output-element <expr>` | `zeebe:loopCharacteristics.outputElement` | — | — |
| `--linked-resource <key>=<value>` | `zeebe:linkedResource` | yes | — |
| `--adhoc-ordering Sequential\|Parallel` | `ad-hoc.ordering` | — | Only on `ad-hoc-sub-process` |
| `--adhoc-cancel-remaining true\|false` | `ad-hoc.cancelRemainingInstances` | — | Only on `ad-hoc-sub-process` |
| `--adhoc-output-collection <var>` | `zeebe:adHoc.outputCollection` | — | Only on `ad-hoc-sub-process` |
| `--adhoc-output-element <expr>` | `zeebe:adHoc.outputElement` | — | Only on `ad-hoc-sub-process` |
| `--adhoc-active-elements <expr>` | `zeebe:adHoc.activeElementsCollection` | — | Only on `ad-hoc-sub-process` |

#### Event sub-process example

```sh
# Create the event sub-process (no incoming flow)
c8ctl model create event-sub-process "Handle Error"
# Add a typed start event inside it
c8ctl model create --parent error-start-event "On Error"
# Mark it non-interrupting (optional)
c8ctl model update isInterrupting false
# Build out the sub-process body
c8ctl model create --parent service-task "Compensate"
# Navigate back to the parent level
c8ctl model select --parent
```

#### Gateway branching with `connect`

```sh
c8ctl model append exclusive-gateway "Approved?"
c8ctl model create end-event Approved
c8ctl model create end-event Rejected
c8ctl model connect Gateway_1 EndEvent_1 "=approved"
c8ctl model connect Gateway_1 EndEvent_2 "=!approved"
```

#### Multi-instance example

```sh
c8ctl model append service-task "Process Item"
c8ctl model update multi-instance.type parallel
c8ctl model update zeebe:loopCharacteristics.inputCollection "=items"
c8ctl model update zeebe:loopCharacteristics.inputElement item
c8ctl model update zeebe:loopCharacteristics.outputCollection results
c8ctl model update zeebe:loopCharacteristics.outputElement "=result"
```

#### Ad-hoc sub-process example

```sh
c8ctl model append ad-hoc-sub-process "Handle Exceptions"
c8ctl model update ad-hoc.ordering Sequential
c8ctl model update ad-hoc.cancelRemainingInstances false
c8ctl model add-child user-task "Investigate"
c8ctl model add-child user-task "Escalate"
```

### Command behavior summary

| Command | Supported inputs | Notes |
| --- | --- | --- |
| `model init` | — | Creates process + `StartEvent_1`; throws if `.bpmn` or state already exists |
| `model select <elementId>` | any element id | Validates existence; throws if not found |
| `model select --parent` | — | Moves cursor to direct parent sub-process; throws if cursor is at top level |
| `model select-file` | name or path | Auto-appends `.bpmn`; cursor preserved if element exists in new file, reset to first element otherwise |
| `model create <type> <label>` | `[--parent] [--freeze-cursor] [--id <id>] [flags…]` | Creates standalone element at process level (no sequence flow); `--parent` adds as child of cursor sub-process; `--freeze-cursor` keeps cursor |
| `model append <type> <label>` | `[sourceId] [--boundary] [--freeze-cursor] [--id <id>] [flags…]` | Appends element after cursor (or `sourceId`) with sequence flow; `--boundary` attaches a boundary event to the host instead; `--freeze-cursor` keeps cursor |
| `model connect` | `<sourceId> <targetId> [condition]` | Creates sequence flow; cursor moves to target; optional FEEL condition |
| `model cursor-status` | — | JSON: `cursor`, `type`, `name`, `file` |
| `model status` | — | JSON: elements + flows + Zeebe extensions; sub-process elements include `children` and `childFlows` |
| `model reset` | — | Removes state file; keeps `.bpmn` |
