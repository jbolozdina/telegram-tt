import type { ApiFormattedText, ApiMessageEntity } from '../api/types';
import { ApiMessageEntityTypes } from '../api/types';

import { RE_LINK_TEMPLATE } from '../config';
import { IS_EMOJI_SUPPORTED } from './windowEnvironment';

export const ENTITY_CLASS_BY_NODE_NAME: Record<string, ApiMessageEntityTypes> = {
  B: ApiMessageEntityTypes.Bold,
  STRONG: ApiMessageEntityTypes.Bold,
  I: ApiMessageEntityTypes.Italic,
  EM: ApiMessageEntityTypes.Italic,
  INS: ApiMessageEntityTypes.Underline,
  U: ApiMessageEntityTypes.Underline,
  S: ApiMessageEntityTypes.Strike,
  STRIKE: ApiMessageEntityTypes.Strike,
  DEL: ApiMessageEntityTypes.Strike,
  CODE: ApiMessageEntityTypes.Code,
  PRE: ApiMessageEntityTypes.Pre,
  BLOCKQUOTE: ApiMessageEntityTypes.Blockquote,
};

const MAX_TAG_DEEPNESS = 3;

export default function parseHtmlAsFormattedText(
  html: string, withMarkdownLinks = false, skipMarkdown = false,
): ApiFormattedText {
  const fragment = document.createElement('div');
  fragment.innerHTML = skipMarkdown ? html
    : withMarkdownLinks ? parseMarkdown(parseMarkdownLinks(html)) : parseMarkdown(html);
  fixImageContent(fragment);
  const text = fragment.innerText.trim().replace(/\u200b+/g, '');
  const trimShift = fragment.innerText.indexOf(text[0]);
  let textIndex = -trimShift;
  let recursionDeepness = 0;
  const entities: ApiMessageEntity[] = [];

  function addEntity(node: ChildNode) {
    if (node.nodeType === Node.COMMENT_NODE) return;
    const { index, entity } = getEntityDataFromNode(node, text, textIndex);

    if (entity) {
      textIndex = index;
      entities.push(entity);
    } else if (node.textContent) {
      // Skip newlines on the beginning
      if (index === 0 && node.textContent.trim() === '') {
        return;
      }
      textIndex += node.textContent.length;
    }

    if (node.hasChildNodes() && recursionDeepness <= MAX_TAG_DEEPNESS) {
      recursionDeepness += 1;
      Array.from(node.childNodes).forEach(addEntity);
    }
  }

  Array.from(fragment.childNodes).forEach((node) => {
    recursionDeepness = 1;
    addEntity(node);
  });

  return {
    text,
    entities: entities.length ? entities : undefined,
  };
}

export function fixImageContent(fragment: HTMLDivElement) {
  fragment.querySelectorAll('img').forEach((node) => {
    if (node.dataset.documentId) { // Custom Emoji
      node.textContent = (node as HTMLImageElement).alt || '';
    } else { // Regular emoji with image fallback
      node.replaceWith(node.alt || '');
    }
  });
}

export type InlineNode =
  | { type: 'text'; value: string }
  | { type: 'bold'; children: InlineNode[] }
  | { type: 'italic'; children: InlineNode[] }
  | { type: 'strike'; children: InlineNode[] }
  | { type: 'spoiler'; children: InlineNode[] }
  | { type: 'inlineCode'; value: string }
  | { type: 'customEmoji'; alt: string; documentId: string }
  | { type: 'link'; text: string; link: string };

export type BlockNode =
  | { type: 'codeblock'; language: string; code: string }
  | { type: 'inline'; children: InlineNode[] };

class InlineParser {
  private text: string;
  private pos: number;

  private markers: { marker: string; type: 'bold' | 'italic' | 'strike' | 'spoiler' }[] = [
    { marker: '**', type: 'bold' },
    { marker: '__', type: 'italic' },
    { marker: '~~', type: 'strike' },
    { marker: '||', type: 'spoiler' },
  ];

  constructor(text: string) {
    this.text = text;
    this.pos = 0;
  }

