const app = getApp();

// CozeApi 基类
class CozeApiBase {
  constructor(botType = 'chat') {
    this.conversationId = null;
    this.botType = botType; // 'chat' 或 'plan'
  }

  // 获取当前使用的 botId
  getBotId() {
    const { currentParkId } = app.globalData;
    const parkConfig = app.getParkConfigById(currentParkId);
    
    if (!parkConfig) {
      throw new Error(`未找到游乐场配置，ID: ${currentParkId}`);
    }
    
    if (this.botType === 'plan') {
      // 规划模式：优先使用 planBotId，如果不存在则使用普通 botId
      return parkConfig.planBotId || parkConfig.botId;
    } else {
      // 聊天模式：使用普通 botId
      return parkConfig.botId;
    }
  }

  // 创建会话
  createConversation() {
    const modeText = this.botType === 'plan' ? '规划' : '聊天';
    
    try {
      const { cozeApiKey, currentParkId } = app.globalData;
      
      const botId = this.getBotId();
      
      if (!botId) {
        throw new Error(`未找到游乐场 ${currentParkId} 的 ${this.botType === 'plan' ? 'planBotId' : 'botId'}`);
      }
      
      return new Promise((resolve, reject) => {
        wx.request({
          url: 'https://api.coze.cn/v1/conversation/create',
          method: 'POST',
          header: {
            'Authorization': `Bearer ${cozeApiKey}`,
            'Content-Type': 'application/json'
          },
          data: {
            bot_id: botId
          },
          success: (res) => {
            console.log(`创建${modeText}会话响应:`, res);
            if (res.data && res.data.data && res.data.data.id) {
              this.conversationId = res.data.data.id;
              // 将会话ID保存到全局数据中
              if (this.botType === 'plan') {
                app.globalData.planConversationId = this.conversationId;
              } else {
                app.globalData.conversationId = this.conversationId;
              }
              console.log(`${modeText}会话创建成功:`, this.conversationId);
              resolve(this.conversationId);
            } else {
              console.error(`创建${modeText}会话失败，响应数据:`, res.data);
              wx.reportAnalytics('api_error', {
                type: `create_${this.botType}_conversation_failed`,
                message: `创建${modeText}会话失败`
              });
              reject(new Error(`无法创建${modeText}会话`));
            }
          },
          fail: (err) => {
            console.error(`创建${modeText}会话请求失败:`, err);
            wx.reportAnalytics('api_error', {
              type: `create_${this.botType}_conversation_error`,
              error: err.errMsg || '未知错误'
            });
            reject(err);
          }
        });
      });
    } catch (error) {
      console.error(`createConversation 方法执行出错 - ${modeText}模式:`, error);
      throw error;
    }
  }

  // 获取用户位置
  getUserLocation() {
    return new Promise((resolve, reject) => {
      // 先检查是否有位置权限
      wx.getSetting({
        success: (res) => {
          if (res.authSetting['scope.userLocation'] === false) {
            // 用户拒绝过授权，提示用户打开设置页面
            wx.showModal({
              title: '需要位置权限',
              content: '为了提供更好的服务，需要获取您的位置信息',
              confirmText: '去设置',
              cancelText: '取消',
              success: (modalRes) => {
                if (modalRes.confirm) {
                  wx.openSetting({
                    success: (settingRes) => {
                      if (settingRes.authSetting['scope.userLocation']) {
                        // 用户在设置页面中打开了位置权限
                        this.getLocationAfterPermission(resolve, reject);
                      } else {
                        // 用户在设置页面中仍然拒绝了位置权限
                        reject(new Error('用户拒绝位置权限'));
                      }
                    },
                    fail: (err) => {
                      console.error('打开设置页面失败:', err);
                      reject(err);
                    }
                  });
                } else {
                  // 用户点击了取消
                  reject(new Error('用户取消授权'));
                }
              }
            });
          } else {
            // 用户未拒绝过授权或已授权
            this.getLocationAfterPermission(resolve, reject);
          }
        },
        fail: (err) => {
          console.error('获取设置失败:', err);
          reject(err);
        }
      });
    });
  }
  
  // 获取位置权限后获取位置
  getLocationAfterPermission(resolve, reject) {
    wx.getLocation({
      type: 'gcj02',
      success: (res) => {
        const { latitude, longitude } = res;
        resolve({ latitude, longitude });
      },
      fail: (err) => {
        console.error('获取位置失败:', err);
        reject(err);
      }
    });
  }

