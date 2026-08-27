import { MarkdownConverter } from '../src/markdown.js';

// Setup environment global for Node.js test environment
globalThis.Node = {
  ELEMENT_NODE: 1,
  TEXT_NODE: 3
};

class MockClassList {
  constructor() {
    this._classes = new Set();
  }
  add(...names) {
    names.forEach(n => this._classes.add(n));
  }
  contains(name) {
    return this._classes.has(name);
  }
  has(name) {
    return this._classes.has(name);
  }
  [Symbol.iterator]() {
    return this._classes[Symbol.iterator]();
  }
}

/**
 * Lightweight mock DOM Node helper for pure Node.js unit tests
 */
class MockNode {
  constructor(type, tagName = '', textContent = '') {
    this.nodeType = type;
    this.tagName = tagName.toUpperCase();
    this._textContent = textContent;
    this.childNodes = [];
    this.parentElement = null;
    this.attributes = new Map();
    this.classList = new MockClassList();
  }

  get textContent() {
    if (this.nodeType === Node.TEXT_NODE) return this._textContent;
    return this.childNodes.map(c => c.textContent).join('');
  }

  set textContent(val) {
    this._textContent = val;
    this.childNodes = [];
  }

  get children() {
    return this.childNodes.filter(c => c.nodeType === Node.ELEMENT_NODE);
  }

  appendChild(child) {
    child.parentElement = this;
    this.childNodes.push(child);
    return child;
  }

  setAttribute(name, value) {
    this.attributes.set(name, value);
  }

  getAttribute(name) {
    return this.attributes.get(name) || null;
  }

  closest(selector) {
    let current = this.parentElement;
    const targetTag = selector.toUpperCase();
    while (current) {
      if (current.tagName === targetTag) return current;
      current = current.parentElement;
    }
    return null;
  }

  querySelector(selector) {
    const results = this.querySelectorAll(selector);
    return results.length > 0 ? results[0] : null;
  }

  querySelectorAll(selector) {
    const matches = [];
    const target = selector.toLowerCase();

    const walk = (node) => {
      for (const child of node.childNodes) {
        if (child.nodeType === Node.ELEMENT_NODE) {
          const tag = child.tagName.toLowerCase();
          if (
            tag === target ||
            (target.startsWith('.') && child.classList.has(target.slice(1))) ||
            (target.includes('span') && tag === 'span')
          ) {
            matches.push(child);
          }
          walk(child);
        }
      }
    };

    walk(this);
    return matches;
  }
}

function createElement(tagName, attrs = {}, classes = []) {
  const el = new MockNode(Node.ELEMENT_NODE, tagName);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  for (const c of classes) el.classList.add(c);
  return el;
}

function createText(text) {
  return new MockNode(Node.TEXT_NODE, '', text);
}

// Simple test harness
let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failed++;
  }
}

console.log('=== Running MarkdownConverter Unit Tests ===\n');

// Test 1: Basic Rich Text
console.log('Test 1: Rich Text & Paragraph Formatting');
{
  const root = createElement('div');
  const p = createElement('p');
  p.appendChild(createText('Hello '));
  const strong = createElement('strong');
  strong.appendChild(createText('World'));
  p.appendChild(strong);
  p.appendChild(createText(' and '));
  const em = createElement('em');
  em.appendChild(createText('Gemini'));
  p.appendChild(em);
  root.appendChild(p);

  const md = MarkdownConverter.cleanMarkdown(MarkdownConverter.fromHtml(root));
  assert(md === 'Hello **World** and *Gemini*', `Formats paragraph with bold and italic correctly (got: "${md}")`);
}

// Test 2: Code Blocks & Inline Code
console.log('\nTest 2: Code Blocks & Inline Code');
{
  const root = createElement('div');
  const codeBlock = createElement('code-block');
  const decor = createElement('div', {}, ['code-block-decoration']);
  const langSpan = createElement('span');
  langSpan.appendChild(createText('python'));
  decor.appendChild(langSpan);
  codeBlock.appendChild(decor);

  const pre = createElement('pre');
  pre.appendChild(createText('def test():\n    return True'));
  codeBlock.appendChild(pre);
  root.appendChild(codeBlock);

  const md = MarkdownConverter.cleanMarkdown(MarkdownConverter.fromHtml(root));
  assert(md.includes('```python') && md.includes('def test():\n    return True') && md.endsWith('```'),
    `Formats <code-block> into language-fenced Markdown block (got: "${md}")`);
}

// Test 3: Table Conversion
console.log('\nTest 3: Table Parsing with Header Separators');
{
  const root = createElement('div');
  const table = createElement('table');
  const thead = createElement('thead');
  const trH = createElement('tr');
  const th1 = createElement('th');
  th1.appendChild(createText('Name'));
  const th2 = createElement('th');
  th2.appendChild(createText('Role'));
  trH.appendChild(th1);
  trH.appendChild(th2);
  thead.appendChild(trH);
  table.appendChild(thead);

  const tbody = createElement('tbody');
  const trB1 = createElement('tr');
  const td1 = createElement('td');
  td1.appendChild(createText('Alice'));
  const td2 = createElement('td');
  td2.appendChild(createText('Engineer'));
  trB1.appendChild(td1);
  trB1.appendChild(td2);
  tbody.appendChild(trB1);
  table.appendChild(tbody);
  root.appendChild(table);

  const md = MarkdownConverter.cleanMarkdown(MarkdownConverter.fromHtml(root));
  assert(md.includes('| Name | Role |'), `Contains header row (got: "${md}")`);
  assert(md.includes('| --- | --- |'), `Contains alignment separator (got: "${md}")`);
  assert(md.includes('| Alice | Engineer |'), `Contains body row (got: "${md}")`);
}

// Test 4: UI Artifact and Footnote Noise Stripping
console.log('\nTest 4: Noise Element & Footnote Stripping');
{
  const root = createElement('div');
  const p = createElement('p');
  p.appendChild(createText('Verified result'));
  
  const footnote = createElement('source-footnote');
  footnote.appendChild(createText('[1]'));
  p.appendChild(footnote);
  
  const carousel = createElement('sources-carousel');
  carousel.appendChild(createText('Sources link'));
  p.appendChild(carousel);
  
  const btn = createElement('button', {}, ['qol-copy-markdown-btn']);
  btn.appendChild(createText('MD'));
  p.appendChild(btn);

  root.appendChild(p);

  const md = MarkdownConverter.cleanMarkdown(MarkdownConverter.fromHtml(root));
  assert(md === 'Verified result', `Strips footnote, sources-carousel, and button noise (got: "${md}")`);
}

// Test 5: Lists (Ordered and Unordered)
console.log('\nTest 5: List Conversion');
{
  const root = createElement('div');
  const ol = createElement('ol');
  const li1 = createElement('li');
  li1.appendChild(createText('First'));
  const li2 = createElement('li');
  li2.appendChild(createText('Second'));
  ol.appendChild(li1);
  ol.appendChild(li2);
  root.appendChild(ol);

  const md = MarkdownConverter.cleanMarkdown(MarkdownConverter.fromHtml(root));
  assert(md.includes('1. First') && md.includes('2. Second'), `Formats ordered lists with numbers (got: "${md}")`);
}

console.log(`\n=== Test Results: ${passed} passed, ${failed} failed ===`);
if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
