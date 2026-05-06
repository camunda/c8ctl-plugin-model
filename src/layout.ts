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
  textAnnotation: { width: 100, height: 30 },
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

  // Layout subprocess children
  const CHILD_PAD = 50;
  const CH_GAP = 150;
  const CV_GAP = 100;

  for (const el of elements) {
    if (el.$type !== 'bpmn:SubProcess' && el.$type !== 'bpmn:AdHocSubProcess') continue;

    const subShape = shapeMap.get(el.id as string);
    if (!subShape) continue;

    const childEls: ModdleElement[] = (el.flowElements ?? []).filter(
      (c: ModdleElement) => c.$type !== 'bpmn:SequenceFlow',
    );
    const childFlows: ModdleElement[] = (el.flowElements ?? []).filter(
      (c: ModdleElement) => c.$type === 'bpmn:SequenceFlow',
    );
    if (childEls.length === 0) continue;

    const cOut = new Map<string, string[]>();
    const cIn = new Map<string, string[]>();
    for (const ce of childEls) { cOut.set(ce.id, []); cIn.set(ce.id, []); }
    for (const cf of childFlows) {
      const s: string = cf.sourceRef?.id ?? cf.sourceRef;
      const t: string = cf.targetRef?.id ?? cf.targetRef;
      cOut.get(s)?.push(t);
      cIn.get(t)?.push(s);
    }

    const cPos = new Map<string, { col: number; row: number }>();
    const cStarts = childEls.filter((ce: ModdleElement) => (cIn.get(ce.id)?.length ?? 0) === 0);
    const cQueue: Array<{ id: string; col: number; row: number }> = cStarts.map(
      (ce: ModdleElement) => ({ id: ce.id, col: 0, row: 0 }),
    );
    const cVisited = new Set<string>();
    const cColRow = new Map<number, number>();

    while (cQueue.length > 0) {
      const item = cQueue.shift()!;
      if (cVisited.has(item.id)) continue;
      cVisited.add(item.id);
      const col = item.col;
      const usedRow = cColRow.get(col) ?? 0;
      const row = Math.max(item.row, usedRow);
      cColRow.set(col, row + 1);
      cPos.set(item.id, { col, row });
      (cOut.get(item.id) ?? []).forEach((nid, i) => {
        if (!cVisited.has(nid)) cQueue.push({ id: nid, col: col + 1, row: row + i });
      });
    }

    let maxCol = 0;
    let maxRow = 0;
    for (const { col, row } of cPos.values()) {
      maxCol = Math.max(maxCol, col);
      maxRow = Math.max(maxRow, row);
    }

    const subW = Math.max(200, 2 * CHILD_PAD + maxCol * CH_GAP + 100);
    const subH = Math.max(140, 2 * CHILD_PAD + maxRow * CV_GAP + 80);

    const p = pos.get(el.id as string);
    if (p) {
      subShape.bounds.x = p.x - subW / 2;
      subShape.bounds.y = p.y - subH / 2;
    }
    subShape.bounds.width = subW;
    subShape.bounds.height = subH;

    const subLeft: number = subShape.bounds.x;
    const subTop: number = subShape.bounds.y;

    for (const ce of childEls) {
      const cp = cPos.get(ce.id as string);
      if (!cp) continue;
      const ceShape = shapeMap.get(ce.id as string);
      if (!ceShape) continue;
      const ceSize = size(ce);
      const ceCenterX = subLeft + CHILD_PAD + cp.col * CH_GAP;
      const ceCenterY = subTop + CHILD_PAD + cp.row * CV_GAP;
      ceShape.bounds.x = ceCenterX - ceSize.width / 2;
      ceShape.bounds.y = ceCenterY - ceSize.height / 2;
      ceShape.bounds.width = ceSize.width;
      ceShape.bounds.height = ceSize.height;
    }

    for (const cf of childFlows) {
      const srcId: string = cf.sourceRef?.id ?? cf.sourceRef;
      const tgtId: string = cf.targetRef?.id ?? cf.targetRef;
      const scp = cPos.get(srcId);
      const tcp = cPos.get(tgtId);
      const edge = edgeMap.get(cf.id as string);
      if (!edge || !scp || !tcp) continue;
      const srcEl = childEls.find((c: ModdleElement) => c.id === srcId);
      const tgtEl = childEls.find((c: ModdleElement) => c.id === tgtId);
      const srcSize = srcEl ? size(srcEl) : SIZES['default'];
      const tgtSize = tgtEl ? size(tgtEl) : SIZES['default'];
      const sCX = subLeft + CHILD_PAD + scp.col * CH_GAP;
      const sCY = subTop + CHILD_PAD + scp.row * CV_GAP;
      const tCX = subLeft + CHILD_PAD + tcp.col * CH_GAP;
      const tCY = subTop + CHILD_PAD + tcp.row * CV_GAP;
      edge.waypoint = [
        moddle.create('dc:Point', { x: sCX + srcSize.width / 2, y: sCY }),
        moddle.create('dc:Point', { x: tCX - tgtSize.width / 2, y: tCY }),
      ];
    }
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

  // Position text annotations above their associated elements
  const ANNOTATION_Y_OFFSET = -80;
  const artifacts: ModdleElement[] = process.artifacts ?? [];
  const annotations = artifacts.filter((a: ModdleElement) => a.$type === 'bpmn:TextAnnotation');
  const associations = artifacts.filter((a: ModdleElement) => a.$type === 'bpmn:Association');
  const annotationCountPerElement = new Map<string, number>();

  for (const ann of annotations) {
    const assoc = associations.find(
      (a: ModdleElement) => (a.targetRef?.id ?? a.targetRef) === ann.id,
    );
    if (!assoc) continue;

    const sourceId: string = assoc.sourceRef?.id ?? assoc.sourceRef;
    const sourcePos = pos.get(sourceId);
    const annShape = shapeMap.get(ann.id as string);
    if (!sourcePos || !annShape) continue;

    const idx = annotationCountPerElement.get(sourceId) ?? 0;
    annotationCountPerElement.set(sourceId, idx + 1);

    const annSize = SIZES['textAnnotation'];
    const annX = sourcePos.x - annSize.width / 2 + idx * 120;
    const annY = sourcePos.y + ANNOTATION_Y_OFFSET - annSize.height / 2;

    annShape.bounds.x = annX;
    annShape.bounds.y = annY;
    annShape.bounds.width = annSize.width;
    annShape.bounds.height = annSize.height;

    const assocEdge = edgeMap.get(assoc.id as string);
    if (assocEdge) {
      assocEdge.waypoint = [
        moddle.create('dc:Point', { x: sourcePos.x, y: sourcePos.y }),
        moddle.create('dc:Point', { x: annX + annSize.width / 2, y: annY + annSize.height }),
      ];
    }
  }
}