  // 轮询查看对话详情
  async pollConversationDetails(conversationId, chatId) {
    const { cozeApiKey } = app.globalData;
    const pollInterval = 500;

    return new Promise((resolve, reject) => {
      const poll = () => {
        wx.request({
          url: `https://api.coze.cn/v3/chat/retrieve?chat_id=${chatId}&conversation_id=${conversationId}`,
          method: 'GET',
          header: {
            'Authorization': `Bearer ${cozeApiKey}`,
            'Content-Type': 'application/json'
          },
          success: async (res) => {
            console.log(`${this.botType}对话详情:`, res);
            if (res.data && res.data.data && res.data.data.status === 'completed') {
              try {
                // 对话完成，获取最终结果
                const finalResponse = await this.retrieveChatMessages(conversationId, chatId);
                resolve(finalResponse);
              } catch (error) {
                reject(error);
              }
            } else if (res.data && res.data.data && ['required_action', 'canceled', 'failed'].includes(res.data.data.status)) {
              // 添加对话状态错误日志
              wx.reportAnalytics('api_error', {
                type: `${this.botType}_conversation_failed`,
                status: res.data.data.status
              });
              reject(new Error('对话未能成功完成。'));
            } else {
              setTimeout(poll, pollInterval);
            }
          },
          fail: (err) => {
            console.error(`${this.botType}轮询请求失败:`, err);
            wx.reportAnalytics('api_error', {
              type: `${this.botType}_poll_failed`,
              error: err.errMsg || '未知错误'
            });
            reject(err);
          }
        });
      };

      poll();
    });
  }

  // 调用 Coze API
  async callApi(message) {
    if (!this.conversationId) {
      await this.createConversation();
    }

    const { cozeApiKey, currentParkId } = app.globalData;
    const botId = this.getBotId();
    const parkName = app.getParkNameById(currentParkId);
    
    // 获取用户当前位置
    let userLocation = null;
    try {
      userLocation = await this.getUserLocation();
      console.log('获取到用户位置:', userLocation);
    } catch (error) {
      console.warn('获取用户位置失败:', error);
    }
    
    const modeText = this.botType === 'plan' ? '规划模式' : '聊天模式';
    
    // 添加调试日志
    console.log(`cozeApi - ${modeText} - 当前游乐场:`, parkName);
    console.log(`cozeApi - ${modeText} - 使用botId:`, botId);
    console.log(`cozeApi - ${modeText} - 使用conversationId:`, this.conversationId);

    // 根据模式决定是否附加收藏项目信息和位置信息
    let finalMessage = message;
    
    if (this.botType === 'plan') {
      // 规划模式：获取并附加收藏项目信息，只保留attraction和performance类型
      const allFavorites = app.globalData.favorites[currentParkId] || [];
      const filteredFavorites = allFavorites.filter(item => 
        item && (item.type === 'attraction' || item.type === 'performance')
      );
      const favoriteNames = filteredFavorites.map(item => item.name).join('、');
      
      console.log(`cozeApi - ${modeText} - 总收藏项目数量:`, allFavorites.length);
      console.log(`cozeApi - ${modeText} - 过滤后收藏项目数量:`, filteredFavorites.length);
      console.log(`cozeApi - ${modeText} - 收藏项目名称:`, favoriteNames || '无');
      
      if (favoriteNames) {
        finalMessage = `${message}\n\n我在${parkName}的收藏项目有：${favoriteNames}`;
      }
    } else {
      // 聊天模式：附加用户位置信息
      console.log(`cozeApi - ${modeText} - 附加用户位置信息`);
      
      if (userLocation) {
        const { latitude, longitude } = userLocation;
        finalMessage = `${message}\n\n[系统信息]用户当前位置坐标：纬度=${latitude.toFixed(6)}, 经度=${longitude.toFixed(6)}`;
        console.log(`cozeApi - ${modeText} - 已添加位置信息:`, { latitude, longitude });
      } else {
        console.log(`cozeApi - ${modeText} - 无法添加位置信息，位置获取失败`);
      }
    }

    // 构建请求体
    const requestBody = {
      bot_id: botId,
      stream: false,
      auto_save_history: true,
      user_id: '123',
      additional_messages: [
        {
          role: 'user',
          content: finalMessage,
          content_type: 'text'
        }
      ]
    };
    
    // 打印最终发送的消息内容
    console.log(`cozeApi - ${modeText} - 最终发送的消息:`, requestBody.additional_messages[0].content);

    return new Promise((resolve, reject) => {
      wx.request({
        url: `https://api.coze.cn/v3/chat?conversation_id=${this.conversationId}`,
        method: 'POST',
        header: {
          'Authorization': `Bearer ${cozeApiKey}`,
          'Content-Type': 'application/json'
        },
        data: JSON.stringify(requestBody),
        query: {
          conversation_id: this.conversationId
        },
        success: (res) => {
          console.log(`${modeText} API 响应:`, res);
          if (res.data && res.data.data && res.data.data.conversation_id) {
            const conversationId = res.data.data.conversation_id;
            const chatId = res.data.data.id;
            try {
              // 开始轮询查看对话详情
              const finalResponse = this.pollConversationDetails(conversationId, chatId);
              resolve(finalResponse);
            } catch (error) {
              reject(error);
            }
          } else {
            // 添加错误日志
            wx.reportAnalytics('api_error', {
              type: `no_conversation_id_${this.botType}`,
              message: `无法获取${this.botType === 'plan' ? '规划' : '聊天'}会话ID`
            });
            reject(new Error(`无法获取${this.botType === 'plan' ? '规划' : ''}回复，请稍后再试。`));
          }
        },
        fail: (err) => {
          console.error(`${modeText}请求失败:`, err);
          wx.reportAnalytics('api_error', {
            type: `${this.botType}_request_failed`,
            error: err.errMsg || '未知错误'
          });
          reject(err);
        }
      });
    });
  }

