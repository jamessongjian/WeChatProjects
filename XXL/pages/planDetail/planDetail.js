Page({
  data: {
    planTypes: [
      { id: 'comprehensive', name: '综合排序' },
      { id: 'shortest_wait_time', name: '排队最短' },
      { id: 'earliest_departure', name: '最快离园' }
    ],
    currentTabIndex: 0,
    plansData: {
      comprehensive: [],
      shortest_wait_time: [],
      earliest_departure: []
    },
    currentParkId: '',
    currentPark: ''
  },

  onLoad(options) {
    // 从全局数据中获取规划数据
    const app = getApp();
    
    // 获取当前游乐场ID和名称
    const currentParkId = app.globalData.currentParkId;
    const currentPark = app.getParkNameById(currentParkId);
    
    this.setData({
      currentParkId,
      currentPark
    });
    
    // 检查是否已加载项目数据
    if (!app.globalData.parkData || app.globalData.parkData.length === 0) {
      // 如果数据未加载，直接显示提示
      wx.showToast({
        title: '数据加载中，请稍候',
        icon: 'none'
      });
      // 延迟检查数据
      setTimeout(() => {
        if (app.globalData.routePlan) {
          this.processRoutePlan(app.globalData.routePlan);
        }
      }, 1000);
    } else if (app.globalData.routePlan) {
      this.processRoutePlan(app.globalData.routePlan);
    }
    
    // 监听游乐场切换事件
    app.globalEvents.on('parkChanged', this.handleParkChange.bind(this));
  },
  
  onUnload() {
    // 页面卸载时移除事件监听
    const app = getApp();
    app.globalEvents.off('parkChanged', this.handleParkChange);
  },
  
  // 处理游乐场变更事件
  handleParkChange({ parkId, parkName }) {
    this.setData({
      currentParkId: parkId,
      currentPark: parkName
    });
    
    // 如果有规划数据，重新处理
    const app = getApp();
    if (app.globalData.routePlan) {
      this.processRoutePlan(app.globalData.routePlan);
    }
  },

  // 切换标签页
  switchTab(e) {
    const index = e.currentTarget.dataset.index;
    this.setData({
      currentTabIndex: index
    });
  },

  processRoutePlan(routePlan) {
    console.log('正在处理规划数据:', routePlan);

    try {
      if (!routePlan) {
        console.error('规划数据为空');
        wx.showToast({
          title: '规划数据为空',
          icon: 'none'
        });
        return;
      }

      if (routePlan.type !== 'route') {
        console.error('无效的规划数据类型:', routePlan.type);
        wx.showToast({
          title: '无效的规划数据类型',
          icon: 'none'
        });
        return;
      }

      if (!routePlan.data) {
        console.error('规划数据缺少 data 字段');
        wx.showToast({
          title: '规划数据格式错误',
          icon: 'none'
        });
        return;
      }

      // 检查服务端返回的状态
      if (routePlan.data.status === 'error') {
        console.error('服务端返回错误:', routePlan.data.information);
        wx.showModal({
          title: '行程规划失败',
          content: routePlan.data.information || '行程中项目过多，无法在一天内完成游玩，请删减项目或者多天完成',
          showCancel: false,
          confirmText: '知道了',
          confirmColor: '#ff6b6b'
        });
        return;
      }

      const app = getApp();
      const currentParkId = this.data.currentParkId;
      const parkData = app.globalData.parkData && app.globalData.parkData[currentParkId] || [];
      
      // 从所有区域数据中提取项目信息
      const allItems = Array.isArray(parkData) ? parkData.reduce((acc, area) => {
        if (area && area.items && Array.isArray(area.items)) {
          return [...acc, ...area.items];
        }
        return acc;
      }, []) : [];

      // 初始化三种类型的规划数据结构
      const plansData = {
        comprehensive: [],
        shortest_wait_time: [],
        earliest_departure: []
      };

      // 处理每种类型的规划
      if (typeof routePlan.data === 'object') {
        Object.keys(routePlan.data).forEach(planType => {
          if (plansData.hasOwnProperty(planType) && Array.isArray(routePlan.data[planType])) {
            plansData[planType] = routePlan.data[planType].map((plan, index) => {
              if (!plan) return null;
              
              return {
                id: index + 1,
                totalTime: Math.round(plan.time_to_close || 0),
                totalWaitTime: Math.round(plan.total_wait_time || 0),
                totalRestTime: Math.round(plan.total_rest_time || 0),
                score: Math.round((plan.score || 0) * 10) / 10,
                items: Array.isArray(plan.schedule) ? plan.schedule.map(item => {
                  if (!item) return null;
                  
                  // 在全局数据中查找匹配的项目
                  const matchedItem = Array.isArray(allItems) ? 
                                      allItems.find(globalItem => globalItem && globalItem.name === item.name) : 
                                      null;
                  return {
                    id: item.name || `item_${Math.random().toString(36).substr(2, 9)}`,
                    name: item.name || '未命名项目',
                    startTime: item.start_time || '',
                    endTime: item.end_time || '',
                    queueTime: Math.round(item.wait_time || 0),
                    restTime: Math.round(item.rest_time || 0),
                    playDuration: item.play_duration || 15, // 默认游玩时间为15分钟
                    type: item.type || 'attraction',
                    imageUrl: (matchedItem && matchedItem.image) || null
                  };
                }).filter(Boolean) : [] // 过滤掉可能的空值
              };
            }).filter(Boolean); // 过滤掉可能的空值
          }
        });
      }

      // 计算排队时间节省提示
      this.calculateQueueTimeSavings(plansData);
      
      // 检查收藏状态
      this.checkFavoriteStatus(plansData);
      
      console.log('处理后的规划数据:', plansData);
      this.setData({ plansData });
      
    } catch (error) {
      console.error('处理规划数据出错:', error);
      wx.showToast({
        title: '处理规划数据时出错',
        icon: 'none'
      });
    }
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
    
    // 切换收藏状态
    plan.isFavorited = !wasFavorited;
    
    // 更新页面数据
    this.setData({
      [`plansData.${planType}[${index}].isFavorited`]: plan.isFavorited
    });
    
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
      
      // 生成唯一ID
      const favoriteId = `${planType}_${index}_${Date.now()}`;
      
      // 创建收藏数据
      const favoriteData = {
        id: favoriteId,
        planType: planType,
        originalIndex: index,
        createdAt: new Date().toISOString(),
        parkId: this.data.currentParkId,
        planData: {
          ...plan,
          favoriteId: favoriteId
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
      
      // 移除对应的收藏（通过planType和originalIndex匹配）
      favoritePlans = favoritePlans.filter(item => 
        !(item.planType === planType && 
          item.originalIndex === index && 
          item.parkId === this.data.currentParkId)
      );
      
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
      
      // 为每个规划检查收藏状态
      Object.keys(plansData).forEach(planType => {
        if (Array.isArray(plansData[planType])) {
          plansData[planType].forEach((plan, index) => {
            if (plan) {
              // 查找是否有对应的收藏
              const isFavorited = favoritePlans.some(favorite => 
                favorite.planType === planType && 
                favorite.originalIndex === index &&
                favorite.parkId === currentParkId
              );
              
              plan.isFavorited = isFavorited;
            }
          });
        }
      });
      
    } catch (error) {
      console.error('检查收藏状态失败:', error);
    }
  }
}) 