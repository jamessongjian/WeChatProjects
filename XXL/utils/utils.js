// 计算字符串相似度
const calculateSimilarity = (str1, str2) => {
  // 添加空值检查
  if (!str1 || !str2) return 0;
  
  const len1 = str1.length;
  const len2 = str2.length;
  const matrix = [];
  
  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return 1 - matrix[len1][len2] / Math.max(len1, len2);
};

// 寻找最佳匹配区域
const findBestMatchArea = (location, areas) => {
  // 添加空值检查
  if (!location || !areas || !Array.isArray(areas) || areas.length === 0) {
    return null;
  }

  let bestMatchArea = '其他区域';
  let bestMatchScore = 0;

  // 寻找最佳匹配区域
  for (const area of areas) {
    if (!area) continue; // 跳过空值
    const score = calculateSimilarity(location, area);
    if (score > bestMatchScore) {
      bestMatchScore = score;
      bestMatchArea = area;
    }
  }

  // 如果匹配度太低，返回null
  if (bestMatchScore < 0.3) {
    return null;
  }

  return bestMatchArea;
};

// 格式化时间
const formatTime = date => {
  const year = date.getFullYear()
  const month = date.getMonth() + 1
  const day = date.getDate()
  const hour = date.getHours()
  const minute = date.getMinutes()
  const second = date.getSeconds()

  return `${[year, month, day].map(formatNumber).join('/')} ${[hour, minute, second].map(formatNumber).join(':')}`
}

// 格式化数字
const formatNumber = n => {
  n = n.toString()
  return n[1] ? n : `0${n}`
}

// 处理图标显示 - 兼容字体加载失败的情况
const getIconClass = (iconName, options = {}) => {
  const app = getApp();
  
  // 检查是否使用备用图标方案
  if (app && app.globalData && app.globalData.useFallbackIcons) {
    // 返回null表示应该使用image组件替代
    return null;
  }
  
  // 默认使用Font Awesome
  let classes = ['fa'];
  
  // 添加图标名
  if (iconName) {
    classes.push(`fa-${iconName}`);
  }
  
  // 添加额外选项
  if (options.size) {
    classes.push(`fa-${options.size}`);
  }
  
  if (options.fixed) {
    classes.push('fa-fw');
  }
  
  if (options.spin) {
    classes.push('fa-spin');
  }
  
  if (options.rotate) {
    classes.push(`fa-rotate-${options.rotate}`);
  }
  
  if (options.flip) {
    classes.push(`fa-flip-${options.flip}`);
  }
  
  if (options.extraClass) {
    if (Array.isArray(options.extraClass)) {
      classes = classes.concat(options.extraClass);
    } else {
      classes.push(options.extraClass);
    }
  }
  
  return classes.join(' ');
};

// 获取备用图标路径
const getFallbackIconPath = (iconName) => {
  if (!iconName) return '';
  
  const app = getApp();
  if (!app || !app.globalData) return '';
  
  // 去掉fa-前缀
  const name = iconName.startsWith('fa-') ? iconName : `fa-${iconName}`;
  
  // 从全局配置中获取映射
  return app.globalData.fallbackIcons[name] || '';
};

module.exports = {
  calculateSimilarity,
  findBestMatchArea,
  formatTime,
  formatNumber,
  getIconClass,
  getFallbackIconPath
}; 