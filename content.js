/**
 * ============================================================================
 * 0. I18N TRANSLATION HELPER (Vietnamese & English Localization)
 * ============================================================================
 */
const i18n = {
  lang: (document.documentElement.lang || 'en').toLowerCase().startsWith('vi') ? 'vi' : 'en',
  
  t(key) {
    const translations = {
      vi: {
        selectAll: 'Chọn tất cả',
        loadAll: 'Tải hết',
        loading: 'Đang tải',
        loadedAll: 'Đã tải hết',
        deleteSelected: 'Xóa các mục đã chọn',
        confirmDelete: 'Bạn có chắc chắn muốn xóa {count} cuộc trò chuyện đã chọn?',
        copyMd: 'Sao chép dưới dạng Markdown',
        copyTooltip: 'Sao chép Markdown (.md)',
        copied: 'Đã chép!',
        daily: 'Daily:',
        weekly: 'Weekly:'
      },
      en: {
        selectAll: 'Select all',
        loadAll: 'Load all',
        loading: 'Loading',
        loadedAll: 'Loaded all',
        deleteSelected: 'Delete selected items',
        confirmDelete: 'Are you sure you want to delete {count} selected conversations?',
        copyMd: 'Copy as Markdown',
        copyTooltip: 'Copy Markdown (.md)',
        copied: 'Copied!',
        daily: 'Daily:',
        weekly: 'Weekly:'
      }
    };
    return (translations[this.lang] && translations[this.lang][key]) || translations['en'][key] || key;
  }
};


/**
 * ============================================================================
 * 1. MARKDOWN CONVERTER MODULE (Deep, Stateless Element-to-Markdown Translator)
 * ============================================================================
 */
class MarkdownConverter {
  /**
   * Translates a DOM node and its children recursively into clean Markdown text.
   * @param {Node} node - The DOM node to parse
   * @returns {string} The parsed Markdown content
   */
  static fromHtml(node) {
    if (!node) return '';
    
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent;
    }
    
    if (node.nodeType !== Node.ELEMENT_NODE) {
      return '';
    }
    
    const tagName = node.tagName.toLowerCase();
    
    // Skip interactive UI, action bars, or scripts/styles
    if (
      node.classList.contains('qol-copy-markdown-btn') || 
      node.classList.contains('actions-container') ||
      tagName === 'button' || 
      tagName === 'style' || 
      tagName === 'script'
    ) {
      return '';
    }
    
    const childrenMarkdown = Array.from(node.childNodes)
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
      case 'strong':
      case 'b':
        return `**${childrenMarkdown}**`;
      case 'em':
      case 'i':
        return `*${childrenMarkdown}*`;
      case 'code':
        if (node.closest('pre')) {
          return childrenMarkdown; // Pre handles formatting
        }
        return `\`${childrenMarkdown}\``;
      case 'pre':
        const codeEl = node.querySelector('code');
        const langClass = codeEl ? Array.from(codeEl.classList).find(c => c.startsWith('language-')) : '';
        const lang = langClass ? langClass.replace('language-', '') : '';
        return `\n\n\`\`\`${lang}\n${node.textContent.trim()}\n\`\`\`\n\n`;
      case 'ul':
        return `\n${childrenMarkdown}\n`;
      case 'ol':
        return `\n${childrenMarkdown}\n`;
      case 'li':
        const parent = node.parentElement;
        if (parent && parent.tagName.toLowerCase() === 'ol') {
          const index = Array.from(parent.children).indexOf(node) + 1;
          return `${index}. ${childrenMarkdown.trim()}\n`;
        }
        return `* ${childrenMarkdown.trim()}\n`;
      case 'a':
        const href = node.getAttribute('href');
        return `[${childrenMarkdown}](${href || ''})`;
      case 'br':
        return '\n';
      case 'div':
      case 'span':
      default:
        return childrenMarkdown;
    }
  }

  /**
   * Sanitizes double or redundant carriage returns from generated Markdown
   * @param {string} md - The raw Markdown
   * @returns {string} The cleaned Markdown
   */
  static cleanMarkdown(md) {
    return md
      .replace(/\n{3,}/g, '\n\n') // Max out at 2 consecutive newlines
      .trim();
  }
}


/**
 * ============================================================================
 * 2. GEMINI AUTOMATION MODULE (Encapsulates all DOM selectors & UI interactions)
 * ============================================================================
 */
class GeminiAutomator {
  // DOM Selectors mapped in one place for maintainability
  static SELECTORS = {
    SIDEBAR_LIST: 'conversations-list[data-test-id="all-conversations"], [data-test-id="all-conversations"], .conversations-list',
    CHAT_ITEM: 'gem-nav-list-item[data-test-id="conversation"], [data-test-id="conversation"], gem-nav-list-item',
    CHAT_LINK: 'a[href*="/app/"]',
    ACTIONS_BTN: '[data-test-id="actions-menu-button"], button[aria-haspopup="menu"]',
    CONFIRM_BTN: '[data-test-id="confirm-button"] button, [data-test-id="confirm-button"], button[data-test-id="confirm-button"]',
    CANCEL_BTN: '[data-test-id="cancel-button"] button, [data-test-id="cancel-button"], button[data-test-id="cancel-button"]',
    MENU_ITEMS: '.mat-mdc-menu-item, button[role="menuitem"]',
    NATIVE_COPY_ICON: 'mat-icon[fonticon="copy"], mat-icon[data-mat-icon-name="copy"], mat-icon[fonticon="content_copy"], mat-icon[data-mat-icon-name="content_copy"]',
    TOOLBAR_CONTAINER: '.actions-container, [role="toolbar"], .response-actions-container, .message-actions, .response-actions'
  };

