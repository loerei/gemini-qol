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
    SIDEBAR_LIST: 'conversations-list[data-test-id="all-conversations"]',
    CHAT_ITEM: 'gem-nav-list-item[data-test-id="conversation"]',
    CHAT_LINK: 'a[href*="/app/"]',
    ACTIONS_BTN: '[data-test-id="actions-menu-button"]',
    CONFIRM_BTN: '[data-test-id="confirm-button"] button',
    CANCEL_BTN: '[data-test-id="cancel-button"] button',
    MENU_ITEMS: '.mat-mdc-menu-item, button[role="menuitem"]',
    NATIVE_COPY_ICON: 'mat-icon[fonticon="copy"], mat-icon[data-mat-icon-name="copy"], mat-icon[fonticon="content_copy"], mat-icon[data-mat-icon-name="content_copy"]',
    TOOLBAR_CONTAINER: '.actions-container, [role="toolbar"], .response-actions-container, .message-actions, .response-actions'
  };

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

  // Inject sub-toolbar above conversation list
  injectSidebarToolbar() {
    if (document.querySelector('.gemini-qol-sidebar-toolbar')) return;

    const list = document.querySelector(GeminiAutomator.SELECTORS.SIDEBAR_LIST);
    if (!list) return;

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

    // Locate the native copy button via its icon
    const copyIcon = responseEl.querySelector(GeminiAutomator.SELECTORS.NATIVE_COPY_ICON);
    const nativeCopyBtn = copyIcon ? copyIcon.closest('button') : null;

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

    const observer = new MutationObserver((mutations) => {
      let shouldScan = false;
      for (const mutation of mutations) {
        // Skip mutations from our own elements to prevent loop
        let isOurs = false;
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE && (
            node.id === 'qol-quota-iframe' ||
            node.classList.contains('qol-quota-expanded') ||
            node.classList.contains('qol-quota-collapsed') ||
            node.classList.contains('gemini-qol-checkbox-container') ||
            node.classList.contains('gemini-qol-sidebar-toolbar') ||
            node.classList.contains('qol-copy-markdown-btn')
          )) {
            isOurs = true;
          }
        });
        if (isOurs) continue;

        if (mutation.addedNodes.length > 0) {
          shouldScan = true;
          break;
        }
      }
      if (shouldScan) {
        observer.disconnect();
        this.scanAndInject();
        observer.observe(document.body, {
          childList: true,
          subtree: true
        });
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
