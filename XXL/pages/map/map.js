const { createParkAdapter } = require('../../utils/dataAdapter');
const { parkNameToId, parkIdToName } = require('../../utils/data');
// 引入收藏服务
const favoritesService = require('../../utils/favoritesService');

// 定义基础聚合距离（米）
const BASE_CLUSTER_DISTANCE = 100;
// 添加缓存对象，用于缓存不同缩放级别的marker状态
const markerCache = {};
// 添加批量渲染相关的常量
const BATCH_SIZE = 20; // 每批渲染的marker数量
const BATCH_DELAY = 50; // 批量渲染的时间间隔（毫秒）
// marker重叠检测配置
const MARKER_OVERLAP_CONFIG = {
  threshold: 5, // 重叠检测阈值（米）
  adjustmentDistance: 0.000045, // 调整距离（经纬度），约10米偏移
  maxIterations: 5, // 最大迭代次数
  enableVisualFeedback: true // 是否启用视觉反馈
};

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

Page({
  data: {
    latitude: 39.9042,
    longitude: 116.4074,
    markers: [],
    visibleMarkers: [], // 添加可见标记数组
    scale: 16,
    currentPark: '',
    currentParkId: '', // 添加游乐场ID字段
    selectedMarker: null,
    activeFilter: 'all',
    allMarkers: [],
    showCard: false,
    cardInfo: null,
    customCalloutMarkerIds: [],
    showParkPicker: false,
    parks: [],
    filterClosed: false,
    filterButtons: [],
    currentParkIndex: 0,
    hasEnded: false, // 标记是否刚处理过end事件
    updateNeeded: false, // 是否需要更新
    clusterMarkers: [], // 聚合点标记
    compassEnabled: false, // 指南针是否启用
    _hasInitializedScale: false, // 标记是否已经初始化缩放级别
    mapContextReady: false, // 地图上下文是否就绪
    mapError: false, // 地图是否出错
  },

  onLoad(options) {
    const app = getApp();
    // 从全局数据获取游乐场列表（已过滤广州长隆）
    const parks = app.getAvailableParks();
    
    // 从全局数据获取当前游乐场ID
    const currentParkId = app.globalData.currentParkId;
    const currentPark = app.getParkNameById(currentParkId);
    
    // 计算当前游乐场在列表中的索引
    const currentParkIndex = parks.findIndex(park => park.id === currentParkId);
    
    const parkData = app.getParkConfigById(currentParkId);
    
    // 生成筛选按钮
    const filterButtons = this.generateFilterButtons(currentParkId);
    
    // 获取当前游乐场的默认缩放级别，如果没有则使用默认值16
    const defaultScale = parkData.mapConfig?.defaultScale || 16;
    
    this.setData({
      parks,
      currentPark,
      currentParkId,
      currentParkIndex,
      latitude: parkData.latitude,
      longitude: parkData.longitude,
      filterButtons,
      activeFilter: parkData.filterConfig?.defaultFilter || 'all',
      filterClosed: false,
      scale: defaultScale
    });
    
    // 初始化地图上下文
    console.log('🗺️ 开始创建地图上下文...');
    try {
      this.mapCtx = wx.createMapContext('map');
      
      // 检查地图上下文是否创建成功
      if (this.mapCtx) {
        console.log('✅ 地图上下文创建成功');
        
        // 进一步验证地图上下文是否可用
        setTimeout(() => {
          this.validateMapContext();
        }, 1000);
      } else {
        console.error('❌ 地图上下文创建失败：mapCtx为空');
        this.handleMapContextError('地图上下文创建失败');
      }
    } catch (error) {
      console.error('❌ 地图上下文创建异常:', error);
      this.handleMapContextError(`地图上下文创建异常: ${error.message}`);
    }
    
    // 加载最新数据
    this.loadParkData().then(() => {
      // 数据加载完成后，立即更新演出时间数据
      setTimeout(() => {
        this.updateMarkersWithPerformanceTime();
      }, 100);
    }).catch(error => {
      console.error('首次加载数据失败:', error);
    });
    
    // 监听游乐场切换事件
    app.globalEvents.on('parkChanged', this.handleParkChange.bind(this));
    
    // 监听排队时间更新事件
    app.onQueueTimeUpdated = () => {
      this.updateMarkersWithQueueTime();
    };

    // 监听演出时间更新事件
    app.onPerformanceTimeUpdated = () => {
      this.updateMarkersWithPerformanceTime();
    };
  },
  
  onShow() {
    // 设置tabBar选中状态
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setSelected('pages/map/map');
    }
    
    // 页面显示时，立即更新排队时间和演出时间数据
    this.updateMarkersWithQueueTime();
    this.updateMarkersWithPerformanceTime();
    
    // 启动数据刷新定时器（每分钟刷新一次）
    if (!this.dataRefreshInterval) {
      this.dataRefreshInterval = setInterval(() => {
        this.updateMarkersWithQueueTime();
        this.updateMarkersWithPerformanceTime();
      }, 60000);
    }
  },

  onHide() {
    // 页面隐藏时，清除数据刷新定时器
    if (this.dataRefreshInterval) {
      clearInterval(this.dataRefreshInterval);
      this.dataRefreshInterval = null;
    }
  },
  
  onUnload() {
    // 页面卸载时移除事件监听
    const app = getApp();
    app.onQueueTimeUpdated = null;
    app.onPerformanceTimeUpdated = null;
    
    // 清除数据刷新定时器
    if (this.dataRefreshInterval) {
      clearInterval(this.dataRefreshInterval);
      this.dataRefreshInterval = null;
    }
  },

  // 验证地图上下文是否可用
  validateMapContext() {
    if (!this.mapCtx) {
      console.error('❌ 地图上下文不存在，无法验证');
      return;
    }
    
    console.log('🔍 验证地图上下文可用性...');
    
    // 尝试调用地图上下文的方法来验证是否可用
    this.mapCtx.getScale({
      success: (res) => {
        console.log('✅ 地图上下文验证成功，当前缩放级别:', res.scale);
        this.setData({
          mapContextReady: true
        });
      },
      fail: (err) => {
        console.error('❌ 地图上下文验证失败:', err);
        this.handleMapContextError(`地图上下文不可用: ${err.errMsg || '未知错误'}`);
      }
    });
  },

  // 处理地图上下文错误
  handleMapContextError(errorMsg) {
    console.error('🚨 地图上下文错误:', errorMsg);
    
    this.setData({
      mapContextReady: false,
      mapError: true
    });
    
    // 显示错误提示
    wx.showModal({
      title: '地图初始化失败',
      content: `${errorMsg}\n\n可能原因：\n1. 地图组件未正确加载\n2. 页面DOM结构问题\n3. 小程序版本兼容性问题`,
      showCancel: true,
      cancelText: '稍后重试',
      confirmText: '重新初始化',
      success: (res) => {
        if (res.confirm) {
          this.retryMapInitialization();
        }
      }
    });
  },

  // 重试地图初始化
  retryMapInitialization() {
    console.log('🔄 重试地图初始化...');
    
    wx.showLoading({
      title: '重新初始化地图...'
    });
    
    setTimeout(() => {
      try {
        this.mapCtx = wx.createMapContext('map');
        
        if (this.mapCtx) {
          console.log('✅ 地图上下文重新创建成功');
          this.validateMapContext();
        } else {
          console.error('❌ 地图上下文重新创建仍然失败');
          wx.showToast({
            title: '地图初始化失败，请重启小程序',
            icon: 'none',
            duration: 3000
          });
        }
      } catch (error) {
        console.error('❌ 重试地图初始化异常:', error);
        wx.showToast({
          title: '地图初始化异常，请重启小程序',
          icon: 'none',
          duration: 3000
        });
      }
      
      wx.hideLoading();
    }, 1000);
  },

  // 安全的地图区域获取方法
  safeGetRegion(options = {}) {
    // 初始化重试计数
    if (!options._retryCount) {
      options._retryCount = 0;
    }
    
    if (!this.mapCtx) {
      if (options._retryCount === 0) {
        console.error('❌ 地图上下文不存在，无法获取区域');
      }
      if (options.fail) {
        options.fail(new Error('地图上下文不存在'));
      }
      return;
    }

    if (!this.data.mapContextReady) {
      options._retryCount++;
      
      // 限制重试次数，避免无限重试
      if (options._retryCount > 10) {
        if (options.fail) {
          options.fail(new Error('地图上下文初始化超时'));
        }
        return;
      }
      
      // 只在第一次和每5次重试时输出日志
      if (options._retryCount === 1 || options._retryCount % 5 === 0) {
        console.warn(`⚠️ 地图上下文尚未就绪，第${options._retryCount}次重试获取区域`);
      }
      
      setTimeout(() => {
        this.safeGetRegion(options);
      }, 500);
      return;
    }

    // 重置重试计数并获取区域
    options._retryCount = 0;
    this.mapCtx.getRegion({
      success: (res) => {
        if (options.success) {
          options.success(res);
        }
      },
      fail: (err) => {
        console.error('❌ 地图区域获取失败:', err);
        if (options.fail) {
          options.fail(err);
        }
      }
    });
  },

  // 安全的地图缩放获取方法
  safeGetScale(options = {}) {
    // 初始化重试计数
    if (!options._retryCount) {
      options._retryCount = 0;
    }
    
    if (!this.mapCtx) {
      if (options._retryCount === 0) {
        console.error('❌ 地图上下文不存在，无法获取缩放');
      }
      if (options.fail) {
        options.fail(new Error('地图上下文不存在'));
      }
      return;
    }

    if (!this.data.mapContextReady) {
      options._retryCount++;
      
      // 限制重试次数，避免无限重试
      if (options._retryCount > 10) {
        if (options.fail) {
          options.fail(new Error('地图上下文初始化超时'));
        }
        return;
      }
      
      // 只在第一次和每5次重试时输出日志
      if (options._retryCount === 1 || options._retryCount % 5 === 0) {
        console.warn(`⚠️ 地图上下文尚未就绪，第${options._retryCount}次重试获取缩放`);
      }
      
      setTimeout(() => {
        this.safeGetScale(options);
      }, 500);
      return;
    }

    // 重置重试计数并获取缩放
    options._retryCount = 0;
    this.mapCtx.getScale({
      success: (res) => {
        if (options.success) {
          options.success(res);
        }
      },
      fail: (err) => {
        console.error('❌ 地图缩放获取失败:', err);
        if (options.fail) {
          options.fail(err);
        }
      }
    });
  },

  // 监听地图区域变化
  onRegionChange(e) {
    // 记录关键事件信息
    console.log('地图事件:', e.type, e.causedBy || '未知')
    
    // 如果是'updated'类型的变化，直接忽略，这通常是系统自动调整
    if (e.causedBy === 'update') {
      return
    }
    
    // 事件处理逻辑
    if (e.type === 'begin') {
      // 判断是否是用户主动操作
      const isUserAction = e.causedBy === 'gesture' || e.causedBy === 'scale' || e.causedBy === 'drag'
      
      if (isUserAction) {
        // 记录用户操作开始时间和类型
        this._userActionStartTime = Date.now()
        this._userActionType = e.causedBy
        
        // 记录操作开始时的位置
        this.safeGetRegion({
          success: (res) => {
            this._startRegion = res
          }
        })
        
        this.safeGetScale({
          success: (res) => {
            this._startScale = res.scale
          }
        })
        
        // 取消之前的所有待执行更新
        if (this._updateTimer) {
          clearTimeout(this._updateTimer)
          this._updateTimer = null
        }
        
        // 聚合点和散点切换时的优化
        // 如果是缩放操作，可能会触发聚合与散点的切换
        if (e.causedBy === 'scale') {
          // 预加载缓存
          // 获取当前游乐场的配置信息
          const app = getApp();
          const parkData = app.getParkConfigById(this.data.currentParkId);
          const clusterThreshold = parkData.mapConfig?.clusterThreshold || 18;
          
          // 预加载下一个可能的缩放级别
          this._preloadTimer = setTimeout(() => {
            this.mapCtx.getScale({
              success: (res) => {
                // 计算可能的下一个缩放级别
                const currentScale = res.scale;
                const potentialScale = currentScale < clusterThreshold ? 
                  clusterThreshold : 
                  clusterThreshold - 1;
                
                // 检查缓存是否已存在
                const cacheKey = `${this.data.currentParkId}_${Math.floor(potentialScale)}_${this.data.activeFilter}_${this.data.filterClosed ? 'hideClosed' : 'showClosed'}`;
                if (!markerCache[cacheKey]) {
                  // 后台预计算并缓存
                  console.log('预加载缓存:', cacheKey);
                  // 预先获取区域数据，避免频繁请求
                  this.safeGetRegion({
                    success: (regionRes) => {
                      // 在后台计算并缓存
                      setTimeout(() => {
                        const visibleMarkers = this.filterVisibleMarkers(
                          this.data.markers,
                          regionRes.southwest,
                          regionRes.northeast
                        );
                        
                        let clusters;
                        if (potentialScale < clusterThreshold) {
                          clusters = this.simpleClusterByLocation(visibleMarkers);
                        } else {
                          clusters = visibleMarkers.map(marker => ({
                            center: {
                              latitude: marker.latitude,
                              longitude: marker.longitude
                            },
                            markers: [marker]
                          }));
                        }
                        
                        // 存入缓存但不渲染
                        markerCache[cacheKey] = clusters;
                        console.log('预加载缓存完成:', cacheKey);
                      }, 0);
                    }
                  });
                }
              }
            });
          }, 100);
        }
      }
    } 
    else if (e.type === 'end') {
      // 无论什么原因，首先需要判断是否是用户操作产生的有效变化
      
      // 如果没有开始记录，说明不是用户操作
      if (!this._userActionStartTime) {
        return
      }
      
      // 计算操作持续时间，如果太短，很可能是系统抖动
      const duration = Date.now() - this._userActionStartTime
      if (duration < 50) {
        return
      }
      
      // 重置操作标记
      this._userActionStartTime = null
      this._userActionType = null
      
      // 取消预加载定时器
      if (this._preloadTimer) {
        clearTimeout(this._preloadTimer);
        this._preloadTimer = null;
      }
      
      // 安排更新，增加延迟让地图稳定
      this.scheduleUpdate()
    }
  },

  // 安排一次地图更新（抽取为独立函数以便复用）
  scheduleUpdate() {
    // 安排一次性延迟更新（如果有新操作开始会被取消）
    if (this._updateTimer) {
      clearTimeout(this._updateTimer)
    }
    
    // 使用适当的延迟，给地图一点时间稳定
    this._updateTimer = setTimeout(() => {
      this._updateTimer = null
      this._updateInProgress = true
      
      // 获取当前游乐场的配置
      const app = getApp();
      const parkData = app.getParkConfigById(this.data.currentParkId);
      const defaultScale = parkData?.mapConfig?.defaultScale || 16;
      
      // 保存当前地图视野状态
      Promise.all([
        new Promise(resolve => {
          this.safeGetScale({
            success: res => resolve(res),
            fail: () => resolve({ scale: defaultScale }) // 如果获取失败，使用默认值
          })
        }),
        new Promise(resolve => {
          this.safeGetRegion({
            success: res => resolve(res),
            fail: () => resolve(null)
          })
        })
      ]).then(([scaleRes, regionRes]) => {
        // 检查数据有效性
        if (!scaleRes) {
          console.log('获取地图状态失败，使用默认值')
          // 使用默认值继续
          scaleRes = { scale: defaultScale }
        }
        
        // 获取新的缩放级别
        const newScale = scaleRes.scale
        console.log(`scheduleUpdate: 当前缩放级别: ${newScale}, 期望的默认缩放级别: ${defaultScale}`)
        
        // 如果缩放级别与默认缩放级别相差太大，考虑调整回默认值
        // 但只在差异显著时才这样做，避免频繁的缩放切换
        if (Math.abs(newScale - defaultScale) > 2) {
          console.log(`缩放级别(${newScale})与默认值(${defaultScale})相差过大，考虑是否需要重置`)
          // 这里不强制重置，而是记录异常，由游乐场切换逻辑处理
        }
        
        // 只在差异显著时才同步缩放级别
        // 保持配置的defaultScale值，避免因为地图组件的小数点处理导致的调整
        const hasSignificantDifference = Math.abs(newScale - this.data.scale) > 1;
        
        if (hasSignificantDifference) {
          // 更新数据中的缩放级别
          this.data.scale = newScale
          console.log('缩放级别差异显著，已更新为:', newScale)
        } else {
          console.log('保持配置的缩放级别:', {
            configured: this.data.scale,
            actual: newScale,
            difference: Math.abs(newScale - this.data.scale)
          });
        }
        
        // 标记已经初始化，用于其他逻辑判断
        if (!this._hasInitializedScale) {
          this._hasInitializedScale = true;
        }
        
        // 更新聚合点，但不改变地图位置
        this.updateClusters(newScale, regionRes, false)
        
        this._updateInProgress = false
      })
    }, 200)  // 再增加一点延迟时间，确保操作完全结束
  },

  // 更新聚合点
  updateClusters(scale, regionData = null, shouldMoveMap = false) {
    // 特殊处理：如果当前筛选是洗手间或充电宝，强制显示所有独立markers
    if (this.data.activeFilter === 'restroom' || this.data.activeFilter === 'charger') {
      console.log(`当前筛选为${this.data.activeFilter}，强制显示独立markers`);
      this.forceShowIndividualMarkers();
      return;
    }
    
    // 获取当前游乐场的配置信息
    const app = getApp();
    const currentParkId = this.data.currentParkId;
    
    // 确保currentParkId有效
    if (!currentParkId) {
      console.error('当前游乐场ID无效');
      return;
    }
    
    // 获取游乐场配置
    const parkData = app.getParkConfigById(currentParkId);
    if (!parkData) {
      console.error(`未能获取到游乐场配置: ${currentParkId}`);
      return;
    }
    
    // 直接从mapConfig获取聚合阈值和默认缩放级别，使用默认值作为备选
    const clusterThreshold = parkData.mapConfig?.clusterThreshold || 18;
    const defaultScale = parkData.mapConfig?.defaultScale || 16;
    
    // 确保缩放级别和聚合阈值都是数字类型
    const numericScale = Number(scale);
    const numericThreshold = Number(clusterThreshold);
    
    console.log(`当前游乐场: ${this.data.currentPark}, 聚合阈值: ${numericThreshold}, 默认缩放级别: ${defaultScale}, 当前缩放级别: ${numericScale}`);
    console.log(`比较结果: ${numericScale} < ${numericThreshold} = ${numericScale < numericThreshold}`);
    
    // 如果scale超出合理范围，可能是切换游乐场后的异常值，调整为默认值
    if (numericScale > 20 || numericScale < 5) {
      console.log(`检测到异常的缩放级别: ${numericScale}，调整为默认值: ${defaultScale}`);
      scale = defaultScale;
      // 延迟更新UI上的scale值，避免干扰当前处理
      setTimeout(() => {
        this.setData({ scale: defaultScale });
      }, 100);
    }

    // 生成缓存键 - 修改为保留一位小数，避免向下取整导致的缓存问题
    const cacheKey = `${this.data.currentParkId}_${numericScale.toFixed(1)}_${this.data.activeFilter}_${this.data.filterClosed ? 'hideClosed' : 'showClosed'}`;
    console.log(`使用缓存键: ${cacheKey}`);
    
    // 定义处理区域数据的函数
    const processRegionData = (res) => {
      // 过滤可见区域内的markers
      let visibleMarkers = this.filterVisibleMarkers(
        this.data.markers,
        res.southwest,
        res.northeast
      );
      
      console.log('可见区域内的标记点数量:', visibleMarkers.length);
      
      // 如果启用了"隐藏已关闭"的筛选，先应用这个筛选条件
      if (this.data.filterClosed) {
        visibleMarkers = visibleMarkers.filter(marker => {
          return marker.item.waitTime !== '关闭' && marker.item.waitTime !== '已结束';
        });
        console.log('应用"隐藏已关闭"筛选后的标记点数量:', visibleMarkers.length);
      }
      
      // 检查缓存中是否有相同缩放级别和筛选条件的数据
      if (markerCache[cacheKey]) {
        console.log('使用缓存的marker数据:', cacheKey);
        // 验证缓存数据是否与可见区域匹配
        // 如果缓存的marker在可见区域内的比例低于80%，重新计算
        const cacheMarkers = markerCache[cacheKey];
        const visibleIds = new Set(visibleMarkers.map(m => m.id));
        const cacheVisibleCount = cacheMarkers.reduce((count, cluster) => {
          // 检查聚合点中的marker是否在可见区域内
          const clusterVisibleCount = cluster.markers.filter(m => visibleIds.has(m.id)).length;
          return count + clusterVisibleCount;
        }, 0);
        
        const cacheVisibleRatio = visibleMarkers.length > 0 ? cacheVisibleCount / visibleMarkers.length : 0;
        
        if (cacheVisibleRatio >= 0.8) {
          // 缓存数据有效，使用缓存数据
          this.batchRenderMarkers(cacheMarkers);
          return;
        }
        console.log('缓存数据与当前可见区域匹配度低，重新计算');
      }
      
      // 使用当前游乐场的聚合阈值决定是否聚合
      let clusters;
      // 重新记录比较，确保判断逻辑正确
      console.log(`聚合判断: ${numericScale} < ${numericThreshold} = ${numericScale < numericThreshold}`);
      
      if (numericScale < numericThreshold) {
        // 按location分组聚合
        clusters = this.simpleClusterByLocation(visibleMarkers)
        console.log('判断结果：需要聚合，按位置聚合后的点数量:', clusters.length)
      } else {
        // 缩放级别大于等于阈值，显示原始标记
        clusters = visibleMarkers.map(marker => ({
          center: {
            latitude: marker.latitude,
            longitude: marker.longitude
          },
          markers: [marker]
        }))
        console.log('判断结果：不需要聚合，显示原始标记，数量:', clusters.length)
      }
      
      // 保存到缓存
      markerCache[cacheKey] = clusters;
      
      // 限制缓存大小，最多保存10个缩放级别的数据
      const cacheKeys = Object.keys(markerCache);
      if (cacheKeys.length > 10) {
        // 移除最老的缓存
        delete markerCache[cacheKeys[0]];
      }
      
      // 更新marker显示
      this.batchRenderMarkers(clusters);
    }
    
    // 如果已提供区域数据，直接使用
    if (regionData) {
      processRegionData(regionData)
    } else {
      // 否则获取地图可视区域
      this.safeGetRegion({
        success: (res) => {
          processRegionData(res)
        },
        fail: (err) => {
          console.error('获取地图可视区域失败:', err)
        }
      })
    }
  },

  // 名称归一化函数，去除特殊符号和数字
  normalizeAreaName(name) {
    if (!name) return '';
    // 去除常见特殊符号、空格、数字、括号、英文标点等
    return name
      .replace(/[·™®\{\}\[\]\(\)（）\-\s\d]/g, '')
      .replace(/\{.*?\}|\(.*?\)|（.*?）/g, '') // 去除括号内容
      .replace(/的?魔法世界$/, '魔法世界') // 可选：进一步归一化
      .toLowerCase();
  },

  // 简化的位置聚合函数 - 完全按照location分组，不考虑距离
  simpleClusterByLocation(markers) {
    // 创建聚合结果数组
    let clusters = []
    
    // 按location分组
    const locationGroups = new Map()
    
    markers.forEach((marker) => {
      const location = marker.item?.location || '未知区域'
      const areaNameRaw = location.split('/')[0] || '其他区域'
      const areaName = this.normalizeAreaName(areaNameRaw)
      
      if (!locationGroups.has(areaName)) {
        locationGroups.set(areaName, {
          markers: [],
          totalLat: 0,
          totalLng: 0
        })
      }
      
      const group = locationGroups.get(areaName)
      group.markers.push(marker)
      group.totalLat += marker.latitude
      group.totalLng += marker.longitude
    })
    
    // 将分组转换为聚合点
    locationGroups.forEach((group, locationName) => {
      const markerCount = group.markers.length
      
      if (markerCount === 0) return
      
      // 计算中心点坐标
      const centerLat = group.totalLat / markerCount
      const centerLng = group.totalLng / markerCount
      
      // 添加聚合点
      clusters.push({
        center: {
          latitude: centerLat,
          longitude: centerLng
        },
        location: locationName,
        markers: group.markers
      })
    })
    
    return clusters
  },

  // 过滤可见区域内的markers
  filterVisibleMarkers(markers, southwest, northeast) {
    // 扩大过滤范围，防止边缘闪烁
    const padding = 0.01 // 约1公里
    return markers.filter(marker => {
      return marker.latitude >= southwest.latitude - padding &&
             marker.latitude <= northeast.latitude + padding &&
             marker.longitude >= southwest.longitude - padding &&
             marker.longitude <= northeast.longitude + padding
    })
  },

  // 实现聚合算法
  clusterMarkers(markers, zoom) {
    // 创建聚合结果数组
    let clusters = []
    // 已处理的标记
    let processed = new Set()
    
    // 根据缩放级别调整聚合距离
    // 缩放级别越大，聚合距离越小
    const distance = BASE_CLUSTER_DISTANCE * Math.pow(2, 14 - zoom)
    
    // 先按location分组
    const locationGroups = new Map()
    
    markers.forEach((marker) => {
      const location = marker.item?.location || '未知区域'
      const areaNameRaw = location.split('/')[0] || '其他区域'
      const areaName = this.normalizeAreaName(areaNameRaw)
      
      if (!locationGroups.has(areaName)) {
        locationGroups.set(areaName, [])
      }
      locationGroups.get(areaName).push(marker)
    })
    
    // 对每个位置分组进行聚合
    locationGroups.forEach((locationMarkers, locationName) => {
      locationMarkers.forEach((marker, index) => {
        if (processed.has(marker.id)) return
        
        // 寻找聚合点
        let cluster = {
          center: {
            latitude: marker.latitude,
            longitude: marker.longitude
          },
          location: locationName,
          markers: [marker]
        }
        
        // 查找附近的点
        locationMarkers.forEach((otherMarker) => {
          if (marker.id === otherMarker.id || processed.has(otherMarker.id)) return
          
          // 计算距离
          const dist = calculateDistance(
            marker.latitude,
            marker.longitude,
            otherMarker.latitude,
            otherMarker.longitude
          )
          
          // 如果距离小于阈值，加入聚合
          if (dist < distance) {
            cluster.markers.push(otherMarker)
            processed.add(otherMarker.id)
          }
        })
        
        // 添加到结果
        clusters.push(cluster)
        processed.add(marker.id)
      })
    })
    
    return clusters
  },

  // 更新marker显示
  updateMarkerDisplay(clusters) {
    // 使用新的批量渲染函数替代
    this.batchRenderMarkers(clusters);
  },

  markertap(e) {
    console.log('=== markertap事件被触发 ===');
    console.log('完整事件对象:', e);
    
    // 如果当前显示卡片，则忽略marker点击
    if (this.data.showCard) {
      console.log('卡片显示中，忽略marker点击');
      return;
    }
    
    const markerId = e.markerId
    
    // 找到被点击的marker
    const marker = this.data.visibleMarkers.find(m => m.id === markerId)
    if (!marker) return
    
    // 获取当前游乐场的配置信息
    const app = getApp();
    const parkData = app.getParkConfigById(this.data.currentParkId);
    
    // 获取当前游乐场的聚合阈值，如果没有则使用默认值18
    const clusterThreshold = parkData.mapConfig?.clusterThreshold || 18;

    // 将被点击的marker置于最前面，通过更新zIndex
    const updatedVisibleMarkers = this.data.visibleMarkers.map(m => {
      if (m.id === markerId) {
        // 将被点击的marker的zIndex设置为一个较高的值，确保显示在最前面
        return { ...m, zIndex: 1000 };
      } else {
        // 其他marker恢复默认的zIndex值
        // 聚合点标记的默认zIndex是999，单个标记的默认zIndex是100
        return { 
          ...m, 
          zIndex: m.customCallout?.content?.isCluster ? 999 : 100
        };
      }
    });
    
    // 更新标记数据，将修改后的标记应用到地图上
    this.setData({
      visibleMarkers: updatedVisibleMarkers
    });
    
    // 判断是否是聚合点
    if (marker.customCallout?.content?.isCluster) {
      console.log('点击了聚合点', marker)
      
      // 如果当前有卡片显示，先关闭它，但不重置地图状态
      if (this.data.showCard) {
        this.handleCloseCard(false);
      }
      
      // 不再更新地图中心点，保持当前视图不变
      
      // 显示聚合点卡片
      this.showClusterCard(marker);
      
      // 短震动反馈
      wx.vibrateShort({
        type: 'light'
      });
      
      return;
    }
    
    // 选中单个标记
    this.selectMarker(marker);
  },
  
  // 选中单个marker
  selectMarker(marker) {
    // 保存选中的marker
    this.setData({
      selectedMarker: marker
    })
    
    // 调整zIndex使选择的标记显示在前面
    if (marker && marker.id !== undefined) {
      const updatedMarkers = this.data.visibleMarkers.map(m => {
        if (m.id === marker.id) {
          // 设置选中的标记的zIndex为1000，确保显示在最前面
          return {...m, zIndex: 1000};
        } else {
          // 恢复其他标记的默认zIndex值
          const defaultZIndex = m.customCallout?.content?.isCluster ? 999 : 100;
          return {...m, zIndex: defaultZIndex};
        }
      });
      
      // 更新标记数据
      this.setData({
        visibleMarkers: updatedMarkers
      });
    }
    
    // 显示详情卡片
    if (marker.item) {
      this.showCard(marker.item)
    }
  },

  // 添加新的点气泡点击处理函数
  callouttap(e) {
    // 如果当前显示卡片，则忽略callout点击
    if (this.data.showCard) {
      console.log('卡片显示中，忽略callout点击');
      return;
    }
    
    const markerId = e.markerId;
    
    // 找到被点击的marker
    const marker = this.data.visibleMarkers.find(m => m.id === markerId);
    if (!marker) return;
    
    // 获取当前游乐场的配置信息
    const app = getApp();
    const parkData = app.getParkConfigById(this.data.currentParkId);
    
    // 获取当前游乐场的聚合阈值，如果没有则使用默认值18
    const clusterThreshold = parkData.mapConfig?.clusterThreshold || 18;
    
    // 调整zIndex使点击的标记显示在前面
    const updatedMarkers = this.data.visibleMarkers.map(m => {
      if (m.id === markerId) {
        // 设置被点击的标记的zIndex为1000，确保显示在最前面
        return {...m, zIndex: 1000};
      } else {
        // 恢复其他标记的默认zIndex值
        const defaultZIndex = m.customCallout?.content?.isCluster ? 999 : 100;
        return {...m, zIndex: defaultZIndex};
      }
    });
    
    // 更新标记数据
    this.setData({
      visibleMarkers: updatedMarkers
    });
    
    // 判断是否是聚合点
    if (marker.customCallout?.content?.isCluster) {
      console.log('点击了聚合点气泡', marker);
      
      // 如果当前有卡片显示，先关闭它，但不重置地图状态
      if (this.data.showCard) {
        this.handleCloseCard(false);
      }
      
      // 显示聚合点卡片
      this.showClusterCard(marker);
      
      // 短震动反馈
      wx.vibrateShort({
        type: 'light'
      });
      
      // 不再更新地图中心点，保持当前视图不变
      
      return;
    }
    
    // 选中单个标记
    this.selectMarker(marker);
  },

  // 自动截取标签，总长度不超过32个字符
  truncateFlags(flags) {
    if (!flags || !Array.isArray(flags) || flags.length === 0) return [];
    
    let totalLength = 0;
    const result = [];
    
    for (let i = 0; i < flags.length; i++) {
      const flagLength = this.calculateStringLength(flags[i]);
      if (totalLength + flagLength <= 32) {
        result.push(flags[i]);
        totalLength += flagLength;
      } else {
        break;
      }
    }
    
    return result;
  },
  
  // 计算字符串长度（中文算2个字符）
  calculateStringLength(str) {
    if (!str) return 0;
    let length = 0;
    for (let i = 0; i < str.length; i++) {
      if (str.charCodeAt(i) > 127 || str.charCodeAt(i) === 94) {
        length += 2;
      } else {
        length += 1;
      }
    }
    return length;
  },

  // 将任意值安全地转换为字符串
  safeString(value, defaultValue = '-') {
    if (value === undefined || value === null) {
      return defaultValue;
    }
    if (typeof value === 'object') {
      console.log('值是一个对象:', value);
      return defaultValue;
    }
    return String(value);
  },

  showCard(marker) {
    // 检查点击是否在筛选区域内，如果是则不显示卡片
    this.checkClickInFilterArea().then(isInFilterArea => {
      if (isInFilterArea) {
        console.log('点击位置在筛选区域内，不显示单个项目卡片');
        return;
      }
      
      // 继续原有的显示逻辑
      this.doShowCard(marker);
    });
  },

  // 实际执行显示卡片的逻辑
  doShowCard(marker) {
    // 检查marker是否有item属性，如果没有，使用marker本身
    const item = marker.item || marker;
    
    // 根据类型确定模板
    let template = '';
    if (item.type === 'attraction') {
      template = 'attractionTemplate';
    } else if (item.type === 'performance' || item.type === 'performances') {
      template = 'performanceTemplate';
    } else if (item.type === 'restaurant') {
      template = 'restaurantTemplate';
    } else if (item.type === 'shop') {
      template = 'shopTemplate';
    } else if (item.type === 'restroom') {
      template = 'restroomTemplate';
    } else if (item.type === 'charger') {
      template = 'chargerTemplate';
    }
    
    // 过滤flags，确保不超出显示长度
    const flags = this.truncateFlags(item.flags || []);
    
    this.setData({
      showCard: true,
      cardInfo: {
        id: item.id,
        name: this.safeString(item.name, '未命名'),
        type: item.type,
        template: template,
        image: item.image || '/images/placeholder.png',
        location: this.safeString(item.location, '未知位置'),
        waitTime: item.type === 'restaurant' ? (this.safeString(item.waitTime) || '营业中') : this.safeString(item.waitTime),
        waitUnit: item.type === 'restaurant' ? (this.safeString(item.waitUnit) || '状态') : this.safeString(item.waitUnit),
        colorTheme: item.type === 'restaurant' ? (item.colorTheme || 'green') : item.colorTheme,
        isFavorite: this.isItemFavorite(item),
        showTimes: item.showTimes,
        openTime: this.safeString(item.openTime),
        flags: flags,
        suggestedQueries: item.suggestedQueries || [],
        summary: this.safeString(item.summary),
        duration: this.safeString(item.duration),
        // 餐厅特有字段
        cuisine: this.safeString(item.cuisine),
        price: this.safeString(item.price),
        products: item.products || [], // 餐厅特色菜品
        // 充电宝特有字段
        brand: this.safeString(item.brand),
        capacity: this.safeString(item.capacity),
        availableCount: item.availableCount || 0,
        totalCount: item.totalCount || 0
      }
    }, () => {
      // 在数据设置完成后，确保性能卡片样式正确应用
      if (template === 'performanceTemplate') {
        // 使用setTimeout确保DOM已经更新
        setTimeout(() => {
          try {
            // 强制重新应用关键样式
            const infoCard = this.selectComponent('#infoCard');
            if (infoCard) {
              console.log('正在确保表演卡片样式正确应用');
              
              // 可以使用createSelectorQuery来直接获取并操作元素
              const query = wx.createSelectorQuery();
              query.select('.info-card[data-template="performanceTemplate"] .info-row').fields({
                computedStyle: ['display', 'flex-direction', 'flex-wrap']
              }, function(res) {
                console.log('当前样式状态:', res);
              }).exec();
              
              // 强制更新视图
              this.setData({
                '_forceUpdate': Date.now()
              });
            }
          } catch (error) {
            console.error('应用表演卡片样式时出错:', error);
          }
          
          // 额外调用刷新样式方法
          this.refreshPerformanceCardStyles();
        }, 100);
      }
    });
  },

  // 添加查看详情页的方法
  handleViewDetails() {
    const { cardInfo } = this.data;
    if (!cardInfo) return;
    
    // 震动反馈
    wx.vibrateShort({
      type: 'light'
    });
    
    // 跳转到详情页面，传递当前的排队时间数据
    const waitTimeParams = cardInfo.waitTime !== undefined && cardInfo.waitUnit !== undefined 
      ? `&waitTime=${encodeURIComponent(cardInfo.waitTime)}&waitUnit=${encodeURIComponent(cardInfo.waitUnit)}&colorTheme=${cardInfo.colorTheme || 'gray'}`
      : '';
    
    wx.navigateTo({
      url: `/pages/details/details?id=${cardInfo.id}&type=${cardInfo.type}&parkId=${this.data.currentParkId}${waitTimeParams}`,
      fail: (err) => {
        console.error('跳转详情页失败:', err);
        wx.showToast({
          title: '无法打开详情页',
          icon: 'none'
        });
      }
    });
  },

  handleCloseCard(resetMapState = true) {
    // 重置所有标记的zIndex到默认值，但仅当resetMapState为true时
    if (resetMapState && this.data.visibleMarkers && this.data.visibleMarkers.length > 0) {
      const resetMarkers = this.data.visibleMarkers.map(m => {
        // 聚合点的默认zIndex是999，单个标记的默认zIndex是100
        const defaultZIndex = m.customCallout?.content?.isCluster ? 999 : 100;
        
        // 复制marker对象，避免直接修改引用
        const newMarker = {...m, zIndex: defaultZIndex};
        
        // 不处理聚合点
        if (newMarker.customCallout?.content?.isCluster) {
          return newMarker;
        }
        
        // 所有marker设置为未选中状态
        newMarker.iconPath = this.getIconPathByType(newMarker.type, newMarker.colorTheme, false);
        return newMarker;
      });
      
      // 更新markers
      this.setData({
        visibleMarkers: resetMarkers,
        selectedMarker: null // 清除选中的标记
      });
    }
    
    // 关闭卡片
    this.setData({
      showCard: false,
      cardInfo: null,
      // 仅当resetMapState为true时清除选中的标记
      ...(resetMapState ? { selectedMarker: null } : {})
    });
  },

  // 添加一个新方法，用于刷新性能卡片样式
  refreshPerformanceCardStyles() {
    if (this.data.cardInfo && this.data.cardInfo.template === 'performanceTemplate') {
      console.log('手动刷新表演卡片样式');
      
      // 使用一个临时变量触发视图更新
      this.setData({
        '_forceUpdate': Date.now()
      });
      
      // 延迟一小段时间后检查样式是否应用
      setTimeout(() => {
        const query = wx.createSelectorQuery();
        query.select('.info-card[data-template="performanceTemplate"] .info-row').fields({
          computedStyle: ['display', 'flex-direction', 'flex-wrap', 'width']
        }, (res) => {
          if (res) {
            console.log('样式刷新后的状态:', res);
          } else {
            console.log('未能获取样式信息');
          }
        }).exec();
      }, 50);
    }
  },

  handleFavorite() {
    const app = getApp();
    const { id } = this.data.cardInfo;
    
    // 使用favoritesService处理收藏
    favoritesService.toggleFavorite(app, this.data.currentPark, id, true, (isFavorite) => {
      this.setData({
        'cardInfo.isFavorite': isFavorite
      });
    });
  },

  // 处理导航按钮点击
  handleNavigation() {
    const { cardInfo } = this.data;
    if (!cardInfo) return;
    
    // 震动反馈
    wx.vibrateShort({
      type: 'medium'
    });
    
    // 检查是否有有效的位置信息
    const marker = this.data.markers.find(m => m.item.id === cardInfo.id);
    if (!marker || !marker.latitude || !marker.longitude) {
      wx.showToast({
        title: '无法获取位置信息',
        icon: 'none',
        duration: 2000
      });
      return;
    }
    
    // 使用微信内置地图打开位置
    wx.openLocation({
      latitude: marker.latitude,
      longitude: marker.longitude,
      name: cardInfo.name,
      address: cardInfo.location || '园区内',
      scale: 18,
      success: () => {
        console.log('成功打开导航');
      },
      fail: (err) => {
        console.error('打开导航失败', err);
        wx.showToast({
          title: '导航功能暂不可用',
          icon: 'none'
        });
      }
    });
  },
  
  // 处理推荐查询点击
  handleQueryClick(e) {
    const query = e.currentTarget.dataset.query;
    if (!query) return;
    
    // 震动反馈
    wx.vibrateShort({
      type: 'light'
    });
    
    // 获取当前项目名称
    const projectName = this.data.cardInfo?.name;
    
    // 组合查询内容：项目名称 + 原查询内容
    let combinedQuery = query;
    if (projectName) {
      combinedQuery = `${projectName} ${query}`;
    }
    
    console.log('点击了推荐查询:', combinedQuery);
    
    // 关闭当前卡片
    this.handleCloseCard();
    
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
        } else {
          console.log('globalEvents未定义，无法发送新搜索事件');
        }
      }
    });
  },

  // 处理游乐场切换事件
  handleParkChange({ parkId, parkName }) {
    // 如果选择的是当前游乐场，不做操作
    if (parkId === this.data.currentParkId) {
      return;
    }
    
    console.log(`切换游乐场: 从 ${this.data.currentPark}(${this.data.currentParkId}) 到 ${parkName}(${parkId})`);
    
    // 重置缩放级别初始化标志，允许新游乐场重新同步缩放级别
    this._hasInitializedScale = false;
    
    // 先提示加载中
    wx.showLoading({
      title: '正在切换...',
      mask: true
    });
    
    // 更新当前游乐场
    const parks = this.data.parks;
    const currentParkIndex = parks.findIndex(park => park.id === parkId);
    
    this.setData({
      currentParkId: parkId,
      currentPark: parkName,
      currentParkIndex: currentParkIndex >= 0 ? currentParkIndex : 0
    });
    
    // 获取新游乐场的配置
    const app = getApp();
    const parkData = app.getParkConfigById(parkId);
    if (!parkData) {
      wx.hideLoading();
      wx.showToast({
        title: '游乐场配置不存在',
        icon: 'none'
      });
      return;
    }
    
    // 获取新游乐场的默认缩放级别和聚合阈值
    const defaultScale = parkData.mapConfig?.defaultScale || 16;
    const clusterThreshold = parkData.mapConfig?.clusterThreshold || 18;
    console.log(`切换到游乐场 ${parkName}，配置详情:`, parkData);
    console.log(`使用默认缩放级别: ${defaultScale}, 聚合阈值: ${clusterThreshold}`);
    
    // 清除旧的标记缓存 - 修复只读错误
    Object.keys(markerCache).forEach(key => {
      delete markerCache[key];
    });
    
    // 重新加载数据，并移动地图到新的游乐场
    this.loadParkData(true).then(() => {
      wx.hideLoading();
      console.log('已切换到游乐场:', parkName);
      
      // 强制应用新的地图配置
      this.mapCtx.getScale({
        success: (res) => {
          // 使用当前缩放级别更新聚合点
          this.updateClusters(res.scale);
        },
        fail: () => {
          // 如果获取失败，使用默认缩放级别
          this.updateClusters(defaultScale);
        }
      });
    }).catch(error => {
      wx.hideLoading();
      console.error('加载游乐场数据失败:', error);
      wx.showToast({
        title: '加载失败，请重试',
        icon: 'none'
      });
    });
  },

  // 刷新页面数据
  refreshPageData() {
    // 更新当前游乐场索引
    this.setData({
      currentParkIndex: this.data.parks.findIndex(park => park.id === this.data.currentParkId)
    });

    // 重新加载游乐场数据 - 不移动地图位置，保持用户当前视角
    this.loadParkData(false).then(() => {
      // 提供成功反馈
      wx.showToast({
        title: '数据已更新',
        icon: 'success',
        duration: 500
      });
      
      // 在数据更新后触发标记更新
      this.scheduleUpdate();
    }).catch(error => {
      console.error('刷新数据失败:', error);
      wx.showToast({
        title: '刷新数据失败',
        icon: 'none'
      });
    });
  },

  handleNearby() {
    console.log('点击我的附近按钮');
    
    // 显示加载状态
    wx.showLoading({
      title: '定位中...',
      mask: true
    });

    // 获取用户位置
    wx.getLocation({
      type: 'gcj02',
      success: (res) => {
        console.log('获取用户位置成功:', res);
        
        const userLatitude = res.latitude;
        const userLongitude = res.longitude;
        
        // 获取当前游乐场的中心位置
        const app = getApp();
        const parkData = app.getParkConfigById(this.data.currentParkId);
        
        if (!parkData) {
          wx.hideLoading();
          wx.showToast({
            title: '游乐场配置不存在',
            icon: 'none'
          });
          return;
        }
        
        const parkLatitude = parkData.latitude;
        const parkLongitude = parkData.longitude;
        
        // 计算用户与游乐场的距离（单位：米）
        const distance = calculateDistance(
          userLatitude, userLongitude,
          parkLatitude, parkLongitude
        );
        
        console.log(`用户距离游乐场距离: ${distance}米`);
        
        let targetLatitude, targetLongitude;
        
        // 根据距离决定地图中心位置
        if (distance < 3000) { // 小于3公里
          // 移动到用户位置
          targetLatitude = userLatitude;
          targetLongitude = userLongitude;
          console.log('用户距离游乐场小于3公里，移动到用户位置');
        } else { // 大于等于3公里
          // 移动到游乐场中心
          targetLatitude = parkLatitude;
          targetLongitude = parkLongitude;
          console.log('用户距离游乐场大于等于3公里，移动到游乐场中心');
        }
        
        // 移动地图并设置缩放级别
        this.mapCtx.moveToLocation({
          latitude: targetLatitude,
          longitude: targetLongitude,
          success: () => {
            // 设置缩放级别为19
            this.setData({
              latitude: targetLatitude,
              longitude: targetLongitude,
              scale: 19
            });
            
            // 手动触发聚合逻辑更新
            setTimeout(() => {
              this.updateClusters(19);
            }, 300);
            
            wx.hideLoading();
            wx.showToast({
              title: distance < 3000 ? '已定位到您的位置' : '已定位到游乐场中心',
              icon: 'success',
              duration: 1500
            });
            
            console.log(`地图已移动到: ${targetLatitude}, ${targetLongitude}, 缩放级别: 19`);
          },
          fail: (err) => {
            console.error('移动地图失败:', err);
            // 如果moveToLocation失败，直接更新数据
            this.setData({
              latitude: targetLatitude,
              longitude: targetLongitude,
              scale: 19
            });
            
            // 手动触发聚合逻辑更新
            setTimeout(() => {
              this.updateClusters(19);
            }, 300);
            
            wx.hideLoading();
            wx.showToast({
              title: distance < 3000 ? '已定位到您的位置' : '已定位到游乐场中心',
              icon: 'success',
              duration: 1500
            });
          }
        });
      },
      fail: (err) => {
        console.error('获取用户位置失败:', err);
        wx.hideLoading();
        
        // 位置获取失败，直接移动到游乐场中心
        const app = getApp();
        const parkData = app.getParkConfigById(this.data.currentParkId);
        
        if (parkData) {
          this.setData({
            latitude: parkData.latitude,
            longitude: parkData.longitude,
            scale: 19
          });
          
          // 手动触发聚合逻辑更新
          setTimeout(() => {
            this.updateClusters(19);
          }, 300);
          
          wx.showToast({
            title: '定位失败，已移动到游乐场中心',
            icon: 'none',
            duration: 2000
          });
        } else {
          wx.showToast({
            title: '定位失败',
            icon: 'none'
          });
        }
      }
    });
  },

  handleRefresh() {
    // 检查是否有游乐场数据
    if (!this.data.currentPark) {
      wx.showToast({
        title: '请先选择游乐场',
        icon: 'none'
      });
      return;
    }

    // 手动触发数据更新（调试用）
    console.log('【手动刷新】触发数据更新');
    const app = getApp();
    
    // 测试云函数调用
    console.log('【测试】直接调用云函数测试');
    wx.cloud.callFunction({
      name: 'fetchServerData',
      data: {
        action: 'getParkData',
        parkId: 'universal',
        token: app.globalData.token || ''
      }
    }).then(res => {
      console.log('【测试】云函数调用结果:', res);
      if (res.result.success) {
        console.log('【测试】云函数返回的数据:', res.result.data);
        console.log('【测试】attractions数量:', res.result.data.attraction?.length || 0);
        console.log('【测试】performances数量:', res.result.data.performance?.length || 0);
      } else {
        console.error('【测试】云函数调用失败:', res.result.error);
      }
    }).catch(err => {
      console.error('【测试】云函数调用异常:', err);
    });
    
    // 检查并启动定时更新
    if (!app.globalData.queueTimeTimer) {
      console.log('【手动刷新】定时器未启动，现在启动');
      app.startQueueTimeUpdate();
    } else {
      console.log('【手动刷新】手动触发一次完整数据更新');
      app.updateFullParkData();
    }
    const parkData = app.getParkConfigById(this.data.currentParkId);
    if (!parkData) {
      console.error(`未找到游乐场配置: ${this.data.currentPark}`);
      wx.showToast({
        title: '游乐场配置不存在',
        icon: 'none'
      });
      return;
    }

    // 判断是否需要移动地图和重置缩放级别
    // 如果用户长时间未操作或显示重置按钮被按下，可以考虑使用重置标志
    const resetView = this.data.resetMapViewOnRefresh || false;

    // 如果需要重置视图，则获取默认缩放级别
    if (resetView) {
      const defaultScale = parkData.mapConfig?.defaultScale || 16;
      
      // 更新地图位置和缩放级别
      this.setData({
        latitude: parkData.latitude,
        longitude: parkData.longitude,
        scale: defaultScale,
        resetMapViewOnRefresh: false // 重置标志
      }, () => {
        // 在位置更新后加载数据
        this.loadParkData(true);
      });
    } else {
      // 不需要重置视图，只刷新数据
      this.loadParkData(false);
    }
  },

  // 添加获取主题颜色的辅助方法
  getColorByTheme(theme) {
    const colorMap = {
      'red': '#ff4d4f',
      'orange': '#fa8c16',
      'yellow': '#fadb14',
      'green': '#52c41a',
      'blue': '#1890ff',
      'purple': '#722ed1',
      'default': '#1890ff'
    };
    return colorMap[theme] || colorMap.default;
  },

  // 修改handleMapTap方法，确保点击地图时正确关闭卡片
  handleMapTap(e) {
    console.log('地图点击事件触发', e);
    
    // 如果当前显示详情卡片，则关闭
    if (this.data.showCard) {
      console.log('关闭当前显示的卡片');
      this.handleCloseCard(true); // 传递true参数确保重置地图状态
      return;
    }
    
    console.log('重置所有标记状态');
    // 重置所有标记的zIndex到默认值
    if (this.data.visibleMarkers && this.data.visibleMarkers.length > 0) {
      const resetMarkers = this.data.visibleMarkers.map(m => {
        // 聚合点的默认zIndex是999，单个标记的默认zIndex是100
        const defaultZIndex = m.customCallout?.content?.isCluster ? 999 : 100;
        
        // 复制marker对象，避免直接修改引用
        const newMarker = {...m, zIndex: defaultZIndex};
        
        // 不处理聚合点
        if (newMarker.customCallout?.content?.isCluster) {
          return newMarker;
        }
        
        // 所有marker设置为未选中状态
        newMarker.iconPath = this.getIconPathByType(newMarker.type, newMarker.colorTheme, false);
        return newMarker;
      });
      
      // 更新markers
      this.setData({
        visibleMarkers: resetMarkers,
        selectedMarker: null // 清除选中的标记
      });
    }
  },
  
  // 空函数，用于阻止事件冒泡
  noop(e) {
    // 打印事件类型，帮助调试
    if (e && e.type) {
      console.log('捕获事件:', e.type);
    }
    
    // 阻止事件冒泡
    e.stopPropagation && e.stopPropagation();
    
    // 阻止默认行为
    e.preventDefault && e.preventDefault();
    
    // 阻止事件穿透
    if (e.detail && e.detail.x && e.detail.y) {
      console.log('捕获点击坐标:', e.detail.x, e.detail.y);
    }
    
    // 阻止冒泡和事件穿透
    return false;
  },

  // 添加指南针功能处理方法
  handleEnableCompass() {
    // 切换指南针状态
    const newCompassEnabled = !this.data.compassEnabled;
    
    this.setData({
      compassEnabled: newCompassEnabled
    });
    
    if (newCompassEnabled) {
      // 提示用户指南针已启用
      wx.showToast({
        title: '指南针已启用',
        icon: 'success',
        duration: 1500
      });
      
      // 短震动反馈
      wx.vibrateShort({
        type: 'light'
      });
      
      // 如果地图当前旋转了，将其重置为正北方向
      this.mapCtx.getRotate({
        success: (res) => {
          const currentRotate = res.rotate;
          if (currentRotate !== 0) {
            // 重置地图到正北方向（rotate=0）
            this.mapCtx.changeViewById({
              rotate: 0
            });
          }
        },
        fail: () => {
          console.log('获取地图旋转角度失败');
        }
      });
    } else {
      // 关闭指南针
      wx.showToast({
        title: '指南针已关闭',
        icon: 'success',
        duration: 1500
      });
      
      // 短震动反馈
      wx.vibrateShort({
        type: 'light'
      });
    }
  },

  // 添加定位按钮处理方法，这个在页面中也可能用到
  handleMoveToLocation() {
    this.mapCtx.moveToLocation({
      success: () => {
        // 短震动反馈
        wx.vibrateShort({
          type: 'light'
        });
      }
    });
  },

  generateFilterButtons(parkId) {
    const app = getApp();
    const filterConfig = app.getParkConfigById(parkId)?.filterConfig || {};
    
            const defaultButtons = [
          { type: 'all', text: '游乐&演出', isActive: true },
          { type: 'attraction', text: '游乐', isActive: false },
          { type: 'performance', text: '演出', isActive: false },
          { type: 'restaurant', text: '餐厅', isActive: false },
          { type: 'charger', text: '充电宝', isActive: false },
          { type: 'restroom', text: '洗手间', isActive: false },
          { type: 'favorite', text: '我的收藏', isActive: false }
        ];
    
    // 如果有自定义配置，覆盖默认按钮
    if (filterConfig.buttons && Array.isArray(filterConfig.buttons)) {
      // 合并自定义按钮和默认按钮
      const mergedButtons = [...defaultButtons];
      
      // 遍历自定义按钮，如果类型匹配，则替换默认按钮，如果不匹配，则添加到末尾
      filterConfig.buttons.forEach(customButton => {
        const index = mergedButtons.findIndex(btn => btn.type === customButton.type);
        if (index !== -1) {
          mergedButtons[index] = { ...mergedButtons[index], ...customButton };
        } else {
          mergedButtons.push(customButton);
        }
      });
      
      return mergedButtons;
    }
    
    // 没有自定义配置，返回默认按钮
    return defaultButtons;
  },

  loadParkData(shouldMoveMap = true) {
    const app = getApp();
    const currentParkId = this.data.currentParkId;
    
    if (!currentParkId) {
      wx.showToast({
        title: '请先选择游乐场',
        icon: 'none'
      });
      return Promise.reject(new Error('未选择游乐场'));
    }

    wx.showLoading({
      title: '加载中...',
    });

    // 获取游乐场ID
    let parkId = parkNameToId[currentParkId];
    if (!parkId) {
      // 检查currentParkId是否直接是有效的ID
      if (parkIdToName[currentParkId]) {
        parkId = currentParkId;
      } else {
        console.error(`未知的游乐场标识: ${currentParkId}`);
        wx.hideLoading();
        wx.showToast({
          title: '无效的游乐场',
          icon: 'none'
        });
        return Promise.reject(new Error(`未知的游乐场标识: ${currentParkId}`));
      }
    }

    const { initParkData, getParkData } = require('../../utils/data');
    initParkData(app.globalData);

    return getParkData(parkId, app.globalData.token)
      .then(data => {
        if (!data || data.length === 0) {
          wx.hideLoading();
          wx.showToast({
            title: '暂无数据，请稍后重试',
            icon: 'none',
            duration: 2000
          });
          return [];
        }
        
        // 使用parkId调用updateMapLocation，确保参数一致
        this.updateMapLocation(parkId, data, shouldMoveMap);
        wx.hideLoading();
        
        wx.showToast({
          title: `已更新${data.length}个项目`,
          icon: 'success',
          duration: 500
        });
        
        return data;
      })
      .catch(error => {
        console.error('加载游乐场数据失败:', error);
        wx.hideLoading();
        wx.showToast({
          title: error.message || '加载失败',
          icon: 'none'
        });
        throw error;
      });
  },

  updateMapLocation(parkCode, allItems, shouldMoveMap = true) {
    if (!allItems) {
      console.error('缺少数据参数');
      return;
    }

    // 获取游乐场ID - 考虑传入的可能已经是ID
    let parkId = parkCode;
    // 如果传入的是名称而不是ID，使用映射转换
    if (parkNameToId[parkCode]) {
      parkId = parkNameToId[parkCode];
    } else if (!parkIdToName[parkCode]) {
      // 如果既不是有效名称也不是有效ID，报错
      console.error(`未知的游乐场标识: ${parkCode}`);
      return;
    }

    // 获取游乐场配置
    const app = getApp();
    const parkData = app.getParkConfigById(parkId);
    if (!parkData) {
      console.error(`未找到游乐场配置: ${parkId}`);
      return;
    }

    // 获取当前游乐场的默认缩放级别，如果没有则使用默认值16
    const defaultScale = parkData.mapConfig?.defaultScale || 16;
    
    // 计算标记点位置
    const markers = this.calculateMarkerPositions(allItems);
    
    // 过滤标记
    const filteredMarkers = this.filterMarkers(markers);
    
    // 只有在特别要求移动地图时才设置中心位置和缩放级别
    // 只在首次加载或切换游乐场时才应该移动地图
    if (shouldMoveMap) {
      // 更新地图位置
      this.setData({
        latitude: parkData.latitude,
        longitude: parkData.longitude,
        allMarkers: markers,
        markers: filteredMarkers,
        visibleMarkers: [], // 初始化visibleMarkers，让scheduleUpdate添加正确的标记
        scale: defaultScale
      }, () => {
        // 在数据更新完成后调用更新方法
        this.scheduleUpdate();
      });
    } else {
      // 只更新标记，不改变地图位置
      this.setData({
        allMarkers: markers,
        markers: filteredMarkers,
        visibleMarkers: [] // 初始化visibleMarkers，让scheduleUpdate添加正确的标记
      }, () => {
        // 在数据更新完成后调用更新方法
        this.scheduleUpdate();
      });
    }
  },

  calculateMarkerPositions(items) {
    const markers = [];
    let markerId = 1;
    
    // 按区域分组
    const locationGroups = new Map();
    
    items.forEach(item => {
      const location = item.location || '未知区域';
      const areaName = location.split('/')[0] || '其他区域';
      
      if (!locationGroups.has(areaName)) {
        locationGroups.set(areaName, []);
      }
      locationGroups.get(areaName).push(item);
    });
    
    // 处理每个区域的项目
    locationGroups.forEach((items, areaName) => {
      items.forEach(item => {
        let lat, lng;
        
        try {
          if (item.latitude && item.longitude) {
            lat = parseFloat(String(item.latitude).replace(/[^\d.-]/g, ''));
            lng = parseFloat(String(item.longitude).replace(/[^\d.-]/g, ''));
            
            if (isNaN(lat) || isNaN(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
              throw new Error('经纬度超出范围');
            }
          } else {
            throw new Error('经纬度不存在');
          }
        } catch (error) {
          console.warn('解析经纬度失败:', error);
          return;
        }
        
        const colorTheme = item.colorTheme || 'gray';
        const iconPath = this.getIconPathByType(item.type, colorTheme, false);
        
        // 对于演出项目，如果没有场次数据，先设置为加载中状态
        let displayWaitTime = item.waitTime;
        let displayWaitUnit = item.waitUnit;
        let displayColorTheme = colorTheme;
        
        if (item.type === 'performance') {
          // 如果是演出项目但没有场次数据，显示加载中状态
          if (!item.showTimes || item.showTimes.length === 0) {
            displayWaitTime = '加载中';
            displayWaitUnit = '';
            displayColorTheme = 'gray';
          }
        }
        
        markers.push({
          id: markerId++,
          latitude: lat,
          longitude: lng,
          name: item.name || '未命名项目',
          waitTime: displayWaitTime,
          waitUnit: displayWaitUnit,
          colorTheme: displayColorTheme,
          type: item.type,
          title: item.name,
          iconPath: iconPath,
          width: 30,
          height: 35, // 增加高度，使标记上下延伸，减小视觉间隔
          anchor: {
            x: 0.5,
            y: 0.95 // 锚点偏下，使标记底部靠近经纬度点
          },
          callout: {
            display: 'NEVER'
          },
          customCallout: {
            anchorY: 5, // 向下偏移气泡位置
            anchorX: 0,
            display: 'ALWAYS',
            content: {
              name: item.name || '未命名项目',
              waitTime: displayWaitTime,
              waitUnit: displayWaitUnit,
              colorTheme: displayColorTheme,
              type: item.type,
              text: displayWaitTime !== undefined && displayWaitUnit !== undefined ? 
                  `${displayWaitTime} ${displayWaitUnit}` : 
                  (displayWaitTime !== undefined ? `${displayWaitTime}` : '')
            }
          },
          item: item
        });
      });
    });
    
    // 处理marker重叠问题
    this.adjustOverlappingMarkers(markers);
    
    return markers;
  },

  // 判断两个marker是否需要检测碰撞
  shouldCheckCollision(marker1, marker2) {
    const type1 = marker1.type || marker1.item?.type;
    const type2 = marker2.type || marker2.item?.type;
    
    // 游乐项目和演出之间需要检测碰撞（因为会一起显示）
    if ((type1 === 'attraction' || type1 === 'performance') && 
        (type2 === 'attraction' || type2 === 'performance')) {
      return true;
    }
    
    // 其他类型只在同类型内检测碰撞
    if (type1 === type2) {
      return true;
    }
    
    return false;
  },

  // 调整重叠的marker位置
  adjustOverlappingMarkers(markers) {
    const OVERLAP_THRESHOLD = MARKER_OVERLAP_CONFIG.threshold;
    const ADJUSTMENT_DISTANCE = MARKER_OVERLAP_CONFIG.adjustmentDistance;
    const MAX_ITERATIONS = MARKER_OVERLAP_CONFIG.maxIterations;
    
    
    let iteration = 0;
    let hasOverlap = true;
    let adjustedMarkers = []; // 记录被调整的marker
    
    // 多次迭代处理重叠，直到没有重叠或达到最大迭代次数
    while (hasOverlap && iteration < MAX_ITERATIONS) {
      hasOverlap = false;
      iteration++;
      
      
      for (let i = 0; i < markers.length; i++) {
        for (let j = i + 1; j < markers.length; j++) {
          const marker1 = markers[i];
          const marker2 = markers[j];
          
          // 首先检查是否需要进行碰撞检测
          if (!this.shouldCheckCollision(marker1, marker2)) {
            continue;
          }
          
          // 计算两个marker之间的距离
          const distance = calculateDistance(
            marker1.latitude, marker1.longitude,
            marker2.latitude, marker2.longitude
          );
          
          // 如果距离小于阈值，说明重叠了
          if (distance < OVERLAP_THRESHOLD) {
            hasOverlap = true;
            
            // 记录原始位置（仅在第一次调整时记录）
            if (!marker2.originalPosition) {
              marker2.originalPosition = {
                latitude: marker2.latitude,
                longitude: marker2.longitude
              };
            }
            
            // 调整第二个marker的位置
            const adjustedPosition = this.calculateAdjustedPosition(
              marker1.latitude, marker1.longitude,
              marker2.latitude, marker2.longitude,
              ADJUSTMENT_DISTANCE,
              iteration // 传入迭代次数，用于增加调整距离
            );
            
            // 更新第二个marker的位置
            marker2.latitude = adjustedPosition.latitude;
            marker2.longitude = adjustedPosition.longitude;
            
            // 标记这个marker已被调整
            marker2.isAdjusted = true;
            
            // 添加到调整列表（避免重复添加）
            if (!adjustedMarkers.find(m => m.id === marker2.id)) {
              adjustedMarkers.push({
                id: marker2.id,
                name: marker2.name,
                originalLat: marker2.originalPosition.latitude,
                originalLng: marker2.originalPosition.longitude,
                newLat: marker2.latitude,
                newLng: marker2.longitude
              });
            }
            
            console.log(`已调整 ${marker2.name} 的位置到: ${adjustedPosition.latitude.toFixed(6)}, ${adjustedPosition.longitude.toFixed(6)}`);
            
            // 验证调整后的距离
            const newDistance = calculateDistance(
              marker1.latitude, marker1.longitude,
              marker2.latitude, marker2.longitude
            );
            console.log(`调整后距离: ${newDistance.toFixed(2)}米`);
          }
        }
      }
    }
    
    
  },

  // 计算调整后的位置
  calculateAdjustedPosition(lat1, lng1, lat2, lng2, adjustmentDistance, iteration = 1) {
    // 根据迭代次数增加调整距离，避免反复重叠
    const dynamicDistance = adjustmentDistance * (1 + iteration * 0.5);
    
    // 计算两点之间的方向向量
    const deltaLat = lat2 - lat1;
    const deltaLng = lng2 - lng1;
    
    // 如果两点完全重合，使用圆形分散策略
    if (deltaLat === 0 && deltaLng === 0) {
      // 使用迭代次数来确定角度，确保多个重叠点能均匀分散
      const angleStep = (2 * Math.PI) / 8; // 8个方向
      const angle = (iteration - 1) * angleStep + Math.random() * angleStep * 0.3; // 添加少量随机性
      
      return {
        latitude: lat2 + dynamicDistance * Math.cos(angle) * 2,
        longitude: lng2 + dynamicDistance * Math.sin(angle) * 2
      };
    }
    
    // 计算单位向量
    const distance = Math.sqrt(deltaLat * deltaLat + deltaLng * deltaLng);
    const unitLat = deltaLat / distance;
    const unitLng = deltaLng / distance;
    
    // 为了避免所有调整都在同一方向，添加垂直方向的偏移
    const perpUnitLat = -unitLng; // 垂直方向
    const perpUnitLng = unitLat;
    
    // 交替使用不同的偏移方向
    const perpOffset = (iteration % 2 === 0 ? 1 : -1) * dynamicDistance * 0.5;
    
    // 沿着原方向移动，并添加垂直偏移
    return {
      latitude: lat1 + unitLat * dynamicDistance * 2 + perpUnitLat * perpOffset,
      longitude: lng1 + unitLng * dynamicDistance * 2 + perpUnitLng * perpOffset
    };
  },

  getIconPathByType(type, colorTheme, isSelected = false) {
    // 基础路径
    const basePath = '/images/';
    
    // 确保colorTheme有一个默认值
    const theme = colorTheme || 'gray';
    
    // 使用三角形SVG图标
    let iconPath;
    
    if (isSelected) {
      // 选中状态使用selected SVG
      iconPath = `${basePath}marker_triangle_modern_selected.svg`;
    } else {
      // 根据颜色主题选择不同的图标
      if (theme === 'performance') {
        iconPath = `${basePath}marker_triangle_modern_performance.svg`;
      } else {
        iconPath = `${basePath}marker_triangle_modern_default.svg`;
      }
    }
    
    return iconPath;
  },

  filterMarkers(markers) {
    let filtered = markers;
    
    // 包含餐厅类型，排除商店类型
    filtered = filtered.filter(marker => {
      const type = marker.item.type;
      // 修正: 如果类型是复数形式，将其规范化为单数形式
      if (type === 'performances') {
        marker.item.type = 'performance';
        marker.type = 'performance';
      }
      
      return type === 'attraction' || type === 'performance' || type === 'performances' || type === 'special' || type === 'restaurant' || type === 'restroom' || type === 'charger';
    });
    
    // 根据类型筛选
    if (this.data.activeFilter === 'all') {
      // 当选择"游乐&演出"时，只显示游乐项目和演出项目，不显示餐厅
      filtered = filtered.filter(marker => {
        const type = marker.item.type;
        return type === 'attraction' || type === 'performance' || type === 'performances' || type === 'special';
      });
    } else if (this.data.activeFilter === 'favorite') {
      filtered = filtered.filter(marker => this.isItemFavorite(marker.item));
    } else {
      filtered = filtered.filter(marker => {
        // 处理复数形式
        let itemType = marker.item.type;
        let activeFilter = this.data.activeFilter;
        
        // 处理复数形式匹配
        if (activeFilter === 'performance' && itemType === 'performances') {
          return true;
        }
        if (activeFilter === 'performances' && itemType === 'performance') {
          return true;
        }
        
        return itemType === activeFilter;
      });
    }
    
    // 过滤关闭的项目
    if (this.data.filterClosed) {
      filtered = filtered.filter(marker => {
        return marker.item.waitTime !== '关闭' && marker.item.waitTime !== '已结束';
      });
    }
    
    return filtered;
  },

  isItemFavorite(item) {
    if (!item || !item.id) return false;
    const app = getApp();
    const itemId = item.id;
    return favoritesService.isFavorite(app, this.data.currentPark, itemId);
  },

  handleFilter(e) {
    console.log('=== 筛选按钮被点击 ===');
    console.log('筛选按钮事件对象:', e);
    
    const type = e.currentTarget.dataset.type;
    const button = this.data.filterButtons.find(btn => btn.type === type);
    
    // 先关闭已经展示的卡片，再处理过滤操作
    if (this.data.showCard) {
      this.handleCloseCard(true);
    }
    
    if (button && button.isToggle) {
      this.setData({
        filterClosed: !this.data.filterClosed
      });
    } else {
      this.setData({
        activeFilter: type
      });
    }
    
    // 更新过滤后的标记点
    this.setData({
      markers: this.filterMarkers(this.data.allMarkers)
    }, () => {
      // 在过滤标记更新后立即刷新地图显示
      console.log('筛选条件已变更，正在更新地图标记...');
      
      // 短振动提供反馈
      wx.vibrateShort({
        type: 'light'
      });
      
      // 特殊处理洗手间和充电宝筛选：移动地图位置但不聚合
      if (type === 'restroom') {
        this.moveToRestroomLocation();
      } else if (type === 'charger') {
        this.moveToChargerLocation();
      } else {
        // 其他筛选正常触发聚合更新
        this.scheduleUpdate();
      }
    });
  },

  // 强制显示独立markers（用于洗手间和充电宝筛选）
  forceShowIndividualMarkers() {
    console.log('【forceShowIndividualMarkers】强制显示所有独立markers');
    
    // 获取当前筛选后的markers
    const filteredMarkers = this.data.markers;
    
    if (!filteredMarkers || filteredMarkers.length === 0) {
      console.log('没有需要显示的markers');
      return;
    }
    
    // 确保所有markers都是独立显示，移除任何聚合标记
    const individualMarkers = filteredMarkers.map(marker => {
      // 创建独立marker的副本，确保没有聚合相关属性
      return {
        ...marker,
        clusterId: undefined,        // 移除聚合ID
        clusterCount: undefined,     // 移除聚合计数
        isCluster: false,           // 标记为非聚合
        // 确保有正确的位置信息
        latitude: marker.latitude || marker.item?.latitude,
        longitude: marker.longitude || marker.item?.longitude
      };
    });
    
    console.log('强制显示独立markers数量:', individualMarkers.length);
    
    // 更新markers显示
    this.setData({
      markers: individualMarkers,
      visibleMarkers: individualMarkers
    }, () => {
      console.log('独立markers显示完成');
    });
  },

  // 处理筛选容器点击事件，阻止穿透
  handleFilterContainerTap(e) {
    console.log('=== 筛选容器被点击，阻止事件穿透 ===');
    console.log('容器点击事件对象:', e);
    
    // 记录筛选区域点击时间，用于后续判断
    this.lastFilterClickTime = Date.now();
    
    // 这个方法的目的就是阻止事件穿透到底层的地图组件
    // 使用catchtap会自动阻止事件冒泡，不需要额外处理
  },

  // 检查当前点击是否在筛选区域内（异步版本）
  checkClickInFilterArea() {
    return new Promise((resolve) => {
      // 获取筛选容器的位置信息
      const query = wx.createSelectorQuery();
      query.select('.filter-container').boundingClientRect();
      
      query.exec((res) => {
        const filterRect = res[0];
        if (!filterRect) {
          console.log('未找到筛选容器，允许显示聚合卡片');
          resolve(false);
          return;
        }
        
        console.log('筛选容器位置:', filterRect);
        
        // 获取当前点击位置（可能需要从全局变量或其他方式获取）
        // 这里我们采用一种简化的方式：检查最近的用户交互
        
        // 由于我们无法直接获取点击坐标，这里采用时间窗口的方式
        // 如果在很短时间内有筛选按钮被点击，则认为是在筛选区域内
        const now = Date.now();
        const lastFilterClickTime = this.lastFilterClickTime || 0;
        const timeDiff = now - lastFilterClickTime;
        
        console.log('时间差:', timeDiff);
        
        // 如果在200ms内有筛选相关操作，认为是筛选区域内的点击
        if (timeDiff < 200) {
          console.log('检测到筛选区域内的点击');
          resolve(true);
        } else {
          console.log('允许显示聚合卡片');
          resolve(false);
        }
      });
    });
  },

  // 检查点击位置是否在筛选区域内
  isClickInFilterArea(e) {
    return new Promise((resolve) => {
      // 获取筛选容器的位置信息
      const query = wx.createSelectorQuery();
      query.select('.filter-container').boundingClientRect();
      
      query.exec((res) => {
        const filterRect = res[0];
        if (!filterRect) {
          resolve(false);
          return;
        }
        
        // 获取点击位置（marker事件中的坐标信息）
        // 注意：marker点击事件的坐标可能需要特殊处理
        console.log('marker点击事件对象:', e);
        
        // 暂时先检查是否有筛选容器，后续可以根据实际坐标进行精确判断
        resolve(false);
      });
    });
  },

  // 同步版本的筛选区域检查（简化版）
  isClickInFilterAreaSync(e) {
    console.log('=== 开始检查筛选区域 ===');
    console.log('事件对象结构:', JSON.stringify(e, null, 2));
    
    // 检查事件对象中是否有坐标信息
    let clickX, clickY;
    
    // 尝试从不同的属性中获取坐标
    if (e.detail && e.detail.x !== undefined && e.detail.y !== undefined) {
      clickX = e.detail.x;
      clickY = e.detail.y;
      console.log('从e.detail获取坐标:', clickX, clickY);
    } else if (e.x !== undefined && e.y !== undefined) {
      clickX = e.x;
      clickY = e.y;
      console.log('从e直接获取坐标:', clickX, clickY);
    } else {
      console.log('marker事件中未找到坐标信息，事件对象属性:', Object.keys(e));
      console.log('跳过筛选区域检查');
      return false;
    }
    
    console.log('marker点击坐标:', clickX, clickY);
    
    // 获取筛选区域的大致位置（基于已知的CSS定位）
    // top: calc(80rpx + env(safe-area-inset-top) + 10rpx)
    // left: 10rpx, right: 10rpx
    
    // 将rpx转换为px（假设设备像素比为2）
    const rpxToPx = (rpx) => rpx / 750 * wx.getSystemInfoSync().windowWidth;
    
    const systemInfo = wx.getSystemInfoSync();
    const safeAreaTop = systemInfo.safeArea ? systemInfo.safeArea.top : 0;
    
    // 计算筛选区域的大致范围
    const filterTop = rpxToPx(80) + safeAreaTop + rpxToPx(10);
    const filterLeft = rpxToPx(10);
    const filterRight = systemInfo.windowWidth - rpxToPx(10);
    const filterHeight = rpxToPx(120); // 估算筛选区域高度
    const filterBottom = filterTop + filterHeight;
    
    console.log('筛选区域范围:', {
      top: filterTop,
      left: filterLeft,
      right: filterRight,
      bottom: filterBottom
    });
    
    // 判断点击位置是否在筛选区域内
    const isInFilterArea = clickX >= filterLeft && 
                          clickX <= filterRight && 
                          clickY >= filterTop && 
                          clickY <= filterBottom;
    
    console.log('点击是否在筛选区域内:', isInFilterArea);
    return isInFilterArea;
  },

  // 洗手间筛选：只移动地图位置，不重复设置markers
  moveToRestroomLocation() {
    console.log('【moveToRestroomLocation】洗手间筛选：移动地图到合适位置');
    
    // 显示加载提示
    wx.showLoading({
      title: '定位中...'
    });
    
    // 设置定位超时
    const locationTimeout = setTimeout(() => {
      console.warn('定位超时，直接使用游乐场中心位置');
      wx.hideLoading();
      this.moveToRestroomPosition(null); // 传入null表示定位失败
    }, 5000); // 5秒超时
    
    // 获取用户位置
    wx.getLocation({
      type: 'gcj02',
      timeout: 5000, // 设置wx.getLocation的超时时间
      success: (res) => {
        clearTimeout(locationTimeout); // 清除超时定时器
        wx.hideLoading();
        console.log('获取用户位置成功:', res);
        this.moveToRestroomPosition(res);
      },
      fail: (err) => {
        clearTimeout(locationTimeout); // 清除超时定时器
        console.error('获取位置失败:', err);
        wx.hideLoading();
        this.moveToRestroomPosition(null); // 传入null表示定位失败
      }
    });
  },

  // 充电宝筛选：只移动地图位置，不重复设置markers
  moveToChargerLocation() {
    console.log('【moveToChargerLocation】充电宝筛选：移动地图到合适位置');
    
    // 显示加载提示
    wx.showLoading({
      title: '定位中...'
    });
    
    // 设置定位超时
    const locationTimeout = setTimeout(() => {
      console.warn('定位超时，直接使用游乐场中心位置');
      wx.hideLoading();
      this.moveToChargerPosition(null); // 传入null表示定位失败
    }, 5000); // 5秒超时
    
    // 获取用户位置
    wx.getLocation({
      type: 'gcj02',
      timeout: 5000, // 设置wx.getLocation的超时时间
      success: (res) => {
        clearTimeout(locationTimeout); // 清除超时定时器
        wx.hideLoading();
        console.log('获取用户位置成功:', res);
        this.moveToChargerPosition(res);
      },
      fail: (err) => {
        clearTimeout(locationTimeout); // 清除超时定时器
        console.error('获取位置失败:', err);
        wx.hideLoading();
        this.moveToChargerPosition(null); // 传入null表示定位失败
      }
    });
  },

  // 移动地图到洗手间合适位置
  moveToRestroomPosition(userLocation) {
    console.log('【moveToRestroomPosition】移动到洗手间视图', userLocation);
    
    const app = getApp();
    const parkConfig = app.getParkConfigById(this.data.currentParkId);
    
    if (!parkConfig) {
      wx.showToast({
        title: '无法获取游乐场信息',
        icon: 'none'
      });
      return;
    }
    
    let targetLatitude, targetLongitude;
    let locationSource = '';
    
    if (userLocation) {
      // 有用户位置，计算距离决定目标位置
      const distance = calculateDistance(
        userLocation.latitude, userLocation.longitude,
        parkConfig.latitude, parkConfig.longitude
      );
      
      console.log('用户距离游乐场:', distance, '米');
      
      if (distance < 3000) {
        // 小于3公里，移动到用户位置
        targetLatitude = userLocation.latitude;
        targetLongitude = userLocation.longitude;
        locationSource = '用户位置';
        console.log('用户在游乐场附近，移动到用户位置');
      } else {
        // 大于等于3公里，移动到游乐场中心
        targetLatitude = parkConfig.latitude;
        targetLongitude = parkConfig.longitude;
        locationSource = '游乐场中心';
        console.log('用户距离游乐场较远，移动到游乐场中心');
      }
    } else {
      // 没有用户位置（定位失败），移动到游乐场中心
      targetLatitude = parkConfig.latitude;
      targetLongitude = parkConfig.longitude;
      locationSource = '游乐场中心（定位失败）';
      console.log('定位失败，移动到游乐场中心');
    }
    
    // 显示操作提示
    wx.showToast({
      title: `已定位到${locationSource}`,
      icon: 'success',
      duration: 1500
    });
    
    // 只更新地图位置和缩放级别，不重复设置markers
    this.setData({
      latitude: targetLatitude,
      longitude: targetLongitude,
      scale: 18
    }, () => {
      console.log('洗手间筛选完成，地图已移动到:', locationSource, '缩放级别: 18（不聚合）');
      
      // 短振动提供反馈
      wx.vibrateShort({
        type: 'light'
      });
      
      // 洗手间筛选：强制显示独立markers
      console.log('洗手间筛选：强制显示独立markers');
      
      // 延迟调用，确保地图位置更新完成
      setTimeout(() => {
        this.forceShowIndividualMarkers();
      }, 100);
    });
  },

  // 移动地图到充电宝合适位置
  moveToChargerPosition(userLocation) {
    console.log('【moveToChargerPosition】移动到充电宝视图', userLocation);
    
    const app = getApp();
    const parkConfig = app.getParkConfigById(this.data.currentParkId);
    
    if (!parkConfig) {
      wx.showToast({
        title: '无法获取游乐场信息',
        icon: 'none'
      });
      return;
    }
    
    let targetLatitude, targetLongitude;
    let locationSource = '';
    
    if (userLocation) {
      // 有用户位置，计算距离决定目标位置
      const distance = calculateDistance(
        userLocation.latitude, userLocation.longitude,
        parkConfig.latitude, parkConfig.longitude
      );
      
      console.log('用户距离游乐场:', distance, '米');
      
      if (distance < 3000) {
        // 小于3公里，移动到用户位置
        targetLatitude = userLocation.latitude;
        targetLongitude = userLocation.longitude;
        locationSource = '用户位置';
        console.log('用户在游乐场附近，移动到用户位置');
      } else {
        // 大于等于3公里，移动到游乐场中心
        targetLatitude = parkConfig.latitude;
        targetLongitude = parkConfig.longitude;
        locationSource = '游乐场中心';
        console.log('用户距离游乐场较远，移动到游乐场中心');
      }
    } else {
      // 没有用户位置（定位失败），移动到游乐场中心
      targetLatitude = parkConfig.latitude;
      targetLongitude = parkConfig.longitude;
      locationSource = '游乐场中心（定位失败）';
      console.log('定位失败，移动到游乐场中心');
    }
    
    // 显示操作提示
    wx.showToast({
      title: `已定位到${locationSource}`,
      icon: 'success',
      duration: 1500
    });
    
    // 只更新地图位置和缩放级别，不重复设置markers
    this.setData({
      latitude: targetLatitude,
      longitude: targetLongitude,
      scale: 18
    }, () => {
      console.log('充电宝筛选完成，地图已移动到:', locationSource, '缩放级别: 18（不聚合）');
      
      // 短振动提供反馈
      wx.vibrateShort({
        type: 'light'
      });
      
      // 充电宝筛选：强制显示独立markers
      console.log('充电宝筛选：强制显示独立markers');
      
      // 延迟调用，确保地图位置更新完成
      setTimeout(() => {
        this.forceShowIndividualMarkers();
      }, 100);
    });
  },


  // 切换隐藏已关闭状态
  handleToggleHideClosed() {
    console.log('【handleToggleHideClosed】切换隐藏已关闭状态');
    
    // 先关闭已经展示的卡片
    if (this.data.showCard) {
      this.handleCloseCard(true);
    }
    
    const newFilterClosed = !this.data.filterClosed;
    this.setData({
      filterClosed: newFilterClosed
    });
    
    console.log('【handleToggleHideClosed】新的隐藏状态:', newFilterClosed);
    
    // 更新过滤后的标记点
    this.setData({
      markers: this.filterMarkers(this.data.allMarkers)
    }, () => {
      console.log('隐藏已关闭状态已变更，正在更新地图标记...');
      
      // 短振动提供反馈
      wx.vibrateShort({
        type: 'light'
      });
      
      // 立即触发标记更新
      this.scheduleUpdate();
    });
  },

  // 处理游乐场选择变更
  onParkChange(e) {
    const index = parseInt(e.detail.value);
    const park = this.data.parks[index];
    const parkId = park.id;
    const parkName = park.name;
    const app = getApp();
    
    // 如果选择的是当前游乐场，不做任何操作
    if (parkId === this.data.currentParkId) {
      return;
    }
    
    console.log('切换游乐场:', {
      index,
      parkName,
      parkId,
      parks: this.data.parks
    });
    
    // 直接切换游乐场，不再提示确认
    app.switchPark(parkId);
  },

  // 显示聚合点卡片
  showClusterCard(clusterMarker) {
    if (!clusterMarker || !clusterMarker.customCallout?.content?.isCluster) {
      return;
    }

    // 检查点击是否在筛选区域内，如果是则不显示聚合卡片
    this.checkClickInFilterArea().then(isInFilterArea => {
      if (isInFilterArea) {
        console.log('点击位置在筛选区域内，不显示聚合卡片');
        return;
      }
      
      // 继续原有的显示逻辑
      this.doShowClusterCard(clusterMarker);
    });
  },

  // 实际执行显示聚合卡片的逻辑
  doShowClusterCard(clusterMarker) {
    
    // 获取完整的markers列表，不再受限于5个
    let allMarkers = clusterMarker.customCallout.content.allMarkers || [];
    const location = clusterMarker.customCallout.content.location || '未知区域';
    
    // 获取最新的时间数据缓存，确保聚合卡片显示最新时间
    const app = getApp();
    const queueTimeData = app.getAllQueueTimeData();
    const performanceTimeData = app.getAllPerformanceTimeData();
    
    // 更新allMarkers中的时间信息
    allMarkers = allMarkers.map(marker => {
      const itemId = marker.item?.id || marker.id;
      const updatedMarker = { ...marker };
      
      // 更新游乐项目的时间信息
      if ((marker.type === 'attraction' || marker.item?.type === 'attraction') && queueTimeData && queueTimeData[itemId]) {
        const queueData = queueTimeData[itemId];
        Object.assign(updatedMarker, {
          waitTime: queueData.waitTime,
          waitUnit: queueData.waitUnit,
          colorTheme: queueData.colorTheme,
          status: queueData.status
        });
        if (updatedMarker.item) {
          Object.assign(updatedMarker.item, {
            waitTime: queueData.waitTime,
            waitUnit: queueData.waitUnit,
            colorTheme: queueData.colorTheme,
            status: queueData.status
          });
        }
        console.log(`聚合卡片中更新游乐项目 ${marker.item?.name || marker.name} 的时间: ${queueData.waitTime}${queueData.waitUnit}, 颜色主题: ${queueData.colorTheme}`);
      }
      
      // 更新演出项目的时间信息
      if ((marker.type === 'performance' || marker.item?.type === 'performance') && performanceTimeData && performanceTimeData[itemId]) {
        const performanceData = performanceTimeData[itemId];
        // 基于当前时间重新计算演出时间
        const recalculatedTime = this.recalculatePerformanceTime(performanceData, new Date());
        
        Object.assign(updatedMarker, {
          waitTime: recalculatedTime.waitTime,
          waitUnit: recalculatedTime.waitUnit,
          colorTheme: recalculatedTime.colorTheme,
          status: performanceData.status
        });
        if (updatedMarker.item) {
          Object.assign(updatedMarker.item, {
            waitTime: recalculatedTime.waitTime,
            waitUnit: recalculatedTime.waitUnit,
            colorTheme: recalculatedTime.colorTheme,
            status: performanceData.status
          });
        }
        console.log(`聚合卡片中重新计算演出项目 ${marker.item?.name || marker.name} 的时间: ${recalculatedTime.waitTime}${recalculatedTime.waitUnit} (原始: ${performanceData.timeToNext}${performanceData.timeUnit})`);
      }
      
      return updatedMarker;
    });
    
    // 如果启用了"隐藏已关闭"筛选，则过滤掉已关闭的项目
    if (this.data.filterClosed) {
      allMarkers = allMarkers.filter(marker => {
        const waitTime = marker.item ? marker.item.waitTime : marker.waitTime;
        return waitTime !== '关闭' && waitTime !== '已结束';
      });
      console.log(`应用"隐藏已关闭"筛选后，聚合卡片包含${allMarkers.length}个项目`);
    } else {
      console.log(`显示聚合卡片，包含${allMarkers.length}个项目`);
    }
    
    // 获取项目总数（已应用筛选条件）
    const totalCount = allMarkers.length;
    
    // 处理marker数据，确保图片和必要信息存在
    const processedMarkers = allMarkers.map(marker => {
      const item = marker.item || marker;
      
      // 确定正确的颜色主题
      let colorTheme = 'gray';
      if (item.colorTheme) {
        colorTheme = item.colorTheme;
      } else if (marker.colorTheme) {
        colorTheme = marker.colorTheme;
      } else {
        // 如果没有设置颜色主题，根据等待时间和单位计算
        const waitTime = item.waitTime !== undefined ? item.waitTime : marker.waitTime;
        const waitUnit = item.waitUnit || marker.waitUnit || '';
        
        if (waitTime === '关闭' || waitTime === '已结束' || waitTime === '无场次' || waitTime === '数据错误' || waitTime === '已满') {
          colorTheme = 'gray';
        } else if (waitTime === '常驻') {
          colorTheme = 'green';
        } else if (waitUnit === '分钟' && typeof waitTime === 'number') {
          if (waitTime < 30) {
            colorTheme = 'green';  // 30分钟以内：绿色
          } else if (waitTime < 60) {
            colorTheme = 'orange'; // 30-60分钟：橙色
          } else {
            colorTheme = 'red';    // 60分钟以上：红色
          }
        } else if (waitUnit === '小时' && typeof waitTime === 'number') {
          if (waitTime <= 1) {
            colorTheme = 'orange'; // 1小时以内：橙色
          } else {
            colorTheme = 'red';    // 1小时以上：红色
          }
        }
      }
      
      console.log(`处理聚合卡片项目 ${item.name || '未命名'}: waitTime=${item.waitTime}, waitUnit=${item.waitUnit}, colorTheme=${colorTheme}`);
      
      return {
        ...marker,
        image: item.image || '/images/placeholder.png',
        name: item.name || '未命名项目',
        location: item.location || '未知位置',
        waitTime: item.waitTime !== undefined ? item.waitTime : '未知',
        waitUnit: item.waitUnit || '',
        colorTheme: colorTheme,
        id: item.id,
        type: item.type
      };
    });





    // 排序：按时间从小到大，其次是常驻，最后是关闭
    processedMarkers.sort((a, b) => {
      // 扩展关闭状态的判断条件，包括更多可能的状态
      const closedStates = ['关闭', '关闭状态', '已结束', '暂停', '维护', '停运', '不开放'];
      const aIsClosed = closedStates.some(state => 
        a.waitTime === state || (typeof a.waitTime === 'string' && a.waitTime.includes(state))
      );
      const bIsClosed = closedStates.some(state => 
        b.waitTime === state || (typeof b.waitTime === 'string' && b.waitTime.includes(state))
      );
      
      // 判断是否为常驻项目
      const aIsPermanent = a.waitTime === '常驻';
      const bIsPermanent = b.waitTime === '常驻';
      
      
      // 第一优先级：关闭状态的项目排在最后
      if (aIsClosed !== bIsClosed) {
        const result = aIsClosed - bIsClosed; // false(0) 排在前面，true(1) 排在后面
        return result;
      }
      
      // 第二优先级：常驻项目排在非常驻且非关闭项目的后面
      if (!aIsClosed && !bIsClosed && aIsPermanent !== bIsPermanent) {
        const result = aIsPermanent - bIsPermanent; // false(0) 排在前面，true(1) 排在后面
        return result;
      }
      
      // 第三优先级：如果都是非常驻且非关闭状态，按等待时间从小到大排序
      if (!aIsClosed && !bIsClosed && !aIsPermanent && !bIsPermanent) {
        // 获取等待时间的数值，并根据单位转换为分钟
        const getTimeInMinutes = (marker) => {
          const waitTime = marker.waitTime;
          const waitUnit = marker.waitUnit;
          
          if (typeof waitTime === 'number') {
            // 根据单位转换为分钟
            if (waitUnit === '小时后开放' || waitUnit === '小时后开始' || waitUnit === '小时') {
              return waitTime * 60; // 小时转分钟
            } else if (waitUnit === '分钟后开放' || waitUnit === '分钟后开始' || waitUnit === '分钟') {
              return waitTime;
            } else {
              return waitTime; // 默认按分钟处理
            }
          } else if (waitTime && !isNaN(parseInt(waitTime))) {
            const timeValue = parseInt(waitTime);
            // 根据单位转换为分钟
            if (waitUnit === '小时后开放' || waitUnit === '小时后开始' || waitUnit === '小时') {
              return timeValue * 60; // 小时转分钟
            } else if (waitUnit === '分钟后开放' || waitUnit === '分钟后开始' || waitUnit === '分钟') {
              return timeValue;
            } else {
              return timeValue; // 默认按分钟处理
            }
          } else {
            return 9999; // 无法解析的时间排在最后
          }
        };
        
        const aTime = getTimeInMinutes(a);
        const bTime = getTimeInMinutes(b);
        
        // 等待时间从小到大排序
        if (aTime !== bTime) {
          const result = aTime - bTime;
          return result;
        }
      }
      
      // 如果等待时间相同或者是常驻/关闭状态，按名称排序
      return a.name.localeCompare(b.name);
    });





    // 如果当前有卡片显示，先隐藏它（不改变cardInfo），然后再显示新卡片
    // 这样可以确保视图先完成隐藏动画，再显示新卡片
    if (this.data.showCard) {
      // 先隐藏卡片，但保留卡片信息
      this.setData({
        showCard: false
      }, () => {
        // 在下一帧显示新卡片（给视图一个更新周期）
        setTimeout(() => {
          // 设置聚合点卡片数据
          this.setData({
            showCard: true,
            cardInfo: {
              isClusterCard: true,
              location: location,
              totalCount: totalCount,
              clusterMarkers: processedMarkers, // 包含所有markers
              type: 'cluster'
            }
          });
        }, 50); // 给UI留出时间进行动画过渡
      });
    } else {
      // 直接设置聚合点卡片数据
      this.setData({
        showCard: true,
        cardInfo: {
          isClusterCard: true,
          location: location,
          totalCount: totalCount,
          clusterMarkers: processedMarkers, // 包含所有markers
          type: 'cluster'
        }
      });
    }
  },

  // 处理点击聚合卡片中的单个项目
  selectClusterItem(e) {
    // 获取点击的marker数据
    const marker = e.currentTarget.dataset.marker;
    
    if (!marker) return;
    
    console.log('点击了聚合卡片中的项目:', marker);
    
    // 震动反馈
    wx.vibrateShort({
      type: 'light'
    });
    
    // 不再关闭聚合卡片，使其在从详情页返回时仍然可见
    // this.handleCloseCard(false); -- 删除这行代码
    
    // 直接跳转到详情页，不显示单个标记的卡片
    console.log('跳转到项目详情页');
    
    // 传递当前的排队时间数据
    const waitTimeParams = marker.waitTime !== undefined && marker.waitUnit !== undefined 
      ? `&waitTime=${encodeURIComponent(marker.waitTime)}&waitUnit=${encodeURIComponent(marker.waitUnit)}&colorTheme=${marker.colorTheme || 'gray'}`
      : '';
    
    wx.navigateTo({
      url: `/pages/details/details?id=${marker.id}&type=${marker.type}&parkId=${this.data.currentParkId}${waitTimeParams}`,
      fail: (err) => {
        console.error('跳转详情页失败:', err);
        wx.showToast({
          title: '无法打开详情页',
          icon: 'none'
        });
      }
    });
  },

  // 添加一个新的批量渲染函数
  batchRenderMarkers(clusters) {
    // 计算总批次数
    const totalClusters = clusters.length;
    const totalBatches = Math.ceil(totalClusters / BATCH_SIZE);
    
    // 批次计数器
    let currentBatch = 0;
    // 存储所有渲染的markers
    const allVisibleMarkers = [];
    
    // 处理聚合点优先级
    // 将聚合点（多个marker）和单点分开处理
    const priorityList = [];
    const clustersList = [];
    const singleList = [];
    
    // 根据优先级分类
    clusters.forEach(cluster => {
      if (cluster.markers.length > 1) {
        // 聚合点放入高优先级列表
        clustersList.push(cluster);
      } else {
        // 单点放入普通优先级列表
        singleList.push(cluster);
      }
    });
    
    // 先处理所有聚合点，再处理单点
    priorityList.push(...clustersList);
    priorityList.push(...singleList);
    
    // 分批处理函数
    const processBatch = () => {
      if (currentBatch >= totalBatches) {
        // 所有批次处理完成，更新UI
        console.log('批量渲染完成，总marker数:', allVisibleMarkers.length);
        this.setData({
          visibleMarkers: allVisibleMarkers,
          customCalloutMarkerIds: allVisibleMarkers.map(m => m.id)
        });
        return;
      }
      
      // 计算当前批次的起始和结束索引
      const start = currentBatch * BATCH_SIZE;
      const end = Math.min(start + BATCH_SIZE, totalClusters);
      
      // 处理当前批次的clusters
      for (let i = start; i < end && i < priorityList.length; i++) {
        const cluster = priorityList[i];
        const isCluster = cluster.markers.length > 1;
        
        if (isCluster) {
          // 聚合点 - 创建聚合marker
          this.createClusterMarker(cluster, allVisibleMarkers);
        } else {
          // 单个标记 - 创建单点marker
          this.createSingleMarker(cluster, allVisibleMarkers);
        }
      }
      
      // 处理下一批
      currentBatch++;
      setTimeout(processBatch, BATCH_DELAY);
    };
    
    // 开始处理第一批
    processBatch();
  },

  // 创建聚合点marker
  createClusterMarker(cluster, markersArray) {
    let id = markersArray.length + 1;
    
    // 计算中心点
    const centerLat = cluster.markers.reduce((sum, m) => sum + m.latitude, 0) / cluster.markers.length;
    const centerLng = cluster.markers.reduce((sum, m) => sum + m.longitude, 0) / cluster.markers.length;
    
    // 获取最新的时间数据缓存
    const app = getApp();
    const queueTimeData = app.getAllQueueTimeData();
    const performanceTimeData = app.getAllPerformanceTimeData();
    
    // 确保标记有正确的等待时间和颜色，并使用最新的缓存数据
    cluster.markers.forEach(marker => {
      // 确保有默认的颜色主题
      if (!marker.colorTheme) {
        marker.colorTheme = 'gray';
      }
      
      // 确保marker.item也有颜色主题
      if (marker.item && !marker.item.colorTheme) {
        marker.item.colorTheme = marker.colorTheme || 'gray';
      }
      
      const itemId = marker.item?.id || marker.id;
      
      // 更新游乐项目的时间信息
      if ((marker.type === 'attraction' || marker.item?.type === 'attraction') && queueTimeData && queueTimeData[itemId]) {
        const queueData = queueTimeData[itemId];
        // 更新marker的时间信息
        Object.assign(marker, {
          waitTime: queueData.waitTime,
          waitUnit: queueData.waitUnit,
          colorTheme: queueData.colorTheme || 'gray', // 确保有默认颜色
          status: queueData.status
        });
        // 同时更新marker.item的时间信息
        if (marker.item) {
          Object.assign(marker.item, {
            waitTime: queueData.waitTime,
            waitUnit: queueData.waitUnit,
            colorTheme: queueData.colorTheme || 'gray', // 确保有默认颜色
            status: queueData.status
          });
        }
        console.log(`聚合点中更新游乐项目 ${marker.item?.name || marker.name} 的时间: ${queueData.waitTime}${queueData.waitUnit}`);
      }
      
      // 更新演出项目的时间信息
      if ((marker.type === 'performance' || marker.item?.type === 'performance') && performanceTimeData && performanceTimeData[itemId]) {
        const performanceData = performanceTimeData[itemId];
        // 基于当前时间重新计算演出时间
        const recalculatedTime = this.recalculatePerformanceTime(performanceData, new Date());
        
        // 更新marker的时间信息
        Object.assign(marker, {
          waitTime: recalculatedTime.waitTime,
          waitUnit: recalculatedTime.waitUnit,
          colorTheme: recalculatedTime.colorTheme || 'gray', // 确保有默认颜色
          status: performanceData.status
        });
        // 同时更新marker.item的时间信息
        if (marker.item) {
          Object.assign(marker.item, {
            waitTime: recalculatedTime.waitTime,
            waitUnit: recalculatedTime.waitUnit,
            colorTheme: recalculatedTime.colorTheme || 'gray', // 确保有默认颜色
            status: performanceData.status
          });
        }
        console.log(`聚合点中重新计算演出项目 ${marker.item?.name || marker.name} 的时间: ${recalculatedTime.waitTime}${recalculatedTime.waitUnit} (原始: ${performanceData.timeToNext}${performanceData.timeUnit})`);
      }
      
      // 确保有默认的等待时间
      if (!marker.waitTime) {
        marker.waitTime = '未知';
      }
    });
    
    // 使用聚合中第一个标记的类型和主题色
    const firstMarker = cluster.markers[0];
    const markerType = firstMarker.type || 'attraction';
    const colorTheme = firstMarker.colorTheme || 'gray'; // 默认使用灰色
    
    // 调试信息：输出聚合点中所有标记的颜色主题
    console.log('【聚合点】创建聚合标记，位置:', cluster.location);
    console.log('【聚合点】标记数量:', cluster.markers.length);
    console.log('【聚合点】第一个标记的颜色主题:', colorTheme);
    console.log('【聚合点】所有标记的颜色主题:', cluster.markers.map(m => ({
      name: m.name || m.item?.name || '未命名',
      colorTheme: m.colorTheme || 'undefined'
    })));
    
    // 存储所有聚合点的marker ID，以便后续获取完整数据
    const allMarkerIds = cluster.markers.map(m => m.id || (m.item && m.item.id));
    
    // 获取气泡中显示的前5个项目，如果启用了"隐藏已关闭"，确保不显示已关闭的项目
    let displayMarkers = cluster.markers;
    if (this.data.filterClosed) {
      // 再次过滤已关闭的项目，确保一致性
      displayMarkers = displayMarkers.filter(marker => 
        marker.item.waitTime !== '关闭' && marker.item.waitTime !== '已结束'
      );
    }
    
    // 排序：按时间从小到大，其次是常驻，最后是关闭
    displayMarkers.sort((a, b) => {
      // 判断是否为关闭状态
      const closedStates = ['关闭', '关闭状态', '已结束', '暂停', '维护', '停运', '不开放'];
      const aIsClosed = closedStates.some(state => 
        a.item.waitTime === state || (typeof a.item.waitTime === 'string' && a.item.waitTime.includes(state))
      );
      const bIsClosed = closedStates.some(state => 
        b.item.waitTime === state || (typeof b.item.waitTime === 'string' && b.item.waitTime.includes(state))
      );
      
      // 判断是否为常驻项目
      const aIsPermanent = a.item.waitTime === '常驻';
      const bIsPermanent = b.item.waitTime === '常驻';
      
      // 第一优先级：关闭状态的项目排在最后
      if (aIsClosed !== bIsClosed) {
        return aIsClosed - bIsClosed; // false(0) 排在前面，true(1) 排在后面
      }
      
      // 第二优先级：常驻项目排在非常驻且非关闭项目的后面
      if (!aIsClosed && !bIsClosed && aIsPermanent !== bIsPermanent) {
        return aIsPermanent - bIsPermanent; // false(0) 排在前面，true(1) 排在后面
      }
      
      // 第三优先级：如果都是非常驻且非关闭状态，按等待时间从小到大排序
      if (!aIsClosed && !bIsClosed && !aIsPermanent && !bIsPermanent) {
        // 获取等待时间的数值，并根据单位转换为分钟
        const getTimeInMinutes = (item) => {
          const waitTime = item.waitTime;
          const waitUnit = item.waitUnit;
          
          if (typeof waitTime === 'number') {
            // 根据单位转换为分钟
            if (waitUnit === '小时后开放' || waitUnit === '小时后开始' || waitUnit === '小时') {
              return waitTime * 60; // 小时转分钟
            } else if (waitUnit === '分钟后开放' || waitUnit === '分钟后开始' || waitUnit === '分钟') {
              return waitTime;
            } else {
              return waitTime; // 默认按分钟处理
            }
          } else if (waitTime && !isNaN(parseInt(waitTime))) {
            const timeValue = parseInt(waitTime);
            // 根据单位转换为分钟
            if (waitUnit === '小时后开放' || waitUnit === '小时后开始' || waitUnit === '小时') {
              return timeValue * 60; // 小时转分钟
            } else if (waitUnit === '分钟后开放' || waitUnit === '分钟后开始' || waitUnit === '分钟') {
              return timeValue;
            } else {
              return timeValue; // 默认按分钟处理
            }
          } else {
            return 9999; // 无法解析的时间排在最后
          }
        };
        
        const aTime = getTimeInMinutes(a.item);
        const bTime = getTimeInMinutes(b.item);
        
        if (aTime !== bTime) {
          return aTime - bTime; // 等待时间从小到大（统一按分钟比较）
        }
      }
      
      // 如果等待时间相同或者是常驻/关闭状态，按名称排序
      return a.item.name.localeCompare(b.item.name);
    });
    
    // 取前5个项目显示在气泡中
    displayMarkers = displayMarkers.slice(0, 5);
    
    // 确保displayMarkers中的每个marker都有最新的时间信息用于气泡显示
    const updatedDisplayMarkers = displayMarkers.map(marker => {
      const itemId = marker.item?.id || marker.id;
      const updatedMarker = { ...marker };
      
      // 根据等待时间直接计算颜色主题，不依赖已有的colorTheme属性
      if (updatedMarker.waitTime === '关闭' || updatedMarker.waitTime === '已结束' || 
          updatedMarker.waitTime === '无场次' || updatedMarker.waitTime === '已满' || 
          updatedMarker.waitTime === '未知') {
        updatedMarker.colorTheme = 'gray';
      } else if (updatedMarker.waitTime === '常驻') {
        updatedMarker.colorTheme = 'green';
      } else if (updatedMarker.waitUnit === '分钟' && typeof updatedMarker.waitTime === 'number') {
        if (updatedMarker.waitTime < 30) {
          updatedMarker.colorTheme = 'green';
        } else if (updatedMarker.waitTime < 60) {
          updatedMarker.colorTheme = 'orange';
        } else {
          updatedMarker.colorTheme = 'red';
        }
      } else {
        // 默认颜色
        updatedMarker.colorTheme = 'gray';
      }
      
      console.log(`为聚合气泡中的项目 ${marker.name || marker.item?.name} 设置颜色主题: ${updatedMarker.colorTheme}, 等待时间: ${updatedMarker.waitTime}${updatedMarker.waitUnit || ''}`);
      
      
      // 为气泡显示更新游乐项目的时间信息
      if ((marker.type === 'attraction' || marker.item?.type === 'attraction') && queueTimeData && queueTimeData[itemId]) {
        const queueData = queueTimeData[itemId];
        
        // 应用时间判断逻辑，而不是直接使用API数据
        if (marker.item) {
          // 创建临时对象用于时间判断
          const tempItem = {
            ...marker.item,
            queueTime: queueData.queueTime
          };
          
          // 应用时间判断逻辑
          const { createParkAdapter } = require('../../utils/dataAdapter');
          const app = getApp();
          const currentParkId = app.globalData.currentParkId;
          const adapter = createParkAdapter(currentParkId);
          
          if (adapter && typeof adapter.processAttractionDependencies === 'function') {
            adapter.processAttractionDependencies(tempItem);
            
            // 使用时间判断后的结果
            updatedMarker.waitTime = tempItem.waitTime;
            updatedMarker.waitUnit = tempItem.waitUnit;
            
            console.log(`气泡显示更新游乐项目 ${marker.item?.name || marker.name} 的时间: ${tempItem.waitTime}${tempItem.waitUnit} (经过时间判断)`);
          } else {
            // 如果无法应用时间判断，使用原始API数据
            updatedMarker.waitTime = queueData.waitTime;
            updatedMarker.waitUnit = queueData.waitUnit;
            
            console.log(`气泡显示更新游乐项目 ${marker.item?.name || marker.name} 的时间: ${queueData.waitTime}${queueData.waitUnit} (直接使用API)`);
          }
        } else {
          // 如果没有item信息，直接使用API数据
          updatedMarker.waitTime = queueData.waitTime;
          updatedMarker.waitUnit = queueData.waitUnit;
          
          console.log(`气泡显示更新游乐项目 ${marker.name} 的时间: ${queueData.waitTime}${queueData.waitUnit} (无item信息)`);
        }
        
        // 使用数据适配器的颜色主题函数，确保与其他地方逻辑一致
        const { createParkAdapter } = require('../../utils/dataAdapter');
        const currentParkId = this.data.currentParkId;
        const adapter = createParkAdapter(currentParkId);
        
        if (adapter) {
          updatedMarker.colorTheme = adapter.getColorTheme(updatedMarker.waitTime, updatedMarker.waitUnit);
        } else {
          // 备用逻辑，与数据适配器保持一致
          if (updatedMarker.waitTime === '关闭' || updatedMarker.waitTime === '已结束' || updatedMarker.waitTime === '结束') {
            updatedMarker.colorTheme = 'gray';
          } else if (updatedMarker.waitTime === '常驻') {
            updatedMarker.colorTheme = 'green';
          } else if (updatedMarker.waitUnit === '分钟后开始' || updatedMarker.waitUnit === '分钟后开放') {
            updatedMarker.colorTheme = 'orange';
          } else if (updatedMarker.waitUnit === '小时后开始' || updatedMarker.waitUnit === '小时后开放') {
            // 小时级别的等待，根据小时数判断
            if (typeof updatedMarker.waitTime === 'number') {
              if (updatedMarker.waitTime <= 2) {
                updatedMarker.colorTheme = 'orange'; // 2小时内显示橙色
              } else {
                updatedMarker.colorTheme = 'gray';   // 超过2小时显示灰色
              }
            } else {
              updatedMarker.colorTheme = 'gray';
            }
          } else if (updatedMarker.waitUnit === '分钟' && typeof updatedMarker.waitTime === 'number') {
            if (updatedMarker.waitTime < 30) {
              updatedMarker.colorTheme = 'green';
            } else if (updatedMarker.waitTime < 60) {
              updatedMarker.colorTheme = 'orange';
            } else {
              updatedMarker.colorTheme = 'red';
            }
          } else {
            updatedMarker.colorTheme = 'gray';
          }
        }
        
      }
      
      // 为气泡显示更新演出项目的时间信息
      if ((marker.type === 'performance' || marker.item?.type === 'performance') && performanceTimeData && performanceTimeData[itemId]) {
        const performanceData = performanceTimeData[itemId];
        // 基于当前时间重新计算演出时间
        const recalculatedTime = this.recalculatePerformanceTime(performanceData, new Date());
        
        updatedMarker.waitTime = recalculatedTime.waitTime;
        updatedMarker.waitUnit = recalculatedTime.waitUnit;
        
        // 重新根据等待时间计算颜色主题
        // 使用数据适配器的颜色主题函数，确保与其他地方逻辑一致
        const { createParkAdapter } = require('../../utils/dataAdapter');
        const currentParkId = this.data.currentParkId;
        const adapter = createParkAdapter(currentParkId);
        
        if (adapter) {
          updatedMarker.colorTheme = adapter.getColorTheme(updatedMarker.waitTime, updatedMarker.waitUnit);
        } else {
          // 备用逻辑，与数据适配器保持一致
          if (updatedMarker.waitTime === '关闭' || updatedMarker.waitTime === '已结束' || updatedMarker.waitTime === '结束') {
            updatedMarker.colorTheme = 'gray';
          } else if (updatedMarker.waitTime === '常驻') {
            updatedMarker.colorTheme = 'green';
          } else if (updatedMarker.waitUnit === '分钟后开始' || updatedMarker.waitUnit === '分钟后开放') {
            updatedMarker.colorTheme = 'orange';
          } else if (updatedMarker.waitUnit === '小时后开始' || updatedMarker.waitUnit === '小时后开放') {
            // 小时级别的等待，根据小时数判断
            if (typeof updatedMarker.waitTime === 'number') {
              if (updatedMarker.waitTime <= 2) {
                updatedMarker.colorTheme = 'orange'; // 2小时内显示橙色
              } else {
                updatedMarker.colorTheme = 'gray';   // 超过2小时显示灰色
              }
            } else {
              updatedMarker.colorTheme = 'gray';
            }
          } else if (updatedMarker.waitUnit === '分钟' && typeof updatedMarker.waitTime === 'number') {
            if (updatedMarker.waitTime < 30) {
              updatedMarker.colorTheme = 'green';
            } else if (updatedMarker.waitTime < 60) {
              updatedMarker.colorTheme = 'orange';
            } else {
              updatedMarker.colorTheme = 'red';
            }
          } else {
            updatedMarker.colorTheme = 'gray';
          }
        }
        
      }
      
      return updatedMarker;
    });

    // 添加聚合标记
    markersArray.push({
      id: id,
      latitude: centerLat,
      longitude: centerLng,
      width: 35, // 聚合标记稍大一些
      height: 40, // 增加高度，使标记上下延伸，减小视觉间隔
      anchor: {
        x: 0.5,
        y: 0.95 // 锚点偏下，使标记底部靠近经纬度点
      },
      iconPath: this.getIconPathByType(markerType, colorTheme, false), // 使用单点标记的图标
      zIndex: 999, // 聚合点的默认zIndex设置为较高值
      customCallout: {
        anchorY: 5, // 向下偏移气泡位置
        anchorX: 0,
        display: 'ALWAYS',
        content: {
          markers: updatedDisplayMarkers, // 使用更新后的显示项目，确保时间信息最新
          totalCount: cluster.markers.length,
          location: cluster.location || '未知区域',
          isCluster: true,
          allMarkerIds: allMarkerIds, // 新增：保存所有marker ID
          allMarkers: cluster.markers // 新增：保存所有markers
        }
      }
    });
  },

  // 创建单点marker
  createSingleMarker(cluster, markersArray) {
    let id = markersArray.length + 1;
    const marker = cluster.markers[0];
    
    // 使用数据适配器的颜色主题函数，确保与其他地方逻辑一致
    const { createParkAdapter } = require('../../utils/dataAdapter');
    const currentParkId = this.data.currentParkId;
    const adapter = createParkAdapter(currentParkId);
    let colorTheme = 'gray';
    
    if (adapter) {
      colorTheme = adapter.getColorTheme(marker.waitTime, marker.waitUnit);
    } else {
      // 备用逻辑，与数据适配器保持一致
      if (marker.waitTime === '关闭' || marker.waitTime === '已结束' || marker.waitTime === '结束') {
        colorTheme = 'gray';
      } else if (marker.waitTime === '常驻') {
        colorTheme = 'green';
      } else if (marker.waitUnit === '分钟后开始' || marker.waitUnit === '分钟后开放') {
        colorTheme = 'orange';
      } else if (marker.waitUnit === '小时后开始' || marker.waitUnit === '小时后开放') {
        // 小时级别的等待，根据小时数判断
        if (typeof marker.waitTime === 'number') {
          if (marker.waitTime <= 2) {
            colorTheme = 'orange'; // 2小时内显示橙色
          } else {
            colorTheme = 'gray';   // 超过2小时显示灰色
          }
        } else {
          colorTheme = 'gray';
        }
      } else if (marker.waitUnit === '分钟' && typeof marker.waitTime === 'number') {
        if (marker.waitTime < 30) {
          colorTheme = 'green';
        } else if (marker.waitTime < 60) {
          colorTheme = 'orange';
        } else {
          colorTheme = 'red';
        }
      } else {
        colorTheme = 'gray';
      }
    }
    
    
    // 构建气泡文本
    let bubbleText = '';
    if (marker.waitTime !== undefined && marker.waitUnit !== undefined) {
      bubbleText = `${marker.waitTime} ${marker.waitUnit}`;
    } else if (marker.waitTime !== undefined) {
      bubbleText = `${marker.waitTime}`;
    }
    
    // 添加单个标记
    markersArray.push({
      ...marker,
      id: id,
      width: 30,
      height: 35, // 增加高度，使标记上下延伸，减小视觉间隔
      anchor: {
        x: 0.5,
        y: 0.95 // 锚点偏下，使标记底部靠近经纬度点
      },
      iconPath: this.getIconPathByType(marker.type, colorTheme, false),
      zIndex: 100, // 单个标记的默认zIndex设置为较低值
      customCallout: {
        anchorY: 5, // 向下偏移气泡位置
        anchorX: 0,
        display: 'ALWAYS',
        content: {
          name: marker.name || '未命名项目',
          waitTime: marker.waitTime,
          waitUnit: marker.waitUnit,
          colorTheme: colorTheme, // 使用确保有值的颜色主题
          type: marker.type,
          text: bubbleText,
          isCluster: false
        }
      },
      // 确保item属性存在
      item: marker.item || marker,
      // 确保colorTheme属性存在
      colorTheme: colorTheme
    });
  },
  
  // 添加一个专门处理卡片关闭按钮点击的函数
  handleCardCloseButton(e) {
    console.log('关闭按钮被点击');
    
    // 检查点击是否在筛选区域内，如果是则不关闭卡片
    this.checkClickInFilterArea().then(isInFilterArea => {
      if (isInFilterArea) {
        console.log('点击位置在筛选区域内，不关闭卡片');
        return;
      }
      
      // 继续原有的关闭逻辑
      this.doCloseCard(e);
    });
  },

  // 实际执行关闭卡片的逻辑
  doCloseCard(e) {
    console.log('执行关闭卡片逻辑');
    
    // 阻止事件冒泡和穿透
    if (e && e.stopPropagation) {
      e.stopPropagation();
    }
    
    // 触发震动反馈
    wx.vibrateShort({
      type: 'medium'
    });
    
    // 调用原有的关闭卡片方法
    this.handleCloseCard();
    
    return false; // 阻止事件继续传播
  },

  // 使用缓存的排队时间数据更新标记点
  updateMarkersWithQueueTime() {
    console.log('【地图数据更新】开始更新排队时间数据');
    const app = getApp();
    
    // 调试：检查当前游乐场ID和缓存状态
    const currentParkId = app.globalData.currentParkId;
    console.log('【地图数据更新】当前游乐场ID:', currentParkId);
    console.log('【地图数据更新】排队时间缓存状态:', app.globalData.queueTimeCache);
    console.log('【地图数据更新】当前游乐场的排队时间缓存:', app.globalData.queueTimeCache[currentParkId]);
    
    const queueTimeData = app.getAllQueueTimeData();
    console.log('【地图数据更新】获取到的排队时间数据:', queueTimeData);
    console.log('【地图数据更新】排队时间数据项目数:', Object.keys(queueTimeData || {}).length);
    
    if (!queueTimeData || Object.keys(queueTimeData).length === 0) {
      console.log('没有排队时间数据可更新 - 原因分析:');
      console.log('- currentParkId:', currentParkId);
      console.log('- queueTimeCache存在:', !!app.globalData.queueTimeCache);
      console.log('- 当前游乐场缓存存在:', !!app.globalData.queueTimeCache[currentParkId]);
      console.log('- 定时器状态:', !!app.globalData.queueTimeTimer);
      return;
    }

    console.log('【地图数据更新】开始更新排队时间数据到地图标记');
    
    let updatedCount = 0;

    // 更新allMarkers数据
    const updatedAllMarkers = this.data.allMarkers.map(marker => {
      if (marker.type === 'attraction' || marker.item?.type === 'attraction') {
        const itemId = marker.item?.id || marker.id;
        const queueData = queueTimeData[itemId];
        if (queueData) {
          updatedCount++;
          console.log(`【地图数据更新】更新项目 ${marker.item?.name || marker.name} 的排队时间`);
          const updatedMarker = { ...marker };
          if (marker.item) {
            updatedMarker.item = {
              ...marker.item,
              queueTime: queueData.queueTime
            };
            
            console.log(`【updateMarkersWithQueueTime】${marker.item.name} API返回的queueTime: ${queueData.queueTime}`);
            
            // 先应用时间判断逻辑到item
            const { createParkAdapter } = require('../../utils/dataAdapter');
            const app = getApp();
            const currentParkId = app.globalData.currentParkId;
            const adapter = createParkAdapter(currentParkId);
            if (adapter && typeof adapter.processAttractionDependencies === 'function') {
              adapter.processAttractionDependencies(updatedMarker.item);
              console.log(`【地图】应用时间判断逻辑后:`, {
                name: updatedMarker.item.name,
                waitTime: updatedMarker.item.waitTime,
                waitUnit: updatedMarker.item.waitUnit,
                status: updatedMarker.item.status,
                colorTheme: updatedMarker.item.colorTheme
              });
            }
            
            // 检查时间判断逻辑是否已经设置了状态
            const timeLogicApplied = updatedMarker.item.waitTime !== undefined && 
                                    (updatedMarker.item.waitUnit === '小时后开放' || 
                                     updatedMarker.item.waitUnit === '分钟后开放' || 
                                     updatedMarker.item.waitUnit === '小时' ||        // 场次逻辑设置的小时
                                     updatedMarker.item.waitUnit === '状态' ||        // 关闭状态的单位
                                     updatedMarker.item.waitTime === '已结束' ||
                                     updatedMarker.item.waitTime === '关闭' ||        // 演出关闭状态
                                     updatedMarker.item.status === '未开放' ||
                                     updatedMarker.item.status === '已关闭');
            
            console.log(`【地图游乐设施】时间判断逻辑检测:`, {
              name: updatedMarker.item.name,
              waitTime: updatedMarker.item.waitTime,
              waitUnit: updatedMarker.item.waitUnit,
              status: updatedMarker.item.status,
              timeLogicApplied: timeLogicApplied,
              原始waitTime: marker.item.waitTime
            });
            
            // 如果时间判断逻辑没有设置状态（即在开放时间内），则使用API数据
            if (!timeLogicApplied) {
              updatedMarker.item.status = queueData.status;
              updatedMarker.item.waitTime = queueData.waitTime;
              updatedMarker.item.waitUnit = queueData.waitUnit;
              updatedMarker.item.colorTheme = queueData.colorTheme;
              console.log(`【地图】使用API数据:`, {
                name: updatedMarker.item.name,
                waitTime: updatedMarker.item.waitTime,
                waitUnit: updatedMarker.item.waitUnit,
                status: updatedMarker.item.status
              });
            } else {
              console.log(`【地图】时间判断逻辑已设置状态，保持不变:`, {
                name: updatedMarker.item.name,
                waitTime: updatedMarker.item.waitTime,
                waitUnit: updatedMarker.item.waitUnit,
                status: updatedMarker.item.status
              });
            }
          }
          // 同时更新marker本身的属性
          Object.assign(updatedMarker, {
            queueTime: queueData.queueTime,
            status: updatedMarker.item?.status || queueData.status,
            waitTime: updatedMarker.item?.waitTime || queueData.waitTime,
            waitUnit: updatedMarker.item?.waitUnit || queueData.waitUnit,
            colorTheme: updatedMarker.item?.colorTheme || queueData.colorTheme
          });
          console.log(`更新游乐项目 ${marker.item?.name || marker.name} 的排队时间: ${updatedMarker.waitTime}${updatedMarker.waitUnit}`);
          return updatedMarker;
        }
      }
      return marker;
    });

    // 重新应用筛选
    const filteredMarkers = this.filterMarkers(updatedAllMarkers);

    // 更新数据
    this.setData({
      allMarkers: updatedAllMarkers,
      markers: filteredMarkers
    });

    // 清除聚合缓存，确保使用最新数据重新生成聚合点
    this.clearMarkerCache();
    
    // 强制更新可见标记，确保聚合点显示最新时间
    this.updateVisibleMarkersWithLatestData();
    
    console.log(`【地图数据更新】排队时间更新完成，共更新了 ${updatedCount} 个项目`);
  },

  // 更新可见标记点
  updateVisibleMarkers() {
    // ... existing code ...
  },

  // 强制更新可见标记，确保聚合点显示最新时间信息
  updateVisibleMarkersWithLatestData() {
    console.log('强制更新可见标记，确保聚合点显示最新时间信息');
    
    // 获取当前地图状态
    this.safeGetScale({
      success: (scaleRes) => {
        const currentScale = scaleRes.scale;
        console.log(`当前缩放级别: ${currentScale}`);
        
        // 获取当前地图区域
        this.safeGetRegion({
          success: (regionRes) => {
            console.log('获取地图区域成功，开始更新聚合点');
            // 直接调用updateClusters，传入当前缩放级别和区域数据
            this.updateClusters(currentScale, regionRes, false);
          },
          fail: (err) => {
            console.error('获取地图区域失败，使用默认方式更新:', err);
            // 如果获取区域失败，使用scheduleUpdate作为备选方案
            this.scheduleUpdate();
          }
        });
      },
      fail: (err) => {
        console.error('获取地图缩放级别失败，使用默认方式更新:', err);
        // 如果获取缩放级别失败，使用scheduleUpdate作为备选方案
        this.scheduleUpdate();
      }
    });
  },

  // 重新计算演出时间（基于当前时间）
  recalculatePerformanceTime(performanceData, currentTime) {
    
    // 应用统一的时间判断逻辑，而不是直接检查status
    const { createParkAdapter } = require('../../utils/dataAdapter');
    const app = getApp();
    const currentParkId = app.globalData.currentParkId;
    const adapter = createParkAdapter(currentParkId);
    
    if (adapter && typeof adapter.processTimeLogic === 'function') {
      // 创建临时演出对象用于时间判断
      const tempPerformance = {
        name: performanceData.name,
        status: performanceData.status,
        openTime: performanceData.openTime,
        closeTime: performanceData.closeTime
      };
      
      const timeResult = adapter.processTimeLogic(tempPerformance, 'performance');
      
      if (timeResult.shouldReturn) {
        console.log(`【重新计算演出时间】${performanceData.name} 时间判断逻辑设置: ${timeResult.waitTime} ${timeResult.waitUnit}`);
        return {
          waitTime: timeResult.waitTime,
          waitUnit: timeResult.waitUnit,
          colorTheme: timeResult.colorTheme
        };
      }
    }
    
    // 如果时间判断逻辑没有返回结果，检查演出状态
    if (performanceData.status !== '开放中') {
      return {
        waitTime: '关闭',
        waitUnit: '',
        colorTheme: 'gray'
      };
    }

    // 如果没有场次数据，返回常驻演出
    if (!performanceData.showTimes || performanceData.showTimes.length === 0) {
      return {
        waitTime: '常驻',
        waitUnit: '',
        colorTheme: 'green'
      };
    }

    try {
      // 查找下一场演出
      const validShowTimes = performanceData.showTimes.filter(show => {
        if (!show) return false;
        
        // 支持多种字段名：time, 时间, 场次时间
        const timeField = show.time || show.时间 || show.场次时间;
        if (!timeField) {
          console.warn(`演出 ${performanceData.name} 场次数据缺少时间字段:`, show);
          return false;
        }
        
        try {
          const timeString = timeField;
          
          // 只处理HH:MM格式的时间
          if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(timeString)) {
            const [hours, minutes] = timeString.split(':').map(num => parseInt(num, 10));
            
            // 创建今天的演出时间
            const showTime = new Date();
            showTime.setHours(hours, minutes, 0, 0);
            
            // 保存解析后的时间和原始时间字符串
            show._parsedTime = showTime;
            show._timeString = timeString;
            
            // 增加时间缓冲，避免边界时间的不稳定
            // 如果距离演出开始还有1分钟以上，才认为是未来场次
            const timeDiffMinutes = Math.floor((showTime - currentTime) / (1000 * 60));
            return timeDiffMinutes >= 1;
          }
          return false;
        } catch (err) {
          console.warn(`解析演出时间出错: ${err.message}`);
          return false;
        }
      });

      console.log(`演出 ${performanceData.name} 当前时间: ${currentTime.getHours()}:${currentTime.getMinutes().toString().padStart(2, '0')}, 有效未来场次: ${validShowTimes.length}`);
      
      if (validShowTimes.length > 0) {
        // 按时间排序，找出最近的一场
        validShowTimes.sort((a, b) => a._parsedTime - b._parsedTime);
        const nextShow = validShowTimes[0];
        
        // 计算等待时间（分钟）- 增加精度和稳定性
        const timeDiff = Math.max(1, Math.floor((nextShow._parsedTime - currentTime) / (1000 * 60)));
        
        // 使用保存的时间字符串
        const nextShowTime = nextShow._timeString || nextShow.time || nextShow.时间 || nextShow.场次时间;
        
        console.log(`演出 ${performanceData.name} 选择下一场: ${nextShowTime}, 等待时间: ${timeDiff}分钟`);
        
        // 判断演出是否在开放时间内
        // 如果等待时间很长（比如超过8小时），可能是演出还未开放
        const isLongWait = timeDiff > 480; // 8小时 = 480分钟
        
        // 获取游乐场营业时间进行判断
        let isParkOpen = false;
        try {
          const app = getApp();
          const currentParkId = app.globalData.currentParkId;
          const parkData = app.getParkConfigById(currentParkId);
          
          if (parkData && parkData.operatingHours) {
            // 解析营业时间
            const operatingHours = parkData.operatingHours;
            let parkOpenTime, parkCloseTime;
            
            if (operatingHours.includes(' - ')) {
              [parkOpenTime, parkCloseTime] = operatingHours.split(' - ');
            } else if (operatingHours.includes('-')) {
              [parkOpenTime, parkCloseTime] = operatingHours.split('-');
            }
            
            if (parkOpenTime && parkCloseTime) {
              const now = new Date();
              const currentTimeMinutes = now.getHours() * 60 + now.getMinutes();
              
              const [parkOpenHour, parkOpenMinute] = parkOpenTime.trim().split(':').map(Number);
              const [parkCloseHour, parkCloseMinute] = parkCloseTime.trim().split(':').map(Number);
              const parkOpenTimeMinutes = parkOpenHour * 60 + (parkOpenMinute || 0);
              const parkCloseTimeMinutes = parkCloseHour * 60 + (parkCloseMinute || 0);
              
              isParkOpen = currentTimeMinutes >= parkOpenTimeMinutes && currentTimeMinutes <= parkCloseTimeMinutes;
            }
          }
        } catch (err) {
          console.warn('获取游乐场营业时间失败，使用默认判断:', err);
          // 默认判断：8:00-22:00为营业时间
          const now = new Date();
          const currentTimeMinutes = now.getHours() * 60 + now.getMinutes();
          isParkOpen = currentTimeMinutes >= 8 * 60 && currentTimeMinutes <= 22 * 60;
        }
        
        // 根据营业状态设置等待时间单位
        let waitUnit, waitTime;
        if (timeDiff <= 120) {
          // 小于等于2小时，按分钟显示
          waitTime = timeDiff;
          waitUnit = isParkOpen ? '分钟' : '分钟后开放';
        } else {
          // 超过2小时，按小时显示
          waitTime = Math.floor(timeDiff / 60);
          waitUnit = isParkOpen ? '小时' : '小时后开放';
        }
        
        // 使用数据适配器的颜色主题函数
        const { createParkAdapter } = require('../../utils/dataAdapter');
        const adapter = createParkAdapter(currentParkId);
        let colorTheme = 'gray';
        
        if (adapter) {
          colorTheme = adapter.getColorTheme(waitTime, waitUnit);
          console.log(`演出 ${performanceData.name} 颜色主题计算:`, {
            waitTime: waitTime,
            waitUnit: waitUnit,
            colorTheme: colorTheme
          });
        }
        
        // 直接返回前面计算好的结果
        return {
          waitTime: waitTime,
          waitUnit: waitUnit,
          colorTheme: colorTheme
        };
      } else {
        // 检查是否所有场次都已结束
        const allShows = performanceData.showTimes.filter(show => {
          if (!show) return false;
          
          // 支持多种字段名：time, 时间, 场次时间
          const timeField = show.time || show.时间 || show.场次时间;
          if (!timeField) return false;
          
          try {
            const timeString = timeField;
            if (!/^\d{1,2}:\d{2}(:\d{2})?$/.test(timeString)) return false;
            
            const [hours, minutes] = timeString.split(':').map(num => parseInt(num, 10));
            const showTime = new Date();
            showTime.setHours(hours, minutes, 0, 0);
            
            show._parsedTime = showTime;
            return true;
          } catch (err) {
            return false;
          }
        });

        if (allShows.length > 0) {
          const allEnded = allShows.every(show => show._parsedTime < currentTime);
          
          if (allEnded) {
            console.log(`演出 ${performanceData.name} 今日场次已全部结束`);
            return {
              waitTime: '已结束',
              waitUnit: '',
              colorTheme: 'gray'
            };
          } else {
            console.log(`演出 ${performanceData.name} 今日场次已满`);
            return {
              waitTime: '已满',
              waitUnit: '',
              colorTheme: 'gray'
            };
          }
        } else {
          console.log(`演出 ${performanceData.name} 无有效场次`);
          return {
            waitTime: '无场次',
            waitUnit: '',
            colorTheme: 'gray'
          };
        }
      }
    } catch (error) {
      console.error(`重新计算演出等待时间失败 [${performanceData.name}]:`, error);
      return {
        waitTime: '数据错误',
        waitUnit: '',
        colorTheme: 'gray'
      };
    }
  },

  // 更新演出时间标记点
  updateMarkersWithPerformanceTime() {
    console.log('【地图数据更新】开始更新演出时间数据');
    const app = getApp();
    
    // 调试：检查当前游乐场ID和缓存状态
    const currentParkId = app.globalData.currentParkId;
    console.log('【地图数据更新】当前游乐场ID:', currentParkId);
    console.log('【地图数据更新】演出时间缓存状态:', app.globalData.performanceTimeCache);
    console.log('【地图数据更新】当前游乐场的演出时间缓存:', app.globalData.performanceTimeCache[currentParkId]);
    
    const performanceTimeData = app.getAllPerformanceTimeData();
    console.log('【地图数据更新】获取到的演出时间数据:', performanceTimeData);
    console.log('【地图数据更新】演出时间数据项目数:', Object.keys(performanceTimeData || {}).length);
    
    if (!performanceTimeData || Object.keys(performanceTimeData).length === 0) {
      console.log('没有演出时间数据可更新 - 原因分析:');
      console.log('- currentParkId:', currentParkId);
      console.log('- performanceTimeCache存在:', !!app.globalData.performanceTimeCache);
      console.log('- 当前游乐场缓存存在:', !!app.globalData.performanceTimeCache[currentParkId]);
      console.log('- 定时器状态:', !!app.globalData.queueTimeTimer);
      return;
    }

    console.log('【地图数据更新】开始更新演出时间数据到地图标记');
    
    let updatedCount = 0;
    console.log('当前演出时间缓存数据:', performanceTimeData);
    
    // 记录当前时间，用于调试
    const currentTime = new Date();
    console.log(`当前时间: ${currentTime.getHours()}:${currentTime.getMinutes().toString().padStart(2, '0')}`);

    // 更新allMarkers数据
    const updatedAllMarkers = this.data.allMarkers.map(marker => {
      if (marker.type === 'performance' || marker.item?.type === 'performance') {
        const itemId = marker.item?.id || marker.id;
        const performanceData = performanceTimeData[itemId];
        if (performanceData) {
          updatedCount++;
          console.log(`【地图数据更新】更新项目 ${marker.item?.name || marker.name} 的演出时间`);
          // 基于当前时间重新计算演出等待时间
          const recalculatedTime = this.recalculatePerformanceTime(performanceData, currentTime);
          
          const updatedMarker = { ...marker };
          if (marker.item) {
            updatedMarker.item = {
              ...marker.item,
              nextShow: performanceData.nextShow,
              nextShowTime: performanceData.nextShowTime,
              showTimes: performanceData.showTimes
            };
            
            // 先应用时间判断逻辑到演出item
            const { createParkAdapter } = require('../../utils/dataAdapter');
            const app = getApp();
            const currentParkId = app.globalData.currentParkId;
            const adapter = createParkAdapter(currentParkId);
            if (adapter && typeof adapter.processPerformanceDependencies === 'function') {
              adapter.processPerformanceDependencies(updatedMarker.item);
              console.log(`【地图演出】应用时间判断逻辑后:`, {
                name: updatedMarker.item.name,
                waitTime: updatedMarker.item.waitTime,
                waitUnit: updatedMarker.item.waitUnit,
                status: updatedMarker.item.status,
                colorTheme: updatedMarker.item.colorTheme
              });
            }
            
            // 检查时间判断逻辑是否已经设置了状态
            const timeLogicApplied = updatedMarker.item.waitTime !== undefined && 
                                    (updatedMarker.item.waitUnit === '小时后开放' || 
                                     updatedMarker.item.waitUnit === '分钟后开放' || 
                                     updatedMarker.item.waitUnit === '小时' ||        // 场次逻辑设置的小时
                                     updatedMarker.item.waitUnit === '状态' ||        // 关闭状态的单位
                                     updatedMarker.item.waitTime === '已结束' ||
                                     updatedMarker.item.waitTime === '关闭' ||        // 演出关闭状态
                                     updatedMarker.item.status === '未开放' ||
                                     updatedMarker.item.status === '已关闭');
            
            console.log(`【地图演出】时间判断逻辑检测:`, {
              name: updatedMarker.item.name,
              waitTime: updatedMarker.item.waitTime,
              waitUnit: updatedMarker.item.waitUnit,
              status: updatedMarker.item.status,
              timeLogicApplied: timeLogicApplied,
              原始waitTime: marker.item.waitTime
            });
            
            // 无论时间判断逻辑是否设置状态，都使用重新计算的演出时间数据
            // 这确保了地图显示与数据适配器逻辑的一致性
            updatedMarker.item.status = performanceData.status;
            updatedMarker.item.timeToNext = recalculatedTime.waitTime;
            updatedMarker.item.timeUnit = recalculatedTime.waitUnit;
            updatedMarker.item.colorTheme = recalculatedTime.colorTheme;
            updatedMarker.item.waitTime = recalculatedTime.waitTime;
            updatedMarker.item.waitUnit = recalculatedTime.waitUnit;
            console.log(`【地图演出】使用重新计算的时间数据:`, {
              name: updatedMarker.item.name,
              waitTime: updatedMarker.item.waitTime,
              waitUnit: updatedMarker.item.waitUnit,
              status: updatedMarker.item.status,
              timeLogicApplied: timeLogicApplied
            });
          }
          // 同时更新marker本身的属性，使用重新计算后的数据
          // 优先使用重新计算的时间数据，确保显示一致性
          Object.assign(updatedMarker, {
            nextShow: performanceData.nextShow,
            nextShowTime: performanceData.nextShowTime,
            showTimes: performanceData.showTimes,
            status: updatedMarker.item?.status || performanceData.status,
            timeToNext: recalculatedTime.waitTime,
            timeUnit: recalculatedTime.waitUnit,
            colorTheme: recalculatedTime.colorTheme,
            waitTime: recalculatedTime.waitTime,
            waitUnit: recalculatedTime.waitUnit
          });
          console.log(`重新计算演出项目 ${marker.item?.name || marker.name} 的时间信息: ${recalculatedTime.waitTime}${recalculatedTime.waitUnit} (原始: ${performanceData.timeToNext}${performanceData.timeUnit})`);
          return updatedMarker;
        }
      }
      return marker;
    });

    // 重新应用筛选
    const filteredMarkers = this.filterMarkers(updatedAllMarkers);

    // 更新数据
    this.setData({
      allMarkers: updatedAllMarkers,
      markers: filteredMarkers
    });

    // 清除聚合缓存，确保使用最新数据重新生成聚合点
    this.clearMarkerCache();
    
    // 强制更新可见标记，确保聚合点显示最新时间
    this.updateVisibleMarkersWithLatestData();
  },

  // 清除标记缓存
  clearMarkerCache() {
    console.log('清除聚合标记缓存');
    // 清除所有缓存，确保使用最新数据重新生成聚合
    Object.keys(markerCache).forEach(key => {
      delete markerCache[key];
    });
  },

  // 分享给好友
  onShareAppMessage() {
    const { currentPark, currentParkId } = this.data;
    return {
      title: `${currentPark}地图 - 探索精彩项目`,
      path: `/pages/map/map?parkId=${currentParkId}`,
      imageUrl: '/images/xiaoxiaolu_default_touxiang.jpg'
    };
  },

  // 分享到朋友圈
  onShareTimeline() {
    const { currentPark, currentParkId } = this.data;
    return {
      title: `${currentPark}地图 - 探索精彩项目`,
      query: `parkId=${currentParkId}&from=timeline`,
      imageUrl: '/images/xiaoxiaolu_default_touxiang.jpg'
    };
  },
}); 