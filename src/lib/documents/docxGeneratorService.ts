import {
  AlignmentType,
  BorderStyle,
  convertMillimetersToTwip,
  Document,
  HeightRule,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  UnderlineType,
  WidthType,
} from 'docx';
import { parse as parseHtml, Node as HtmlNode, HTMLElement } from 'node-html-parser';

export interface DocumentDocxParams {
  title: string;
  documentNumber?: string | null;
  issuedDate?: string | null;
  effectiveDate?: string | null;
  categoryName?: string | null;
  editorContentHtml?: string | null;
  status?: string | null;
  approverName?: string | null;
  approvedAt?: string | null;
  isDraft?: boolean;
}

const DEFAULT_FONT = 'Times New Roman';
// docx size is in half-points: 13pt = 26 half-points, 12pt = 24, 11pt = 22
const SIZE_14PT = 28;
const SIZE_13PT = 26;
const SIZE_12PT = 24;
const SIZE_11PT = 22;

const NO_BORDER = { style: BorderStyle.NONE, size: 0, color: 'auto' };
const BORDERLESS_TABLE_BORDERS = {
  top: NO_BORDER,
  bottom: NO_BORDER,
  left: NO_BORDER,
  right: NO_BORDER,
  insideHorizontal: NO_BORDER,
  insideVertical: NO_BORDER,
};

const SINGLE_LINE_BORDER = {
  style: BorderStyle.SINGLE,
  size: 1,
  color: '999999',
};
const STANDARD_TABLE_BORDERS = {
  top: SINGLE_LINE_BORDER,
  bottom: SINGLE_LINE_BORDER,
  left: SINGLE_LINE_BORDER,
  right: SINGLE_LINE_BORDER,
  insideHorizontal: SINGLE_LINE_BORDER,
  insideVertical: SINGLE_LINE_BORDER,
};

/**
 * Định dạng ngày hành chính Việt Nam: "Hà Nội, ngày DD tháng MM năm YYYY"
 * Chuẩn Nghị định 30/2020/NĐ-CP:
 * - Ngày dưới 10 thêm số 0 ở đầu (01, 02...)
 * - Tháng 1, tháng 2 thêm số 0 ở đầu (01, 02)
 */
export function formatVietnameseAdminDate(dateStr?: string | null): string {
  let d: number, m: number, y: number;

  if (dateStr && /^\d{4}-\d{2}-\d{2}/.test(dateStr.trim())) {
    const parts = dateStr.trim().slice(0, 10).split('-');
    y = parseInt(parts[0], 10);
    m = parseInt(parts[1], 10);
    d = parseInt(parts[2], 10);
  } else {
    const now = new Date();
    d = now.getDate();
    m = now.getMonth() + 1;
    y = now.getFullYear();
  }

  const dayStr = d < 10 ? `0${d}` : `${d}`;
  const monthStr = m < 3 ? `0${m}` : `${m}`;
  return `Hà Nội, ngày ${dayStr} tháng ${monthStr} năm ${y}`;
}

interface RunStyleState {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  size?: number;
}

type AlignmentValue = (typeof AlignmentType)[keyof typeof AlignmentType];

function parseAlignment(styleStr?: string): AlignmentValue {
  const s = (styleStr || '').toLowerCase();
  if (s.includes('text-align: center') || s.includes('text-align:center')) return AlignmentType.CENTER;
  if (s.includes('text-align: right') || s.includes('text-align:right')) return AlignmentType.RIGHT;
  if (s.includes('text-align: justify') || s.includes('text-align:justify')) return AlignmentType.JUSTIFIED;
  return AlignmentType.LEFT;
}

function extractRunsFromHtmlNode(node: HtmlNode, currentStyle: RunStyleState = {}): TextRun[] {
  const runs: TextRun[] = [];

  for (const child of node.childNodes) {
    if (child.nodeType === 3) {
      // Text node
      const rawText = child.text;
      if (rawText) {
        runs.push(
          new TextRun({
            text: rawText,
            font: DEFAULT_FONT,
            size: currentStyle.size || SIZE_13PT,
            bold: currentStyle.bold,
            italics: currentStyle.italic,
            strike: currentStyle.strike,
            underline: currentStyle.underline ? { type: UnderlineType.SINGLE } : undefined,
          })
        );
      }
    } else if (child.nodeType === 1) {
      // Element node
      const tag = (child as any).tagName ? (child as any).tagName.toLowerCase() : '';
      const nextStyle: RunStyleState = { ...currentStyle };

      if (tag === 'strong' || tag === 'b') nextStyle.bold = true;
      if (tag === 'em' || tag === 'i') nextStyle.italic = true;
      if (tag === 'u') nextStyle.underline = true;
      if (tag === 's' || tag === 'strike') nextStyle.strike = true;

      if (tag === 'br') {
        runs.push(new TextRun({ text: '', break: 1 }));
      } else {
        runs.push(...extractRunsFromHtmlNode(child, nextStyle));
      }
    }
  }

  return runs;
}

