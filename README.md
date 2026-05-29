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
| `append <type> <label> [sourceId]` | Append an element after cursor with a sequence flow; cursor moves to new element |
| `append-freeze-cursor <type> <label> [sourceId]` | Same as `append` but cursor does not move |
| `create <type> <label>` | Create a standalone element (no sequence flow); cursor moves to new element |
| `create-freeze-cursor <type> <label>` | Same as `create` but cursor does not move |
| `connect <sourceId> <targetId> [condition]` | Create a sequence flow between two elements; cursor moves to target |
| `add-child <type> <label>` | Add a child element inside the cursor sub-process; cursor moves to new element |
| `add-child-freeze-cursor <type> <label>` | Add a child element inside the cursor sub-process without moving the cursor |
| `select-parent` | Move the cursor to the parent sub-process of the active element |
| `boundary-append <type> <label> [hostId]` | Attach a boundary event to an activity; cursor moves to new event |
| `update [elementId] <property> <value...>` | Update a BPMN or Zeebe property on the cursor element |
| `select <elementId>` | Move the cursor to a specific element |
| `select-file <path>` | Switch the active BPMN file |
| `cursor-status` | Print the current cursor element |
| `status` | Print a compact JSON view of the semantic model |
| `reset` | Clear the cursor state file (keeps the `.bpmn` file) |

### Examples

```sh
c8ctl model init my-process
c8ctl model append user-task "Review Application"
c8ctl model append exclusive-gateway "Approved?"
c8ctl model append-freeze-cursor end-event Rejected Gateway_1
c8ctl model create event-sub-process "Handle Error"
c8ctl model add-child error-start-event "On Error"
c8ctl model add-child service-task "Compensate"
c8ctl model select-parent
c8ctl model create end-event "Alternate End"
c8ctl model connect Gateway_1 EndEvent_1 "=approved"
c8ctl model append sub-process "Handle Exception"
c8ctl model add-child start-event Start
c8ctl model add-child-freeze-cursor end-event End
c8ctl model select-parent
c8ctl model boundary-append timer Timeout
c8ctl model boundary-append non-interrupting-message Escalation Activity_1
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

### Element types — `append` / `append-freeze-cursor` / `create` / `create-freeze-cursor`

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

### Boundary event types — `boundary-append`

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

| Property | Value args | Upsert key | Notes |
| --- | --- | --- | --- |
| `name` | `<name>` | — | — |
| `zeebe:taskDefinition.type` | `<type>` | — | — |
| `zeebe:taskDefinition.retries` | `<count>` | — | — |
| `zeebe:calledDecision.decisionId` | `<decisionId>` | — | Only on `business-rule-task` |
| `zeebe:calledDecision.resultVariable` | `<variable>` | — | Only on `business-rule-task` |
| `zeebe:input` | `<source> <target>` | target | — |
| `zeebe:output` | `<source> <target>` | source | — |
| `zeebe:header` | `<key> <value>` | key | — |
| `zeebe:property` | `<name> <value>` | name | — |
| `zeebe:userTask.disabled` | `true` \| `false` | — | Only on `user-task`; `true` removes the `<zeebe:userTask />` marker (reverts to job-worker behavior) |
| `isInterrupting` | `true` \| `false` | — | Sets interrupting flag on start events inside event sub-processes; default `true` |
| `multi-instance.type` | `parallel` \| `sequential` | — | Creates or updates `bpmn:MultiInstanceLoopCharacteristics`; set this before zeebe loop properties |
| `zeebe:loopCharacteristics.inputCollection` | `<expression>` | — | Requires `multi-instance.type` to be set first |
| `zeebe:loopCharacteristics.inputElement` | `<variable>` | — | — |
| `zeebe:loopCharacteristics.outputCollection` | `<variable>` | — | — |
| `zeebe:loopCharacteristics.outputElement` | `<expression>` | — | — |
| `ad-hoc.ordering` | `Sequential` \| `Parallel` | — | Only on `ad-hoc-sub-process` elements |
| `ad-hoc.cancelRemainingInstances` | `true` \| `false` | — | Only on `ad-hoc-sub-process` elements; default `true` |

#### Event sub-process example

```sh
# Create the event sub-process (no incoming flow)
c8ctl model create event-sub-process "Handle Error"
# Add a typed start event inside it
c8ctl model add-child error-start-event "On Error"
# Mark it non-interrupting (optional)
c8ctl model update isInterrupting false
# Build out the sub-process body
c8ctl model append service-task "Compensate"
# Navigate back to the parent level
c8ctl model select-parent
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
| `model select` | any element id | Validates existence; throws if not found |
| `model select-file` | name or path | Auto-appends `.bpmn`; cursor preserved if element exists in new file, reset to first element otherwise |
| `model select-parent` | — | Moves cursor to direct parent sub-process; throws if cursor is at top level |
| `model create` | `<type> <label>` | Creates standalone element at process level (no sequence flow); cursor moves |
| `model create-freeze-cursor` | `<type> <label>` | Same as `create` but cursor does not move |
| `model connect` | `<sourceId> <targetId> [condition]` | Creates sequence flow; cursor moves to target; optional FEEL condition |
| `model add-child` | `<type> <label>` | Cursor must be on a `sub-process`; adds element inside it; cursor moves to new element |
| `model add-child-freeze-cursor` | `<type> <label>` | Same as `add-child` but cursor does not move |
| `model cursor-status` | — | JSON: `cursor`, `type`, `name`, `file` |
| `model status` | — | JSON: elements + flows + Zeebe extensions; sub-process elements include `children` and `childFlows` |
| `model reset` | — | Removes state file; keeps `.bpmn` |
