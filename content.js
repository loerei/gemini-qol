(() => {
  // src/i18n.js
  var i18n = {
    lang: (typeof document !== "undefined" && document.documentElement ? document.documentElement.lang || "en" : "en").toLowerCase().startsWith("vi") ? "vi" : "en",
    t(key) {
      const translations = {
        vi: {
          selectAll: "Ch\u1ECDn t\u1EA5t c\u1EA3",
          loadAll: "T\u1EA3i h\u1EBFt",
          loading: "\u0110ang t\u1EA3i",
          loadedAll: "\u0110\xE3 t\u1EA3i h\u1EBFt",
          deleteSelected: "X\xF3a c\xE1c m\u1EE5c \u0111\xE3 ch\u1ECDn",
          confirmDelete: "B\u1EA1n c\xF3 ch\u1EAFc ch\u1EAFn mu\u1ED1n x\xF3a {count} cu\u1ED9c tr\xF2 chuy\u1EC7n \u0111\xE3 ch\u1ECDn?",
          copyMd: "Sao ch\xE9p d\u01B0\u1EDBi d\u1EA1ng Markdown",
          copyTooltip: "Sao ch\xE9p Markdown (.md)",
          copied: "\u0110\xE3 ch\xE9p!",
          copyReportMd: "Sao ch\xE9p b\xE1o c\xE1o Markdown",
          copyMdMenu: "Sao ch\xE9p d\u01B0\u1EDBi d\u1EA1ng Markdown",
          reportGenerating: "\u0110ang t\u1ED5ng h\u1EE3p b\xE1o c\xE1o...",
          daily: "Daily:",
          weekly: "Weekly:"
        },
        en: {
          selectAll: "Select all",
          loadAll: "Load all",
          loading: "Loading",
          loadedAll: "Loaded all",
          deleteSelected: "Delete selected items",
          confirmDelete: "Are you sure you want to delete {count} selected conversations?",
          copyMd: "Copy as Markdown",
          copyTooltip: "Copy Markdown (.md)",
          copied: "Copied!",
          copyReportMd: "Copy report as Markdown",
          copyMdMenu: "Copy as Markdown",
          reportGenerating: "Synthesizing report...",
          daily: "Daily:",
          weekly: "Weekly:"
        }
      };
      return translations[this.lang] && translations[this.lang][key] || translations["en"][key] || key;
    }
  };

  // src/markdown.js
  var MarkdownConverter = class {
    /**
     * Translates a DOM node and its children recursively into clean Markdown text.
     * Runtime-agnostic: operates seamlessly in browser and Node.js test environments.
     * @param {Node} node - The DOM node to parse
     * @returns {string} The parsed Markdown content
     */
    static fromHtml(node) {
      if (!node) return "";
      const TEXT_NODE = typeof Node !== "undefined" ? Node.TEXT_NODE : 3;
      const ELEMENT_NODE = typeof Node !== "undefined" ? Node.ELEMENT_NODE : 1;
      if (node.nodeType === TEXT_NODE) {
        return node.textContent || "";
      }
      if (node.nodeType !== ELEMENT_NODE) {
        return "";
      }
      const tagName = (node.tagName || "").toLowerCase();
      const NOISE_TAGS = [
        "button",
        "style",
        "script",
        "sources-carousel",
        "sources-carousel-inline",
        "source-footnote",
        "mat-icon",
        "gem-icon",
        "gem-menu",
        "gem-menu-item",
        "gem-icon-button",
        "gem-popover"
      ];
      if (NOISE_TAGS.includes(tagName) || node.classList?.contains("qol-copy-markdown-btn") || node.classList?.contains("actions-container") || node.classList?.contains("screen-reader-only") || node.classList?.contains("cdk-visually-hidden")) {
        return "";
      }
      if (tagName === "table") {
        return this._parseTable(node);
      }
      const childrenMarkdown = Array.from(node.childNodes || []).map((child) => this.fromHtml(child)).join("");
      switch (tagName) {
        case "p":
          return `

${childrenMarkdown.trim()}

`;
        case "h1":
          return `

# ${childrenMarkdown.trim()}

`;
        case "h2":
          return `

## ${childrenMarkdown.trim()}

`;
        case "h3":
          return `

### ${childrenMarkdown.trim()}

`;
        case "h4":
          return `

#### ${childrenMarkdown.trim()}

`;
        case "h5":
          return `

##### ${childrenMarkdown.trim()}

`;
        case "h6":
          return `

###### ${childrenMarkdown.trim()}

`;
        case "strong":
        case "b":
          return `**${childrenMarkdown}**`;
        case "em":
        case "i":
          return `*${childrenMarkdown}*`;
        case "code":
          if (node.closest?.("pre") || node.closest?.("code-block")) {
            return childrenMarkdown;
          }
          return `\`${childrenMarkdown}\``;
        case "pre": {
          if (node.closest?.("code-block")) {
            return node.textContent || "";
          }
          const codeEl = node.querySelector?.("code");
          const langClass = codeEl ? Array.from(codeEl.classList || []).find((c) => c.startsWith("language-")) : "";
          const lang = langClass ? langClass.replace("language-", "") : "";
          return `

\`\`\`${lang}
${(node.textContent || "").trim()}
\`\`\`

`;
        }
        case "code-block": {
          const langSpan = node.querySelector?.('.code-block-decoration span, [class*="code-lang"]');
          let lang = langSpan ? (langSpan.textContent || "").trim().toLowerCase() : "";
          if (lang === "\u0111o\u1EA1n m\xE3" || lang === "code") lang = "";
          const pre = node.querySelector?.("pre");
          const codeText = pre ? pre.textContent || "" : node.textContent || "";
          return `

\`\`\`${lang}
${codeText.trim()}
\`\`\`

`;
        }
        case "ul":
          return `
${childrenMarkdown}
`;
        case "ol":
          return `
${childrenMarkdown}
`;
        case "li": {
          const parent = node.parentElement;
          if (parent && (parent.tagName || "").toLowerCase() === "ol") {
            const index = Array.from(parent.children || []).indexOf(node) + 1;
            return `${index}. ${childrenMarkdown.trim()}
`;
          }
          return `* ${childrenMarkdown.trim()}
`;
        }
        case "blockquote":
          return `

> ${childrenMarkdown.trim()}

`;
        case "a": {
          const href = node.getAttribute?.("href");
          return `[${childrenMarkdown}](${href || ""})`;
        }
        case "br":
          return "\n";
        case "hr":
          return "\n\n---\n\n";
        case "div":
        case "span":
        case "response-element":
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
        return text.replace(/\n+/g, "<br>").replace(/\|/g, "\\|");
      };
      const thead = tableNode.querySelector?.("thead");
      const tbody = tableNode.querySelector?.("tbody");
      let headerCells = [];
      if (thead) {
        const firstRow = thead.querySelector?.("tr") || thead;
        headerCells = Array.from(firstRow.children || []).filter((c) => ["th", "td"].includes((c.tagName || "").toLowerCase()));
      } else {
        const firstRow = tableNode.querySelector?.("tr");
        if (firstRow) {
          headerCells = Array.from(firstRow.children || []).filter((c) => ["th", "td"].includes((c.tagName || "").toLowerCase()));
        }
      }
      let md = "\n\n";
      if (headerCells.length > 0) {
        const headers = headerCells.map((c) => sanitizeCell(c));
        md += `| ${headers.join(" | ")} |
`;
        md += `| ${headers.map(() => "---").join(" | ")} |
`;
      }
      const bodyRows = tbody ? Array.from(tbody.querySelectorAll?.("tr") || []) : Array.from(tableNode.querySelectorAll?.("tr") || []).slice(thead ? 0 : headerCells.length > 0 ? 1 : 0);
      for (const row of bodyRows) {
        const cells = Array.from(row.children || []).filter((c) => ["td", "th"].includes((c.tagName || "").toLowerCase()));
        if (cells.length > 0) {
          const cellTexts = cells.map((c) => sanitizeCell(c));
          md += `| ${cellTexts.join(" | ")} |
`;
        }
      }
      return `${md}
`;
    }
    /**
     * Sanitizes double or redundant carriage returns from generated Markdown
     * @param {string} md - The raw Markdown
     * @returns {string} The cleaned Markdown
     */
    static cleanMarkdown(md) {
      return (md || "").replace(/\n{3,}/g, "\n\n").trim();
    }
  };

  // src/logger.js
  var Logger = class {
    static LOG_KEY = "gemini_qol_dev_logs";
    static MAX_LOGS = 500;
    static log(component, message, data = null) {
      this._write("INFO", component, message, data);
    }
    static warn(component, message, data = null) {
      this._write("WARN", component, message, data);
    }
    static error(component, message, error = null) {
      this._write("ERROR", component, message, error ? error.stack || error.message || String(error) : null);
    }
    static _write(level, component, message, detail) {
      const timestamp = (/* @__PURE__ */ new Date()).toISOString();
      const formatted = `[${timestamp}] [${level}] [${component}] ${message}`;
      const badgeStyle = level === "ERROR" ? "background: #f44336; color: #fff; border-radius: 3px; padding: 1px 4px;" : level === "WARN" ? "background: #ff9800; color: #000; border-radius: 3px; padding: 1px 4px;" : "background: #2196f3; color: #fff; border-radius: 3px; padding: 1px 4px;";
      if (detail) {
        console.log(`%c Gemini QoL %c ${level} `, "background: #333; color: #4caf50; font-weight: bold; border-radius: 3px; padding: 1px 4px;", badgeStyle, `[${component}]`, message, detail);
      } else {
        console.log(`%c Gemini QoL %c ${level} `, "background: #333; color: #4caf50; font-weight: bold; border-radius: 3px; padding: 1px 4px;", badgeStyle, `[${component}]`, message);
      }
      try {
        const logs = this.getLogs();
        logs.push({ timestamp, level, component, message, detail });
        if (logs.length > this.MAX_LOGS) {
          logs.shift();
        }
        localStorage.setItem(this.LOG_KEY, JSON.stringify(logs));
      } catch (e) {
      }
    }
    static getLogs() {
      try {
        const data = localStorage.getItem(this.LOG_KEY);
        return data ? JSON.parse(data) : [];
      } catch (e) {
        return [];
      }
    }
    static clearLogs() {
      localStorage.removeItem(this.LOG_KEY);
      console.log("%c Gemini QoL %c Cleared dev logs", "background: #333; color: #4caf50", "color: #aaa");
    }
    static downloadLogs() {
      const logs = this.getLogs();
      const textContent = logs.map(
        (l) => `[${l.timestamp}] [${l.level}] [${l.component}] ${l.message}` + (l.detail ? `
  Detail: ${JSON.stringify(l.detail)}` : "")
      ).join("\n");
      const blob = new Blob([textContent], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `gemini-qol-dev-${Date.now()}.log`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };
  if (typeof window !== "undefined") {
    window.qolDownloadLogs = () => Logger.downloadLogs();
    window.qolClearLogs = () => Logger.clearLogs();
    window.qolGetLogs = () => Logger.getLogs();
  }

  // src/automator.js
  var GeminiAutomator = class _GeminiAutomator {
    // DOM Selectors mapped in one place for maintainability (Updated for Gemini QoL)
    static SELECTORS = {
      SIDEBAR_LIST: 'conversations-list[data-test-id="all-conversations"], [data-test-id="all-conversations"], .conversations-list, recent-conversations-list, gem-conversations-list, [data-test-id="recent-conversations"], .recent-conversations-list',
      CHAT_ITEM: 'gem-nav-list-item[data-test-id="conversation"], [data-test-id="conversation"], gem-nav-list-item, conversation-item, .conversation-item, [role="listitem"]',
      CHAT_LINK: 'a[href*="/app/"]',
      ACTIONS_BTN: '[data-test-id="actions-menu-button"], button[aria-haspopup="menu"], mat-icon[fonticon="more_vert"], mat-icon[data-mat-icon-name="more_vert"], [data-mat-icon-name="more_vert"]',
      CONFIRM_BTN: '[data-test-id="confirm-button"] button, [data-test-id="confirm-button"], button[data-test-id="confirm-button"]',
      CANCEL_BTN: '[data-test-id="cancel-button"] button, [data-test-id="cancel-button"], button[data-test-id="cancel-button"]',
      MENU_ITEMS: '.mat-mdc-menu-item, button[role="menuitem"]',
      NATIVE_COPY_ICON: 'mat-icon[fonticon="copy"], mat-icon[data-mat-icon-name="copy"], mat-icon[fonticon="content_copy"], mat-icon[data-mat-icon-name="content_copy"]',
      TOOLBAR_CONTAINER: '.actions-container, [role="toolbar"], .response-actions-container, .message-actions, .response-actions',
      DEEP_RESEARCH_TOOLBAR: "div.toolbar.has-title > div.action-buttons, .toolbar > .action-buttons",
      DEEP_RESEARCH_EXPORT_BTN: '[data-test-id="export-menu-button"], .export-menu-button',
      DEEP_RESEARCH_CONTENT: "message-content, .markdown.markdown-main-panel, .markdown",
      DEEP_RESEARCH_CREATE_BTN: 'canvas-create-button, [data-test-id="create-button"]',
      DEEP_RESEARCH_STREAMING: '[aria-busy="true"], .streaming, mat-progress-spinner'
    };
    /**
     * Helper to fire robust synthetic click events for Angular web components & MDC buttons.
     * @param {HTMLElement} el 
     */
    static triggerClick(el) {
      if (!el) return;
      const innerNative = el.querySelector?.('button, [role="button"], a, input');
      const targetEl = innerNative || el.closest('button, [role="menuitem"], a, input, gem-button, gmp-menu-item, gem-menu-item, .mat-mdc-menu-item') || el;
      if (!targetEl || targetEl.disabled || targetEl.getAttribute("aria-disabled") === "true") return;
      try {
        if (typeof targetEl.focus === "function") targetEl.focus();
      } catch (e) {
      }
      const pointerDownOpts = { bubbles: true, cancelable: true, view: window, button: 0, buttons: 1, pointerId: 1, pointerType: "mouse", isPrimary: true };
      const mouseDownOpts = { bubbles: true, cancelable: true, view: window, button: 0, buttons: 1 };
      const pointerUpOpts = { bubbles: true, cancelable: true, view: window, button: 0, buttons: 0, pointerId: 1, pointerType: "mouse", isPrimary: true };
      const mouseUpOpts = { bubbles: true, cancelable: true, view: window, button: 0, buttons: 0 };
      try {
        targetEl.dispatchEvent(new PointerEvent("pointerdown", pointerDownOpts));
        targetEl.dispatchEvent(new MouseEvent("mousedown", mouseDownOpts));
        targetEl.dispatchEvent(new PointerEvent("pointerup", pointerUpOpts));
        targetEl.dispatchEvent(new MouseEvent("mouseup", mouseUpOpts));
        targetEl.click();
      } catch (e) {
      }
    }
    /**
     * Generic Internal DOM Condition Waiter (DRY helper to eliminate code duplication)
     */
    static _waitForCondition(conditionFn, timeoutMs = 1500, targetContainer = null) {
      return new Promise((resolve) => {
        const container = targetContainer || document.body;
        const initial = conditionFn(container);
        if (initial !== null && initial !== false) return resolve(initial);
        let observer = null;
        let timer = null;
        const cleanup = () => {
          if (observer) {
            observer.disconnect();
            observer = null;
          }
          if (timer) {
            clearTimeout(timer);
            timer = null;
          }
        };
        observer = new MutationObserver(() => {
          const res = conditionFn(container);
          if (res !== null && res !== false) {
            cleanup();
            resolve(res);
          }
        });
        try {
          observer.observe(container, { childList: true, subtree: true });
        } catch (e) {
          observer.observe(document.body, { childList: true, subtree: true });
        }
        timer = setTimeout(() => {
          cleanup();
          resolve(conditionFn(container));
        }, timeoutMs);
      });
    }
    /**
     * Immediate-Evaluating Flexible Promise Waiter for DOM Elements
     */
    static waitForElement(matcherOrSelector, timeoutMs = 1500, targetContainer = null) {
      const resolveMatcher = (container) => {
        if (typeof matcherOrSelector === "function") {
          try {
            return matcherOrSelector(container);
          } catch (e) {
            return null;
          }
        }
        if (typeof matcherOrSelector === "string") {
          return container.querySelector(matcherOrSelector) || document.querySelector(matcherOrSelector);
        }
        return null;
      };
      return _GeminiAutomator._waitForCondition(resolveMatcher, timeoutMs, targetContainer);
    }
    /**
     * Immediate-Evaluating Flexible Promise Waiter for DOM Element Removal
     */
    static waitForElementToDisappear(matcherOrSelector, timeoutMs = 1500, targetContainer = null) {
      const resolveMatcher = (container) => {
        if (typeof matcherOrSelector === "function") {
          try {
            return matcherOrSelector(container) ? null : true;
          } catch (e) {
            return true;
          }
        }
        if (typeof matcherOrSelector === "string") {
          const found = container.querySelector(matcherOrSelector) || document.querySelector(matcherOrSelector);
          return found ? null : true;
        }
        return true;
      };
      return _GeminiAutomator._waitForCondition(resolveMatcher, timeoutMs, targetContainer);
    }
    /**
     * Unified Async Overlay & Scroll-Lock Cleanup Helper
     */
    static async cleanupOverlaysAndScrollLocks() {
      const hasActiveDialog = document.querySelector('mat-dialog-container, code-import-dialog, [role="dialog"]');
      if (!hasActiveDialog) {
        const body = document.body;
        const html = document.documentElement;
        if (body) {
          body.classList.remove("cdk-global-scrollblock");
          body.style.top = "";
          body.style.position = "";
          body.style.paddingRight = "";
          body.style.overflow = "";
        }
        if (html) {
          html.classList.remove("cdk-global-scrollblock");
          html.style.top = "";
          html.style.position = "";
          html.style.paddingRight = "";
          html.style.overflow = "";
        }
        const orphanedBackdrop = document.querySelector(".cdk-overlay-container > .cdk-overlay-backdrop");
        const overlayPanes = document.querySelectorAll(".cdk-overlay-container > .cdk-overlay-pane:not(:empty)");
        if (orphanedBackdrop && overlayPanes.length === 0) {
          try {
            orphanedBackdrop.remove();
          } catch (e) {
          }
        }
      }
    }
    /**
     * Finds the native copy button inside a response element with multiple fallbacks.
     * @param {HTMLElement} responseEl 
     * @returns {HTMLElement|null}
     */
    static findNativeCopyButton(responseEl) {
      const copyIcon = responseEl.querySelector(_GeminiAutomator.SELECTORS.NATIVE_COPY_ICON);
      if (copyIcon) {
        const btn = copyIcon.closest("button");
        if (btn) return btn;
      }
      const buttons = responseEl.querySelectorAll("button");
      for (const btn of buttons) {
        const label = (btn.getAttribute("aria-label") || btn.getAttribute("title") || "").toLowerCase();
        if (label.includes("copy") || label.includes("ch\xE9p") || label.includes("sao")) {
          return btn;
        }
      }
      return null;
    }
    /**
     * Helper promise to sleep.
     * @param {number} ms - Milliseconds to sleep
     */
    static wait(ms) {
      return new Promise((resolve) => setTimeout(resolve, ms));
    }
    /**
     * Find a sidebar conversation list item node by its unique Chat ID.
     * @param {string} chatId - The conversation ID
     * @returns {HTMLElement|null} The matching element
     */
    static findSidebarItem(chatId) {
      const items = document.querySelectorAll(_GeminiAutomator.SELECTORS.CHAT_ITEM);
      for (const item of items) {
        if (item.dataset.qolDeleted === "true" || item.style.display === "none") continue;
        const a = item.querySelector(_GeminiAutomator.SELECTORS.CHAT_LINK);
        if (a) {
          const href = a.getAttribute("href");
          if (href?.includes(chatId)) {
            return item;
          }
        }
      }
      return null;
    }
    /**
     * Scans parents from the list element to locate the scrollable viewport container.
     * @returns {HTMLElement|null} The scrollable parent container
     */
    static getScrollContainer() {
      const list = document.querySelector(_GeminiAutomator.SELECTORS.SIDEBAR_LIST);
      if (!list) return null;
      let parent = list.parentElement;
      while (parent && parent !== document.body) {
        const style = window.getComputedStyle(parent);
        if (style.overflowY === "auto" || style.overflowY === "scroll" || parent.classList.contains("content-wrapper")) {
          return parent;
        }
        parent = parent.parentElement;
      }
      return list.parentElement;
    }
    /**
     * Scrolls the conversation list to trigger AJAX fetches.
     */
    static scrollSidebarToBottom() {
      const list = document.querySelector(_GeminiAutomator.SELECTORS.SIDEBAR_LIST);
      if (!list) return;
      const items = list.querySelectorAll(_GeminiAutomator.SELECTORS.CHAT_ITEM);
      if (items.length > 0) {
        try {
          items[items.length - 1].scrollIntoView({ block: "end" });
        } catch (err) {
          console.warn("ScrollIntoView fallback failed:", err);
        }
      }
      const container = _GeminiAutomator.getScrollContainer();
      if (container) {
        container.scrollTop = container.scrollHeight;
        container.dispatchEvent(new Event("scroll"));
      }
    }
    /**
     * Scrolls all scrollable parents of the conversation list to the very top.
     */
    static scrollSidebarToTop() {
      const list = document.querySelector(_GeminiAutomator.SELECTORS.SIDEBAR_LIST);
      if (!list) return;
      let parent = list.parentElement;
      while (parent && parent !== document.body) {
        if (parent.scrollTop > 0 || parent.scrollHeight > parent.clientHeight) {
          parent.scrollTop = 0;
          parent.dispatchEvent(new Event("scroll"));
        }
        parent = parent.parentElement;
      }
    }
    /**
     * Loops scrolling down the sidebar to load all available conversations.
     * @param {Function} onScrollStepCallback - Invoked on each scroll cycle
     */
    static async loadAllChats(onScrollStepCallback) {
      const list = document.querySelector(_GeminiAutomator.SELECTORS.SIDEBAR_LIST);
      const container = _GeminiAutomator.getScrollContainer();
      if (!list || !container) return;
      let lastCount = 0;
      let noChangeAttempts = 0;
      let totalSteps = 0;
      const maxTotalSteps = 100;
      while (noChangeAttempts < 3 && totalSteps < maxTotalSteps) {
        totalSteps++;
        const currentItems = document.querySelectorAll(_GeminiAutomator.SELECTORS.CHAT_ITEM);
        const currentCount = currentItems.length;
        if (currentCount === lastCount) {
          noChangeAttempts++;
        } else {
          noChangeAttempts = 0;
          lastCount = currentCount;
        }
        _GeminiAutomator.scrollSidebarToBottom();
        if (onScrollStepCallback) onScrollStepCallback(currentCount);
        await _GeminiAutomator.waitForElement(() => {
          const nowCount = document.querySelectorAll(_GeminiAutomator.SELECTORS.CHAT_ITEM).length;
          return nowCount > currentCount ? document.body : null;
        }, 1500, list);
        const isAtBottom = container.scrollHeight - container.scrollTop - container.clientHeight <= 25;
        if (noChangeAttempts >= 3 && isAtBottom) {
          break;
        }
      }
    }
    /**
     * Query the DOM for the dynamic Delete option button in open menus.
     * Multi-tier language-agnostic matcher (Attributes -> Icons -> Multi-language Fallback)
     * @returns {HTMLElement|null} The delete menu item element
     */
    static findDeleteMenuButton() {
      const exact = document.querySelector(
        '.cdk-overlay-pane [data-test-id="delete-button"], .mat-mdc-menu-panel [data-test-id="delete-button"], [role="menu"] [data-test-id="delete-button"], .cdk-overlay-pane [jslog*="186000"], .cdk-overlay-pane [value="delete"]'
      );
      if (exact) {
        return exact.closest('[role="menuitem"], .mat-mdc-menu-item, button, gmp-menu-item, gem-menu-item') || exact;
      }
      const icon = document.querySelector(
        '.cdk-overlay-pane mat-icon[fonticon="delete"], .cdk-overlay-pane gem-icon[fonticonname="delete"], .cdk-overlay-pane [data-mat-icon-name="delete"]'
      );
      if (icon) {
        return icon.closest('[role="menuitem"], .mat-mdc-menu-item, button, gmp-menu-item, gem-menu-item') || icon;
      }
      const deleteKeywords = ["x\xF3a", "xo\xE1", "delete", "supprimer", "eliminar", "l\xF6schen", "\u524A\u9664", "\u5220\u9664", "\uC0AD\uC81C"];
      const menuPanels = document.querySelectorAll(
        '.mat-mdc-menu-panel, .mat-menu-panel, [role="menu"], .cdk-overlay-pane, [class*="menu"]'
      );
      for (const panel of menuPanels) {
        const candidates = panel.querySelectorAll(
          '.mat-mdc-menu-item, [role="menuitem"], gmp-menu-item, gem-menu-item, button, div, a, span'
        );
        for (const el of candidates) {
          const text = (el.textContent || "").trim().toLowerCase();
          if (deleteKeywords.some((kw) => text === kw || text.includes(kw))) {
            return el.closest('[role="menuitem"], .mat-mdc-menu-item, button, gmp-menu-item, gem-menu-item') || el;
          }
        }
      }
      return null;
    }
    /**
     * Query the DOM for the dynamic Delete confirmation button in popup modal.
     * Multi-tier language-agnostic matcher (CDK Focus & Telemetry Key -> Dialog Action Position -> Multi-language Fallback)
     * @returns {HTMLElement|null} The confirm button element
     */
    static findConfirmButton() {
      const primaryFocusBtn = document.querySelector(
        '[role="dialog"] gem-button[cdkfocusinitial], mat-dialog-container gem-button[cdkfocusinitial], [role="dialog"] [jslog*="186009"], mat-dialog-container [jslog*="186009"]'
      );
      if (primaryFocusBtn) {
        return primaryFocusBtn.querySelector?.("button") || primaryFocusBtn.closest("button") || primaryFocusBtn;
      }
      const dialogActions = document.querySelectorAll("mat-dialog-actions, .mat-mdc-dialog-actions, .mdc-dialog__actions");
      const cancelKeywords = ["hu\u1EF7", "h\u1EE7y", "cancel", "annuler", "cancelar", "abbrechen", "\u30AD\u30E3\u30F3\u30BB\u30EB", "\u53D6\u6D88", "\uCDE8\uC18C"];
      const deleteKeywords = ["x\xF3a", "xo\xE1", "delete", "confirm", "supprimer", "eliminar", "l\xF6schen", "\u524A\u9664", "\u786E\u5B9A", "\uD655\uC778"];
      for (let i = dialogActions.length - 1; i >= 0; i--) {
        const candidates = dialogActions[i].querySelectorAll("gem-button, button");
        for (const cand of candidates) {
          const text = (cand.textContent || "").trim().toLowerCase();
          if (cancelKeywords.some((kw) => text.includes(kw))) {
            continue;
          }
          if (deleteKeywords.some((kw) => text === kw || text.includes(kw))) {
            return cand.querySelector?.("button") || cand.closest("button") || cand;
          }
        }
      }
      const dialogContainers = document.querySelectorAll(
        'mat-dialog-container, .mat-mdc-dialog-container, [role="dialog"], gmp-dialog, .cdk-overlay-pane, [class*="dialog"]'
      );
      for (let i = dialogContainers.length - 1; i >= 0; i--) {
        const dialog = dialogContainers[i];
        const buttons = dialog.querySelectorAll("gem-button, button, span.gds-body-m");
        for (const btn of buttons) {
          const text = (btn.textContent || "").trim().toLowerCase();
          if (cancelKeywords.some((kw) => text.includes(kw))) {
            continue;
          }
          if (deleteKeywords.some((kw) => text === kw || text.includes(kw))) {
            return btn.querySelector?.("button") || btn.closest("button") || btn;
          }
        }
      }
      const testIdBtn = document.querySelector(_GeminiAutomator.SELECTORS.CONFIRM_BTN);
      if (testIdBtn) {
        return testIdBtn.querySelector?.("button") || testIdBtn.closest("button") || testIdBtn;
      }
      return null;
    }
    /**
     * Waits for active dialog overlay to unmount or close.
     */
    static async waitForDialogClose(maxWait = 1500) {
      await this.waitForElementToDisappear('mat-dialog-container, .mat-mdc-dialog-container, [role="dialog"]', maxWait);
      await this.cleanupOverlaysAndScrollLocks();
    }
    /**
     * Automation pipeline to delete a conversation cleanly.
     * @param {string} chatId - ID of the conversation
     * @returns {Promise<number>} Elapsed time in ms
     */
    static async deleteConversation(chatId) {
      Logger.log("Automator", `Starting deletion for chatId: ${chatId}`);
      const safeChatId = typeof CSS !== "undefined" && CSS.escape ? CSS.escape(chatId) : chatId;
      const item = this.findSidebarItem(safeChatId) || this.findSidebarItem(chatId);
      if (!item) {
        Logger.error("Automator", `Item not found for ID: ${chatId}`);
        throw new Error(`Item not found for ID: ${chatId}`);
      }
      const startTime = Date.now();
      item.classList.add("qol-deleting");
      item.dataset.qolStatus = "deleting";
      item.style.pointerEvents = "none";
      item.style.opacity = "0.6";
      item.style.transition = "opacity 0.2s ease, max-height 0.2s ease";
      try {
        let actionsBtn = item.querySelector(_GeminiAutomator.SELECTORS.ACTIONS_BTN);
        if (!actionsBtn) {
          const moreVertIcon = item.querySelector('mat-icon[fonticon="more_vert"], mat-icon[data-mat-icon-name="more_vert"], [data-mat-icon-name="more_vert"]');
          if (moreVertIcon) {
            actionsBtn = moreVertIcon.closest('button, gem-icon-button, [aria-haspopup="menu"]') || moreVertIcon;
          }
        }
        if (!actionsBtn) {
          throw new Error("Actions menu button not found");
        }
        this.triggerClick(actionsBtn);
        const overlayContainer = document.querySelector(".cdk-overlay-container") || document.body;
        const deleteBtn = await this.waitForElement(() => _GeminiAutomator.findDeleteMenuButton(), 1500, overlayContainer);
        if (!deleteBtn) {
          throw new Error("Timeout waiting for Delete menu option");
        }
        this.triggerClick(deleteBtn);
        const confirmBtn = await this.waitForElement(() => _GeminiAutomator.findConfirmButton(), 1500, overlayContainer);
        if (!confirmBtn) {
          throw new Error("Timeout waiting for Confirm button in modal dialog");
        }
        this.triggerClick(confirmBtn);
        await this.waitForElementToDisappear('mat-dialog-container, [role="dialog"], .cdk-overlay-backdrop', 3500);
        item.style.display = "none";
        item.classList.remove("qol-deleting");
        item.dataset.qolStatus = "deleted";
        item.dataset.qolDeleted = "true";
      } catch (err) {
        Logger.error("Automator", `Deletion failed for ${chatId}: ${err.message}`);
        item.classList.remove("qol-deleting");
        item.dataset.qolStatus = "injected";
        item.style.pointerEvents = "";
        item.style.opacity = "";
        item.style.display = "";
        this.dismissDialog();
        throw err;
      }
      const elapsed = Date.now() - startTime;
      Logger.log("Automator", `Successfully deleted chatId: ${chatId} in ${elapsed}ms`);
      return elapsed;
    }
    /**
     * Triggers a cancel event on open dialogs as a recovery step.
     */
    static dismissDialog() {
      const cancelBtn = document.querySelector(_GeminiAutomator.SELECTORS.CANCEL_BTN);
      if (cancelBtn) {
        try {
          cancelBtn.click();
        } catch (e) {
        }
        return;
      }
      const dialogContainers = document.querySelectorAll(
        'mat-dialog-container, .mat-mdc-dialog-container, [role="dialog"], gmp-dialog, .cdk-overlay-pane'
      );
      for (const dialog of dialogContainers) {
        const buttons = dialog.querySelectorAll("button");
        for (const btn of buttons) {
          const text = (btn.textContent || "").trim().toLowerCase();
          if (text.includes("hu\u1EF7") || text.includes("h\u1EE7y") || text.includes("cancel")) {
            try {
              btn.click();
            } catch (e) {
            }
            return;
          }
        }
      }
    }
  };

  // src/quota.js
  var QuotaMonitor = class {
    static getUsageUrl() {
      const match = window.location.pathname.match(/^\/u\/(\d+)/);
      const userPath = match ? `/u/${match[1]}` : "";
      return `${window.location.origin}${userPath}/usage`;
    }
    static updateSidebarQuotaUI(quotaData) {
      if (!quotaData) return;
      console.log("Gemini QoL - Updating UI with:", quotaData);
      const profileLink = document.querySelector(".mavatar-footer-left") || document.querySelector('[data-test-id="user-profile-button"]') || document.querySelector(".user-profile-button") || document.querySelector('[class*="profile"]');
      if (!profileLink) return;
      const userInfo = profileLink.querySelector(".mavatar-user-info");
      if (userInfo) {
        const staleExpanded = userInfo.querySelector(".qol-quota-expanded");
        if (staleExpanded) {
          staleExpanded.remove();
        }
      }
      const isCollapsed = userInfo ? userInfo.offsetWidth === 0 : true;
      if (profileLink && !isCollapsed) {
        let expanded = profileLink.querySelector(".qol-quota-expanded");
        if (!expanded) {
          expanded = document.createElement("div");
          expanded.className = "qol-quota-expanded";
          profileLink.appendChild(expanded);
        }
        const dailyVal = parseInt(quotaData.dailyUsage) || 0;
        const weeklyVal = parseInt(quotaData.weeklyUsage) || 0;
        const dailyClass = dailyVal > 80 ? "danger" : dailyVal > 50 ? "warning" : "success";
        const weeklyClass = weeklyVal > 80 ? "danger" : weeklyVal > 50 ? "warning" : "success";
        const cleanDailyReset = quotaData.dailyReset ? quotaData.dailyReset.replace(/Đặt lại\s+lúc\s+/i, "").replace(/Đặt lại\s+/i, "").replace(/Resets?\s+at\s+/i, "").replace(/Resets?\s+/i, "") : "";
        const cleanWeeklyReset = quotaData.weeklyReset ? quotaData.weeklyReset.replace(/Đặt lại\s+vào\s+/i, "").replace(/Đặt lại\s+lúc\s+/i, "").replace(/Đặt lại\s+/i, "").replace(/Resets?\s+on\s+/i, "").replace(/Resets?\s+at\s+/i, "").replace(/Resets?\s+/i, "") : "";
        expanded.innerHTML = `
        <div class="qol-quota-row">
          <span class="qol-quota-metric">
            <span class="qol-quota-label">${i18n.t("daily")}</span>
            <span class="qol-quota-val ${dailyClass}">${quotaData.dailyUsage}</span>
          </span>
          <span class="qol-quota-reset" title="${quotaData.dailyReset || ""}">${cleanDailyReset}</span>
        </div>
        <div class="qol-quota-row">
          <span class="qol-quota-metric">
            <span class="qol-quota-label">${i18n.t("weekly")}</span>
            <span class="qol-quota-val ${weeklyClass}">${quotaData.weeklyUsage}</span>
          </span>
          <span class="qol-quota-reset" title="${quotaData.weeklyReset || ""}">${cleanWeeklyReset}</span>
        </div>
      `;
        expanded.style.display = "flex";
      } else {
        const expanded = profileLink.querySelector(".qol-quota-expanded");
        if (expanded) expanded.style.display = "none";
      }
      const imgContainer = profileLink.querySelector(".mavatar-container");
      if (imgContainer) {
        let collapsed = imgContainer.querySelector(".qol-quota-collapsed");
        if (!collapsed) {
          collapsed = document.createElement("div");
          collapsed.className = "qol-quota-collapsed";
          imgContainer.appendChild(collapsed);
        }
        collapsed.textContent = quotaData.dailyUsage;
        collapsed.title = `Daily: ${quotaData.dailyUsage} (${quotaData.dailyReset})
Weekly: ${quotaData.weeklyUsage} (${quotaData.weeklyReset})`;
        if (isCollapsed) {
          collapsed.classList.add("visible");
        } else {
          collapsed.classList.remove("visible");
        }
      }
    }
  };

  // src/index.js
  var ContentCoordinator = {
    // State
    selectedChats: /* @__PURE__ */ new Map(),
    isDeleting: false,
    // State for bulk GitHub repository imports
    importQueue: [],
    isImportingMultiple: false,
    importTotalCount: 0,
    isReopeningDialog: false,
    // Inject sub-toolbar above conversation list
    injectSidebarToolbar() {
      const list = document.querySelector(GeminiAutomator.SELECTORS.SIDEBAR_LIST);
      if (!list) return;
      const existingToolbar = document.querySelector(".gemini-qol-sidebar-toolbar");
      if (existingToolbar) {
        if (existingToolbar.nextElementSibling === list) {
          return;
        }
        existingToolbar.remove();
      }
      const toolbar = document.createElement("div");
      toolbar.className = "gemini-qol-sidebar-toolbar";
      toolbar.innerHTML = `
      <div class="qol-toolbar-left">
        <label class="qol-toolbar-select-all-container">
          <input type="checkbox" id="qol-toolbar-select-all-cb">
          <span class="qol-toolbar-custom-cb"></span>
          <span class="qol-toolbar-label">${i18n.t("selectAll")}</span>
        </label>
        <button class="qol-toolbar-link-btn" id="qol-toolbar-load-all-btn" title="${i18n.t("loadAll")}">${i18n.t("loadAll")}</button>
        <span class="qol-toolbar-status" id="qol-toolbar-status-text"></span>
      </div>
      <div class="qol-toolbar-right">
        <button class="qol-toolbar-btn-delete" id="qol-toolbar-delete-btn" disabled title="${i18n.t("deleteSelected")}" aria-label="${i18n.t("deleteSelected")}">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
          </svg>
        </button>
      </div>
      <div class="qol-toolbar-progress-container" id="qol-toolbar-progress-wrap">
        <div class="qol-toolbar-progress-bar" id="qol-toolbar-progress-bar"></div>
      </div>
    `;
      list.parentNode.insertBefore(toolbar, list);
      toolbar.querySelector("#qol-toolbar-select-all-cb").addEventListener("change", (e) => this.handleToggleAll(e));
      toolbar.querySelector("#qol-toolbar-delete-btn").addEventListener("click", () => this.handleBulkDelete());
      toolbar.querySelector("#qol-toolbar-load-all-btn").addEventListener("click", () => this.handleLoadAll());
      this.updateToolbarUI();
    },
    // Inject checkbox into conversation item
    injectCheckbox(item) {
      const status = item.dataset.qolStatus;
      if (status === "injected" || status === "deleting" || status === "deleted" || item.classList.contains("qol-has-checkbox")) return;
      const a = item.querySelector(GeminiAutomator.SELECTORS.CHAT_LINK);
      if (!a) return;
      const href = a.getAttribute("href");
      const match = href.match(/\/app\/([a-z0-9]+)/i);
      if (!match) return;
      const chatId = match[1];
      const container = document.createElement("label");
      container.className = "gemini-qol-checkbox-container";
      container.dataset.chatId = chatId;
      container.addEventListener("click", (e) => e.stopPropagation());
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = this.selectedChats.has(chatId);
      checkbox.addEventListener("change", (e) => {
        const titleSpan = item.querySelector('.title-text, [class*="title"], span');
        const title = titleSpan ? titleSpan.textContent.trim() : "Cu\u1ED9c tr\xF2 chuy\u1EC7n";
        if (e.target.checked) {
          this.selectedChats.set(chatId, title);
        } else {
          this.selectedChats.delete(chatId);
        }
        this.updateToolbarUI();
      });
      const customCheckbox = document.createElement("span");
      customCheckbox.className = "gemini-qol-custom-checkbox";
      container.appendChild(checkbox);
      container.appendChild(customCheckbox);
      item.insertBefore(container, item.firstChild);
      item.classList.add("qol-has-checkbox");
      item.dataset.qolStatus = "injected";
    },
    // Reusable action helper to copy markdown from a DOM element with streaming guard and feedback state
    async executeCopyMarkdown(contentEl, btnEl, { clipboardWriter = null, isMenuItem = false } = {}) {
      if (!contentEl) {
        Logger.error("Coordinator", "Cannot copy markdown: content element is null");
        return false;
      }
      const isStreaming = !!contentEl.closest?.(GeminiAutomator.SELECTORS.DEEP_RESEARCH_STREAMING) || !!contentEl.querySelector?.(GeminiAutomator.SELECTORS.DEEP_RESEARCH_STREAMING) || contentEl.getAttribute?.("aria-busy") === "true" || contentEl.classList?.contains("streaming");
      if (isStreaming) {
        Logger.log("Coordinator", "Report is currently generating/streaming");
        if (btnEl) {
          const tooltip = btnEl.querySelector?.(".qol-tooltip");
          if (tooltip) {
            const orig = tooltip.textContent;
            tooltip.textContent = i18n.t("reportGenerating");
            setTimeout(() => {
              tooltip.textContent = orig;
            }, 2e3);
          }
        }
        return false;
      }
      const rawMd = MarkdownConverter.fromHtml(contentEl);
      const cleanMd = MarkdownConverter.cleanMarkdown(rawMd);
      try {
        const writeFn = clipboardWriter || ((text) => navigator.clipboard.writeText(text));
        await writeFn(cleanMd);
        if (btnEl) {
          if (btnEl._qolResetTimer) {
            clearTimeout(btnEl._qolResetTimer);
          }
          if (!btnEl._qolOriginalHtml) {
            btnEl._qolOriginalHtml = btnEl.innerHTML;
          }
          if (isMenuItem) {
            btnEl.classList.add("copied");
          } else {
            btnEl.innerHTML = `
            <span class="mat-mdc-button-persistent-ripple mdc-icon-button__ripple"></span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4caf50" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            <span class="qol-tooltip">${i18n.t("copied")}</span>
            <span class="mat-focus-indicator"></span>
          `;
            btnEl.classList.add("copied");
          }
          btnEl._qolResetTimer = setTimeout(() => {
            if (btnEl._qolOriginalHtml) {
              btnEl.innerHTML = btnEl._qolOriginalHtml;
            }
            btnEl.classList.remove("copied");
            btnEl._qolResetTimer = null;
          }, 2e3);
        }
        return true;
      } catch (err) {
        Logger.error("Coordinator", "Failed to copy Markdown content: " + (err.message || err));
        return false;
      }
    },
    // Inject "Copy as Markdown" next to native copy button
    injectMarkdownCopyButton(responseEl) {
      const status = responseEl.dataset.qolStatus;
      if (status === "injected" || status === "no-copy" || responseEl.querySelector(".qol-copy-markdown-btn")) {
        if (responseEl.querySelector(".qol-copy-markdown-btn")) {
          responseEl.dataset.qolStatus = "injected";
        }
        return;
      }
      const nativeCopyBtn = GeminiAutomator.findNativeCopyButton(responseEl);
      if (!nativeCopyBtn) {
        const isStreaming = !!responseEl.querySelector(".streaming") || responseEl.getAttribute("aria-busy") === "true";
        if (!isStreaming) {
          responseEl.dataset.qolStatus = "no-copy";
        }
        return;
      }
      const mainToolbar = nativeCopyBtn.closest(GeminiAutomator.SELECTORS.TOOLBAR_CONTAINER) || nativeCopyBtn.parentElement?.parentElement;
      if (!mainToolbar) return;
      const btn = document.createElement("button");
      btn.className = nativeCopyBtn.className + " qol-copy-markdown-btn";
      btn.title = i18n.t("copyMd");
      btn.setAttribute("type", "button");
      btn.setAttribute("aria-label", i18n.t("copyMd"));
      btn.setAttribute("tabindex", "0");
      btn.innerHTML = `
      <span class="mat-mdc-button-persistent-ripple mdc-icon-button__ripple"></span>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;">
        <path d="M7 16V8l3 4 3-4v8"/>
        <path d="M16 8h2a2.5 2.5 0 0 1 2.5 2.5v3a2.5 2.5 0 0 1-2.5 2.5h-2V8z"/>
      </svg>
      <span class="qol-tooltip">${i18n.t("copyTooltip")}</span>
      <span class="mat-focus-indicator"></span>
    `;
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        e.preventDefault();
        const contentEl = responseEl.querySelector("message-content") || responseEl.querySelector(".message-content") || responseEl;
        await this.executeCopyMarkdown(contentEl, btn);
      });
      let currentChild = nativeCopyBtn;
      while (currentChild.parentElement && currentChild.parentElement !== mainToolbar) {
        currentChild = currentChild.parentElement;
      }
      mainToolbar.insertBefore(btn, currentChild.nextSibling);
      responseEl.dataset.qolStatus = "injected";
    },
    // Inject 1-click Markdown Copy Button into Deep Research Report Header Toolbar
    injectDeepResearchToolbarButton() {
      const toolbars = document.querySelectorAll(GeminiAutomator.SELECTORS.DEEP_RESEARCH_TOOLBAR);
      if (!toolbars || toolbars.length === 0) return;
      toolbars.forEach((toolbar) => {
        if (toolbar.querySelector(".qol-copy-report-md-btn")) return;
        const btn = document.createElement("button");
        btn.className = "qol-copy-markdown-btn qol-copy-report-md-btn";
        btn.setAttribute("type", "button");
        btn.setAttribute("aria-label", i18n.t("copyReportMd"));
        btn.setAttribute("title", i18n.t("copyReportMd"));
        btn.setAttribute("tabindex", "0");
        btn.innerHTML = `
        <span class="mat-mdc-button-persistent-ripple mdc-icon-button__ripple"></span>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;">
          <path d="M7 16V8l3 4 3-4v8"/>
          <path d="M16 8h2a2.5 2.5 0 0 1 2.5 2.5v3a2.5 2.5 0 0 1-2.5 2.5h-2V8z"/>
        </svg>
        <span class="qol-tooltip">${i18n.t("copyReportMd")}</span>
        <span class="mat-focus-indicator"></span>
      `;
        btn.addEventListener("click", async (e) => {
          e.stopPropagation();
          e.preventDefault();
          const container = toolbar.closest('.response-container-content, [class*="response-container"], [class*="panel"]') || document;
          const contentEl = container.querySelector(GeminiAutomator.SELECTORS.DEEP_RESEARCH_CONTENT) || document.querySelector(GeminiAutomator.SELECTORS.DEEP_RESEARCH_CONTENT);
          await this.executeCopyMarkdown(contentEl, btn);
        });
        const refBtn = toolbar.querySelector(GeminiAutomator.SELECTORS.DEEP_RESEARCH_CREATE_BTN) || toolbar.querySelector(GeminiAutomator.SELECTORS.DEEP_RESEARCH_EXPORT_BTN) || toolbar.firstElementChild;
        if (refBtn) {
          toolbar.insertBefore(btn, refBtn);
        } else {
          toolbar.appendChild(btn);
        }
      });
    },
    // Inject "Copy as Markdown" into "Share & export" CDK Dropdown Menu
    injectDeepResearchExportMenuItem() {
      const menus = document.querySelectorAll('.cdk-overlay-pane gem-menu, .cdk-overlay-pane [role="menu"]');
      if (!menus || menus.length === 0) return;
      menus.forEach((menu) => {
        if (menu.querySelector(".qol-export-md-menu-item")) return;
        const nativeCopyItem = menu.querySelector('[data-test-id="copy-button"]') || menu.querySelector('[data-test-id="export-to-docs-button"]') || menu.querySelector('[data-test-id="share-button"]');
        if (!nativeCopyItem) return;
        const menuItem = document.createElement("button");
        menuItem.className = "qol-export-md-menu-item";
        menuItem.setAttribute("type", "button");
        menuItem.setAttribute("role", "menuitem");
        menuItem.setAttribute("tabindex", "0");
        menuItem.setAttribute("aria-label", i18n.t("copyMdMenu"));
        menuItem.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M7 16V8l3 4 3-4v8"/>
          <path d="M16 8h2a2.5 2.5 0 0 1 2.5 2.5v3a2.5 2.5 0 0 1-2.5 2.5h-2V8z"/>
        </svg>
        <span class="menu-item-label">${i18n.t("copyMdMenu")}</span>
      `;
        const handleAction = async (e) => {
          e.stopPropagation();
          e.preventDefault();
          const contentEl = document.querySelector(GeminiAutomator.SELECTORS.DEEP_RESEARCH_CONTENT);
          await this.executeCopyMarkdown(contentEl, menuItem, { isMenuItem: true });
          const backdrop = document.querySelector(".cdk-overlay-backdrop");
          if (backdrop) {
            backdrop.click();
          }
        };
        menuItem.addEventListener("click", handleAction);
        menuItem.addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") {
            handleAction(e);
          }
        });
        if (nativeCopyItem.nextSibling) {
          nativeCopyItem.parentNode.insertBefore(menuItem, nativeCopyItem.nextSibling);
        } else {
          nativeCopyItem.parentNode.appendChild(menuItem);
        }
      });
    },
    // Toggle selection on all visible checkboxes
    handleToggleAll(e) {
      const checked = e.target.checked;
      const items = document.querySelectorAll(GeminiAutomator.SELECTORS.CHAT_ITEM);
      items.forEach((item) => {
        const cb = item.querySelector('.gemini-qol-checkbox-container input[type="checkbox"]');
        if (cb && cb.checked !== checked) {
          cb.checked = checked;
          cb.dispatchEvent(new Event("change"));
        }
      });
    },
    // Load all conversation history by scrolling
    async handleLoadAll() {
      const loadBtn = document.getElementById("qol-toolbar-load-all-btn");
      if (!loadBtn) return;
      loadBtn.disabled = true;
      loadBtn.textContent = `${i18n.t("loading")}...`;
      await GeminiAutomator.loadAllChats((count) => {
        loadBtn.textContent = `${i18n.t("loading")} (${count})...`;
      });
      loadBtn.textContent = i18n.t("loadedAll");
      GeminiAutomator.scrollSidebarToTop();
      await GeminiAutomator.wait(1500);
      loadBtn.style.display = "none";
    },
    // Execute bulk deletion sequence
    async handleBulkDelete() {
      if (this.selectedChats.size === 0 || this.isDeleting) return;
      const confirmAction = confirm(i18n.t("confirmDelete").replace("{count}", this.selectedChats.size));
      if (!confirmAction) return;
      this.isDeleting = true;
      this.updateToolbarUI();
      const progressWrap = document.getElementById("qol-toolbar-progress-wrap");
      const progressBar = document.getElementById("qol-toolbar-progress-bar");
      const selectAllCb = document.getElementById("qol-toolbar-select-all-cb");
      if (progressWrap) progressWrap.style.display = "block";
      const chatIds = Array.from(this.selectedChats.keys());
      const total = chatIds.length;
      let adaptiveCooldown = 50;
      for (let i = 0; i < total; i++) {
        const chatId = chatIds[i];
        if (progressBar) progressBar.style.width = `${i / total * 100}%`;
        try {
          const elapsed = await GeminiAutomator.deleteConversation(chatId);
          this.selectedChats.delete(chatId);
          if (elapsed > 1e3) {
            adaptiveCooldown = Math.min(adaptiveCooldown + 25, 200);
          } else if (elapsed < 300) {
            adaptiveCooldown = Math.max(adaptiveCooldown - 15, 30);
          }
        } catch (err) {
          Logger.error("Coordinator", `Deletion failed for ${chatId}: ${err.message}`);
        }
        this.updateToolbarUI();
        await GeminiAutomator.wait(adaptiveCooldown);
      }
      if (progressBar) progressBar.style.width = "100%";
      await GeminiAutomator.wait(200);
      await GeminiAutomator.cleanupOverlaysAndScrollLocks();
      if (progressWrap) progressWrap.style.display = "none";
      if (progressBar) progressBar.style.width = "0%";
      this.isDeleting = false;
      if (selectAllCb) selectAllCb.checked = false;
      this.updateToolbarUI();
      this.refreshQuota();
    },
    // Synchronize status and controls
    updateToolbarUI() {
      const selectAllCb = document.getElementById("qol-toolbar-select-all-cb");
      const statusText = document.getElementById("qol-toolbar-status-text");
      const deleteBtn = document.getElementById("qol-toolbar-delete-btn");
      const loadAllBtn = document.getElementById("qol-toolbar-load-all-btn");
      const items = document.querySelectorAll(GeminiAutomator.SELECTORS.CHAT_ITEM);
      const totalVisible = items.length;
      if (selectAllCb) {
        if (totalVisible > 0 && this.selectedChats.size === totalVisible) {
          selectAllCb.checked = true;
          selectAllCb.indeterminate = false;
        } else if (this.selectedChats.size > 0 && this.selectedChats.size < totalVisible) {
          selectAllCb.checked = false;
          selectAllCb.indeterminate = true;
        } else {
          selectAllCb.checked = false;
          selectAllCb.indeterminate = false;
        }
        selectAllCb.disabled = this.isDeleting;
      }
      if (statusText) {
        if (this.selectedChats.size > 0) {
          statusText.textContent = `(\u0110\xE3 ch\u1ECDn ${this.selectedChats.size})`;
          statusText.style.display = "inline";
        } else {
          statusText.textContent = "";
          statusText.style.display = "none";
        }
      }
      if (deleteBtn) {
        deleteBtn.disabled = this.selectedChats.size === 0 || this.isDeleting;
      }
      if (loadAllBtn) {
        loadAllBtn.disabled = this.isDeleting;
      }
      const checkboxes = document.querySelectorAll('.gemini-qol-checkbox-container input[type="checkbox"]');
      checkboxes.forEach((cb) => {
        const parentContainer = cb.closest(".gemini-qol-checkbox-container");
        if (parentContainer) {
          const id = parentContainer.dataset.chatId;
          cb.checked = this.selectedChats.has(id);
          cb.disabled = this.isDeleting;
        }
      });
    },
    quotaData: null,
    refreshQuota() {
      if (window.self !== window.top) return;
      let iframe = document.getElementById("qol-quota-iframe");
      if (!iframe) {
        iframe = document.createElement("iframe");
        iframe.id = "qol-quota-iframe";
        iframe.style.display = "none";
        iframe.src = QuotaMonitor.getUsageUrl();
        document.body.appendChild(iframe);
      } else {
        try {
          iframe.contentWindow.location.reload();
        } catch (err) {
          iframe.src = QuotaMonitor.getUsageUrl();
        }
      }
    },
    initIframeQuotaListener() {
      const checkAndSend = () => {
        const currentlyDiv = document.querySelector('[data-test-id="gxu-currently"]');
        const weeklyDiv = document.querySelector('[data-test-id="gxu-weekly"]');
        if (currentlyDiv || weeklyDiv) {
          let dailyUsage = "0%";
          let dailyReset = "";
          if (currentlyDiv) {
            const pElements = currentlyDiv.querySelectorAll("*");
            pElements.forEach((p) => {
              const txt = p.textContent.trim();
              if (txt.includes("%")) {
                dailyUsage = txt.replace(/Đã sử dụng\s+/i, "").replace(/Used\s+/i, "");
              } else if (p.classList.contains("reset-time-luminous") || txt.toLowerCase().includes("\u0111\u1EB7t l\u1EA1i") || txt.toLowerCase().includes("reset")) {
                dailyReset = txt;
              }
            });
          }
          let weeklyUsage = "0%";
          let weeklyReset = "";
          if (weeklyDiv) {
            const pElements = weeklyDiv.querySelectorAll("*");
            pElements.forEach((p) => {
              const txt = p.textContent.trim();
              if (txt.includes("%")) {
                weeklyUsage = txt.replace(/Đã sử dụng\s+/i, "").replace(/Used\s+/i, "");
              } else if (p.classList.contains("reset-time-luminous") || txt.toLowerCase().includes("\u0111\u1EB7t l\u1EA1i") || txt.toLowerCase().includes("reset")) {
                weeklyReset = txt;
              }
            });
          }
          window.parent.postMessage({
            type: "GEMINI_QOL_QUOTA_UPDATE",
            data: { dailyUsage, dailyReset, weeklyUsage, weeklyReset }
          }, window.location.origin);
        }
      };
      checkAndSend();
      const observer = new MutationObserver(() => checkAndSend());
      observer.observe(document.body, { childList: true, subtree: true });
    },
    sidebarObserver: null,
    responseObserver: null,
    overlayObserver: null,
    shellObserver: null,
    setupObservers() {
      if (!this.shellObserver) {
        this.shellObserver = new MutationObserver((mutations) => {
          for (const m of mutations) {
            for (const node of m.addedNodes) {
              if (node.nodeType === Node.ELEMENT_NODE) {
                const tagName = (node.tagName || "").toLowerCase();
                if (tagName.includes("sidenav") || node.classList.contains("cdk-overlay-container")) {
                  this.scheduleScan();
                }
              }
            }
          }
        });
        try {
          this.shellObserver.observe(document.body, { childList: true, subtree: false });
        } catch (e) {
        }
      }
      const sidebarContainer = document.querySelector("mat-sidenav-container") || document.querySelector(GeminiAutomator.SELECTORS.SIDEBAR_LIST);
      if (sidebarContainer && !this.sidebarObserver) {
        this.sidebarObserver = new MutationObserver(() => this.scheduleScan());
        try {
          this.sidebarObserver.observe(sidebarContainer, { childList: true, subtree: true });
        } catch (e) {
        }
      }
      const responseContainer = document.querySelector('main, [role="main"]') || document.body;
      if (responseContainer && !this.responseObserver) {
        this.responseObserver = new MutationObserver(() => this.scheduleScan());
        try {
          this.responseObserver.observe(responseContainer, { childList: true, subtree: true });
        } catch (e) {
        }
      }
      const overlayContainer = document.querySelector(".cdk-overlay-container");
      if (overlayContainer && !this.overlayObserver) {
        this.overlayObserver = new MutationObserver((mutations) => {
          let shouldReopenImport = false;
          for (const m of mutations) {
            for (const node of m.removedNodes) {
              if (node.nodeType === Node.ELEMENT_NODE && node.querySelector?.("code-import-dialog")) {
                shouldReopenImport = true;
              }
            }
          }
          if (shouldReopenImport && this.isImportingMultiple && this.importQueue.length > 0 && !this.isReopeningDialog) {
            this.isReopeningDialog = true;
            this.scheduleReopenDialog();
          }
          this.scheduleScan();
        });
        try {
          this.overlayObserver.observe(overlayContainer, { childList: true, subtree: true });
        } catch (e) {
        }
      }
    },
    scanTimeout: null,
    scheduleScan() {
      if (this.scanTimeout) {
        clearTimeout(this.scanTimeout);
      }
      this.scanTimeout = setTimeout(() => {
        this.scanAndInject();
      }, 100);
    },
    // Scan and inject
    scanAndInject() {
      this.setupObservers();
      this.injectSidebarToolbar();
      const items = document.querySelectorAll(GeminiAutomator.SELECTORS.CHAT_ITEM);
      items.forEach((item) => this.injectCheckbox(item));
      const responses = document.querySelectorAll("model-response");
      responses.forEach((res) => this.injectMarkdownCopyButton(res));
      this.injectDeepResearchToolbarButton();
      this.injectDeepResearchExportMenuItem();
      if (this.quotaData) {
        QuotaMonitor.updateSidebarQuotaUI(this.quotaData);
      }
      this.scanAndInjectImportDialog();
    },
    // Parse multiple URLs from input text
    parseUrls(text) {
      if (!text) return [];
      const regex = /https?:\/\/github\.com\/[^\s,;]+/g;
      const matches = text.match(regex) || [];
      return [...new Set(matches.map((url) => url.replace(/[.,;]$/, "").trim()))];
    },
    // Scan and enhance the import dialog for bulk importing
    scanAndInjectImportDialog() {
      const dialog = document.querySelector("code-import-dialog");
      if (!dialog) return;
      const input = dialog.querySelector('[data-test-id="repo-url-input"]');
      if (!input || input.classList.contains("qol-monitored")) return;
      input.classList.add("qol-monitored");
      const container = dialog.querySelector(".repo-url-input-container");
      if (!container) return;
      let statusDiv = dialog.querySelector(".qol-import-status");
      if (!statusDiv) {
        statusDiv = document.createElement("div");
        statusDiv.className = "qol-import-status";
        statusDiv.style.cssText = 'font-size: 12px; margin-top: 10px; font-family: "Google Sans", sans-serif; min-height: 20px; line-height: 1.5; font-weight: 500;';
        container.appendChild(statusDiv);
      }
      const nativeSubmitBtn = dialog.querySelector('[data-test-id="import-repository-button"]');
      if (!nativeSubmitBtn) return;
      let customSubmitBtn = dialog.querySelector(".qol-custom-import-btn");
      if (!customSubmitBtn) {
        customSubmitBtn = document.createElement("button");
        customSubmitBtn.className = nativeSubmitBtn.className + " qol-custom-import-btn";
        customSubmitBtn.style.display = "none";
        customSubmitBtn.innerHTML = `<span class="mat-mdc-button-persistent-ripple mdc-button__ripple"></span><span class="mdc-button__label">Nh\u1EADp t\u1EA5t c\u1EA3</span><span class="mat-focus-indicator"></span>`;
        nativeSubmitBtn.parentNode.insertBefore(customSubmitBtn, nativeSubmitBtn.nextSibling);
        customSubmitBtn.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          const urls = this.parseUrls(input.value);
          if (urls.length > 1) {
            this.startMultipleImports(urls);
          }
        });
      }
      const checkValue = () => {
        if (this.isImportingMultiple) return;
        const urls = this.parseUrls(input.value);
        if (urls.length > 1) {
          nativeSubmitBtn.style.display = "none";
          customSubmitBtn.style.display = "inline-flex";
          statusDiv.textContent = `Ph\xE1t hi\u1EC7n ${urls.length} kho l\u01B0u tr\u1EEF. Extension s\u1EBD t\u1EF1 \u0111\u1ED9ng nh\u1EADp l\u1EA7n l\u01B0\u1EE3t.`;
          statusDiv.style.color = "#5b96ee";
        } else {
          nativeSubmitBtn.style.display = "inline-flex";
          customSubmitBtn.style.display = "none";
          statusDiv.textContent = "";
        }
      };
      input.addEventListener("input", checkValue);
      input.addEventListener("change", checkValue);
      checkValue();
      if (this.isImportingMultiple && this.importQueue.length > 0) {
        this.processNextImport(dialog, input, nativeSubmitBtn, statusDiv);
      }
    },
    // Start sequential bulk import
    startMultipleImports(urls) {
      this.importQueue = urls;
      this.importTotalCount = urls.length;
      this.isImportingMultiple = true;
      const dialog = document.querySelector("code-import-dialog");
      const input = dialog ? dialog.querySelector('[data-test-id="repo-url-input"]') : null;
      const nativeSubmitBtn = dialog ? dialog.querySelector('[data-test-id="import-repository-button"]') : null;
      const statusDiv = dialog ? dialog.querySelector(".qol-import-status") : null;
      if (dialog && input && nativeSubmitBtn && statusDiv) {
        this.processNextImport(dialog, input, nativeSubmitBtn, statusDiv);
      }
    },
    // Perform next import in queue
    async processNextImport(dialog, input, nativeSubmitBtn, statusDiv) {
      if (this.importQueue.length === 0) {
        this.isImportingMultiple = false;
        if (statusDiv) {
          statusDiv.textContent = "Ho\xE0n th\xE0nh nh\u1EADp t\u1EA5t c\u1EA3 kho l\u01B0u tr\u1EEF!";
          statusDiv.style.color = "#4caf50";
        }
        return;
      }
      const currentUrl = this.importQueue.shift();
      const currentIndex = this.importTotalCount - this.importQueue.length;
      const baseStatus = `\u0110ang nh\u1EADp (${currentIndex}/${this.importTotalCount}): ${this.getRepoNameFromUrl(currentUrl)}`;
      if (statusDiv) {
        statusDiv.textContent = `${baseStatus} (\u0110ang x\xE1c th\u1EF1c URL)...`;
        statusDiv.style.color = "#ff9800";
      }
      const customSubmitBtn = dialog.querySelector(".qol-custom-import-btn");
      if (customSubmitBtn) customSubmitBtn.style.display = "none";
      input.focus();
      input.value = currentUrl;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
      input.blur();
      await GeminiAutomator.waitForElement(() => {
        const currentDialog = document.querySelector("code-import-dialog");
        if (!currentDialog) return null;
        const btn = currentDialog.querySelector('[data-test-id="import-repository-button"]');
        return btn && !btn.disabled && !btn.hasAttribute("disabled") ? btn : null;
      }, 5e3, dialog);
      if (statusDiv) {
        statusDiv.textContent = `${baseStatus} (\u0110ang b\u1EA5m nh\u1EADp)...`;
      }
      for (let i = 0; i < 5; i++) {
        const activeDialog = document.querySelector("code-import-dialog");
        if (!activeDialog) break;
        const btn = activeDialog.querySelector('[data-test-id="import-repository-button"]');
        if (btn && !btn.disabled && !btn.hasAttribute("disabled")) {
          const clickEvent = new MouseEvent("click", {
            bubbles: true,
            cancelable: true,
            view: window
          });
          btn.dispatchEvent(clickEvent);
          try {
            btn.click();
          } catch (e) {
          }
          const form = activeDialog.querySelector("form");
          if (form) {
            form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
          }
        }
        await GeminiAutomator.wait(500);
      }
    },
    getRepoNameFromUrl(url) {
      if (!url || typeof url !== "string") return url || "";
      const parts = url.split("/");
      if (parts.length >= 5) {
        return `${parts.at(-2)}/${parts.at(-1)}`;
      }
      return url;
    },
    async scheduleReopenDialog() {
      await GeminiAutomator.waitForElementToDisappear("code-import-dialog, .cdk-overlay-backdrop", 2e3);
      if (!this.isImportingMultiple || this.importQueue.length === 0) {
        this.isReopeningDialog = false;
        return;
      }
      try {
        const toolsBtn = document.querySelector('gem-icon-button[arialabel*="t\u1EA3i l\xEAn" i], gem-icon-button[aria-label*="t\u1EA3i l\xEAn" i], gem-icon-button[arialabel*="c\xF4ng c\u1EE5" i], gem-icon-button[aria-label*="c\xF4ng c\u1EE5" i], gem-icon-button[arialabel*="Upload" i], gem-icon-button[aria-label*="Upload" i]');
        if (!toolsBtn) throw new Error("Tools button not found");
        toolsBtn.click();
        const findImportBtn = () => {
          let btn = document.querySelector('[data-test-id="import-hub-settings-button"], [routerlink="import"]');
          if (btn) return btn;
          const items = document.querySelectorAll('.mat-mdc-menu-item, [role="menuitem"]');
          for (const item of items) {
            const txt = item.textContent.toLowerCase();
            if (txt.includes("nh\u1EADp b\u1ED9 nh\u1EDB") || txt.includes("nh\u1EADp m\xE3") || txt.includes("import code") || txt.includes("import memory")) {
              return item;
            }
          }
          return null;
        };
        const findUploadSubmenuTrigger = () => {
          const triggers = document.querySelectorAll('.mat-mdc-menu-item-submenu-trigger, .mat-mdc-menu-trigger, [aria-haspopup="menu"]');
          for (const trigger of triggers) {
            const txt = trigger.textContent.toLowerCase();
            if (txt.includes("t\u1EA3i l\xEAn") || txt.includes("upload")) {
              return trigger;
            }
          }
          return null;
        };
        let importBtn = await GeminiAutomator.waitForElement(() => findImportBtn() || findUploadSubmenuTrigger(), 1e3, document.body);
        if (importBtn && !findImportBtn()) {
          const uploadTrigger = findUploadSubmenuTrigger();
          if (uploadTrigger) {
            uploadTrigger.click();
            importBtn = await GeminiAutomator.waitForElement(() => findImportBtn(), 1e3, document.body);
          }
        }
        if (!importBtn) {
          const triggers = document.querySelectorAll('.mat-mdc-menu-item-submenu-trigger, .mat-mdc-menu-trigger, [aria-haspopup="menu"], [data-test-id="more-tools-button"]');
          for (const trigger of triggers) {
            trigger.click();
            importBtn = await GeminiAutomator.waitForElement(() => findImportBtn(), 600, document.body);
            if (importBtn) {
              break;
            }
          }
        }
        if (!importBtn) throw new Error("Import button not found in menu after exploring submenus");
        importBtn.click();
      } catch (err) {
        console.error("Failed to reopen import dialog automatically:", err);
        this.isImportingMultiple = false;
        this.importQueue = [];
      } finally {
        this.isReopeningDialog = false;
      }
    },
    // Init Coordinator
    init() {
      const isIframe = window.self !== window.top;
      if (isIframe) {
        if (window.location.pathname.includes("/usage")) {
          this.initIframeQuotaListener();
        }
        return;
      }
      Logger.log("Coordinator", "Gemini QoL Content Extension initialized");
      this.scanAndInject();
      this.refreshQuota();
      window.addEventListener("message", (e) => {
        if (e.origin !== window.location.origin) return;
        if (e.data?.type === "GEMINI_QOL_QUOTA_UPDATE") {
          this.quotaData = e.data.data;
          QuotaMonitor.updateSidebarQuotaUI(this.quotaData);
        }
      });
      window.addEventListener("beforeunload", (e) => {
        if (this.isDeleting) {
          e.preventDefault();
        }
      });
      setInterval(() => this.refreshQuota(), 12e4);
      window.addEventListener("focus", () => this.refreshQuota());
      document.addEventListener("click", (e) => {
        const btn = e.target.closest('[data-test-id="send-button"], .send-button');
        if (btn) {
          setTimeout(() => this.refreshQuota(), 5e3);
        }
      });
      document.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          const textarea = e.target.closest("textarea, [contenteditable]");
          if (textarea) {
            setTimeout(() => this.refreshQuota(), 5e3);
          }
        }
      });
      window.addEventListener("popstate", () => this.scheduleScan());
      const originalPushState = history.pushState;
      history.pushState = function(...args) {
        originalPushState.apply(this, args);
        ContentCoordinator.scheduleScan();
      };
      const originalReplaceState = history.replaceState;
      history.replaceState = function(...args) {
        originalReplaceState.apply(this, args);
        ContentCoordinator.scheduleScan();
      };
      this.setupObservers();
    }
  };
  if (typeof document !== "undefined") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => ContentCoordinator.init());
    } else {
      ContentCoordinator.init();
    }
  }
})();
