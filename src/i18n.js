/**
 * ============================================================================
 * 0. I18N TRANSLATION HELPER (Vietnamese & English Localization)
 * ============================================================================
 */
export const i18n = {
  lang: (typeof document !== 'undefined' && document.documentElement ? (document.documentElement.lang || 'en') : 'en').toLowerCase().startsWith('vi') ? 'vi' : 'en',
  
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
        copyReportMd: 'Sao chép báo cáo Markdown',
        copyMdMenu: 'Sao chép dưới dạng Markdown',
        reportGenerating: 'Đang tổng hợp báo cáo...',
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
        copyReportMd: 'Copy report as Markdown',
        copyMdMenu: 'Copy as Markdown',
        reportGenerating: 'Synthesizing report...',
        daily: 'Daily:',
        weekly: 'Weekly:'
      }
    };
    return (translations[this.lang] && translations[this.lang][key]) || translations['en'][key] || key;
  }
};
