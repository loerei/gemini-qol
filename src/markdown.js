/**
 * ============================================================================
 * 1. MARKDOWN CONVERTER MODULE (Deep, Stateless Element-to-Markdown Translator)
 * ============================================================================
 */
export class MarkdownConverter {
  /**
   * Translates a DOM node and its children recursively into clean Markdown text.
   * Runtime-agnostic: operates seamlessly in browser and Node.js test environments.
   * @param {Node} node - The DOM node to parse
   * @returns {string} The parsed Markdown content
   */
  static fromHtml(node) {
    if (!node) return '';

    const TEXT_NODE = typeof Node !== 'undefined' ? Node.TEXT_NODE : 3;
    const ELEMENT_NODE = typeof Node !== 'undefined' ? Node.ELEMENT_NODE : 1;

    if (node.nodeType === TEXT_NODE) {
      return node.textContent || '';
    }

    if (node.nodeType !== ELEMENT_NODE) {
      return '';
    }

    const tagName = (node.tagName || '').toLowerCase();

    // Skip interactive UI, action bars, metadata noise, citations, and scripts/styles
    const NOISE_TAGS = [
      'button', 'style', 'script', 'sources-carousel', 'sources-carousel-inline',
      'source-footnote', 'mat-icon', 'gem-icon', 'gem-menu', 'gem-menu-item',
      'gem-icon-button', 'gem-popover'
    ];

    if (
      NOISE_TAGS.includes(tagName) ||
      node.classList?.contains('qol-copy-markdown-btn') ||
      node.classList?.contains('actions-container') ||
      node.classList?.contains('screen-reader-only') ||
      node.classList?.contains('cdk-visually-hidden')
    ) {
      return '';
    }

    // Tables have specialized row/cell aggregation
    if (tagName === 'table') {
      return this._parseTable(node);
    }

    const childrenMarkdown = Array.from(node.childNodes || [])
      .map(child => this.fromHtml(child))
      .join('');

    switch (tagName) {
      case 'p':
        return `\n\n${childrenMarkdown.trim()}\n\n`;
      case 'h1':
        return `\n\n# ${childrenMarkdown.trim()}\n\n`;
      case 'h2':
        return `\n\n## ${childrenMarkdown.trim()}\n\n`;
      case 'h3':
        return `\n\n### ${childrenMarkdown.trim()}\n\n`;
      case 'h4':
        return `\n\n#### ${childrenMarkdown.trim()}\n\n`;
      case 'h5':
        return `\n\n##### ${childrenMarkdown.trim()}\n\n`;
      case 'h6':
        return `\n\n###### ${childrenMarkdown.trim()}\n\n`;
      case 'strong':
      case 'b':
        return `**${childrenMarkdown}**`;
      case 'em':
      case 'i':
        return `*${childrenMarkdown}*`;
      case 'code':
        if (node.closest?.('pre') || node.closest?.('code-block')) {
          return childrenMarkdown; // Enclosing pre/code-block handles formatting
        }
        return `\`${childrenMarkdown}\``;
      case 'pre': {
        if (node.closest?.('code-block')) {
          return node.textContent || '';
        }
        const codeEl = node.querySelector?.('code');
        const langClass = codeEl ? Array.from(codeEl.classList || []).find(c => c.startsWith('language-')) : '';
        const lang = langClass ? langClass.replace('language-', '') : '';
        return `\n\n\`\`\`${lang}\n${(node.textContent || '').trim()}\n\`\`\`\n\n`;
      }
      case 'code-block': {
        const langSpan = node.querySelector?.('.code-block-decoration span, [class*="code-lang"]');
        let lang = langSpan ? (langSpan.textContent || '').trim().toLowerCase() : '';
        if (lang === 'đoạn mã' || lang === 'code') lang = '';
        const pre = node.querySelector?.('pre');
        const codeText = pre ? (pre.textContent || '') : (node.textContent || '');
        return `\n\n\`\`\`${lang}\n${codeText.trim()}\n\`\`\`\n\n`;
      }
      case 'ul':
        return `\n${childrenMarkdown}\n`;
      case 'ol':
        return `\n${childrenMarkdown}\n`;
      case 'li': {
        const parent = node.parentElement;
        if (parent && (parent.tagName || '').toLowerCase() === 'ol') {
          const index = Array.from(parent.children || []).indexOf(node) + 1;
          return `${index}. ${childrenMarkdown.trim()}\n`;
        }
        return `* ${childrenMarkdown.trim()}\n`;
      }
      case 'blockquote':
        return `\n\n> ${childrenMarkdown.trim()}\n\n`;
      case 'a': {
        const href = node.getAttribute?.('href');
        return `[${childrenMarkdown}](${href || ''})`;
      }
      case 'br':
        return '\n';
      case 'hr':
        return '\n\n---\n\n';
      case 'div':
      case 'span':
      case 'response-element':
      default:
        return childrenMarkdown;
    }
  }

  /**
   * Helper to parse HTML tables into standard Markdown pipe table format.
   * @param {HTMLElement} tableNode 
   * @returns {string} Markdown table
   */
  static _parseTable(tableNode) {
    const sanitizeCell = (cell) => {
      const text = this.fromHtml(cell).trim();
      return text.replace(/\n+/g, '<br>').replace(/\|/g, '\\|');
    };

    const thead = tableNode.querySelector?.('thead');
    const tbody = tableNode.querySelector?.('tbody');

    let headerCells = [];
    if (thead) {
      const firstRow = thead.querySelector?.('tr') || thead;
      headerCells = Array.from(firstRow.children || []).filter(c => ['th', 'td'].includes((c.tagName || '').toLowerCase()));
    } else {
      const firstRow = tableNode.querySelector?.('tr');
      if (firstRow) {
        headerCells = Array.from(firstRow.children || []).filter(c => ['th', 'td'].includes((c.tagName || '').toLowerCase()));
      }
    }

    let md = '\n\n';
    if (headerCells.length > 0) {
      const headers = headerCells.map(c => sanitizeCell(c));
      md += `| ${headers.join(' | ')} |\n`;
      md += `| ${headers.map(() => '---').join(' | ')} |\n`;
    }

    const bodyRows = tbody
      ? Array.from(tbody.querySelectorAll?.('tr') || [])
      : Array.from(tableNode.querySelectorAll?.('tr') || []).slice(thead ? 0 : (headerCells.length > 0 ? 1 : 0));

    for (const row of bodyRows) {
      const cells = Array.from(row.children || []).filter(c => ['td', 'th'].includes((c.tagName || '').toLowerCase()));
      if (cells.length > 0) {
        const cellTexts = cells.map(c => sanitizeCell(c));
        md += `| ${cellTexts.join(' | ')} |\n`;
      }
    }

    return `${md}\n`;
  }

  /**
   * Sanitizes double or redundant carriage returns from generated Markdown
   * @param {string} md - The raw Markdown
   * @returns {string} The cleaned Markdown
   */
  static cleanMarkdown(md) {
    return (md || '')
      .replace(/\n{3,}/g, '\n\n') // Max out at 2 consecutive newlines
      .trim();
  }
}
