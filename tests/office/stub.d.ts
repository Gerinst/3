// Minimal Office Scripts ambient declarations for the emulator (not the real API surface).
declare namespace ExcelScript {
  interface Range {
    getValues(): (string | number | boolean)[][];
    getAddress(): string;
  }
  interface Worksheet {
    getRange(address?: string): Range;
  }
  interface Workbook {
    getName(): string;
    getActiveCell(): Range;
    getActiveWorksheet(): Worksheet;
  }
}
declare var console: {
  log(...data: unknown[]): void;
};