  public parse(stopMarker?: string): InlineNode[] {
    const nodes: InlineNode[] = [];
    let buffer = '';

    const flushBuffer = () => {
      if (buffer) {
        nodes.push({ type: 'text', value: buffer });
        buffer = '';
      }
    };

    while (this.pos < this.text.length) {
      // If a stop marker is provided and found, consume it and return.
      if (stopMarker && this.text.startsWith(stopMarker, this.pos)) {
        this.pos += stopMarker.length;
        flushBuffer();
        return nodes;
      }

      // --- Inline Code Handling ---
      if (this.text[this.pos] === '`') {
        const endIndex = this.text.indexOf('`', this.pos + 1);
        if (endIndex === -1 || endIndex === this.pos + 1) {
          // No closing delimiter found; treat the delimiter as literal.
          this.pos++;
          buffer += '`';
          continue;
        }
        flushBuffer();
        // Extract the code content.
        const codeContent = this.text.substring(this.pos + 1, endIndex);
        nodes.push({ type: 'inlineCode', value: codeContent });
        this.pos = endIndex + 1;
        continue;
      }

      // --- Bracket Expressions: Custom Emoji or Link ---
      if (this.text[this.pos] === '[') {
        const startPos = this.pos;
        const bracketRes = this.parseBracketExpression();
        if (bracketRes) {
          flushBuffer();
          const { text: innerText, content } = bracketRes;
          // Custom Emoji check.
          if (content.startsWith('customEmoji:')) {
            const idPart = content.substring('customEmoji:'.length);
            if (/^\d+$/.test(idPart)) {
              nodes.push({ type: 'customEmoji', alt: innerText, documentId: idPart });
              continue;
            }
          } else {
            // Validate link content.
            const linkPattern = new RegExp(`^${RE_LINK_TEMPLATE}$`);
            if (linkPattern.test(content)) {
              nodes.push({ type: 'link', text: innerText, link: content });
              continue;
            }
          }
          // Not a valid emoji or link; revert to literal.
          this.pos = startPos;
        }
      }

      // --- Inline Formatting Markers (bold, italic, etc.) ---
      let matchedMarker = false;
      for (const { marker, type } of this.markers) {
        if (this.text.startsWith(marker, this.pos)) {
          // Only treat as formatting if a closing marker exists
          const nextIndex = this.text.indexOf(marker, this.pos + marker.length);
          if (nextIndex === -1 || nextIndex === this.pos + marker.length) {
            continue;
          }
          flushBuffer();
          this.pos += marker.length; // Consume the opening marker.
          const children = this.parse(marker);
          nodes.push({ type: type, children });
          matchedMarker = true;
          break;
        }
      }
      if (matchedMarker) continue;
      buffer += this.text[this.pos];
      this.pos++;
    }
    flushBuffer();
    return nodes;
  }

  private parseBracketExpression(): { text: string; content: string } | null {
    const start = this.pos;
    if (this.text[start] !== '[') return null;
    const closeBracket = this.text.indexOf(']', start);
    if (closeBracket === -1) return null;
    const innerText = this.text.substring(start + 1, closeBracket);
    const nextChar = closeBracket + 1;
    if (this.text[nextChar] !== '(') return null;
    const endParen = this.text.indexOf(')', nextChar);
    if (endParen === -1) return null;
    const content = this.text.substring(nextChar + 1, endParen);
    this.pos = endParen + 1;
    return { text: innerText, content };
  }
}

/**
 * MarkdownParser splits the document into block-level nodes.
 * It distinguishes between fenced code blocks and text blocks.
 * Text blocks are then processed by the InlineParser.
 */
export class MarkdownParser {
  private input: string;
  private pos: number;

  constructor(input: string) {
    this.input = input;
    this.pos = 0;
  }

  public parse(): BlockNode[] {
    // debugger;
    const blocks: BlockNode[] = [];
    while (this.pos < this.input.length) {
      // Check for a fenced code block (must be at line start).
      if (this.input.startsWith('```', this.pos)) {
        const codeBlock = this.parseCodeBlock();
        if (codeBlock) {
          blocks.push(codeBlock);
          continue;
        } else {
          // If the fence is not valid as a code block, consume it as literal text.
          const literal = this.input.substring(this.pos, this.pos + 3);
          this.pos += 3;
          blocks.push({ type: 'inline', children: [{ type: 'text', value: literal }] });
          continue;
        }
      }

      const textBlock = this.parseTextBlock();
      if (textBlock !== null) {
        const inlineParser = new InlineParser(textBlock);
        const inlineNodes = inlineParser.parse();
        blocks.push({ type: 'inline', children: inlineNodes });
      }
    }
    return blocks;
  }