function convertHtmlToDocxElements(html: string): (Paragraph | Table)[] {
  const elements: (Paragraph | Table)[] = [];
  if (!html || !html.trim()) {
    return [
      new Paragraph({
        children: [
          new TextRun({
            text: 'Nội dung văn bản đang được soạn thảo.',
            font: DEFAULT_FONT,
            size: SIZE_13PT,
            italics: true,
          }),
        ],
      }),
    ];
  }

  const root = parseHtml(html);

  for (const node of root.childNodes) {
    if (node.nodeType === 3) {
      // Text at root level
      const txt = node.text.trim();
      if (txt) {
        elements.push(
          new Paragraph({
            spacing: { after: 120, line: 276 },
            children: [new TextRun({ text: txt, font: DEFAULT_FONT, size: SIZE_13PT })],
          })
        );
      }
      continue;
    }

    if (node.nodeType !== 1) continue;
    const tag = (node as any).tagName ? (node as any).tagName.toLowerCase() : '';
    const styleAttr = (node as any).getAttribute ? (node as any).getAttribute('style') : '';
    const alignment = parseAlignment(styleAttr);

    if (tag === 'p' || tag === 'div') {
      const runs = extractRunsFromHtmlNode(node, { size: SIZE_13PT });
      elements.push(
        new Paragraph({
          alignment,
          spacing: { after: 120, line: 276 },
          children: runs.length > 0 ? runs : [new TextRun({ text: '', font: DEFAULT_FONT })],
        })
      );
    } else if (tag === 'h1' || tag === 'h2' || tag === 'h3' || tag === 'h4') {
      const size = tag === 'h1' ? SIZE_14PT + 4 : tag === 'h2' ? SIZE_14PT + 2 : SIZE_14PT;
      const runs = extractRunsFromHtmlNode(node, { bold: true, size });
      elements.push(
        new Paragraph({
          alignment,
          spacing: { before: 180, after: 140, line: 276 },
          children: runs,
        })
      );
    } else if (tag === 'ul' || tag === 'ol') {
      const isNumbered = tag === 'ol';
      let itemIdx = 1;
      for (const li of node.childNodes) {
        if (li.nodeType === 1 && (li as any).tagName?.toLowerCase() === 'li') {
          const runs = extractRunsFromHtmlNode(li, { size: SIZE_13PT });
          elements.push(
            new Paragraph({
              spacing: { after: 80, line: 276 },
              bullet: isNumbered ? undefined : { level: 0 },
              children: isNumbered
                ? [
                    new TextRun({
                      text: `${itemIdx++}. `,
                      bold: true,
                      font: DEFAULT_FONT,
                      size: SIZE_13PT,
                    }),
                    ...runs,
                  ]
                : runs,
            })
          );
        }
      }
    } else if (tag === 'table') {
      const rows: TableRow[] = [];
      const trNodes: HTMLElement[] = [];

      if (node instanceof HTMLElement) {
        node.querySelectorAll('tr').forEach((tr) => trNodes.push(tr));
      }

      for (const tr of trNodes) {
        const cells: TableCell[] = [];
        for (const cellNode of tr.childNodes) {
          if (cellNode.nodeType === 1) {
            const cellTag = (cellNode as any).tagName?.toLowerCase();
            if (cellTag === 'td' || cellTag === 'th') {
              const isHeader = cellTag === 'th';
              const cellRuns = extractRunsFromHtmlNode(cellNode, {
                bold: isHeader ? true : undefined,
                size: SIZE_12PT,
              });
              const cellAlignment = parseAlignment(
                (cellNode as any).getAttribute ? (cellNode as any).getAttribute('style') : ''
              );

              cells.push(
                new TableCell({
                  children: [
                    new Paragraph({
                      alignment: isHeader ? AlignmentType.CENTER : cellAlignment,
                      spacing: { before: 60, after: 60 },
                      children:
                        cellRuns.length > 0 ? cellRuns : [new TextRun({ text: '', font: DEFAULT_FONT })],
                    }),
                  ],
                })
              );
            }
          }
        }
        if (cells.length > 0) {
          rows.push(new TableRow({ children: cells }));
        }
      }

      if (rows.length > 0) {
        elements.push(
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: STANDARD_TABLE_BORDERS,
            rows,
          })
        );
        // Spacing after table
        elements.push(new Paragraph({ spacing: { after: 120 }, children: [] }));
      }
    } else if (tag === 'blockquote') {
      const runs = extractRunsFromHtmlNode(node, { italic: true, size: SIZE_13PT });
      elements.push(
        new Paragraph({
          alignment: AlignmentType.JUSTIFIED,
          indent: { left: convertMillimetersToTwip(10), right: convertMillimetersToTwip(10) },
          spacing: { before: 100, after: 120, line: 276 },
          children: runs,
        })
      );
    }
  }

  return elements.length > 0
    ? elements
    : [
        new Paragraph({
          children: [new TextRun({ text: '', font: DEFAULT_FONT, size: SIZE_13PT })],
        }),
      ];
}

