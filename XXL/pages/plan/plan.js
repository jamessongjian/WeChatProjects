const cozeApi = require('../../utils/cozeApi');
const favoritesService = require('../../utils/favoritesService');
const userService = require('../../utils/userService');
const app = getApp();

Page({
  data: {
    inputValue: '',
    queryList: [
      '明天10点，规划一下我的收藏项目',
      '现在开始玩收藏项目'
    ],
    plans: [],
    planTypes: [
      { id: 'comprehensive', name: '综合推荐' },
      { id: 'shortest_wait_time', name: '最短排队' },
      { id: 'earliest_departure', name: '最早离园' }
    ],
    currentTabIndex: 0,
    plansData: {
      comprehensive: [],
      shortest_wait_time: [],
      earliest_departure: []
    },
    hasPlans: false,
    parks: [], // 游乐场列表
    currentPark: '', // 当前选择的游乐场名称
    currentParkId: '', // 当前选择的游乐场ID
    currentParkIndex: 0, // 当前游乐场在列表中的索引
    favorites: [], // 收藏列表
    isLoadingFavorites: false, // 收藏加载状态
    isPlanningLoading: false, // 规划加载状态
    planningLoadingDots: '' // 用于显示动画中的点的数量
  },

  onInputChange(e) {
    this.setData({
      inputValue: e.detail.value
    });
  },

  onQueryTap(e) {
    // 检查AI助手是否启用
    if (!app.getAiAssistantEnabled()) {
      wx.showModal({
        title: '功能提示',
        content: '该功能正在开发中，敬请期待！',
        showCancel: false,
        confirmText: '我知道了'
      });
      return;
    }
    
    // 添加震动反馈
    wx.vibrateShort({
      type: 'light'
    });
    
    const query = e.currentTarget.dataset.query;
    this.setData({
      inputValue: query
    });
    this.onStartPlan();
  },

  // 处理模拟数据的方法，方便开发和测试
  processTestData(testDataStr) {
    try {
      // 尝试解析 JSON 字符串
      const data = JSON.parse(testDataStr);
      console.log('解析测试数据:', data);
      
      // 验证数据格式是否符合预期
      if (data.code === 0 && data.type === 'route') {
        // 检查数据是否为空
        if (!data.data || (Array.isArray(data.data) && data.data.length === 0)) {
          wx.showModal({
            title: '规划提示',
            content: '根据您选择的项目，一天时间无法全部游玩完毕。建议您减少项目数量或安排多天游玩。',
            showCancel: false,
            confirmText: '知道了',
            confirmColor: '#07C160'
          });
          return false;
        }
        
        // 直接在当前页面处理和显示数据，不再跳转
        this.processNewFormatPlans(data.data);
        
        wx.showToast({
          title: '规划数据加载成功',
          icon: 'success'
        });
        return true;
      } else {
        console.error('测试数据格式不正确', data);
        wx.showToast({
          title: '测试数据格式不正确',
          icon: 'none'
        });
        return false;
      }
    } catch (error) {
      console.error('解析测试数据失败:', error);
      wx.showToast({
        title: '解析测试数据失败',
        icon: 'none'
      });
      return false;
    }
  },

  async onStartPlan() {
    // 检查AI助手是否启用
    if (!app.getAiAssistantEnabled()) {
      wx.showModal({
        title: '功能提示',
        content: '该功能正在开发中，敬请期待！',
        showCancel: false,
        confirmText: '我知道了'
      });
      return;
    }
    
    if (!this.data.inputValue.trim()) {
      wx.showToast({
        title: '请输入规划内容',
        icon: 'none'
      });
      return;
    }

    // 检查用户旅行规划次数
    try {
      const hasPermission = await this.checkPlanningPermission();
      if (!hasPermission) {
        return; // 如果没有权限，直接返回
      }
    } catch (error) {
      console.error('检查旅行规划权限失败:', error);
      wx.showToast({
        title: '检查权限失败，请稍后重试',
        icon: 'none'
      });
      return;
    }

    // 重置规划数据
    this.setData({
      hasPlans: false,
      plansData: {
        comprehensive: [],
        shortest_wait_time: [],
        earliest_departure: []
      },
      currentTabIndex: 0
    });

    // 测试模式：如果输入内容看起来像 JSON 格式
    if (this.data.inputValue.trim().startsWith('{')) {
      console.log('检测到 JSON 数据，尝试处理...');
      try {
        // 尝试解析为 JSON
        const parsedData = JSON.parse(this.data.inputValue.trim());
        
        // 检查是否是有效的规划数据
        if (parsedData.code === 0 && parsedData.type === 'route') {
          // 检查数据是否为空
          if (!parsedData.data || (Array.isArray(parsedData.data) && parsedData.data.length === 0)) {
            wx.showModal({
              title: '规划提示',
              content: '根据您选择的项目，一天时间无法全部游玩完毕。建议您减少项目数量或安排多天游玩。',
              showCancel: false,
              confirmText: '知道了',
              confirmColor: '#07C160'
            });
            return;
          }
          
          if (parsedData.data) {
            console.log('解析到有效的规划数据');
            
            // 处理规划数据并在当前页面显示
            this.processNewFormatPlans(parsedData.data);
            
            wx.showToast({
              title: '规划数据加载成功',
              icon: 'success'
            });
            return;
          }
        } else {
          console.warn('JSON 数据格式不符合规划数据要求:', parsedData);
        }
      } catch (error) {
        console.error('解析 JSON 数据失败:', error);
        wx.showToast({
          title: '解析数据失败，尝试使用文本查询',
          icon: 'none',
          duration: 2000
        });
      }
    }

    // 显示进度动画
    this.setData({
      isPlanningLoading: true,
      planningLoadingDots: ''
    });
    
    // 启动进度动画
    this.startLoadingAnimation();

    try {
      // 确保将当前页面的收藏数据同步到全局数据
      if (this.data.favorites && this.data.favorites.length > 0) {
        // 确保全局favorites对象存在
        app.globalData.favorites = app.globalData.favorites || {};
        // 将当前页面的收藏数据更新到全局变量中
        app.globalData.favorites[this.data.currentParkId] = this.data.favorites;
      }

      // 直接调用cozeApi发送消息，使用原始输入，让cozeApi自己添加收藏信息
      const response = await cozeApi.callPlanApi(this.data.inputValue);
      
      // 停止动画
      this.setData({
        isPlanningLoading: false
      });
      
      // 清除动画计时器
      if (this.loadingAnimationTimer) {
        clearInterval(this.loadingAnimationTimer);
        this.loadingAnimationTimer = null;
      }
      
      console.log('规划响应:', response);
      
      // 解析规划数据
      let plans = [];
      try {
        // 首先尝试解析为对象
        let parsedData = null;
        
        // 尝试直接解析整个响应
        try {
          parsedData = JSON.parse(response);
        } catch (e) {
          // 如果直接解析失败，尝试从响应中提取JSON部分
          const jsonMatch = response.match(/```json([\s\S]*?)```/);
          if (jsonMatch && jsonMatch[1]) {
            const jsonStr = jsonMatch[1].trim();
            parsedData = JSON.parse(jsonStr);
          }
        }
        
        if (parsedData) {
          // 新的数据格式处理
          if (parsedData.code === 0 && parsedData.message === 'success') {
            // 检查数据是否为空
            if (!parsedData.data || (Array.isArray(parsedData.data) && parsedData.data.length === 0)) {
              // 数据为空，说明一天无法玩完
              wx.showModal({
                title: '规划提示',
                content: '根据您选择的项目，一天时间无法全部游玩完毕。建议您减少项目数量或安排多天游玩。',
                showCancel: false,
                confirmText: '知道了',
                confirmColor: '#07C160'
              });
              
              // 停止加载动画
              this.setData({
                isPlanningLoading: false
              });
              
              return; // 直接返回，不继续处理
            }
            
            plans = this.processNewFormatPlans(parsedData.data);
          } 
          // 兼容旧格式数据
          else if (parsedData.plans) {
            plans = parsedData.plans;
            // 将旧格式数据转换为新格式显示
            this.setData({
              plansData: {
                comprehensive: plans,
                shortest_wait_time: [],
                earliest_departure: []
              },
              hasPlans: plans.length > 0
            });
          } else if (Array.isArray(parsedData)) {
            plans = parsedData;
            // 将旧格式数据转换为新格式显示
            this.setData({
              plansData: {
                comprehensive: plans,
                shortest_wait_time: [],
                earliest_departure: []
              },
              hasPlans: plans.length > 0
            });
          }
        }
      } catch (parseError) {
        console.error('解析规划数据失败:', parseError);
        // 如果都失败了，可能需要特殊处理
      }
      
      if (plans.length > 0 || this.data.hasPlans) {
        // API调用成功，扣减旅行规划次数
        try {
          await this.deductPlanningCount();
        } catch (error) {
          console.error('扣减旅行规划次数失败:', error);
          // 即使扣减失败，也不影响用户体验，只记录日志
        }
        
        wx.showToast({
          title: '规划生成成功',
          icon: 'success',
          duration: 2000
        });
      } else {
        wx.showToast({
          title: '规划生成失败，格式错误',
          icon: 'none',
          duration: 2000
        });
      }
    } catch (error) {
      console.error('规划生成失败:', error);
      
      // 停止动画
      this.setData({
        isPlanningLoading: false
      });
      
      // 清除动画计时器
      if (this.loadingAnimationTimer) {
        clearInterval(this.loadingAnimationTimer);
        this.loadingAnimationTimer = null;
      }
      
      wx.showToast({
        title: '规划生成失败，请重试',
        icon: 'none',
        duration: 2000
      });
    }
  },

  // 启动加载动画
  startLoadingAnimation() {
    // 先清除可能存在的计时器
    if (this.loadingAnimationTimer) {
      clearInterval(this.loadingAnimationTimer);
    }
    
    // 设置计时器，每500毫秒更新一次动画点
    this.loadingAnimationTimer = setInterval(() => {
      let dots = this.data.planningLoadingDots;
      dots += '.';
      if (dots.length > 3) {
        dots = '';
      }
      this.setData({
        planningLoadingDots: dots
      });
    }, 300);
  },

  onLoad(options) {
    // 初始化数据
    this.initData();
    
    // 处理从首页跳转过来的规划数据
    const app = getApp();
    if (app.globalData.routePlan) {
      console.log('检测到来自首页的规划数据');
      // 处理规划数据
      if (app.globalData.routePlan.type === 'route') {
        // 检查数据是否为空
        if (!app.globalData.routePlan.data || (Array.isArray(app.globalData.routePlan.data) && app.globalData.routePlan.data.length === 0)) {
          wx.showModal({
            title: '规划提示',
            content: '根据您选择的项目，一天时间无法全部游玩完毕。建议您减少项目数量或安排多天游玩。',
            showCancel: false,
            confirmText: '知道了',
            confirmColor: '#07C160'
          });
          return;
        }
        
        if (app.globalData.routePlan.data) {
          this.processNewFormatPlans(app.globalData.routePlan.data);
        }
      }
    }
  },

  onShow() {
    // 设置tabBar选中状态
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setSelected('pages/plan/plan');
    }
    
    // 每次页面显示时重新加载收藏列表
    this.loadFavorites();
  },

  onUnload() {
    // 页面卸载时移除事件监听
    app.globalEvents.off('parkChanged', this.handleParkChange);
    if (app.globalEvents.off) {
      app.globalEvents.off('favoritesUpdated', this.loadFavorites);
    }
    
    // 清除动画计时器
    if (this.loadingAnimationTimer) {
      clearInterval(this.loadingAnimationTimer);
      this.loadingAnimationTimer = null;
    }
  },
  
  // 游乐场选择变更处理函数
  onParkChange(e) {
    const index = e.detail.value;
    const park = this.data.parks[index];
    const parkId = park.id;
    const parkName = park.name;
    
    // 如果选择的是当前游乐场，不做操作
    if (parkId === this.data.currentParkId) {
      return;
    }
    
    // 使用app的switchPark方法切换游乐场
    app.switchPark(parkId);
  },
  
  // 处理游乐场变更事件
  handleParkChange({ parkId, parkName }) {
    // 更新当前游乐场
    const currentParkIndex = this.data.parks.findIndex(park => park.id === parkId);
    
    this.setData({
      currentPark: parkName,
      currentParkId: parkId,
      currentParkIndex: currentParkIndex >= 0 ? currentParkIndex : 0
    });
    
    // 清空当前规划
    this.setData({
      plans: []
    });
    
    wx.showToast({
      title: '已切换至' + parkName,
      icon: 'none'
    });
    
    // 重新加载收藏列表
    this.loadFavorites();
  },
  
  // 加载收藏列表
  loadFavorites() {
    // 设置加载状态
    this.setData({ isLoadingFavorites: true });
    
    // 延迟一点时间，确保从收藏页面返回时能够获取到最新数据
    setTimeout(() => {
      // 使用favoritesService获取收藏列表
      const favorites = favoritesService.getFavorites(app, this.data.currentPark);
      
      // 确保每个收藏项都有完整的数据
      const processedFavorites = favorites.map(item => {
        // 如果item只是一个ID，尝试从全局数据中获取完整项目信息
        if (typeof item === 'string' || typeof item === 'number') {
          const itemId = item;
          const parkItems = app.globalData.allItems[this.data.currentParkId] || app.globalData.parkData[this.data.currentParkId] || [];
          const fullItem = parkItems.find(i => i.id === itemId);
          
          if (fullItem) {
            return {
              ...fullItem,
              // 确保基本属性存在
              image: fullItem.image || '/images/placeholder.png',
              name: fullItem.name || '未命名项目',
              type: fullItem.type || 'attraction'
            };
          } else {
            // 如果找不到完整信息，创建基本项目对象
            return {
              id: itemId,
              name: '项目 #' + itemId,
              image: '/images/placeholder.png',
              type: 'attraction'
            };
          }
        }
        
        // 如果已经是对象，确保有默认图片
        return {
          ...item,
          image: item.image || '/images/placeholder.png',
          name: item.name || '未命名项目',
          type: item.type || 'attraction'
        };
      });
      
      // 过滤只显示 attraction 和 performance 类型的收藏
      const filteredFavorites = processedFavorites.filter(item => {
        return item.type === 'attraction' || item.type === 'performance';
      });
      
      // 更新收藏列表数据
      this.setData({ 
        favorites: filteredFavorites,
        isLoadingFavorites: false 
      });
    }, 100);
  },
  
  // 点击收藏项进入详情页
  onFavoriteItemTap(e) {
    const id = e.currentTarget.dataset.id;
    
    // 验证ID
    if (!id) {
      console.error('点击收藏项: ID为空');
      wx.showToast({
        title: '无法打开详情: 无效的项目',
        icon: 'none'
      });
      return;
    }
    
    // 获取item的类型，这对于详情页是必要的
    const favoriteItem = this.data.favorites.find(item => item.id === id);
    if (!favoriteItem) {
      console.error('点击收藏项: 未找到对应收藏项', { id });
      wx.showToast({
        title: '无法打开详情: 项目不存在',
        icon: 'none'
      });
      return;
    }
    
    const type = favoriteItem.type || 'attraction';
    
    console.log('正在导航到详情页:', {
      id: id,
      type: type,
      parkId: this.data.currentParkId
    });
    
    wx.navigateTo({
      url: `/pages/details/details?id=${id}&type=${type}&parkId=${this.data.currentParkId}`,
      fail: (err) => {
        console.error('跳转详情页失败:', err);
        wx.showToast({
          title: '无法打开详情页',
          icon: 'none'
        });
      }
    });
  },
  
  // 删除收藏项
  onDeleteFavorite(e) {
    const id = e.currentTarget.dataset.id;
    
    // 验证ID
    if (!id) {
      console.error('删除收藏项: ID为空');
      wx.showToast({
        title: '删除失败: 无效的项目',
        icon: 'none'
      });
      return;
    }
    
    // 查找收藏项对象
    const favoriteItem = this.data.favorites.find(item => item.id === id);
    if (!favoriteItem) {
      console.error('删除收藏项: 未找到对应收藏项', { id });
      wx.showToast({
        title: '删除失败: 项目不存在',
        icon: 'none'
      });
      return;
    }
    
    wx.showModal({
      title: '提示',
      content: '确定要删除该收藏吗？',
      success: (res) => {
        if (res.confirm) {
          // 使用favoritesService移除收藏
          favoritesService.toggleFavorite(app, this.data.currentPark, favoriteItem, true, () => {
            // 重新加载收藏列表
            this.loadFavorites();
            
            wx.showToast({
              title: '删除成功',
              icon: 'success'
            });
          });
        }
      }
    });
  },

  // 处理图片加载失败
  onImageError(e) {
    const index = e.currentTarget.dataset.index;
    // 设置默认图片
    const defaultImagePath = '/images/placeholder.png';
    
    // 更新对应收藏项的图片路径
    this.setData({
      [`favorites[${index}].image`]: defaultImagePath
    });
    
    console.log(`收藏项 #${index} 图片加载失败，已替换为默认图片`);
  },

  // 处理规划项目图片加载错误
  onProjectImageError(e) {
    const index = e.currentTarget.dataset.index; // 规划索引
    const itemIndex = e.currentTarget.dataset.itemIndex; // 项目索引
    const defaultImagePath = '/images/placeholder.png';
    
    // 根据当前tab页确定要更新的数据路径
    let tabType = '';
    if (this.data.currentTabIndex === 0) {
      tabType = 'comprehensive';
    } else if (this.data.currentTabIndex === 1) {
      tabType = 'shortest_wait_time';
    } else {
      tabType = 'earliest_departure';
    }
    
    // 更新对应项目的图片路径
    const path = `plansData.${tabType}[${index}].items[${itemIndex}].imageUrl`;
    
    this.setData({
      [path]: defaultImagePath
    });
    
    console.log(`规划项目 ${tabType} #${index}-${itemIndex} 图片加载失败，已替换为默认图片`);
  },

  // 切换标签页
  switchTab(e) {
    const index = e.currentTarget.dataset.index;
    this.setData({
      currentTabIndex: index
    });
  },

  // 处理新格式的规划数据
  processNewFormatPlans(plansData) {
    try {
      console.log('开始处理新规划数据');
      
      // 确保 plansData 是对象或数组
      if (!plansData) {
        console.error('规划数据为空');
        return [];
      }

      // 检查是否有 comprehensive, shortest_wait_time, earliest_departure 结构
      if (plansData.comprehensive || plansData.shortest_wait_time || plansData.earliest_departure) {
        // 处理分类规划数据
        const app = getApp();
        const currentParkId = this.data.currentParkId;
        
        console.log('处理新格式规划数据，当前游乐场ID:', currentParkId);
        
        // 优先从全局变量获取所有项目数据
        let allItems = [];
        
        // 先尝试从 allItems 获取
        if (app.globalData.allItems && app.globalData.allItems[currentParkId]) {
          allItems = app.globalData.allItems[currentParkId];
        } 
        // 如果 allItems 中没有，再从 parkData 获取
        else if (app.globalData.parkData && app.globalData.parkData[currentParkId]) {
          const parkData = app.globalData.parkData[currentParkId];
          // 从所有区域数据中提取项目信息
          if (Array.isArray(parkData)) {
            allItems = parkData.reduce((acc, area) => {
              if (area && area.items && Array.isArray(area.items)) {
                return [...acc, ...area.items];
              }
              return acc;
            }, []);
          }
        }
        
        console.log('获取到的项目数据:', allItems.length, '条');

        // 初始化三种类型的规划数据结构
        const plansData2 = {
          comprehensive: [],
          shortest_wait_time: [],
          earliest_departure: []
        };

        // 处理每种类型的规划
        Object.keys(plansData).forEach(planType => {
          if (plansData2.hasOwnProperty(planType) && Array.isArray(plansData[planType])) {
            plansData2[planType] = plansData[planType].map((plan, index) => {
              if (!plan) return null;
              
              // 为每个规划生成唯一ID，格式：plan_类型_时间戳_索引_随机字符串
              // 这样可以确保每个规划都有一个唯一的标识符，避免收藏状态混淆
              const timestamp = Date.now();
              const randomStr = Math.random().toString(36).substr(2, 9);
              const planId = `plan_${planType}_${timestamp}_${index}_${randomStr}`;
              console.log(`为新规划 ${planType} #${index} 生成唯一ID: ${planId}`);
              
              return {
                planId: planId, // 添加唯一ID作为规划的标识符
                id: index + 1,
                totalTime: Math.round(plan.time_to_close || 0),
                timeToClose: Math.round(plan.time_to_close || 0),
                totalWaitTime: Math.round(plan.total_wait_time || 0),
                totalRestTime: Math.round(plan.total_rest_time || 0),
                score: Math.round((plan.score || 0) * 10) / 10,
                // 计算离园时间
                departureTime: this.calculateDepartureTime(plan),
                items: Array.isArray(plan.schedule) ? plan.schedule.map(item => {
                  if (!item) return null;
                  
                  // 在全局数据中查找匹配的项目
                  const matchedItem = Array.isArray(allItems) ? 
                                      allItems.find(globalItem => globalItem && globalItem.name === item.name) : 
                                      null;
                                      
                  // 调试信息
                  if (!matchedItem) {
                    console.log(`未找到匹配的项目: ${item.name}`);
                  } else if (!matchedItem.image) {
                    console.log(`项目 ${item.name} 没有图片`);
                  }
                  
                  let imageUrl = '/images/placeholder.png';
                  
                  // 尝试从全局数据中找到项目的图片
                  try {
                    const parkItems = app.globalData.allItems?.[this.data.currentParkId] || 
                                      app.globalData.parkData?.[this.data.currentParkId] || [];
                    const matchedItem = Array.isArray(parkItems) ? 
                                        parkItems.find(i => i && i.name === item.name) : null;
                    if (matchedItem && matchedItem.image) {
                      imageUrl = matchedItem.image;
                      console.log(`找到项目 ${item.name} 的图片: ${imageUrl}`);
                    } else {
                      console.log(`未找到项目 ${item.name} 的图片，使用默认图片`);
                    }
                  } catch (error) {
                    console.error('获取项目图片时出错:', error);
                    // 错误时使用默认图片
                  }
                  
                  return {
                    id: item.name || `item_${Math.random().toString(36).substr(2, 9)}`,
                    name: item.name || '未命名项目',
                    startTime: item.start_time || '',
                    endTime: item.end_time || '',
                    queueTime: Math.round(item.wait_time || 0),
                    restTime: Math.round(item.rest_time || 0),
                    playDuration: item.play_duration || 15, // 默认游玩时间为15分钟
                    type: item.type || 'attraction',
                    imageUrl: imageUrl
                  };
                }).filter(Boolean) : [] // 过滤掉可能的空值
              };
            }).filter(Boolean); // 过滤掉可能的空值
          }
        });

        // 计算排队时间节省提示
        this.calculateQueueTimeSavings(plansData2);
        
        // 由于是新生成的规划，所有规划的收藏状态应该默认为未收藏
        // 我们仍然调用checkFavoriteStatus，但这里每个规划都有新的唯一ID，
        // 所以不会与之前收藏的规划冲突
        console.log('新规划生成完成，设置收藏状态');
        this.checkFavoriteStatus(plansData2);
        
        // 更新页面数据，显示分类规划
        this.setData({ 
          plansData: plansData2,
          hasPlans: true 
        });
        
        console.log('处理后的分类规划数据:', plansData2);
        
        // 返回空数组，因为我们使用plansData来显示
        return [];
      }

      // 如果是老格式数据（纯数组），继续处理
      if (!Array.isArray(plansData)) {
        console.error('规划数据不是数组格式:', plansData);
        return [];
      }
      
      // 为了兼容老代码，继续处理老的格式
      const processedPlans = plansData.map((planData, index) => {
        if (!planData) {
          console.error('计划数据项为空:', index);
          return {
            planId: `plan_legacy_${Date.now()}_${index}_${Math.random().toString(36).substr(2, 9)}`, // 添加唯一ID
            id: `plan_${index}`,
            totalTime: 0,
            timeToClose: 0,
            totalRestTime: 0,
            totalWaitTime: 0,
            score: 0,
            items: []
          };
        }
        
        // 计算总时长（等待时间 + 休息时间）
        const totalWaitTime = typeof planData.total_wait_time === 'number' ? planData.total_wait_time : 0;
        const totalRestTime = typeof planData.total_rest_time === 'number' ? planData.total_rest_time : 0;
        const totalTime = totalWaitTime + totalRestTime;
        
        // 确保 schedule 是数组
        const schedule = Array.isArray(planData.schedule) ? planData.schedule : [];
        
        // 处理每个计划项目
        const items = schedule.map((item, itemIndex) => {
          if (!item) {
            console.error('项目数据为空:', index, itemIndex);
            return {
              id: `temp_${index}_${itemIndex}`,
              name: '未知项目',
              startTime: '',
              endTime: '',
              queueTime: 0,
              restTime: 0,
              imageUrl: '/images/placeholder.png'
            };
          }
          
          // 获取项目图片，可以从全局数据或者默认图片
          let imageUrl = '/images/placeholder.png';
          
          // 尝试从全局数据中找到项目的图片
          try {
            const parkItems = app.globalData.allItems?.[this.data.currentParkId] || 
                              app.globalData.parkData?.[this.data.currentParkId] || [];
            const matchedItem = Array.isArray(parkItems) ? 
                                parkItems.find(i => i && i.name === item.name) : null;
            if (matchedItem && matchedItem.image) {
              imageUrl = matchedItem.image;
              console.log(`找到项目 ${item.name} 的图片: ${imageUrl}`);
            } else {
              console.log(`未找到项目 ${item.name} 的图片，使用默认图片`);
            }
          } catch (error) {
            console.error('获取项目图片时出错:', error);
            // 错误时使用默认图片
          }
          
          // 确保wait_time和rest_time为数字
          const waitTime = typeof item.wait_time === 'number' ? item.wait_time : Number(item.wait_time) || 0;
          const restTime = typeof item.rest_time === 'number' ? item.rest_time : Number(item.rest_time) || 0;
          
          return {
            id: `temp_${index}_${itemIndex}`,
            name: item.name || '未命名项目',
            startTime: item.start_time || '',
            endTime: item.end_time || '',
            queueTime: waitTime,
            restTime: restTime,
            imageUrl: imageUrl
          };
        });
        
        // 确保所有数值都是有效的数字
        return {
          id: `plan_${index}`,
          totalTime: totalTime || 0,
          timeToClose: planData.time_to_close || 0,
          totalRestTime: totalRestTime || 0,
          totalWaitTime: totalWaitTime || 0,
          score: planData.score || 0,
          departureTime: this.calculateDepartureTime(planData),
          items: items
        };
      });

      // 为了兼容老代码，将数组结果放入综合排序类别
      if (processedPlans.length > 0) {
        this.setData({
          plansData: {
            comprehensive: processedPlans,
            shortest_wait_time: [],
            earliest_departure: []
          },
          hasPlans: true
        });
      }
      
      return processedPlans;
    } catch (error) {
      console.error('处理规划数据时出错:', error);
      return [];
    }
  },

  // 添加处理从首页跳转过来的规划数据的函数
  handleRouteResponse(data) {
    // 直接在当前页面处理显示
    if (data && data.type === 'route') {
      // 检查数据是否为空
      if (!data.data || (Array.isArray(data.data) && data.data.length === 0)) {
        wx.showModal({
          title: '规划提示',
          content: '根据您选择的项目，一天时间无法全部游玩完毕。建议您减少项目数量或安排多天游玩。',
          showCancel: false,
          confirmText: '知道了',
          confirmColor: '#07C160'
        });
        return false;
      }
      
      if (data.data) {
        this.processNewFormatPlans(data.data);
        return true;
      }
    }
    return false;
  },

  // 计算排队时间节省提示
  calculateQueueTimeSavings(plansData) {
    try {
      // 收集所有规划的总排队时间
      const allWaitTimes = [];
      
      Object.keys(plansData).forEach(planType => {
        if (Array.isArray(plansData[planType])) {
          plansData[planType].forEach(plan => {
            if (plan && typeof plan.totalWaitTime === 'number') {
              allWaitTimes.push(plan.totalWaitTime);
            }
          });
        }
      });
      
      if (allWaitTimes.length === 0) {
        console.log('没有找到有效的排队时间数据');
        return;
      }
      
      // 找到最长和最短排队时间
      const maxWaitTime = Math.max(...allWaitTimes);
      const minWaitTime = Math.min(...allWaitTimes);
      
      console.log(`排队时间范围: ${minWaitTime} - ${maxWaitTime} 分钟`);
      
      // 为每个规划计算并添加节省时间提示
      Object.keys(plansData).forEach(planType => {
        if (Array.isArray(plansData[planType])) {
          plansData[planType].forEach(plan => {
            if (plan && typeof plan.totalWaitTime === 'number') {
              // 计算节省时间：N = (最长总排队时间 - 当前规划排队时间) * 1.9
              const timeSaved = Math.round((maxWaitTime - plan.totalWaitTime) * 1.9);
              
              // 只有当节省时间大于0时才显示提示
              if (timeSaved > 0) {
                plan.queueTimeSavingsTip = `少排队${timeSaved}分钟+`;
              } else {
                plan.queueTimeSavingsTip = ''; // 空字符串表示不显示提示
              }
              
              console.log(`规划 ${plan.id} (${planType}): 排队${plan.totalWaitTime}分钟, ${plan.queueTimeSavingsTip || '无节省'}`);
            }
          });
        }
      });
      
    } catch (error) {
      console.error('计算排队时间节省提示时出错:', error);
    }
  },

  // 切换规划收藏状态
  togglePlanFavorite(e) {
    const { planType, index } = e.currentTarget.dataset;
    const currentPlansData = this.data.plansData;
    
    if (!currentPlansData[planType] || !currentPlansData[planType][index]) {
      console.error('无效的规划数据:', planType, index);
      return;
    }
    
    const plan = currentPlansData[planType][index];
    const wasFavorited = plan.isFavorited;
    
    // 确保规划有唯一ID
    if (!plan.planId) {
      plan.planId = `plan_${planType}_${Date.now()}_${index}_${Math.random().toString(36).substr(2, 9)}`;
      console.log(`为规划 ${planType} #${index} 生成新的唯一ID: ${plan.planId} (在收藏操作中)`);
      
      // 更新页面数据中的planId
      this.setData({
        [`plansData.${planType}[${index}].planId`]: plan.planId
      });
    }
    
    // 切换收藏状态
    plan.isFavorited = !wasFavorited;
    
    // 更新页面数据
    this.setData({
      [`plansData.${planType}[${index}].isFavorited`]: plan.isFavorited
    });
    
    console.log(`规划 ${planType} #${index} (ID: ${plan.planId}) 收藏状态切换为:`, plan.isFavorited);
    
    // 处理收藏数据
    if (plan.isFavorited) {
      this.saveFavoritePlan(plan, planType, index);
      wx.showToast({
        title: '收藏成功，已保存到"我的"页面',
        icon: 'success',
        duration: 2000
      });
    } else {
      this.removeFavoritePlan(plan, planType, index);
      wx.showToast({
        title: '已取消收藏',
        icon: 'none',
        duration: 1500
      });
    }
  },

  // 保存收藏的规划
  saveFavoritePlan(plan, planType, index) {
    try {
      // 获取现有收藏
      const favoritePlans = wx.getStorageSync('favoritePlans') || [];
      
      // 使用规划自身的唯一ID，如果没有则生成一个
      const planId = plan.planId || `plan_${planType}_${Date.now()}_${index}_${Math.random().toString(36).substr(2, 9)}`;
      
      // 创建收藏数据
      const favoriteData = {
        id: planId,
        planId: planId, // 使用规划的唯一ID
        planType: planType,
        originalIndex: index,
        createdAt: new Date().toISOString(),
        parkId: this.data.currentParkId,
        planData: {
          ...plan,
          planId: planId, // 确保规划数据中也有planId
          favoriteId: planId // 保持向后兼容
        }
      };
      
      // 添加到收藏列表
      favoritePlans.push(favoriteData);
      
      // 保存到本地存储
      wx.setStorageSync('favoritePlans', favoritePlans);
      
      console.log('规划已收藏:', favoriteData);
      
    } catch (error) {
      console.error('保存收藏规划失败:', error);
      wx.showToast({
        title: '收藏失败',
        icon: 'none'
      });
    }
  },

  // 移除收藏的规划
  removeFavoritePlan(plan, planType, index) {
    try {
      // 获取现有收藏
      let favoritePlans = wx.getStorageSync('favoritePlans') || [];
      
      // 优先使用规划的唯一ID进行匹配
      if (plan.planId) {
        // 通过planId匹配
        favoritePlans = favoritePlans.filter(item => 
          !(item.planId === plan.planId && 
            item.parkId === this.data.currentParkId)
        );
      } else {
        // 向后兼容：如果没有planId，则使用旧的匹配方式
        favoritePlans = favoritePlans.filter(item => 
          !(item.planType === planType && 
            item.originalIndex === index && 
            item.parkId === this.data.currentParkId)
        );
      }
      
      // 保存到本地存储
      wx.setStorageSync('favoritePlans', favoritePlans);
      
      console.log('规划收藏已移除');
      
    } catch (error) {
      console.error('移除收藏规划失败:', error);
      wx.showToast({
        title: '取消收藏失败',
        icon: 'none'
      });
    }
  },

  // 检查并设置收藏状态
  checkFavoriteStatus(plansData) {
    try {
      const favoritePlans = wx.getStorageSync('favoritePlans') || [];
      const currentParkId = this.data.currentParkId;
      
      console.log('检查收藏状态，当前收藏的规划数量:', favoritePlans.length);
      
      // 为每个规划检查收藏状态
      Object.keys(plansData).forEach(planType => {
        if (Array.isArray(plansData[planType])) {
          plansData[planType].forEach((plan, index) => {
            if (plan) {
              // 确保每个规划都有唯一ID
              if (!plan.planId) {
                plan.planId = `plan_${planType}_${Date.now()}_${index}_${Math.random().toString(36).substr(2, 9)}`;
                console.log(`为规划 ${planType} #${index} 生成新的唯一ID: ${plan.planId}`);
              }
              
              // 严格使用planId进行匹配，不再使用旧的匹配方式
              const isFavorited = favoritePlans.some(favorite => 
                favorite.planId === plan.planId && 
                favorite.parkId === currentParkId
              );
              
              // 设置收藏状态
              plan.isFavorited = isFavorited;
              
              console.log(`规划 ${planType} #${index} (ID: ${plan.planId}) 收藏状态:`, isFavorited);
            }
          });
        }
      });
      
    } catch (error) {
      console.error('检查收藏状态失败:', error);
    }
  },

  initData() {
    // 初始化游乐场数据
    const parks = app.getAvailableParks();
    
    // 从全局数据获取当前游乐场ID和名称
    const currentParkId = app.globalData.currentParkId;
    const currentPark = app.getParkNameById(currentParkId);
    const currentParkIndex = parks.findIndex(park => park.id === currentParkId);
    
    this.setData({
      parks,
      currentPark,
      currentParkId,
      currentParkIndex: currentParkIndex >= 0 ? currentParkIndex : 0
    });
    
    // 监听游乐场切换事件
    app.globalEvents.on('parkChanged', this.handleParkChange.bind(this));
    
    // 监听收藏更新事件（如果有）
    if (app.globalEvents.on) {
      app.globalEvents.on('favoritesUpdated', this.loadFavorites.bind(this));
    }
    
    // 加载收藏列表
    this.loadFavorites();
  },

  // 计算离园时间
  calculateDepartureTime(plan) {
    try {
      if (!plan || !plan.schedule || !Array.isArray(plan.schedule) || plan.schedule.length === 0) {
        return '未知';
      }

      // 尝试找到最后一个项目的结束时间
      const lastItem = [...plan.schedule].sort((a, b) => {
        // 按照结束时间排序
        const aTime = a.end_time || '';
        const bTime = b.end_time || '';
        return aTime.localeCompare(bTime);
      }).pop();

      if (lastItem && lastItem.end_time) {
        // 返回最后一个项目的结束时间作为离园时间
        return lastItem.end_time;
      }

      // 如果没有明确的结束时间，则根据当前时间和总时长估算
      const now = new Date();
      const totalMinutes = (plan.total_wait_time || 0) + (plan.total_rest_time || 0) + (plan.total_play_time || 0);
      const departureTime = new Date(now.getTime() + totalMinutes * 60000);
      
      // 格式化为 HH:mm 格式
      const hours = departureTime.getHours().toString().padStart(2, '0');
      const minutes = departureTime.getMinutes().toString().padStart(2, '0');
      
      return `${hours}:${minutes}`;
    } catch (error) {
      console.error('计算离园时间时出错:', error);
      return '未知';
    }
  },

  // 分享给好友
  onShareAppMessage() {
    const { currentPark, currentParkId } = this.data;
    return {
      title: `我的${currentPark}游玩规划`,
      path: `/pages/plan/plan?parkId=${currentParkId}`,
      imageUrl: '/images/xiaoxiaolu_default_touxiang.jpg'
    };
  },

  // 分享到朋友圈
  onShareTimeline() {
    const { currentPark, currentParkId } = this.data;
    return {
      title: `我的${currentPark}游玩规划`,
      query: `parkId=${currentParkId}&from=timeline`,
      imageUrl: '/images/xiaoxiaolu_default_touxiang.jpg'
    };
  },

  // 检查旅行规划使用权限（使用统一的用户状态管理）
  async checkPlanningPermission() {
    try {
      console.log('检查旅行规划使用权限...');
      
      const permissionResult = await userService.checkPermission('planning');
      
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
            title: '旅行规划功能',
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
            title: '旅行规划次数不足',
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

      console.log('旅行规划权限检查通过，剩余次数:', permissionResult.userStatus.planningCount);
      return true;
      
    } catch (error) {
      console.error('检查旅行规划权限失败:', error);
      throw error;
    }
  },


  // 扣减旅行规划次数（使用统一的用户状态管理）
  async deductPlanningCount() {
    try {
      console.log('扣减旅行规划次数...');
      
      const result = await userService.deductCount('planning');
      
      if (result.success) {
        console.log('旅行规划次数扣减成功:', result.data);
        return result.data;
      } else {
        console.error('扣减旅行规划次数失败:', result.error);
        throw new Error(result.error || '扣减次数失败');
      }
      
    } catch (error) {
      console.error('扣减旅行规划次数异常:', error);
      throw error;
    }
  }
}) 