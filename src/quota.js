import { i18n } from './i18n.js';

/**
 * ============================================================================
 * 2.5 QUOTA MONITOR MODULE (Fetches and renders real-time daily/weekly quota limits)
 * ============================================================================
 */
export class QuotaMonitor {
  static getUsageUrl() {
    const match = window.location.pathname.match(/^\/u\/(\d+)/);
    const userPath = match ? `/u/${match[1]}` : '';
    return `${window.location.origin}${userPath}/usage`;
  }

  static updateSidebarQuotaUI(quotaData) {
    if (!quotaData) return;
    console.log('Gemini QoL - Updating UI with:', quotaData);
    
    const profileLink = document.querySelector('.mavatar-footer-left') ||
                        document.querySelector('[data-test-id="user-profile-button"]') ||
                        document.querySelector('.user-profile-button') ||
                        document.querySelector('[class*="profile"]');
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
