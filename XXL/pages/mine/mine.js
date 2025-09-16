Page({
  data: {
    userInfo: {},
    hasUserInfo: false,
    canIUseGetUserProfile: false,
    canIUseOpenData: wx.canIUse('open-data.type.userAvatarUrl') && wx.canIUse('open-data.type.userNickName'),
    lastOperation: '页面初始化' // 添加操作记录
  },

  onLoad() {
    
    
    // 检查是否可以使用getUserProfile API
    if (wx.getUserProfile) {
      this.setData({
        canIUseGetUserProfile: true
      });
    } else {
    }
    
    // 强制设置为未登录状态，然后检查
    this.setData({
      userInfo: {},
      hasUserInfo: false
    });
    
    // 延迟检查登录状态，等待页面完全加载
    setTimeout(() => {
      this.checkLoginStatus();
    }, 100);
  },

  onShow() {
    
    // 每次页面显示时都检查登录状态
    this.checkLoginStatus();
    
    // 监听页面显示后延迟再次检查，处理一些极端情况
    setTimeout(() => {
      this.checkLoginStatus();
    }, 300);
  },

  // 检查用户登录状态 - 增强版
  async checkLoginStatus() {
    
    try {
      // 先检查本地存储，如果没有信息，直接视为未登录
      const localUserInfo = wx.getStorageSync('userInfo');
      const localOpenid = wx.getStorageSync('openid');
      
      if (!localUserInfo || !localOpenid) {
        this.setLoginState(false);
        return;
      }
      
      // 检查全局变量，如果没有，也视为未登录
      if (!getApp().globalData.userInfo || !getApp().globalData.openid) {
        this.setLoginState(false);
        return;
      }
      
      // 检查授权设置
      const checkAuthSetting = new Promise((resolve) => {
        wx.getSetting({
          success: (res) => {
            // 没有授权过userInfo，视为未登录
            if (!res.authSetting['scope.userInfo']) {
              resolve(false);
            } else {
              resolve(true);
            }
          },
          fail: () => {
            resolve(false);
          }
        });
      });
      
      const hasAuth = await checkAuthSetting;
      if (!hasAuth) {
        this.setLoginState(false);
        return;
      }
      
      // 如果本地检查都通过，再调用云函数进行最终确认
      try {
        const { result } = await wx.cloud.callFunction({
          name: 'checkLogin'
        });
        
        
        if (result && result.success && result.isLogin) {
          // 用户已登录，更新用户信息
          this.setLoginState(true, result.user);
        } else {
          // 云端显示未登录
          this.setLoginState(false);
        }
      } catch (cloudError) {
        console.error('调用云函数失败:', cloudError);
        // 虽然有本地数据，但云函数失败时保守处理为未登录
        this.setLoginState(false);
      }
    } catch (error) {
      console.error('检查登录状态失败:', error);
      // 出现任何错误，都视为未登录
      this.setLoginState(false);
      
      wx.showToast({
        title: '检查登录状态失败',
        icon: 'none'
      });
    }
  },
  
  // 设置登录状态 - 统一处理登录状态变更
  setLoginState(isLoggedIn, userData = null) {
    
    const app = getApp();
    const defaultUser = app.globalData.defaultUserInfo || {
      avatarUrl: '/images/xiaoxiaolu_default_touxiang.jpg',
      nickName: '小小鹿momo'
    };
    
    if (isLoggedIn && userData) {
      // 登录状态
      this.setData({
        userInfo: userData,
        hasUserInfo: true
      });
      
      // 更新全局数据
      app.globalData.userInfo = userData;
      app.globalData.hasUserInfo = true;
      app.globalData.openid = userData.openid;
      
      // 确保本地存储一致
      wx.setStorageSync('userInfo', userData);
      wx.setStorageSync('openid', userData.openid);
    } else {
      // 未登录状态 - 使用默认用户信息
      this.setData({
        userInfo: defaultUser,
        hasUserInfo: false
      });
      
      // 更新全局数据为默认用户
      app.globalData.userInfo = defaultUser;
      app.globalData.hasUserInfo = false;
      app.globalData.openid = null;
      
      // 清除本地存储
      wx.removeStorageSync('userInfo');
      wx.removeStorageSync('openid');
      wx.removeStorageSync('token');
    }
  },

  // 获取用户信息 - 超级增强版
  async getUserProfile(e) {
    const operation = e?.currentTarget?.dataset?.operation || 'login';
    
    // 更新UI状态
    this.setData({
      lastOperation: '开始' + operation + ' 时间: ' + new Date().toLocaleTimeString()
    });
    
    // 显示UI反馈
    wx.showToast({
      title: '开始登录...',
      icon: 'loading',
      duration: 2000
    });
    
    try {
      // 清除已有数据
      this.directResetStatus();
      
      // 显示加载中提示
      wx.showLoading({
        title: '登录中...',
        mask: true
      });
      
      // 获取用户信息
      let userInfo;
      try {
        // 更新UI状态
        this.setData({
          lastOperation: '调用wx.getUserProfile...'
        });
        
        const userProfileRes = await new Promise((resolve, reject) => {
          wx.getUserProfile({
            desc: '用于完善会员资料',
            lang: 'zh_CN',
            success: res => resolve(res),
            fail: err => reject(err)
          });
        });
        
        userInfo = userProfileRes.userInfo;
        
        // 更新UI状态
        this.setData({
          lastOperation: '获取用户信息成功'
        });
      } catch (profileError) {
        // 更新UI状态
        this.setData({
          lastOperation: '获取用户信息失败: ' + (profileError.errMsg || profileError.message || '未知错误')
        });
        
        throw new Error('获取用户信息失败: ' + (profileError.errMsg || profileError.message || '未知错误'));
      }
      
      // 直接设置本地状态为已登录（不依赖云函数）
      this.setData({
        userInfo: userInfo,
        hasUserInfo: true,
        lastOperation: '登录成功，时间: ' + new Date().toLocaleTimeString()
      });
      
      // 保存到全局和本地存储
      getApp().globalData.userInfo = userInfo;
      wx.setStorageSync('userInfo', userInfo);
      
      // 提示登录成功
      wx.hideLoading();
      wx.showToast({
        title: '登录成功',
        icon: 'success',
        duration: 2000
      });
      
    } catch (error) {
      // 更新UI状态
      this.setData({
        lastOperation: '登录失败: ' + (error.errMsg || error.message || '未知错误')
      });
      
      // 确保清除所有状态
      this.directResetStatus();
      
      // 友好提示错误
      wx.hideLoading();
      wx.showToast({
        title: '登录失败',
        icon: 'none',
        duration: 2000
      });
      
      // 显示错误对话框
      wx.showModal({
        title: '登录失败',
        content: '错误信息: ' + (error.errMsg || error.message || '未知错误'),
        showCancel: false
      });
    }
  },

  // 跳转到收藏页面
  navigateToFavorites() {
    if (!this.data.hasUserInfo) {
      wx.showToast({
        title: '请先登录',
        icon: 'none'
      });
      return;
    }
    
    wx.navigateTo({
      url: '/pages/favorites/favorites'
    });
  },

  // 跳转到个人资料页面
  navigateToProfile() {
    if (!this.data.hasUserInfo) {
      wx.showToast({
        title: '请先登录',
        icon: 'none'
      });
      return;
    }
    
    wx.navigateTo({
      url: '/pages/profile/profile'
    });
  },

  // 退出登录 - 超级简化版
  async logout(e) {
    try {
      // 更新UI状态
      this.setData({
        lastOperation: '开始退出登录 时间: ' + new Date().toLocaleTimeString()
      });
      
      // 显示确认对话框
      const res = await new Promise((resolve) => {
        wx.showModal({
          title: '确认退出',
          content: '确定要退出登录吗？',
          success(res) {
            resolve(res);
          }
        });
      });
      
      if (!res.confirm) {
        this.setData({
          lastOperation: '用户取消退出登录'
        });
        return;
      }
      
      // 简单粗暴地重置状态（不依赖任何云函数）
      this.directResetStatus();
      
      // 提示成功
      wx.showToast({
        title: '已退出登录',
        icon: 'success'
      });
      
    } catch (error) {
      // 更新UI状态
      this.setData({
        lastOperation: '退出登录失败: ' + (error.message || '未知错误')
      });
      
      wx.showToast({
        title: '退出失败，请重试',
        icon: 'none'
      });
    }
  },
  
  // 重置授权状态的所有已知方法
  async resetAuthStatus() {
    try {
      // 1. 获取当前授权设置
      const settingRes = await new Promise(resolve => {
        wx.getSetting({
          success: res => resolve(res),
          fail: () => resolve({})
        });
      });
      
      
      // 尝试解除授权
      if (settingRes.authSetting && settingRes.authSetting['scope.userInfo']) {
        
        // 微信没有直接API清除授权，只能尝试引导用户
        /*
        wx.openSetting({
          success(res) {
          }
        });
        */
      }
    } catch (e) {
      console.error('重置授权状态失败:', e);
    }
  },
  
  // 测试退出功能
  testLogout() {
    wx.showToast({
      title: '测试退出按钮点击',
      icon: 'none'
    });
    
    // 强制设置未登录状态
    this.setData({
      userInfo: {},
      hasUserInfo: false
    });
    
    // 清除全局数据
    getApp().globalData.userInfo = null;
    getApp().globalData.openid = null;
    
    // 清除本地存储
    try {
      wx.removeStorageSync('userInfo');
      wx.removeStorageSync('openid');
      wx.removeStorageSync('token');
    } catch (e) {
      console.error('清除本地存储失败:', e);
    }
    
    // 提示成功
    wx.showToast({
      title: '测试：已退出',
      icon: 'success'
    });
  },

  fetchAttractionData() {
    const token = wx.getStorageSync('token');
    if (!token) {
        wx.showToast({
            title: '请先登录',
            icon: 'none',
            duration: 2000
        });
        return;
    }

    wx.showLoading({
        title: '加载中...'
    });

    Promise.all([
        // ... 游乐项目请求
    ]).then(([attractionsRes, performancesRes]) => {
        if (attractionsRes.statusCode === 401 || performancesRes.statusCode === 401) {
            // token 验证失败
            this.logout();
            wx.showToast({
                title: '登录已过期，请重新登录',
                icon: 'none',
                duration: 2000
            });
            return;
        }
        // ... 其他处理逻辑
    }).catch(err => {
        console.error('请求过程发生错误:', err);
        wx.showToast({
            title: '网络请求失败',
            icon: 'none'
        });
    }).finally(() => {
        wx.hideLoading();
    });
  },

  // 强制清除登录状态数据
  async forceClearLoginStatus() {
    
    try {
      // 显示确认对话框
      const confirmRes = await new Promise((resolve, reject) => {
        wx.showModal({
          title: '警告',
          content: '强制清除将彻底重置您的登录状态，是否继续？',
          confirmText: '确定清除',
          confirmColor: '#ff0000',
          success(res) {
            resolve(res);
          },
          fail(err) {
            reject(err);
          }
        });
      });
      
      if (!confirmRes.confirm) {
        return; // 用户取消
      }
      
      // 显示加载中
      wx.showLoading({
        title: '正在清除...',
        mask: true
      });
      
      // 1. 先清除本地所有数据
      this.setLoginState(false);
      
      // 2. 调用云函数强制清除
      const { result } = await wx.cloud.callFunction({
        name: 'clearUserData'
      });
      
      
      // 3. 重新检查登录状态
      await this.checkLoginStatus();
      
      wx.hideLoading();
      
      // 提示成功
      wx.showToast({
        title: '登录状态已重置',
        icon: 'success'
      });
      
    } catch (error) {
      console.error('强制清除登录状态失败:', error);
      wx.hideLoading();
      wx.showToast({
        title: '操作失败，请重试',
        icon: 'none'
      });
    }
  },

  // UI调试操作函数，用于直接通过界面触发各种操作并记录
  uiDebugAction(e) {
    const operation = e.currentTarget.dataset.operation;
    
    // 更新最后操作状态
    this.setData({
      lastOperation: '操作: ' + operation + ' 时间: ' + new Date().toLocaleTimeString()
    });
    
    // 显示UI提示
    wx.showToast({
      title: '触发操作: ' + operation,
      icon: 'none',
      duration: 1500
    });
    
    // 根据操作类型执行相应函数
    switch (operation) {
      case 'logout':
        this.logout(e);
        break;
      case 'forceClear':
        this.forceClearLoginStatus();
        break;
      case 'reset':
        // 直接在UI上重置状态，不调用云函数
        this.directResetStatus();
        break;
      default:
        wx.showToast({
          title: '未知操作: ' + operation,
          icon: 'none'
        });
    }
  },
  
  // 直接重置状态，不依赖任何云函数调用
  directResetStatus() {
    // 更新操作状态
    this.setData({
      lastOperation: '直接重置 时间: ' + new Date().toLocaleTimeString(),
      userInfo: {},
      hasUserInfo: false
    });
    
    try {
      // 清除本地存储
      wx.removeStorageSync('userInfo');
      wx.removeStorageSync('openid');
      wx.removeStorageSync('token');
      
      // 清除全局数据
      getApp().globalData.userInfo = null;
      getApp().globalData.openid = null;
      
      // 显示成功提示
      wx.showToast({
        title: '状态已重置',
        icon: 'success'
      });
    } catch (e) {
      // 在UI上显示错误
      this.setData({
        lastOperation: '重置出错: ' + e.message
      });
      
      wx.showToast({
        title: '重置出错',
        icon: 'none'
      });
    }
  },
}) 