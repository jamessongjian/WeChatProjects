/**
 * 全局日志管理工具
 * 支持日志等级控制和格式化输出
 * 可以替代原生的 console.log, console.warn, console.error
 */

// 日志等级常量
const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  NONE: 4
};

// 日志等级对应的颜色（在开发工具中显示）
const LOG_COLORS = {
  DEBUG: '#6c757d',
  INFO: '#0d6efd',
  WARN: '#fd7e14',
  ERROR: '#dc3545'
};

// 保存原生的 console 方法
const originalConsole = {
  log: console.log,
  info: console.info,
  warn: console.warn,
  error: console.error,
  debug: console.debug
};

class Logger {
  constructor() {
    // 不再在构造函数中初始化配置，改为动态获取
  }

  // 格式化日志消息
  formatMessage(level, tag, message) {
    const timestamp = new Date().toLocaleString('zh-CN');
    return `[${timestamp}] [${level}] ${tag ? `[${tag}] ` : ''}${message}`;
  }

  // 获取当前配置（动态从 app.globalData 读取）
  getCurrentConfig() {
    try {
      const app = getApp();
      if (app && app.globalData && app.globalData.logConfig) {
        return app.globalData.logConfig;
      }
    } catch (error) {
      // 获取失败时返回默认配置
    }
    return {
      level: 'INFO',
      enableConsole: true
    };
  }

  // 检查是否应该输出日志
  shouldLog(level) {
    const config = this.getCurrentConfig();
    const currentLevel = LOG_LEVELS[config.level] !== undefined ? LOG_LEVELS[config.level] : LOG_LEVELS.INFO;
    const enableConsole = config.enableConsole !== false;
    
    return enableConsole && LOG_LEVELS[level] >= currentLevel;
  }

  // DEBUG 级别日志
  debug(tag, message, data) {
    if (!this.shouldLog('DEBUG')) return;
    
    const formattedMessage = this.formatMessage('DEBUG', tag, message);
    originalConsole.debug(`%c${formattedMessage}`, `color: ${LOG_COLORS.DEBUG}`);
    if (data !== undefined) {
      originalConsole.debug(data);
    }
  }

  // INFO 级别日志
  info(tag, message, data) {
    if (!this.shouldLog('INFO')) return;
    
    const formattedMessage = this.formatMessage('INFO', tag, message);
    originalConsole.info(`%c${formattedMessage}`, `color: ${LOG_COLORS.INFO}`);
    if (data !== undefined) {
      originalConsole.info(data);
    }
  }

  // WARN 级别日志
  warn(tag, message, data) {
    if (!this.shouldLog('WARN')) return;
    
    const formattedMessage = this.formatMessage('WARN', tag, message);
    originalConsole.warn(`%c${formattedMessage}`, `color: ${LOG_COLORS.WARN}`);
    if (data !== undefined) {
      originalConsole.warn(data);
    }
  }

  // ERROR 级别日志
  error(tag, message, data) {
    if (!this.shouldLog('ERROR')) return;
    
    const formattedMessage = this.formatMessage('ERROR', tag, message);
    originalConsole.error(`%c${formattedMessage}`, `color: ${LOG_COLORS.ERROR}`);
    if (data !== undefined) {
      originalConsole.error(data);
    }
  }

  // 设置日志等级（通过修改 globalData）
  setLevel(level) {
    try {
      const app = getApp();
      if (app && app.globalData && app.globalData.logConfig) {
        app.globalData.logConfig.level = level;
      }
    } catch (error) {
      originalConsole.warn('Failed to set log level:', error);
    }
  }

  // 启用/禁用控制台输出（通过修改 globalData）
  setConsoleEnabled(enabled) {
    try {
      const app = getApp();
      if (app && app.globalData && app.globalData.logConfig) {
        app.globalData.logConfig.enableConsole = enabled;
      }
    } catch (error) {
      originalConsole.warn('Failed to set console enabled:', error);
    }
  }

  // 获取当前日志等级
  getCurrentLevel() {
    const config = this.getCurrentConfig();
    return config.level;
  }

  // 调试方法：输出当前日志配置
  debugConfig() {
    const config = this.getCurrentConfig();
    const currentLevelName = config.level;
    const currentLevelNum = LOG_LEVELS[config.level];
    
    originalConsole.log('=== Logger Debug Info ===');
    originalConsole.log('Current Level:', currentLevelName, '(' + currentLevelNum + ')');
    originalConsole.log('Enable Console:', config.enableConsole);
    originalConsole.log('LOG_LEVELS:', LOG_LEVELS);
    originalConsole.log('Should log DEBUG:', this.shouldLog('DEBUG'));
    originalConsole.log('Should log INFO:', this.shouldLog('INFO'));
    originalConsole.log('Should log WARN:', this.shouldLog('WARN'));
    originalConsole.log('Should log ERROR:', this.shouldLog('ERROR'));
    originalConsole.log('========================');
  }

  // 劫持原生 console 方法，实现全局日志控制
  hijackConsole() {
    const self = this;
    
    // 劫持 console.log -> INFO 级别
    console.log = function(...args) {
      if (self.shouldLog('INFO')) {
        const message = self.formatConsoleMessage('INFO', args);
        originalConsole.log(`%c${message}`, `color: ${LOG_COLORS.INFO}`, ...args);
      }
    };

    // 劫持 console.info -> INFO 级别
    console.info = function(...args) {
      if (self.shouldLog('INFO')) {
        const message = self.formatConsoleMessage('INFO', args);
        originalConsole.info(`%c${message}`, `color: ${LOG_COLORS.INFO}`, ...args);
      }
    };

    // 劫持 console.warn -> WARN 级别
    console.warn = function(...args) {
      if (self.shouldLog('WARN')) {
        const message = self.formatConsoleMessage('WARN', args);
        originalConsole.warn(`%c${message}`, `color: ${LOG_COLORS.WARN}`, ...args);
      }
    };

    // 劫持 console.error -> ERROR 级别
    console.error = function(...args) {
      if (self.shouldLog('ERROR')) {
        const message = self.formatConsoleMessage('ERROR', args);
        originalConsole.error(`%c${message}`, `color: ${LOG_COLORS.ERROR}`, ...args);
      }
    };

    // 劫持 console.debug -> DEBUG 级别
    console.debug = function(...args) {
      if (self.shouldLog('DEBUG')) {
        const message = self.formatConsoleMessage('DEBUG', args);
        originalConsole.debug(`%c${message}`, `color: ${LOG_COLORS.DEBUG}`, ...args);
      }
    };
  }

  // 恢复原生 console 方法
  restoreConsole() {
    console.log = originalConsole.log;
    console.info = originalConsole.info;
    console.warn = originalConsole.warn;
    console.error = originalConsole.error;
    console.debug = originalConsole.debug;
  }

  // 格式化 console 消息
  formatConsoleMessage(level, args) {
    const timestamp = new Date().toLocaleTimeString('zh-CN');
    const firstArg = args[0] || '';
    
    // 如果第一个参数是字符串，提取前20个字符作为标识
    let tag = '';
    if (typeof firstArg === 'string') {
      tag = firstArg.length > 20 ? firstArg.substring(0, 20) + '...' : firstArg;
    }
    
    return `[${timestamp}] [${level}] ${tag ? `${tag}` : ''}`;
  }

  // 启用全局日志控制
  enableGlobalControl() {
    this.hijackConsole();
  }

  // 禁用全局日志控制
  disableGlobalControl() {
    this.restoreConsole();
  }
}

// 创建全局日志实例
const logger = new Logger();

module.exports = logger;
