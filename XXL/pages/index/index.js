// index.js
const defaultAvatarUrl = 'https://mmbiz.qpic.cn/mmbiz/icTdbqWNOwNRna42FI242Lcia07jQodd2FJGIYQfG0LAJGFxM4FbnQP6yfMxBgJ0F3YRqJCJ1aPAK2dQagdusBZg/0'
const app = getApp();
const cozeApi = require('../../utils/cozeApi');
const userService = require('../../utils/userService');

Page({
  data: {
    motto: 'Hello World',
    userInfo: {},
    hasUserInfo: false,
    canIUseGetUserProfile: wx.canIUse('getUserProfile'),
    canIUseNicknameComp: wx.canIUse('input.type.nickname'),
    messages: [], // 对话记录
    inputValue: '', // 用户输入内容
    tagStyle: {
      img: 'max-width: 100%; height: auto; border-radius: 8px; margin: 8px 0; display: block;',
      div: 'margin-bottom: 8px;',
      p: 'margin-bottom: 8px;',
      strong: 'font-weight: bold;',
      a: 'color: #07C160; text-decoration: none;',
      button: 'cursor: pointer; -webkit-tap-highlight-color: rgba(0,0,0,0.1); transition: background-color 0.2s; -webkit-user-select: none; user-select: none;'
    },
    screenHeight: 0,
    windowWidth: 0,
    currentTime: '', // 当前时间
    timeUpdateTimer: null, // 时间更新计时器
    currentPark: '',
    currentParkIndex: 0,
    parks: [], // 游乐场列表
    showParkPicker: false, // 是否显示游乐场选择器
    currentParkId: '',
    currentParkName: ''
  },

  // 获取游乐场列表
  getParksList() {
    const app = getApp();
    return app.getAvailableParks();
  },
  
  // 切换游乐场
  changePark(e) {
    const index = e.detail.value;
    const parkId = this.data.parks[index].id;
    
    // 如果选择的是当前游乐场，不做操作
    if (parkId === this.data.currentParkId) {
      return;
    }
    
    // 使用app的switchPark方法切换游乐场
    app.switchPark(parkId);
  },
  
  // 切换游乐场选择器显示状态
  toggleParkPicker() {
    this.setData({
      showParkPicker: !this.data.showParkPicker
    });
  },

  onLoad() {
    // 保存页面实例到全局变量
    app.globalData.indexPage = this;
    
    // 监听来自其他页面的搜索请求
    app.globalEvents.on('newSearch', this.handleExternalSearch.bind(this));
    
    try {
      cozeApi.createConversation().then(conversationId => {
      }).catch(error => {
      });
    } catch (error) {
      console.error('创建会话时发生错误:', error);
    }
    
    // 设置点击样式
    this.setData({
      tagStyle: {
        img: 'max-width: 100%; height: auto; border-radius: 8px; margin: 8px 0; display: block;',
        div: 'margin-bottom: 8px;',
        p: 'margin-bottom: 8px;',
        strong: 'font-weight: bold;',
        a: 'color: #07C160; text-decoration: none;',
        button: 'cursor: pointer; -webkit-tap-highlight-color: rgba(0,0,0,0.1); transition: background-color 0.2s; -webkit-user-select: none; user-select: none;'
      }
    });
    
    // 获取用户信息，优先使用全局信息
    let userInfo;
    if (app.globalData.userInfo) {
      userInfo = app.globalData.userInfo;
    } else {
      // 从缓存获取或使用默认值
      userInfo = wx.getStorageSync('userInfo') || app.globalData.defaultUserInfo || {
        avatarUrl: '/images/xiaoxiaolu_default_touxiang.jpg',
        nickName: '小小鹿momo'
      };
    }
    
    // 获取游乐场列表
    const parks = this.getParksList();
    
    // 设置当前游乐场和索引
    const currentParkId = app.globalData.currentParkId;
    const currentPark = app.getParkNameById(currentParkId);
    const currentParkIndex = parks.findIndex(park => park.id === currentParkId);
    
    // 正确设置登录状态
    const hasUserInfo = app.globalData.hasUserInfo || false;
    
    this.setData({
      userInfo: userInfo,
      hasUserInfo: hasUserInfo,
      parks: parks,
      currentPark: currentPark,
      currentParkId: currentParkId,
      currentParkIndex: currentParkIndex >= 0 ? currentParkIndex : 0
    });
    
    // 注册用户信息更新监听
    app.registerUserInfoUpdateListener(this.handleUserInfoUpdate.bind(this));

    // 等待配置加载完成后显示欢迎消息
    app.waitForConfig().then(() => {
      this.showWelcomeMessage(currentParkId);
    });

    // 获取系统信息
    wx.getSystemInfo({
      success: (res) => {
        this.setData({
          screenHeight: res.windowHeight,
          windowWidth: res.windowWidth
        });
      }
    });

    // 元素查询应该在渲染完成后执行，并添加错误处理
    // 将查询元素的逻辑放到 setTimeout 中，确保界面已经渲染
    setTimeout(() => {
      const query = wx.createSelectorQuery();
      query.select('.message.user .message-content').boundingClientRect();
      query.select('.message.user .user-avatar').boundingClientRect();
      query.exec((res) => {
        // 检查查询结果是否有效
        if (res && res[0] && res[1]) {
          const messageContentRect = res[0];
          const userAvatarRect = res[1];
          
          // 计算间隔
          const gap = userAvatarRect.left - (messageContentRect.left + messageContentRect.width);
          
          // 打印间隔日志
          console.log('用户消息气泡和头像之间的间隔:', gap, 'px');
        } else {
          console.log('无法查询元素信息，可能界面尚未完全渲染');
        }
      });
    }, 500);

    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({
        selected: 0
      })
    }
    
    // 初始化并启动时间更新
    this.updateCurrentTime();
    this.startTimeUpdate();

    // 监听游乐场切换事件
    app.globalEvents.on('parkChanged', this.handleParkChange.bind(this));
  },
  onShow() {
    try {
      // 设置tabBar选中状态
      if (typeof this.getTabBar === 'function' && this.getTabBar()) {
        this.getTabBar().setSelected('pages/index/index');
      }
      
      // 页面显示时清除用户状态缓存，确保获取最新数据
      // 这样可以解决用户充值后缓存不更新的问题
      userService.clearUserStatusCache();
      console.log('页面显示时已清除用户状态缓存，确保获取最新数据');
      
      // 检查AI助手是否启用
      if (!app.getAiAssistantEnabled()) {
        wx.showModal({
          title: '功能提示',
          content: '该功能正在开发中，敬请期待！',
          showCancel: false,
          confirmText: '我知道了',
          success: () => {
            // 跳转到其他页面，比如地图页面
            wx.switchTab({
              url: '/pages/map/map'
            });
          }
        });
        return;
      }
      
      // 检查 app 实例和 globalData 是否存在
      if (!app || !app.globalData) {
        console.error('app实例或globalData不存在，尝试重新获取');
        const appInstance = getApp();
        if (!appInstance || !appInstance.globalData) {
          console.error('无法获取app实例或globalData，跳过onShow处理');
          return;
        }
      }
      
      // 确保app.globalData.userInfo存在并包含必要字段
      if (!app.globalData.userInfo) {
        console.warn('app.globalData.userInfo不存在，使用默认用户信息');
        app.globalData.userInfo = app.globalData.defaultUserInfo || {
          avatarUrl: '/images/xiaoxiaolu_default_touxiang.jpg',
          nickName: '小小鹿momo',
          openid: 'default_user',
          _id: 'default_user',
          userType: 'guest',
          isDefaultUser: true
        };
      } else if (!app.globalData.userInfo.nickName) {
        // 确保用户信息中有昵称
        console.warn('app.globalData.userInfo中没有昵称，添加默认昵称');
        app.globalData.userInfo.nickName = '小小鹿momo';
      }
      
      // 记录上一次登录状态，用于检测登录状态变化
      const lastLoginState = this.data.hasUserInfo;
      const currentLoginState = app.globalData.hasUserInfo;
      
      // 检测登录状态变化
      if (lastLoginState !== currentLoginState) {
        console.log('登录状态变化，从', lastLoginState, '变为', currentLoginState);
        
        // 直接使用 app.globalData.userInfo
        // 如果是退出登录，app.clearLoginInfo()已经将userInfo设置为默认值
        // 如果是登录，则userInfo是真实的用户信息
        const userInfo = app.globalData.userInfo;
        
        // 保险措施：确保必要的字段存在
        if (!userInfo.avatarUrl) {
          userInfo.avatarUrl = '/images/xiaoxiaolu_default_touxiang.jpg';
        }
        if (!userInfo.nickName) {
          userInfo.nickName = '小小鹿momo';
        }
        
        // 更新本地登录状态
        this.setData({
          hasUserInfo: currentLoginState,
          userInfo: userInfo
        });
        
        // 如果退出登录，清空聊天记录并显示欢迎消息
        if (!currentLoginState) {
          console.log('检测到退出登录，清空聊天记录');
          this.setData({
            messages: []
          }, () => {
            // 等待配置加载完成后显示欢迎消息
            app.waitForConfig().then(() => {
              this.showWelcomeMessage(this.data.currentParkId);
            });
          });
        }
      }
      
      // 检查是否有从地图页面传来的查询
      if (app.globalData.lastQuery) {
        if (app.globalData.needSendMessage) {
          const query = app.globalData.lastQuery;
          // 清空全局查询缓存，避免重复查询
          app.globalData.lastQuery = null;
          app.globalData.needSendMessage = false;
          
          // 设置输入值并立即发送消息
          this.setData({
            inputValue: query
          }, () => {
            // 确保在 setData 回调中发送消息
            this.sendMessage();
          });
        } else {
          // 只有lastQuery但没有needSendMessage标记的情况
          // 这种情况下只显示在输入框中，不自动发送
          const query = app.globalData.lastQuery;
          app.globalData.lastQuery = null;
          
          this.setData({
            inputValue: query
          });
        }
      }
      
      // 更新TabBar选中状态
      if (typeof this.getTabBar === 'function' && this.getTabBar()) {
        this.getTabBar().setData({
          selected: 0
        });
      }
      
      // 重新启动时间更新
      this.startTimeUpdate();
    } catch (error) {
      console.error('onShow 函数执行出错:', error);
    }
  },
  onHide() {
    // 页面隐藏时停止时间更新
    this.stopTimeUpdate();
  },
  onUnload() {
    console.log('index onUnload');
    this.stopTimeUpdate();
    // 注销游乐场切换事件监听
    app.globalEvents.off('parkChanged', this.handleParkChange);
    // 注销搜索请求监听
    app.globalEvents.off('newSearch', this.handleExternalSearch);
    // 清除用户信息更新回调
    app.registerUserInfoUpdateListener(null);
  },
  // 添加聊天消息
  addMessage(role, content, type = 'text', navData = null, suggestedQueries = null, responseTime = null) {
    const { messages } = this.data;
    
    try {
      // 获取当前最新的用户信息，确保每次添加消息都使用最新数据
      let userInfo;
      
      // 检查 app 和 app.globalData 是否存在（极端情况处理）
      if (!app || !app.globalData) {
        console.warn('app 实例或 globalData 不存在，使用默认用户信息');
        // 使用完整的默认用户信息结构
        userInfo = {
          avatarUrl: '/images/xiaoxiaolu_default_touxiang.jpg',
          nickName: '小小鹿momo',
          openid: 'default_user',
          _id: 'default_user',
          userType: 'guest',
          isDefaultUser: true
        };
      } else {
        // 正常情况下，直接使用 app.globalData.userInfo
        // app.js 已经确保了它至少是默认用户信息
        userInfo = app.globalData.userInfo;
      }
      
      // 保险措施：确保用户信息中有昵称
      if (!userInfo.nickName) {
        console.warn('用户信息中没有昵称，使用默认昵称');
        userInfo.nickName = '小小鹿momo';
      }
      
      // 保险措施：确保用户信息中有头像
      if (!userInfo.avatarUrl) {
        console.warn('用户信息中没有头像，使用默认头像');
        userInfo.avatarUrl = '/images/xiaoxiaolu_default_touxiang.jpg';
      }
      
      // 确保suggestedQueries是数组类型
      if (suggestedQueries && !Array.isArray(suggestedQueries)) {
        console.warn('suggestedQueries不是数组，强制转换为数组');
        if (typeof suggestedQueries === 'string') {
          suggestedQueries = [suggestedQueries];
        } else {
          suggestedQueries = [];
        }
      }
      
      // 创建消息对象
      const message = { 
        id: Date.now(), // 使用时间戳作为消息ID，确保唯一性
        role,
        content,
        avatarUrl: role === 'user' ? userInfo.avatarUrl : '/images/assistant_avatar.png',
        nickName: role === 'user' ? userInfo.nickName : '助手',
        type,
        navData,
        suggestedQueries,
        // 只在非初始消息和非loading消息时显示响应时间
        timestamp: (role === 'assistant' && type !== 'welcome' && type !== 'loading' && responseTime) ? responseTime + '秒' : null
      };
      
      // 设置欢迎消息的标记
      if (type === 'welcome') {
        message.isWelcome = true;
      }
      
      // 设置加载状态的样式
      if (type === 'loading') {
        message.isLoading = true;
      }
      
      console.log('添加消息:', message); // 添加日志
      
      // 添加消息到数组
      this.setData({
        messages: [...messages, message],
        inputValue: '' // 清空输入框
      }, () => {
        // 使用更可靠的延迟滚动方法
        setTimeout(() => {
          this.scrollToBottom();
          
          // 如果是欢迎消息，额外检查渲染
          if (type === 'welcome') {
            setTimeout(() => {
              console.log('检查欢迎消息渲染完成');
              const query = wx.createSelectorQuery();
              query.selectAll('.welcome-query-item').boundingClientRect();
              query.exec(res => {
                if (res && res[0] && res[0].length > 0) {
                  console.log('欢迎消息查询项已渲染，数量:', res[0].length);
                } else {
                  console.warn('未找到欢迎消息查询项元素');
                }
              });
            }, 300);
          }
        }, 150);
      });
      
      return message.id; // 返回消息ID，便于后续操作
    } catch (error) {
      console.error('addMessage 函数执行出错:', error);
      return null;
    }
  },
  scrollToBottom() {
    // 确保有消息
    if (this.data.messages.length === 0) return;
    
    // 获取最后一条消息的ID
    const lastMessageId = `msg-${this.data.messages.length - 1}`;
    
    // 延迟设置scrollIntoView，确保UI已更新
    setTimeout(() => {
      this.setData({
        scrollIntoView: lastMessageId
      });
    }, 100);
  },
  // 输入框内容变化时触发
  onInput(e) {
    this.setData({
      inputValue: e.detail.value
    });
  },
  // 发送消息
  async sendMessage(callback = null) {
    const message = this.data.inputValue;
    if (!message.trim()) {
      wx.showToast({
        title: '请输入内容',
        icon: 'none'
      });
      return;
    }

    // 立即添加用户消息到对话记录，提升响应速度
    this.addMessage('user', message);
    
    // 立即清空输入框，让用户感觉响应很快
    this.setData({
      inputValue: ''
    });
    
    // 异步检查用户智能助手次数，不阻塞UI
    const checkPermissionPromise = this.checkAssistantPermission().catch(error => {
      console.error('检查智能助手权限失败:', error);
      return false;
    });

    // 添加加载状态消息
    const loadingMsgId = this.addMessage('assistant', 'AI助手整理信息中(预计30-60秒)...', 'loading');
    
    // 等待权限检查结果
    try {
      const hasPermission = await checkPermissionPromise;
      if (!hasPermission) {
        // 删除加载消息
        this.removeMessage(loadingMsgId);
        return;
      }
    } catch (error) {
      console.error('权限检查异常:', error);
      this.removeMessage(loadingMsgId);
      wx.showToast({
        title: '检查权限失败，请稍后重试',
        icon: 'none'
      });
      return;
    }
    
    // 调用 Coze API，直接使用返回的解析结果
    this.callCozeAPI(message).then(async response => {
      
      // 删除加载状态消息
      this.removeMessage(loadingMsgId);
      
      // API调用成功，扣减智能助手次数
      try {
        await this.deductAssistantCount();
      } catch (error) {
        console.error('扣减智能助手次数失败:', error);
        // 即使扣减失败，也不影响用户体验，只记录日志
      }
      
      // 如果有回调函数，则调用它
      if (callback && typeof callback === 'function') {
        callback(response);
      }
    }).catch(error => {
      // 出错时也删除加载状态消息，并显示错误
      this.removeMessage(loadingMsgId);
      this.addMessage('assistant', '查询失败，请稍后再试。', 'text');
      console.error('调用API出错:', error);
    });
  },
  // 调用 Coze API
  async callCozeAPI(message) {
    try {
      // 记录开始时间
      const startTime = Date.now();
      
      const finalResponse = await cozeApi.callApi(message);
      
      // 计算响应时间（秒）
      const endTime = Date.now();
      const responseTime = ((endTime - startTime) / 1000).toFixed(1);
      
      // 先检查整个回复是否为JSON格式
      if (this.isJSON(finalResponse)) {
        const jsonResponse = JSON.parse(finalResponse);
        console.info('完整JSON解析结果:', jsonResponse);
        // 使用 parseResponse 解析 item_list，并传递响应时间
        return this.parseResponse(jsonResponse, responseTime);
      } else {
        // 如果不是完整的JSON，尝试从字符串中提取JSON
        const jsonResponse = this.extractJSON(finalResponse);
        if (jsonResponse) {
          console.info('从字符串提取的JSON:', jsonResponse);
          // 使用 parseResponse 解析 item_list，并传递响应时间
          return this.parseResponse(jsonResponse, responseTime);
        } else {
          // 如果无法解析为JSON，直接显示原始内容
          console.info('无法解析为JSON，显示原始内容:', finalResponse);
          return this.parseResponse(finalResponse, responseTime);
        }
      }
    } catch (error) {
      console.error('调用 Coze API 失败:', error);
      return this.parseResponse(error.message || '请求失败，请稍后再试。');
    }
  },
  // 检查字符串是否为JSON格式
  isJSON(str) {
    if (typeof str !== 'string') return false;
    try {
      const result = JSON.parse(str);
      const type = Object.prototype.toString.call(result);
      return type === '[object Object]' || type === '[object Array]';
    } catch (e) {
      return false;
    }
  },

  // 从字符串中提取JSON
  extractJSON(str) {
    try {
      const matches = str.match(/\{[\s\S]*\}/); // 匹配最外层的花括号及其内容
      if (matches) {
        const jsonStr = matches[0];
        return JSON.parse(jsonStr);
      }
      return null;
    } catch (e) {
      console.error('JSON提取失败:', e);
      return null;
    }
  },

  // 解析 response 中的 item_list
  parseResponse(response, responseTime) {
    try {
      const data = response;
      let htmlContent = '';
      let itemIndex = 1;
      let imageUrls = []; // 收集所有图片URL
      let suggestedQueries = []; // 收集推荐的查询
      
      // 检查是否是规划数据
      if (data && data.type === 'route') {
        // 检查数据是否为空
        if (data.code === 0 && data.message === 'success' && (!data.data || (Array.isArray(data.data) && data.data.length === 0))) {
          // 数据为空，说明一天无法玩完
          htmlContent = `<div class="assistant-message" style="color: #ff6b6b; padding: 10px; background: #fff2f2; border-radius: 8px; margin: 10px 0;">
            <p style="margin: 0; font-weight: bold;">⚠️ 规划提示</p>
            <p style="margin: 5px 0 0 0;">根据您选择的项目，一天时间无法全部游玩完毕。建议您减少项目数量或安排多天游玩。</p>
          </div>`;
          
          // 添加消息，并包含响应时间
          this.addMessage('assistant', htmlContent, 'html', null, null, responseTime);
          return {
            type: 'route',
            plans: []
          };
        }
        
        // 保存规划数据到全局
        const app = getApp();
        app.globalData.routePlan = data;
        
        // 显示规划链接
        htmlContent = `<div class="plan-link">
          <a href="javascript:;" data-type="plan" style="color: #07C160; text-decoration: none; font-weight: bold;">点我看规划</a>
        </div>`;
        
        // 添加消息，并包含响应时间
        this.addMessage('assistant', htmlContent, 'html', null, null, responseTime);
        return {
          type: 'route',
          plans: data || []
        };
      }
      
      // 处理新的JSON格式
      if (data && (data.item_list || data.txt_info || data.tips_info || data.recommend_queries)) {
        
        // 1. 处理 txt_info - 如果有值，展示在最前面
        if (data.txt_info && data.txt_info.trim()) {
          htmlContent += `
            <div style="margin-bottom: 12px; padding: 8px; background: #f8f9fa; border-radius: 8px; font-size: 14px;">
              ${data.txt_info}
            </div>
          `;
        }
        
        // 2. 处理 item_list - 直接处理数组格式
        if (data.item_list && Array.isArray(data.item_list)) {
          data.item_list.forEach((item) => {
            if (!item) return;
            
            if (item.type === "1" || item.type === "3") {
              if (item.text) {
                const nameMatch = item.text.match(/<b>(.*?)<\/b>/);
                const name = nameMatch ? nameMatch[1] : item.id;
                const restText = item.text
                  .replace(/<div style='([^']*)'/, (match, style) => {
                    const newStyle = style
                      .replace(/padding:[^;"]*;?/g, '')
                      .replace(/background:[^;"]*;?/g, '')
                      .replace(/background-color:[^;"]*;?/g, '')
                      .trim();
                    return newStyle ? `<div style='${newStyle}'` : '<div';
                  })
                  .replace(/\n/g, '<br/>');
                
                // 生成项目HTML，移除定位和导航按钮
                let itemHtml = `
                  <div style="display: flex; align-items: center; margin-bottom: 2px; justify-content: space-between;">
                    <div style="font-size: 16px; font-weight: bold; white-space: nowrap;">${itemIndex}. ${name}</div>
                  </div>
                  <div style="background:#C3DFFD; padding:8px; border-radius:8px; margin-bottom: 8px; font-size: 14px; box-shadow: 0 2px 4px rgba(87,107,149,0.3);">
                    ${restText}
                    ${item.image ? this.generateImageHtml(item.id, imageUrls.length) : ''}
                  </div>
                `;
                
                htmlContent += itemHtml;
                itemIndex++;
              }
            } else if (item.type === "2") {
              htmlContent += `
                <div style="color: #666; margin-bottom: 8px; font-size: 14px;">${item.text}</div>
              `;
            } else if (item.type === "4") {
              htmlContent += `
                <div style="margin-bottom: 4px; font-size: 14px;">
                  ${item.text}
                </div>
              `;
            }
          });
        }
        
        // 3. 处理 tips_info - 替换原来的"其他信息"
        if (data.tips_info && data.tips_info.text) {
          htmlContent += `
            <div style="margin-top: 12px; margin-bottom: 8px;">
              ${data.tips_info.text}
            </div>
          `;
        }

        // 4. 处理推荐查询 - 支持新格式
        if (data.recommend_queries && Array.isArray(data.recommend_queries)) {
          data.recommend_queries.forEach(queryItem => {
            if (queryItem && queryItem.type === "5" && queryItem.text) {
              const queries = queryItem.text.split('#').filter(q => q.trim() !== '');
              suggestedQueries = [...suggestedQueries, ...queries];
            }
          });
        }
        
        // 添加消息到聊天记录
        console.log('生成的HTML内容:', htmlContent);
        this.addMessage('assistant', htmlContent, 'html', null, suggestedQueries.length > 0 ? suggestedQueries : null, responseTime);
        
        return {
          html: htmlContent,
          suggestedQueries
        };
      }
      
      // 兼容旧格式 - 检查是否存在旧的 item_list 格式
      else if (data && data.item_list) {
        // 处理旧的嵌套 JSON 格式的 item_list
        if (Array.isArray(data.item_list)) {
          data.item_list.forEach((itemGroup) => {
            if (itemGroup && itemGroup.item && Array.isArray(itemGroup.item)) {
              itemGroup.item.forEach((item) => {
                if (!item) return;
                
                if (item.type === "1" || item.type === "3") {
                  if (item.text) {
                    const nameMatch = item.text.match(/<b>(.*?)<\/b>/);
                    const name = nameMatch ? nameMatch[1] : item.id;
                    const restText = item.text
                      .replace(/<div style='([^']*)'/, (match, style) => {
                        const newStyle = style
                          .replace(/padding:[^;"]*;?/g, '')
                          .replace(/background:[^;"]*;?/g, '')
                          .replace(/background-color:[^;"]*;?/g, '')
                          .trim();
                        return newStyle ? `<div style='${newStyle}'` : '<div';
                      })
                      .replace(/\n/g, '<br/>');
                    
                    // 生成项目HTML，移除定位和导航按钮
                    let itemHtml = `
                      <div style="display: flex; align-items: center; margin-bottom: 2px; justify-content: space-between;">
                        <div style="font-size: 16px; font-weight: bold; white-space: nowrap;">${itemIndex}. ${name}</div>
                      </div>
                      <div style="background:#C3DFFD; padding:8px; border-radius:8px; margin-bottom: 8px; font-size: 14px; box-shadow: 0 2px 4px rgba(87,107,149,0.3);">
                        ${restText}
                        ${item.image ? this.generateImageHtml(item.id, imageUrls.length) : ''}
                      </div>
                    `;
                    
                    htmlContent += itemHtml;
                    itemIndex++;
                  }
                } else if (item.type === "2") {
                  htmlContent += `
                    <div style="color: #666; margin-bottom: 8px; font-size: 14px;">${item.text}</div>
                  `;
                } else if (item.type === "4") {
                  htmlContent += `
                    <div style="margin-bottom: 4px; font-size: 14px;">
                      ${item.text}
                    </div>
                  `;
                }
              });
            }
          });
        }

        // 检查是否有推荐的查询（旧格式）
        if (data.recommend_queries && Array.isArray(data.recommend_queries)) {
          data.recommend_queries.forEach(queryGroup => {
            if (queryGroup && queryGroup.querys && Array.isArray(queryGroup.querys)) {
              queryGroup.querys.forEach(query => {
                if (query && query.type === "5" && query.text) {
                  const queries = query.text.split('#').filter(q => q.trim() !== '');
                  suggestedQueries = [...suggestedQueries, ...queries];
                }
              });
            }
          });
        }
        
        // 只有当有推荐查询时才添加到消息中
        if (suggestedQueries.length > 0) {
          console.log('生成的HTML内容:', htmlContent);
          this.addMessage('assistant', htmlContent, 'html', null, suggestedQueries, responseTime);
        } else {
          console.log('生成的HTML内容:', htmlContent);
          this.addMessage('assistant', htmlContent, 'html', null, null, responseTime);
        }
        
        return {
          html: htmlContent,
          suggestedQueries
        };
      } else if (typeof data === 'string') {
        // 如果是普通字符串，直接显示
        this.addMessage('assistant', data, 'text', null, null, responseTime);
        return {
          text: data
        };
      } else {
        console.log('Response 中没有找到 item_list，完整响应:', data);
        // 如果不是规划数据，直接显示原始内容
        this.addMessage('assistant', JSON.stringify(data), 'text',null, null, responseTime);
      }
      return {
        type: 'text',
        content: data
      };
    } catch (error) {
      console.error('解析 response 时出错:', error);
      this.addMessage('assistant', '解析响应时出错', 'text',null, null, responseTime);
      return {
        type: 'text',
        content: error.message || '解析响应时出错'
      };
    }
  },

  // 生成图片 HTML 的辅助函数
  generateImageHtml(id, index) {
    return `
      <div style="text-align: center; position: relative; margin-top: 8px;">
        <img src="http://39.105.175.239:8070/images/${id}.jpg" 
             style="width: 70%; height: auto; border-radius: 8px;"
             data-type="image"
             data-url="http://39.105.175.239:8070/images/${id}.jpg"
             data-index="${index}"/>
        <view style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); 
                   background: rgba(0,0,0,0.5); color: white; padding: 4px 8px; border-radius: 4px; 
                   font-size: 12px; display: none;" class="image-loading">加载中...</view>
      </div>
    `;
  },

  // 测试新JSON格式的调试方法
  testNewJsonFormat() {
    const testData = {
      "txt_info": "这是一个测试的txt_info内容，应该显示在最前面。",
      "item_list": [
        {
          "type": "3",
          "id": "神偷奶爸小黄人闹翻天",
          "pos": "116.68426401624345,39.85407100464949",
          "text": "<div style='background:#f0f8ff;padding:16px;border-radius:8px;border-left:4px solid #1e90ff'>适合身高 102cm 以上儿童体验，当前排队 10 分钟，需由成人陪同乘坐。位于小黄人乐园区，乘坐前请确认孩子身高。</div>"
        },
        {
          "type": "3",
          "id": "萌转过山车",
          "pos": "116.68404301623862,39.8546790046534",
          "text": "<div style='background:#fff0f5;padding:16px;border-radius:8px;border-left:4px solid #ff69b4'>92-122cm 儿童需成人陪同，当前排队 5 分钟。温馨提醒：过山车有轻微颠簸，请评估孩子承受能力。</div>"
        }
      ],
      "tips_info": {
        "type": "2",
        "text": "<div style='background:#f5f5f5;padding:16px;border-radius:8px;border-left:4px solid #808080'>🔔 温馨提示：1. 游玩时请随身携带儿童身高证明 2. \"变形金刚：火种源争夺战\" 当日 18:30 前维护 3. 建议优先体验小黄人区项目，该区域儿童设施集中</div>"
      },
      "recommend_queries": [
        {
          "type": "5",
          "text": "适合低龄儿童的演出推荐#亲子餐厅位置查询#雨天适合玩什么项目"
        }
      ]
    };
    
    console.log('测试新JSON格式:', testData);
    
    // 使用parseResponse方法解析测试数据
    const result = this.parseResponse(testData, new Date().toLocaleTimeString());
    console.log('解析结果:', result);
    
    return result;
  },
  // 处理 mp-html 节点点击事件
  handleHtmlNodeClick(event) {
    console.log('handleHtmlNodeClick 事件触发了！', event);
    
    // 从 event.detail 中获取点击节点的属性
    const { dataset, node } = event.detail;
    console.log('节点数据集:', dataset);
    console.log('节点信息:', node);
    
    // 处理规划点击
    if (dataset && dataset.type === 'plan') {
      // 跳转到规划页面
      wx.navigateTo({
        url: '/pages/plan/plan',
        success: () => {
          console.log('跳转到规划页面成功');
        },
        fail: (err) => {
          console.error('跳转到规划页面失败:', err);
          wx.showToast({
            title: '跳转失败，请重试',
            icon: 'none'
          });
        }
      });
      
      // 添加触感反馈
      wx.vibrateShort({ type: 'medium' });
      return;
    }
    
    // 处理图片点击事件
    if (dataset && dataset.type === 'image') {
      const url = dataset.url;
      if (url) {
        wx.previewImage({
          current: url,
          urls: [url]
        });
      }
      return;
    }
    
    // 显示提示信息，如果点击了之前的定位或导航按钮区域（现已移除）
    if (dataset && (dataset.type === 'location' || dataset.type === 'nav-link')) {
      wx.showToast({
        title: '定位功能已移除',
        icon: 'none',
        duration: 1500
      });
      return;
    }
  },
  // 处理图片点击事件
  handleImgTap(event) {
    console.log('handleImgTap event:', event);
    const { src } = event.detail;
    
    // 获取所有图片URL
    const urls = this.data.messages
      .filter(msg => msg.type === 'html')
      .map(msg => {
        // 使用正则表达式匹配 data-url 属性
        const matches = msg.content.match(/data-url="([^"]+)"/g);
        return matches ? matches.map(match => match.match(/data-url="([^"]+)"/)[1]) : [];
      })
      .flat()
      .filter((url, index, self) => self.indexOf(url) === index); // 去重

    if (urls.length > 0) {
      wx.previewImage({
        current: src,
        urls: urls
      });
    }
  },
  // 处理 rich-text 点击事件
  handleRichTextTap(event) {
    console.log('handleRichTextTap 被触发', event);
    
    // 获取点击的节点数据
    const { type, lat, lng, name } = event.currentTarget.dataset;
    
    if (type === 'content') {
      console.log('点击了内容:', { lat, lng, name });
      // 在这里处理点击事件，例如在地图上打点
    }
  },
  // 处理整个 HTML 点击事件
  handleHtmlTap(event) {
    console.log('handleHtmlTap 事件触发了！', event);
    
    // 获取点击的消息索引
    const messageIndex = event.currentTarget.dataset.messageIndex;
    console.log('点击的消息索引:', messageIndex);
    
    try {
      // 获取 mp-html 组件实例
      const mpHtml = this.selectComponent(`#mp-html-${messageIndex}`);
      if (mpHtml) {
        // 从事件中获取触摸位置
        const touches = event.touches || [];
        if (touches.length > 0) {
          const touch = touches[0];
          console.log('点击坐标:', touch.clientX, touch.clientY);
          
          // 尝试获取点击的节点
          const node = mpHtml.getNodeByXY && mpHtml.getNodeByXY(touch.clientX, touch.clientY);
          if (node && node.dataset) {
            console.log('通过坐标找到的节点:', node);
            // 如果找到节点，可以显示其文本内容
            if (node.dataset.text) {
              wx.showToast({
                title: `点击了: ${node.dataset.text}`,
                icon: 'none',
                duration: 2000
              });
              return;
            }
          }
        }
      }
    } catch (error) {
      console.error('处理HTML点击事件时出错:', error);
    }
  },
  // 处理 HTML 加载错误
  handleHtmlError(event) {
    console.error('HTML 加载错误:', event);
    // wx.showToast({
    //   title: 'HTML 内容加载失败',
    //   icon: 'none'
    // });
  },
  
  // 处理 HTML 准备完成
  handleHtmlReady(event) {
    console.log('HTML 内容已准备好:', event);
    const { index } = event.currentTarget.dataset.messageIndex;
    console.log('消息索引:', index);
  },
  // 处理链接点击事件
  handleLinkTap(e) {
    console.log('点击链接:', e);
    const linkType = e.currentTarget.dataset.type;
    
    if (linkType === 'plan') {
      // 跳转到规划页面
      wx.navigateTo({
        url: '/pages/plan/plan',
        success: () => {
          console.log('跳转到规划页面成功');
        },
        fail: (err) => {
          console.error('跳转到规划页面失败:', err);
          wx.showToast({
            title: '跳转失败，请重试',
            icon: 'none'
          });
        }
      });
    }
  },
  // 处理推荐查询点击
  handleSuggestedQueryTap(e) {
    // 详细日志记录
    console.log('推荐查询被点击:', e);
    
    try {
      // 获取查询文本
      const query = e.currentTarget.dataset.query;
      console.log('点击的查询内容:', query);
      
      if (!query) {
        console.error('点击查询失败: 未获取到查询内容');
        wx.showToast({
          title: '查询内容为空',
          icon: 'none',
          duration: 1500
        });
        return;
      }
      
      // 立即提供视觉反馈
      e.currentTarget.className += ' touching';
      
      // 振动反馈
      wx.vibrateShort({
        type: 'heavy',
        success: () => console.log('振动反馈成功'),
        fail: (err) => console.error('振动反馈失败:', err)
      });
      
      // 显示加载提示
      wx.showToast({
        title: '处理查询...',
        icon: 'loading',
        duration: 800
      });
      
      console.log('执行推荐查询:', query);
      
      // 设置输入值并发送消息（延迟确保UI反馈）
      setTimeout(() => {
        this.setData({
          inputValue: query
        }, () => {
          console.log('设置输入值完成，准备发送消息');
          setTimeout(() => {
            console.log('开始发送消息');
            this.sendMessage();
          }, 100);
        });
      }, 300);
    } catch (error) {
      console.error('处理推荐查询点击出错:', error);
      
      // 显示错误提示
      wx.showToast({
        title: '处理查询失败',
        icon: 'none',
        duration: 2000
      });
    }
  },
  // 接收外部传入的query并直接发起聊天
  async handleExternalQuery(query) {
    if (!query) return null;
    
    try {
      // 添加用户消息
      this.addMessage('user', query);
      
      // 添加加载状态消息
      const loadingMsgId = this.addMessage('assistant', 'AI助手整理信息中(预计30-60秒)...', 'loading');
      
      // 记录开始时间
      const startTime = Date.now();
      
      // 调用API并等待结果
      const finalResponse = await this.callCozeAPI(query);
      
      // 计算响应时间（秒）
      const endTime = Date.now();
      const responseTime = ((endTime - startTime) / 1000).toFixed(1);
      
      // 删除加载状态消息
      this.removeMessage(loadingMsgId);
      
      // 添加响应时间信息到返回数据
      if (typeof finalResponse === 'object') {
        finalResponse.responseTime = responseTime;
      }
      
      // 返回原始响应内容
      return finalResponse;
    } catch (error) {
      console.error('处理外部查询时出错:', error);
      // 移除加载消息
      const loadingMsg = this.data.messages.find(msg => msg.type === 'loading' && msg.role === 'assistant');
      if (loadingMsg) {
        this.removeMessage(loadingMsg.id);
      }
      this.addMessage('assistant', error.message || '请求失败，请稍后再试。');
      throw error;
    }
  },
  // 在handleMessage函数中添加处理规划数据的逻辑
  handleMessage(message) {
    try {
      const parsedMessage = JSON.parse(message);
      if (parsedMessage.type === 'route') {
        // 保存规划数据到全局
        const app = getApp();
        app.globalData.routePlan = parsedMessage;
        
        // 显示规划链接，点击后跳转到plan页面而不是planDetail页面
        this.addMessage('assistant', 
          `<div class="plan-link">
            <a href="javascript:;" data-type="plan" style="color: #07C160; text-decoration: none; font-weight: bold;">点我看规划</a>
          </div>`,
          'html'
        );
      } else {
        // 处理其他类型的消息
        this.addMessage('assistant', message, 'text');
      }
    } catch (e) {
      // 如果不是JSON格式，按普通文本处理
      this.addMessage('assistant', message, 'text');
    }
  },
  // 移除指定ID的消息
  removeMessage(messageId) {
    const filteredMessages = this.data.messages.filter(msg => msg.id !== messageId);
    this.setData({
      messages: filteredMessages
    });
  },
  onStartPlan() {
    if (!this.data.inputValue.trim()) {
      wx.showToast({
        title: '请输入规划内容',
        icon: 'none'
      });
      return;
    }

    // 调用index页面的sendMessage方法
    const pages = getCurrentPages();
    const indexPage = pages.find(page => page.route === 'pages/index/index');
    
    if (indexPage) {
      // 设置输入值并发送消息
      indexPage.setData({
        inputValue: this.data.inputValue
      }, () => {
        // 传递回调函数
        indexPage.sendMessage((response) => {
          // 更新plan页面的数据
          this.setData({
            plans: response.plans || []
          });
        });
      });
    }
  },
  // 更新当前时间
  updateCurrentTime() {
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    
    // 为了减少屏幕闪烁，只在秒数是0时更新年月日信息
    const seconds = now.getSeconds().toString().padStart(2, '0');
    
    // 设置时间显示
    this.setData({
      currentTime: `${hours}:${minutes}`
    });
  },
  // 启动时间更新定时器
  startTimeUpdate() {
    // 先清除可能存在的计时器
    this.stopTimeUpdate();
    
    // 创建新的计时器，每秒更新一次
    this.data.timeUpdateTimer = setInterval(() => {
      this.updateCurrentTime();
    }, 1000);
  },
  // 停止时间更新定时器
  stopTimeUpdate() {
    if (this.data.timeUpdateTimer) {
      clearInterval(this.data.timeUpdateTimer);
      this.data.timeUpdateTimer = null;
    }
  },
  // 处理从其他页面传来的搜索查询
  handleExternalSearch(data) {
    if (!data || !data.query) return;
    
    console.log('收到外部搜索请求:', data.query);
    
    // 设置输入值并发送消息
    this.setData({
      inputValue: data.query
    }, () => {
      // 确保在 setData 回调中发送消息
      this.sendMessage();
    });
  },
  // 处理游乐场切换
  handleParkChange({ parkId, parkName }) {
    console.log('游乐场切换为:', parkName, '(ID:', parkId, ')');
    this.setData({
      currentPark: parkName,
      currentParkId: parkId,
      // 清空消息历史，重新开始对话
      messages: []
    }, () => {
      // 等待配置加载完成后显示新游乐场的欢迎消息
      app.waitForConfig().then(() => {
        this.showWelcomeMessage(parkId);
      });
    });
  },
  // 刷新页面数据
  refreshPageData() {
    try {
      // 检查 app 和 app.globalData 是否存在
      if (!app || !app.globalData) {
        console.warn('app 实例或 globalData 不存在，无法刷新页面数据');
        return;
      }
      
      const { currentParkId } = this.data;
      const currentPark = app.getParkNameById(currentParkId);
      
      // 如果消息列表为空，则显示欢迎消息
      if (this.data.messages.length === 0) {
        app.waitForConfig().then(() => {
          this.showWelcomeMessage(currentParkId);
        });
      }
      
      // 可以在这里添加其他需要刷新的页面元素
      console.log('首页数据已刷新，当前游乐场:', currentPark, '(ID:', currentParkId, ')');
    } catch (error) {
      console.error('refreshPageData 函数执行出错:', error);
    }
  },
  // 显示欢迎消息
  showWelcomeMessage(parkId) {
    console.log('显示欢迎消息，parkId:', parkId);
    
    try {
      // 检查 app 和 app.globalData 是否存在
      if (!app || !app.globalData) {
        console.warn('app 实例或 globalData 不存在，使用默认欢迎消息');
        // 使用默认欢迎消息
        this.addMessage('assistant', '欢迎使用游乐场助手！', 'welcome', null, [
          '有哪些热门景点?',
          '排队时间最短的项目',
          '推荐游玩路线',
          '附近的餐厅'
        ]);
        return;
      }
      
      // 从游乐场配置中获取对应游乐场的欢迎消息和推荐查询
      const parkConfig = app.getParkConfigById(parkId);
      
      if (!parkConfig) {
        console.error('未找到游乐场配置，ID:', parkId);
        // 使用默认欢迎消息
        this.addMessage('assistant', '欢迎使用游乐场助手！', 'welcome', null, [
          '有哪些热门景点?',
          '排队时间最短的项目',
          '推荐游玩路线',
          '附近的餐厅'
        ]);
        return;
      }
      
      console.log('显示欢迎消息，配置:', parkConfig);
      
      const welcomeMessage = parkConfig.welcomeMessage || '欢迎使用游乐场助手！';
      const recommendedQueries = parkConfig.recommendedQueries || [];
      
      // 确保推荐查询是有效的数组
      if (!Array.isArray(recommendedQueries) || recommendedQueries.length === 0) {
        console.warn('未找到有效的推荐查询，使用默认查询');
        // 使用默认的推荐查询
        this.addMessage('assistant', welcomeMessage, 'welcome', null, [
          '有哪些热门景点?',
          '排队时间最短的项目',
          '推荐游玩路线',
          '附近的餐厅'
        ]);
        return;
      }
      
      console.log('使用推荐查询:', recommendedQueries);
      
      // 添加欢迎消息和推荐查询
      this.addMessage('assistant', welcomeMessage, 'welcome', null, recommendedQueries);
    } catch (error) {
      console.error('showWelcomeMessage 函数执行出错:', error);
      // 发生错误时，也要确保显示某种欢迎消息
      this.addMessage('assistant', '欢迎使用游乐场助手！', 'welcome', null, [
        '有哪些热门景点?',
        '排队时间最短的项目',
        '推荐游玩路线',
        '附近的餐厅'
      ]);
    }
  },
  // 处理用户信息更新
  handleUserInfoUpdate(updatedUserInfo) {
    console.log('用户信息更新:', updatedUserInfo);
    
    try {
      // 确保不使用null
      if (!updatedUserInfo) {
        // 检查 app 和 app.globalData 是否存在
        if (!app || !app.globalData) {
          console.warn('app 实例或 globalData 不存在，使用默认用户信息');
          updatedUserInfo = {
            avatarUrl: '/images/xiaoxiaolu_default_touxiang.jpg',
            nickName: '小小鹿momo',
            openid: 'default_user',
            _id: 'default_user',
            userType: 'guest',
            isDefaultUser: true
          };
        } else {
          updatedUserInfo = app.globalData.defaultUserInfo || {
            avatarUrl: '/images/xiaoxiaolu_default_touxiang.jpg',
            nickName: '小小鹿momo',
            openid: 'default_user',
            _id: 'default_user',
            userType: 'guest',
            isDefaultUser: true
          };
        }
      }
      
      // 确保用户信息中有昵称（这是最关键的问题修复）
      if (!updatedUserInfo.nickName) {
        console.warn('更新的用户信息中没有昵称，使用默认昵称');
        updatedUserInfo.nickName = '小小鹿momo';
      }
      
      // 确保用户信息中有头像
      if (!updatedUserInfo.avatarUrl) {
        console.warn('更新的用户信息中没有头像，使用默认头像');
        updatedUserInfo.avatarUrl = '/images/xiaoxiaolu_default_touxiang.jpg';
      }
      
      // 只更新页面数据中的用户信息，不更新已有消息
      this.setData({
        userInfo: updatedUserInfo
      });
      
      // 移除更新已有消息的代码，只在新发送的消息中使用最新的用户信息
    } catch (error) {
      console.error('handleUserInfoUpdate 函数执行出错:', error);
    }
  },

  // 分享给好友
  onShareAppMessage() {
    const { currentPark, currentParkId } = this.data;
    return {
      title: `${currentPark}AI助手 - 智能游玩规划`,
      path: `/pages/index/index?parkId=${currentParkId}`,
      imageUrl: '/images/xiaoxiaolu_default_touxiang.jpg'
    };
  },

  // 分享到朋友圈
  onShareTimeline() {
    const { currentPark, currentParkId } = this.data;
    return {
      title: `${currentPark}AI助手 - 智能游玩规划`,
      query: `parkId=${currentParkId}&from=timeline`,
      imageUrl: '/images/xiaoxiaolu_default_touxiang.jpg'
    };
  },

  // 检查智能助手使用权限（使用统一的用户状态管理）
  async checkAssistantPermission() {
    try {
      console.log('检查智能助手使用权限...');
      
      const permissionResult = await userService.checkPermission('assistant');
      
      if (!permissionResult.hasPermission) {
        const { reason, message } = permissionResult;
        
        if (reason === 'no_status' || reason === 'not_logged_in') {
          wx.showModal({
            title: '提示',
            content: message,
            showCancel: true,
            cancelText: '取消',
            confirmText: '去登录',
            success: (res) => {
              if (res.confirm) {
                wx.switchTab({
                  url: '/pages/profile/profile'
                });
              }
            }
          });
        } else if (reason === 'need_vip') {
          wx.showModal({
            title: '智能助手功能',
            content: message,
            showCancel: true,
            cancelText: '取消',
            confirmText: '升级VIP',
            success: (res) => {
              if (res.confirm) {
                wx.switchTab({
                  url: '/pages/profile/profile'
                });
              }
            }
          });
        } else if (reason === 'no_count') {
          wx.showModal({
            title: '智能助手次数不足',
            content: message,
            showCancel: true,
            cancelText: '取消',
            confirmText: '查看详情',
            success: (res) => {
              if (res.confirm) {
                wx.switchTab({
                  url: '/pages/profile/profile'
                });
              }
            }
          });
        } else {
          wx.showToast({
            title: message,
            icon: 'none'
          });
        }
        
        return false;
      }

      console.log('智能助手权限检查通过，剩余次数:', permissionResult.userStatus.assistantCount);
      return true;
      
    } catch (error) {
      console.error('检查智能助手权限失败:', error);
      throw error;
    }
  },


  // 扣减智能助手次数（使用统一的用户状态管理）
  async deductAssistantCount() {
    try {
      console.log('扣减智能助手次数...');
      
      const result = await userService.deductCount('assistant');
      
      if (result.success) {
        console.log('智能助手次数扣减成功:', result.data);
        return result.data;
      } else {
        console.error('扣减智能助手次数失败:', result.error);
        throw new Error(result.error || '扣减次数失败');
      }
      
    } catch (error) {
      console.error('扣减智能助手次数出错:', error);
      throw error;
    }
  }
})
