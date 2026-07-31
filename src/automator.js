import { Logger } from './logger.js';

/**
 * ============================================================================
 * 2. GEMINI AUTOMATION MODULE (Encapsulates DOM selectors & UI interactions)
 * ============================================================================
 */
export class GeminiAutomator {
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
    TOOLBAR_CONTAINER: '.actions-container, [role="toolbar"], .response-actions-container, .message-actions, .response-actions'
  };

  /**
   * Helper to fire robust synthetic click events for Angular web components & MDC buttons.
   * @param {HTMLElement} el 
   */
  static triggerClick(el) {
    if (!el) return;

    const targetEl = el.closest('button, [role="menuitem"], a, input, gem-button, gmp-menu-item, gem-menu-item, .mat-mdc-menu-item') || el;
    if (!targetEl || targetEl.disabled || targetEl.getAttribute('aria-disabled') === 'true') return;

    try {
      if (typeof targetEl.focus === 'function') targetEl.focus();
    } catch (e) {}

    const pointerDownOpts = { bubbles: true, cancelable: true, view: window, button: 0, buttons: 1, pointerId: 1, pointerType: 'mouse', isPrimary: true };
    const mouseDownOpts = { bubbles: true, cancelable: true, view: window, button: 0, buttons: 1 };
    const pointerUpOpts = { bubbles: true, cancelable: true, view: window, button: 0, buttons: 0, pointerId: 1, pointerType: 'mouse', isPrimary: true };
    const mouseUpOpts = { bubbles: true, cancelable: true, view: window, button: 0, buttons: 0 };

    try {
      targetEl.dispatchEvent(new PointerEvent('pointerdown', pointerDownOpts));
      targetEl.dispatchEvent(new MouseEvent('mousedown', mouseDownOpts));
      targetEl.dispatchEvent(new PointerEvent('pointerup', pointerUpOpts));
      targetEl.dispatchEvent(new MouseEvent('mouseup', mouseUpOpts));
      targetEl.click();
    } catch (e) {}
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
        if (observer) { observer.disconnect(); observer = null; }
        if (timer) { clearTimeout(timer); timer = null; }
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
      if (typeof matcherOrSelector === 'function') {
        try { return matcherOrSelector(container); } catch (e) { return null; }
      }
      if (typeof matcherOrSelector === 'string') {
        return container.querySelector(matcherOrSelector) || document.querySelector(matcherOrSelector);
      }
      return null;
    };
    return GeminiAutomator._waitForCondition(resolveMatcher, timeoutMs, targetContainer);
  }

  /**
   * Immediate-Evaluating Flexible Promise Waiter for DOM Element Removal
   */
  static waitForElementToDisappear(matcherOrSelector, timeoutMs = 1500, targetContainer = null) {
    const resolveMatcher = (container) => {
      if (typeof matcherOrSelector === 'function') {
        try { return matcherOrSelector(container) ? null : true; } catch (e) { return true; }
      }
      if (typeof matcherOrSelector === 'string') {
        const found = container.querySelector(matcherOrSelector) || document.querySelector(matcherOrSelector);
        return found ? null : true;
      }
      return true;
    };
    return GeminiAutomator._waitForCondition(resolveMatcher, timeoutMs, targetContainer);
  }

  /**
   * Unified Async Overlay & Scroll-Lock Cleanup Helper
   */
  static async cleanupOverlaysAndScrollLocks() {
    this.dismissDialog();
    const escapeEvt = new KeyboardEvent('keydown', {
      key: 'Escape', code: 'Escape', keyCode: 27, which: 27, bubbles: true, cancelable: true, view: window
    });
    (document.activeElement || document.body).dispatchEvent(escapeEvt);

    await this.waitForElementToDisappear('.cdk-overlay-backdrop', 200);

    const hasActiveDialog = document.querySelector('mat-dialog-container, code-import-dialog, .cdk-overlay-pane:not(:empty)');
    if (!hasActiveDialog) {
      const body = document.body;
      const html = document.documentElement;
      if (body) {
        body.classList.remove('cdk-global-scrollblock');
        body.style.top = ''; body.style.position = ''; body.style.paddingRight = ''; body.style.overflow = '';
      }
      if (html) {
        html.classList.remove('cdk-global-scrollblock');
        html.style.top = ''; html.style.position = ''; html.style.paddingRight = ''; html.style.overflow = '';
      }
    }

    const orphanedBackdrop = document.querySelector('.cdk-overlay-container > .cdk-overlay-backdrop');
    const overlayPanes = document.querySelectorAll('.cdk-overlay-container > .cdk-overlay-pane:not(:empty)');
    if (orphanedBackdrop && overlayPanes.length === 0) {
      try { orphanedBackdrop.remove(); } catch (e) {}
    }
  }

  /**
   * Finds the native copy button inside a response element with multiple fallbacks.
   * @param {HTMLElement} responseEl 
   * @returns {HTMLElement|null}
   */
  static findNativeCopyButton(responseEl) {
    // 1. Try finding by icon first
    const copyIcon = responseEl.querySelector(GeminiAutomator.SELECTORS.NATIVE_COPY_ICON);
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
    const items = document.querySelectorAll(GeminiAutomator.SELECTORS.CHAT_ITEM);
    for (const item of items) {
      if (item.dataset.qolDeleted === 'true' || item.style.display === 'none') continue;
      const a = item.querySelector(GeminiAutomator.SELECTORS.CHAT_LINK);
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
    const list = document.querySelector(GeminiAutomator.SELECTORS.SIDEBAR_LIST);
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
    const list = document.querySelector(GeminiAutomator.SELECTORS.SIDEBAR_LIST);
    if (!list) return;

    // 1. Try scrolling last conversation element into view (Intersection Observer trigger)
    const items = list.querySelectorAll(GeminiAutomator.SELECTORS.CHAT_ITEM);
    if (items.length > 0) {
      try {
        items[items.length - 1].scrollIntoView({ block: 'end' });
      } catch (err) {
        console.warn('ScrollIntoView fallback failed:', err);
      }
    }

    // 2. Scroll the container viewport and dispatch scroll event
    const container = GeminiAutomator.getScrollContainer();
    if (container) {
      container.scrollTop = container.scrollHeight;
      container.dispatchEvent(new Event('scroll'));
    }
  }

  /**
   * Scrolls all scrollable parents of the conversation list to the very top.
   */
  static scrollSidebarToTop() {
    const list = document.querySelector(GeminiAutomator.SELECTORS.SIDEBAR_LIST);
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
    const list = document.querySelector(GeminiAutomator.SELECTORS.SIDEBAR_LIST);
    const container = GeminiAutomator.getScrollContainer();
    if (!list || !container) return;

    let lastCount = 0;
    let noChangeAttempts = 0;
    let totalSteps = 0;
    const maxTotalSteps = 100;

    while (noChangeAttempts < 3 && totalSteps < maxTotalSteps) {
      totalSteps++;
      const currentItems = document.querySelectorAll(GeminiAutomator.SELECTORS.CHAT_ITEM);
      const currentCount = currentItems.length;

      if (currentCount === lastCount) {
        noChangeAttempts++;
      } else {
        noChangeAttempts = 0;
        lastCount = currentCount;
      }

      GeminiAutomator.scrollSidebarToBottom();
      if (onScrollStepCallback) onScrollStepCallback(currentCount);

      await GeminiAutomator.waitForElement(() => {
        const nowCount = document.querySelectorAll(GeminiAutomator.SELECTORS.CHAT_ITEM).length;
        return nowCount > currentCount ? document.body : null;
      }, 1500, list);

      const isAtBottom = (container.scrollHeight - container.scrollTop - container.clientHeight) <= 25;
      if (noChangeAttempts >= 3 && isAtBottom) {
        break;
      }
    }
  }

  /**
   * Query the DOM for the dynamic Delete option button in open menus.
   * @returns {HTMLElement|null} The delete menu item element
   */
  static findDeleteMenuButton() {
    // 1. Target exact Gemini menu item structures first (.gem-menu-item-label, gem-icon[fonticonname="delete"])
    const exactLabels = document.querySelectorAll('.gem-menu-item-label, gem-icon[fonticonname="delete"], mat-icon[fonticon="delete"]');
    for (const label of exactLabels) {
      const text = (label.textContent || '').trim().toLowerCase();
      const fontIcon = label.getAttribute('fonticonname') || label.getAttribute('fonticon') || label.getAttribute('data-mat-icon-name');
      
      if (text === 'xoá' || text === 'xóa' || text === 'delete' || fontIcon === 'delete') {
        const itemBtn = label.closest('[role="menuitem"], .mat-mdc-menu-item, button, gmp-menu-item, gem-menu-item') || label;
        return itemBtn;
      }
    }

    // 2. Check open menu overlays/panels
    const menuPanels = document.querySelectorAll(
      '.mat-mdc-menu-panel, .mat-menu-panel, [role="menu"], .cdk-overlay-pane, [class*="menu"]'
    );

    for (const panel of menuPanels) {
      const candidates = panel.querySelectorAll(
        '.mat-mdc-menu-item, [role="menuitem"], gmp-menu-item, gem-menu-item, button, div, a, span'
      );
      for (const el of candidates) {
        const text = (el.textContent || '').trim().toLowerCase();

        // Icon check inside element
        const hasDeleteIcon = el.querySelector && el.querySelector(
          'mat-icon[fonticon="delete"], mat-icon[data-mat-icon-name="delete"], [data-test-id*="delete"], svg[data-icon="delete"], gem-icon[fonticonname="delete"]'
        );
        if (hasDeleteIcon) {
          return el.closest('[role="menuitem"], .mat-mdc-menu-item, button, gmp-menu-item, gem-menu-item') || el;
        }

        // Text check ("Xoá", "Xóa", "Delete")
        if (text === 'xoá' || text === 'xóa' || text === 'delete' || text.includes('xoá') || text.includes('xóa') || text.includes('delete')) {
          const itemBtn = el.closest('[role="menuitem"], .mat-mdc-menu-item, button, gmp-menu-item, gem-menu-item') || el;
          return itemBtn;
        }
      }
    }

    // 3. Fallback search across all menu items in DOM
    const menuButtons = document.querySelectorAll(GeminiAutomator.SELECTORS.MENU_ITEMS);
    for (const btn of menuButtons) {
      const hasDeleteIcon = btn.querySelector('mat-icon[fonticon="delete"], mat-icon[data-mat-icon-name="delete"]');
      if (hasDeleteIcon) {
        return btn;
      }
      const text = btn.textContent.toLowerCase();
      if (text.includes('xóa') || text.includes('xoá') || text.includes('delete')) {
        return btn;
      }
    }
    return null;
  }

  /**
   * Query the DOM for the dynamic Delete confirmation button in popup modal.
   * Scans containers in reverse order to always target the newest active dialog.
   * @returns {HTMLElement|null} The confirm button element
   */
  static findConfirmButton() {
    // 1. Search inside mat-dialog-actions (starting from newest dialog at bottom)
    const dialogActions = document.querySelectorAll('mat-dialog-actions, .mat-mdc-dialog-actions, .mdc-dialog__actions');
    for (let i = dialogActions.length - 1; i >= 0; i--) {
      const candidates = dialogActions[i].querySelectorAll('gem-button, button, span.gds-body-m, span');
      for (const cand of candidates) {
        const text = (cand.textContent || '').trim().toLowerCase();
        if (text.includes('huỷ') || text.includes('hủy') || text.includes('cancel')) {
          continue;
        }
        if (text === 'xoá' || text === 'xóa' || text === 'delete' || text === 'confirm') {
          return cand.closest('button, gem-button') || cand;
        }
      }
    }

    // 2. Search inside open modal / dialog elements (reverse order)
    const dialogContainers = document.querySelectorAll(
      'mat-dialog-container, .mat-mdc-dialog-container, [role="dialog"], gmp-dialog, .cdk-overlay-pane, [class*="dialog"]'
    );
    
    for (let i = dialogContainers.length - 1; i >= 0; i--) {
      const dialog = dialogContainers[i];
      const buttons = dialog.querySelectorAll('gem-button, button, span.gds-body-m');
      for (const btn of buttons) {
        const text = (btn.textContent || '').trim().toLowerCase();
        if (text.includes('huỷ') || text.includes('hủy') || text.includes('cancel')) {
          continue;
        }
        if (
          text === 'xóa' || text === 'xoá' || text === 'delete' || text === 'confirm' ||
          text.includes('xóa') || text.includes('xoá') || text.includes('delete')
        ) {
          return btn.closest('button, gem-button') || btn;
        }
      }
    }

    // 3. Try legacy and data-test-id selectors
    const testIdBtn = document.querySelector(GeminiAutomator.SELECTORS.CONFIRM_BTN);
    if (testIdBtn) return testIdBtn;

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
    Logger.log('Automator', `Starting deletion for chatId: ${chatId}`);
    const safeChatId = typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(chatId) : chatId;
    const item = this.findSidebarItem(safeChatId) || this.findSidebarItem(chatId);
    if (!item) {
      Logger.error('Automator', `Item not found for ID: ${chatId}`);
      throw new Error(`Item not found for ID: ${chatId}`);
    }

    const startTime = Date.now();

    // Optimistic UI feedback
    item.classList.add('qol-deleting');
    item.dataset.qolStatus = 'deleting';
    item.style.pointerEvents = 'none';
    item.style.opacity = '0.6';
    item.style.transition = 'opacity 0.2s ease, max-height 0.2s ease';

    try {
      // 1. Open conversation Actions Menu
      let actionsBtn = item.querySelector(GeminiAutomator.SELECTORS.ACTIONS_BTN);
      if (!actionsBtn) {
        const moreVertIcon = item.querySelector('mat-icon[fonticon="more_vert"], mat-icon[data-mat-icon-name="more_vert"], [data-mat-icon-name="more_vert"]');
        if (moreVertIcon) {
          actionsBtn = moreVertIcon.closest('button, gem-icon-button, [aria-haspopup="menu"]') || moreVertIcon;
        }
      }
      if (!actionsBtn) {
        throw new Error('Actions menu button not found');
      }
      this.triggerClick(actionsBtn);

      // 2. Click Delete button in menu
      const overlayContainer = document.querySelector('.cdk-overlay-container') || document.body;
      const deleteBtn = await this.waitForElement(() => GeminiAutomator.findDeleteMenuButton(), 1500, overlayContainer);
      if (!deleteBtn) {
        throw new Error('Timeout waiting for Delete menu option');
      }
      this.triggerClick(deleteBtn);

      // 3. Confirm in popup dialog
      const confirmBtn = await this.waitForElement(() => GeminiAutomator.findConfirmButton(), 1500, overlayContainer);
      if (!confirmBtn) {
        throw new Error('Timeout waiting for Confirm button in modal dialog');
      }
      this.triggerClick(confirmBtn);

      // 4. Wait for modal & backdrop unmount
      await this.waitForElementToDisappear('.cdk-overlay-container mat-dialog-container, .cdk-overlay-backdrop', 1500);

      // Success State
      item.style.display = 'none';
      item.classList.remove('qol-deleting');
      item.dataset.qolStatus = 'deleted';
      item.dataset.qolDeleted = 'true';
    } catch (err) {
      Logger.error('Automator', `Deletion failed for ${chatId}: ${err.message}`);
      // Failure Revert in catch block
      item.classList.remove('qol-deleting');
      item.dataset.qolStatus = 'injected';
      item.style.pointerEvents = '';
      item.style.opacity = '';
      item.style.display = '';
      throw err;
    } finally {
      await GeminiAutomator.cleanupOverlaysAndScrollLocks();
    }

    const elapsed = Date.now() - startTime;
    Logger.log('Automator', `Successfully deleted chatId: ${chatId} in ${elapsed}ms`);
    return elapsed;
  }

  /**
   * Triggers a cancel event on open dialogs as a recovery step.
   */
  static dismissDialog() {
    const cancelBtn = document.querySelector(GeminiAutomator.SELECTORS.CANCEL_BTN);
    if (cancelBtn) {
      try { cancelBtn.click(); } catch (e) {}
      return;
    }
    const dialogContainers = document.querySelectorAll(
      'mat-dialog-container, .mat-mdc-dialog-container, [role="dialog"], gmp-dialog, .cdk-overlay-pane'
    );
    for (const dialog of dialogContainers) {
      const buttons = dialog.querySelectorAll('button');
      for (const btn of buttons) {
        const text = (btn.textContent || '').trim().toLowerCase();
        if (text.includes('huỷ') || text.includes('hủy') || text.includes('cancel')) {
          try { btn.click(); } catch (e) {}
          return;
        }
      }
    }
  }
}