  // 查看对话消息详情
  async retrieveChatMessages(conversationId, chatId) {
    const { cozeApiKey } = app.globalData;

    return new Promise((resolve, reject) => {
      wx.request({
        url: `https://api.coze.cn/v3/chat/message/list?chat_id=${chatId}&conversation_id=${conversationId}`,
        method: 'GET',
        header: {
          'Authorization': `Bearer ${cozeApiKey}`,
          'Content-Type': 'application/json'
        },
        success: (res) => {
          console.log(`${this.botType}对话消息详情:`, res);
          if (res.data && res.data.data) {
            const finalResponse = res.data.data.find(msg => msg.type === 'answer')?.content;
            if (finalResponse) {
              resolve(finalResponse);
            } else {
              wx.reportAnalytics('api_error', {
                type: `no_answer_content_${this.botType}`,
                message: '无法获取回复内容'
              });
              reject(new Error('无法解析最终答案。'));
            }
          } else {
            wx.reportAnalytics('api_error', {
              type: `invalid_response_${this.botType}`,
              message: '响应数据格式错误'
            });
            reject(new Error('无法获取对话消息详情。'));
          }
        },
        fail: (err) => {
          console.error(`${this.botType}对话消息详情获取失败:`, err);
          wx.reportAnalytics('api_error', {
            type: `message_fetch_failed_${this.botType}`,
            error: err.errMsg || '未知错误'
          });
          reject(err);
        }
      });
    });
  }

  // 清空对话上下文
  async clearConversation() {
    if (!this.conversationId) {
      console.log(`没有活跃的${this.botType === 'plan' ? '规划' : '聊天'}会话，无需清空`);
      return;
    }

    const { cozeApiKey } = app.globalData;
    
    return new Promise((resolve, reject) => {
      wx.request({
        url: `https://api.coze.cn/v1/conversations/${this.conversationId}/clear`,
        method: 'POST',
        header: {
          'Authorization': `Bearer ${cozeApiKey}`,
          'Content-Type': 'application/json'
        },
        data: JSON.stringify({
          conversation_id: this.conversationId
        }),
        success: (res) => {
          console.log(`清空${this.botType === 'plan' ? '规划' : '聊天'}上下文响应:`, res);
          if (res.data && res.data.code === 0) {
            console.log(`${this.botType === 'plan' ? '规划' : '聊天'}上下文清空成功`);
            resolve(true);
          } else {
            console.error(`清空${this.botType === 'plan' ? '规划' : '聊天'}上下文失败，响应数据:`, res.data);
            reject(new Error(`清空${this.botType === 'plan' ? '规划' : '聊天'}上下文失败`));
          }
        },
        fail: (err) => {
          console.error(`清空${this.botType === 'plan' ? '规划' : '聊天'}上下文请求失败:`, err);
          reject(err);
        }
      });
    });
  }
}

// 聊天机器人实例
class CozeApiChat extends CozeApiBase {
  constructor() {
    super('chat');
  }
}

// 规划机器人实例
class CozeApiPlan extends CozeApiBase {
  constructor() {
    super('plan');
  }
  
  // 规划专用的调用方法，保持向后兼容
  async callPlanApi(message) {
    return this.callApi(message);
  }
}

// 创建实例
const chatApi = new CozeApiChat();
const planApi = new CozeApiPlan();

// 导出兼容的接口
module.exports = {
  // 聊天相关方法
  callApi: (message) => chatApi.callApi(message),
  createConversation: () => chatApi.createConversation(),
  clearConversation: () => chatApi.clearConversation(),
  
  // 规划相关方法
  callPlanApi: (message) => planApi.callPlanApi(message),
  
  // 直接导出实例，供需要的地方使用
  chatApi,
  planApi,
  
  // 向后兼容：导出默认实例（聊天）的方法
  conversationId: chatApi.conversationId,
  getBotId: () => chatApi.getBotId(),
  pollConversationDetails: (conversationId, chatId) => chatApi.pollConversationDetails(conversationId, chatId),
  retrieveChatMessages: (conversationId, chatId) => chatApi.retrieveChatMessages(conversationId, chatId)
}; 