/**
 * Dựng Header 2 cột chuẩn Nghị định 30/2020/NĐ-CP:
 * - Cột trái: Tên cơ quan chủ quản / TÊN TRƯỜNG / Số hiệu văn bản
 * - Cột phải: QUỐC HIỆU / TIÊU NGỮ / Địa danh, ngày tháng năm
 */
function buildAdminHeaderTable(params: DocumentDocxParams): Table {
  const displayDocNumber = params.documentNumber
    ? `Số: ${params.documentNumber}`
    : params.isDraft
      ? 'Số: .../2026/CV-MNSM'
      : 'Số: .../2026/CV-MNSM';

  const dateString = formatVietnameseAdminDate(
    params.effectiveDate || params.issuedDate || params.approvedAt
  );

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: BORDERLESS_TABLE_BORDERS,
    rows: [
      new TableRow({
        children: [
          // Cột trái: Cơ quan & Số hiệu
          new TableCell({
            width: { size: 45, type: WidthType.PERCENTAGE },
            borders: BORDERLESS_TABLE_BORDERS,
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { line: 240, after: 20 },
                children: [
                  new TextRun({
                    text: 'PHÒNG GIÁO DỤC VÀ ĐÀO TẠO',
                    font: DEFAULT_FONT,
                    size: SIZE_12PT,
                  }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { line: 240, after: 20 },
                children: [
                  new TextRun({
                    text: 'TRƯỜNG MẦM NON SƯƠNG MAI',
                    font: DEFAULT_FONT,
                    size: SIZE_12PT,
                    bold: true,
                  }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { line: 200, after: 40 },
                children: [
                  new TextRun({
                    text: '————————',
                    font: DEFAULT_FONT,
                    size: 16,
                  }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { line: 240, after: 60 },
                children: [
                  new TextRun({
                    text: displayDocNumber,
                    font: DEFAULT_FONT,
                    size: SIZE_12PT,
                    italics: params.isDraft && !params.documentNumber,
                  }),
                ],
              }),
            ],
          }),
          // Cột phải: Quốc hiệu, Tiêu ngữ & Ngày tháng
          new TableCell({
            width: { size: 55, type: WidthType.PERCENTAGE },
            borders: BORDERLESS_TABLE_BORDERS,
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { line: 240, after: 20 },
                children: [
                  new TextRun({
                    text: 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM',
                    font: DEFAULT_FONT,
                    size: SIZE_12PT,
                    bold: true,
                  }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { line: 240, after: 20 },
                children: [
                  new TextRun({
                    text: 'Độc lập - Tự do - Hạnh phúc',
                    font: DEFAULT_FONT,
                    size: SIZE_13PT,
                    bold: true,
                  }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { line: 200, after: 40 },
                children: [
                  new TextRun({
                    text: '————————————',
                    font: DEFAULT_FONT,
                    size: 16,
                  }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { line: 240, after: 60 },
                children: [
                  new TextRun({
                    text: dateString,
                    font: DEFAULT_FONT,
                    size: SIZE_13PT,
                    italics: true,
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });
}

/**
 * Dựng Footer chữ ký 2 cột chuẩn Nghị định 30/2020/NĐ-CP:
 * - Cột trái: Nơi nhận (11-12pt)
 * - Cột phải: HIỆU TRƯỞNG (13pt, in đậm, khoảng trống ký tên & đóng dấu)
 */
function buildAdminSignatureTable(params: DocumentDocxParams): Table {
  const isApproved = params.status === 'APPROVED';
  const approverLabel = isApproved
    ? params.approverName
      ? `${params.approverName}`
      : '(Đã ký)'
    : params.isDraft
      ? '(Bản nháp - Chưa ký)'
      : '(Chữ ký, đóng dấu)';

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: BORDERLESS_TABLE_BORDERS,
    rows: [
      new TableRow({
        children: [
          // Cột trái: Nơi nhận
          new TableCell({
            width: { size: 45, type: WidthType.PERCENTAGE },
            borders: BORDERLESS_TABLE_BORDERS,
            children: [
              new Paragraph({
                spacing: { line: 240, after: 20 },
                children: [
                  new TextRun({
                    text: 'Nơi nhận:',
                    font: DEFAULT_FONT,
                    size: SIZE_12PT,
                    bold: true,
                    italics: true,
                  }),
                ],
              }),
              new Paragraph({
                spacing: { line: 220, after: 20 },
                children: [
                  new TextRun({
                    text: '- Như trên;',
                    font: DEFAULT_FONT,
                    size: SIZE_11PT,
                  }),
                ],
              }),
              new Paragraph({
                spacing: { line: 220, after: 20 },
                children: [
                  new TextRun({
                    text: '- Phòng GD&ĐT (để b/c);',
                    font: DEFAULT_FONT,
                    size: SIZE_11PT,
                  }),
                ],
              }),
              new Paragraph({
                spacing: { line: 220, after: 20 },
                children: [
                  new TextRun({
                    text: '- Lưu: VT, BGH.',
                    font: DEFAULT_FONT,
                    size: SIZE_11PT,
                  }),
                ],
              }),
            ],
          }),
          // Cột phải: Hiệu trưởng ký tên
          new TableCell({
            width: { size: 55, type: WidthType.PERCENTAGE },
            borders: BORDERLESS_TABLE_BORDERS,
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { line: 240, after: 20 },
                children: [
                  new TextRun({
                    text: 'HIỆU TRƯỞNG',
                    font: DEFAULT_FONT,
                    size: SIZE_13PT,
                    bold: true,
                  }),
                ],
              }),
              // Khoảng trống ký tên & đóng dấu (3 dòng)
              new Paragraph({ spacing: { line: 240, after: 80 }, children: [] }),
              new Paragraph({ spacing: { line: 240, after: 80 }, children: [] }),
              new Paragraph({ spacing: { line: 240, after: 80 }, children: [] }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { line: 240, after: 20 },
                children: [
                  new TextRun({
                    text: approverLabel,
                    font: DEFAULT_FONT,
                    size: SIZE_13PT,
                    bold: isApproved,
                    italics: !isApproved,
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });
}

/**
 * Xuất Buffer tệp Word (.docx) hoàn chỉnh chuẩn thể thức Nghị định 30/2020/NĐ-CP
 */
export async function generateDocumentDocxBuffer(params: DocumentDocxParams): Promise<Buffer> {
  const headerTable = buildAdminHeaderTable(params);
  const bodyElements = convertHtmlToDocxElements(params.editorContentHtml || '');
  const signatureTable = buildAdminSignatureTable(params);

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: {
            font: DEFAULT_FONT,
            size: SIZE_13PT,
          },
          paragraph: {
            spacing: {
              line: 276, // 1.15 line spacing
              after: 120, // 6pt after
            },
          },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            size: {
              width: 11906, // A4 width (210mm) in twips
              height: 16838, // A4 height (297mm) in twips
            },
            margin: {
              // Chuẩn Nghị định 30: Trên 20mm, Dưới 20mm, Trái 30mm, Phải 15mm
              top: convertMillimetersToTwip(20),
              bottom: convertMillimetersToTwip(20),
              left: convertMillimetersToTwip(30),
              right: convertMillimetersToTwip(15),
            },
          },
        },
        children: [
          headerTable,
          // Dòng cách giữa Header và Thân văn bản
          new Paragraph({
            spacing: { before: 180, after: 180 },
            children: [],
          }),
          ...bodyElements,
          // Dòng cách giữa Thân văn bản và Chữ ký
          new Paragraph({
            spacing: { before: 240, after: 180 },
            children: [],
          }),
          signatureTable,
        ],
      },
    ],
  });

  return await Packer.toBuffer(doc);
}
