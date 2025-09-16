// 项目详情页
const favoritesService = require('../../utils/favoritesService');
const { submitSubscription, getWxLoginCode } = require('../../utils/api');

Page({
  data: {
    item: null,
    loading: true,
    isFavorite: false,
    showTimes: [],
    parkId: '',
    parkName: '',
    waitTimeData: null,
    hasWaitTimeData: false,
    maxWaitTime: 120, // 默认最大等待时间为120分钟
    waitTimeError: false,
    waitTimeErrorMsg: '',
    // 提醒面板相关数据
    showReminderPanel: false,
    selectedShowTime: '',
    selectedShowIndex: -1,
    reminderDate: '',
    todayDate: '',
    maxDate: '',
    advanceTimeOptions: [
      { value: 5, text: '提前5分钟' },
      { value: 10, text: '提前10分钟' },
      { value: 15, text: '提前15分钟' },
      { value: 30, text: '提前30分钟' },
      { value: 60, text: '提前1小时' }
    ],
    advanceTimeIndex: 1 // 默认选择提前10分钟
  },

  onLoad(options) {
    // 从options中获取项目ID和类型，以及排队时间数据
    const { id, type, parkId, waitTime, waitUnit, colorTheme } = options;
    
    
    if (!id || !type) {
      wx.showToast({
        title: '无效的项目信息',
        icon: 'none'
      });
      wx.navigateBack();
      return;
    }

    // 获取全局数据
    const app = getApp();
    
    // 确保只获取当前选中的游乐场数据
    const currentParkId = parkId || app.globalData.currentParkId;
    
    // 获取并打印可用的游乐场
    const availableParks = Object.keys(app.globalData.allItems || {}).concat(Object.keys(app.globalData.parkData || {}));
    
    const parkName = app.getParkNameById(currentParkId);

    // 保存传递过来的排队时间数据
    const passedWaitTimeData = waitTime !== undefined && waitUnit !== undefined ? {
      waitTime: decodeURIComponent(waitTime),
      waitUnit: decodeURIComponent(waitUnit),
      colorTheme: colorTheme || 'gray'
    } : null;
    

    this.setData({
      parkId: currentParkId,
      parkName,
      passedWaitTimeData: passedWaitTimeData
    });

    // 加载项目详情，只传入当前选中的游乐场ID
    this.loadItemDetails(id, type, currentParkId);
    
    // 如果是游乐设施，直接获取历史排队时间数据
    if (type === 'attraction' && (currentParkId === 'universal' || currentParkId === 'disney')) {
      // 等待项目详情加载完成后再获取排队时间数据
      setTimeout(() => {
        this.loadWaitTimeData();
      }, 500);
    }
  },

  onReady() {
    // 添加调试代码，检查餐厅详情数据
    if (this.data.item && this.data.item.type === 'restaurant') {
    }
  },

  onUnload() {
    // 移除事件监听器清理代码，因为我们不再使用事件监听
  },

  // 滚动到当前时间
  scrollToCurrentHour() {
    // 延迟执行，确保视图已渲染
    setTimeout(() => {
      const query = wx.createSelectorQuery();
      query.select('.current-hour').boundingClientRect();
      query.selectViewport().scrollOffset();
      query.exec((res) => {
        if (res && res[0]) {
          const currentHourElement = res[0];
          const scrollLeft = currentHourElement.left - 100; // 100是一个偏移量，使当前小时显示在中间位置
          
          wx.createSelectorQuery()
            .select('.chart-scroll-view')
            .node()
            .exec((res) => {
              if (res && res[0] && res[0].node) {
                const scrollView = res[0].node;
                scrollView.scrollLeft = scrollLeft;
              }
            });
        }
      });
    }, 300); // 延迟300ms执行
  },

  // 根据排队时间获取颜色主题
  getColorThemeByWaitTime(waitTime) {
    if (waitTime === undefined || waitTime === null) return 'gray';
    if (waitTime <= 0) return 'gray';
    if (waitTime <= 20) return 'green';
    if (waitTime <= 45) return 'orange';
    return 'red';
  },

  loadItemDetails(id, type, parkId) {
    this.setData({ loading: true });

    // 添加详细日志
    console.log('【详情页】正在加载项目详情，参数：', { id, type, parkId });

    const app = getApp();
    
    // 从app.globalData.allItems或app.globalData.parkData中获取数据，但只获取当前选中的游乐场数据
    const parkItems = app.globalData.allItems[parkId] || app.globalData.parkData[parkId];
    
    console.log('【详情页】查找到的parkItems数组长度：', parkItems ? parkItems.length : 0);
    
    if (!parkItems || parkItems.length === 0) {
      console.error('【详情页】无法获取数据，parkItems为空或不存在');
      wx.showToast({
        title: '无法获取数据',
        icon: 'none'
      });
      this.setData({ loading: false });
      return;
    }

    // 打印前10个项目的ID和名称，帮助调试
    console.log('【详情页】parkItems前10个项目:', 
      parkItems.slice(0, 10).map(item => ({ id: item.id, name: item.name }))
    );

    // 查找指定ID的项目 - 先尝试精确匹配
    let item = parkItems.find(item => item.id === id);
    
    // 如果精确匹配失败，尝试更灵活的匹配（针对复合ID格式）
    if (!item && id.includes(';')) {
      // 对于复合ID格式，尝试用分号前的部分匹配
      const baseId = id.split(';')[0];
      console.log(`【详情页】尝试使用基础ID "${baseId}" 匹配复合ID "${id}"`);
      item = parkItems.find(item => 
        item.id === baseId || 
        item.id.includes(baseId) ||
        (item.id.includes(';') && item.id.split(';')[0] === baseId)
      );
    }
    
    // 如果仍然找不到，尝试反向匹配（项目的ID可能包含查找的ID）
    if (!item) {
      console.log(`【详情页】尝试反向匹配，查找包含 "${id}" 的项目`);
      item = parkItems.find(item => 
        item.id && (item.id.includes(id) || id.includes(item.id))
      );
    }
    
    // 添加详细日志，记录当前请求的ID和找到的项目
    console.log(`【详情页】根据ID "${id}" 查找结果:`, item ? {
      找到: true,
      id: item.id,
      name: item.name,
      type: item.type,
      匹配方式: item.id === id ? '精确匹配' : '模糊匹配'
    } : '未找到项目');

    // 如果未找到项目，查找是否有名称或其他属性相似的项目，这可能有助于发现潜在的匹配问题
    if (!item) {
      // 尝试使用不同方式查找，看是否有相似ID但不完全匹配的情况
      const similarIdItems = parkItems.filter(i => 
        i.id && i.id.toString().includes(id.toString()) || 
        (id.toString().includes(i.id.toString()) && i.id.toString().length > 2)
      );
      
      console.log('【详情页】找不到精确匹配，但找到以下相似ID的项目:', 
        similarIdItems.map(i => ({ id: i.id, name: i.name }))
      );
      
      wx.showToast({
        title: '项目不存在',
        icon: 'none'
      });
      this.setData({ loading: false });
      return;
    }

    // 如果是演出项目，获取最新的演出时间数据
    if (item.type === 'performance') {
      console.log('【详情页】检测到演出项目，准备获取演出时间数据');
      console.log('【详情页】演出项目ID:', item.id);
      console.log('【详情页】演出项目名称:', item.name);
      console.log('【详情页】原始showTimes数据:', item.showTimes);
      
      const performanceTimeData = app.getAllPerformanceTimeData();
      console.log('【详情页】获取到的演出时间缓存:', performanceTimeData);
      console.log('【详情页】缓存中是否有该项目数据:', !!(performanceTimeData && performanceTimeData[item.id]));
      
      if (performanceTimeData && performanceTimeData[item.id]) {
        const latestPerformanceData = performanceTimeData[item.id];
        console.log('【详情页】获取到最新演出时间数据:', latestPerformanceData);
        
        // 更新项目的演出时间相关数据
        item = {
          ...item,
          showTimes: latestPerformanceData.showTimes || item.showTimes || [],
          nextShow: latestPerformanceData.nextShow,
          nextShowTime: latestPerformanceData.nextShowTime,
          waitTime: latestPerformanceData.timeToNext,
          waitUnit: latestPerformanceData.timeUnit,
          colorTheme: latestPerformanceData.colorTheme,
          status: latestPerformanceData.status
        };
        
        console.log('【详情页】更新后的演出项目数据:', {
          name: item.name,
          showTimesCount: item.showTimes ? item.showTimes.length : 0,
          waitTime: item.waitTime,
          status: item.status,
          showTimes: item.showTimes
        });
      } else {
        console.warn('【详情页】未找到演出时间缓存数据，使用原始数据');
        console.warn('【详情页】项目ID:', item.id);
        console.warn('【详情页】原始showTimes:', item.showTimes);
        console.warn('【详情页】缓存状态:', {
          hasCache: !!performanceTimeData,
          cacheKeys: performanceTimeData ? Object.keys(performanceTimeData) : [],
          targetId: item.id
        });
      }
    }

    // 使用favoritesService检查是否收藏
    const isFavorite = favoritesService.isFavorite(app, this.data.parkName, id);

    // 格式化项目数据
    const formattedItem = this.formatItemData(item);

    // 添加日志，查看餐厅详情数据
    if (formattedItem.type === 'restaurant') {
    }

    console.log('【详情页】🔴 准备设置页面数据:');
    console.log('【详情页】🔴 formattedItem.formattedShowTimes:', formattedItem.formattedShowTimes);
    console.log('【详情页】🔴 formattedShowTimes 长度:', formattedItem.formattedShowTimes ? formattedItem.formattedShowTimes.length : 0);
    if (formattedItem.formattedShowTimes && formattedItem.formattedShowTimes.length > 0) {
      console.log('【详情页】🔴 第一个场次数据:', formattedItem.formattedShowTimes[0]);
    }

    // 如果有传递过来的排队时间数据，优先使用
    if (this.data.passedWaitTimeData) {
      console.log('【详情页】使用传递的排队时间数据:', this.data.passedWaitTimeData);
      formattedItem.waitTime = this.data.passedWaitTimeData.waitTime;
      formattedItem.waitUnit = this.data.passedWaitTimeData.waitUnit;
      formattedItem.colorTheme = this.data.passedWaitTimeData.colorTheme;
    }

    this.setData({
      item: formattedItem,
      loading: false,
      isFavorite,
      showTimes: formattedItem.showTimes || []
    });
    
    console.log('【详情页】🔴 页面数据设置完成，当前 this.data.item.formattedShowTimes:', this.data.item.formattedShowTimes);
    
    console.log('【详情页】加载完成，显示项目:', { 
      id: formattedItem.id, 
      name: formattedItem.name, 
      type: formattedItem.type 
    });
  },

  formatItemData(item) {
    // 格式化项目数据，添加一些UI展示需要的字段
    const formattedItem = { ...item };

    // 处理未定义的字段
    formattedItem.location = formattedItem.location || '未知位置';
    formattedItem.summary = formattedItem.summary || '';
    formattedItem.detail = formattedItem.detail || '';
    formattedItem.flags = Array.isArray(formattedItem.flags) ? formattedItem.flags : [];
    formattedItem.suggestedQueries = Array.isArray(formattedItem.suggestedQueries) ? formattedItem.suggestedQueries : [];
    
    // 处理通知信息字段 - 只显示API返回的真实数据
    formattedItem.notification = formattedItem.notification || '';
    
    // 调试：打印通知信息相关数据
    console.log('【详情页调试】项目通知信息处理:', {
      项目名称: formattedItem.name,
      项目类型: formattedItem.type,
      原始通知字段: item.notification,
      最终通知内容: formattedItem.notification,
      通知内容长度: formattedItem.notification ? formattedItem.notification.length : 0,
      是否显示通知栏: !!formattedItem.notification,
      原始项目所有字段: Object.keys(item)
    });
    
    if (formattedItem.notification) {
      console.log('【详情页】✅ 发现通知信息，将显示通知栏:', {
        项目名称: formattedItem.name,
        通知内容: formattedItem.notification
      });
    } else {
      console.log('【详情页】❌ 未发现通知信息，不显示通知栏:', formattedItem.name);
    }

    // 确保图片URL有效
    if (!formattedItem.image || formattedItem.image === '') {
      formattedItem.image = '/images/placeholder.png';
    }

    // 设置特定类型的附加信息
    if (formattedItem.type === 'restaurant') {
      formattedItem.cuisine = formattedItem.cuisine || '多样美食';
      formattedItem.price = formattedItem.price || '¥¥';
      
      // 设置餐厅状态信息
      formattedItem.waitTime = formattedItem.waitTime || '营业中';
      formattedItem.waitUnit = formattedItem.waitUnit || '状态';
      formattedItem.colorTheme = formattedItem.colorTheme || 'green';
      
      // 处理新的开放时间和关闭时间格式
      if (formattedItem['开放时间'] && formattedItem['关闭时间']) {
        formattedItem.openTime = `${formattedItem['开放时间']}-${formattedItem['关闭时间']}`;
      } else {
        formattedItem.openTime = formattedItem.openTime || '全天';
      }
      
      // 处理产品列表数据 - 使用正确的字段访问方式
      if (formattedItem.products && Array.isArray(formattedItem.products)) {
        // 保留已有数据
      } else if (formattedItem['产品列表'] && Array.isArray(formattedItem['产品列表'])) {
        // 尝试从中文字段获取
        formattedItem.products = formattedItem['产品列表'].map(product => {
          // 确保图片URL有效
          if (!product.cover_image || product.cover_image === '') {
            product.cover_image = '/images/placeholder.png';
          }
          return product;
        });
      } else {
        // 如果没有产品列表，设为空数组
        formattedItem.products = [];
      }
      
      // 处理描述字段 - 使用正确的字段访问方式
      if (formattedItem.description && formattedItem.description.length > 0) {
        // 保留已有数据
      } else if (formattedItem['描述'] && formattedItem['描述'].length > 0) {
        formattedItem.description = formattedItem['描述'];
      } else if (formattedItem.detail && formattedItem.detail.length > 0) {
        // 尝试用detail字段作为备选
        formattedItem.description = formattedItem.detail;
      } else {
        formattedItem.description = '';
      }
      
      // 处理附加信息字段
      if (formattedItem.additionalInfo && formattedItem.additionalInfo.length > 0) {
        // 保留已有数据
      } else if (formattedItem['附加信息'] && formattedItem['附加信息'].length > 0) {
        formattedItem.additionalInfo = formattedItem['附加信息'];
      } else {
        formattedItem.additionalInfo = '';
      }
    } else if (formattedItem.type === 'performance') {
      // 处理新的开放时间和关闭时间格式
      if (formattedItem['开放时间'] && formattedItem['关闭时间']) {
        formattedItem.openTime = `${formattedItem['开放时间']}-${formattedItem['关闭时间']}`;
      } else {
        formattedItem.openTime = formattedItem.openTime || '全天';
      }
      
      // 确保showTimes是有效的数组
      if (!Array.isArray(formattedItem.showTimes)) {
        formattedItem.showTimes = [];
      }
      
      // 格式化演出时间
      console.log('【详情页】准备格式化演出时间，原始showTimes:', formattedItem.showTimes);
      console.log('【详情页】showTimes数据结构:', {
        type: typeof formattedItem.showTimes,
        isArray: Array.isArray(formattedItem.showTimes),
        length: formattedItem.showTimes ? formattedItem.showTimes.length : 'N/A',
        firstItem: formattedItem.showTimes && formattedItem.showTimes[0] ? formattedItem.showTimes[0] : 'N/A'
      });
      
      formattedItem.formattedShowTimes = this.formatShowTimes(formattedItem.showTimes);
      
      console.log('【详情页】格式化后的演出时间:', formattedItem.formattedShowTimes);
      console.log('【详情页】格式化后演出时间数量:', formattedItem.formattedShowTimes ? formattedItem.formattedShowTimes.length : 0);
      
      formattedItem.duration = formattedItem.duration || '约30分钟';
    } else if (formattedItem.type === 'attraction') {
      // 处理游乐设施新的开放时间和关闭时间格式
      if (formattedItem['开放时间'] && formattedItem['关闭时间']) {
        formattedItem.openTime = `${formattedItem['开放时间']}-${formattedItem['关闭时间']}`;
      } else {
        formattedItem.openTime = formattedItem.openTime || '全天';
      }
    } else {
      // 其他类型项目的开放时间
      formattedItem.openTime = formattedItem.openTime || '全天';
    }

    return formattedItem;
  },

  formatShowTimes(showTimes) {
    console.log('【详情页】formatShowTimes 输入数据:', showTimes);
    console.log('【详情页】formatShowTimes 输入数据类型:', typeof showTimes);
    console.log('【详情页】formatShowTimes 是否为数组:', Array.isArray(showTimes));
    console.log('【详情页】formatShowTimes 数据长度:', showTimes ? showTimes.length : 'N/A');
    
    if (!Array.isArray(showTimes) || showTimes.length === 0) {
      console.log('【详情页】showTimes 为空或不是数组，返回空数组');
      return [];
    }

    const result = showTimes.map((show, index) => {
      console.log(`【详情页】处理第${index + 1}个场次数据:`, show);
      
      // 支持多种时间字段名：time, 时间, 场次时间
      const timeField = show.time || show.时间 || show.场次时间;
      console.log(`【详情页】第${index + 1}个场次时间字段:`, timeField);
      
      if (!timeField) {
        console.warn('【详情页】场次数据缺少时间字段:', show);
        console.warn('【详情页】可用字段:', Object.keys(show));
        return null;
      }

      // 创建时间对象
      let showTime;
      try {
        // 简化时间处理，只处理HH:MM格式，假设都是今天的场次
        if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(timeField)) {
          const [hours, minutes] = timeField.split(':').map(num => parseInt(num, 10));
          showTime = new Date();
          showTime.setHours(hours, minutes, 0, 0);
        } else {
          return null;
        }
      } catch (err) {
        console.warn(`解析场次时间出错: ${err.message}`);
        return null;
      }

      // 格式化显示时间
      const now = new Date();
      const timeDiff = Math.max(0, Math.floor((showTime - now) / (1000 * 60)));
      const status = show.isFull ? '已满' : (timeDiff <= 0 ? '已结束' : `等待${timeDiff}分钟`);
      
      console.log(`【详情页】第${index + 1}个场次时间计算:`, {
        场次时间: timeField,
        当前时间: `${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}`,
        时间差分钟: timeDiff,
        是否已满: show.isFull,
        状态: status
      });
      
      // 根据等待时间设置颜色主题
      let colorTheme = 'gray';
      if (show.isFull) {
        colorTheme = 'red'; // 已满显示红色
      } else if (timeDiff <= 0) {
        colorTheme = 'gray'; // 已结束显示灰色
      } else {
        // 根据等待时间设置颜色
        if (timeDiff <= 30) {
          colorTheme = 'green'; // 30分钟内显示绿色
        } else if (timeDiff <= 60) {
          colorTheme = 'orange'; // 30-60分钟显示橙色
        } else {
          colorTheme = 'red'; // 60分钟以上显示红色
        }
      }
      
      console.log(`【详情页】第${index + 1}个场次颜色计算:`, {
        等待时间: timeDiff,
        颜色主题: colorTheme,
        计算逻辑: show.isFull ? '已满->红色' : (timeDiff <= 0 ? '已结束->灰色' : `等待${timeDiff}分钟->${colorTheme}`)
      });
      
      return {
        time: timeField,
        status: status,
        colorTheme: colorTheme,
        isFull: show.isFull,
        isPast: timeDiff <= 0
      };
    }).filter(Boolean);
    
    console.log('【详情页】formatShowTimes 输出结果:', result);
    console.log('【详情页】🔴 最终返回的场次数据详情:');
    result.forEach((item, index) => {
      console.log(`  场次${index + 1}: 时间=${item.time}, 状态=${item.status}, 颜色=${item.colorTheme}`);
    });
    return result;
  },

  handleFavorite() {
    const app = getApp();
    const { id } = this.data.item;
    
    // 使用favoritesService处理收藏
    favoritesService.toggleFavorite(app, this.data.parkName, id, true, (newState) => {
      this.setData({ isFavorite: newState });
    });
  },

  handleNavigation() {
    const index = favorites.indexOf(id);
    let isFavorite = false;
    
    if (index === -1) {
      // 添加到收藏
      favorites.push(id);
      isFavorite = true;
      wx.vibrateShort({ type: 'medium' });
      wx.showToast({
        title: '已添加到收藏',
        icon: 'success',
        duration: 1500
      });
    } else {
      // 从收藏中移除
      favorites.splice(index, 1);
      isFavorite = false;
      wx.vibrateShort({ type: 'light' });
      wx.showToast({
        title: '已取消收藏',
        icon: 'none',
        duration: 1500
      });
    }
    
    app.globalData.favorites[this.data.parkName] = favorites;
    wx.setStorageSync('favorites', app.globalData.favorites);
    
    this.setData({ isFavorite });
  },

  handleNavigation() {
    const { item } = this.data;
    if (!item || !item.latitude || !item.longitude) {
      wx.showToast({
        title: '无法获取位置信息',
        icon: 'none',
        duration: 2000
      });
      return;
    }
    
    // 使用微信内置地图打开位置
    wx.openLocation({
      latitude: parseFloat(item.latitude),
      longitude: parseFloat(item.longitude),
      name: item.name,
      address: item.location || '园区内',
      scale: 18
    });
  },

  handleShare() {
    // 微信小程序分享已通过onShareAppMessage处理
    wx.showToast({
      title: '请点击右上角分享',
      icon: 'none'
    });
  },

  handleQueryClick(e) {
    const query = e.currentTarget.dataset.query;
    if (!query) return;
    
    // 震动反馈
    wx.vibrateShort({ type: 'light' });
    
    // 获取当前项目名称
    const projectName = this.data.item?.name;
    
    // 组合查询内容：项目名称 + 原查询内容
    let combinedQuery = query;
    if (projectName) {
      combinedQuery = `${projectName} ${query}`;
    }
    
    // 跳转到index页面并传递查询参数
    wx.switchTab({
      url: '/pages/index/index',
      success: () => {
        // 将查询参数存入全局数据，让index页面可以读取
        const app = getApp();
        app.globalData.pendingQuery = combinedQuery;
        
        // 发布一个事件，通知index页面有新的查询
        if (app.globalEvents) {
          app.globalEvents.emit('newSearch', { query: combinedQuery });
        }
      }
    });
  },

  onShareAppMessage() {
    const { item } = this.data;
    if (!item) {
      return {
        title: '查看游乐园项目',
        path: '/pages/map/map'
      };
    }

    return {
      title: `${item.name} - ${this.data.parkName}`,
      path: `/pages/details/details?id=${item.id}&type=${item.type}&parkId=${this.data.parkId}`,
      imageUrl: item.image
    };
  },

  onShareTimeline() {
    const { item } = this.data;
    if (!item) {
      return {
        title: '发现有趣的游乐园项目',
        query: 'from=timeline'
      };
    }

    return {
      title: `${item.name} - ${this.data.parkName}`,
      query: `id=${item.id}&type=${item.type}&parkId=${this.data.parkId}&from=timeline`,
      imageUrl: item.image
    };
  },

  // 加载排队时间数据
  loadWaitTimeData() {
    const app = getApp();
    const currentItem = this.data.item;
    
    if (!currentItem || !currentItem.name) {
      console.warn('【详情页-历史数据】No current item or item name');
      this.setData({
        hasWaitTimeData: false,
        waitTimeError: true,
        waitTimeErrorMsg: '项目信息不完整'
      });
      return;
    }
    
    console.log('【详情页-历史数据】开始加载历史排队数据:', currentItem.name);
    console.log('【详情页-历史数据】当前时间:', new Date().toLocaleString());
    
    // 记录开始时间
    const startTime = Date.now();
    
    // 使用app的getAttractionHistoryData方法获取数据
    app.getAttractionHistoryData(currentItem.name, (historyData) => {
      const endTime = Date.now();
      const duration = endTime - startTime;
      console.log('【详情页-历史数据】请求完成，耗时:', duration + 'ms');
      if (historyData) {
        console.log('【详情页-历史数据】成功获取历史数据:', historyData);
        console.log('【详情页-历史数据】数据完整性检查:', {
          hasCurrentWaitTime: historyData.current_wait_time !== undefined,
          hasHistoricalData: !!historyData.historical_wait_times,
          hasTodayData: !!historyData.today_hourly_wait_times,
          isClosed: historyData.is_closed
        });
        
        // 构建排队时间数据对象
        const attractionData = {
          attraction_name: currentItem.name,
          current_wait_time: historyData.current_wait_time || currentItem.waitTime,
          is_closed: historyData.is_closed || false,
          historical_wait_times: historyData.historical_wait_times,
          today_hourly_wait_times: historyData.today_hourly_wait_times,
          current_hour: `${new Date().getHours().toString().padStart(2, '0')}:00`
        };

        // 计算今日最大等待时间，用于动态调整柱状图高度
        let maxWaitTime = 120; // 默认值
        
        // 从今日小时数据中找出最大值
        if (historyData.today_hourly_wait_times) {
          const todayWaitTimes = Object.values(historyData.today_hourly_wait_times)
            .map(item => item.wait_time)
            .filter(time => time > 0);
          
          if (todayWaitTimes.length > 0) {
            const todayMax = Math.max(...todayWaitTimes);
            maxWaitTime = Math.max(todayMax, maxWaitTime);
          }
        }
        
        // 从历史数据中找出最大值
        if (historyData.historical_wait_times) {
          const historyMax = Math.max(...Object.values(historyData.historical_wait_times));
          maxWaitTime = Math.max(historyMax, maxWaitTime);
        }
        
        // 设置最大值的上限，避免太小的数值导致图表比例不协调
        maxWaitTime = Math.max(maxWaitTime, 30);

        // 如果有当前等待时间，且没有传递过来的排队时间数据，才更新项目信息
        if (historyData.current_wait_time !== undefined && !this.data.passedWaitTimeData) {
          const item = { ...this.data.item };
          
          if (historyData.is_closed) {
            item.waitTime = '关闭';
            item.waitUnit = '状态';
            item.colorTheme = 'gray';
          } else {
            item.waitTime = historyData.current_wait_time;
            item.waitUnit = '分钟';
            item.colorTheme = this.getColorThemeByWaitTime(historyData.current_wait_time);
          }
          
          this.setData({ item });
          console.log('【详情页】使用历史数据更新排队时间:', item.waitTime, item.waitUnit);
        } else if (this.data.passedWaitTimeData) {
          console.log('【详情页】保持使用传递的排队时间数据，不使用历史数据覆盖');
        }

        this.setData({
          hasWaitTimeData: true,
          waitTimeError: false,
          waitTimeData: attractionData,
          maxWaitTime: maxWaitTime
        });

        // 滚动到当前时间
        this.scrollToCurrentHour();
      } else {
        console.warn('【详情页-历史数据】未获取到历史数据，可能原因：');
        console.warn('【详情页-历史数据】1. 网络请求超时（超过8秒）');
        console.warn('【详情页-历史数据】2. 服务器返回错误');
        console.warn('【详情页-历史数据】3. 认证失败（需要登录）');
        console.warn('【详情页-历史数据】4. 项目名称不匹配');
        console.warn('【详情页-历史数据】请求耗时:', duration + 'ms');
        
        // 根据耗时判断是否可能是超时
        let errorMsg = '暂无排队时间信息';
        if (duration >= 8000) {
          errorMsg = '加载超时，请检查网络连接';
          console.error('【详情页-历史数据】请求超时！耗时:', duration + 'ms');
        } else if (duration < 100) {
          errorMsg = '请先登录查看历史数据';
          console.warn('【详情页-历史数据】请求过快完成，可能是认证失败');
        }
        
        this.setData({
          hasWaitTimeData: false,
          waitTimeError: true,
          waitTimeErrorMsg: errorMsg
        });
      }
    });
  },

  // 初始化日期选择器
  initDatePicker() {
    const today = new Date();
    const maxDate = new Date();
    maxDate.setDate(today.getDate() + 30); // 限制最多提前30天设置提醒
    
    const formatDate = (date) => {
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    };
    
    this.setData({
      reminderDate: formatDate(today),
      todayDate: formatDate(today),
      maxDate: formatDate(maxDate)
    });
  },

  // 显示提醒面板
  showReminderPanel(e) {
    const { showTime, showIndex } = e.currentTarget.dataset;
    
    // 初始化日期选择器
    this.initDatePicker();
    
    this.setData({
      showReminderPanel: true,
      selectedShowTime: showTime,
      selectedShowIndex: parseInt(showIndex)
    });
  },

  // 隐藏提醒面板
  hideReminderPanel() {
    this.setData({
      showReminderPanel: false,
      selectedShowTime: '',
      selectedShowIndex: -1
    });
  },

  // 日期变化
  onDateChange(e) {
    this.setData({
      reminderDate: e.detail.value
    });
  },

  // 提前时间变化
  onAdvanceTimeChange(e) {
    this.setData({
      advanceTimeIndex: parseInt(e.detail.value)
    });
  },

  // 确认提醒
  confirmReminder() {
    const { item, selectedShowTime, reminderDate, advanceTimeOptions, advanceTimeIndex } = this.data;
    
    if (!item || !selectedShowTime || !reminderDate) {
      wx.showToast({
        title: '请完整填写提醒信息',
        icon: 'none'
      });
      return;
    }

    const advanceTime = advanceTimeOptions[advanceTimeIndex];
    const app = getApp();

    // 验证提醒时间是否为未来时间
    const showDateTime = new Date(`${reminderDate} ${selectedShowTime}`);
    const remindDateTime = new Date(showDateTime.getTime() - advanceTime.value * 60 * 1000);
    const now = new Date();

    console.log('=== 时间验证 ===');
    console.log('当前时间:', now.toLocaleString('zh-CN'));
    console.log('演出时间:', showDateTime.toLocaleString('zh-CN'));
    console.log('提醒时间:', remindDateTime.toLocaleString('zh-CN'));
    console.log('提醒时间是否为未来:', remindDateTime > now);
    console.log('================');

    if (remindDateTime <= now) {
      // 提醒时间不是未来时间，显示错误提示
      const timeDiff = Math.floor((now - remindDateTime) / (1000 * 60)); // 相差的分钟数
      
      let errorMessage = '提醒时间必须是未来时间';
      if (timeDiff < 60) {
        errorMessage = `提醒时间已过去${timeDiff}分钟，请选择未来的演出时间或减少提前时间`;
      } else if (timeDiff < 24 * 60) {
        const hours = Math.floor(timeDiff / 60);
        errorMessage = `提醒时间已过去${hours}小时，请选择未来的演出时间`;
      } else {
        const days = Math.floor(timeDiff / (24 * 60));
        errorMessage = `提醒时间已过去${days}天，请选择未来的演出时间`;
      }

      wx.showModal({
        title: '时间设置错误',
        content: errorMessage,
        showCancel: false,
        confirmText: '我知道了',
        confirmColor: '#ff4d4f'
      });
      
      console.log('=== 时间验证失败 ===');
      console.log('错误信息:', errorMessage);
      console.log('时间差:', timeDiff, '分钟');
      console.log('==================');
      return;
    }

    // 先请求订阅消息权限（必须在用户点击事件的同步阶段调用）
    const templateIds = app.globalData.subscribeMessageConfig.templateIds;
    
    console.log('=== 开始请求订阅权限 ===');
    console.log('模板ID:', templateIds);
    console.log('==================');

    wx.requestSubscribeMessage({
      tmplIds: templateIds,
      success: (subscribeRes) => {
        console.log('=== 订阅消息权限请求成功 ===');
        console.log('订阅结果:', subscribeRes);
        
        // 检查用户是否同意订阅
        const templateId = templateIds[0];
        const subscribeStatus = subscribeRes[templateId];
        
        console.log('模板ID:', templateId);
        console.log('订阅状态:', subscribeStatus);
        console.log('==================');
        
        if (subscribeStatus === 'accept') {
          // 用户同意订阅，继续登录和设置提醒流程
          console.log('用户同意订阅，开始登录流程');
          this.proceedWithLogin(item, selectedShowTime, reminderDate, advanceTime, app, true);
        } else if (subscribeStatus === 'reject') {
          // 用户拒绝订阅
          wx.showModal({
            title: '订阅被拒绝',
            content: '您拒绝了订阅消息权限，无法接收提醒通知。是否仅保存到本地？',
            confirmText: '本地保存',
            cancelText: '取消',
            success: (modalRes) => {
              if (modalRes.confirm) {
                this.proceedWithLogin(item, selectedShowTime, reminderDate, advanceTime, app, false);
              }
            }
          });
        } else if (subscribeStatus === 'ban') {
          // 模板被封禁
          wx.showModal({
            title: '订阅不可用',
            content: '该消息模板已被封禁，无法订阅。是否仅保存到本地？',
            confirmText: '本地保存',
            cancelText: '取消',
            success: (modalRes) => {
              if (modalRes.confirm) {
                this.proceedWithLogin(item, selectedShowTime, reminderDate, advanceTime, app, false);
              }
            }
          });
        } else {
          // 其他状态（如filter等）
          wx.showModal({
            title: '订阅失败',
            content: `订阅状态异常(${subscribeStatus})，是否仅保存到本地？`,
            confirmText: '本地保存',
            cancelText: '取消',
            success: (modalRes) => {
              if (modalRes.confirm) {
                this.proceedWithLogin(item, selectedShowTime, reminderDate, advanceTime, app, false);
              }
            }
          });
        }
      },
      fail: (subscribeError) => {
        console.log('=== 订阅消息权限请求失败 ===');
        console.error('订阅错误:', subscribeError);
        console.log('错误码:', subscribeError.errCode);
        console.log('错误信息:', subscribeError.errMsg);
        console.log('==================');
        
        // 根据错误码提供不同的处理方式
        let errorMsg = '订阅权限请求失败';
        if (subscribeError.errCode === 20004) {
          errorMsg = '您已关闭订阅消息主开关，无法订阅';
        } else if (subscribeError.errCode === 20005) {
          errorMsg = '小程序订阅消息功能被禁用';
        } else if (subscribeError.errCode === 10005) {
          errorMsg = '无法显示订阅界面，请重试';
        }
        
        wx.showModal({
          title: '订阅失败',
          content: `${errorMsg}，是否仅保存到本地？`,
          confirmText: '本地保存',
          cancelText: '取消',
          success: (modalRes) => {
            if (modalRes.confirm) {
              this.proceedWithLogin(item, selectedShowTime, reminderDate, advanceTime, app, false);
            }
          }
        });
      }
    });
  },

  // 继续登录流程
  proceedWithLogin(item, selectedShowTime, reminderDate, advanceTime, app, hasSubscribePermission) {
    // 显示登录加载提示
    wx.showLoading({
      title: '正在登录...',
      mask: true
    });

    // 进行微信登录获取openid
    getWxLoginCode()
      .then((loginResult) => {
        console.log('=== 微信登录成功 ===');
        console.log('登录结果:', loginResult);
        console.log('获取到的openid:', loginResult.openid);
        console.log('订阅权限:', hasSubscribePermission);
        console.log('==================');

        // 保存openid到全局数据
        app.globalData.openid = loginResult.openid;
        
        // 更新用户信息中的openid
        if (app.globalData.userInfo) {
          app.globalData.userInfo.openid = loginResult.openid;
        }

        // 保存到本地存储
        wx.setStorageSync('openid', loginResult.openid);

        // 使用获取到的openid作为用户ID
        const userId = loginResult.openid;

        if (hasSubscribePermission) {
          // 用户已授权订阅，继续完整的提醒设置流程
          this.proceedWithReminder(userId, item, selectedShowTime, reminderDate, advanceTime, app);
        } else {
          // 用户未授权订阅，仅保存到本地
          wx.hideLoading();
          this.saveLocalReminder(userId, item, selectedShowTime, reminderDate, advanceTime, app);
        }
      })
      .catch((loginError) => {
        // 登录失败处理
        console.log('=== 微信登录失败 ===');
        console.error('登录错误:', loginError.message);
        console.log('==================');
        
        // 隐藏加载提示
        wx.hideLoading();
        
        // 显示登录失败提示
        wx.showModal({
          title: '登录失败',
          content: `无法获取用户身份: ${loginError.message}。是否使用默认用户保存到本地？`,
          confirmText: '本地保存',
          cancelText: '取消',
          success: (res) => {
            if (res.confirm) {
              // 使用默认用户ID保存到本地
              const defaultUserId = 'default_user_' + Date.now();
              
              // 计算提醒时间
              const showDateTime = new Date(`${reminderDate} ${selectedShowTime}`);
              const remindDateTime = new Date(showDateTime.getTime() - advanceTime.value * 60 * 1000);
              
              const reminder = {
                id: `${item.id}_${selectedShowTime}_${Date.now()}`,
                performanceName: item.name,
                performanceId: item.id,
                showTime: selectedShowTime,
                reminderDate: reminderDate,
                advanceMinutes: advanceTime.value,
                advanceText: advanceTime.text,
                parkName: this.data.parkName,
                parkId: this.data.parkId,
                createTime: new Date().toISOString(),
                userId: defaultUserId
              };
              
              if (!app.globalData.reminders) {
                app.globalData.reminders = [];
              }
              
              app.globalData.reminders.push(reminder);
              wx.setStorageSync('reminders', app.globalData.reminders);
              
              wx.showToast({
                title: '已保存到本地',
                icon: 'success',
                duration: 2000
              });
              
              this.hideReminderPanel();
              
              console.log('=== 使用默认用户保存提醒 ===');
              console.log('演出名称:', item.name);
              console.log('提醒时间:', remindDateTime.toLocaleString('zh-CN'));
              console.log('默认用户ID:', defaultUserId);
              console.log('本地提醒数据:', reminder);
              console.log('==================');
            }
          }
        });
      });
  },

  // 继续设置提醒流程（用户已同意订阅）
  proceedWithReminder(userId, item, selectedShowTime, reminderDate, advanceTime, app) {
    // 计算提醒时间 (演出时间 - 提前时间)
    const showDateTime = new Date(`${reminderDate} ${selectedShowTime}`);
    const remindDateTime = new Date(showDateTime.getTime() - advanceTime.value * 60 * 1000);
    
    // 格式化为本地时间字符串（避免时区转换问题）
    const formatLocalDateTime = (date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      const seconds = String(date.getSeconds()).padStart(2, '0');
      return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    };
    
    // 构建提醒对象（本地存储用）
    const reminder = {
      id: `${item.id}_${selectedShowTime}_${Date.now()}`,
      performanceName: item.name,
      performanceId: item.id,
      showTime: selectedShowTime,
      reminderDate: reminderDate,
      advanceMinutes: advanceTime.value,
      advanceText: advanceTime.text,
      parkName: this.data.parkName,
      parkId: this.data.parkId,
      createTime: new Date().toISOString(),
      hasSubscribePermission: true // 标记用户已授权订阅
    };

    // 构建服务器订阅数据
    const subscriptionData = {
      message_id: reminder.id,
      user_id: userId,
      performance_name: item.name,
      performance_location: item.location || '园区内',
      park_name: this.data.parkName,
      remind_time: formatLocalDateTime(remindDateTime)
    };

    // 打印详细的提醒设置信息
    console.log('=== 设置提醒详细信息（已授权订阅）===');
    console.log('演出名称:', item.name);
    console.log('演出地点:', item.location || '园区内');
    console.log('游乐园:', this.data.parkName);
    console.log('演出时间:', `${reminderDate} ${selectedShowTime}`);
    console.log('提前时间:', advanceTime.text);
    console.log('演出时间对象:', showDateTime);
    console.log('提醒时间对象:', remindDateTime);
    console.log('提醒时间(本地格式):', formatLocalDateTime(remindDateTime));
    console.log('提醒时间(显示格式):', remindDateTime.toLocaleString('zh-CN'));
    console.log('用户ID:', userId);
    console.log('消息ID:', reminder.id);
    console.log('提交到服务器的数据:', JSON.stringify(subscriptionData, null, 2));
    console.log('========================');

    // 更新加载提示
    wx.showLoading({
      title: '设置提醒中...',
      mask: true
    });

    // 提交到服务器
    submitSubscription(subscriptionData)
      .then((result) => {
        console.log('=== 订阅提交成功 ===');
        console.log('服务器响应:', result);
        console.log('演出名称:', item.name);
        console.log('提醒时间:', remindDateTime.toLocaleString('zh-CN'));
        console.log('==================');
        
        // 保存到本地存储
        if (!app.globalData.reminders) {
          app.globalData.reminders = [];
        }
        
        app.globalData.reminders.push(reminder);
        wx.setStorageSync('reminders', app.globalData.reminders);
        
        // 隐藏加载提示
        wx.hideLoading();
        
        // 震动反馈
        wx.vibrateShort({ type: 'medium' });
        
        // 显示成功提示
        wx.showToast({
          title: '提醒设置成功',
          icon: 'success',
          duration: 2000
        });
        
        // 隐藏面板
        this.hideReminderPanel();
        
        console.log('=== 提醒保存完成 ===');
        console.log('本地提醒数据:', reminder);
        console.log('==================');
      })
      .catch((error) => {
        console.log('=== 订阅提交失败 ===');
        console.error('错误信息:', error.message);
        console.log('演出名称:', item.name);
        console.log('原始提醒时间:', `${reminderDate} ${selectedShowTime}`);
        console.log('计算的提醒时间:', remindDateTime.toLocaleString('zh-CN'));
        console.log('提交的数据:', JSON.stringify(subscriptionData, null, 2));
        console.log('==================');
        
        // 隐藏加载提示
        wx.hideLoading();
        
        // 检查是否是时间相关的错误
        const errorMessage = error.message || '';
        const isTimeError = errorMessage.includes('提醒时间必须是未来时间') || 
                           errorMessage.includes('时间') || 
                           errorMessage.includes('过期') ||
                           errorMessage.includes('未来');
        
        if (isTimeError) {
          // 时间相关错误，不提供本地保存选项
          wx.showModal({
            title: '时间设置错误',
            content: `${errorMessage}\n\n请重新选择演出时间或调整提前时间。`,
            showCancel: false,
            confirmText: '我知道了',
            confirmColor: '#ff4d4f'
          });
          
          console.log('=== 服务器时间验证失败 ===');
          console.log('时间错误信息:', errorMessage);
          console.log('==================');
        } else {
          // 其他服务器错误，提供本地保存选项
          wx.showModal({
            title: '提醒设置失败',
            content: `服务器错误: ${errorMessage}。是否仅保存到本地？`,
            confirmText: '仅本地保存',
            cancelText: '取消',
            success: (res) => {
              if (res.confirm) {
                // 用户选择仅保存到本地
                if (!app.globalData.reminders) {
                  app.globalData.reminders = [];
                }
                
                app.globalData.reminders.push(reminder);
                wx.setStorageSync('reminders', app.globalData.reminders);
                
                wx.showToast({
                  title: '已保存到本地',
                  icon: 'success',
                  duration: 2000
                });
                
                this.hideReminderPanel();
                console.log('=== 仅本地保存提醒 ===');
                console.log('演出名称:', item.name);
                console.log('提醒时间:', remindDateTime.toLocaleString('zh-CN'));
                console.log('本地提醒数据:', reminder);
                console.log('==================');
              }
            }
          });
        }
      });
  },

  // 仅保存到本地（用户拒绝订阅或其他原因）
  saveLocalReminder(userId, item, selectedShowTime, reminderDate, advanceTime, app) {
    // 计算提醒时间
    const showDateTime = new Date(`${reminderDate} ${selectedShowTime}`);
    const remindDateTime = new Date(showDateTime.getTime() - advanceTime.value * 60 * 1000);
    
    const reminder = {
      id: `${item.id}_${selectedShowTime}_${Date.now()}`,
      performanceName: item.name,
      performanceId: item.id,
      showTime: selectedShowTime,
      reminderDate: reminderDate,
      advanceMinutes: advanceTime.value,
      advanceText: advanceTime.text,
      parkName: this.data.parkName,
      parkId: this.data.parkId,
      createTime: new Date().toISOString(),
      userId: userId,
      hasSubscribePermission: false // 标记用户未授权订阅
    };
    
    if (!app.globalData.reminders) {
      app.globalData.reminders = [];
    }
    
    app.globalData.reminders.push(reminder);
    wx.setStorageSync('reminders', app.globalData.reminders);
    
    wx.showToast({
      title: '已保存到本地',
      icon: 'success',
      duration: 2000
    });
    
    this.hideReminderPanel();
    
    console.log('=== 仅本地保存提醒 ===');
    console.log('演出名称:', item.name);
    console.log('提醒时间:', remindDateTime.toLocaleString('zh-CN'));
    console.log('用户ID:', userId);
    console.log('订阅权限:', false);
    console.log('本地提醒数据:', reminder);
    console.log('==================');
  }
}) 