  /**
   * Parses a fenced code block starting at the current position.
   * A valid code block must have a newline immediately after the opening fence.
   */
  private parseCodeBlock(): BlockNode | null {
    const start = this.pos;

    // const indexOfClosingFence = this.input.indexOf('```', this.pos + 3);
    // if (indexOfClosingFence !== -1 && indexOfClosingFence !== this.pos + 3 && this.input[indexOfClosingFence - 1] !== '\n') {
    //   const code = this.input.substring(this.pos + 3, indexOfClosingFence);
    //   this.pos += indexOfClosingFence + 3;
    //   return { type: 'codeblock', language: '', code };
    // }

    if (!this.atLineStart()) return null;
    this.pos += 3; // Consume opening fence.

    // Require a newline immediately after the opening fence.
    const newlineIndex = this.input.indexOf('\n', this.pos);
    if (newlineIndex === -1) {
      // Not a valid code block; do not parse.

      this.pos = start;
      return null;
    }
    // The content before the newline is an optional language specifier.
    let language = this.input.substring(this.pos, newlineIndex).trim();
    this.pos = newlineIndex + 1; // Skip the newline.

    // Look for the closing fence.
    const closingFence = '\n```';
    let end = this.input.indexOf(closingFence, this.pos);
    if (end === -1) {
      // Fallback: look for any "```" after pos.
      end = this.input.indexOf('```', this.pos);
      if (end === -1) {
        // No closing fence found; treat rest as code.
        end = this.input.length;
      }
    }
    const code = this.input.substring(this.pos, end);
    this.pos = end;
    // Consume the closing fence if present.
    if (this.input.startsWith(closingFence, this.pos)) {
      this.pos += closingFence.length;
    } else if (this.input.startsWith('```', this.pos)) {
      this.pos += 3;
    }
    // this.skipNewlines();
    return { type: 'codeblock', language, code };
  }

  /**
   * Parses a text block until the next code block fence or end of input.
   */
  private parseTextBlock(): string | null {
    const start = this.pos;
    while (this.pos < this.input.length) {
      if (this.atLineStart() && this.input.startsWith('```', this.pos)) break;
      this.pos++;
    }
    return this.pos > start ? this.input.substring(start, this.pos) : null;
  }

  private atLineStart(): boolean {
    return this.pos === 0 || this.input[this.pos - 1] === '\n' || this.input[this.pos - 1] === '\r';
  }

  private skipNewlines(): void {
    while (this.pos < this.input.length && (this.input[this.pos] === '\n' || this.input[this.pos] === '\r')) {
      this.pos++;
    }
  }
}

export class MarkdownToHTMLConverter {
  public static convert(blocks: BlockNode[]): string {
    return blocks
      .map((block) => {
        if (block.type === 'codeblock') {
          return block.language
            ? `<pre data-language="${block.language}">${block.code}</pre>`
            : `<pre>${block.code}</pre>`;
        } else {
          return MarkdownToHTMLConverter.convertInline(block.children);
        }
      })
      .join('');
  }

  private static convertInline(nodes: InlineNode[]): string {
    return nodes
      .map((node) => {
        switch (node.type) {
          case 'text':
            return node.value;
          case 'bold':
            return `<b>${MarkdownToHTMLConverter.convertInline(node.children)}</b>`;
          case 'italic':
            return `<i>${MarkdownToHTMLConverter.convertInline(node.children)}</i>`;
          case 'strike':
            return `<s>${MarkdownToHTMLConverter.convertInline(node.children)}</s>`;
          case 'spoiler':
            return `<span data-entity-type="${ApiMessageEntityTypes.Spoiler}">${MarkdownToHTMLConverter.convertInline(
              node.children
            )}</span>`;
          case 'inlineCode':
            return `<code>${node.value}</code>`;
          case 'customEmoji':
            return !IS_EMOJI_SUPPORTED
              ? `[${node.alt}]`
              : `<img alt="${node.alt}" data-document-id="${node.documentId}">`;
          case 'link': {
            let url: string;
            if (node.link.includes('://')) {
              url = node.link;
            } else if (node.link.includes('@')) {
              url = `mailto:${node.link}`;
            } else {
              url = `https://${node.link}`;
            }
            return `<a href="${url}">${node.text}</a>`;
          }
          default:
            return '';
        }
      })
      .join('');
  }
}

