declare module 'mammoth' {
  export interface ConvertResult {
    value: string; // The generated HTML
    messages: Array<{
      type: 'warning' | 'error';
      message: string;
    }>;
  }

  export interface ConvertOptions {
    styleMap?: string | string[];
    includeDefaultStyleMap?: boolean;
    includeEmbeddedStyleMap?: boolean;
    convertImage?: any;
    ignoreEmptyParagraphs?: boolean;
    idPrefix?: string;
  }

  export function convertToHtml(
    input: { buffer: Buffer } | { path: string },
    options?: ConvertOptions
  ): Promise<ConvertResult>;

  export function extractRawText(
    input: { buffer: Buffer } | { path: string }
  ): Promise<{ value: string; messages: any[] }>;
}
