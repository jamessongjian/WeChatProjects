const app = getApp();
const { getUserSubscriptions, deleteUserSubscription, submitSubscription } = require('../../utils/api');
const logger = require('../../utils/logger');
const userService = require('../../utils/userService');

Page({
  data: {
    userInfo: null,
    hasUserInfo: false,
    canIUseOpenData: wx.canIUse('open-data.type.userAvatarUrl'),
    lastOperation: '页面初始化', // 添加上次操作记录
    aiAssistantEnabled: true, // AI助手开关状态（后台逻辑，无界面）
    tempUserInfo: {  // 临时存储用户信息
      avatarUrl: '',
      nickName: '小小鹿momo'
    },
    nickname: '小小鹿momo', // 临时存储用户输入的昵称
    // 用户VIP状态（从云端同步）
    userType: 'normal', // 默认普通用户
    // VIP相关次数和有效期
    assistantCount: 0, // 智能助手次数
    planningCount: 0, // 旅行规划次数
    vipExpireDate: '2000-01-01', // VIP有效期，默认为2000年1月1日
    vipExpireDisplay: '永久有效', // VIP有效期显示文本
    // 数据同步状态 (已移除显示，仅保留内部逻辑)
    syncStatus: null, // null | 'syncing' | 'success' | 'error'
    // VIP升级相关数据
    showVipModal: false, // 是否显示VIP升级模态框
    // 支付相关数据
    showPaymentModal: false, // 是否显示支付弹窗
    selectedPlan: {}, // 选中的套餐
    vipPlans: [
      {
        id: 'normal',
        name: '普通用户',
        adFree: 'x',
        reminder: '✅',
        planCount: '0次',
        assistantCount: '0次',
        price: '0元',
        color: '#999999',
        isCurrentPlan: false,
        benefits: [
          '基础地图浏览',
          '景点信息查看',
          '基础提醒功能',
          '社区互动'
        ]
      },
      {
        id: 'vip',
        name: 'VIP用户',
        adFree: '1个月',
        reminder: '✅',
        planCount: '5次',
        assistantCount: '5次',
        price: '2元',
        priceValue: 2, // 数字价格，用于支付
        color: '#ffa940',
        isCurrentPlan: false,
        isRecommended: true,
        // 升级提供的次数和有效期
        providedAssistantCount: 5, // 提供的智能助手次数
        providedPlanningCount: 5, // 提供的旅行规划次数
        validityMonths: 1, // 有效期月数
        benefits: [
          '1个月无广告体验',
          '智能游玩规划 +5次/月',
          'AI助手咨询 +5次/月',
          '高级提醒功能'
        ]
      }
    ],
    // 提醒相关数据
    reminders: [],
    // 收藏规划数据
    favoritePlans: [],
    // 项目收藏数据
    projectFavorites: [],
    // 安全的用户ID显示
    userIdDisplay: '未知'
  },

  onLoad() {
    
    // 设置页面标题
    wx.setNavigationBarTitle({
      title: '我的'
    });
    
    // 检查AI助手开关状态（后台逻辑）
    this.updateAiAssistantStatus();
    
    // 检查缓存中是否有昵称
    try {
      const cachedNickname = wx.getStorageSync('nickname');
      if (cachedNickname) {
        this.setData({
          nickname: cachedNickname
        });
      }
    } catch (error) {
    }

    // 初始化VIP有效期显示
    this.setData({
      vipExpireDisplay: this.formatVipExpireDisplay(this.data.vipExpireDate, this.data.userType)
    });
    
    // 检查登录状态
    this.checkLoginStatus();
    
    // 更新VIP方案表格高亮状态
    this.updateVipPlanHighlight();
    
    // 监听游乐场切换事件
    const app = getApp();
    app.globalEvents.on('parkChanged', this.handleParkChange.bind(this));
    
    // 监听AI助手开关变化事件（后台逻辑）
    app.globalEvents.on('aiAssistantToggled', this.updateAiAssistantStatus.bind(this));
    
    // 加载收藏规划数据
    this.loadFavoritePlans();
    
    // 加载项目收藏数据
    this.loadProjectFavorites();
  },
  
  onShow() {
    
    // 设置tabBar选中状态
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setSelected('pages/profile/profile');
    }
    
    // 检查AI助手开关状态（后台逻辑）
    this.updateAiAssistantStatus();
    
    // 每次页面显示时都检查登录状态
    this.checkLoginStatus();
    
    // 加载用户VIP状态
    this.loadUserVipStatus();
    
    // 加载提醒数据
    this.loadReminders();
    
    // 加载收藏规划数据
    this.loadFavoritePlans();
    
    // 加载项目收藏数据
    this.loadProjectFavorites();
  },
  
  onUnload() {
    // 页面被关闭时的清理工作
    const app = getApp();
    app.globalEvents.off('parkChanged', this.handleParkChange);
    app.globalEvents.off('aiAssistantToggled', this.updateAiAssistantStatus);
  },

  // 快速登录 - 无需选择头像和昵称
  quickLogin() {
    console.log('执行快速登录');
    
    // 显示加载
    wx.showLoading({
      title: '登录中...',
      mask: true
    });
    
    try {
      // 使用用户输入的昵称或默认昵称
      const userNickname = this.data.nickname || '小小鹿momo';
      console.log('使用昵称登录:', userNickname);
      
      // 创建默认用户信息，但使用输入的昵称
      const defaultUserInfo = {
        avatarUrl: '/images/xiaoxiaolu_default_touxiang.jpg',
        nickName: userNickname
      };
      
      // 确认云环境已初始化
      if (!wx.cloud) {
        wx.showToast({
          title: '云开发未初始化',
          icon: 'none'
        });
        wx.hideLoading();
        // 使用本地登录备用
        this.handleLoginError('云环境未初始化');
        return;
      }
      
      // 检查云函数是否可用并调用
      wx.cloud.callFunction({
        name: 'login', // 确保云函数已部署
        data: {
          userInfo: defaultUserInfo,
          forceDbAccess: true // 添加参数，强制访问数据库
        },
        success: res => {
          console.log('云函数登录成功:', res);
          
          // 判断是否有数据库错误
          if (res.result && res.result.dbError) {
            console.error('云数据库访问错误:', res.result.dbError);
            
            // 显示数据库错误提示
            if (res.result.dbError.includes('collection not exists')) {
              wx.showModal({
                title: '数据库初始化问题',
                content: '数据库集合不存在，将使用本地模式继续。',
                showCancel: false,
                success: modalRes => {
                  // 直接使用本地模式
                  this.setupLocalUserInfo(defaultUserInfo, res);
                }
              });
            } else {
              // 其他数据库错误
              wx.showModal({
                title: '数据库访问错误',
                content: res.result.dbError,
                showCancel: false
              });
              // 继续使用本地模式
              this.setupLocalUserInfo(defaultUserInfo, res);
            }
          } else {
            // 没有数据库错误，正常处理登录结果
            this.setupLocalUserInfo(defaultUserInfo, res);
            
            // 登录成功后，确保将用户信息更新到云数据库
            const userInfo = {
              ...defaultUserInfo,
              openid: res.result?.openid || ('temp_' + (res.requestID || Date.now())),
              _id: res.result?.userId || ('temp_' + (res.requestID || Date.now())),
              userType: 'normal',
              createDate: new Date().toISOString(),
              lastLoginDate: new Date().toISOString()
            };
            
            // 调用云函数更新用户信息
            wx.cloud.callFunction({
              name: 'updateUserInfo',
              data: {
                userInfo: userInfo
              },
              success: updateRes => {
                console.log('登录后更新用户信息成功:', updateRes);
              },
              fail: updateErr => {
                console.error('登录后更新用户信息失败:', updateErr);
              }
            });
          }
        },
        fail: err => {
          console.error('云函数调用失败:', err);
          
          // 显示具体错误信息
          wx.showModal({
            title: '云函数调用失败',
            content: '错误信息: ' + (err.errMsg || JSON.stringify(err)),
            showCancel: false
          });
          
          this.handleLoginError(err.errMsg || '云函数调用失败');
        },
        complete: () => {
          wx.hideLoading();
        }
      });
    } catch (error) {
      console.error('登录过程出错:', error);
      this.handleLoginError(error.message || '登录失败');
      wx.hideLoading();
    }
  },
  
  // 设置本地用户信息（从云函数返回的结果）- 新的分离式逻辑
  setupLocalUserInfo(defaultUserInfo, res) {
    // 从云函数结果中提取关键信息
    const openid = res.result?.openid || ('temp_' + (res.requestID || Date.now()));
    const userId = res.result?.userId || ('temp_' + (res.requestID || Date.now()));
    
    // 创建用户基础信息对象
    const userInfo = {
      ...defaultUserInfo,
      openid: openid,
      _id: userId,
      createDate: new Date().toISOString(),
      lastLoginDate: new Date().toISOString(),
      isDefaultUser: false
    };
    
    // 确保有昵称
    if (!userInfo.nickName) {
      userInfo.nickName = this.data.nickname || '小小鹿用户';
      console.log('补充昵称:', userInfo.nickName);
    }
    
    // 只保存基础用户信息到本地存储
    try {
      wx.setStorageSync('userInfo', userInfo);
      wx.setStorageSync('token', openid);
      wx.setStorageSync('openid', openid);
      // 设置登录状态标志
      wx.setStorageSync('isLoggedIn', true);
      console.log('用户基础信息已保存到本地存储');
    } catch (storageError) {
      console.error('保存用户信息到本地存储失败:', storageError);
    }
    
    // 设置登录状态
    this.setData({
      hasUserInfo: true,
      userInfo: userInfo,
      nickname: userInfo.nickName
    });
    
    // 更新全局用户信息
    app.globalData.hasUserInfo = true;
    app.globalData.userInfo = userInfo;
    app.globalData.token = openid;
    app.globalData.openid = openid;
    
    // 提示登录成功
    wx.showToast({
      title: '登录成功',
      icon: 'success',
      duration: 1500
    });
    
    // 记录操作
    this.setData({
      lastOperation: '登录成功: ' + new Date().toLocaleTimeString()
    });
    
    // 登录成功后立即同步云端数据（VIP状态）
    this.syncCloudData();
  },
  
  // 从本地相册选择头像
  chooseLocalAvatar() {
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const tempFilePath = res.tempFilePaths[0];
        
        // 显示加载
        wx.showLoading({
          title: '处理中...',
          mask: true
        });
        
        // 先预览效果
        wx.showModal({
          title: '确认使用此图片作为头像？',
          content: '选择确定后将上传并设置为头像',
          success: (confirm) => {
            if (confirm.confirm) {
              // 用户确认，更新头像
              this.updateUserInfo({
                avatarUrl: tempFilePath
              });
              
              this.setData({
                lastOperation: '从相册更新头像：' + new Date().toLocaleTimeString()
              });
              
              wx.showToast({
                title: '已更新头像',
                icon: 'success'
              });
            }
            wx.hideLoading();
          },
          fail: () => {
            wx.hideLoading();
          }
        });
      },
      fail: (err) => {
        console.error('选择图片失败:', err);
        wx.showToast({
          title: '选择图片失败',
          icon: 'none'
        });
      }
    });
  },
  
  // 更新用户昵称（手动输入）
  updateNickname() {
    if (!this.data.hasUserInfo) return;
    
    // 显示输入框让用户手动输入昵称
    wx.showModal({
      title: '修改昵称',
      content: '请输入您的新昵称',
      editable: true,
      placeholderText: this.data.userInfo?.nickName || '请输入昵称',
      success: (res) => {
        if (res.confirm && res.content) {
          // 输入内容不为空时更新
          this.updateUserInfo({
            nickName: res.content
          });
          
          this.setData({
            lastOperation: '手动更新昵称：' + new Date().toLocaleTimeString()
          });
        }
      }
    });
  },
  
  // 更新用户信息
  updateUserInfo(data) {
    if (!this.data.hasUserInfo || !data) return;
    
    // 显示加载
    wx.showLoading({
      title: '更新中...',
      mask: true
    });
    
    try {
      // 检查缓存中是否有昵称，如果更新的是昵称并且缓存中有值，优先使用缓存值
      if (data.nickName && !data.nickName.trim()) {
        const cachedNickname = wx.getStorageSync('nickname');
        if (cachedNickname) {
          console.log('使用缓存昵称更新:', cachedNickname);
          data.nickName = cachedNickname;
        }
      }
      
      // 获取存储的用户标识符
      const storedOpenid = wx.getStorageSync('userOpenid');
      const storedUserId = wx.getStorageSync('userId');
      
      // 合并现有用户信息与新数据，确保保留关键标识符
      const updatedUserInfo = {
        ...this.data.userInfo,
        ...data
      };
      
      // 确保openid和_id保持一致性
      if (storedOpenid) {
        updatedUserInfo.openid = storedOpenid;
      }
      if (storedUserId) {
        updatedUserInfo._id = storedUserId;
      }
      
      // 确认云环境已初始化
      if (!wx.cloud) {
        wx.showToast({
          title: '云开发未初始化',
          icon: 'none'
        });
        
        // 即使云环境未初始化，也更新本地和全局用户信息
        this.setLoginState(true, updatedUserInfo);
        this.updateGlobalUserInfo(updatedUserInfo);
        
        wx.hideLoading();
        return;
      }
      
      // 调用云函数更新用户信息
      wx.cloud.callFunction({
        name: 'updateUserInfo', // 确保云函数已部署
        data: {
          userInfo: updatedUserInfo
        },
        success: res => {
          console.log('云函数更新用户信息成功:', res);
          
          if (res.result && res.result.success) {
            // 更新本地用户信息
            this.setLoginState(true, updatedUserInfo);
            
            // 同步更新全局存储的头像和昵称信息
            this.updateGlobalUserInfo(updatedUserInfo);
            
            // 提示更新成功
            wx.showToast({
              title: '更新成功',
              icon: 'success'
            });
            
            // 记录操作
            this.setData({
              lastOperation: '更新用户信息：' + new Date().toLocaleTimeString()
            });
          } else {
            // 显示错误信息
            console.error('更新用户信息失败:', res.result?.error);
            
            // 如果是数据库集合不存在的错误，显示特定提示
            if (res.result?.error && res.result.error.includes('collection not exists')) {
              wx.showModal({
                title: '数据库集合不存在',
                content: '请在云开发控制台创建名为"users"的集合，或联系管理员初始化数据库。\n\n暂时将只更新本地数据。',
                showCancel: false
              });
            } else {
              wx.showToast({
                title: res.result?.error || '更新失败',
                icon: 'none'
              });
            }
            
            // 仍然更新本地数据
            this.setLoginState(true, updatedUserInfo);
            
            // 同步更新全局存储的头像和昵称信息
            this.updateGlobalUserInfo(updatedUserInfo);
          }
        },
        fail: err => {
          console.error('云函数调用失败:', err);
          
          // 云函数调用失败时，也要更新本地和全局数据
          this.setLoginState(true, updatedUserInfo);
          this.updateGlobalUserInfo(updatedUserInfo);
          
          wx.showToast({
            title: '云端更新失败，已更新本地数据',
            icon: 'none'
          });
        },
        complete: () => {
          wx.hideLoading();
        }
      });
    } catch (error) {
      console.error('更新用户信息过程出错:', error);
      
      // 出错时也尝试更新本地数据
      this.setLoginState(true, this.data.userInfo);
      
      wx.showToast({
        title: '更新失败',
        icon: 'none'
      });
      
      wx.hideLoading();
    }
  },
  
  // 更新全局用户信息
  updateGlobalUserInfo(userInfo) {
    // 确保传入的用户信息不为空
    if (!userInfo) {
      console.log('传入空用户信息，使用默认用户');
      userInfo = app.globalData.defaultUserInfo;
    }
    
    // 确保app.globalData已初始化
    if (!app.globalData) {
      app.globalData = {};
    }
    
    // 更新全局用户信息，确保全局用户信息始终存在
    if (!app.globalData.userInfo) {
      app.globalData.userInfo = app.globalData.defaultUserInfo || userInfo;
    }
    
    // 更新全局用户信息
    if (app.globalData.userInfo) {
      // 只更新头像和昵称
      if (userInfo.avatarUrl) {
        app.globalData.userInfo.avatarUrl = userInfo.avatarUrl;
      }
      if (userInfo.nickName) {
        app.globalData.userInfo.nickName = userInfo.nickName;
      }
      // 更新其他重要属性
      if (userInfo.openid && !userInfo.isDefaultUser) {
        app.globalData.userInfo.openid = userInfo.openid;
      }
      if (userInfo._id && !userInfo.isDefaultUser) {
        app.globalData.userInfo._id = userInfo._id;
      }
      // 如果是真实用户，更新登录状态
      if (!userInfo.isDefaultUser) {
        app.globalData.hasUserInfo = true;
      }
    } else {
      // 如果全局用户信息不存在，直接设置
      app.globalData.userInfo = userInfo;
      app.globalData.hasUserInfo = !userInfo.isDefaultUser;
    }
    
    console.log('全局用户信息已更新:', app.globalData.userInfo);
    
    // 广播用户信息更新事件，让其他页面可以监听并更新
    if (typeof app.userInfoUpdateCallback === 'function') {
      app.userInfoUpdateCallback(app.globalData.userInfo);
    }
    
    // 更新缓存，但只在不是默认用户的情况下
    if (!userInfo.isDefaultUser) {
      try {
        wx.setStorageSync('userInfo', app.globalData.userInfo);
      } catch (e) {
        console.error('保存用户信息到缓存失败:', e);
      }
    }
  },
  
  // 本地更新用户信息辅助方法
  setLocalUserInfo(updatedUserInfo) {
    // 更新本地用户信息
    this.setLoginState(true, updatedUserInfo);
    
    // 同步更新全局存储的头像和昵称信息
    this.updateGlobalUserInfo(updatedUserInfo);
    
    // 提示更新成功
    wx.showToast({
      title: '已更新本地信息',
      icon: 'success'
    });
    
    // 记录操作
    this.setData({
      lastOperation: '本地更新：' + new Date().toLocaleTimeString()
    });
  },
  
  // 检查登录状态 - 新的分离式逻辑
  checkLoginStatus() {
    console.log('检查登录状态');
    
    // 第一步：检查本地登录信息
    this.loadLocalUserInfo();
    
    // 第二步：如果已登录，同步云端数据
    if (this.data.hasUserInfo) {
      this.syncCloudData();
    }
  },
  
  // 加载本地用户信息
  loadLocalUserInfo() {
    console.log('加载本地用户信息');
    
    try {
      // 优先从全局状态获取
      if (app.globalData.hasUserInfo && app.globalData.userInfo && !app.globalData.userInfo.isDefaultUser) {
        console.log('从全局状态恢复用户信息');
        this.setData({
          hasUserInfo: true,
          userInfo: app.globalData.userInfo,
          nickname: app.globalData.userInfo.nickName,
          userIdDisplay: this.getSafeUserId(app.globalData.userInfo)
        });
        return;
      }
      
      // 从本地存储获取
      const userInfo = wx.getStorageSync('userInfo');
      const token = wx.getStorageSync('token');
      
      if (userInfo && token && userInfo.openid && userInfo.nickName && !userInfo.isDefaultUser) {
        console.log('从本地存储恢复用户信息:', userInfo.nickName);
        
        // 恢复登录状态
        this.setData({
          hasUserInfo: true,
          userInfo: userInfo,
          nickname: userInfo.nickName,
          userIdDisplay: this.getSafeUserId(userInfo)
        });
        
        // 更新全局状态
        app.globalData.hasUserInfo = true;
        app.globalData.userInfo = userInfo;
        app.globalData.token = token;
        app.globalData.openid = userInfo.openid;
        
        return;
      }
      
      console.log('本地无有效登录信息');
    } catch (error) {
      console.error('加载本地用户信息失败:', error);
    }
    
    // 设置为未登录状态
    this.setData({
      hasUserInfo: false,
      userInfo: null,
      nickname: '小小鹿用户',
      userIdDisplay: '未知'
    });
  },
  
  // 同步云端数据（VIP状态）- 优化版本，减少对其他页面的性能影响
  syncCloudData() {
    if (!this.data.hasUserInfo) {
      console.log('用户未登录，跳过云端数据同步');
      return;
    }
    
    if (!this.data.userInfo || !this.data.userInfo.openid) {
      console.error('用户信息或openid缺失，无法同步云端数据:', this.data.userInfo);
      this.handleSyncError();
      return;
    }
    
    // 检查是否刚刚完成VIP升级，如果是则跳过同步避免覆盖
    const lastUpgradeTime = wx.getStorageSync('lastVipUpgradeTime');
    const currentTime = Date.now();
    if (lastUpgradeTime && (currentTime - lastUpgradeTime) < 10000) { // 10秒内
      console.log('刚完成VIP升级，跳过云端数据同步以避免覆盖');
      return;
    }
    
    // 性能优化：延迟执行，避免与地图等关键组件的渲染竞争
    setTimeout(() => {
      this.performCloudDataSync();
    }, 100); // 延迟100ms，让关键UI先渲染
  },

  // 实际执行云端数据同步的方法
  performCloudDataSync() {
    console.log('🚀 开始同步云端数据，openid:', this.data.userInfo.openid);
    console.log('📞 准备调用updateUserInfo云函数，参数:', {
      action: 'getUserStatus',
      openid: this.data.userInfo.openid
    });
    
    // 设置超时保护
    const timeoutId = setTimeout(() => {
      console.warn('⚠️ 云函数调用超时，使用本地缓存数据');
      this.handleSyncTimeout();
    }, 10000); // 10秒超时
    
    // 调用云函数获取最新的VIP状态
    wx.cloud.callFunction({
      name: 'updateUserInfo',
      data: {
        action: 'getUserStatus',
        openid: this.data.userInfo.openid
      },
      timeout: 10000, // 设置云函数调用超时时间为10秒
      success: (res) => {
        clearTimeout(timeoutId); // 清除超时计时器
        console.log('云端数据同步成功:', res);
        
        // 检查返回的数据结构，兼容两种情况
        let userData = null;
        if (res.result && res.result.success) {
          // 优先使用 getUserStatus 返回的 data 结构
          if (res.result.data) {
            console.log('使用getUserStatus返回的data结构');
            userData = res.result.data;
          }
          // 如果没有data，尝试使用默认updateUserInfo返回的userInfo结构
          else if (res.result.userInfo) {
            console.log('使用默认updateUserInfo返回的userInfo结构');
            userData = res.result.userInfo;
          }
        }
        
        if (userData) {
          
          // 安全地获取数据，提供默认值
          const userType = userData.userType || 'normal';
          const assistantCount = userData.assistantCount || 0;
          const planningCount = userData.planningCount || 0;
          const vipExpireDate = userData.vipExpireDate || '2000-01-01';
          
          console.log('同步到的数据:', { userType, assistantCount, planningCount, vipExpireDate });
          
          // 检查是否刚刚升级过VIP，如果是则不覆盖本地数据
          const lastVipUpgradeTime = wx.getStorageSync('lastVipUpgradeTime') || 0;
          const timeSinceUpgrade = Date.now() - lastVipUpgradeTime;
          const upgradeProtectionTime = 10000; // 10秒保护期
          
          if (timeSinceUpgrade < upgradeProtectionTime) {
            console.log('刚刚升级过VIP，跳过数据同步以避免覆盖，剩余保护时间:', upgradeProtectionTime - timeSinceUpgrade, 'ms');
            return;
          }
          
          // 更新VIP状态
          this.setData({
            userType: userType,
            assistantCount: assistantCount,
            planningCount: planningCount,
            vipExpireDate: vipExpireDate,
            vipExpireDisplay: this.formatVipExpireDisplay(vipExpireDate, userType)
          });
          
          // 更新VIP方案表格的高亮状态
          this.updateVipPlanHighlight();
          
          // 缓存VIP状态到本地
          try {
            wx.setStorageSync('userType', userType);
            wx.setStorageSync('assistantCount', assistantCount);
            wx.setStorageSync('planningCount', planningCount);
            wx.setStorageSync('vipExpireDate', vipExpireDate);
            console.log('云端数据已缓存到本地');
          } catch (error) {
            console.error('缓存云端数据失败:', error);
          }
          
          // 3秒后隐藏同步状态
          // 同步完成，无需显示状态
          
        } else {
          console.error('云端数据同步失败，响应数据不完整:', res);
          if (res.result) {
            console.error('result.success:', res.result.success);
            console.error('result.data:', res.result.data);
            console.error('result.userInfo:', res.result.userInfo);
            console.error('result.message:', res.result.message);
          } else {
            console.error('result不存在');
          }
          this.handleSyncError();
        }
      },
      fail: (error) => {
        console.error('云函数调用失败:', error);
        this.handleSyncError();
      }
    });
  },
  
  // 处理同步错误
  handleSyncError() {
    console.log('同步失败，使用本地缓存数据');
    
    try {
      // 尝试使用本地缓存的VIP状态
      const cachedUserType = wx.getStorageSync('userType');
      
      this.setData({
        userType: cachedUserType || 'normal'
      });
      
      // 同步失败，使用缓存数据，无需显示错误状态
      
    } catch (error) {
      console.error('读取本地缓存失败:', error);
      // 使用默认值
      this.setData({
        userType: 'normal'
      });
    }
  },
  
  // 设置登录状态
  setLoginState(hasUserInfo, userInfo, clearStorage = false) {
    // 确保总是有用户信息对象，以防传入 null
    if (!userInfo) {
      userInfo = app.globalData.defaultUserInfo;
    }
    
    this.setData({
      hasUserInfo,
      userInfo
    });
    
    // 同时更新全局状态
    app.globalData.hasUserInfo = hasUserInfo;
    app.globalData.userInfo = userInfo;
    
    // 更新缓存，登录状态下保存用户信息
    if (hasUserInfo && userInfo && !userInfo.isDefaultUser) {
      try {
        wx.setStorageSync('userInfo', userInfo);
        wx.setStorageSync('token', userInfo.openid || 'temp_token');
        wx.setStorageSync('openid', userInfo.openid);
        // 设置登录状态标志
        wx.setStorageSync('isLoggedIn', true);
        app.globalData.token = userInfo.openid;
        app.globalData.openid = userInfo.openid;
        console.log('登录状态已保存到本地存储和全局状态');
      } catch (error) {
        console.error('保存用户信息到缓存失败:', error);
      }
    } else if (!hasUserInfo && clearStorage) {
      // 只有在明确要求清除时才清除本地存储（如用户主动退出登录）
      try {
        wx.removeStorageSync('userInfo');
        wx.removeStorageSync('token');
        wx.removeStorageSync('openid');
        wx.removeStorageSync('isLoggedIn');
        app.globalData.token = null;
        app.globalData.openid = null;
        console.log('已清除本地存储的登录信息');
      } catch (error) {
        console.error('清除本地存储失败:', error);
      }
    }
  },
  
  // 用户退出登录
  logout() {
    console.log('用户请求退出登录');
    
    wx.showModal({
      title: '退出登录',
      content: '确定要退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          // 用户确认退出
          this.performLogout();
        }
      }
    });
  },
  
  // 执行退出登录操作
  performLogout() {
    console.log('执行退出登录操作');
    
    // 显示加载
    wx.showLoading({
      title: '退出中...',
      mask: true
    });
    
    try {
      // 调用云函数退出登录
      wx.cloud.callFunction({
        name: 'logout',
        success: res => {
          console.log('云函数退出登录成功:', res);
          
          // 重置登录状态为未登录状态，并清除本地存储
          this.resetToDefaultState();
          
          // 提示退出成功
          wx.showToast({
            title: '已退出登录',
            icon: 'success'
          });
        },
        fail: err => {
          console.error('云函数调用失败:', err);
          
          // 即使云函数失败也进行本地退出
          this.resetToDefaultState();
          
          // 提示退出成功
          wx.showToast({
            title: '已退出登录',
            icon: 'success'
          });
        },
        complete: () => {
          wx.hideLoading();
        }
      });
    } catch (error) {
      console.error('退出登录过程出错:', error);
      
      // 出错时也进行本地退出
      wx.removeStorageSync('userInfo');
      wx.removeStorageSync('token');
      
      // 重置登录状态为未登录状态
      this.resetToDefaultState();
      
      // 提示退出成功
      wx.showToast({
        title: '已退出登录',
        icon: 'success'
      });
      
      wx.hideLoading();
    }
  },
  
  // 重置为默认状态（退出登录后的状态）
  resetToDefaultState() {
    console.log('重置为默认状态');
    const defaultUser = app.globalData.defaultUserInfo;
    
    // 使用统一的用户状态管理进行完整的退出登录
    userService.logout();
    
    // 使用setLoginState方法，并明确要求清除本地存储
    this.setLoginState(false, defaultUser, true);
    
    // 更新页面状态
    this.setData({
      nickname: defaultUser.nickName,
      lastOperation: '退出登录：' + new Date().toLocaleTimeString(),
      // 重置用户类型为默认值
      userType: 'normal',
      // 重置会员相关数据
      assistantCount: 0,
      planningCount: 0,
      vipExpireDate: '2000-01-01'
    });
    
    console.log('已重置为未登录默认状态');
  },



  /**
   * 显示隐私协议
   */
  showPrivacyAgreement() {
    wx.showModal({
      title: '用户协议和隐私条款',
      content: '感谢您使用迪士尼助手小程序！\n\n本应用尊重并保护所有用户的个人隐私权。为了给您提供更准确、更有个性化的服务，我们会按照本隐私条款的规定使用和披露您的个人信息。\n\n我们只会收集与提供服务有关的必要信息，包括但不限于您的微信头像、昵称等。这些信息将用于用户身份识别、提供个性化服务和体验。\n\n我们承诺会尽一切可能保证您的个人信息安全，不会将您的信息提供给无关第三方。',
      showCancel: false,
      confirmText: '我已了解'
    });
  },

  // 处理头像选择器错误
  handleAvatarError(error) {
    console.error('头像选择器错误:', error);
    
    // 如果API不可用或遇到其他错误，使用备用方案
    if (error.errMsg && 
        (error.errMsg.indexOf('function') > -1 || 
         error.errMsg.indexOf('not found') > -1 || 
         error.errMsg.indexOf('fail') > -1)) {
      
      wx.showToast({
        title: '头像选择器不可用，请尝试其他方式',
        icon: 'none',
        duration: 2000
      });
    }
  },

  // 新的头像选择处理函数，使用open-type="chooseAvatar"绑定的事件
  onChooseAvatar(e) {
    console.log('通过open-type获取微信头像', e);
    if (!this.data.hasUserInfo) {
      this.quickLogin();
      return;
    }
    
    const { avatarUrl } = e.detail;
    console.log('选择的头像路径:', avatarUrl);
    
    // 更新头像
    this.updateUserInfo({
      avatarUrl: avatarUrl
    });
    
    this.setData({
      lastOperation: '设置微信头像(open-type)：' + new Date().toLocaleTimeString()
    });
    
    wx.showToast({
      title: '头像已更新',
      icon: 'success'
    });
  },

  /**
   * 用户输入昵称后的回调
   */
  onNicknameReview(e) {
    console.log('昵称回调事件:', e);
    
    // 尝试从不同属性获取昵称（兼容不同版本的微信基础库）
    let nickname = e.detail.nickname;
    
    // 如果nickname为undefined，尝试从value获取
    if (nickname === undefined) {
      nickname = e.detail.value;
      console.log('从value中获取昵称:', nickname);
    }
    
    // 检查昵称是否为undefined或空
    if (!nickname) {
      console.log('接收到无效昵称值，使用默认昵称');
      nickname = '小小鹿momo';
    }
    
    console.log('最终使用的昵称:', nickname);
    
    // 更新页面数据
    this.setData({
      nickname: nickname,
      lastOperation: '设置昵称：' + new Date().toLocaleTimeString()
    });
    
    // 缓存昵称
    wx.setStorageSync('nickname', nickname);
    
    // 同时也更新到临时用户信息中
    const tempUserInfo = this.data.tempUserInfo;
    tempUserInfo.nickName = nickname;
    this.setData({
      tempUserInfo: tempUserInfo
    });
    
    // 如果用户已登录，更新用户信息到服务器和全局状态
    if (this.data.hasUserInfo) {
      // 更新用户信息到服务器
      this.updateUserInfo({
        nickName: nickname
      });
    }
  },



  // 加载用户VIP状态
  loadUserVipStatus() {
    console.log('开始加载用户VIP状态');
    
    // 检查用户是否已登录
    if (!this.data.hasUserInfo || !this.data.userInfo) {
      console.log('用户未登录，使用默认状态');
      this.setData({
        userType: 'normal' // 默认普通用户
      });
      return;
    }
    
    // 检查云环境是否可用
    if (!wx.cloud) {
      console.log('云开发API不可用，使用默认状态');
      this.setData({
        userType: 'normal' // 默认普通用户
      });
      return;
    }
    
    // 检查本地存储中是否有VIP信息
    try {
      const cachedUserType = wx.getStorageSync('userType');
      if (cachedUserType) {
        console.log('从本地缓存获取VIP状态:', cachedUserType);
        this.setData({
          userType: cachedUserType
        });
        // 仍然尝试从云端更新，但不阻塞界面
        this.tryLoadFromCloud();
        return;
      }
    } catch (error) {
      console.log('读取本地VIP缓存失败:', error);
    }
    
    // 尝试从云端加载
    this.tryLoadFromCloud();
  },
  
  // 尝试从云端加载VIP状态
  tryLoadFromCloud() {
    console.log('尝试从云端加载VIP状态');
    
    // 从云函数获取用户信息（包含积分）
    wx.cloud.callFunction({
      name: 'updateUserInfo',
      data: {
        userInfo: {
          // 传递现有用户信息，不做任何更新，仅获取最新数据
          ...this.data.userInfo
        }
      },
      success: res => {
        console.log('获取用户VIP状态成功:', res);
        
        if (res.result && res.result.success && res.result.userInfo) {
          const userType = res.result.userInfo.userType || 'normal';
          console.log('用户类型:', userType);
          
          this.setData({
            userType: userType
          });
          
          // 缓存到本地存储
          try {
            wx.setStorageSync('userType', userType);
          } catch (error) {
            console.log('缓存VIP信息失败:', error);
          }
          
          // 同时更新本地用户信息中的用户类型
          const updatedUserInfo = {
            ...this.data.userInfo,
            userType: userType
          };
          
          this.setData({
            userInfo: updatedUserInfo
          });
          
          // 更新全局用户信息
          const app = getApp();
          if (app.globalData.userInfo) {
            app.globalData.userInfo.userType = userType;
          }
          
        } else {
          console.log('获取用户VIP状态失败，使用默认值');
          this.useDefaultVipStatus();
        }
      },
      fail: err => {
        console.error('获取用户VIP状态失败:', err);
        
        // 检查是否是环境ID错误
        if (err.errMsg && err.errMsg.includes('INVALID_ENV')) {
          console.error('云开发环境ID无效，请检查环境配置');
          wx.showModal({
            title: '云开发环境配置错误',
            content: '云开发环境ID无效，请联系开发者检查环境配置。当前将使用本地模式。',
            showCancel: false,
            confirmText: '知道了'
          });
        }
        
        this.useDefaultVipStatus();
      }
    });
  },
  
  // 使用默认VIP状态
  useDefaultVipStatus() {
    console.log('使用默认VIP状态配置');
    const defaultUserType = 'normal';
    
    this.setData({
      userType: defaultUserType
    });
    
    // 缓存默认值
    try {
      wx.setStorageSync('userType', defaultUserType);
    } catch (error) {
      console.log('缓存默认VIP状态失败:', error);
    }
  },

  // 处理登录错误
  handleLoginError(errorMsg) {
    console.error('登录错误:', errorMsg);
    
    // 使用本地模拟登录作为备用方案
    console.log('使用本地模拟登录...');
    
    // 使用用户输入的昵称或默认昵称
    const userNickname = this.data.nickname || '小小鹿momo';
    console.log('使用昵称进行本地登录:', userNickname);
    
    // 创建默认用户信息，但使用输入的昵称
    const defaultUserInfo = {
      avatarUrl: '/images/xiaoxiaolu_default_touxiang.jpg',
      nickName: userNickname,
      openid: 'local_' + new Date().getTime(),
      _id: 'local_' + new Date().getTime(),
      userType: 'normal',
      createDate: new Date().toISOString(),
      lastLoginDate: new Date().toISOString()
    };
    
    // 设置登录状态
    this.setLoginState(true, defaultUserInfo);
    
    // 提示登录成功
    wx.showToast({
      title: '本地登录成功',
      icon: 'success'
    });
    
    // 记录操作
    this.setData({
      lastOperation: '本地模拟登录：' + new Date().toLocaleTimeString()
    });
  },

  // 加载提醒数据
  loadReminders() {
    const app = getApp();
    
    // 获取用户ID
    const userInfo = app.globalData.userInfo;
    const userId = userInfo ? (userInfo.openid || userInfo._id) : null;
    
    logger.info('Profile', '开始加载提醒数据', { userId });
    
    if (!userId || userId === 'default_user') {
      logger.warn('Profile', '用户未登录或使用默认用户，显示空提醒列表');
      this.setData({
        reminders: []
      });
      return;
    }

    // 检查缓存，避免频繁加载
    const cacheKey = `reminders_${userId}`;
    const cacheTime = `reminders_time_${userId}`;
    const cachedReminders = wx.getStorageSync(cacheKey);
    const cachedTime = wx.getStorageSync(cacheTime);
    const now = Date.now();
    
    // 如果缓存存在且未过期（5分钟内），使用缓存
    if (cachedReminders && cachedTime && (now - cachedTime < 5 * 60 * 1000)) {
      logger.info('Profile', '使用缓存的提醒数据');
      this.setData({
        reminders: cachedReminders
      });
      return;
    }

    // 显示加载状态（只在需要网络请求时显示）
    wx.showLoading({
      title: '加载提醒中...',
      mask: true
    });

    // 从服务器获取用户订阅列表
    getUserSubscriptions(userId)
      .then((result) => {
        logger.info('Profile', '获取订阅列表成功', {
          subscriptionCount: result.data?.subscription_count || 0,
          subscriptionsLength: result.data?.subscriptions?.length || 0
        });

        // 隐藏加载提示
        wx.hideLoading();

        // 从服务器响应中正确提取订阅数据
        const subscriptions = (result && result.data && Array.isArray(result.data.subscriptions)) 
          ? result.data.subscriptions 
          : [];
        
        logger.debug('Profile', '订阅数据类型检查', {
          resultType: typeof result,
          resultDataType: typeof result?.data,
          subscriptionsFieldType: typeof result?.data?.subscriptions,
          isSubscriptionsArray: Array.isArray(result?.data?.subscriptions),
          subscriptionsLength: subscriptions.length
        });
        
        // 转换服务器数据格式为前端显示格式
        const processedReminders = subscriptions.map((subscription, index) => {
          // 解析提醒时间
          const remindTime = new Date(subscription.remind_time);
          const createdTime = new Date(subscription.created_time);
          
          // 计算演出时间（假设提醒时间比演出时间早）
          // 这里需要根据实际业务逻辑调整
          const showTime = this.extractShowTimeFromRemindTime(remindTime);
          
          // 从message_id中提取真正的项目ID
          // message_id格式: ${item.id}_${selectedShowTime}_${Date.now()}
          const extractPerformanceId = (messageId) => {
            console.log('提取项目ID - 原始message_id:', messageId);
            
            if (!messageId) return null;
            
            // 查找最后一个下划线的位置（时间戳前的位置）
            const lastUnderscoreIndex = messageId.lastIndexOf('_');
            if (lastUnderscoreIndex === -1) {
              console.log('提取项目ID - 未找到下划线，返回原值:', messageId);
              return messageId;
            }
            
            // 从剩余部分查找倒数第二个下划线的位置（场次时间前的位置）
            const remainingPart = messageId.substring(0, lastUnderscoreIndex);
            console.log('提取项目ID - 去掉时间戳后:', remainingPart);
            
            const secondLastUnderscoreIndex = remainingPart.lastIndexOf('_');
            if (secondLastUnderscoreIndex === -1) {
              console.log('提取项目ID - 未找到第二个下划线，返回原值:', messageId);
              return messageId;
            }
            
            // 提取项目ID（从开始到倒数第二个下划线）
            const extractedId = messageId.substring(0, secondLastUnderscoreIndex);
            console.log('提取项目ID - 最终提取的ID:', extractedId);
            return extractedId;
          };
          
          const performanceId = extractPerformanceId(subscription.message_id);
          
          return {
            id: subscription.message_id || `server_${index}`,
            performanceName: subscription.performance_name,
            performanceId: performanceId, // 从message_id中提取的真正项目ID
            showTime: showTime,
            reminderDate: remindTime.toLocaleDateString('zh-CN'),
            advanceMinutes: this.calculateAdvanceMinutes(remindTime),
            advanceText: this.calculateAdvanceText(remindTime),
            parkName: subscription.park_name,
            parkId: this.getParkIdByName(subscription.park_name),
            createTime: createdTime.toISOString(),
            duration: '约30分钟', // 默认演出时长
            hasSubscribePermission: true, // 从服务器获取的都是已授权的
            performance_location: subscription.performance_location,
            remind_time: subscription.remind_time,
            created_time: subscription.created_time
          };
        });

        // 根据当前游乐场过滤提醒（如果需要）
        const currentParkId = app.globalData.currentParkId;
        let filteredReminders = processedReminders;
        if (currentParkId) {
          filteredReminders = processedReminders.filter(reminder => {
            return !reminder.parkId || reminder.parkId === currentParkId;
          });
        }

        logger.info('Profile', '处理后的提醒数据', {
          currentParkId,
          filteredCount: filteredReminders.length,
          totalCount: processedReminders.length
        });

        this.setData({
          reminders: filteredReminders
        });

        // 缓存提醒数据
        try {
          wx.setStorageSync(cacheKey, filteredReminders);
          wx.setStorageSync(cacheTime, now);
          logger.info('Profile', '提醒数据已缓存');
        } catch (error) {
          logger.warn('Profile', '缓存提醒数据失败', { error: error.message });
        }
      })
      .catch((error) => {
        logger.error('Profile', '获取订阅列表失败', { error: error.message });

        // 隐藏加载提示
        wx.hideLoading();

        // 显示错误提示
        wx.showToast({
          title: '获取提醒失败',
          icon: 'none',
          duration: 2000
        });

        // 设置空的提醒列表
        this.setData({
          reminders: []
        });
      });
  },

  // 清除提醒缓存
  clearRemindersCache() {
    const app = getApp();
    const userInfo = app.globalData.userInfo;
    const userId = userInfo ? (userInfo.openid || userInfo._id) : null;
    
    if (userId && userId !== 'default_user') {
      const cacheKey = `reminders_${userId}`;
      const cacheTime = `reminders_time_${userId}`;
      
      try {
        wx.removeStorageSync(cacheKey);
        wx.removeStorageSync(cacheTime);
        logger.info('Profile', '提醒缓存已清除');
      } catch (error) {
        logger.warn('Profile', '清除提醒缓存失败', { error: error.message });
      }
    }
  },

  // 从提醒时间中提取演出时间（简化处理）
  extractShowTimeFromRemindTime(remindTime) {
    // 这里假设提醒时间格式包含了演出时间信息
    // 实际项目中可能需要更复杂的逻辑
    const hours = remindTime.getHours();
    const minutes = remindTime.getMinutes();
    
    // 假设演出时间比提醒时间晚10分钟（默认提前时间）
    const showTime = new Date(remindTime.getTime() + 10 * 60 * 1000);
    return `${String(showTime.getHours()).padStart(2, '0')}:${String(showTime.getMinutes()).padStart(2, '0')}`;
  },

  // 计算提前时间（分钟）
  calculateAdvanceMinutes(remindTime) {
    // 简化处理，返回默认值
    return 10;
  },

  // 计算提前时间文本
  calculateAdvanceText(remindTime) {
    // 简化处理，返回默认值
    return '提前10分钟';
  },

  // 根据游乐园名称获取ID
  getParkIdByName(parkName) {
    const app = getApp();
    // 简化映射，实际项目中可能需要更完整的映射
    const parkNameMap = {
      '北京环球影城度假区': 'universal',
      '上海迪士尼乐园': 'disney',
      '北京环球度假区': 'universal'
    };
    return parkNameMap[parkName] || 'universal';
  },

  // 删除提醒
  deleteReminder(e) {
    const { index } = e.currentTarget.dataset;
    const app = getApp();
    const reminderToDelete = this.data.reminders[index];
    
    if (!reminderToDelete) {
      wx.showToast({
        title: '提醒不存在',
        icon: 'none'
      });
      return;
    }
    
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这个提醒吗？',
      success: (res) => {
        if (res.confirm) {
          // 获取用户ID
          const userInfo = app.globalData.userInfo;
          const userId = userInfo ? (userInfo.openid || userInfo._id) : null;
          
          if (!userId || userId === 'default_user') {
            wx.showToast({
              title: '用户未登录，无法删除',
              icon: 'none'
            });
            return;
          }

          // 显示删除加载状态
          wx.showLoading({
            title: '删除中...',
            mask: true
          });

          logger.info('Profile', '开始删除提醒', {
            userId,
            messageId: reminderToDelete.id,
            performanceName: reminderToDelete.performanceName
          });

          // 调用服务器删除接口
          deleteUserSubscription(userId, reminderToDelete.id)
            .then((result) => {
              logger.info('Profile', '删除提醒成功', { messageId: reminderToDelete.id });

              // 隐藏加载提示
              wx.hideLoading();

              // 显示成功提示
              wx.showToast({
                title: '删除成功',
                icon: 'success',
                duration: 1500
              });

              // 清除缓存后重新加载提醒列表
              this.clearRemindersCache();
              this.loadReminders();
            })
            .catch((error) => {
              logger.error('Profile', '删除提醒失败', { error: error.message, messageId: reminderToDelete.id });

              // 隐藏加载提示
              wx.hideLoading();

              // 显示错误提示
              wx.showModal({
                title: '删除失败',
                content: `服务器错误: ${error.message}`,
                showCancel: false,
                confirmText: '我知道了'
              });
            });
        }
      }
    });
  },









  // 导航到演出位置
  navigateToPerformance(e) {
    const { index } = e.currentTarget.dataset;
    const reminder = this.data.reminders[index];
    
    if (!reminder) {
      wx.showToast({
        title: '提醒信息不存在',
        icon: 'none'
      });
      return;
    }

    console.log('=== 导航到演出位置 ===');
    console.log('提醒数据:', reminder);
    console.log('演出名称:', reminder.performanceName);
    console.log('游乐场ID:', reminder.parkId);

    // 通过演出名称查找实际的项目数据
    const actualPerformanceId = this.findPerformanceIdByName(reminder.performanceName, reminder.parkId);
    
    if (!actualPerformanceId) {
      console.error('未找到对应的演出项目:', reminder.performanceName);
      wx.showToast({
        title: `未找到演出"${reminder.performanceName}"`,
        icon: 'none',
        duration: 2000
      });
      return;
    }

    // 从全局数据中获取完整的项目信息
    const app = getApp();
    const allItems = app.globalData.allItems[reminder.parkId] || [];
    const performanceItem = allItems.find(item => item.id === actualPerformanceId);
    
    if (!performanceItem) {
      console.error('未找到项目详细信息:', actualPerformanceId);
      wx.showToast({
        title: '无法获取项目信息',
        icon: 'none'
      });
      return;
    }

    console.log('找到项目详细信息:', {
      id: performanceItem.id,
      name: performanceItem.name,
      latitude: performanceItem.latitude,
      longitude: performanceItem.longitude,
      location: performanceItem.location
    });

    // 检查经纬度信息
    if (!performanceItem.latitude || !performanceItem.longitude) {
      console.error('项目缺少经纬度信息:', performanceItem);
      wx.showToast({
        title: '无法获取位置信息',
        icon: 'none'
      });
      return;
    }

    const latitude = parseFloat(performanceItem.latitude);
    const longitude = parseFloat(performanceItem.longitude);
    
    if (isNaN(latitude) || isNaN(longitude)) {
      console.error('经纬度格式错误:', {
        latitude: performanceItem.latitude,
        longitude: performanceItem.longitude
      });
      wx.showToast({
        title: '经纬度格式错误',
        icon: 'none'
      });
      return;
    }

    const name = reminder.performanceName;
    const address = `${reminder.parkName} - ${performanceItem.location || '演出区域'}`;
    
    console.log('准备打开导航:', {
      latitude,
      longitude,
      name,
      address
    });

    // 打开微信内置地图导航
    wx.openLocation({
      latitude: latitude,
      longitude: longitude,
      name: name,
      address: address,
      scale: 18,
      success: () => {
        console.log('导航成功打开');
      },
      fail: (err) => {
        console.error('导航打开失败:', err);
        // 导航失败时给出提示
        wx.showToast({
          title: '导航打开失败',
          icon: 'none'
        });
      }
    });
  },

  // 点击提醒item进入详情页
  goToPerformanceDetails(e) {
    const { index } = e.currentTarget.dataset;
    const reminder = this.data.reminders[index];
    
    wx.navigateTo({
      url: `/pages/details/details?id=${reminder.performanceId}&type=performance&parkId=${reminder.parkId}`
    });
  },
  
  // 空函数，用于阻止事件冒泡
  noop() {
    // 什么都不做，只是阻止事件冒泡
    return;
  },

  // 查看提醒详情
  viewReminderDetail(e) {
    const index = e.currentTarget.dataset.index;
    const reminder = this.data.reminders[index];
    
    if (!reminder) {
      wx.showToast({
        title: '提醒信息不存在',
        icon: 'none'
      });
      return;
    }

    console.log('=== 查看提醒详情 ===');
    console.log('提醒数据:', reminder);
    console.log('演出名称:', reminder.performanceName);
    console.log('游乐场ID:', reminder.parkId);

    // 通过演出名称查找项目ID
    const actualPerformanceId = this.findPerformanceIdByName(reminder.performanceName, reminder.parkId);
    
    if (actualPerformanceId) {
      console.log('找到实际项目ID:', actualPerformanceId);
      console.log('跳转URL:', `/pages/details/details?id=${actualPerformanceId}&type=performance&parkId=${reminder.parkId}`);

      // 跳转到演出详情页（details页面）
      wx.navigateTo({
        url: `/pages/details/details?id=${actualPerformanceId}&type=performance&parkId=${reminder.parkId}`,
        success: () => {
          console.log('跳转详情页成功');
        },
        fail: (err) => {
          console.error('跳转详情页失败:', err);
          wx.showToast({
            title: '无法打开详情页',
            icon: 'none'
          });
        }
      });
    } else {
      console.error('未找到对应的演出项目:', reminder.performanceName);
      wx.showToast({
        title: `未找到演出"${reminder.performanceName}"`,
        icon: 'none',
        duration: 2000
      });
    }
  },

  // 通过演出名称查找实际的项目ID
  findPerformanceIdByName(performanceName, parkId) {
    try {
      const app = getApp();
      
      // 从全局数据中查找对应的项目
      const allItems = app.globalData.allItems[parkId] || [];
      
      console.log('查找演出项目:', {
        performanceName,
        parkId,
        totalItems: allItems.length
      });
      
      // 查找匹配的演出项目
      const matchedItem = allItems.find(item => {
        if (!item) return false;
        
        // 精确匹配名称
        if (item.name === performanceName) {
          return true;
        }
        
        // 如果是演出类型，进一步检查
        if (item.type === 'performance' || item.type === 'performances') {
          return item.name === performanceName;
        }
        
        return false;
      });
      
      if (matchedItem) {
        console.log('找到匹配的项目:', {
          id: matchedItem.id,
          name: matchedItem.name,
          type: matchedItem.type
        });
        return matchedItem.id;
      } else {
        console.warn('未找到匹配的演出项目:', performanceName);
        
        // 打印所有演出项目供调试
        const performances = allItems.filter(item => 
          item && (item.type === 'performance' || item.type === 'performances')
        );
        console.log('当前游乐场的所有演出项目:', performances.map(p => ({
          id: p.id,
          name: p.name,
          type: p.type
        })));
        
        return null;
      }
    } catch (error) {
      console.error('查找演出项目时出错:', error);
      return null;
    }
  },

  // 阻止事件冒泡（防止按钮区域触发item点击事件）
  preventBubble(e) {
    // 阻止事件冒泡，不做任何处理
    console.log('阻止事件冒泡');
  },

  // 处理游乐场切换事件
  handleParkChange({ parkId, parkName }) {
    console.log(`Profile页面：游乐场已切换到 ${parkName}(${parkId})`);
    
    // 重新加载提醒数据，这样会自动过滤当前游乐场的提醒
    this.loadReminders();
    
    // 重新加载收藏数据
    this.loadFavoritePlans();
    
    // 重新加载项目收藏数据
    this.loadProjectFavorites();
  },

  // 加载收藏的规划数据
  loadFavoritePlans() {
    try {
      const favoritePlans = wx.getStorageSync('favoritePlans') || [];
      const app = getApp();
      const currentParkId = app.globalData.currentParkId;
      
      // 过滤当前游乐场的收藏
      const currentParkFavorites = favoritePlans.filter(favorite => 
        favorite.parkId === currentParkId
      );
      
      // 处理显示数据
      const processedFavorites = currentParkFavorites.map(favorite => {
        // 格式化创建日期
        const createdDate = new Date(favorite.createdAt).toLocaleDateString('zh-CN');
        
        // 获取规划类型中文名称
        const planTypeNames = {
          comprehensive: '综合推荐',
          shortest_wait_time: '最短排队',
          earliest_departure: '最早结束'
        };
        
        // 获取游乐场名称
        const parks = app.globalData.parks || {};
        const parkName = Object.keys(parks).find(name => 
          parks[name].id === favorite.parkId
        ) || '未知游乐场';
        
        return {
          ...favorite,
          planTypeName: planTypeNames[favorite.planType] || favorite.planType,
          createdDate: createdDate,
          parkName: parkName
        };
      });
      
      logger.info('Profile', `加载收藏规划: ${processedFavorites.length} 条`);
      
      this.setData({
        favoritePlans: processedFavorites
      });
      
    } catch (error) {
      console.error('加载收藏规划失败:', error);
      this.setData({
        favoritePlans: []
      });
    }
  },

  // 查看收藏的规划详情
  viewFavoritePlanDetail(e) {
    const index = e.currentTarget.dataset.index;
    const favorite = this.data.favoritePlans[index];
    
    if (!favorite) {
      wx.showToast({
        title: '收藏数据不存在',
        icon: 'none'
      });
      return;
    }
    
    // 显示规划详情
    this.showPlanDetailModal(favorite);
  },

  // 查看收藏的规划
  viewFavoritePlan(e) {
    const index = e.currentTarget.dataset.index;
    const favorite = this.data.favoritePlans[index];
    
    if (!favorite) {
      wx.showToast({
        title: '收藏数据不存在',
        icon: 'none'
      });
      return;
    }
    
    // 跳转到规划页面
    wx.navigateTo({
      url: '/pages/plan/plan'
    });
    
    wx.showToast({
      title: '请在规划页面查看详情',
      icon: 'none',
      duration: 2000
    });
  },

  // 删除收藏的规划
  deleteFavoritePlan(e) {
    const index = e.currentTarget.dataset.index;
    const favorite = this.data.favoritePlans[index];
    
    if (!favorite) {
      wx.showToast({
        title: '收藏数据不存在',
        icon: 'none'
      });
      return;
    }
    
    wx.showModal({
      title: '确认删除',
      content: `确定要删除收藏的"${favorite.planTypeName} - 规划 ${favorite.originalIndex + 1}"吗？`,
      confirmText: '删除',
      confirmColor: '#ff4757',
      success: (res) => {
        if (res.confirm) {
          try {
            // 从本地存储中删除
            let favoritePlans = wx.getStorageSync('favoritePlans') || [];
            favoritePlans = favoritePlans.filter(item => item.id !== favorite.id);
            wx.setStorageSync('favoritePlans', favoritePlans);
            
            // 重新加载数据
            this.loadFavoritePlans();
            
            wx.showToast({
              title: '删除成功',
              icon: 'success'
            });
            
          } catch (error) {
            console.error('删除收藏规划失败:', error);
            wx.showToast({
              title: '删除失败',
              icon: 'none'
            });
          }
        }
      }
    });
  },

  // 显示规划详情模态框
  showPlanDetailModal(favorite) {
    const planData = favorite.planData;
    const items = planData.items || [];
    
    let detailContent = `规划类型：${favorite.planTypeName}\n`;
    detailContent += `总排队时间：${planData.totalWaitTime}分钟\n`;
    detailContent += `离园时间：${planData.departureTime || '未知'}\n`;
    if (planData.queueTimeSavingsTip) {
      detailContent += `时间节省：${planData.queueTimeSavingsTip}\n`;
    }
    detailContent += `\n行程安排：\n`;
    
    items.forEach((item, index) => {
      detailContent += `${index + 1}. ${item.name}\n`;
      detailContent += `   时间：${item.startTime} - ${item.endTime}\n`;
      detailContent += `   排队：${item.queueTime}分钟\n`;
      if (item.restTime > 0) {
        detailContent += `   休息：${item.restTime}分钟\n`;
      }
      detailContent += `\n`;
    });
    
    wx.showModal({
      title: '收藏规划详情',
      content: detailContent,
      showCancel: false,
      confirmText: '知道了'
    });
  },

  // ===== 项目收藏相关方法 =====
  
  // 加载项目收藏数据
  loadProjectFavorites() {
    try {
      const app = getApp();
      const currentParkId = app.globalData.currentParkId;
      const currentParkName = app.getParkNameById(currentParkId);
      
      // 从全局收藏数据中获取当前游乐场的项目收藏
      // 收藏数据是按照parkName存储的，不是parkId
      const allFavorites = app.globalData.favorites[currentParkName] || [];
      
      // 处理收藏数据，确保每个收藏项都有完整的数据
      const processedFavorites = allFavorites.map(item => {
        // 如果item只是一个ID，尝试从全局数据中获取完整项目信息
        if (typeof item === 'string' || typeof item === 'number') {
          const itemId = item;
          const parkItems = app.globalData.allItems[currentParkId] || [];
          const fullItem = parkItems.find(i => i.id === itemId);
          
          if (fullItem) {
            return {
              ...fullItem,
              // 确保基本属性存在
              image: fullItem.image || '/images/placeholder.png',
              name: fullItem.name || '未命名项目',
              type: fullItem.type || 'other'
            };
          } else {
            // 如果找不到完整信息，创建基本项目对象
            return {
              id: itemId,
              name: '项目 #' + itemId,
              image: '/images/placeholder.png',
              type: 'other',
              location: '园区内'
            };
          }
        }
        
        // 如果已经是对象，确保有默认属性
        return {
          ...item,
          image: item.image || '/images/placeholder.png',
          name: item.name || '未命名项目',
          type: item.type || 'other',
          location: item.location || '园区内'
        };
      });
      
      // 转换为显示格式
      const projectFavorites = processedFavorites.map(item => {
        const typeName = this.getProjectTypeName(item.type);
        const waitTime = this.getProjectWaitTimeText(item);
        
        return {
          id: item.id,
          name: item.name,
          type: item.type,
          typeName: typeName,
          location: item.location || '园区内',
          parkName: app.getParkNameById(currentParkId),
          parkId: currentParkId,
          createdDate: new Date().toLocaleDateString('zh-CN'),
          waitTime: waitTime,
          originalData: item // 保存原始数据
        };
      });
      
      console.log('加载项目收藏数据:', {
        currentParkId,
        currentParkName,
        allFavoritesCount: allFavorites.length,
        processedFavoritesCount: processedFavorites.length,
        projectFavoritesCount: projectFavorites.length,
        sampleData: projectFavorites.slice(0, 2) // 显示前两个项目的数据样例
      });
      
      this.setData({
        projectFavorites: projectFavorites
      });
      
    } catch (error) {
      console.error('加载项目收藏数据失败:', error);
      this.setData({
        projectFavorites: []
      });
    }
  },

  // 获取项目类型名称
  getProjectTypeName(type) {
    const typeMap = {
      'attraction': '游乐设施',
      'performance': '演出表演',
      'restaurant': '餐厅',
      'shop': '商店'
    };
    return typeMap[type] || '其他';
  },

  // 获取项目等待时间文本
  getProjectWaitTimeText(item) {
    if (item.type === 'attraction' && item.waitTime) {
      // 检查是否已经包含单位，如果没有则添加默认单位
      const waitTimeStr = item.waitTime.toString();
      const unit = item.waitUnit || '分钟';
      
      // 如果waitTime已经包含单位，直接使用
      if (waitTimeStr.includes('分钟') || waitTimeStr.includes('小时') || waitTimeStr.includes('暂停') || waitTimeStr.includes('维护')) {
        return `排队 ${item.waitTime}`;
      }
      
      // 否则添加单位
      return `排队 ${item.waitTime}${unit}`;
    } else if (item.type === 'performance' && item.nextShow) {
      return `下场 ${item.nextShow}`;
    }
    return '';
  },

  // 查看项目收藏详情（点击整个卡片）
  viewProjectFavoriteDetail(e) {
    const index = e.currentTarget.dataset.index;
    const projectFavorite = this.data.projectFavorites[index];
    
    if (!projectFavorite) {
      wx.showToast({
        title: '收藏数据不存在',
        icon: 'none'
      });
      return;
    }
    
    // 跳转到项目详情页
    wx.navigateTo({
      url: `/pages/details/details?id=${projectFavorite.id}&type=${projectFavorite.type}&parkId=${projectFavorite.parkId}`,
      success: () => {
        console.log('跳转项目详情页成功');
      },
      fail: (err) => {
        console.error('跳转项目详情页失败:', err);
        wx.showToast({
          title: '无法打开详情页',
          icon: 'none'
        });
      }
    });
  },

  // 查看项目收藏（查看按钮）
  viewProjectFavorite(e) {
    const index = e.currentTarget.dataset.index;
    const projectFavorite = this.data.projectFavorites[index];
    
    if (!projectFavorite) {
      wx.showToast({
        title: '收藏数据不存在',
        icon: 'none'
      });
      return;
    }
    
    // 跳转到项目详情页
    wx.navigateTo({
      url: `/pages/details/details?id=${projectFavorite.id}&type=${projectFavorite.type}&parkId=${projectFavorite.parkId}`,
      success: () => {
        console.log('跳转项目详情页成功');
      },
      fail: (err) => {
        console.error('跳转项目详情页失败:', err);
        wx.showToast({
          title: '无法打开详情页',
          icon: 'none'
        });
      }
    });
  },

  // 更新VIP方案表格的高亮状态
  updateVipPlanHighlight() {
    console.log('更新VIP方案高亮状态，当前用户类型:', this.data.userType);
    
    const updatedPlans = this.data.vipPlans.map(plan => {
      // 根据当前用户类型标记当前方案
      if (plan.id === 'normal' && this.data.userType === 'normal') {
        plan.isCurrentPlan = true;
      } else if (plan.id === 'vip' && (this.data.userType === 'vip' || this.data.userType === 'vip1')) {
        plan.isCurrentPlan = true;
      } else {
        plan.isCurrentPlan = false;
      }
      return plan;
    });
    
    this.setData({
      vipPlans: updatedPlans
    });
  },

  // 显示VIP升级模态框
  showVipUpgrade() {
    console.log('显示VIP升级模态框');
    
    // 更新VIP方案高亮状态
    this.updateVipPlanHighlight();
    
    this.setData({
      showVipModal: true
    });
  },

  // 隐藏VIP升级模态框
  hideVipUpgrade() {
    console.log('隐藏VIP升级模态框');
    this.setData({
      showVipModal: false
    });
  },

  // 购买VIP方案
  purchaseVipPlan(e) {
    const { planId } = e.currentTarget.dataset;
    const plan = this.data.vipPlans.find(p => p.id === planId);
    
    if (!plan) {
      wx.showToast({
        title: '方案不存在',
        icon: 'none'
      });
      return;
    }
    
    console.log('购买VIP方案:', plan.name);
    
    // 如果是当前方案，不需要购买
    if (plan.isCurrentPlan) {
      wx.showToast({
        title: '您已是该方案用户',
        icon: 'none'
      });
      return;
    }
    
    // 如果是普通用户方案，提示无需购买
    if (plan.id === 'normal') {
      wx.showToast({
        title: '无需购买普通方案',
        icon: 'none'
      });
      return;
    }
    
    // 显示购买确认
    wx.showModal({
      title: '确认购买',
      content: `确定要购买${plan.name}吗？\n费用：${plan.price}`,
      confirmText: '确认购买',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) {
          this.processPurchase(plan);
        }
      }
    });
  },

  // 处理购买流程
  processPurchase(plan) {
    console.log('处理购买流程:', plan);
    
    // 显示加载
    wx.showLoading({
      title: '处理中...',
      mask: true
    });
    
    // 模拟购买流程（实际项目中这里应该调用支付接口）
    setTimeout(() => {
      wx.hideLoading();
      
      // 模拟购买成功
      wx.showToast({
        title: '购买成功',
        icon: 'success',
        duration: 2000
      });
      
      // 更新用户类型
      this.setData({
        userType: plan.id,
        showVipModal: false
      });
      
      // 更新用户信息到云端（如果需要）
      this.updateUserVipStatus(plan.id);
      
    }, 2000);
  },

  // 更新用户VIP状态到云端
  updateUserVipStatus(vipType) {
    console.log('更新用户VIP状态:', vipType);
    
    // 检查用户是否已登录
    if (!this.data.hasUserInfo || !this.data.userInfo) {
      console.log('用户未登录，无法更新VIP状态');
      return;
    }
    
    // 检查云环境是否可用
    if (!wx.cloud) {
      console.log('云开发不可用，无法更新VIP状态');
      return;
    }
    
    // 调用云函数更新用户VIP状态
    wx.cloud.callFunction({
      name: 'updateUserInfo',
      data: {
        userInfo: {
          ...this.data.userInfo,
          userType: vipType,
          vipUpgradeDate: new Date().toISOString()
        }
      },
      success: res => {
        console.log('VIP状态更新成功:', res);
        
        // 更新本地用户信息
        const updatedUserInfo = {
          ...this.data.userInfo,
          userType: vipType,
          vipUpgradeDate: new Date().toISOString()
        };
        
        this.setData({
          userInfo: updatedUserInfo
        });
        
        // 更新全局用户信息
        const app = getApp();
        if (app.globalData.userInfo) {
          app.globalData.userInfo.userType = vipType;
          app.globalData.userInfo.vipUpgradeDate = new Date().toISOString();
        }
      },
      fail: err => {
        console.error('VIP状态更新失败:', err);
      }
    });
  },

  // 删除项目收藏
  deleteProjectFavorite(e) {
    const index = e.currentTarget.dataset.index;
    const projectFavorite = this.data.projectFavorites[index];
    
    if (!projectFavorite) {
      wx.showToast({
        title: '收藏数据不存在',
        icon: 'none'
      });
      return;
    }
    
    wx.showModal({
      title: '确认删除',
      content: `确定要取消收藏"${projectFavorite.name}"吗？`,
      confirmText: '删除',
      confirmColor: '#ff4757',
      success: (res) => {
        if (res.confirm) {
          try {
            const app = getApp();
            const currentParkId = app.globalData.currentParkId;
            const currentParkName = app.getParkNameById(currentParkId);
            
            // 从全局收藏数据中删除
            // 收藏数据是按照parkName存储的，不是parkId
            if (!app.globalData.favorites[currentParkName]) {
              app.globalData.favorites[currentParkName] = [];
            }
            
            app.globalData.favorites[currentParkName] = app.globalData.favorites[currentParkName].filter(
              item => item.id !== projectFavorite.id
            );
            
            // 保存到本地存储
            wx.setStorageSync('favorites', app.globalData.favorites);
            
            // 重新加载数据
            this.loadProjectFavorites();
            
            wx.showToast({
              title: '取消收藏成功',
              icon: 'success'
            });
            
            console.log('项目收藏删除成功:', projectFavorite.name);
            
          } catch (error) {
            console.error('删除项目收藏失败:', error);
            wx.showToast({
              title: '删除失败',
              icon: 'none'
            });
          }
        }
      }
    });
  },

  // 辅助方法：安全地获取用户ID显示
  getSafeUserId(userInfo) {
    try {
      if (userInfo && userInfo.openid && typeof userInfo.openid === 'string' && userInfo.openid.length >= 6) {
        return userInfo.openid.slice(-6);
      }
    } catch (error) {
      console.error('获取用户ID显示失败:', error);
    }
    return '未知';
  },

  // 格式化VIP有效期显示
  formatVipExpireDisplay(vipExpireDate, userType) {
    if (!vipExpireDate || userType === 'normal') {
      return '永久有效';
    }
    
    try {
      const expireDate = new Date(vipExpireDate);
      const now = new Date();
      
      // 检查日期是否有效
      if (isNaN(expireDate.getTime())) {
        return '永久有效';
      }
      
      // 检查是否过期
      if (expireDate <= now) {
        return '已过期';
      }
      
      // 格式化日期显示 (YYYY-MM-DD)
      const year = expireDate.getFullYear();
      const month = String(expireDate.getMonth() + 1).padStart(2, '0');
      const day = String(expireDate.getDate()).padStart(2, '0');
      
      return `${year}-${month}-${day}`;
    } catch (error) {
      console.error('格式化VIP有效期失败:', error);
      return '永久有效';
    }
  },

  // 显示支付弹窗
  showPaymentModal(e) {
    console.log('showPaymentModal 被调用');
    console.log('事件对象:', e);
    console.log('dataset:', e.currentTarget.dataset);
    
    const planId = e.currentTarget.dataset.plan;
    console.log('提取的planId:', planId);
    
    const selectedPlan = this.data.vipPlans.find(plan => plan.id === planId);
    console.log('找到的套餐:', selectedPlan);
    
    if (selectedPlan) {
      const paymentData = {
        showPaymentModal: true,
        selectedPlan: {
          id: selectedPlan.id,
          name: selectedPlan.name,
          price: selectedPlan.priceValue,
          priceValue: selectedPlan.priceValue, // 保留数字价格用于支付处理
          benefits: selectedPlan.benefits,
          // 添加升级相关的字段
          providedAssistantCount: selectedPlan.providedAssistantCount,
          providedPlanningCount: selectedPlan.providedPlanningCount,
          validityMonths: selectedPlan.validityMonths
        }
      };
      
      console.log('准备设置的数据:', paymentData);
      
      this.setData(paymentData);
      
      console.log('显示支付弹窗:', selectedPlan.name);
      console.log('当前showPaymentModal状态:', this.data.showPaymentModal);
    } else {
      console.error('未找到对应的VIP套餐，planId:', planId);
      console.log('所有可用套餐:', this.data.vipPlans.map(p => ({id: p.id, name: p.name})));
    }
  },

  // 隐藏支付弹窗
  hidePaymentModal() {
    this.setData({
      showPaymentModal: false,
      selectedPlan: {}
    });
    console.log('隐藏支付弹窗');
  },

  // 处理支付（模拟支付）
  processPayment() {
    console.log('processPayment 被调用');
    console.log('当前页面数据 showPaymentModal:', this.data.showPaymentModal);
    
    const { selectedPlan } = this.data;
    console.log('选中的套餐数据:', selectedPlan);
    
    if (!selectedPlan || !selectedPlan.id) {
      console.error('没有选中的套餐，无法处理支付');
      wx.showToast({
        title: '请选择套餐',
        icon: 'none'
      });
      return;
    }
    
    console.log('开始处理支付:', selectedPlan);
    
    // 显示支付中状态
    wx.showLoading({
      title: '支付中...',
      mask: true
    });
    
    // 模拟支付过程（2秒延迟）
    setTimeout(() => {
      wx.hideLoading();
      
      // 模拟支付成功
      this.handlePaymentSuccess(selectedPlan);
    }, 2000);
  },

  // 计算新的VIP有效期
  calculateNewExpireDate(currentExpireDate, addMonths) {
    try {
      console.log('计算VIP有效期 - 输入:', { currentExpireDate, addMonths });
      
      const currentDate = new Date();
      console.log('当前日期:', currentDate.toISOString());
      
      // 安全地创建当前有效期日期对象
      let baseDate;
      if (!currentExpireDate || currentExpireDate === '2000-01-01') {
        // 如果没有有效期或是默认值，从今天开始计算
        baseDate = new Date(currentDate);
        console.log('使用当前日期作为基准:', baseDate.toISOString());
      } else {
        const currentExpire = new Date(currentExpireDate);
        console.log('解析有效期日期:', currentExpire.toISOString());
        
        // 检查日期是否有效
        if (isNaN(currentExpire.getTime())) {
          console.warn('无效的有效期日期:', currentExpireDate, '使用当前日期');
          baseDate = new Date(currentDate);
        } else {
          // 如果当前有效期早于今天，从今天开始计算
          baseDate = currentExpire > currentDate ? new Date(currentExpire) : new Date(currentDate);
          console.log('选择的基准日期:', baseDate.toISOString());
        }
      }
      
      // 使用更安全的方法添加月数
      const year = baseDate.getFullYear();
      const month = baseDate.getMonth();
      const day = baseDate.getDate();
      
      console.log('基准日期组件:', { year, month, day });
      
      // 计算新的年月
      const newYear = year + Math.floor((month + addMonths) / 12);
      const newMonth = (month + addMonths) % 12;
      
      console.log('计算后的年月:', { newYear, newMonth });
      
      // 创建新日期，处理月末日期的边界情况
      const newExpireDate = new Date(newYear, newMonth, 1); // 先设置为月初
      const lastDayOfNewMonth = new Date(newYear, newMonth + 1, 0).getDate(); // 获取新月份的最后一天
      const finalDay = Math.min(day, lastDayOfNewMonth); // 避免日期溢出
      newExpireDate.setDate(finalDay);
      
      console.log('最终计算的日期:', newExpireDate.toISOString());
      
      // 检查结果日期是否有效
      if (isNaN(newExpireDate.getTime())) {
        console.error('计算出的日期无效，使用简单的天数加法');
        const simpleFallback = new Date(currentDate);
        simpleFallback.setDate(simpleFallback.getDate() + (addMonths * 30)); // 简单的30天 * 月数
        return simpleFallback.toISOString().split('T')[0];
      }
      
      // 返回格式化的日期字符串
      const result = newExpireDate.toISOString().split('T')[0];
      console.log('返回的日期字符串:', result);
      return result;
      
    } catch (error) {
      console.error('计算VIP有效期失败:', error);
      console.error('错误堆栈:', error.stack);
      
      // 最简单的fallback：当前日期 + 天数
      try {
        const simpleFallback = new Date();
        simpleFallback.setDate(simpleFallback.getDate() + (addMonths * 30));
        const fallbackResult = simpleFallback.toISOString().split('T')[0];
        console.log('使用简单fallback:', fallbackResult);
        return fallbackResult;
      } catch (fallbackError) {
        console.error('连fallback都失败了:', fallbackError);
        // 返回固定的未来日期
        return '2025-12-31';
      }
    }
  },

  // 处理支付成功
  handlePaymentSuccess(plan) {
    console.log('支付成功:', plan);
    
    const currentUserType = this.data.userType;
    const currentAssistantCount = this.data.assistantCount;
    const currentPlanningCount = this.data.planningCount;
    const currentExpireDate = this.data.vipExpireDate;
    
    // 根据升级规则计算新的用户状态
    let newUserType = currentUserType;
    let newAssistantCount = currentAssistantCount + plan.providedAssistantCount;
    let newPlanningCount = currentPlanningCount + plan.providedPlanningCount;
    let newExpireDate = this.calculateNewExpireDate(currentExpireDate, plan.validityMonths);
    
    // 如果当前是普通用户，升级到对应的VIP等级
    if (currentUserType === 'normal') {
      newUserType = plan.id;
    }
    // 如果已经是VIP用户，等级不变，只累加次数和延长有效期
    
    console.log('升级计算结果:', {
      从: { userType: currentUserType, assistantCount: currentAssistantCount, planningCount: currentPlanningCount, expireDate: currentExpireDate },
      到: { userType: newUserType, assistantCount: newAssistantCount, planningCount: newPlanningCount, expireDate: newExpireDate }
    });
    
    // 调用云函数更新用户信息
    this.updateUserVipStatus({
      userType: newUserType,
      assistantCount: newAssistantCount,
      planningCount: newPlanningCount,
      vipExpireDate: newExpireDate,
      plan: plan
    });
  },

  // 更新用户VIP状态到云端
  updateUserVipStatus(upgradeData) {
    console.log('开始更新云端VIP状态:', upgradeData);
    
    wx.showLoading({
      title: '更新中...',
      mask: true
    });
    
    wx.cloud.callFunction({
      name: 'updateUserInfo',
      data: {
        action: 'upgradeVip',
        openid: this.data.userInfo.openid,
        upgradeData: upgradeData
      },
      success: (res) => {
        wx.hideLoading();
        console.log('云端VIP状态更新成功:', res);
        
        if (res.result && res.result.success) {
          // 更新本地数据
          this.setData({
            userType: upgradeData.userType,
            assistantCount: upgradeData.assistantCount,
            planningCount: upgradeData.planningCount,
            vipExpireDate: upgradeData.vipExpireDate,
            vipExpireDisplay: this.formatVipExpireDisplay(upgradeData.vipExpireDate, upgradeData.userType),
            showPaymentModal: false,
            selectedPlan: {},
            userIdDisplay: this.getSafeUserId(this.data.userInfo)
          });
          
          // 更新本地存储
          try {
            wx.setStorageSync('userType', upgradeData.userType);
            wx.setStorageSync('assistantCount', upgradeData.assistantCount);
            wx.setStorageSync('planningCount', upgradeData.planningCount);
            wx.setStorageSync('vipExpireDate', upgradeData.vipExpireDate);
            // 设置VIP升级时间戳，用于避免立即同步覆盖
            wx.setStorageSync('lastVipUpgradeTime', Date.now());
            
            // 使用统一的用户状态管理清除缓存，确保其他页面能获取到最新数据
            userService.clearUserStatusCache();
            console.log('VIP升级信息已保存到本地，并清除了缓存');
          } catch (error) {
            console.error('保存VIP升级信息失败:', error);
          }
          
          // 显示成功提示
          wx.showToast({
            title: `升级${upgradeData.plan.name}成功！`,
            icon: 'success',
            duration: 3000
          });
          
          // 延迟强制同步一次，确保数据一致性
          setTimeout(() => {
            console.log('VIP升级后强制同步数据');
            // 清除保护时间戳，允许同步
            wx.removeStorageSync('lastVipUpgradeTime');
            this.syncCloudData();
          }, 5000);
          
        } else {
          console.error('云端VIP状态更新失败:', res.result);
          wx.showToast({
            title: '升级失败，请重试',
            icon: 'none',
            duration: 2000
          });
        }
      },
      fail: (error) => {
        wx.hideLoading();
        console.error('云函数调用失败:', error);
        wx.showToast({
          title: '网络错误，请重试',
          icon: 'none',
          duration: 2000
        });
      }
    });
  },
  
  /**
   * 更新AI助手开关状态（后台逻辑，无用户界面）
   */
  updateAiAssistantStatus() {
    const app = getApp();
    const aiAssistantEnabled = app.getAiAssistantEnabled();
    
    this.setData({
      aiAssistantEnabled: aiAssistantEnabled
    });
    
    console.log('Profile页面AI助手状态更新（后台）:', aiAssistantEnabled);
  },

  // 分享给好友
  onShareAppMessage() {
    return {
      title: '环球影城小助手 - 让游玩更精彩',
      path: '/pages/map/map',
      imageUrl: '/images/xiaoxiaolu_default_touxiang.jpg'
    };
  },

  // 分享到朋友圈
  onShareTimeline() {
    return {
      title: '环球影城小助手 - 让游玩更精彩',
      query: 'from=timeline',
      imageUrl: '/images/xiaoxiaolu_default_touxiang.jpg'
    };
  }
});