function parseMarkdown(html: string) {
  let parsedHtml = html.slice(0);

  // Strip redundant nbsp's
  parsedHtml = parsedHtml.replace(/&nbsp;/g, ' ');

  // Replace <div><br></div> with newline (new line in Safari)
  parsedHtml = parsedHtml.replace(/<div><br([^>]*)?><\/div>/g, '\n');
  // Replace <br> with newline
  parsedHtml = parsedHtml.replace(/<br([^>]*)?>/g, '\n');

  // Strip redundant <div> tags
  parsedHtml = parsedHtml.replace(/<\/div>(\s*)<div>/g, '\n');
  parsedHtml = parsedHtml.replace(/<div>/g, '\n');
  parsedHtml = parsedHtml.replace(/<\/div>/g, '');

  const parser = new MarkdownParser(parsedHtml);
  const ast = parser.parse();

  return MarkdownToHTMLConverter.convert(ast);
}

function parseMarkdownLinks(html: string) {
  return html.replace(new RegExp(`\\[([^\\]]+?)]\\((${RE_LINK_TEMPLATE}+?)\\)`, 'g'), (_, text, link) => {
    const url = link.includes('://') ? link : link.includes('@') ? `mailto:${link}` : `https://${link}`;
    return `<a href="${url}">${text}</a>`;
  });
}

function getEntityDataFromNode(
  node: ChildNode,
  rawText: string,
  textIndex: number,
): { index: number; entity?: ApiMessageEntity } {
  const type = getEntityTypeFromNode(node);

  if (!type || !node.textContent) {
    return {
      index: textIndex,
      entity: undefined,
    };
  }

  const rawIndex = rawText.indexOf(node.textContent, textIndex);
  // In some cases, last text entity ends with a newline (which gets trimmed from `rawText`).
  // In this case, `rawIndex` would return `-1`, so we use `textIndex` instead.
  const index = rawIndex >= 0 ? rawIndex : textIndex;
  const offset = rawText.substring(0, index).length;
  const { length } = rawText.substring(index, index + node.textContent.length);

  if (type === ApiMessageEntityTypes.TextUrl) {
    return {
      index,
      entity: {
        type,
        offset,
        length,
        url: (node as HTMLAnchorElement).href,
      },
    };
  }
  if (type === ApiMessageEntityTypes.MentionName) {
    return {
      index,
      entity: {
        type,
        offset,
        length,
        userId: (node as HTMLAnchorElement).dataset.userId!,
      },
    };
  }

  if (type === ApiMessageEntityTypes.Pre) {
    return {
      index,
      entity: {
        type,
        offset,
        length,
        language: (node as HTMLPreElement).dataset.language,
      },
    };
  }

  if (type === ApiMessageEntityTypes.CustomEmoji) {
    return {
      index,
      entity: {
        type,
        offset,
        length,
        documentId: (node as HTMLImageElement).dataset.documentId!,
      },
    };
  }

  return {
    index,
    entity: {
      type,
      offset,
      length,
    },
  };
}

function getEntityTypeFromNode(node: ChildNode): ApiMessageEntityTypes | undefined {
  if (node instanceof HTMLElement && node.dataset.entityType) {
    return node.dataset.entityType as ApiMessageEntityTypes;
  }

  if (ENTITY_CLASS_BY_NODE_NAME[node.nodeName]) {
    return ENTITY_CLASS_BY_NODE_NAME[node.nodeName];
  }

  if (node.nodeName === 'A') {
    const anchor = node as HTMLAnchorElement;
    if (anchor.dataset.entityType === ApiMessageEntityTypes.MentionName) {
      return ApiMessageEntityTypes.MentionName;
    }
    if (anchor.dataset.entityType === ApiMessageEntityTypes.Url) {
      return ApiMessageEntityTypes.Url;
    }
    if (anchor.href.startsWith('mailto:')) {
      return ApiMessageEntityTypes.Email;
    }
    if (anchor.href.startsWith('tel:')) {
      return ApiMessageEntityTypes.Phone;
    }
    if (anchor.href !== anchor.textContent) {
      return ApiMessageEntityTypes.TextUrl;
    }

    return ApiMessageEntityTypes.Url;
  }

  if (node.nodeName === 'SPAN') {
    return (node as HTMLElement).dataset.entityType as any;
  }

  if (node.nodeName === 'IMG') {
    if ((node as HTMLImageElement).dataset.documentId) {
      return ApiMessageEntityTypes.CustomEmoji;
    }
  }

  return undefined;
}
