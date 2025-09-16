// 引入收藏服务
const favoritesService = require('../../utils/favoritesService');

// 计算两点之间的距离（米）
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000; // 地球半径（米）
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// 格式化距离显示
function formatDistance(distance) {
  if (distance > 1000) {
    return '>1公里';
  } else {
    return Math.round(distance) + '米';
  }
}

Page({
  // 颜色主题映射函数
  getColorByTheme(colorTheme) {
    const colorMap = {
      'green': 'rgba(83, 193, 120, 0.9)',
      'orange': 'rgba(245, 166, 35, 0.9)', 
      'red': 'rgba(230, 67, 64, 0.9)',
      'gray': 'rgba(136, 136, 136, 0.9)'
    };
    return colorMap[colorTheme] || colorMap['gray'];
  },

  data: {
    parks: [], // 改为空数组，从全局数据获取
    currentPark: '',
    currentParkId: '', // 当前游乐场ID
    currentParkIndex: 0, // 添加当前游乐场索引
    currentParkOperatingHours: '', // 添加当前游乐场营运时间
    isParkCurrentlyOpen: false, // 添加当前游乐场是否营运中的状态
    showParkPicker: false,
    showFavorites: false,
    loading: false,
    // 用户位置信息
    userLocation: {
      latitude: null,
      longitude: null
    },
    parkData: [], // 添加parkData字段初始化
    // 新增的信息大屏数据
    parkStatus: {
      crowdLevel: '人数较少',
      crowdColor: 'rgba(82, 196, 26, 0.9)',
      averageWaitTime: 0,
      openRides: 0,
      totalRides: 0
    },
    hotAttractions: [],
    upcomingShows: [],
    favoriteItems: [], // 新增的收藏项目数据
    notification: '',
    // 风格相关数据
    // 展开/折叠状态
    hotAttractionsExpanded: false, // 热门项目展开状态
    upcomingShowsExpanded: false, // 演出展开状态
    hotAttractionsAll: [], // 存储所有热门项目数据
    upcomingShowsAll: [] // 存储所有演出数据
  },

  onLoad() {
    console.log('【onLoad】页面加载开始');
    console.log('【onLoad】准备调用loadData');
    const app = getApp();
    // 从全局数据获取游乐场列表（已过滤广州长隆）
    const parks = app.getAvailableParks();
    
    // 使用当前游乐场ID从全局数据获取当前游乐场名称
    const currentParkId = app.globalData.currentParkId;
    const currentPark = app.getParkNameById(currentParkId);
    const currentParkIndex = parks.findIndex(park => park.id === currentParkId);
    
    this.setData({
      parks,
      currentPark,
      currentParkId,
      currentParkIndex: currentParkIndex >= 0 ? currentParkIndex : 0,
      currentParkOperatingHours: parks.find(park => park.id === currentParkId)?.operatingHours || ''
    });
    
    // 格式化营运时间显示
    this.formatOperatingHours();
    
    // 初始化收藏数据
    const { initParkData } = require('../../utils/data');
    initParkData(app.globalData);
    
    // 初始化营运时间
    this.formatOperatingHours();
    
    // 初始化主题风格
    this.initThemeStyle();
    
    // 获取用户位置
    this.getUserLocation();
    
    this.loadData();

    // 监听游乐场切换事件
    app.globalEvents.on('parkChanged', this.handleParkChange.bind(this));

    // 监听排队时间更新事件
    app.onQueueTimeUpdated = () => {
      this.updateParkDataWithQueueTime();
    };

    // 监听演出时间更新事件
    app.onPerformanceTimeUpdated = () => {
      this.updateParkDataWithPerformanceTime();
    };
  },

  onShow() {
    console.log('【onShow】页面显示');
    
    // 设置tabBar选中状态
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setSelected('pages/screen/screen');
    }
    
    // 移除页面级别的定时器，依赖全局定时器和事件机制
    // 全局定时器已经在app.js中每60秒更新数据，通过事件通知各页面更新UI
    
    // 更新营运时间
    this.formatOperatingHours();
    
    // 检查数据状态并强制重新加载
    const app = getApp();
    const currentParkId = this.data.currentParkId || app.globalData.currentParkId;
    console.log('【onShow】检查数据状态，currentParkId:', currentParkId);
    
    if (currentParkId) {
      const allItems = app.globalData.allItems[currentParkId] || [];
      console.log('【onShow】全局数据中的allItems长度:', allItems.length);
      
      if (allItems.length === 0) {
        console.log('【onShow】全局数据为空，强制重新加载');
        // 如果全局数据为空，强制重新加载
        this.loadData();
      } else {
        console.log('【onShow】使用现有数据刷新页面');
        // 刷新页面数据
        this.refreshPageData();
        
        // 立即更新排队时间和演出时间数据
        this.updateParkDataWithQueueTime();
        this.updateParkDataWithPerformanceTime();
      }
    } else {
      console.warn('【onShow】currentParkId未设置，尝试重新初始化');
      // 如果currentParkId未设置，尝试重新初始化
      const parks = app.getAvailableParks();
      
      const newCurrentParkId = app.globalData.currentParkId;
      const newCurrentPark = app.getParkNameById(newCurrentParkId);
      const newCurrentParkIndex = parks.findIndex(park => park.id === newCurrentParkId);
      
      this.setData({
        parks,
        currentPark: newCurrentPark,
        currentParkId: newCurrentParkId,
        currentParkIndex: newCurrentParkIndex >= 0 ? newCurrentParkIndex : 0,
        currentParkOperatingHours: parks.find(park => park.id === newCurrentParkId)?.operatingHours || ''
      });
      
      // 重新加载数据
      this.loadData();
    }
  },
  
  onHide() {
    // 页面隐藏时不需要特殊处理，全局定时器继续运行
  },
  
  onUnload() {
    // 移除事件监听
    const app = getApp();
    app.globalEvents.off('parkChanged', this.handleParkChange);
    app.onQueueTimeUpdated = null;
    app.onPerformanceTimeUpdated = null;
  },
  
  // 更新营运时间
  formatOperatingHours() {
    // 仅更新营运状态
    this.checkParkOpenStatus();
  },

  // 加载数据
  loadData() {
    console.log('【loadData】开始加载数据');
    const app = getApp();
    let currentParkId = this.data.currentParkId;
    
    // 确保currentParkId有值
    if (!currentParkId) {
      currentParkId = app.globalData.currentParkId;
      if (!currentParkId) {
        // 如果全局数据中也没有，使用默认值
        currentParkId = 'universal';
        app.globalData.currentParkId = currentParkId;
        console.log('【loadData】currentParkId未设置，使用默认值:', currentParkId);
      }
      // 更新页面数据
      this.setData({ currentParkId });
    }
    
    console.log('【loadData】当前游乐场ID:', currentParkId);
    console.log('【loadData】全局数据allItems:', app.globalData.allItems);
    
    // 确保数据结构初始化
    const { initParkData } = require('../../utils/data');
    initParkData(app.globalData);
    
    const allItems = app.globalData.allItems[currentParkId] || [];
    console.log('【loadData】从全局数据获取的allItems:', allItems);
    console.log('【loadData】allItems长度:', allItems.length);
    
    if (allItems && allItems.length > 0) {
      console.log('【loadData】使用全局数据，直接处理');
      // 如果全局数据中有数据，直接使用
      this.processData(allItems);
      this.updateParkStatusData(allItems);
    } else {
      console.log('【loadData】全局数据为空，发起网络请求');
      // 如果没有数据，发起请求
      wx.showLoading({
        title: '加载中...',
      });

      const { getParkData } = require('../../utils/data');
      console.log('【loadData】准备调用getParkData，参数:', {
        parkId: currentParkId,
        token: app.globalData.token ? '已设置' : '未设置'
      });
      
      getParkData(currentParkId, app.globalData.token)
        .then(data => {
          console.log('【loadData】网络请求成功，获取到数据:', data);
          console.log('【loadData】网络请求数据长度:', data ? data.length : 'undefined');
          console.log('【loadData】网络请求数据类型:', typeof data);
          console.log('【loadData】网络请求数据是否为数组:', Array.isArray(data));
          
          if (data && Array.isArray(data) && data.length > 0) {
            console.log('【loadData】前5个项目:', data.slice(0, 5).map(item => ({
              id: item.id,
              name: item.name,
              type: item.type
            })));
            
            // 检查全局数据是否已更新
            const updatedAllItems = app.globalData.allItems[currentParkId] || [];
            console.log('【loadData】网络请求后全局数据长度:', updatedAllItems.length);
            
            this.processData(data);
            this.updateParkStatusData(data);
          } else {
            console.warn('【loadData】网络请求返回的数据无效或为空');
            wx.showToast({
              title: '暂无数据',
              icon: 'none'
            });
          }
        })
        .catch(error => {
          console.error('【loadData】加载游乐场数据失败:', error);
          console.error('【loadData】错误详情:', {
            message: error.message,
            stack: error.stack,
            parkId: currentParkId
          });
          wx.showToast({
            title: error.message || '加载失败',
            icon: 'none'
          });
        })
        .finally(() => {
          wx.hideLoading();
        });
    }
  },
  
  // 更新园区状态数据
  updateParkStatusData(allItems) {
    console.log('【updateParkStatusData】开始更新园区状态数据');
    console.log('【updateParkStatusData】输入的allItems:', allItems);
    console.log('【updateParkStatusData】allItems长度:', allItems ? allItems.length : 'undefined');
    
    if (!allItems || !Array.isArray(allItems)) {
      console.warn('【updateParkStatusData】allItems无效，跳过更新');
      return;
    }
    
    // 计算园区状态
    const parkStatus = this.calculateParkStatus(allItems);
    console.log('【updateParkStatusData】计算的parkStatus:', parkStatus);
    
    // 获取热门项目
    const hotAttractionsData = this.getHotAttractions(allItems);
    console.log('【updateParkStatusData】获取的hotAttractions:', hotAttractionsData);
    
    // 获取即将开始的演出
    const upcomingShowsData = this.getUpcomingShows(allItems);
    console.log('【updateParkStatusData】获取的upcomingShows:', upcomingShowsData);
    
    // 获取用户收藏的项目
    const favoriteItems = this.getFavoriteItems(allItems);
    console.log('【updateParkStatusData】获取的favoriteItems:', favoriteItems);
    
    // 统一更新状态
    this.setData({
      parkStatus,
      hotAttractionsAll: hotAttractionsData.all,
      hotAttractions: hotAttractionsData.display,
      upcomingShowsAll: upcomingShowsData.all,
      upcomingShows: upcomingShowsData.display,
      favoriteItems
    });
    
    console.log('【updateParkStatusData】数据更新完成');
  },
  
  // 计算园区状态
  calculateParkStatus(allItems) {
    if (!allItems || !Array.isArray(allItems) || allItems.length === 0) {
      return {
        crowdLevel: '未知',
        crowdColor: 'rgba(82, 196, 26, 0.9)',
        averageWaitTime: 0,
        openRides: 0,
        totalRides: 0
      };
    }
    
    // 筛选游乐项目，先过滤掉无效元素
    const attractions = allItems.filter(item => item && item.type === 'attraction');
    if (attractions.length === 0) {
      return {
        crowdLevel: '未知',
        crowdColor: 'rgba(82, 196, 26, 0.9)',
        averageWaitTime: 0,
        openRides: 0,
        totalRides: 0
      };
    }
    
    // 计算开放的游乐项目数量
    const openRides = attractions.filter(item => item.queueTime !== -1).length;
    
    // 计算平均排队时间
    const waitTimes = attractions
      .filter(item => item.queueTime > 0)
      .map(item => parseInt(item.queueTime) || 0);
    
    const averageWaitTime = waitTimes.length > 0 
      ? Math.round(waitTimes.reduce((sum, time) => sum + time, 0) / waitTimes.length) 
      : 0;
    
    // 根据平均排队时间确定拥挤程度
    let crowdLevel = '';
    let crowdColor = '';
    
    if (averageWaitTime < 30) {
      crowdLevel = '人数较少';
      crowdColor = 'rgba(82, 196, 26, 0.9)'; // 绿色
    } else if (averageWaitTime < 60) {
      crowdLevel = '人数适中';
      crowdColor = 'rgba(255, 169, 64, 0.9)'; // 橙色
    } else {
      crowdLevel = '人数拥挤';
      crowdColor = 'rgba(255, 77, 79, 0.9)'; // 红色
    }
    
    return {
      crowdLevel,
      crowdColor,
      averageWaitTime,
      openRides,
      totalRides: attractions.length
    };
  },
  
  // 获取热门项目
  getHotAttractions(allItems) {
    console.log('【getHotAttractions】开始获取热门项目');
    console.log('【getHotAttractions】输入的allItems:', allItems);
    console.log('【getHotAttractions】allItems长度:', allItems ? allItems.length : 'undefined');
    
    if (!allItems || !Array.isArray(allItems) || allItems.length === 0) {
      console.warn('【getHotAttractions】allItems无效或为空，返回空数组');
      return {
        all: [],
        display: []
      };
    }

    // 过滤游乐项目，只保留开放且有排队时间的项目
    const allAttractions = allItems.filter(item => item && item.type === 'attraction');
    console.log('【getHotAttractions】所有游乐项目数量:', allAttractions.length);
    console.log('【getHotAttractions】所有游乐项目样本:', allAttractions.slice(0, 3).map(item => ({
      id: item.id,
      name: item.name,
      queueTime: item.queueTime,
      status: item.status,
      waitTime: item.waitTime,
      waitUnit: item.waitUnit
    })));
    
    const attractions = allAttractions.filter(item => {
      // 详细记录过滤过程
      const hasValidQueueTime = item.queueTime !== -1 && item.queueTime !== undefined && item.queueTime !== null;
      const isStatusOpen = item.status === '开放中';
      const isNotClosed = item.waitTime !== '关闭' && 
                         item.waitTime !== '关闭状态' && 
                         item.waitTime !== '已结束' && 
                         item.waitTime !== '暂停';
      
      // 放宽条件：只要有有效排队时间且不是明确关闭状态就算开放
      const isOpen = hasValidQueueTime && isNotClosed;
      
      if (!isOpen) {
        console.log(`【getHotAttractions】过滤掉项目 ${item.name}:`, {
          queueTime: item.queueTime,
          hasValidQueueTime,
          status: item.status,
          isStatusOpen,
          waitTime: item.waitTime,
          isNotClosed,
          最终结果: isOpen
        });
      } else {
        console.log(`【getHotAttractions】保留项目 ${item.name}:`, {
          queueTime: item.queueTime,
          status: item.status,
          waitTime: item.waitTime,
          waitUnit: item.waitUnit
        });
      }
      
      return isOpen;
    });
    
    console.log('【getHotAttractions】过滤后的开放attractions数量:', attractions.length);
    console.log('【getHotAttractions】过滤后的开放attractions:', attractions.map(item => ({
      id: item.id,
      name: item.name,
      type: item.type,
      queueTime: item.queueTime,
      status: item.status,
      waitTime: item.waitTime
    })));

    // 按排队时间从大到小排序（排队时间长的表示更热门）
    attractions.sort((a, b) => {
      const aTime = parseInt(a.queueTime) || 0;
      const bTime = parseInt(b.queueTime) || 0;
      const result = bTime - aTime;
      
      return result;
    });


    // 取前10个作为全部数据，直接使用原始数据中的waitTime、waitUnit和colorTheme
    const allResult = attractions.slice(0, 10).map(item => ({
      id: item.id,
      name: item.name,
      waitTime: item.waitTime,
      waitUnit: item.waitUnit,
      colorTheme: item.colorTheme,
      type: item.type,
      latitude: item.latitude,
      longitude: item.longitude,
      distance: this.calculateItemDistance(item),
      distanceText: this.calculateItemDistance(item) ? formatDistance(this.calculateItemDistance(item)) : ''
    }));
    
    // 根据展开状态决定显示的数据
    const displayResult = this.data.hotAttractionsExpanded ? allResult : allResult.slice(0, 3);
    
    console.log('【getHotAttractions】所有数据长度:', allResult.length);
    console.log('【getHotAttractions】显示数据长度:', displayResult.length);
    
    return {
      all: allResult,
      display: displayResult
    };
  },
  
  // 获取近期演出信息
  getUpcomingShows(allItems) {
    console.log('【getUpcomingShows】开始获取演出信息');
    console.log('【getUpcomingShows】输入的allItems:', allItems);
    console.log('【getUpcomingShows】allItems长度:', allItems ? allItems.length : 'undefined');
    
    if (!allItems || !Array.isArray(allItems) || allItems.length === 0) {
      console.warn('【getUpcomingShows】allItems无效或为空，返回空数组');
      return {
        all: [],
        display: []
      };
    }

    // 只取每个演出的 waitTime/waitUnit/colorTheme，先过滤掉无效元素
    const performances = allItems.filter(item => item && item.type === 'performance');
    console.log('【getUpcomingShows】过滤后的performances数量:', performances.length);
    console.log('【getUpcomingShows】过滤后的performances:', performances.map(item => ({
      id: item.id,
      name: item.name,
      type: item.type,
      waitTime: item.waitTime,
      status: item.status
    })));

    // 排序：开放且未结束的在前，已结束/关闭的在后，再按 waitTime
    performances.sort((a, b) => {
      const aActive = a.status === '开放中' && a.waitTime !== '已结束' && a.waitTime !== '关闭' && a.waitTime !== '关闭状态' && a.waitTime !== '暂停';
      const bActive = b.status === '开放中' && b.waitTime !== '已结束' && b.waitTime !== '关闭' && b.waitTime !== '关闭状态' && b.waitTime !== '暂停';
      if (aActive !== bActive) return bActive - aActive;
      // waitTime为数字的排前面
      const aTime = typeof a.waitTime === 'number' ? a.waitTime : 9999;
      const bTime = typeof b.waitTime === 'number' ? b.waitTime : 9999;
      return aTime - bTime;
    });


    // 取前10个作为全部数据，直接使用原始数据中的waitTime、waitUnit和colorTheme
    const allResult = performances.slice(0, 10).map(item => ({
      id: item.id,
      name: item.name,
      waitTime: item.waitTime,
      waitUnit: item.waitUnit,
      colorTheme: item.colorTheme,
      location: item.location,
      type: item.type,
      latitude: item.latitude,
      longitude: item.longitude,
      distance: this.calculateItemDistance(item),
      distanceText: this.calculateItemDistance(item) ? formatDistance(this.calculateItemDistance(item)) : ''
    }));
    
    // 根据展开状态决定显示的数据
    const displayResult = this.data.upcomingShowsExpanded ? allResult : allResult.slice(0, 3);
    
    console.log('【getUpcomingShows】所有数据长度:', allResult.length);
    console.log('【getUpcomingShows】显示数据长度:', displayResult.length);
    
    return {
      all: allResult,
      display: displayResult
    };
  },
  
  // 根据排队时间获取对应的背景颜色
  getQueueTimeColor(queueTime) {
    if (queueTime === -1) {
      return 'rgba(191, 191, 191, 0.9)'; // 关闭状态使用灰色
    } else if (queueTime >= 60) {
      return 'rgba(255, 77, 79, 0.9)'; // 红色，60分钟以上
    } else if (queueTime >= 30) {
      return 'rgba(255, 169, 64, 0.9)'; // 橙色，30-59分钟
    } else {
      return 'rgba(82, 196, 26, 0.9)'; // 绿色，30分钟以下
    }
  },

  // 处理数据
  processData(allItems) {
    console.log('【processData】开始处理数据，输入数据:', allItems);
    console.log('【processData】输入数据类型:', typeof allItems);
    console.log('【processData】输入数据是否为数组:', Array.isArray(allItems));
    console.log('【processData】输入数据长度:', allItems ? allItems.length : 'undefined');
    
    const app = getApp();
    
    try {
      // 检查输入数据
      if (!Array.isArray(allItems)) {
        console.error('【processData】输入数据不是数组:', allItems);
        allItems = [];
      }

      // 确保收藏数据存在
      if (!app.globalData.favorites[this.data.currentPark]) {
        console.log('【processData】初始化收藏数据');
        app.globalData.favorites[this.data.currentPark] = [];
      }
      
      // 设置parkData - 这是关键的缺失部分
      
      // 调试：检查演出项目的状态
      const performances = allItems.filter(item => item.type === 'performance');
      console.log('【processData】设置parkData前，演出项目状态检查:');
      performances.forEach(perf => {
        if (perf.name.includes('哈觅酷玛') || perf.name.includes('惊彩')) {
          console.log(`【processData】${perf.name}: waitTime=${perf.waitTime}, waitUnit=${perf.waitUnit}, status=${perf.status}`);
        }
      });
      
      this.setData({
        parkData: allItems
      });
      
      console.log('【processData】parkData已设置，长度:', allItems.length);
      console.log('【processData】前5个项目:', allItems.slice(0, 5).map(item => ({
        id: item.id,
        name: item.name,
        type: item.type
      })));
      
    } catch (error) {
      console.error('【processData】处理数据时发生错误:', error);
    }
  },

  // 修改游乐场选择方法
  onParkChange(e) {
    const index = e.detail.value;
    const park = this.data.parks[index];
    const parkId = park.id;
    const parkName = park.name;
    
    // 如果选择的是当前游乐场，不做操作
    if (parkName === this.data.currentPark) {
      return;
    }
    
    // 使用app的switchPark方法切换游乐场
    const app = getApp();
    app.switchPark(parkId);
  },

  // 新增收藏相关方法
  toggleFavorite(e) {
    const item = e.currentTarget.dataset.item;
    
    // 验证item
    if (!item) {
      console.error('toggleFavorite: item为空');
      wx.showToast({
        title: '收藏失败: 无效的项目',
        icon: 'none'
      });
      return;
    }
    
    // 确保item有id
    if (!item.id) {
      console.error('toggleFavorite: item没有id', item);
      wx.showToast({
        title: '收藏失败: 项目缺少ID',
        icon: 'none'
      });
      return;
    }
    
    const app = getApp();
    const currentPark = this.data.currentPark;
    
    // 使用收藏服务处理收藏
    try {
      favoritesService.toggleFavorite(app, currentPark, item, true, () => {
        // 获取最新的收藏列表
        const parkFavorites = favoritesService.getFavorites(app, currentPark);
        
        // 安全检查：确保parkData存在且是数组
        if (!this.data.parkData || !Array.isArray(this.data.parkData)) {
          console.log('parkData不存在或不是数组，跳过收藏状态更新');
          // 只更新收藏列表，不更新parkData
          this.setData({
            favorites: parkFavorites
          });
          return;
        }
        
        // 更新收藏状态
        const parkData = this.data.parkData.map(area => ({
          ...area,
          items: area.items.map(i => ({
            ...i,
            isFavorite: favoritesService.isFavorite(app, currentPark, i.id)
          }))
        }));
        
        // 重新计算所有数据以确保更新
        // 首先收集所有项目
        const allItems = [];
        parkData.forEach(area => {
          area.items.forEach(item => {
            allItems.push(item);
          });
        });
        
        // 使用与updateParkStatusData相同的逻辑重新计算所有数据
        const favoriteItems = this.getFavoriteItems(allItems);
        
        this.setData({
          favorites: parkFavorites,
          parkData: parkData,
          favoriteItems: favoriteItems
        });
      });
    } catch (error) {
      console.error('收藏操作失败:', error);
      wx.showToast({
        title: '收藏操作失败',
        icon: 'none'
      });
    }
  },

  // 搜索查询
  searchQuery(e) {
    const query = e.currentTarget.dataset.query;
    const { calculateSimilarity } = require('../../utils/utils');
    // 跳转到聊天tab
    wx.switchTab({
      url: '/pages/index/index',
      success: () => {
        // 获取聊天页面实例
        const pages = getCurrentPages();
        const chatPage = pages[pages.length - 1];
        if (chatPage && chatPage.route === 'pages/index/index') {
          // 延迟调用接口，确保页面加载完成
          setTimeout(() => {
            if (chatPage.handleExternalQuery) {
              chatPage.handleExternalQuery(query);
            }
          }, 1000);
        }
      }
    });
  },

  // 发送查询消息到聊天
  sendQueryMessage(query) {
    // 这里需要确保chat页面有sendMessage方法
    if (typeof this.sendMessage === 'function') {
      this.sendMessage(query);
    }
  },

  // 导航到收藏页面
  navigateToFavorites() {
    wx.navigateTo({
      url: '/pages/favorites/favorites'
    });
  },

  // 处理查看详情
  handleViewDetails(e) {
    const item = e.currentTarget.dataset.item;
    if (!item || !item.id) return;
    
    // 震动反馈
    wx.vibrateShort({
      type: 'light'
    });
    
    // 获取当前游乐场ID
    const app = getApp();
    const currentParkId = this.data.currentParkId || app.globalData.currentParkId;
    
    // 跳转到详情页面
    wx.navigateTo({
      url: `/pages/details/details?id=${item.id}&type=${item.type}&parkId=${currentParkId}`,
      fail: (err) => {
        console.error('跳转详情页失败:', err);
        wx.showToast({
          title: '无法打开详情页',
          icon: 'none'
        });
      }
    });
  },
  
  // 处理仪表盘项目点击
  handleDashboardItemClick(e) {
    const item = e.currentTarget.dataset.item;
    const type = e.currentTarget.dataset.type || (item && item.type);
    
    console.log('【仪表盘点击】接收到的点击事件数据:', {
      item: item,
      type: type,
      eventDataset: e.currentTarget.dataset
    });
    
    if (!item || !item.id) {
      console.warn('【仪表盘点击】无效的项目数据或缺少ID:', item);
      return;
    }
    
    // 震动反馈
    wx.vibrateShort({
      type: 'light'
    });
    
    // 获取当前游乐场ID
    const app = getApp();
    const currentParkId = this.data.currentParkId || app.globalData.currentParkId;
    
    // 记录跳转前的关键信息
    console.log('【仪表盘点击】准备跳转详情页，传递参数:', {
      id: item.id,
      name: item.name,
      type: type || item.type,
      parkId: currentParkId
    });
    
    // 检查全局数据中是否存在该ID的项目
    const parkItems = app.globalData.allItems[currentParkId] || [];
    const matchedItem = parkItems.find(i => i.id === item.id);
    console.log('【仪表盘点击】全局数据中是否存在匹配项目:', matchedItem ? {
      匹配: true,
      id: matchedItem.id,
      name: matchedItem.name,
      type: matchedItem.type
    } : '未找到匹配项目');
    
    // 跳转到详情页
    wx.navigateTo({
      url: `/pages/details/details?id=${item.id}&type=${type || item.type}&parkId=${currentParkId}`,
      success: (res) => {
        console.log('【仪表盘点击】跳转详情页成功');
      },
      fail: (err) => {
        console.error('【仪表盘点击】跳转详情页失败:', err);
        wx.showToast({
          title: '无法打开详情页',
          icon: 'none'
        });
      }
    });
  },
  
  // 切换显示收藏夹
  toggleFavorites() {
    this.setData({
      showFavorites: !this.data.showFavorites
    });
  },

  // 隐藏收藏浮层
  closeFavoritesPopup() {
    this.setData({
      showFavorites: false
    });
  },

  // 阻止事件冒泡
  preventBubble(e) {
    // 阻止事件冒泡
    return false;
  },

  // 阻止遮罩层滑动
  preventTouchMove(e) {
    // 阻止页面滚动
    return false;
  },


  // 初始化主题风格
  initThemeStyle() {
    // 从本地存储中获取已保存的风格设置
    wx.getStorage({
      key: 'screenStyle',
      success: (res) => {
        this.setData({
          styleType: res.data
        });

        // 同步到全局数据
        const app = getApp();
        if (app && app.globalData) {
          app.globalData.screenStyle = res.data;
        }
      },
      fail: () => {
        // 如果没有保存的设置，使用默认风格
        const app = getApp();
        if (app && app.globalData && app.globalData.screenStyle) {
          this.setData({
            styleType: app.globalData.screenStyle
          });
        }
      }
    });
  },

  // 处理游乐场变更事件
  handleParkChange({ parkId, parkName }) {
    // 更新当前游乐场
    const app = getApp();
    const parks = this.data.parks;
    const currentParkIndex = parks.findIndex(park => park.id === parkId);
    const selectedPark = parks.find(park => park.id === parkId);
    
    this.setData({
      currentParkId: parkId,
      currentPark: parkName,
      currentParkIndex: currentParkIndex >= 0 ? currentParkIndex : 0,
      currentParkOperatingHours: selectedPark?.operatingHours || '',
      // 清空数据
      hotAttractions: [],
      hotAttractionsAll: [],
      upcomingShows: [],
      upcomingShowsAll: [],
      favoriteItems: [],
      notification: '',
      // 重置展开状态
      hotAttractionsExpanded: false,
      upcomingShowsExpanded: false
    });
    
    // 格式化营运时间显示
    this.formatOperatingHours();
    
    // 重新加载数据，在loadData中会调用updateParkStatusData
    // 这会同时更新hotAttractions和favoriteItems，确保它们使用相同的逻辑
    this.loadData();
  },
  
  // 刷新页面数据
  refreshPageData() {
    const app = getApp();
    const currentPark = this.data.currentPark;
    
    // 更新收藏列表
    const parkFavorites = favoritesService.getFavorites(app, currentPark) || [];
    this.setData({
      favorites: parkFavorites
    });
    
    // 每次页面显示时重新加载数据，确保排队时间等信息是最新的
    const currentParkId = this.data.currentParkId;
    if (currentParkId) {
      const allItems = app.globalData.allItems[currentParkId] || [];
      if (allItems && allItems.length > 0) {
        // 如果全局数据中有数据，直接使用并更新UI
        this.processData(allItems);
        this.updateParkStatusData(allItems);
      } else {
        // 如果没有数据，重新加载
        this.loadData();
      }
    }
  },

  // 获取用户收藏的项目列表
  getFavoriteItems(allItems) {
    console.log('【收藏项目】开始处理收藏项目列表');
    
    if (!allItems || !Array.isArray(allItems) || allItems.length === 0) {
      console.warn('【收藏项目】allItems无效或为空数组');
      return [];
    }
    
    console.log('【收藏项目】allItems数组长度:', allItems.length);
    console.log('【收藏项目】allItems前5个项目:', allItems.slice(0, 5).map(item => ({ 
      id: item.id, 
      name: item.name,
      type: item.type 
    })));
    
    const app = getApp();
    const currentPark = this.data.currentPark;
    
    // 获取用户收藏列表
    const favorites = favoritesService.getFavorites(app, currentPark) || [];
    
    console.log('【收藏项目】获取到的收藏列表:', favorites.map(fav => 
      typeof fav === 'object' ? { id: fav.id, name: fav.name, type: fav.type } : { id: fav }
    ));
    
    if (favorites.length === 0) {
      console.log('【收藏项目】收藏列表为空');
      return [];
    }
    
    // 收集收藏的项目ID
    const favoriteIds = favorites.map(fav => {
      if (typeof fav === 'object') {
        return fav.id;
      }
      return fav;
    });
    
    console.log('【收藏项目】提取的收藏ID列表:', favoriteIds);
    
    // 在所有项目中找到收藏的项目
    const favoriteItems = [];
    allItems.forEach(item => {
      // 先检查item是否存在
      if (!item || !item.id) {
        return;
      }
      
      if (favoriteIds.includes(item.id)) {
        console.log(`【收藏项目】找到匹配的收藏项目:`, { 
          id: item.id, 
          name: item.name, 
          type: item.type,
          waitTime: item.waitTime,
          status: item.status
        });
        
        // 直接使用原始数据中的waitTime、waitUnit和colorTheme，与热门项目保持一致
        favoriteItems.push({
          id: item.id,
          name: item.name,
          waitTime: item.waitTime,
          waitUnit: item.waitUnit,
          colorTheme: item.colorTheme,
          type: item.type,
          status: item.status,
          latitude: item.latitude,
          longitude: item.longitude,
          distance: this.calculateItemDistance(item),
          distanceText: this.calculateItemDistance(item) ? formatDistance(this.calculateItemDistance(item)) : ''
        });
      }
    });
    
    console.log('【收藏项目】找到的收藏项目总数:', favoriteItems.length);
    
    if (favoriteItems.length === 0 && favoriteIds.length > 0) {
      console.warn('【收藏项目】警告: 有收藏ID但未在allItems中找到匹配项目');
      
      // 检查ID格式是否一致（数字vs字符串）
      console.log('【收藏项目】检查ID格式:');
      console.log('- favoriteIds类型:', favoriteIds.map(id => typeof id));
      console.log('- allItems中ID类型:', allItems.slice(0, 5).map(item => typeof item.id));
      
      // 尝试进行字符串比较
      const stringCompareMatches = [];
      favoriteIds.forEach(favId => {
        const stringFavId = String(favId);
        allItems.forEach(item => {
          // 先检查item是否存在
          if (!item || !item.id) {
            return;
          }
          
          if (String(item.id) === stringFavId) {
            stringCompareMatches.push({
              favoriteId: favId,
              itemId: item.id,
              name: item.name,
              type: item.type,
              typeFavId: typeof favId,
              typeItemId: typeof item.id
            });
          }
        });
      });
      
      console.log('【收藏项目】字符串比较找到的匹配:', stringCompareMatches);
      
      // 如果通过字符串比较找到了匹配项，使用这些匹配项
      if (stringCompareMatches.length > 0) {
        stringCompareMatches.forEach(match => {
          const item = allItems.find(i => i && i.id && String(i.id) === String(match.favoriteId));
          if (item) {
            favoriteItems.push({
              id: item.id,
              name: item.name,
              waitTime: item.waitTime,
              waitUnit: item.waitUnit,
              colorTheme: item.colorTheme,
              type: item.type,
              status: item.status,
              latitude: item.latitude,
              longitude: item.longitude,
              distance: this.calculateItemDistance(item),
              distanceText: this.calculateItemDistance(item) ? formatDistance(this.calculateItemDistance(item)) : ''
            });
          }
        });
      }
    }
    
    // 排序：开放状态的项目在前（按等待时间从小到大），关闭状态的项目在后
    favoriteItems.sort((a, b) => {
      // 先按是否开放排序（关闭状态包括：'关闭', '关闭状态', '已结束', '暂停'等）
      const aOpen = a.waitTime !== '已结束' && a.waitTime !== '关闭' && a.waitTime !== '关闭状态' && a.waitTime !== '暂停';
      const bOpen = b.waitTime !== '已结束' && b.waitTime !== '关闭' && b.waitTime !== '关闭状态' && b.waitTime !== '暂停';
      if (aOpen !== bOpen) return bOpen - aOpen;
      
      // 如果都是开放状态，按等待时间从小到大排序
      if (aOpen && bOpen) {
        const aTime = typeof a.waitTime === 'number' ? a.waitTime : 
                     (a.waitTime && !isNaN(parseInt(a.waitTime)) ? parseInt(a.waitTime) : 9999);
        const bTime = typeof b.waitTime === 'number' ? b.waitTime : 
                     (b.waitTime && !isNaN(parseInt(b.waitTime)) ? parseInt(b.waitTime) : 9999);
        
        if (aTime !== bTime) {
          return aTime - bTime; // 等待时间从小到大
        }
        
        // 如果等待时间相同，按名称排序
        return a.name.localeCompare(b.name);
      }
      
      // 如果都是关闭状态，按名称排序
      return a.name.localeCompare(b.name);
    });
    
    // 最多显示5个收藏项目
    const result = favoriteItems.slice(0, 5);
    console.log('【收藏项目】最终返回的收藏项目列表:', 
      result.map(item => ({ 
        id: item.id, 
        name: item.name, 
        type: item.type,
        waitTime: item.waitTime,
        status: item.status
      }))
    );
    
    return result;
  },

  // 使用缓存的排队时间数据更新园区数据
  updateParkDataWithQueueTime() {
    console.log('【updateParkDataWithQueueTime】开始更新排队时间数据');
    const app = getApp();
    const queueTimeData = app.getAllQueueTimeData();
    
    console.log('【updateParkDataWithQueueTime】获取到的排队时间数据:', queueTimeData);
    console.log('【updateParkDataWithQueueTime】排队时间数据项目数:', Object.keys(queueTimeData || {}).length);
    
    if (!queueTimeData || Object.keys(queueTimeData).length === 0) {
      console.log('【updateParkDataWithQueueTime】没有排队时间数据，跳过更新');
      return;
    }

    // 获取当前的allItems数据
    const currentParkId = this.data.currentParkId || app.globalData.currentParkId;
    const allItems = app.globalData.allItems[currentParkId] || [];
    
    console.log('【updateParkDataWithQueueTime】当前allItems长度:', allItems.length);
    
    if (!allItems || !Array.isArray(allItems) || allItems.length === 0) {
      console.log('【updateParkDataWithQueueTime】allItems无效或为空，跳过更新');
      return;
    }

    // 直接更新allItems中的排队时间数据
    let updatedCount = 0;
    const updatedAllItems = allItems.map(item => {
      if (!item || !item.id) {
        return item;
      }
      
      // 只更新游乐项目的排队时间
      if (item.type === 'attraction') {
        const queueData = queueTimeData[item.id];
        if (queueData) {
          console.log(`【updateParkDataWithQueueTime】更新项目 ${item.name} 的排队时间:`, {
            原始: { waitTime: item.waitTime, status: item.status },
            新数据: { waitTime: queueData.waitTime, status: queueData.status }
          });
          updatedCount++;
          
          // 创建更新后的项目对象，先更新基础数据
          const updatedItem = {
            ...item,
            queueTime: queueData.queueTime
          };
          
          console.log(`【updateParkDataWithQueueTime】${item.name} API返回的queueTime: ${queueData.queueTime}`);
          
          // 先应用时间判断逻辑
          const { createParkAdapter } = require('../../utils/dataAdapter');
          const adapter = createParkAdapter(currentParkId);
          if (adapter && typeof adapter.processAttractionDependencies === 'function') {
            console.log(`【updateParkDataWithQueueTime】更新前的项目数据:`, {
              name: updatedItem.name,
              openTime: updatedItem.openTime,
              closeTime: updatedItem.closeTime,
              waitTime: updatedItem.waitTime,
              waitUnit: updatedItem.waitUnit,
              status: updatedItem.status
            });
            
            adapter.processAttractionDependencies(updatedItem);
            
            console.log(`【updateParkDataWithQueueTime】应用时间判断逻辑后:`, {
              name: updatedItem.name,
              openTime: updatedItem.openTime,
              closeTime: updatedItem.closeTime,
              waitTime: updatedItem.waitTime,
              waitUnit: updatedItem.waitUnit,
              status: updatedItem.status,
              colorTheme: updatedItem.colorTheme
            });
          }
          
          // 检查时间判断逻辑是否已经设置了状态
          const timeLogicApplied = updatedItem.waitTime !== undefined && 
                                  (updatedItem.waitUnit === '小时后开放' || 
                                   updatedItem.waitUnit === '分钟后开放' || 
                                   updatedItem.waitUnit === '小时' ||        // 场次逻辑设置的小时
                                   updatedItem.waitUnit === '状态' ||        // 关闭状态的单位
                                   updatedItem.waitTime === '已结束' ||
                                   updatedItem.waitTime === '关闭' ||        // 演出关闭状态
                                   updatedItem.status === '未开放' ||
                                   updatedItem.status === '已关闭');
          
          console.log(`【updateParkDataWithQueueTime】${updatedItem.name} timeLogicApplied判断:`, {
            timeLogicApplied,
            waitTime: updatedItem.waitTime,
            waitUnit: updatedItem.waitUnit,
            status: updatedItem.status,
            原始waitTime: item.waitTime,
            条件检查: {
              waitTimeNotUndefined: updatedItem.waitTime !== undefined,
              waitUnitMatch: updatedItem.waitUnit === '小时后开放' || updatedItem.waitUnit === '分钟后开放' || updatedItem.waitUnit === '小时' || updatedItem.waitUnit === '状态',
              waitTimeMatch: updatedItem.waitTime === '已结束' || updatedItem.waitTime === '关闭',
              statusMatch: updatedItem.status === '未开放' || updatedItem.status === '已关闭'
            }
          });
          
          // 如果时间判断逻辑没有设置状态（即在开放时间内），则使用API数据
          if (!timeLogicApplied) {
            updatedItem.status = queueData.status;
            updatedItem.waitTime = queueData.waitTime;
            updatedItem.waitUnit = queueData.waitUnit;
            updatedItem.colorTheme = queueData.colorTheme;
            console.log(`【updateParkDataWithQueueTime】使用API数据:`, {
              name: updatedItem.name,
              waitTime: updatedItem.waitTime,
              waitUnit: updatedItem.waitUnit,
              status: updatedItem.status
            });
          } else {
            console.log(`【updateParkDataWithQueueTime】时间判断逻辑已设置状态，保持不变:`, {
              name: updatedItem.name,
              waitTime: updatedItem.waitTime,
              waitUnit: updatedItem.waitUnit,
              status: updatedItem.status
            });
          }
          
          return updatedItem;
        }
      }
      return item;
    });

    console.log(`【updateParkDataWithQueueTime】更新了 ${updatedCount} 个项目的排队时间`);

    // 更新全局数据
    app.globalData.allItems[currentParkId] = updatedAllItems;
    
    // 更新页面的parkData
    this.setData({
      parkData: updatedAllItems
    });

    // 重新计算园区状态数据
    this.updateParkStatusData(updatedAllItems);
    
    console.log('【updateParkDataWithQueueTime】排队时间更新完成');
  },

  // 更新演出时间数据
  updateParkDataWithPerformanceTime() {
    console.log('【updateParkDataWithPerformanceTime】开始更新演出时间数据');
    const app = getApp();
    const performanceTimeData = app.getAllPerformanceTimeData();
    
    console.log('【updateParkDataWithPerformanceTime】获取到的演出时间数据:', performanceTimeData);
    console.log('【updateParkDataWithPerformanceTime】演出时间数据项目数:', Object.keys(performanceTimeData || {}).length);
    
    if (!performanceTimeData || Object.keys(performanceTimeData).length === 0) {
      console.log('【updateParkDataWithPerformanceTime】没有演出时间数据，跳过更新');
      return;
    }

    // 获取当前的allItems数据
    const currentParkId = this.data.currentParkId || app.globalData.currentParkId;
    const allItems = app.globalData.allItems[currentParkId] || [];
    
    console.log('【updateParkDataWithPerformanceTime】当前allItems长度:', allItems.length);
    
    if (!allItems || !Array.isArray(allItems) || allItems.length === 0) {
      console.log('【updateParkDataWithPerformanceTime】allItems无效或为空，跳过更新');
      return;
    }

    // 直接更新allItems中的演出时间数据
    let updatedCount = 0;
    const updatedAllItems = allItems.map(item => {
      if (!item || !item.id) {
        return item;
      }
      
      // 只更新演出项目的时间数据
      if (item.type === 'performance') {
        const performanceData = performanceTimeData[item.id];
        if (performanceData) {
          console.log(`【updateParkDataWithPerformanceTime】更新项目 ${item.name} 的演出时间:`, {
            原始: { waitTime: item.waitTime, status: item.status },
            新数据: { waitTime: performanceData.timeToNext, status: performanceData.status }
          });
          updatedCount++;
          // 确保已结束的演出不显示时间单位
          let displayWaitUnit = performanceData.timeUnit;
          if (performanceData.timeToNext === '已结束' || performanceData.timeToNext === '已满' || 
              performanceData.timeToNext === '无场次' || performanceData.timeToNext === '数据错误' ||
              performanceData.timeToNext === '常驻' || performanceData.timeToNext === '关闭') {
            displayWaitUnit = '';
          }

          // 创建更新后的项目对象，先更新基础数据
          const updatedItem = {
            ...item,
            nextShow: performanceData.nextShow,
            nextShowTime: performanceData.nextShowTime,
            showTimes: performanceData.showTimes
          };
          
          // 先应用时间判断逻辑
          const { createParkAdapter } = require('../../utils/dataAdapter');
          const adapter = createParkAdapter(currentParkId);
          if (adapter && typeof adapter.processPerformanceDependencies === 'function') {
            console.log(`【updateParkDataWithPerformanceTime】更新前的项目数据:`, {
              name: updatedItem.name,
              openTime: updatedItem.openTime,
              closeTime: updatedItem.closeTime,
              waitTime: updatedItem.waitTime,
              waitUnit: updatedItem.waitUnit,
              status: updatedItem.status
            });
            
            adapter.processPerformanceDependencies(updatedItem);
            
            console.log(`【updateParkDataWithPerformanceTime】应用时间判断逻辑后:`, {
              name: updatedItem.name,
              openTime: updatedItem.openTime,
              closeTime: updatedItem.closeTime,
              waitTime: updatedItem.waitTime,
              waitUnit: updatedItem.waitUnit,
              status: updatedItem.status,
              colorTheme: updatedItem.colorTheme
            });
          }
          
          // 检查时间判断逻辑是否已经设置了状态
          const timeLogicApplied = updatedItem.waitTime !== undefined && 
                                  (updatedItem.waitUnit === '小时后开放' || 
                                   updatedItem.waitUnit === '分钟后开放' || 
                                   updatedItem.waitUnit === '小时' ||        // 场次逻辑设置的小时
                                   updatedItem.waitUnit === '状态' ||        // 关闭状态的单位
                                   updatedItem.waitTime === '已结束' ||
                                   updatedItem.waitTime === '关闭' ||        // 演出关闭状态
                                   updatedItem.status === '未开放' ||
                                   updatedItem.status === '已关闭');
          
          // 如果时间判断逻辑没有设置状态（即在开放时间内），则使用API数据
          if (!timeLogicApplied) {
            updatedItem.status = performanceData.status;
            updatedItem.timeToNext = performanceData.timeToNext;
            updatedItem.timeUnit = displayWaitUnit;
            updatedItem.colorTheme = performanceData.colorTheme;
            updatedItem.waitTime = performanceData.timeToNext;
            updatedItem.waitUnit = displayWaitUnit;
            console.log(`【updateParkDataWithPerformanceTime】使用API数据:`, {
              name: updatedItem.name,
              waitTime: updatedItem.waitTime,
              waitUnit: updatedItem.waitUnit,
              status: updatedItem.status
            });
          } else {
            console.log(`【updateParkDataWithPerformanceTime】时间判断逻辑已设置状态，保持不变:`, {
              name: updatedItem.name,
              waitTime: updatedItem.waitTime,
              waitUnit: updatedItem.waitUnit,
              status: updatedItem.status
            });
          }
          
          return updatedItem;
        }
      }
      return item;
    });

    console.log(`【updateParkDataWithPerformanceTime】更新了 ${updatedCount} 个项目的演出时间`);

    // 更新全局数据
    app.globalData.allItems[currentParkId] = updatedAllItems;
    
    // 更新页面的parkData
    this.setData({
      parkData: updatedAllItems
    });

    // 重新计算园区状态数据
    this.updateParkStatusData(updatedAllItems);
    
    console.log('【updateParkDataWithPerformanceTime】演出时间更新完成');
  },

  // 获取用户位置
  getUserLocation() {
    wx.getLocation({
      type: 'gcj02',
      success: (res) => {
        console.log('获取用户位置成功:', res);
        this.setData({
          userLocation: {
            latitude: res.latitude,
            longitude: res.longitude
          }
        });
        // 位置获取成功后，重新计算距离
        this.updateDistances();
      },
      fail: (err) => {
        console.warn('获取用户位置失败:', err);
        // 如果获取位置失败，使用当前游乐场位置作为默认位置
        const app = getApp();
        const parkConfig = app.getParkConfigById(this.data.currentParkId);
        if (parkConfig && parkConfig.latitude && parkConfig.longitude) {
          this.setData({
            userLocation: {
              latitude: parkConfig.latitude,
              longitude: parkConfig.longitude
            }
          });
          this.updateDistances();
        }
      }
    });
  },

  // 更新所有项目的距离信息
  updateDistances() {
    if (!this.data.userLocation.latitude || !this.data.userLocation.longitude) {
      return;
    }

    // 更新热门项目的距离
    if (this.data.hotAttractionsAll.length > 0) {
      const updatedHotAttractions = this.data.hotAttractionsAll.map(item => ({
        ...item,
        distance: this.calculateItemDistance(item),
        distanceText: this.calculateItemDistance(item) ? formatDistance(this.calculateItemDistance(item)) : ''
      }));

      this.setData({
        hotAttractionsAll: updatedHotAttractions,
        hotAttractions: this.data.hotAttractionsExpanded ? updatedHotAttractions : updatedHotAttractions.slice(0, 3)
      });
    }

    // 更新收藏项目的距离
    if (this.data.favoriteItems.length > 0) {
      const updatedFavorites = this.data.favoriteItems.map(item => ({
        ...item,
        distance: this.calculateItemDistance(item),
        distanceText: this.calculateItemDistance(item) ? formatDistance(this.calculateItemDistance(item)) : ''
      }));

      this.setData({
        favoriteItems: updatedFavorites
      });
    }

    // 更新即将演出的距离
    if (this.data.upcomingShowsAll.length > 0) {
      const updatedUpcomingShows = this.data.upcomingShowsAll.map(item => ({
        ...item,
        distance: this.calculateItemDistance(item),
        distanceText: this.calculateItemDistance(item) ? formatDistance(this.calculateItemDistance(item)) : ''
      }));

      this.setData({
        upcomingShowsAll: updatedUpcomingShows,
        upcomingShows: this.data.upcomingShowsExpanded ? updatedUpcomingShows : updatedUpcomingShows.slice(0, 3)
      });
    }
  },

  // 计算单个项目的距离
  calculateItemDistance(item) {
    if (!this.data.userLocation.latitude || !this.data.userLocation.longitude || 
        !item.latitude || !item.longitude) {
      return null;
    }

    return calculateDistance(
      this.data.userLocation.latitude,
      this.data.userLocation.longitude,
      parseFloat(item.latitude),
      parseFloat(item.longitude)
    );
  },




  // 格式化营运时间
  formatHours(hours) {
    if (!hours || typeof hours !== 'string') {
      return '营运时间未知';
    }
    
    // 处理不同的分隔符格式
    let openTime, closeTime;
    if (hours.includes(' - ')) {
      [openTime, closeTime] = hours.split(' - ');
    } else if (hours.includes('-')) {
      [openTime, closeTime] = hours.split('-');
    } else {
      return hours; // 如果格式不符合预期，直接返回原始字符串
    }
    
    if (!openTime || !closeTime) {
      return hours; // 如果分割失败，返回原始字符串
    }
    
    const formattedOpen = this.formatTime(openTime.trim());
    const formattedClose = this.formatTime(closeTime.trim());
    
    return `${formattedOpen}-${formattedClose}`;
  },

  // 格式化时间
  formatTime(time) {
    if (!time || typeof time !== 'string') {
      return '未知';
    }
    
    const [hours, minutes] = time.split(':');
    if (!hours || !minutes) {
      return '未知';
    }
    
    const formattedHours = hours.padStart(2, '0');
    const formattedMinutes = minutes.padStart(2, '0');
    
    return `${formattedHours}:${formattedMinutes}`;
  },

  // 格式化营运时间显示
  formatOperatingHours() {
    const parks = this.data.parks;
    const currentParkId = this.data.currentParkId;
    
    if (currentParkId && parks && parks.length > 0) {
      const park = parks.find(p => p.id === currentParkId);
      if (park && park.operatingHours) {
        const formattedHours = this.formatHours(park.operatingHours);
        const isOpen = this.isParkOpen(park.operatingHours);
        const displayText = isOpen ? `${formattedHours} (营运中)` : `${formattedHours} (已闭园)`;
        
        this.setData({
          currentParkOperatingHours: displayText,
          isParkCurrentlyOpen: isOpen
        });
      }
    }
  },

  // 判断游乐场是否在营运时间内
  isParkOpen(operatingHours) {
    if (!operatingHours || typeof operatingHours !== 'string') {
      return false;
    }
    
    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes(); // 转换为分钟
    
    // 处理不同的分隔符格式
    let openTime, closeTime;
    if (operatingHours.includes(' - ')) {
      [openTime, closeTime] = operatingHours.split(' - ');
    } else if (operatingHours.includes('-')) {
      [openTime, closeTime] = operatingHours.split('-');
    } else {
      return false;
    }
    
    if (!openTime || !closeTime) {
      return false;
    }
    
    // 解析开园时间
    const [openHour, openMinute] = openTime.trim().split(':').map(Number);
    const openTimeMinutes = openHour * 60 + (openMinute || 0);
    
    // 解析闭园时间
    const [closeHour, closeMinute] = closeTime.trim().split(':').map(Number);
    const closeTimeMinutes = closeHour * 60 + (closeMinute || 0);
    
    // 判断当前时间是否在营运时间内
    return currentTime >= openTimeMinutes && currentTime <= closeTimeMinutes;
  },

  // 切换热门项目展开状态
  toggleHotAttractions() {
    const expanded = !this.data.hotAttractionsExpanded;
    const allData = this.data.hotAttractionsAll || [];
    const displayData = expanded ? allData : allData.slice(0, 3);
    
    this.setData({
      hotAttractionsExpanded: expanded,
      hotAttractions: displayData
    });
    
    // 提供用户反馈
    wx.vibrateShort({
      type: 'light'
    });
    
    console.log('【toggleHotAttractions】热门项目展开状态切换:', expanded);
    console.log('【toggleHotAttractions】显示项目数量:', displayData.length);
  },

  // 切换演出展开状态
  toggleUpcomingShows() {
    const expanded = !this.data.upcomingShowsExpanded;
    const allData = this.data.upcomingShowsAll || [];
    const displayData = expanded ? allData : allData.slice(0, 3);
    
    this.setData({
      upcomingShowsExpanded: expanded,
      upcomingShows: displayData
    });
    
    // 提供用户反馈
    wx.vibrateShort({
      type: 'light'
    });
    
    console.log('【toggleUpcomingShows】演出展开状态切换:', expanded);
    console.log('【toggleUpcomingShows】显示项目数量:', displayData.length);
  },

  // 分享给好友
  onShareAppMessage() {
    const { currentPark, currentParkId } = this.data;
    return {
      title: `${currentPark}实时大屏 - 项目等候时间`,
      path: `/pages/screen/screen?parkId=${currentParkId}`,
      imageUrl: '/images/xiaoxiaolu_default_touxiang.jpg'
    };
  },

  // 分享到朋友圈
  onShareTimeline() {
    const { currentPark, currentParkId } = this.data;
    return {
      title: `${currentPark}实时大屏 - 项目等候时间`,
      query: `parkId=${currentParkId}&from=timeline`,
      imageUrl: '/images/xiaoxiaolu_default_touxiang.jpg'
    };
  }
}) 