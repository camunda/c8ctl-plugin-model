declare module 'bpmn-moddle' {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type ModdleElement = any;

  export class BpmnModdle {
    constructor(extensions?: Record<string, unknown>);
    create(type: string, attrs?: Record<string, unknown>): ModdleElement;
    fromXML(xml: string): Promise<{ rootElement: ModdleElement; warnings: unknown[] }>;
    toXML(element: ModdleElement, options?: { format?: boolean }): Promise<{ xml: string }>;
  }
}
