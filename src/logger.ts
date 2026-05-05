export interface CommandLogger {
  info(message: string): void;
  warn(message: string): void;
  error(message: string, error?: Error): void;
  success(message: string, key?: string | number): void;
  json(data: unknown): void;
  output(content: string): void;
}
