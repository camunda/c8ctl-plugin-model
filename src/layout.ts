import { BpmnModdle } from 'bpmn-moddle';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ModdleElement = any;

const H_GAP = 180;
const V_GAP = 120;
const START_X = 150;
const START_Y = 250;

const SIZES: Record<string, { width: number; height: number }> = {
  default: { width: 100, height: 80 },
  startEvent: { width: 36, height: 36 },
  endEvent: { width: 36, height: 36 },
  intermediateCatchEvent: { width: 36, height: 36 },
  intermediateThrowEvent: { width: 36, height: 36 },
  exclusiveGateway: { width: 50, height: 50 },
  parallelGateway: { width: 50, height: 50 },
  inclusiveGateway: { width: 50, height: 50 },
  eventBasedGateway: { width: 50, height: 50 },
};

function typeKey(el: ModdleElement): string {
  const t: string = el.$type ?? '';
  return t.replace('bpmn:', '').replace(/^./, (c: string) => c.toLowerCase());
}

function size(el: ModdleElement): { width: number; height: number } {
  return SIZES[typeKey(el)] ?? SIZES['default'];
}

interface Pos {
  x: number;
  y: number;
  col: number;
  row: number;
}

export function recomputeLayout(moddle: BpmnModdle, definitions: ModdleElement): void {
  const process: ModdleElement = definitions.rootElements?.find(
    (e: ModdleElement) => e.$type === 'bpmn:Process',
  );
  if (!process) return;

  const flowElements: ModdleElement[] = process.flowElements ?? [];
  const boundaryEvents = flowElements.filter((e: ModdleElement) => e.$type === 'bpmn:BoundaryEvent');
  const boundaryIds = new Set(boundaryEvents.map((e: ModdleElement) => e.id as string));
  const elements = flowElements.filter(
    (e: ModdleElement) => e.$type !== 'bpmn:SequenceFlow' && !boundaryIds.has(e.id),
  );
  const flows = flowElements.filter((e: ModdleElement) => e.$type === 'bpmn:SequenceFlow');

  // Build adjacency from IDs
  const outgoing = new Map<string, string[]>();
  const incoming = new Map<string, string[]>();
  for (const el of elements) {
    outgoing.set(el.id, []);
    incoming.set(el.id, []);
  }
  for (const flow of flows) {
    const src = flow.sourceRef?.id ?? flow.sourceRef;
    const tgt = flow.targetRef?.id ?? flow.targetRef;
    outgoing.get(src)?.push(tgt);
    incoming.get(tgt)?.push(src);
  }

  // BFS to assign column (depth) and row
  const pos = new Map<string, Pos>();
  const starts = elements.filter((e: ModdleElement) => (incoming.get(e.id)?.length ?? 0) === 0);
  const queue: Array<{ id: string; col: number; row: number }> = starts.map((e: ModdleElement) => ({
    id: e.id,
    col: 0,
    row: 0,
  }));
  const visited = new Set<string>();
  const colRowCounter = new Map<number, number>();

  while (queue.length > 0) {
    const item = queue.shift()!;
    if (visited.has(item.id)) continue;
    visited.add(item.id);

    const col = item.col;
    const usedRow = colRowCounter.get(col) ?? 0;
    const row = Math.max(item.row, usedRow);
    colRowCounter.set(col, row + 1);

    pos.set(item.id, { x: 0, y: 0, col, row });

    const nexts = outgoing.get(item.id) ?? [];
    nexts.forEach((nextId, i) => {
      if (!visited.has(nextId)) {
        queue.push({ id: nextId, col: col + 1, row: row + i });
      }
    });
  }

  // Assign coordinates
  for (const [, p] of pos.entries()) {
    p.x = START_X + p.col * H_GAP;
    p.y = START_Y + p.row * V_GAP;
  }

  const diagram: ModdleElement = definitions.diagrams?.[0];
  if (!diagram) return;
  const plane: ModdleElement = diagram.plane;
  if (!plane) return;

  const shapeMap = new Map<string, ModdleElement>();
  const edgeMap = new Map<string, ModdleElement>();

  for (const pe of plane.planeElement ?? []) {
    if (pe.$type === 'bpmndi:BPMNShape') shapeMap.set(pe.bpmnElement?.id ?? pe.bpmnElement, pe);
    if (pe.$type === 'bpmndi:BPMNEdge') edgeMap.set(pe.bpmnElement?.id ?? pe.bpmnElement, pe);
  }

  // Update shapes
  for (const el of elements) {
    const p = pos.get(el.id);
    if (!p) continue;
    const shape = shapeMap.get(el.id);
    if (!shape) continue;
    const s = size(el);
    shape.bounds.x = p.x - s.width / 2;
    shape.bounds.y = p.y - s.height / 2;
    shape.bounds.width = s.width;
    shape.bounds.height = s.height;
  }

  // Position boundary events on the bottom edge of their host activity
  const hostBoundaryCount = new Map<string, number>();
  for (const be of boundaryEvents) {
    const hostId: string = be.attachedToRef?.id ?? be.attachedToRef;
    const hostPos = pos.get(hostId);
    const hostEl = elements.find((e: ModdleElement) => e.id === hostId);
    const shape = shapeMap.get(be.id as string);
    if (!hostPos || !shape) continue;

    const hostSize = hostEl ? size(hostEl) : SIZES['default'];
    const index = hostBoundaryCount.get(hostId) ?? 0;
    hostBoundaryCount.set(hostId, index + 1);

    const beSize = 36;
    shape.bounds.x = hostPos.x - hostSize.width / 2 + 20 + index * 50 - beSize / 2;
    shape.bounds.y = hostPos.y + hostSize.height / 2 - beSize / 2;
    shape.bounds.width = beSize;
    shape.bounds.height = beSize;
  }

  // Update edges with proper moddle dc:Point elements
  for (const flow of flows) {
    const srcId = flow.sourceRef?.id ?? flow.sourceRef;
    const tgtId = flow.targetRef?.id ?? flow.targetRef;
    const srcPos = pos.get(srcId);
    const tgtPos = pos.get(tgtId);
    const edge = edgeMap.get(flow.id);
    if (!edge || !srcPos || !tgtPos) continue;

    const srcEl = elements.find((e: ModdleElement) => e.id === srcId);
    const tgtEl = elements.find((e: ModdleElement) => e.id === tgtId);
    const srcSize = srcEl ? size(srcEl) : SIZES['default'];
    const tgtSize = tgtEl ? size(tgtEl) : SIZES['default'];

    edge.waypoint = [
      moddle.create('dc:Point', { x: srcPos.x + srcSize.width / 2, y: srcPos.y }),
      moddle.create('dc:Point', { x: tgtPos.x - tgtSize.width / 2, y: tgtPos.y }),
    ];
  }
}
