/**
 * 云函数调用辅助工具
 * 提供统一的超时处理、错误处理和重试机制
 */

/**
 * 安全的云函数调用包装器
 * @param {Object} options - 调用参数
 * @param {string} options.name - 云函数名称
 * @param {Object} options.data - 传递给云函数的数据
 * @param {number} options.timeout - 超时时间（毫秒），默认10秒
 * @param {number} options.retries - 重试次数，默认1次
 * @param {Function} options.onSuccess - 成功回调
 * @param {Function} options.onError - 失败回调
 * @param {Function} options.onTimeout - 超时回调
 * @param {boolean} options.silent - 是否静默处理错误，默认false
 * @returns {Promise}
 */
function safeCallFunction(options) {
  const {
    name,
    data = {},
    timeout = 15000, // 增加默认超时时间到15秒
    retries = 2,     // 增加默认重试次数到2次
    onSuccess,
    onError,
    onTimeout,
    silent = false
  } = options;

  return new Promise((resolve, reject) => {
    let retryCount = 0;
    let timeoutId;

    const attemptCall = () => {
      
      // 检查云开发环境状态
      if (!wx.cloud) {
        console.error(`❌ wx.cloud 不可用，当前微信版本可能不支持云开发`);
        reject(new Error('wx.cloud not available'));
        return;
      }
      
      // 设置超时保护
      timeoutId = setTimeout(() => {
        console.warn(`⏰ [${new Date().toLocaleTimeString()}] 云函数 ${name} 调用超时 (${timeout}ms)`);
        
        if (onTimeout) {
          onTimeout(new Error(`云函数调用超时: ${timeout}ms`));
        }
        if (!silent) {
          wx.showToast({
            title: '网络超时，请稍后重试',
            icon: 'none',
            duration: 2000
          });
        }
        reject(new Error('timeout'));
      }, timeout);

      
      wx.cloud.callFunction({
        name,
        data,
        timeout,
        success: (res) => {
          clearTimeout(timeoutId);
          console.log(`✅ [${new Date().toLocaleTimeString()}] 云函数 ${name} 调用成功`);
          
          if (onSuccess) {
            onSuccess(res);
          }
          resolve(res);
        },
        fail: (error) => {
          clearTimeout(timeoutId);
          console.error(`❌ [${new Date().toLocaleTimeString()}] 云函数 ${name} 调用失败`);
          
          // 检查是否是超时错误
          if (error.errCode === -404012 || 
              (error.errMsg && (error.errMsg.includes('timeout') || 
                               error.errMsg.includes('polling exceed max timeout'))) ||
              error.message === 'timeout') {
            
            // 如果是超时错误且还有重试次数，尝试重试
            if (retryCount < retries) {
              retryCount++;
              const retryDelay = 1500 * retryCount; // 递增延迟重试
              setTimeout(attemptCall, retryDelay);
              return;
            }
            
            // 超时重试次数用完
            if (onTimeout) {
              onTimeout(error);
            }
            
            if (!silent) {
              wx.showToast({
                title: '服务器响应超时，请稍后重试',
                icon: 'none',
                duration: 2000
              });
            }
            
            reject(error);
            return;
          }
          
          // 检查是否需要重试
          if (retryCount < retries) {
            retryCount++;
            setTimeout(attemptCall, 1000 * retryCount); // 递增延迟重试
            return;
          }
          
          // 重试次数用完，执行错误处理
          if (onError) {
            onError(error);
          }
          
          if (!silent) {
            // 根据错误类型显示不同的提示
            let errorMessage = '网络错误，请重试';
            if (error.errMsg) {
              if (error.errMsg.includes('INVALID_ENV')) {
                errorMessage = '云环境配置错误';
              } else if (error.errMsg.includes('function not found')) {
                errorMessage = '云函数未部署';
              }
            }
            
            wx.showToast({
              title: errorMessage,
              icon: 'none',
              duration: 2000
            });
          }
          
          reject(error);
        }
      });
    };

    attemptCall();
  });
}

/**
 * 检查云函数部署状态
 * @param {Array} functionNames - 要检查的云函数名称列表
 * @returns {Promise}
 */
function checkCloudFunctionStatus(functionNames = []) {
  
  const checkPromises = functionNames.map(name => {
    // 根据不同的云函数名称，准备不同的测试数据
    let testData = { test: true };
    
    // 为不同的云函数准备适当的测试参数
    switch (name) {
      case 'fetchServerData':
        // fetchServerData需要action参数
        testData = { 
          action: 'getServerConfig',
          test: true 
        };
        break;
        
      case 'login':
        // login函数已有checkOnly参数可用于测试
        testData = { 
          checkOnly: true
        };
        break;
        
      case 'updateUserInfo':
        // updateUserInfo通常需要userInfo参数
        testData = {
          test: true,
          testMode: true,
          userInfo: { test: true }
        };
        break;
        
      default:
        // 其他函数使用默认测试数据
        testData = { test: true };
    }
    
    return safeCallFunction({
      name,
      data: testData,
      timeout: 20000, // 增加到20秒超时，给云函数更多时间
      retries: 1,     // 健康检查只重试1次
      silent: true
    }).then(() => {
      return { name, status: 'available' };
    }).catch((error) => {
      return { name, status: 'unavailable', error };
    });
  });
  
  return Promise.all(checkPromises);
}

/**
 * 云环境健康检查
 * @returns {Promise}
 */
function healthCheck() {
  
  const commonFunctions = ['login', 'checkLogin', 'updateUserInfo', 'logout'];
  
  return checkCloudFunctionStatus(commonFunctions).then(results => {
    const available = results.filter(r => r.status === 'available');
    const unavailable = results.filter(r => r.status === 'unavailable');
    
    
    return {
      healthy: unavailable.length === 0,
      available,
      unavailable,
      total: results.length
    };
  });
}

module.exports = {
  safeCallFunction,
  checkCloudFunctionStatus,
  healthCheck
};
