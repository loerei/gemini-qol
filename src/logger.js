/**
 * ============================================================================
 * DEV LOGGER MODULE (Console & Persistent Storage Logger with Log File Export)
 * ============================================================================
 */
export class Logger {
  static LOG_KEY = 'gemini_qol_dev_logs';
  static MAX_LOGS = 500;

  static log(component, message, data = null) {
    this._write('INFO', component, message, data);
  }

  static warn(component, message, data = null) {
    this._write('WARN', component, message, data);
  }

  static error(component, message, error = null) {
    this._write('ERROR', component, message, error ? (error.stack || error.message || String(error)) : null);
  }

  static _write(level, component, message, detail) {
    const timestamp = new Date().toISOString();
    const formatted = `[${timestamp}] [${level}] [${component}] ${message}`;

    // 1. DevTools console logging with color badges
    const badgeStyle = level === 'ERROR' ? 'background: #f44336; color: #fff; border-radius: 3px; padding: 1px 4px;' :
                      level === 'WARN' ? 'background: #ff9800; color: #000; border-radius: 3px; padding: 1px 4px;' :
                      'background: #2196f3; color: #fff; border-radius: 3px; padding: 1px 4px;';
    
    if (detail) {
      console.log(`%c Gemini QoL %c ${level} `, 'background: #333; color: #4caf50; font-weight: bold; border-radius: 3px; padding: 1px 4px;', badgeStyle, `[${component}]`, message, detail);
    } else {
      console.log(`%c Gemini QoL %c ${level} `, 'background: #333; color: #4caf50; font-weight: bold; border-radius: 3px; padding: 1px 4px;', badgeStyle, `[${component}]`, message);
    }

    // 2. Persist to localStorage buffer
    try {
      const logs = this.getLogs();
      logs.push({ timestamp, level, component, message, detail });
      if (logs.length > this.MAX_LOGS) {
        logs.shift();
      }
      localStorage.setItem(this.LOG_KEY, JSON.stringify(logs));
    } catch (e) {}
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
    console.log('%c Gemini QoL %c Cleared dev logs', 'background: #333; color: #4caf50', 'color: #aaa');
  }

  static downloadLogs() {
    const logs = this.getLogs();
    const textContent = logs.map(l => 
      `[${l.timestamp}] [${l.level}] [${l.component}] ${l.message}` + (l.detail ? `\n  Detail: ${JSON.stringify(l.detail)}` : '')
    ).join('\n');

    const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gemini-qol-dev-${Date.now()}.log`;
    a.click();
    URL.revokeObjectURL(url);
  }
}

// Expose global dev commands in browser window context
if (typeof window !== 'undefined') {
  window.qolDownloadLogs = () => Logger.downloadLogs();
  window.qolClearLogs = () => Logger.clearLogs();
  window.qolGetLogs = () => Logger.getLogs();
}
