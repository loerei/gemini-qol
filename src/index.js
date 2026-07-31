import { i18n } from './i18n.js';
import { MarkdownConverter } from './markdown.js';
import { GeminiAutomator } from './automator.js';
import { QuotaMonitor } from './quota.js';
import { Logger } from './logger.js';

/**
 * ============================================================================
 * 3. CONTENT COORDINATOR (Thin controller gluing UI components and modules)
 * ============================================================================
 */
export const ContentCoordinator = {
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
    const status = item.dataset.qolStatus;
    if (status === 'injected' || status === 'deleting' || status === 'deleted' || item.classList.contains('qol-has-checkbox')) return;

    const a = item.querySelector(GeminiAutomator.SELECTORS.CHAT_LINK);
    if (!a) return;

    const href = a.getAttribute('href');
    const match = href.match(/\/app\/([a-z0-9]+)/i);
    if (!match) return;

    const chatId = match[1];

    const container = document.createElement('label');
    container.className = 'gemini-qol-checkbox-container';
    container.dataset.chatId = chatId;
    container.addEventListener('click', (e) => e.stopPropagation());

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = this.selectedChats.has(chatId);
    
    checkbox.addEventListener('change', (e) => {
      const titleSpan = item.querySelector('.title-text, [class*="title"], span');
      const title = titleSpan ? titleSpan.textContent.trim() : 'Cuộc trò chuyện';
      
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
    item.dataset.qolStatus = 'injected';
  },

  // Inject "Copy as Markdown" next to native copy button
  injectMarkdownCopyButton(responseEl) {
    const status = responseEl.dataset.qolStatus;
    if (status === 'injected' || status === 'no-copy' || responseEl.querySelector('.qol-copy-markdown-btn')) {
      if (responseEl.querySelector('.qol-copy-markdown-btn')) {
        responseEl.dataset.qolStatus = 'injected';
      }
      return;
    }

    const nativeCopyBtn = GeminiAutomator.findNativeCopyButton(responseEl);
    if (!nativeCopyBtn) {
      const isStreaming = !!responseEl.querySelector('.streaming') || responseEl.getAttribute('aria-busy') === 'true';
      if (!isStreaming) {
        responseEl.dataset.qolStatus = 'no-copy';
      }
      return; 
    }

    const mainToolbar = nativeCopyBtn.closest(GeminiAutomator.SELECTORS.TOOLBAR_CONTAINER) || nativeCopyBtn.parentElement?.parentElement;
    if (!mainToolbar) return;

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

    let currentChild = nativeCopyBtn;
    while (currentChild.parentElement && currentChild.parentElement !== mainToolbar) {
      currentChild = currentChild.parentElement;
    }

    mainToolbar.insertBefore(btn, currentChild.nextSibling);
    responseEl.dataset.qolStatus = 'injected';
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
    GeminiAutomator.scrollSidebarToTop();

    await GeminiAutomator.wait(1500);
    loadBtn.style.display = 'none';
  },

  // Execute bulk deletion sequence
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
    let adaptiveCooldown = 50;

    for (let i = 0; i < total; i++) {
      const chatId = chatIds[i];
      if (progressBar) progressBar.style.width = `${(i / total) * 100}%`;

      try {
        const elapsed = await GeminiAutomator.deleteConversation(chatId);
        this.selectedChats.delete(chatId);

        if (elapsed > 1000) {
          adaptiveCooldown = Math.min(adaptiveCooldown + 25, 200);
        } else if (elapsed < 300) {
          adaptiveCooldown = Math.max(adaptiveCooldown - 15, 30);
        }
      } catch (err) {
        Logger.error('Coordinator', `Deletion failed for ${chatId}: ${err.message}`);
      }

      this.updateToolbarUI();
      await GeminiAutomator.wait(adaptiveCooldown);
    }

    if (progressBar) progressBar.style.width = '100%';
    await GeminiAutomator.wait(200);

    // Cleanup any lingering modal backdrop or dialog overlay panes cleanly
    await GeminiAutomator.cleanupOverlaysAndScrollLocks();

    if (progressWrap) progressWrap.style.display = 'none';
    if (progressBar) progressBar.style.width = '0%';

    this.isDeleting = false;
    if (selectAllCb) selectAllCb.checked = false;
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
        const id = parentContainer.dataset.chatId;
        cb.checked = this.selectedChats.has(id);
        cb.disabled = this.isDeleting;
      }
    });
  },

  quotaData: null,

  refreshQuota() {
    if (window.self !== window.top) return;

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

    checkAndSend();
    const observer = new MutationObserver(() => checkAndSend());
    observer.observe(document.body, { childList: true, subtree: true });
  },

  sidebarObserver: null,
  responseObserver: null,
  overlayObserver: null,
  shellObserver: null,

  setupObservers() {
    // 1. Shallow document.body shell observer (subtree: false) to catch layout container mounts
    if (!this.shellObserver) {
      this.shellObserver = new MutationObserver((mutations) => {
        for (const m of mutations) {
          for (const node of m.addedNodes) {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const tagName = (node.tagName || '').toLowerCase();
              if (tagName.includes('sidenav') || node.classList.contains('cdk-overlay-container')) {
                this.scheduleScan();
              }
            }
          }
        }
      });
      try {
        this.shellObserver.observe(document.body, { childList: true, subtree: false });
      } catch (e) {}
    }

    // 2. Sidebar Observer
    const sidebarContainer = document.querySelector('mat-sidenav-container') || document.querySelector(GeminiAutomator.SELECTORS.SIDEBAR_LIST);
    if (sidebarContainer && !this.sidebarObserver) {
      this.sidebarObserver = new MutationObserver(() => this.scheduleScan());
      try {
        this.sidebarObserver.observe(sidebarContainer, { childList: true, subtree: true });
      } catch (e) {}
    }

    // 3. Main Response Viewport Observer
    const responseContainer = document.querySelector('main, [role="main"]') || document.body;
    if (responseContainer && !this.responseObserver) {
      this.responseObserver = new MutationObserver(() => this.scheduleScan());
      try {
        this.responseObserver.observe(responseContainer, { childList: true, subtree: true });
      } catch (e) {}
    }

    // 4. CDK Overlay Container Observer
    const overlayContainer = document.querySelector('.cdk-overlay-container');
    if (overlayContainer && !this.overlayObserver) {
      this.overlayObserver = new MutationObserver((mutations) => {
        let shouldReopenImport = false;
        for (const m of mutations) {
          for (const node of m.removedNodes) {
            if (node.nodeType === Node.ELEMENT_NODE && node.querySelector && node.querySelector('code-import-dialog')) {
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
      } catch (e) {}
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
    const regex = /https?:\/\/github\.com\/[^\s,;]+/g;
    const matches = text.match(regex) || [];
    return [...new Set(matches.map(url => url.replace(/[.,;]$/, '').trim()))];
  },

  // Scan and enhance the import dialog for bulk importing
  scanAndInjectImportDialog() {
    const dialog = document.querySelector('code-import-dialog');
    if (!dialog) return;

    const input = dialog.querySelector('[data-test-id="repo-url-input"]');
    if (!input || input.classList.contains('qol-monitored')) return;

    input.classList.add('qol-monitored');
    
    const container = dialog.querySelector('.repo-url-input-container');
    if (!container) return;

    let statusDiv = dialog.querySelector('.qol-import-status');
    if (!statusDiv) {
      statusDiv = document.createElement('div');
      statusDiv.className = 'qol-import-status';
      statusDiv.style.cssText = 'font-size: 12px; margin-top: 10px; font-family: "Google Sans", sans-serif; min-height: 20px; line-height: 1.5; font-weight: 500;';
      container.appendChild(statusDiv);
    }

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

    const checkValue = () => {
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

    if (statusDiv) {
      statusDiv.textContent = `${baseStatus} (Đang xác thực URL)...`;
      statusDiv.style.color = '#ff9800';
    }

    const customSubmitBtn = dialog.querySelector('.qol-custom-import-btn');
    if (customSubmitBtn) customSubmitBtn.style.display = 'none';

    input.focus();
    input.value = currentUrl;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    input.blur();

    await GeminiAutomator.waitForElement(() => {
      const currentDialog = document.querySelector('code-import-dialog');
      if (!currentDialog) return null;
      const btn = currentDialog.querySelector('[data-test-id="import-repository-button"]');
      return (btn && !btn.disabled && !btn.hasAttribute('disabled')) ? btn : null;
    }, 5000, dialog);

    if (statusDiv) {
      statusDiv.textContent = `${baseStatus} (Đang bấm nhập)...`;
    }

    for (let i = 0; i < 5; i++) {
      const activeDialog = document.querySelector('code-import-dialog');
      if (!activeDialog) break;

      const btn = activeDialog.querySelector('[data-test-id="import-repository-button"]');
      if (btn && !btn.disabled && !btn.hasAttribute('disabled')) {
        const clickEvent = new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
          view: window
        });
        btn.dispatchEvent(clickEvent);
        
        try {
          btn.click();
        } catch (e) {
          /* ignore synthetic click error */
        }

        const form = activeDialog.querySelector('form');
        if (form) {
          form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        }
      }
      await GeminiAutomator.wait(500);
    }
  },

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

  async scheduleReopenDialog() {
    await GeminiAutomator.wait(1800);

    if (!this.isImportingMultiple || this.importQueue.length === 0) {
      this.isReopeningDialog = false;
      return;
    }

    try {
      const toolsBtn = document.querySelector('gem-icon-button[arialabel*="tải lên" i], gem-icon-button[aria-label*="tải lên" i], gem-icon-button[arialabel*="công cụ" i], gem-icon-button[aria-label*="công cụ" i], gem-icon-button[arialabel*="Upload" i], gem-icon-button[aria-label*="Upload" i]');
      if (!toolsBtn) throw new Error('Tools button not found');
      toolsBtn.click();

      await GeminiAutomator.wait(350);

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
      
      if (!importBtn) {
        const uploadTrigger = findUploadSubmenuTrigger();
        if (uploadTrigger) {
          uploadTrigger.click();
          await GeminiAutomator.wait(300);
          importBtn = findImportBtn();
        }
      }

      if (!importBtn) {
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
      if (window.location.pathname.includes('/usage')) {
        this.initIframeQuotaListener();
      }
      return;
    }

    Logger.log('Coordinator', 'Gemini QoL Content Extension initialized');
    this.scanAndInject();
    this.refreshQuota();

    window.addEventListener('message', (e) => {
      if (e.origin !== window.location.origin) return;
      if (e.data && e.data.type === 'GEMINI_QOL_QUOTA_UPDATE') {
        this.quotaData = e.data.data;
        QuotaMonitor.updateSidebarQuotaUI(this.quotaData);
      }
    });

    window.addEventListener('beforeunload', (e) => {
      if (this.isDeleting) {
        e.preventDefault();
      }
    });

    setInterval(() => this.refreshQuota(), 120000);
    window.addEventListener('focus', () => this.refreshQuota());

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

    window.addEventListener('popstate', () => this.scheduleScan());
    
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

// Auto initialize on DOM ready
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => ContentCoordinator.init());
  } else {
    ContentCoordinator.init();
  }
}