  /**
   * Finds the native copy button inside a response element with multiple fallbacks.
   * @param {HTMLElement} responseEl 
   * @returns {HTMLElement|null}
   */
  static findNativeCopyButton(responseEl) {
    // 1. Try finding by icon first
    const copyIcon = responseEl.querySelector(this.SELECTORS.NATIVE_COPY_ICON);
    if (copyIcon) {
      const btn = copyIcon.closest('button');
      if (btn) return btn;
    }
    // 2. Fallback: check all buttons for aria-label or title (English & Vietnamese)
    const buttons = responseEl.querySelectorAll('button');
    for (const btn of buttons) {
      const label = (btn.getAttribute('aria-label') || btn.getAttribute('title') || '').toLowerCase();
      if (label.includes('copy') || label.includes('chép') || label.includes('sao')) {
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
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Find a sidebar conversation list item node by its unique Chat ID.
   * @param {string} chatId - The conversation ID
   * @returns {HTMLElement|null} The matching element
   */
  static findSidebarItem(chatId) {
    const items = document.querySelectorAll(this.SELECTORS.CHAT_ITEM);
    for (const item of items) {
      const a = item.querySelector(this.SELECTORS.CHAT_LINK);
      if (a) {
        const href = a.getAttribute('href');
        if (href && href.includes(chatId)) {
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
    const list = document.querySelector(this.SELECTORS.SIDEBAR_LIST);
    if (!list) return null;
    
    let parent = list.parentElement;
    while (parent && parent !== document.body) {
      const style = window.getComputedStyle(parent);
      if (style.overflowY === 'auto' || style.overflowY === 'scroll' || parent.classList.contains('content-wrapper')) {
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
    const list = document.querySelector(this.SELECTORS.SIDEBAR_LIST);
    if (!list) return;

    // 1. Try scrolling last conversation element into view (Intersection Observer trigger)
    const items = list.querySelectorAll(this.SELECTORS.CHAT_ITEM);
    if (items.length > 0) {
      try {
        items[items.length - 1].scrollIntoView({ block: 'end' });
      } catch (err) {
        console.warn('ScrollIntoView fallback failed:', err);
      }
    }

    // 2. Scroll the container viewport and dispatch scroll event
    const container = this.getScrollContainer();
    if (container) {
      container.scrollTop = container.scrollHeight;
      container.dispatchEvent(new Event('scroll'));
    }
  }

  /**
   * Scrolls all scrollable parents of the conversation list to the very top.
   */
  static scrollSidebarToTop() {
    const list = document.querySelector(this.SELECTORS.SIDEBAR_LIST);
    if (!list) return;

    let parent = list.parentElement;
    while (parent && parent !== document.body) {
      if (parent.scrollTop > 0 || parent.scrollHeight > parent.clientHeight) {
        parent.scrollTop = 0;
        parent.dispatchEvent(new Event('scroll'));
      }
      parent = parent.parentElement;
    }
  }

  /**
   * Loops scrolling down the sidebar to load all available conversations.
   * @param {Function} onScrollStepCallback - Invoked on each scroll cycle
   */
  static async loadAllChats(onScrollStepCallback) {
    let lastCount = 0;
    let noChangeAttempts = 0;
    
    while (noChangeAttempts < 5) {
      const currentItems = document.querySelectorAll(this.SELECTORS.CHAT_ITEM);
      const currentCount = currentItems.length;
      
      if (currentCount === lastCount) {
        noChangeAttempts++;
      } else {
        noChangeAttempts = 0;
        lastCount = currentCount;
      }
      
      this.scrollSidebarToBottom();
      if (onScrollStepCallback) onScrollStepCallback(currentCount);
      
      await this.wait(800);
    }
  }

  /**
   * Query the DOM for the dynamic Delete option button.
   * @returns {HTMLElement|null} The delete menu item element
   */
  static findDeleteMenuButton() {
    const menuButtons = document.querySelectorAll(this.SELECTORS.MENU_ITEMS);
    for (const btn of menuButtons) {
      // Check for localized delete icon inside the button
      const hasDeleteIcon = btn.querySelector('mat-icon[fonticon="delete"], mat-icon[data-mat-icon-name="delete"]');
      if (hasDeleteIcon) {
        return btn;
      }
      // Text fallback
      const text = btn.textContent.toLowerCase();
      if (text.includes('xóa') || text.includes('xoá') || text.includes('delete')) {
        return btn;
      }
    }
    return null;
  }

  /**
   * Wait for a selector to appear in DOM using MutationObserver
   */
  static waitForElement(selector, maxWait = 1500) {
    return new Promise((resolve, reject) => {
      const el = document.querySelector(selector);
      if (el) return resolve(el);

      const observer = new MutationObserver(() => {
        const target = document.querySelector(selector);
        if (target) {
          observer.disconnect();
          resolve(target);
        }
      });

      observer.observe(document.body, { childList: true, subtree: true });

      setTimeout(() => {
        observer.disconnect();
        const target = document.querySelector(selector);
        if (target) resolve(target);
        else reject(new Error(`Timeout waiting for ${selector}`));
      }, maxWait);
    });
  }

  /**
   * Wait for the Delete menu item to render.
   */
  static waitForDeleteMenuButton(maxWait = 1500) {
    return new Promise((resolve, reject) => {
      const btn = this.findDeleteMenuButton();
      if (btn) return resolve(btn);

      const observer = new MutationObserver(() => {
        const target = this.findDeleteMenuButton();
        if (target) {
          observer.disconnect();
          resolve(target);
        }
      });

      observer.observe(document.body, { childList: true, subtree: true });

      setTimeout(() => {
        observer.disconnect();
        const target = this.findDeleteMenuButton();
        if (target) resolve(target);
        else reject(new Error('Timeout waiting for Delete menu option'));
      }, maxWait);
    });
  }

  /**
   * Wait for an element to be unrendered/removed.
   */
  static waitForItemRemoval(chatId, maxWait = 3000) {
    return new Promise((resolve) => {
      if (!this.findSidebarItem(chatId)) return resolve();

      const observer = new MutationObserver(() => {
        if (!this.findSidebarItem(chatId)) {
          observer.disconnect();
          resolve();
        }
      });

      observer.observe(document.body, { childList: true, subtree: true });

      setTimeout(() => {
        observer.disconnect();
        resolve(); // resolve to prevent hanging
      }, maxWait);
    });
  }

  /**
   * Monitor browser network timing entries to wait until a specific API request completes.
   * @param {string} urlKeyword - Keyword to match in request URL
   * @param {number} startTime - Relative performance timestamp to match
   * @returns {Promise<void>} Resolves when the network request completes
   */
  static waitForNetworkRequest(urlKeyword, startTime) {
    return new Promise((resolve) => {
      const checkTimeline = () => {
        const entries = performance.getEntriesByType('resource');
        for (const entry of entries) {
          if (entry.name.includes(urlKeyword) && entry.startTime >= startTime) {
            return true;
          }
        }
        return false;
      };

      if (checkTimeline()) {
        return resolve();
      }

      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        for (const entry of entries) {
          if (entry.name.includes(urlKeyword) && entry.startTime >= startTime) {
            observer.disconnect();
            resolve();
            return;
          }
        }
      });

      try {
        observer.observe({ entryTypes: ['resource'] });
      } catch (err) {
        console.warn('PerformanceObserver failed:', err);
        return resolve(); // fallback
      }

      // Safe fallback timeout of 2.5 seconds
      setTimeout(() => {
        observer.disconnect();
        resolve();
      }, 2500);
    });
  }

  /**
   * Automation pipeline to delete a conversation.
   * @param {string} chatId - ID of the conversation
   * @returns {Promise<number>} Elapsed time in ms
   */
  static async deleteConversation(chatId) {
    const item = this.findSidebarItem(chatId);
    if (!item) throw new Error(`Item not found for ID: ${chatId}`);

    const startTime = Date.now();
    const perfClickTime = performance.now(); // Record click time for network monitoring

    // 1. Open conversation Actions Menu
    const actionsBtn = item.querySelector(this.SELECTORS.ACTIONS_BTN);
    if (!actionsBtn) throw new Error('Actions menu button not found');
    actionsBtn.click();

    // 2. Click Delete button in menu (waits for render dynamically)
    const deleteBtn = await this.waitForDeleteMenuButton(1000);
    deleteBtn.click();

    // 3. Confirm in popup dialog (waits for render dynamically)
    const confirmBtn = await this.waitForElement(this.SELECTORS.CONFIRM_BTN, 1000);
    confirmBtn.click();

    // 4. Wait for element to disappear from list (Optimistic UI removal)
    await this.waitForItemRemoval(chatId, 3000);

    // 5. DYNAMIC SYNC: Wait directly for the XHR POST request to batchexecute to finish.
    // This removes the need for hardcoded timeouts, adapting exactly to the user's connection.
    await this.waitForNetworkRequest('batchexecute', perfClickTime);

    return Date.now() - startTime;
  }

  /**
   * Triggers a cancel event on open dialogs as a recovery step.
   */
  static dismissDialog() {
    const cancelBtn = document.querySelector(this.SELECTORS.CANCEL_BTN);
    if (cancelBtn) cancelBtn.click();
  }
}


/**
 * ============================================================================
 * 2.5 QUOTA MONITOR MODULE (Fetches and renders real-time daily/weekly quota limits)
 * ============================================================================
 */
class QuotaMonitor {
  static getUsageUrl() {
    const match = window.location.pathname.match(/^\/u\/(\d+)/);
    const userPath = match ? `/u/${match[1]}` : '';
    return `${window.location.origin}${userPath}/usage`;
  }



  static updateSidebarQuotaUI(quotaData) {
    if (!quotaData) return;
    console.log('Gemini QoL - Updating UI with:', quotaData);
    
    const profileLink = document.querySelector('.mavatar-footer-left');
    if (!profileLink) return;

    const userInfo = profileLink.querySelector('.mavatar-user-info');
    
    // Clean up any old/stale quota inside userInfo (from previous versions)
    if (userInfo) {
      const staleExpanded = userInfo.querySelector('.qol-quota-expanded');
      if (staleExpanded) {
        staleExpanded.remove();
      }
    }

    const isCollapsed = userInfo ? (userInfo.offsetWidth === 0) : true;
    
    // 1. Expanded view rendering
    if (profileLink && !isCollapsed) {
      let expanded = profileLink.querySelector('.qol-quota-expanded');
      if (!expanded) {
        expanded = document.createElement('div');
        expanded.className = 'qol-quota-expanded';
        profileLink.appendChild(expanded);
      }
      
      const dailyVal = parseInt(quotaData.dailyUsage) || 0;
      const weeklyVal = parseInt(quotaData.weeklyUsage) || 0;
      const dailyClass = dailyVal > 80 ? 'danger' : (dailyVal > 50 ? 'warning' : 'success');
      const weeklyClass = weeklyVal > 80 ? 'danger' : (weeklyVal > 50 ? 'warning' : 'success');

      const cleanDailyReset = quotaData.dailyReset 
        ? quotaData.dailyReset
            .replace(/Đặt lại\s+lúc\s+/i, '')
            .replace(/Đặt lại\s+/i, '')
            .replace(/Resets?\s+at\s+/i, '')
            .replace(/Resets?\s+/i, '')
        : '';
      const cleanWeeklyReset = quotaData.weeklyReset 
        ? quotaData.weeklyReset
            .replace(/Đặt lại\s+vào\s+/i, '')
            .replace(/Đặt lại\s+lúc\s+/i, '')
            .replace(/Đặt lại\s+/i, '')
            .replace(/Resets?\s+on\s+/i, '')
            .replace(/Resets?\s+at\s+/i, '')
            .replace(/Resets?\s+/i, '')
        : '';

      expanded.innerHTML = `
        <div class="qol-quota-row">
          <span class="qol-quota-metric">
            <span class="qol-quota-label">${i18n.t('daily')}</span>
            <span class="qol-quota-val ${dailyClass}">${quotaData.dailyUsage}</span>
          </span>
          <span class="qol-quota-reset" title="${quotaData.dailyReset || ''}">${cleanDailyReset}</span>
        </div>
        <div class="qol-quota-row">
          <span class="qol-quota-metric">
            <span class="qol-quota-label">${i18n.t('weekly')}</span>
            <span class="qol-quota-val ${weeklyClass}">${quotaData.weeklyUsage}</span>
          </span>
          <span class="qol-quota-reset" title="${quotaData.weeklyReset || ''}">${cleanWeeklyReset}</span>
        </div>
      `;
      expanded.style.display = 'flex';
    } else {
      const expanded = profileLink.querySelector('.qol-quota-expanded');
      if (expanded) expanded.style.display = 'none';
    }

    // 2. Collapsed view rendering (Avatar badge)
    const imgContainer = profileLink.querySelector('.mavatar-container');
    if (imgContainer) {
      let collapsed = imgContainer.querySelector('.qol-quota-collapsed');
      if (!collapsed) {
        collapsed = document.createElement('div');
        collapsed.className = 'qol-quota-collapsed';
        imgContainer.appendChild(collapsed);
      }
      collapsed.textContent = quotaData.dailyUsage;
      collapsed.title = `Daily: ${quotaData.dailyUsage} (${quotaData.dailyReset})\nWeekly: ${quotaData.weeklyUsage} (${quotaData.weeklyReset})`;
      
      if (isCollapsed) {
        collapsed.classList.add('visible');
      } else {
        collapsed.classList.remove('visible');
      }
    }
  }
}


/**
 * ============================================================================
 * 3. CONTENT COORDINATOR (Thin controller gluing UI components and modules)
 * ============================================================================
 */
const ContentCoordinator = {
  // State
  selectedChats: new Map(),
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

    const existingToolbar = document.querySelector('.gemini-qol-sidebar-toolbar');
    
    // If toolbar exists, check if it is right before the current list (e.g. list recreated)
    if (existingToolbar) {
      if (existingToolbar.nextElementSibling === list) {
        return; // Already in correct position
      }
      existingToolbar.remove(); // Misplaced, remove it to re-inject properly
    }

    const toolbar = document.createElement('div');
    toolbar.className = 'gemini-qol-sidebar-toolbar';
    toolbar.innerHTML = `
      <div class="qol-toolbar-left">
        <label class="qol-toolbar-select-all-container">
          <input type="checkbox" id="qol-toolbar-select-all-cb">
          <span class="qol-toolbar-custom-cb"></span>
          <span class="qol-toolbar-label">${i18n.t('selectAll')}</span>
        </label>
        <button class="qol-toolbar-link-btn" id="qol-toolbar-load-all-btn" title="${i18n.t('loadAll')}">${i18n.t('loadAll')}</button>
        <span class="qol-toolbar-status" id="qol-toolbar-status-text"></span>
      </div>
      <div class="qol-toolbar-right">
        <button class="qol-toolbar-btn-delete" id="qol-toolbar-delete-btn" disabled title="${i18n.t('deleteSelected')}" aria-label="${i18n.t('deleteSelected')}">
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

    // Setup listeners
    toolbar.querySelector('#qol-toolbar-select-all-cb').addEventListener('change', (e) => this.handleToggleAll(e));
    toolbar.querySelector('#qol-toolbar-delete-btn').addEventListener('click', () => this.handleBulkDelete());
    toolbar.querySelector('#qol-toolbar-load-all-btn').addEventListener('click', () => this.handleLoadAll());

    this.updateToolbarUI();
  },

  // Inject checkbox into conversation item
  injectCheckbox(item) {
    if (item.classList.contains('qol-has-checkbox')) return;

    const a = item.querySelector(GeminiAutomator.SELECTORS.CHAT_LINK);
    if (!a) return;

    const href = a.getAttribute('href');
    const match = href.match(/\/app\/([a-z0-9]+)/i);
    if (!match) return;

    const chatId = match[1];

    const container = document.createElement('label');
    container.className = 'gemini-qol-checkbox-container';
    container.setAttribute('data-chat-id', chatId);
    container.addEventListener('click', (e) => e.stopPropagation());

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = this.selectedChats.has(chatId);
    
    checkbox.addEventListener('change', (e) => {
      const titleSpan = item.querySelector('.title-text');
      const title = titleSpan ? titleSpan.textContent.trim() : 'Cuộc trò chuyện không tên';
      
      if (e.target.checked) {
        this.selectedChats.set(chatId, title);
      } else {
        this.selectedChats.delete(chatId);
      }
      this.updateToolbarUI();
    });

    const customCheckbox = document.createElement('span');
    customCheckbox.className = 'gemini-qol-custom-checkbox';

    container.appendChild(checkbox);
    container.appendChild(customCheckbox);
    
    item.insertBefore(container, item.firstChild);
    item.classList.add('qol-has-checkbox');
  },

  // Inject "Copy as Markdown" next to the native copy button wrapper inside the main actions container
  injectMarkdownCopyButton(responseEl) {
    if (responseEl.querySelector('.qol-copy-markdown-btn')) return;

    // Locate the native copy button using the robust helper
    const nativeCopyBtn = GeminiAutomator.findNativeCopyButton(responseEl);
    if (!nativeCopyBtn) return; 

    // Find the main buttons flexbox container
    const mainToolbar = nativeCopyBtn.closest(GeminiAutomator.SELECTORS.TOOLBAR_CONTAINER) || nativeCopyBtn.parentElement.parentElement;
    if (!mainToolbar) return;

    // Create our button
    const btn = document.createElement('button');
    btn.className = nativeCopyBtn.className + ' qol-copy-markdown-btn';
    btn.title = i18n.t('copyMd');
    btn.setAttribute('type', 'button');
    btn.innerHTML = `
      <span class="mat-mdc-button-persistent-ripple mdc-icon-button__ripple"></span>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;">
        <path d="M7 16V8l3 4 3-4v8"/>
        <path d="M16 8h2a2.5 2.5 0 0 1 2.5 2.5v3a2.5 2.5 0 0 1-2.5 2.5h-2V8z"/>
      </svg>
      <span class="qol-tooltip">${i18n.t('copyTooltip')}</span>
      <span class="mat-focus-indicator"></span>
    `;

    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      e.preventDefault();

      const contentEl = responseEl.querySelector('message-content') || 
                        responseEl.querySelector('.message-content') || 
                        responseEl;

      const rawMd = MarkdownConverter.fromHtml(contentEl);
      const cleanMd = MarkdownConverter.cleanMarkdown(rawMd);

      try {
        await navigator.clipboard.writeText(cleanMd);

        // Feedback: swap icon and tooltip
        const originalSvg = btn.innerHTML;
        btn.innerHTML = `
          <span class="mat-mdc-button-persistent-ripple mdc-icon-button__ripple"></span>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4caf50" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
          <span class="qol-tooltip">${i18n.t('copied')}</span>
          <span class="mat-focus-indicator"></span>
        `;
        btn.classList.add('copied');

        setTimeout(() => {
          btn.innerHTML = originalSvg;
          btn.classList.remove('copied');
        }, 2000);
      } catch (err) {
        console.error('Failed to copy Markdown content:', err);
      }
    });

    // Locate the direct child wrapper/element inside the mainToolbar container
    let currentChild = nativeCopyBtn;
    while (currentChild.parentElement && currentChild.parentElement !== mainToolbar) {
      currentChild = currentChild.parentElement;
    }

    // Insert directly adjacent to the wrapper inside the main flexbox toolbar
    mainToolbar.insertBefore(btn, currentChild.nextSibling);
  },

  // Toggle selection on all visible checkboxes
  handleToggleAll(e) {
    const checked = e.target.checked;
    const items = document.querySelectorAll(GeminiAutomator.SELECTORS.CHAT_ITEM);
    
    items.forEach(item => {
      const cb = item.querySelector('.gemini-qol-checkbox-container input[type="checkbox"]');
      if (cb && cb.checked !== checked) {
        cb.checked = checked;
        cb.dispatchEvent(new Event('change'));
      }
    });
  },

  // Load all conversation history by scrolling
  async handleLoadAll() {
    const loadBtn = document.getElementById('qol-toolbar-load-all-btn');
    if (!loadBtn) return;

    loadBtn.disabled = true;
    loadBtn.textContent = `${i18n.t('loading')}...`;

    await GeminiAutomator.loadAllChats((count) => {
      loadBtn.textContent = `${i18n.t('loading')} (${count})...`;
    });

    loadBtn.textContent = i18n.t('loadedAll');

    // Auto scroll all viewport containers back to the very top
    GeminiAutomator.scrollSidebarToTop();

    await GeminiAutomator.wait(1500);
    loadBtn.style.display = 'none';
  },

  // Execute bulk deletion sequence with dynamic cooldowns
  async handleBulkDelete() {
    if (this.selectedChats.size === 0 || this.isDeleting) return;

    const confirmAction = confirm(i18n.t('confirmDelete').replace('{count}', this.selectedChats.size));
    if (!confirmAction) return;

    this.isDeleting = true;
    this.updateToolbarUI();

    const progressWrap = document.getElementById('qol-toolbar-progress-wrap');
    const progressBar = document.getElementById('qol-toolbar-progress-bar');
    const selectAllCb = document.getElementById('qol-toolbar-select-all-cb');

    if (progressWrap) progressWrap.style.display = 'block';

    const chatIds = Array.from(this.selectedChats.keys());
    const total = chatIds.length;
    let adaptiveCooldown = 100;

    for (let i = 0; i < total; i++) {
      const chatId = chatIds[i];
      if (progressBar) progressBar.style.width = `${(i / total) * 100}%`;

      try {
        const elapsed = await GeminiAutomator.deleteConversation(chatId);
        this.selectedChats.delete(chatId);

        // Adjust cooldown dynamically to avoid rate limit or DOM bottlenecks
        if (elapsed > 1200) {
          adaptiveCooldown = Math.min(adaptiveCooldown + 150, 800);
        } else if (elapsed < 500) {
          adaptiveCooldown = Math.max(adaptiveCooldown - 50, 100);
        }
      } catch (err) {
        console.error(`Deletion failed for ${chatId}:`, err);
        GeminiAutomator.dismissDialog();
        await GeminiAutomator.wait(300);
      }

      this.updateToolbarUI();
      await GeminiAutomator.wait(adaptiveCooldown);
    }

    if (progressBar) progressBar.style.width = '100%';
    await GeminiAutomator.wait(500);

    if (progressWrap) progressWrap.style.display = 'none';
    if (progressBar) progressBar.style.width = '0%';

    this.isDeleting = false;
    if (selectAllCb) selectAllCb.checked = false;
    this.selectedChats.clear();
    this.updateToolbarUI();
    this.refreshQuota();
  },

  // Synchronize status and controls
  updateToolbarUI() {
    const selectAllCb = document.getElementById('qol-toolbar-select-all-cb');
    const statusText = document.getElementById('qol-toolbar-status-text');
    const deleteBtn = document.getElementById('qol-toolbar-delete-btn');
    const loadAllBtn = document.getElementById('qol-toolbar-load-all-btn');

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
        statusText.textContent = `(Đã chọn ${this.selectedChats.size})`;
        statusText.style.display = 'inline';
      } else {
        statusText.textContent = '';
        statusText.style.display = 'none';
      }
    }

    if (deleteBtn) {
      deleteBtn.disabled = this.selectedChats.size === 0 || this.isDeleting;
    }
    
    if (loadAllBtn) {
      loadAllBtn.disabled = this.isDeleting;
    }

    const checkboxes = document.querySelectorAll('.gemini-qol-checkbox-container input[type="checkbox"]');
    checkboxes.forEach(cb => {
      const parentContainer = cb.closest('.gemini-qol-checkbox-container');
      if (parentContainer) {
        const id = parentContainer.getAttribute('data-chat-id');
        cb.checked = this.selectedChats.has(id);
        cb.disabled = this.isDeleting;
      }
    });
  },

  quotaData: null,

  refreshQuota() {
    if (window.self !== window.top) return; // Only run in main window

    let iframe = document.getElementById('qol-quota-iframe');
    if (!iframe) {
      iframe = document.createElement('iframe');
      iframe.id = 'qol-quota-iframe';
      iframe.style.display = 'none';
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
        let dailyUsage = '0%';
        let dailyReset = '';
        if (currentlyDiv) {
          const pElements = currentlyDiv.querySelectorAll('*');
          pElements.forEach(p => {
            const txt = p.textContent.trim();
            if (txt.includes('%')) {
              dailyUsage = txt.replace(/Đã sử dụng\s+/i, '').replace(/Used\s+/i, '');
            } else if (p.classList.contains('reset-time-luminous') || txt.toLowerCase().includes('đặt lại') || txt.toLowerCase().includes('reset')) {
              dailyReset = txt;
            }
          });
        }
        
        let weeklyUsage = '0%';
        let weeklyReset = '';
        if (weeklyDiv) {
          const pElements = weeklyDiv.querySelectorAll('*');
          pElements.forEach(p => {
            const txt = p.textContent.trim();
            if (txt.includes('%')) {
              weeklyUsage = txt.replace(/Đã sử dụng\s+/i, '').replace(/Used\s+/i, '');
            } else if (p.classList.contains('reset-time-luminous') || txt.toLowerCase().includes('đặt lại') || txt.toLowerCase().includes('reset')) {
              weeklyReset = txt;
            }
          });
        }
        
        window.parent.postMessage({
          type: 'GEMINI_QOL_QUOTA_UPDATE',
          data: { dailyUsage, dailyReset, weeklyUsage, weeklyReset }
        }, window.location.origin);
      }
    };

    // Run once immediately
    checkAndSend();

    // Watch for dynamic Angular rendering
    const observer = new MutationObserver(() => checkAndSend());
    observer.observe(document.body, { childList: true, subtree: true });
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
    this.injectSidebarToolbar();
    
    const items = document.querySelectorAll(GeminiAutomator.SELECTORS.CHAT_ITEM);
    items.forEach(item => this.injectCheckbox(item));

    const responses = document.querySelectorAll('model-response');
    responses.forEach(res => this.injectMarkdownCopyButton(res));

    if (this.quotaData) {
      QuotaMonitor.updateSidebarQuotaUI(this.quotaData);
    }

    this.scanAndInjectImportDialog();
  },

  // Parse multiple URLs from input text
  parseUrls(text) {
    if (!text) return [];
    // Match any URL containing github.com
    const regex = /https?:\/\/github\.com\/[^\s,;]+/g;
    const matches = text.match(regex) || [];
    // Deduplicate and clean URLs
    return [...new Set(matches.map(url => url.replace(/[.,;]$/, '').trim()))];
  },

  // Scan and enhance the import dialog for bulk importing
  scanAndInjectImportDialog() {
    const dialog = document.querySelector('code-import-dialog');
    if (!dialog) return;

    const input = dialog.querySelector('[data-test-id="repo-url-input"]');
    if (!input || input.classList.contains('qol-monitored')) return;

    input.classList.add('qol-monitored');
    
    // Status/progress message container
    const container = dialog.querySelector('.repo-url-input-container');
    if (!container) return;

    let statusDiv = dialog.querySelector('.qol-import-status');
    if (!statusDiv) {
      statusDiv = document.createElement('div');
      statusDiv.className = 'qol-import-status';
      statusDiv.style.cssText = 'font-size: 12px; margin-top: 10px; font-family: "Google Sans", sans-serif; min-height: 20px; line-height: 1.5; font-weight: 500;';
      container.appendChild(statusDiv);
    }

    // Custom submit button for multiple repos
    const nativeSubmitBtn = dialog.querySelector('[data-test-id="import-repository-button"]');
    if (!nativeSubmitBtn) return;

    let customSubmitBtn = dialog.querySelector('.qol-custom-import-btn');
    if (!customSubmitBtn) {
      customSubmitBtn = document.createElement('button');
      customSubmitBtn.className = nativeSubmitBtn.className + ' qol-custom-import-btn';
      customSubmitBtn.style.display = 'none';
      customSubmitBtn.innerHTML = `<span class="mat-mdc-button-persistent-ripple mdc-button__ripple"></span><span class="mdc-button__label">Nhập tất cả</span><span class="mat-focus-indicator"></span>`;
      nativeSubmitBtn.parentNode.insertBefore(customSubmitBtn, nativeSubmitBtn.nextSibling);

      customSubmitBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        const urls = this.parseUrls(input.value);
        if (urls.length > 1) {
          this.startMultipleImports(urls);
        }
      });
    }

    // Monitor input value changes
    const checkValue = () => {
      // If we are currently importing multiple, don't show the custom submit button/status
      if (this.isImportingMultiple) return;

      const urls = this.parseUrls(input.value);
      if (urls.length > 1) {
        nativeSubmitBtn.style.display = 'none';
        customSubmitBtn.style.display = 'inline-flex';
        statusDiv.textContent = `Phát hiện ${urls.length} kho lưu trữ. Extension sẽ tự động nhập lần lượt.`;
        statusDiv.style.color = '#5b96ee';
      } else {
        nativeSubmitBtn.style.display = 'inline-flex';
        customSubmitBtn.style.display = 'none';
        statusDiv.textContent = '';
      }
    };

    input.addEventListener('input', checkValue);
    input.addEventListener('change', checkValue);

    // Initial check (in case user opened it with content already filled)
    checkValue();

    // If we are currently active in multiple imports process:
    if (this.isImportingMultiple && this.importQueue.length > 0) {
      this.processNextImport(dialog, input, nativeSubmitBtn, statusDiv);
    }
  },

  // Start sequential bulk import
  startMultipleImports(urls) {
    this.importQueue = urls;
    this.importTotalCount = urls.length;
    this.isImportingMultiple = true;

    const dialog = document.querySelector('code-import-dialog');
    const input = dialog ? dialog.querySelector('[data-test-id="repo-url-input"]') : null;
    const nativeSubmitBtn = dialog ? dialog.querySelector('[data-test-id="import-repository-button"]') : null;
    const statusDiv = dialog ? dialog.querySelector('.qol-import-status') : null;

    if (dialog && input && nativeSubmitBtn && statusDiv) {
      this.processNextImport(dialog, input, nativeSubmitBtn, statusDiv);
    }
  },

  // Perform next import in queue
  async processNextImport(dialog, input, nativeSubmitBtn, statusDiv) {
    if (this.importQueue.length === 0) {
      this.isImportingMultiple = false;
      if (statusDiv) {
        statusDiv.textContent = 'Hoàn thành nhập tất cả kho lưu trữ!';
        statusDiv.style.color = '#4caf50';
      }
      return;
    }

    const currentUrl = this.importQueue.shift();
    const currentIndex = this.importTotalCount - this.importQueue.length;
    const baseStatus = `Đang nhập (${currentIndex}/${this.importTotalCount}): ${this.getRepoNameFromUrl(currentUrl)}`;

    // Update status text to pending validation
    if (statusDiv) {
      statusDiv.textContent = `${baseStatus} (Đang xác thực URL)...`;
      statusDiv.style.color = '#ff9800';
    }

    // Hide custom button to prevent double-clicks
    const customSubmitBtn = dialog.querySelector('.qol-custom-import-btn');
    if (customSubmitBtn) customSubmitBtn.style.display = 'none';

    // Inject value and trigger Angular events (simulate user focus/input/blur)
    input.focus();
    input.value = currentUrl;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    input.blur();

    // Wait for button to be enabled (Angular validation checks)
    let isReady = false;
    for (let i = 0; i < 25; i++) { // Max 5 seconds
      const currentDialog = document.querySelector('code-import-dialog');
      if (!currentDialog) break;

      const btn = currentDialog.querySelector('[data-test-id="import-repository-button"]');
      if (btn && !btn.disabled && !btn.hasAttribute('disabled')) {
        isReady = true;
        break;
      }
      await GeminiAutomator.wait(200);
    }

    // Update status to submitting
    if (statusDiv) {
      statusDiv.textContent = `${baseStatus} (Đang bấm nhập)...`;
    }

    // Repeatedly attempt submission until dialog closes
    for (let i = 0; i < 5; i++) {
      const activeDialog = document.querySelector('code-import-dialog');
      if (!activeDialog) break; // Dialog closed, import succeeded!

      const btn = activeDialog.querySelector('[data-test-id="import-repository-button"]');
      if (btn && !btn.disabled && !btn.hasAttribute('disabled')) {
        // Dispatch MouseEvent click
        const clickEvent = new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
          view: window
        });
        btn.dispatchEvent(clickEvent);
        
        try {
          btn.click();
        } catch (e) {}

        // Dispatch form submit
        const form = activeDialog.querySelector('form');
        if (form) {
          form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        }
      }
      await GeminiAutomator.wait(500);
    }
  },

  // Extract repo org/name from GitHub URL
  getRepoNameFromUrl(url) {
    try {
      const parts = url.split('/');
      if (parts.length >= 5) {
        return `${parts[parts.length - 2]}/${parts[parts.length - 1]}`;
      }
      return url;
    } catch (e) {
      return url;
    }
  },

  // Automate reopening the dialog
  async scheduleReopenDialog() {
    // Wait 1.8 seconds to allow the previous request to finalize in backend/UI
    await GeminiAutomator.wait(1800);

    if (!this.isImportingMultiple || this.importQueue.length === 0) {
      this.isReopeningDialog = false;
      return;
    }

    try {
      // Find the tools button
      const toolsBtn = document.querySelector('gem-icon-button[arialabel*="tải lên" i], gem-icon-button[aria-label*="tải lên" i], gem-icon-button[arialabel*="công cụ" i], gem-icon-button[aria-label*="công cụ" i], gem-icon-button[arialabel*="Upload" i], gem-icon-button[aria-label*="Upload" i]');
      if (!toolsBtn) throw new Error('Tools button not found');
      toolsBtn.click();

      // Wait for menu overlay
      await GeminiAutomator.wait(350);

      // Check if import button is visible
      const findImportBtn = () => {
        let btn = document.querySelector('[data-test-id="import-hub-settings-button"], [routerlink="import"]');
        if (btn) return btn;
        
        const items = document.querySelectorAll('.mat-mdc-menu-item, [role="menuitem"]');
        for (const item of items) {
          const txt = item.textContent.toLowerCase();
          if (txt.includes('nhập bộ nhớ') || txt.includes('nhập mã') || txt.includes('import code') || txt.includes('import memory')) {
            return item;
          }
        }
        return null;
      };

      const findUploadSubmenuTrigger = () => {
        const triggers = document.querySelectorAll('.mat-mdc-menu-item-submenu-trigger, .mat-mdc-menu-trigger, [aria-haspopup="menu"]');
        for (const trigger of triggers) {
          const txt = trigger.textContent.toLowerCase();
          if (txt.includes('tải lên') || txt.includes('upload')) {
            return trigger;
          }
        }
        return null;
      };

      let importBtn = findImportBtn();
      
      // Step 1: Try targeting the specific "tải lên" / "upload" submenu trigger first
      if (!importBtn) {
        const uploadTrigger = findUploadSubmenuTrigger();
        if (uploadTrigger) {
          uploadTrigger.click();
          await GeminiAutomator.wait(300);
          importBtn = findImportBtn();
        }
      }

      // Step 2: Fallback to other triggers if still not found
      if (!importBtn) {
        // Find all submenu triggers and click them to explore submenus
        const triggers = document.querySelectorAll('.mat-mdc-menu-item-submenu-trigger, .mat-mdc-menu-trigger, [aria-haspopup="menu"], [data-test-id="more-tools-button"]');
        for (const trigger of triggers) {
          trigger.click();
          await GeminiAutomator.wait(250);
          importBtn = findImportBtn();
          if (importBtn) {
            break;
          }
        }
      }

      if (!importBtn) throw new Error('Import button not found in menu after exploring submenus');
      importBtn.click();
    } catch (err) {
      console.error('Failed to reopen import dialog automatically:', err);
      // Reset state on failure so the user isn't locked out of manually using it
      this.isImportingMultiple = false;
      this.importQueue = [];
    } finally {
      this.isReopeningDialog = false;
    }
  },

  // Init Coordinator
  init() {
    // If we are inside any iframe, we are either the quota iframe or some helper frame.
    // We should NEVER initialize QoL features or recursive loadAll/refreshQuota here.
    const isIframe = window.self !== window.top;
    if (isIframe) {
      if (window.location.pathname.includes('/usage')) {
        this.initIframeQuotaListener();
      }
      return; // Exit early to completely prevent nested iframe loops!
    }

    this.scanAndInject();
    this.refreshQuota();

    // Listen to messages from the hidden quota iframe
    window.addEventListener('message', (e) => {
      if (e.origin !== window.location.origin) return;
      if (e.data && e.data.type === 'GEMINI_QOL_QUOTA_UPDATE') {
        this.quotaData = e.data.data;
        QuotaMonitor.updateSidebarQuotaUI(this.quotaData);
      }
    });

    // Prevent closing/reload while deleting
    window.addEventListener('beforeunload', (e) => {
      if (this.isDeleting) {
        e.preventDefault();
        e.returnValue = '';
      }
    });

    // Refresh quota periodically (every 2 minutes)
    setInterval(() => this.refreshQuota(), 120000);

    // Refresh when tab is focused
    window.addEventListener('focus', () => this.refreshQuota());

    // Refresh 5 seconds after sending a message to get real-time usage
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-test-id="send-button"], .send-button');
      if (btn) {
        setTimeout(() => this.refreshQuota(), 5000);
      }
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        const textarea = e.target.closest('textarea, [contenteditable]');
        if (textarea) {
          setTimeout(() => this.refreshQuota(), 5000);
        }
      }
    });

    // Hook SPA client-side navigation
    window.addEventListener('popstate', () => this.scheduleScan());
    
    // Intercept pushState & replaceState
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

    // Periodic safety polling (every 1.5 seconds) to handle missed mutations or async rendering glitches
    setInterval(() => this.scanAndInject(), 1500);

    // Periodic check to reopen the import dialog if we are in bulk import mode and it gets closed
    setInterval(() => {
      if (this.isImportingMultiple && this.importQueue.length > 0 && !this.isReopeningDialog) {
        const dialog = document.querySelector('code-import-dialog');
        if (!dialog) {
          this.isReopeningDialog = true;
          this.scheduleReopenDialog();
        }
      }
    }, 500);

    // Setup MutationObserver without disconnecting/reconnecting
    const observer = new MutationObserver((mutations) => {
      let shouldScan = false;

      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType !== Node.ELEMENT_NODE) continue;

          // Check if this node is our own injected element or is a child of our own elements
          const isOurs = !!(node.closest && (
            node.closest('.gemini-qol-checkbox-container') ||
            node.closest('.gemini-qol-sidebar-toolbar') ||
            node.closest('.qol-copy-markdown-btn') ||
            node.closest('.qol-quota-expanded') ||
            node.closest('.qol-quota-collapsed') ||
            node.closest('.qol-import-status') ||
            node.closest('.qol-custom-import-btn') ||
            node.closest('#qol-quota-iframe')
          ));

          if (!isOurs) {
            shouldScan = true;
            break;
          }
        }
        if (shouldScan) break;
      }

      if (shouldScan) {
        this.scheduleScan();
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }
};

// Run
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => ContentCoordinator.init());
} else {
  ContentCoordinator.init();
}
