/**
 * 统一用户状态管理服务
 * 负责处理用户登录状态、VIP状态、权限验证等所有用户相关状态
 */

const userService = {
  // 缓存配置
  CACHE_EXPIRE_TIME: 10 * 60 * 1000, // 10分钟缓存过期时间
  
  /**
   * 保存用户登录状态
   * @param {Object} userInfo 用户信息
   */
  saveUserInfo(userInfo) {
    if (!userInfo) return;
    
    // 设置登录状态
    wx.setStorageSync('isLoggedIn', true);
    // 保存用户信息
    wx.setStorageSync('userInfo', userInfo);
    // 记录登录时间
    wx.setStorageSync('loginTime', Date.now());
    
    console.log('用户信息已保存到本地存储');
  },
  
  /**
   * 检查用户是否已登录
   * @returns {Boolean} 是否已登录
   */
  isLoggedIn() {
    return wx.getStorageSync('isLoggedIn') || false;
  },
  
  /**
   * 获取用户信息
   * @returns {Object|null} 用户信息
   */
  getUserInfo() {
    return wx.getStorageSync('userInfo') || null;
  },
  
  /**
   * 统一的用户状态获取方法
   * @param {Boolean} forceRefresh 是否强制刷新缓存
   * @returns {Promise<Object|null>} 用户状态
   */
  async getUserStatus(forceRefresh = false) {
    try {
      console.log('获取用户状态，forceRefresh:', forceRefresh);
      
      // 检查缓存
      if (!forceRefresh) {
        const cachedStatus = wx.getStorageSync('userStatus');
        const cacheTime = wx.getStorageSync('userStatusCacheTime');
        const now = Date.now();
        
        if (cachedStatus && cacheTime && (now - cacheTime < this.CACHE_EXPIRE_TIME)) {
          console.log('使用缓存的用户状态:', cachedStatus);
          return cachedStatus;
        }
      }

      console.log('缓存过期或强制刷新，从云函数获取用户状态...');
      
      const result = await wx.cloud.callFunction({
        name: 'updateUserInfo',
        data: {
          action: 'getUserStatus'
        }
      });

      if (result.result && result.result.success) {
        const userStatus = result.result.data;
        
        // 缓存用户状态
        wx.setStorageSync('userStatus', userStatus);
        wx.setStorageSync('userStatusCacheTime', Date.now());
        
        console.log('获取用户状态成功:', userStatus);
        return userStatus;
      } else {
        console.error('获取用户状态失败:', result.result);
        return null;
      }
      
    } catch (error) {
      console.error('获取用户状态出错:', error);
      return null;
    }
  },
  
  /**
   * 检查用户权限（统一的权限验证）
   * @param {String} featureType 功能类型：'assistant' | 'planning'
   * @returns {Promise<Object>} 权限检查结果 {hasPermission: boolean, reason?: string, userStatus?: object}
   */
  async checkPermission(featureType) {
    try {
      console.log(`检查${featureType}功能权限...`);
      
      // 首先检查本地登录状态
      const isLocallyLoggedIn = this.isLoggedIn();
      if (!isLocallyLoggedIn) {
        console.log('本地登录状态检查失败，用户未登录');
        return {
          hasPermission: false,
          reason: 'not_logged_in',
          message: '请先登录后使用功能'
        };
      }
      
      // 获取用户状态
      const userStatus = await this.getUserStatus();
      
      if (!userStatus) {
        return {
          hasPermission: false,
          reason: 'no_status',
          message: '请先登录后使用功能'
        };
      }

      // 检查用户是否已登录（云端状态）
      if (userStatus.message && (userStatus.message.includes('用户已退出登录') || userStatus.message.includes('用户不存在'))) {
        return {
          hasPermission: false,
          reason: 'not_logged_in',
          message: '请先登录后使用功能'
        };
      }

      const { userType, assistantCount, planningCount } = userStatus;
      
      // 检查用户类型
      if (userType === 'normal') {
        const featureName = featureType === 'assistant' ? '智能助手' : '旅行规划';
        return {
          hasPermission: false,
          reason: 'need_vip',
          message: `${featureName}功能需要VIP会员权限。升级VIP会员即可享受每月5次${featureName}服务。`,
          userStatus
        };
      }

      // 检查剩余次数
      const count = featureType === 'assistant' ? assistantCount : planningCount;
      if (count <= 0) {
        const featureName = featureType === 'assistant' ? '智能助手' : '旅行规划';
        return {
          hasPermission: false,
          reason: 'no_count',
          message: `您的${featureName}使用次数已用完。VIP会员每月可使用5次${featureName}功能。`,
          userStatus
        };
      }

      return {
        hasPermission: true,
        userStatus
      };
      
    } catch (error) {
      console.error('检查权限出错:', error);
      return {
        hasPermission: false,
        reason: 'error',
        message: '检查权限失败，请稍后重试'
      };
    }
  },
  
  /**
   * 扣减使用次数
   * @param {String} featureType 功能类型：'assistant' | 'planning'
   * @returns {Promise<Object>} 扣减结果
   */
  async deductCount(featureType) {
    try {
      console.log(`扣减${featureType}次数...`);
      
      const action = featureType === 'assistant' ? 'deductAssistantCount' : 'deductPlanningCount';
      
      const result = await wx.cloud.callFunction({
        name: 'updateUserInfo',
        data: {
          action: action
        }
      });

      if (result.result && result.result.success) {
        console.log(`${featureType}次数扣减成功:`, result.result.data);
        
        // 清除缓存，强制下次重新获取
        this.clearUserStatusCache();
        
        return {
          success: true,
          data: result.result.data
        };
      } else {
        console.error(`${featureType}次数扣减失败:`, result.result);
        return {
          success: false,
          error: result.result.error || '扣减次数失败'
        };
      }
      
    } catch (error) {
      console.error(`扣减${featureType}次数出错:`, error);
      return {
        success: false,
        error: error.message || '扣减次数失败'
      };
    }
  },
  
  /**
   * 清除用户状态缓存
   */
  clearUserStatusCache() {
    wx.removeStorageSync('userStatus');
    wx.removeStorageSync('userStatusCacheTime');
    console.log('已清除用户状态缓存');
  },
  
  /**
   * 完整的退出登录
   */
  logout() {
    // 清除登录相关存储
    wx.removeStorageSync('isLoggedIn');
    wx.removeStorageSync('userInfo');
    wx.removeStorageSync('loginTime');
    
    // 清除用户状态缓存
    this.clearUserStatusCache();
    
    // 清除其他相关缓存
    wx.removeStorageSync('token');
    wx.removeStorageSync('openid');
    
    console.log('用户登录状态已完全清除');
  },
  
  /**
   * 检查登录是否过期
   * @param {Number} expireTime 过期时间（毫秒），默认7天
   * @returns {Boolean} 是否过期
   */
  isLoginExpired(expireTime = 7 * 24 * 60 * 60 * 1000) {
    const loginTime = wx.getStorageSync('loginTime') || 0;
    const now = Date.now();
    
    return now - loginTime > expireTime;
  },
  
  /**
   * 保存用户配置
   * @param {Object} config 配置信息
   */
  saveUserConfig(config) {
    if (!config) return;
    
    wx.setStorageSync('userConfig', config);
    console.log('用户配置已保存到本地存储');
  },
  
  /**
   * 获取用户配置
   * @returns {Object} 用户配置
   */
  getUserConfig() {
    return wx.getStorageSync('userConfig') || {};
  },
  
  /**
   * 更新用户配置（部分更新）
   * @param {Object} updateData 要更新的配置部分
   */
  updateUserConfig(updateData) {
    if (!updateData) return;
    
    const config = this.getUserConfig();
    const newConfig = { ...config, ...updateData };
    
    this.saveUserConfig(newConfig);
  }
};

module.exports = userService; 