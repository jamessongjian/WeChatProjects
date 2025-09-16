// app.js
const { initParkData } = require('./utils/data');
const logger = require('./utils/logger');

// 定义默认用户信息
const DEFAULT_USER_INFO = {
  avatarUrl: '/images/xiaoxiaolu_default_touxiang.jpg',
  nickName: '小小鹿momo',
  openid: 'default_user',
  _id: 'default_user',
  userType: 'guest',
  isDefaultUser: true // 标记为默认用户
};

// 简单的事件系统实现
class EventEmitter {
  constructor() {
    this.events = {};
  }
  
  on(eventName, callback) {
    if (!this.events[eventName]) {
      this.events[eventName] = [];
    }
    this.events[eventName].push(callback);
    return this;
  }
  
  off(eventName, callback) {
    if (!this.events[eventName]) return this;
    if (!callback) {
      delete this.events[eventName];
      return this;
    }
    this.events[eventName] = this.events[eventName].filter(cb => cb !== callback);
    return this;
  }
  
  emit(eventName, ...args) {
    if (!this.events[eventName]) return false;
    this.events[eventName].forEach(callback => {
      callback(...args);
    });
    return true;
  }
}

App({
  globalData: {
    userInfo: DEFAULT_USER_INFO, // 使用默认用户信息替代 null
    hasUserInfo: false, // 保持为 false，表示未登录
    token: null,
    openid: null, // 添加openid字段
    defaultUserInfo: DEFAULT_USER_INFO, // 保存默认用户信息的引用
    cozeApiKey: null, // Coze API Key 将从服务端动态获取，不再硬编码
    
    // 服务器配置已迁移至云函数，客户端不再需要这些敏感信息
    
    // 动态配置信息
    dynamicConfig: null, // 从服务端获取的配置信息
    configLoaded: false, // 配置是否已加载
    
    // 订阅消息配置
    subscribeMessageConfig: {
      templateIds: ['TN5swp6EXaNDZtynFKD9ohZShXwL4hIBCCMBQtshDL0'] // 演出提醒模板ID
    },
    
    // 日志配置
    logConfig: {
      level: 'INFO', // DEBUG, INFO, WARN, ERROR, NONE
      enableConsole: true // 是否启用控制台输出
    },
    
    currentParkId: 'universal', // 当前选择的游乐场ID
    favorites: {}, // 改为动态初始化
    reminders: [], // 用户提醒信息
    routePlan: null,
    parkData: {}, // 改为按游乐场存储数据
    allItems: {}, // 改为按游乐场存储所有项目
    itemOtherInfo: null,
    
    // 默认规划botid，用于没有游乐场的情况
    defaultPlanBotId: '', // 默认为空
    
    // 是否使用备用图标（当Font Awesome加载失败时）
    useFallbackIcons: false,
    
    // AI助手开关配置
    aiAssistantEnabled: true, // 默认开启AI助手功能
    
    // 常用图标的备用映射
    fallbackIcons: {
      'fa-map-marker': '/static/icons/map-marker.png',
      'fa-chevron-down': '/static/icons/chevron-down.png',
      'fa-star': '/static/icons/star.png',
      'fa-star-o': '/static/icons/star-o.png',
      'fa-clock-o': '/static/icons/clock.png',
      'fa-cutlery': '/static/icons/cutlery.png',
      'fa-shopping-bag': '/static/icons/shopping-bag.png',
      'fa-ticket': '/static/icons/ticket.png',
      'fa-music': '/static/icons/music.png',
      'fa-child': '/static/icons/child.png',
      'fa-wheelchair': '/static/icons/wheelchair.png',
      'fa-heart': '/static/icons/heart.png',
      'fa-heart-o': '/static/icons/heart-o.png',
      'fa-search': '/static/icons/search.png',
      'fa-filter': '/static/icons/filter.png'
    },
    
    // 数据类型配置
    dataTypes: {
      attraction: {
        showInFilter: true,
        filterText: '游乐项目'
      },
      performance: {
        showInFilter: true,
        filterText: '表演项目'
      },
      restaurant: {
        showInFilter: true,
        filterText: '餐厅'
      },
      shop: {
        showInFilter: true,
        filterText: '商店'
      },
      restroom: {
        showInFilter: true,
        filterText: '洗手间'
      },
      charger: {
        showInFilter: true,
        filterText: '充电宝'
      }
    },
    
    // 卡片类型配置
    cardTypes: {
      attractionCard: {
        template: 'attractionTemplate',
        fields: ['name', 'queueTime', 'location', 'openTime', 'hasExpress', 'isIndoor', 'summary', 'flags'],
        style: {
          backgroundColor: '#ffffff',
          borderRadius: '10rpx',
          padding: '20rpx',
          boxShadow: '0 2rpx 10rpx rgba(0, 0, 0, 0.1)'
        },
        // 字段样式配置
        fieldStyles: {
          name: {
            fontSize: '36rpx',
            fontWeight: 'bold',
            color: '#333333'
          },
          queueTime: {
            fontSize: '32rpx',
            color: '#ff4d4f', // 默认红色，实际会根据等待时间动态变化
            fontWeight: 'bold'
          },
          location: {
            fontSize: '28rpx',
            color: '#666666'
          },
          summary: {
            fontSize: '26rpx',
            color: '#888888',
            lineHeight: '1.5'
          },
          flags: {
            fontSize: '22rpx',
            color: '#ffffff',
            backgroundColor: '#1890ff',
            padding: '4rpx 10rpx',
            borderRadius: '6rpx',
            marginRight: '10rpx'
          }
        }
      },
      performanceCard: {
        template: 'performanceTemplate',
        fields: ['name', 'nextShow', 'location', 'openTime', 'showTimes', 'summary', 'flags'],
        style: {
          backgroundColor: '#ffffff',
          borderRadius: '10rpx',
          padding: '20rpx',
          boxShadow: '0 2rpx 10rpx rgba(0, 0, 0, 0.1)'
        },
        // 字段样式配置
        fieldStyles: {
          name: {
            fontSize: '36rpx',
            fontWeight: 'bold',
            color: '#333333'
          },
          nextShow: {
            fontSize: '32rpx',
            color: '#52c41a', // 默认绿色，实际会根据时间动态变化
            fontWeight: 'bold'
          },
          showTimes: {
            fontSize: '28rpx',
            color: '#666666'
          }
        }
      },
      restaurantCard: {
        template: 'restaurantTemplate',
        fields: ['name', 'location', 'cuisine', 'price', 'openTime', 'summary', 'flags'],
        style: {
          backgroundColor: '#ffffff',
          borderRadius: '10rpx',
          padding: '20rpx',
          boxShadow: '0 2rpx 10rpx rgba(0, 0, 0, 0.1)'
        }
      },
      shopCard: {
        template: 'shopTemplate',
        fields: ['name', 'location', 'category', 'openTime', 'summary', 'flags'],
        style: {
          backgroundColor: '#ffffff',
          borderRadius: '10rpx',
          padding: '20rpx',
          boxShadow: '0 2rpx 10rpx rgba(0, 0, 0, 0.1)'
        }
      },
      restroomCard: {
        template: 'restroomTemplate',
        fields: ['name', 'location', 'facilities', 'accessibility', 'babyChanging', 'description'],
        style: {
          backgroundColor: '#ffffff',
          borderRadius: '10rpx',
          padding: '20rpx',
          boxShadow: '0 2rpx 10rpx rgba(0, 0, 0, 0.1)'
        }
      },
      chargerCard: {
        template: 'chargerTemplate',
        fields: ['name', 'location', 'brand', 'capacity', 'availableCount', 'totalCount', 'status', 'description'],
        style: {
          backgroundColor: '#ffffff',
          borderRadius: '10rpx',
          padding: '20rpx',
          boxShadow: '0 2rpx 10rpx rgba(0, 0, 0, 0.1)'
        }
      }
    },
    
    parks: {
      '北京环球影城度假区': {
        id: 'universal',
        latitude: 39.856456,
        longitude: 116.682952,
        // apiEndpoint 已移至云函数中管理，客户端不再需要此信息
        mapConfig: {
          defaultScale: 17,
          clusterThreshold: 18
        },
        apiConfig: {
          attraction: {
            // API路径和响应配置已移至云函数，此处只保留UI配置
            dataType: 'attraction', // 对应数据类型
            displayName: '游乐项目', // 显示名称
            // 环球影城特有配置
            markerConfig: {
              iconHigh: '/images/markers/universal/attraction_high.png', // 自定义高峰期图标
              iconMedium: '/images/markers/universal/attraction_medium.png', // 自定义中等期图标
              iconLow: '/images/markers/universal/attraction_low.png', // 自定义低峰期图标
              iconClosed: '/images/markers/universal/attraction_closed.png', // 自定义关闭状态图标
              selectedIconPath: '/images/markers/universal/attraction_selected.png' // 自定义选中状态图标
            },
            cardConfig: {
              template: 'attractionTemplate', // 使用已存在的模板
              style: {
                backgroundColor: '#003087', // 环球影城蓝色背景
                color: '#ffffff',
                borderRadius: '10rpx',
                padding: '20rpx'
              },
              // 添加自定义气泡样式
              calloutConfig: {
                color: '#FFFFFF',
                fontSize: 12,
                borderRadius: 6,
                bgColor: '#003087', // 环球蓝色背景
                padding: 8,
                display: 'BYCLICK',
                textAlign: 'center',
                borderColor: '#E21A22', // 环球红边框
                borderWidth: 1
              }
            },
            // 添加样式ID配置
            styleIds: {
              callout: 'universal-attraction',
              marker: 'universal-attraction',
              selected: 'universal-attraction-selected',
              card: 'universal-attraction'
            }
          },
          performance: {
            // API路径和响应配置已移至云函数，此处只保留UI配置
            dataType: 'performance', // 对应数据类型
            displayName: '表演项目', // 显示名称
            // 环球影城特有配置
            markerConfig: {
              icon: '/images/marker_triangle_modern_default.svg',
              iconSoon: '/images/marker_triangle_modern_default.svg',
              iconClosed: '/images/marker_triangle_modern_default.svg',
              selectedIconPath: '/images/marker_triangle_modern_default.svg'
            },
            // 添加自定义气泡样式
            calloutConfig: {
              color: '#FFFFFF',
              fontSize: 12,
              borderRadius: 6,
              bgColor: '#E21A22', // 环球红色背景
              padding: 8,
              display: 'BYCLICK',
              textAlign: 'center',
              borderColor: '#003087', // 环球蓝边框
              borderWidth: 1
            },
            // 添加样式ID配置
            styleIds: {
              callout: 'universal-performance',
              marker: 'universal-performance',
              selected: 'universal-performance-selected',
              card: 'universal-performance'
            }
          },
          restaurant: {
            // API路径和响应配置已移至云函数，此处只保留UI配置
            dataType: 'restaurant', // 对应数据类型
            displayName: '餐厅', // 显示名称
            // 环球影城特有配置
            markerConfig: {
              icon: '/images/marker_triangle_modern_default.svg',
              selectedIconPath: '/images/marker_triangle_modern_default.svg'
            },
            // 添加自定义气泡样式
            calloutConfig: {
              color: '#FFFFFF',
              fontSize: 12,
              borderRadius: 6,
              bgColor: '#8C52FF', // 紫色背景
              padding: 8,
              display: 'BYCLICK',
              textAlign: 'center'
            },
            // 添加样式ID配置
            styleIds: {
              callout: 'universal-restaurant',
              marker: 'universal-restaurant',
              selected: 'universal-restaurant-selected',
              card: 'universal-restaurant'
            }
          },
          restroom: {
            // API路径和响应配置已移至云函数，此处只保留UI配置
            dataType: 'restroom', // 对应数据类型
            displayName: '厕所', // 显示名称
            // 环球影城特有配置
            markerConfig: {
              icon: '/images/marker_triangle_modern_default.svg',
              selectedIconPath: '/images/marker_triangle_modern_default.svg'
            },
            // 添加自定义气泡样式
            calloutConfig: {
              color: '#FFFFFF',
              fontSize: 12,
              borderRadius: 6,
              bgColor: '#4CAF50', // 绿色背景
              padding: 8,
              display: 'BYCLICK',
              textAlign: 'center'
            },
            // 添加样式ID配置
            styleIds: {
              callout: 'universal-restroom',
              marker: 'universal-restroom',
              selected: 'universal-restroom-selected',
              card: 'universal-restroom'
            }
          },
          charger: {
            path: '/power-banks',
            responseMapping: {
              data: 'data' // 响应中数据的位置
            },
            dataType: 'charger', // 对应数据类型
            displayName: '充电宝', // 显示名称
            enabled: true, // 开放此接口
            // 环球影城特有配置
            markerConfig: {
              icon: '/images/marker_triangle_modern_default.svg',
              selectedIconPath: '/images/marker_triangle_modern_default.svg'
            },
            // 添加自定义气泡样式
            calloutConfig: {
              color: '#FFFFFF',
              fontSize: 12,
              borderRadius: 6,
              bgColor: '#4CAF50', // 绿色背景
              padding: 8,
              display: 'BYCLICK',
              textAlign: 'center'
            },
            // 添加样式ID配置
            styleIds: {
              callout: 'universal-charger',
              marker: 'universal-charger',
              selected: 'universal-charger-selected',
              card: 'universal-charger'
            }
          },
          shop: {
            path: '/shops',
            responseMapping: {
              data: 'data' // 响应中数据的位置
            },
            dataType: 'shop', // 对应数据类型
            displayName: '商店', // 显示名称
            enabled: true, // 开放此接口
            // 环球影城特有配置
            markerConfig: {
              icon: '/images/marker_triangle_modern_default.svg',
              selectedIconPath: '/images/marker_triangle_modern_default.svg'
            },
            // 添加自定义气泡样式
            calloutConfig: {
              color: '#FFFFFF',
              fontSize: 12,
              borderRadius: 6,
              bgColor: '#FFB319', // 金色背景
              padding: 8,
              display: 'BYCLICK',
              textAlign: 'center'
            },
            // 添加样式ID配置
            styleIds: {
              callout: 'universal-shop',
              marker: 'universal-shop',
              selected: 'universal-shop-selected',
              card: 'universal-shop'
            }
          },
          otherInfo: {
            // API路径和响应配置已移至云函数，此处不再需要
            // 补充信息通过单独的云函数action获取
          }
        },
        filterConfig: {
          defaultFilter: 'all',
          showFilterClosed: true
        },
        botId: '7484421285330927635', // 环球影城机器人ID
        botName: '环球影城助手',
        planBotId: '7507061223184908339', // 环球影城规划机器人ID，默认为空
        operatingHours: '09:00-21:00',
        // 欢迎消息
        welcomeMessage: '欢迎使用环球影城助手！',
        // 推荐查询列表
        recommendedQueries: [
          '环球影城的快通有几类',
          '女生适合玩什么项目',
          '110cm的小孩能玩哪些',
          '有什么好看的演出节目',
          '环球影城餐厅推荐',
          '拍照出片的地点在哪',
          '魔杖在哪里买'
        ],
        // 颜色主题
        theme: {
          primary: '#003087', // 环球蓝
          secondary: '#E21A22', // 环球红
          waitTimeColors: {
            low: '#52c41a', // 绿色 - 低等待时间
            medium: '#ffa940', // 橙色 - 中等待时间
            high: '#ff4d4f', // 红色 - 高等待时间
            closed: '#bfbfbf' // 灰色 - 关闭状态
          }
        }
      },
      '上海迪士尼乐园': {
        id: 'disney',
        latitude: 31.142747,
        longitude: 121.660517,
        // apiEndpoint 已移至云函数中管理，客户端不再需要此信息
        mapConfig: {
          defaultScale: 17,
          clusterThreshold: 18
        },
        apiConfig: {
          attraction: {
            path: '/attractions',
            responseMapping: {
              data: 'data' // 响应中数据的位置
            },
            dataType: 'attraction', // 对应数据类型
            displayName: '游乐项目', // 显示名称
            enabled: true // 开放此接口
          },
          performance: {
            path: '/performances',
            responseMapping: {
              data: 'data' // 响应中数据的位置
            },
            dataType: 'performance', // 对应数据类型
            displayName: '表演项目', // 显示名称
            enabled: true // 
          },
          restaurant: {
            path: '/restaurants',
            responseMapping: {
              data: 'data' // 响应中数据的位置
            },
            dataType: 'restaurant', // 对应数据类型
            displayName: '餐厅', // 显示名称
            enabled: true // 暂时关闭此接口
          },
          shop: {
            path: '/shops',
            responseMapping: {
              data: 'data' // 响应中数据的位置
            },
            dataType: 'shop', // 对应数据类型
            displayName: '商店', // 显示名称
            enabled: false // 暂时关闭此接口
          },
          restroom: {
            path: '/restrooms',
            responseMapping: {
              data: 'data' // 响应中数据的位置
            },
            dataType: 'restroom', // 对应数据类型
            displayName: '洗手间', // 显示名称
            enabled: true, // 开放此接口
            // 迪士尼特有配置
            markerConfig: {
              icon: '/images/marker_triangle_modern_default.svg',
              selectedIconPath: '/images/marker_triangle_modern_default.svg'
            },
            // 添加自定义气泡样式
            calloutConfig: {
              color: '#FFFFFF',
              fontSize: 12,
              borderRadius: 6,
              bgColor: '#4CAF50', // 绿色背景
              padding: 8,
              display: 'BYCLICK',
              textAlign: 'center'
            },
            // 添加样式ID配置
            styleIds: {
              callout: 'disney-restroom',
              marker: 'disney-restroom',
              selected: 'disney-restroom-selected',
              card: 'disney-restroom'
            }
          },
          charger: {
            path: '/power-banks',
            responseMapping: {
              data: 'data' // 响应中数据的位置
            },
            dataType: 'charger', // 对应数据类型
            displayName: '充电宝', // 显示名称
            enabled: true, // 开放此接口
            // 迪士尼特有配置
            markerConfig: {
              icon: '/images/marker_triangle_modern_default.svg',
              selectedIconPath: '/images/marker_triangle_modern_default.svg'
            },
            // 添加自定义气泡样式
            calloutConfig: {
              color: '#FFFFFF',
              fontSize: 12,
              borderRadius: 6,
              bgColor: '#FF9800', // 橙色背景
              padding: 8,
              display: 'BYCLICK',
              textAlign: 'center'
            },
            // 添加样式ID配置
            styleIds: {
              callout: 'disney-charger',
              marker: 'disney-charger',
              selected: 'disney-charger-selected',
              card: 'disney-charger'
            }
          },
          otherInfo: {
            path: '/item-other-info',
            responseMapping: {
              data: 'data' // 响应中数据的位置
            },
            enabled: true //
          }
        },
        filterConfig: {
          defaultFilter: 'all',
          showFilterClosed: true
        },
        botId: '7484421285330927636', // 迪士尼机器人ID
        botName: '迪士尼助手',
        planBotId: '', // 迪士尼规划机器人ID，默认为空
        operatingHours: '08:30-21:30',
        // 欢迎消息
        welcomeMessage: '欢迎使用上海迪士尼助手！',
        // 推荐查询列表
        recommendedQueries: [
          '迪士尼项目推荐',
          '今日排队时间最短项目',
          'FastPass怎么使用',
          '米奇幻想曲什么时候开始',
          '迪士尼餐厅推荐',
          '乐园天气预报'
        ]
      },
      '广州长隆欢乐世界': {
        id: 'chimelong',
        latitude: 23.001570,
        longitude: 113.323636,
        // apiEndpoint 已移至云函数中管理，客户端不再需要此信息
        mapConfig: {
          defaultScale: 17,
          clusterThreshold: 18
        },
        apiConfig: {
          attraction: {
            path: '/attractions',
            responseMapping: {
              data: 'data' // 响应中数据的位置
            },
            dataType: 'attraction', // 对应数据类型
            displayName: '游乐项目' // 显示名称
          },
          performance: {
            path: '/performances',
            responseMapping: {
              data: 'data' // 响应中数据的位置
            },
            dataType: 'performance', // 对应数据类型
            displayName: '表演项目' // 显示名称
          },
          restaurant: {
            path: '/restaurants',
            responseMapping: {
              data: 'data' // 响应中数据的位置
            },
            dataType: 'restaurant', // 对应数据类型
            displayName: '餐厅' // 显示名称
          },
          shops: {
            path: '/shops',
            responseMapping: {
              data: 'data' // 响应中数据的位置
            },
            dataType: 'shop', // 对应数据类型
            displayName: '商店' // 显示名称
          },
          otherInfo: {
            path: '/item-other-info',
            responseMapping: {
              data: 'data' // 响应中数据的位置
            }
          }
        },
        filterConfig: {
          defaultFilter: 'all',
          showFilterClosed: true
        },
        botId: '7484421285330927637', // 长隆机器人ID
        botName: '长隆助手',
        planBotId: '', // 长隆规划机器人ID，默认为空
        operatingHours: '09:30-18:00',
        // 欢迎消息
        welcomeMessage: '欢迎使用长隆欢乐世界助手！',
        // 推荐查询列表
        recommendedQueries: [
          '长隆欢乐世界必玩项目',
          '长隆哪些项目排队时间短',
          '快速通道怎么购买使用',
          '精彩表演时间表',
          '长隆餐饮点评',
          '长隆园区天气情况'
        ]
      }
    },
    queueTimeCache: {}, // 存储排队时间缓存
    performanceTimeCache: {}, // 存储演出时间缓存
    queueTimeTimer: null, // 存储定时器ID（用于排队时间和演出时间更新）
  },
  
  // 全局事件系统，用于页面间通信
  globalEvents: new EventEmitter(),

  // 通过ID获取游乐场名称
  getParkNameById(parkId) {
    for (const parkName in this.globalData.parks) {
      if (this.globalData.parks[parkName].id === parkId) {
        return parkName;
      }
    }
    return null;
  },

  // 获取可用的游乐场列表（过滤掉广州长隆）
  getAvailableParks() {
    const parks = Object.keys(this.globalData.parks)
      .filter(name => name !== '广州长隆欢乐世界') // 过滤掉广州长隆
      .map(name => ({
        id: this.globalData.parks[name].id,
        name: name,
        operatingHours: this.globalData.parks[name].operatingHours || ''
      }));
    
    return parks;
  },
  
  // 检查云函数健康状态
  checkCloudFunctionsHealth() {
    const cloudHelper = require('./utils/cloudHelper');
    
    // 定义需要检查的关键云函数
    const criticalFunctions = ['fetchServerData', 'login', 'checkLogin', 'updateUserInfo'];
    
    
    // 使用cloudHelper进行健康检查
    cloudHelper.checkCloudFunctionStatus(criticalFunctions)
      .then(results => {
        const available = results.filter(r => r.status === 'available');
        const unavailable = results.filter(r => r.status === 'unavailable');
        
        // 更新全局状态
        this.globalData.cloudFunctionsHealth = {
          healthy: unavailable.length === 0,
          available: available.map(r => r.name),
          unavailable: unavailable.map(r => r.name),
          lastCheck: new Date().toISOString()
        };
        
        
        // 如果有不可用的云函数，记录错误
        if (unavailable.length > 0) {
          console.error('警告: 部分云函数不可用:', unavailable.map(r => r.name).join(', '));
          
          // 只在开发环境显示提示
          if (this.globalData.isDev) {
            wx.showModal({
              title: '云函数状态警告',
              content: `部分云函数不可用: ${unavailable.map(r => r.name).join(', ')}`,
              showCancel: false
            });
          }
        }
      })
      .catch(error => {
        console.error('云函数健康检查失败:', error);
        
        this.globalData.cloudFunctionsHealth = {
          healthy: false,
          error: error.message,
          lastCheck: new Date().toISOString()
        };
      });
  },
  
  // 通过ID获取游乐场配置
  getParkConfigById(parkId) {
    
    if (!parkId) {
      console.error('getParkConfigById: 未提供游乐场ID');
      return null;
    }
    
    for (const parkName in this.globalData.parks) {
      if (this.globalData.parks[parkName].id === parkId) {
        const config = this.globalData.parks[parkName];
        
        // 检查关键配置是否存在
        if (!config.mapConfig) {
          console.warn(`游乐场 ${parkName} (${parkId}) 缺少mapConfig配置`);
        } else {
          // 确保mapConfig中的数值是数字类型
          if (config.mapConfig.clusterThreshold) {
            config.mapConfig.clusterThreshold = Number(config.mapConfig.clusterThreshold);
          }
          if (config.mapConfig.defaultScale) {
            config.mapConfig.defaultScale = Number(config.mapConfig.defaultScale);
          }
          
        }
        
        return config;
      }
    }
    
    console.error(`未找到ID为 ${parkId} 的游乐场配置`);
    return null;
  },

  // 切换游乐场的方法
  switchPark(parkId) {
    // 通过ID查找游乐场配置
    const parkConfig = this.getParkConfigById(parkId);
    
    if (!parkConfig) {
      console.error('无效的游乐场ID:', parkId);
      return false;
    }
    
    // 更新当前游乐场ID
    this.globalData.currentParkId = parkId;
    
    // 保存当前游乐场ID到本地存储，以便在下次启动时保持同样的游乐场
    try {
      wx.setStorageSync('currentParkId', parkId);
      console.log('当前游乐场ID已保存:', parkId);
    } catch (e) {
      console.error('保存当前游乐场ID失败:', e);
    }
    
    // 触发游乐场切换事件
    this.globalEvents.emit('parkChanged', {
      parkId,
      parkName: this.getParkNameById(parkId),
      park: parkConfig
    });
    
    return true;
  },

  onLaunch() {
    // 初始化云开发
    if (wx.cloud) {
      wx.cloud.init({
        // env 参数说明：
        //   env 参数决定接下来小程序发起的云开发调用（wx.cloud.xxx）会默认请求到哪个云环境的资源
        //   此处请填入环境 ID, 环境 ID 可打开云控制台查看
        //   如不填则使用默认环境（第一个创建的环境）
        env: 'cloud1-4gsb6v7y20433bc5', // 云开发环境ID
        traceUser: true,
      });
      console.log('云开发初始化成功，环境ID: cloud1-4gsb6v7y20433bc5');
      
      // 执行云函数健康检查
      //this.checkCloudFunctionsHealth();
    } else {
      console.error('当前微信版本不支持云开发');
    }
    
    // 启用全局日志控制
    logger.enableGlobalControl();
    
    console.log('App onLaunch - 全局日志控制已启用');
    
    // 初始化数据模块，包括各种配置值和缓存结构
    initParkData(this.globalData);
    
    // 初始化事件系统
    this.globalEvents = new EventEmitter();
    
    // 从服务端加载配置信息
    this.loadServerConfig();
    
    // 加载收藏数据
    this.loadUserData();
    
    // 加载AI助手配置
    this.loadAiAssistantConfig();
    
    // 获取系统信息做兼容性处理
    wx.getSystemInfo({
      success: (res) => {
        this.globalData.systemInfo = res;
        
        // 设置页面底部安全区域（适用于iPhone X 等机型）
        this.globalData.safeAreaBottom = res.screenHeight - res.safeArea.bottom;
        
        // 设置状态栏高度，用于自定义导航栏
        this.globalData.statusBarHeight = res.statusBarHeight;
        
        // 获取设备类型，特别处理平板设备
        const isIPad = res.model.indexOf('iPad') > -1 || (res.windowWidth / res.windowHeight < 0.77 && res.windowWidth > 750);
        
        this.globalData.isTablet = isIPad;
        
        // 如果是平板设备，可以调整某些UI元素的尺寸
        if (isIPad) {
          // 平板设备适配
          this.globalData.navBarHeight = 60; // 导航栏更高
        } else {
          // 手机设备
          this.globalData.navBarHeight = 46;
        }
        
        // 检查小程序运行版本
        if (res.platform === 'devtools') {
          console.log('当前在开发者工具中运行');
          this.globalData.isDev = true;
        } else {
          this.globalData.isDev = false;
        }
      }
    });
    
    // 添加加载Font Awesome逻辑，设置超时保护
    const loadFontAwesome = () => {
      // 在真机环境下加载，开发者工具中不需要特别处理
      if (!this.globalData.isDev) {
        // 尝试加载Font Awesome
        wx.loadFontFace({
          family: 'FontAwesome',
          source: 'url("https://doctorj.com.cn/static/fontawesome/fontawesome-webfont.ttf")',
          success: res => {
            console.log('加载Font Awesome成功', res);
            this.globalData.fontAwesomeLoaded = true;
          },
          fail: err => {
            console.error('加载Font Awesome失败', err);
            this.globalData.useFallbackIcons = true;
            // 通知页面使用备用图标
            this.globalEvents.emit('fontAwesomeFailed');
          },
          complete: () => {
            clearTimeout(fontAwesomeTimeout);
          }
        });
        
        // 设置超时保护，如果6秒内未加载成功，默认使用备用图标
        const fontAwesomeTimeout = setTimeout(() => {
          if (!this.globalData.fontAwesomeLoaded) {
            console.warn('加载Font Awesome超时，使用备用图标');
            this.globalData.useFallbackIcons = true;
            this.globalEvents.emit('fontAwesomeFailed');
          }
        }, 6000);
      } else {
        // 开发环境默认已加载
        this.globalData.fontAwesomeLoaded = true;
      }
    };
    
    // 延迟执行，避免影响应用启动速度
    //setTimeout(loadFontAwesome, 500);
    
    // 启动排队时间和演出时间定时更新
    this.startQueueTimeUpdate();
  },

  /**
   * 设置全局日志等级
   * @param {string} level - 日志等级: DEBUG, INFO, WARN, ERROR, NONE
   */
  setLogLevel(level) {
    logger.setLevel(level);
    // 同时更新全局配置
    this.globalData.logConfig.level = level;
    console.log(`日志等级已设置为: ${level}`);
  },

  /**
   * 获取当前日志等级
   */
  getLogLevel() {
    return logger.getCurrentLevel();
  },

  /**
   * 启用/禁用全局日志控制
   * @param {boolean} enabled - 是否启用
   */
  setGlobalLogControl(enabled) {
    if (enabled) {
      logger.enableGlobalControl();
      console.log('全局日志控制已启用');
    } else {
      logger.disableGlobalControl();
      console.log('全局日志控制已禁用');
    }
  },
  
  /**
   * 从服务端加载配置信息（异步版本，用于优化启动流程）
   */
  async loadServerConfigAsync() {
    console.log('开始从服务端加载配置信息...');
    
    try {
      // 使用云函数获取服务端配置
      const res = await wx.cloud.callFunction({
        name: 'fetchServerData',
        data: {
          action: 'getServerConfig'
        }
      });
      
      console.log('服务端配置加载成功:', res.result);
      
      if (res.result.success) {
        // 保存配置信息
        this.globalData.dynamicConfig = res.result.data;
        this.globalData.configLoaded = true;
        
        // 更新当前游乐场的配置
        this.updateParkConfig();
        
        // 缓存到本地存储
        wx.setStorageSync('serverConfig', res.result.data);
        wx.setStorageSync('configLoadTime', Date.now());
        
        console.log('配置信息已更新并缓存');
        return true;
      } else {
        console.warn('云函数返回配置信息错误:', res.result.error);
        this.loadLocalConfig();
        return false;
      }
    } catch (err) {
      console.error('云函数获取配置失败:', err);
      this.loadLocalConfig();
      throw err;
    }
  },

  /**
   * 从服务端加载配置信息（原版本，保持兼容性）
   */
  loadServerConfig() {
    console.log('开始从服务端加载配置信息...');
    
    // 使用云函数获取服务端配置
    wx.cloud.callFunction({
      name: 'fetchServerData',
      data: {
        action: 'getServerConfig'
      }
    }).then(res => {
      console.log('服务端配置加载成功:', res.result);
      
      if (res.result.success) {
        // 保存配置信息
        this.globalData.dynamicConfig = res.result.data;
        this.globalData.configLoaded = true;
        
        // 更新当前游乐场的配置
        this.updateParkConfig();
        
        // 缓存到本地存储
        wx.setStorageSync('serverConfig', res.result.data);
        wx.setStorageSync('configLoadTime', Date.now());
        
        console.log('配置信息已更新并缓存');
      } else {
        console.warn('云函数返回配置信息错误:', res.result.error);
        this.loadLocalConfig();
      }
    }).catch(err => {
      console.error('云函数获取配置失败:', err);
      this.loadLocalConfig();
    });
  },

  /**
   * 加载本地缓存的配置信息（fallback）
   */
  loadLocalConfig() {
    try {
      const cachedConfig = wx.getStorageSync('serverConfig');
      const loadTime = wx.getStorageSync('configLoadTime');
      
      // 检查缓存是否过期（24小时）
      const now = Date.now();
      const cacheExpiry = 24 * 60 * 60 * 1000; // 24小时
      
      if (cachedConfig && loadTime && (now - loadTime < cacheExpiry)) {
        console.log('使用本地缓存的配置信息');
        this.globalData.dynamicConfig = cachedConfig;
        this.globalData.configLoaded = true;
        this.updateParkConfig();
        
        // 从缓存中恢复 Coze API Key
        if (cachedConfig.coze_code) {
          this.globalData.cozeApiKey = cachedConfig.coze_code;
          console.log('从缓存恢复 Coze API Key:', cachedConfig.coze_code.substring(0, 10) + '...');
        }
      } else {
        console.log('本地缓存过期或不存在，使用默认配置');
        this.globalData.configLoaded = true; // 标记为已加载，使用默认配置
      }
    } catch (err) {
      console.error('加载本地配置失败:', err);
      this.globalData.configLoaded = true; // 标记为已加载，使用默认配置
    }
  },

  /**
   * 更新游乐场配置信息
   */
  updateParkConfig() {
    if (!this.globalData.dynamicConfig) return;
    
    const config = this.globalData.dynamicConfig;
    console.log('开始更新游乐场配置，当前配置数据:', config);
    
    // 更新环球影城配置 - 修复数据结构匹配问题
    if (config.universal && this.globalData.parks['北京环球影城度假区']) {
      const universalConfig = config.universal;
      const parkConfig = this.globalData.parks['北京环球影城度假区'];
      
      console.log('更新前的环球影城配置:', parkConfig.operatingHours);
      
      // 更新配置信息
      parkConfig.botId = universalConfig.botId || parkConfig.botId;
      parkConfig.botName = universalConfig.botName || parkConfig.botName;
      parkConfig.planBotId = universalConfig.planBotId || parkConfig.planBotId;
      parkConfig.operatingHours = universalConfig.operatingHours || parkConfig.operatingHours;
      parkConfig.welcomeMessage = universalConfig.welcomeMessage || parkConfig.welcomeMessage;
      parkConfig.recommendedQueries = universalConfig.recommendedQueries || parkConfig.recommendedQueries;
      
      console.log('环球影城配置已更新:', {
        botId: parkConfig.botId,
        botName: parkConfig.botName,
        operatingHours: parkConfig.operatingHours
      });
    } else {
      console.log('环球影城配置更新失败 - 检查条件:', {
        hasUniversalConfig: !!config.universal,
        hasParkConfig: !!this.globalData.parks['北京环球影城度假区']
      });
    }
    
    // 更新迪士尼配置 - 修复数据结构匹配问题
    if (config.disney && this.globalData.parks['上海迪士尼乐园']) {
      const disneyConfig = config.disney;
      const parkConfig = this.globalData.parks['上海迪士尼乐园'];
      
      console.log('更新前的迪士尼配置:', parkConfig.operatingHours);
      
      // 更新配置信息
      parkConfig.botId = disneyConfig.botId || parkConfig.botId;
      parkConfig.botName = disneyConfig.botName || parkConfig.botName;
      parkConfig.planBotId = disneyConfig.planBotId || parkConfig.planBotId;
      parkConfig.operatingHours = disneyConfig.operatingHours || parkConfig.operatingHours;
      parkConfig.welcomeMessage = disneyConfig.welcomeMessage || parkConfig.welcomeMessage;
      parkConfig.recommendedQueries = disneyConfig.recommendedQueries || parkConfig.recommendedQueries;
      
      console.log('迪士尼配置已更新:', {
        botId: parkConfig.botId,
        botName: parkConfig.botName,
        operatingHours: parkConfig.operatingHours
      });
    } else {
      console.log('迪士尼配置更新失败 - 检查条件:', {
        hasDisneyConfig: !!config.disney,
        hasParkConfig: !!this.globalData.parks['上海迪士尼乐园']
      });
    }
    
    // 更新全局配置
    if (config.config) {
      // 这里可以更新其他全局配置，如API密钥等
      console.log('全局配置已更新');
    }
    
    // 更新 Coze API Key
    if (config.coze_code) {
      const oldKey = this.globalData.cozeApiKey;
      this.globalData.cozeApiKey = config.coze_code;
      console.log('Coze API Key已更新:', {
        旧密钥: oldKey ? oldKey.substring(0, 10) + '...' : '无',
        新密钥: config.coze_code ? config.coze_code.substring(0, 10) + '...' : '无'
      });
    }
  },

  /**
   * 获取当前游乐场的动态配置
   */
  getCurrentParkConfig() {
    const currentPark = this.globalData.parks[this.globalData.currentParkId];
    if (!currentPark) return null;
    
    return {
      botId: currentPark.botId,
      botName: currentPark.botName,
      planBotId: currentPark.planBotId,
      operatingHours: currentPark.operatingHours,
      welcomeMessage: currentPark.welcomeMessage,
      recommendedQueries: currentPark.recommendedQueries
    };
  },

  /**
   * 等待配置加载完成
   */
  waitForConfig() {
    return new Promise((resolve) => {
      if (this.globalData.configLoaded) {
        resolve();
        return;
      }
      
      // 轮询检查配置是否加载完成
      const checkConfig = () => {
        if (this.globalData.configLoaded) {
          resolve();
        } else {
          setTimeout(checkConfig, 100);
        }
      };
      checkConfig();
    });
  },

  /**
   * 强制刷新服务端配置
   */
  refreshServerConfig() {
    console.log('强制刷新服务端配置...');
    this.globalData.configLoaded = false;
    this.loadServerConfig();
  },

  /**
   * 获取当前的Coze API Key
   */
  getCozeApiKey() {
    return this.globalData.cozeApiKey;
  },

  /**
   * 检查配置是否已从服务端更新
   */
  isConfigFromServer() {
    return this.globalData.dynamicConfig && this.globalData.dynamicConfig.coze_code;
  },

  /**
   * 加载用户数据（收藏、设置等）
   */
  loadUserData() {
    // 加载用户配置
    const userService = require('./utils/userService');
    const favoritesService = require('./utils/favoritesService');
    
    try {
      // 首先尝试从本地存储恢复登录状态
      const userInfo = wx.getStorageSync('userInfo');
      const token = wx.getStorageSync('token');
      const openid = wx.getStorageSync('openid');
      
      if (userInfo && token && userInfo.openid && !userInfo.isDefaultUser) {
        console.log('从本地存储恢复用户登录状态:', userInfo.nickName);
        this.globalData.userInfo = userInfo;
        this.globalData.hasUserInfo = true;
        this.globalData.token = token;
        this.globalData.openid = userInfo.openid;
        
        // 通知用户信息更新
        if (typeof this.userInfoUpdateCallback === 'function') {
          this.userInfoUpdateCallback(userInfo);
        }
      } else {
        console.log('本地存储无有效登录信息，使用默认用户');
        this.globalData.userInfo = this.globalData.defaultUserInfo;
        this.globalData.hasUserInfo = false;
        this.globalData.token = null;
        this.globalData.openid = null;
      }
      
      // 加载用户配置
      const userConfig = userService.getUserConfig();
      if (userConfig) {
        // 如果有保存的当前游乐园，恢复它
        if (userConfig.currentParkId) {
          this.globalData.currentParkId = userConfig.currentParkId;
          console.log('已恢复用户上次选择的游乐园:', userConfig.currentParkId);
        }
        
        // 恢复其他用户配置
        if (userConfig.screenStyle) {
          this.globalData.screenStyle = userConfig.screenStyle;
        }
      }
      
      // 加载收藏数据
      favoritesService.loadFromStorage(this);
      
      // 加载提醒数据
      const reminders = wx.getStorageSync('reminders');
      if (reminders && Array.isArray(reminders)) {
        this.globalData.reminders = reminders;
        console.log('已加载提醒数据:', reminders.length, '条');
      } else {
        this.globalData.reminders = [];
      }
      
      console.log('用户数据加载完成');
    } catch (error) {
      console.error('加载用户数据失败:', error);
      // 出错时使用默认用户信息
      this.globalData.userInfo = this.globalData.defaultUserInfo;
      this.globalData.hasUserInfo = false;
      this.globalData.token = null;
      this.globalData.openid = null;
    }
  },
  
  /**
   * 保存用户数据
   */
  saveUserData() {
    const userService = require('./utils/userService');
    const favoritesService = require('./utils/favoritesService');
    
    try {
      // 保存当前配置
      userService.updateUserConfig({
        currentParkId: this.globalData.currentParkId,
        screenStyle: this.globalData.screenStyle
      });
      
      // 保存收藏数据
      favoritesService.saveAllFavoritesToStorage(this);
      
      console.log('用户数据保存完成');
    } catch (error) {
      console.error('保存用户数据失败:', error);
    }
  },
  
  // 验证登录状态方法（全局可用）
  async checkLoginStatus() {
    try {
      // 首先检查本地存储是否有用户信息
      const localUserInfo = wx.getStorageSync('userInfo');
      const localToken = wx.getStorageSync('token');
      
      if (!localUserInfo || !localToken || !localUserInfo.openid || localUserInfo.isDefaultUser) {
        console.log('本地无有效登录信息');
        this.clearLoginInfo();
        return false;
      }
      
      console.log('本地存储有用户信息，恢复登录状态:', localUserInfo.nickName);
      this.globalData.userInfo = localUserInfo;
      this.globalData.hasUserInfo = true;
      this.globalData.openid = localUserInfo.openid;
      this.globalData.token = localToken;
      
      // 通知用户信息更新
      if (typeof this.userInfoUpdateCallback === 'function') {
        this.userInfoUpdateCallback(localUserInfo);
      }
      
      // 后台验证登录状态（不阻塞用户体验）
      this.verifyLoginInBackground();
      
      return true;
    } catch (error) {
      console.error('检查登录状态失败:', error);
      // 出错时，如果本地有数据就继续使用本地数据，否则清除登录信息
      const localUserInfo = wx.getStorageSync('userInfo');
      if (!localUserInfo) {
        this.clearLoginInfo();
      }
      return false;
    }
  },
  
  // 后台验证登录状态（不影响用户体验）
  async verifyLoginInBackground() {
    try {
      console.log('后台验证登录状态...');
      const { result } = await wx.cloud.callFunction({
        name: 'checkLogin'
      });
      
      if (result && result.success && result.isLogin && result.user) {
        console.log('后台验证成功，更新用户信息');
        // 静默更新用户信息
        this.globalData.userInfo = {
          ...this.globalData.userInfo,
          ...result.user
        };
        
        // 更新本地存储
        try {
          wx.setStorageSync('userInfo', this.globalData.userInfo);
          wx.setStorageSync('token', result.user.openid);
          console.log('用户信息已静默更新');
        } catch (storageError) {
          console.error('更新本地存储失败:', storageError);
        }
      } else {
        console.warn('后台验证失败，但保持当前登录状态');
      }
    } catch (error) {
      console.error('后台验证登录状态失败:', error);
      // 后台验证失败不影响用户使用
    }
  },
  
  // 清除登录信息方法（全局可用）
  clearLoginInfo() {
    // 清除全局数据，但使用默认用户信息替代 null
    this.globalData.userInfo = this.globalData.defaultUserInfo;
    this.globalData.hasUserInfo = false;
    this.globalData.openid = null;
    this.globalData.token = null;
    
    // 清除本地存储
    wx.removeStorageSync('userInfo');
    wx.removeStorageSync('openid');
    wx.removeStorageSync('token');
    
    // 通知用户信息更新（使用默认用户）
    if (typeof this.userInfoUpdateCallback === 'function') {
      this.userInfoUpdateCallback(this.globalData.defaultUserInfo);
    }
    
    console.log('登录信息已清除，已切换至默认用户');
  },

  userInfoUpdateCallback: null,

  registerUserInfoUpdateListener: function(callback) {
    this.userInfoUpdateCallback = callback;
  },

  onHide() {
    console.log('App onHide');
    // 清除定时器
    if (this.globalData.queueTimeTimer) {
      clearInterval(this.globalData.queueTimeTimer);
      this.globalData.queueTimeTimer = null;
    }
  },

  onShow() {
    console.log('App onShow');
    // 如果定时器不存在，重新启动
    if (!this.globalData.queueTimeTimer) {
      this.startQueueTimeUpdate();
    }
  },

  // 启动排队时间和演出时间定时更新
  startQueueTimeUpdate() {
    console.log('Starting queue time and performance time update');
    console.log('【调试】启动定时更新时的全局数据状态:', {
      currentParkId: this.globalData.currentParkId,
      token: this.globalData.token ? '已设置' : '未设置',
      existingTimer: !!this.globalData.queueTimeTimer
    });
    
    // 清除可能存在的旧定时器
    if (this.globalData.queueTimeTimer) {
      console.log('清除旧的定时器');
      clearInterval(this.globalData.queueTimeTimer);
    }
    
    // 立即执行一次完整数据更新（初始化）
    console.log('立即执行一次完整数据更新');
    this.updateFullParkData();
    
    // 设置定时器，每分钟更新一次（只更新排队时间，节省流量和性能）
    console.log('设置定时器，每60秒更新一次（仅排队时间）');
    this.globalData.queueTimeTimer = setInterval(() => {
      console.log('定时器触发，开始更新排队时间（优化版）');
      this.updateQueueTimes();
    }, 60000);
    
    console.log('定时更新启动完成，定时器ID:', this.globalData.queueTimeTimer);
  },

  // 更新排队时间数据 - 只更新排队时间和演出时间表，不获取全量数据
  updateQueueTimes() {
    console.log('Updating queue times and performance schedules only (optimized)');
    console.log('【调试】全局数据状态:', {
      currentParkId: this.globalData.currentParkId,
      queueTimeCacheKeys: Object.keys(this.globalData.queueTimeCache || {}),
      performanceTimeCacheKeys: Object.keys(this.globalData.performanceTimeCache || {})
    });
    
    const currentParkId = this.globalData.currentParkId;
    
    if (!currentParkId) {
      console.error('无法更新排队时间：未选择当前公园');
      return;
    }
    
    console.log(`只更新 ${currentParkId} 的排队时间和演出时间表数据`);
    
    const parkConfig = this.getParkConfigById(currentParkId);
    if (!parkConfig) {
      console.error(`无法获取${currentParkId}的配置`);
      return;
    }

    // 同时获取排队时间和演出时间表数据
    const waitTimesPromise = wx.cloud.callFunction({
      name: 'fetchServerData',
      data: {
        action: 'getAttractionWaitTimes',
        parkId: currentParkId
      }
    });

    const schedulesPromise = wx.cloud.callFunction({
      name: 'fetchServerData',
      data: {
        action: 'getPerformanceSchedules',
        parkId: currentParkId
      }
    });

    // 等待两个请求都完成
    Promise.all([waitTimesPromise, schedulesPromise]).then(([waitTimesRes, schedulesRes]) => {
      let hasUpdates = false;

      // 处理排队时间数据
      if (waitTimesRes.result.success) {
        const waitTimesData = waitTimesRes.result.data || [];
        console.log(`获取 ${currentParkId} 排队时间数据成功，数量:`, waitTimesData.length);
        
        // 更新现有缓存中的排队时间
        this.updateQueueTimesInCache(currentParkId, waitTimesData);
        hasUpdates = true;
      } else {
        console.error('获取排队时间数据失败:', waitTimesRes.result.error);
      }

      // 处理演出时间表数据
      if (schedulesRes.result.success) {
        const schedulesData = schedulesRes.result.data || [];
        console.log(`获取 ${currentParkId} 演出时间表数据成功，数量:`, schedulesData.length);
        
        // 更新现有缓存中的演出时间表
        this.updatePerformanceSchedulesInCache(currentParkId, schedulesData);
        hasUpdates = true;
      } else {
        console.error('获取演出时间表数据失败:', schedulesRes.result.error);
      }

      // 如果有任何更新，触发事件
      if (hasUpdates) {
        this.globalEvents.emit('queueTimeUpdated');
        this.globalEvents.emit('performanceTimeUpdated');
        
        if (typeof this.onQueueTimeUpdated === 'function') {
          this.onQueueTimeUpdated();
        }
        if (typeof this.onPerformanceTimeUpdated === 'function') {
          this.onPerformanceTimeUpdated();
        }
      }
    }).catch(error => {
      console.error(`优化更新失败 for ${currentParkId}:`, error);
    });
  },

  // 更新缓存中的排队时间
  updateQueueTimesInCache(parkId, waitTimesData) {
    if (!this.globalData.queueTimeCache[parkId]) {
      console.warn(`${parkId} 的缓存不存在，跳过排队时间更新`);
      return;
    }

    // 创建排队时间数据的映射
    const waitTimesMap = {};
    waitTimesData.forEach(item => {
      if (item.项目名称) {
        waitTimesMap[item.项目名称] = {
          排队时间: item.排队时间,
          是否关闭: item.是否关闭
        };
      }
    });

    console.log('排队时间映射表:', Object.keys(waitTimesMap));

    // 更新缓存中的排队时间
    let updatedCount = 0;
    const cache = this.globalData.queueTimeCache[parkId];
    
    Object.keys(cache).forEach(attractionId => {
      const cachedAttraction = cache[attractionId];
      const attractionName = cachedAttraction.name;
      
      if (attractionName && waitTimesMap[attractionName]) {
        const waitInfo = waitTimesMap[attractionName];
        
        if (waitInfo.排队时间 !== undefined) {
          if (waitInfo.排队时间 === -1 || waitInfo.是否关闭) {
            cachedAttraction.queueTime = 0;
            cachedAttraction.waitTime = '关闭';
            cachedAttraction.status = 'closed';
          } else {
            cachedAttraction.queueTime = waitInfo.排队时间;
            cachedAttraction.waitTime = waitInfo.排队时间;
            cachedAttraction.status = 'open';
          }
          cachedAttraction.updateTime = new Date().getTime();
          updatedCount++;
          console.log(`更新缓存中 ${attractionName} 排队时间: ${cachedAttraction.waitTime}`);
        }
      }
    });

    console.log(`成功更新了 ${updatedCount} 个景点的排队时间缓存`);
  },

  // 更新缓存中的演出时间表
  updatePerformanceSchedulesInCache(parkId, schedulesData) {
    if (!this.globalData.performanceTimeCache[parkId]) {
      console.warn(`${parkId} 的演出缓存不存在，跳过演出时间表更新`);
      return;
    }

    // 创建演出时间表数据的映射
    const schedulesMap = {};
    schedulesData.forEach(item => {
      if (item.演出名称) {
        schedulesMap[item.演出名称] = {
          是否关闭: item.是否关闭,
          演出场次: item.演出场次 || [],
          演出时长: item.演出时长
        };
      }
    });

    console.log('演出时间表映射表:', Object.keys(schedulesMap));

    // 更新缓存中的演出时间表
    let updatedCount = 0;
    const cache = this.globalData.performanceTimeCache[parkId];
    
    Object.keys(cache).forEach(performanceId => {
      const cachedPerformance = cache[performanceId];
      const performanceName = cachedPerformance.name;
      
      if (performanceName && schedulesMap[performanceName]) {
        const scheduleInfo = schedulesMap[performanceName];
        
        console.log(`【调试】更新演出 ${performanceName}:`, {
          是否关闭: scheduleInfo.是否关闭,
          演出场次数量: scheduleInfo.演出场次?.length || 0,
          演出场次样本: scheduleInfo.演出场次?.slice(0, 2)
        });
        
        // 更新演出状态和场次
        if (scheduleInfo.是否关闭) {
          cachedPerformance.status = '已关闭';
          cachedPerformance.timeToNext = '关闭';
          cachedPerformance.nextShow = null;
          cachedPerformance.nextShowTime = null;
          cachedPerformance.showTimes = [];
        } else {
          cachedPerformance.status = '开放中';
          cachedPerformance.showTimes = scheduleInfo.演出场次 || [];
          
          // 计算下一场演出时间
          const now = new Date();
          const currentTime = now.getHours() * 60 + now.getMinutes(); // 当前时间（分钟）
          
          console.log(`【调试】${performanceName} 当前时间: ${now.getHours()}:${now.getMinutes()} (${currentTime}分钟)`);
          console.log(`【调试】${performanceName} 场次数据:`, cachedPerformance.showTimes);
          
          let nextShow = null;
          let nextShowTime = null;
          
          for (const show of cachedPerformance.showTimes) {
            console.log(`【调试】${performanceName} 检查场次:`, show);
            if (show.时间 && show.状态 === 'normal') {
              const [hours, minutes] = show.时间.split(':').map(Number);
              const showTime = hours * 60 + minutes;
              
              console.log(`【调试】${performanceName} 场次 ${show.时间}: ${showTime}分钟, 当前: ${currentTime}分钟, 未来: ${showTime > currentTime}`);
              
              if (showTime > currentTime) {
                nextShow = show.时间;
                nextShowTime = show.时间;
                const minutesToNext = showTime - currentTime;
                cachedPerformance.timeToNext = minutesToNext;
                console.log(`【调试】${performanceName} 找到下一场: ${nextShow}, 等待: ${minutesToNext}分钟`);
                break;
              }
            }
          }
          
          if (!nextShow) {
            // 今天没有更多场次
            cachedPerformance.timeToNext = '今日已结束';
            cachedPerformance.nextShow = null;
            cachedPerformance.nextShowTime = null;
            console.log(`【调试】${performanceName} 今日已结束`);
          } else {
            cachedPerformance.nextShow = nextShow;
            cachedPerformance.nextShowTime = nextShowTime;
            console.log(`【调试】${performanceName} 最终结果: 下一场 ${nextShow}, 等待 ${cachedPerformance.timeToNext}分钟`);
          }
        }
        
        cachedPerformance.updateTime = new Date().getTime();
        updatedCount++;
        console.log(`更新缓存中 ${performanceName} 演出时间表: 下一场 ${cachedPerformance.nextShow || '无'}`);
      }
    });

    console.log(`成功更新了 ${updatedCount} 个演出的时间表缓存`);
  },

  // 完整数据更新 - 获取全量数据（用于初始化和手动刷新）
  updateFullParkData() {
    console.log('Updating full park data (including queue times)');
    console.log('【调试】全局数据状态:', {
      currentParkId: this.globalData.currentParkId,
      token: this.globalData.token ? '已设置' : '未设置',
      queueTimeCacheKeys: Object.keys(this.globalData.queueTimeCache || {}),
      performanceTimeCacheKeys: Object.keys(this.globalData.performanceTimeCache || {})
    });
    
    const { createParkAdapter } = require('./utils/dataAdapter');
    // 只获取当前选中的park
    const currentParkId = this.globalData.currentParkId;
    
    if (!currentParkId) {
      console.error('无法更新数据：未选择当前公园');
      console.error('【调试】全局数据中的currentParkId为:', this.globalData.currentParkId);
      return;
    }
    
    console.log(`获取 ${currentParkId} 的完整数据`);
    
    const parkConfig = this.getParkConfigById(currentParkId);
    if (!parkConfig) {
      console.error(`无法获取${currentParkId}的配置`);
      return;
    }

    console.log(`使用云函数获取 ${currentParkId} 的完整数据`);
    
    // 同时获取基础数据、排队时间数据和演出时间表数据
    const basicDataPromise = wx.cloud.callFunction({
      name: 'fetchServerData',
      data: {
        action: 'getParkData',
        parkId: currentParkId,
        token: this.globalData.token
      }
    });
    
    const waitTimesPromise = wx.cloud.callFunction({
      name: 'fetchServerData',
      data: {
        action: 'getAttractionWaitTimes',
        parkId: currentParkId
      }
    });

    const schedulesPromise = wx.cloud.callFunction({
      name: 'fetchServerData',
      data: {
        action: 'getPerformanceSchedules',
        parkId: currentParkId
      }
    });
    
    // 等待三个请求都完成
    Promise.all([basicDataPromise, waitTimesPromise, schedulesPromise]).then(([basicRes, waitTimesRes, schedulesRes]) => {
      let apiData = {};
      let waitTimesData = [];
      
      // 处理基础数据
      if (basicRes.result.success) {
        apiData = basicRes.result.data;
        console.log(`云函数获取 ${currentParkId} 基础数据成功:`, {
          '数据结构': Object.keys(apiData || {}),
          'attraction(单数)': apiData.attraction?.length || 0,
          'attractions(复数)': apiData.attractions?.length || 0,
          'performance(单数)': apiData.performance?.length || 0,
          'performances(复数)': apiData.performances?.length || 0,
          '完整数据': apiData
        });
      } else {
        console.error('获取基础数据失败:', basicRes.result.error);
      }
      
      // 处理排队时间数据
      if (waitTimesRes.result.success) {
        waitTimesData = waitTimesRes.result.data || [];
        console.log(`云函数获取 ${currentParkId} 排队时间数据成功，数量:`, waitTimesData.length);
        console.log('排队时间数据样本:', waitTimesData.slice(0, 2));
      } else {
        console.warn('获取排队时间数据失败:', waitTimesRes.result.error);
      }

      // 处理演出时间表数据
      let schedulesData = [];
      if (schedulesRes.result.success) {
        schedulesData = schedulesRes.result.data || [];
        console.log(`🎭 [首次加载] 云函数获取 ${currentParkId} 演出时间表数据成功，数量:`, schedulesData.length);
        console.log('🎭 [首次加载] 演出时间表数据样本:', schedulesData.slice(0, 2));
        
        // 检查"未来水世界"的数据
        const futureWorldData = schedulesData.find(item => item.演出名称 && item.演出名称.includes('未来水世界'));
        if (futureWorldData) {
          console.log('🎭 [首次加载] 未来水世界时间表数据:', futureWorldData);
        }
      } else {
        console.warn('🎭 [首次加载] 获取演出时间表数据失败:', schedulesRes.result.error);
      }
      
      // 如果有排队时间数据，将其合并到基础数据中
      if (waitTimesData.length > 0 && apiData.attraction) {
        console.log('开始合并排队时间数据到基础数据中');
        
        // 创建排队时间数据的映射，用项目名称作为key
        const waitTimesMap = {};
        waitTimesData.forEach(item => {
          if (item.项目名称) {
            waitTimesMap[item.项目名称] = {
              排队时间: item.排队时间,
              是否关闭: item.是否关闭
            };
          }
        });
        
        console.log('排队时间映射表:', Object.keys(waitTimesMap));
        
        // 更新基础数据中的排队时间信息
        let updatedCount = 0;
        apiData.attraction.forEach(attraction => {
          if (attraction.name && waitTimesMap[attraction.name]) {
            const waitInfo = waitTimesMap[attraction.name];
            
            // 更新排队时间
            if (waitInfo.排队时间 !== undefined) {
              if (waitInfo.排队时间 === -1 || waitInfo.是否关闭) {
                attraction.queueTime = 0;
                attraction.waitTime = '关闭';
                attraction.status = 'closed';
              } else {
                attraction.queueTime = waitInfo.排队时间;
                attraction.waitTime = waitInfo.排队时间;
                attraction.status = 'open';
              }
              updatedCount++;
              console.log(`更新 ${attraction.name} 排队时间: ${attraction.waitTime}`);
            }
          }
        });
        
        console.log(`成功更新了 ${updatedCount} 个景点的排队时间`);
      }

      // 如果有演出时间表数据，将其合并到基础数据中
      if (schedulesData.length > 0 && apiData.performance) {
        console.log('🎭 [首次加载] 开始合并演出时间表数据到基础数据中');
        console.log('🎭 [首次加载] 演出时间表数据:', schedulesData.length, '条');
        console.log('🎭 [首次加载] 基础演出数据:', apiData.performance.length, '条');
        
        // 创建演出时间表数据的映射，用演出名称作为key
        const schedulesMap = {};
        schedulesData.forEach(item => {
          if (item.演出名称) {
            schedulesMap[item.演出名称] = {
              是否关闭: item.是否关闭,
              演出场次: item.演出场次 || [],
              演出时长: item.演出时长
            };
          }
        });
        
        console.log('演出时间表映射表:', Object.keys(schedulesMap));
        
        // 获取数据适配器来正确处理演出场次数据
        const { createParkAdapter } = require('./utils/dataAdapter');
        const adapter = createParkAdapter(currentParkId);
        
        // 更新基础数据中的演出时间表信息
        let updatedPerformanceCount = 0;
        console.log('【演出数据合并】开始合并演出时间表数据');
        console.log('【演出数据合并】基础演出数据数量:', apiData.performance.length);
        console.log('【演出数据合并】时间表数据数量:', Object.keys(schedulesMap).length);
        
        apiData.performance.forEach((performance, index) => {
          const performanceName = performance['演出名称'] || performance.name;
          console.log(`【演出数据合并】处理演出${index + 1}: ${performanceName}`);
          console.log(`【演出数据合并】${performanceName} 在时间表中存在:`, !!schedulesMap[performanceName]);
          
          if (performanceName && schedulesMap[performanceName]) {
            const scheduleInfo = schedulesMap[performanceName];
            console.log(`【演出数据合并】${performanceName} 时间表信息:`, {
              是否关闭: scheduleInfo.是否关闭,
              场次数量: scheduleInfo.演出场次?.length || 0,
              场次样本: scheduleInfo.演出场次?.slice(0, 2)
            });
            
            // 更新演出状态和场次
            if (scheduleInfo.是否关闭) {
              performance.status = '已关闭';
              performance.showTimes = [];
              console.log(`【演出数据合并】${performanceName} 设置为已关闭`);
            } else {
              performance.status = '开放中';
              
              // 使用数据适配器的showTimesMapper来正确处理演出场次数据，确保"是否已满"字段被正确映射为isFull
              const showTimesMapper = adapter.getDefaultShowTimesMapper();
              performance.showTimes = showTimesMapper(scheduleInfo.演出场次) || [];
              
              console.log(`【演出数据合并】${performanceName} 场次数据处理:`, {
                原始场次数: scheduleInfo.演出场次?.length || 0,
                处理后场次数: performance.showTimes.length,
                样本数据: performance.showTimes.slice(0, 2)
              });
            }
            
            updatedPerformanceCount++;
            console.log(`【演出数据合并】更新 ${performanceName} 演出时间表: ${performance.showTimes.length} 场次`);
          } else {
            console.log(`【演出数据合并】${performanceName} 在时间表中未找到对应数据，保持原始状态`);
            console.log(`【演出数据合并】${performanceName} 原始场次数据:`, {
              showTimes: performance.showTimes,
              演出场次: performance['演出场次'],
              开放时间: performance['开放时间'],
              关闭时间: performance['关闭时间']
            });
          }
        });
        
        console.log(`成功更新了 ${updatedPerformanceCount} 个演出的时间表`);
      }
      
      // 继续原有的处理逻辑 - 只有在基础数据获取成功时才处理
      if (basicRes.result.success) {
        // 转换为原来的格式以兼容现有代码
        console.log('【定时更新】云函数返回的原始数据键:', Object.keys(apiData));
        console.log('【定时更新】attraction数据:', apiData.attraction?.length || 0);
        console.log('【定时更新】performance数据:', apiData.performance?.length || 0);
        
        const results = [
          { type: 'attraction', data: apiData.attraction || [] }, // 修正：使用attraction而不是attractions
          { type: 'performance', data: apiData.performance || [] } // 修正：使用performance而不是performances
        ];
        
        try {
          // 使用dataAdapter处理API数据
          const adapter = createParkAdapter(currentParkId);
          const processedApiData = {};
        
          // 整理API数据
          results.forEach(result => {
            processedApiData[result.type] = result.data;
          });
        
          console.log(`Processing data for ${currentParkId}:`, {
            attractions: processedApiData.attraction?.length || 0,
            performances: processedApiData.performance?.length || 0
          });
          
          // 通过adapter处理数据
          console.log('【定时更新】开始处理attraction数据，原始数量:', processedApiData.attraction?.length || 0);
          const processedAttractions = adapter.processApiData({ attraction: processedApiData.attraction || [] });
          console.log('【定时更新】处理后的attraction数量:', processedAttractions.length);
          
          console.log('【定时更新】开始处理performance数据，原始数量:', processedApiData.performance?.length || 0);
          const processedPerformances = adapter.processApiData({ performance: processedApiData.performance || [] });
          console.log('【定时更新】处理后的performance数量:', processedPerformances.length);
        
        // 更新attractions缓存
        if (!this.globalData.queueTimeCache[currentParkId]) {
          this.globalData.queueTimeCache[currentParkId] = {};
        }
        
        let attractionValidCount = 0;
        let attractionSkippedCount = 0;
        
        processedAttractions.forEach((attraction, index) => {
          if (attraction && attraction.id && attraction.name) {
            // 特殊处理：当游乐项目关闭时，不显示时间单位
            let waitUnit = attraction.waitUnit;
            if (attraction.waitTime === '关闭' || attraction.waitTime === '已关闭') {
              waitUnit = '状态';
            } else if (!waitUnit && typeof attraction.waitTime === 'number') {
              waitUnit = '分钟';
            }

            this.globalData.queueTimeCache[currentParkId][attraction.id] = {
              queueTime: attraction.queueTime || 0,
              status: attraction.status || 'unknown',
              waitTime: attraction.waitTime || 0,
              waitUnit: waitUnit || 'minutes',
              colorTheme: attraction.colorTheme || 'default',
              updateTime: new Date().getTime(),
              name: attraction.name
            };
            attractionValidCount++;
          } else {
            console.warn(`Skipping processed attraction ${index + 1}:`, attraction);
            attractionSkippedCount++;
          }
        });
        
        // 更新performances缓存
        if (!this.globalData.performanceTimeCache[currentParkId]) {
          this.globalData.performanceTimeCache[currentParkId] = {};
        }
        
        let performanceValidCount = 0;
        let performanceSkippedCount = 0;
        
        processedPerformances.forEach((performance, index) => {
          if (performance && performance.id && performance.name) {
            // 特殊处理：当演出已结束、已满、无场次或数据错误时，不显示时间单位
            let timeUnit = performance.waitUnit;
            if (performance.waitTime === '已结束' || performance.waitTime === '已满' || 
                performance.waitTime === '无场次' || performance.waitTime === '数据错误' ||
                performance.waitTime === '常驻' || performance.waitTime === '关闭') {
              timeUnit = '';
            } else if (!timeUnit && typeof performance.waitTime === 'number') {
              timeUnit = '分钟';
            }

            this.globalData.performanceTimeCache[currentParkId][performance.id] = {
              nextShow: performance.nextShow || null,
              nextShowTime: performance.nextShowTime || null,
              showTimes: performance.showTimes || [],
              status: performance.status || 'unknown',
              timeToNext: performance.waitTime || null,
              timeUnit: timeUnit || '',
              colorTheme: performance.colorTheme || 'default',
              updateTime: new Date().getTime(),
              name: performance.name
            };
            performanceValidCount++;
          } else {
            console.warn(`Skipping processed performance ${index + 1}:`, performance);
            performanceSkippedCount++;
          }
        });
        
        console.log(`Updated cache for ${currentParkId}:`, {
          attractions: `${attractionValidCount} valid, ${attractionSkippedCount} skipped`,
          performances: `${performanceValidCount} valid, ${performanceSkippedCount} skipped`
        });
        
        // 触发全局事件
        this.globalEvents.emit('queueTimeUpdated');
        this.globalEvents.emit('performanceTimeUpdated');
        
        // 调用回调函数
        if (typeof this.onQueueTimeUpdated === 'function') {
          this.onQueueTimeUpdated();
        }
        if (typeof this.onPerformanceTimeUpdated === 'function') {
          this.onPerformanceTimeUpdated();
        }
      } catch (adapterError) {
        console.error(`DataAdapter processing failed for ${currentParkId}:`, adapterError);
        // 如果adapter处理失败，回退到原始处理方式
        results.forEach(result => {
          if (result.type === 'attraction') {
            this.fallbackUpdateQueueTimes(currentParkId, result.data);
          } else if (result.type === 'performance') {
            this.fallbackUpdatePerformanceTimes(currentParkId, result.data);
          }
        });
        }
      } else {
        console.error('云函数获取基础数据失败:', basicRes.result.error);
      }
    }).catch((error) => {
      console.error(`云函数调用失败 for ${currentParkId}:`, error);
    });
  },

  // 回退的排队时间更新方法（当dataAdapter失败时使用）
  fallbackUpdateQueueTimes(park, attractions) {
    console.log(`Using fallback method for ${park}, processing ${attractions.length} attractions`);
    
    if (!this.globalData.queueTimeCache[park]) {
      this.globalData.queueTimeCache[park] = {};
    }
    
    let validCount = 0;
    let skippedCount = 0;
    
    attractions.forEach((attraction, index) => {
      // 更详细的数据验证
      const hasValidId = attraction && (attraction.id !== null && attraction.id !== undefined && attraction.id !== '');
      const hasValidName = attraction && (attraction.name !== null && attraction.name !== undefined && attraction.name !== '');
      
      if (!hasValidId || !hasValidName) {
        console.warn(`Skipping attraction ${index + 1} - Invalid data:`, {
          id: attraction?.id,
          name: attraction?.name,
          reason: !hasValidId ? 'Invalid ID' : 'Invalid name'
        });
        skippedCount++;
        return;
      }
      
      // 特殊处理：当游乐项目关闭时，不显示时间单位
      let waitUnit = attraction.waitUnit;
      if (attraction.waitTime === '关闭' || attraction.waitTime === '已关闭') {
        waitUnit = '状态';
      } else if (!waitUnit && typeof attraction.waitTime === 'number') {
        waitUnit = '分钟';
      }
      
      this.globalData.queueTimeCache[park][attraction.id] = {
        queueTime: attraction.queueTime || 0,
        status: attraction.status || 'unknown',
        waitTime: attraction.waitTime || 0,
        waitUnit: waitUnit || 'minutes',
        colorTheme: attraction.colorTheme || 'default',
        updateTime: new Date().getTime(),
        name: attraction.name
      };
      
      validCount++;
    });
    
    console.log(`Fallback update completed for ${park}: ${validCount} valid attractions, ${skippedCount} skipped`);
  },

  // 回退的演出时间更新方法（当dataAdapter失败时使用）
  fallbackUpdatePerformanceTimes(park, performances) {
    console.log(`Using fallback method for ${park}, processing ${performances.length} performances`);
    
    if (!this.globalData.performanceTimeCache[park]) {
      this.globalData.performanceTimeCache[park] = {};
    }
    
    let validCount = 0;
    let skippedCount = 0;
    
    performances.forEach((performance, index) => {
      // 更详细的数据验证
      const hasValidId = performance && (performance.id !== null && performance.id !== undefined && performance.id !== '');
      const hasValidName = performance && (performance.name !== null && performance.name !== undefined && performance.name !== '');
      
      if (!hasValidId || !hasValidName) {
        console.warn(`Skipping performance ${index + 1} - Invalid data:`, {
          id: performance?.id,
          name: performance?.name,
          reason: !hasValidId ? 'Invalid ID' : 'Invalid name'
        });
        skippedCount++;
        return;
      }
      
      // 特殊处理：当演出已结束、已满、无场次或数据错误时，不显示时间单位
      let timeUnit = performance.waitUnit;
      if (performance.waitTime === '已结束' || performance.waitTime === '已满' || 
          performance.waitTime === '无场次' || performance.waitTime === '数据错误' ||
          performance.waitTime === '常驻' || performance.waitTime === '关闭') {
        timeUnit = '';
      } else if (!timeUnit && typeof performance.waitTime === 'number') {
        timeUnit = '分钟';
      }

      this.globalData.performanceTimeCache[park][performance.id] = {
        nextShow: performance.nextShow || null,
        nextShowTime: performance.nextShowTime || null,
        showTimes: performance.showTimes || [],
        status: performance.status || 'unknown',
        timeToNext: performance.waitTime || null,
        timeUnit: timeUnit || '',
        colorTheme: performance.colorTheme || 'default',
        updateTime: new Date().getTime(),
        name: performance.name
      };
      
      validCount++;
    });
    
    console.log(`Fallback performance update completed for ${park}: ${validCount} valid performances, ${skippedCount} skipped`);
  },

  // 获取指定项目的排队时间数据
  getQueueTimeData(attractionId) {
    const currentParkId = this.globalData.currentParkId;
    console.log('Getting queue time data for attraction:', attractionId, 'in park:', currentParkId);
    
    if (!currentParkId) {
      console.error('No current park ID');
      return null;
    }
    
    if (!this.globalData.queueTimeCache[currentParkId]) {
      console.error('No queue time cache for park:', currentParkId);
      console.log('Available parks in cache:', Object.keys(this.globalData.queueTimeCache));
      return null;
    }
    
    console.log('Available attraction IDs in cache:', Object.keys(this.globalData.queueTimeCache[currentParkId]));
    console.log('Looking for attraction ID:', attractionId, 'type:', typeof attractionId);
    
    // 尝试直接匹配
    let data = this.globalData.queueTimeCache[currentParkId][attractionId];
    
    // 如果直接匹配失败，尝试类型转换
    if (!data) {
      // 如果传入的是字符串，尝试转换为数字
      if (typeof attractionId === 'string') {
        const numericId = parseInt(attractionId, 10);
        if (!isNaN(numericId)) {
          data = this.globalData.queueTimeCache[currentParkId][numericId];
          console.log('Trying numeric ID:', numericId, 'result:', data);
        }
      }
      // 如果传入的是数字，尝试转换为字符串
      else if (typeof attractionId === 'number') {
        const stringId = attractionId.toString();
        data = this.globalData.queueTimeCache[currentParkId][stringId];
        console.log('Trying string ID:', stringId, 'result:', data);
      }
    }
    
    console.log('Queue time data:', data);
    
    if (!data) {
      console.warn('No queue time data found for attraction:', attractionId);
      console.log('Cache structure for park:', this.globalData.queueTimeCache[currentParkId]);
    }
    
    return data || null;
  },

  // 获取指定项目的历史排队时间数据 - 使用云函数
  getAttractionHistoryData(attractionName, callback) {
    console.log('【App-历史数据】开始获取项目历史数据:', attractionName);
    const currentParkId = this.globalData.currentParkId;
    
    if (!currentParkId) {
      console.error('【App-历史数据】错误：没有当前游乐场ID');
      callback(null);
      return;
    }

    if (!attractionName) {
      console.error('【App-历史数据】错误：没有提供项目名称');
      callback(null);
      return;
    }

    console.log('【App-历史数据】使用云函数获取历史数据:', { 
      parkId: currentParkId, 
      attractionName: attractionName,
      hasToken: !!this.globalData.token,
      tokenLength: this.globalData.token ? this.globalData.token.length : 0
    });
    
    const requestStartTime = Date.now();
    
    // 使用云函数获取历史数据
    wx.cloud.callFunction({
      name: 'fetchServerData',
      data: {
        action: 'getAttractionHistory',
        parkId: currentParkId,
        attractionName: attractionName,
        token: this.globalData.token || ''
      }
    }).then(res => {
      const requestEndTime = Date.now();
      const requestDuration = requestEndTime - requestStartTime;
      
      console.log('【App-历史数据】云函数调用完成，耗时:', requestDuration + 'ms');
      console.log('【App-历史数据】云函数返回结果:', {
        success: res.result.success,
        hasData: !!res.result.data,
        error: res.result.error,
        requireAuth: res.result.requireAuth
      });
      
      if (res.result.success) {
        console.log('【App-历史数据】成功获取历史数据');
        callback(res.result.data);
      } else {
        console.error('【App-历史数据】云函数获取历史数据失败:', res.result.error);
        console.error('【App-历史数据】失败详情:', {
          error: res.result.error,
          errorDetail: res.result.errorDetail,
          requireAuth: res.result.requireAuth,
          duration: requestDuration
        });
        
        // 如果是需要认证的错误，提示用户登录
        if (res.result.requireAuth) {
          console.log('【App-历史数据】需要认证，显示登录提示');
          wx.showToast({
            title: '请先登录查看历史数据',
            icon: 'none',
            duration: 2000
          });
        }
        
        callback(null);
      }
    }).catch(error => {
      const requestEndTime = Date.now();
      const requestDuration = requestEndTime - requestStartTime;
      
      console.error('【App-历史数据】云函数调用异常，耗时:', requestDuration + 'ms');
      console.error('【App-历史数据】异常详情:', error);
      
      // 判断是否可能是超时
      if (requestDuration >= 8000) {
        console.error('【App-历史数据】疑似云函数调用超时');
        wx.showToast({
          title: '网络请求超时',
          icon: 'none',
          duration: 2000
        });
      }
      
      callback(null);
    });
  },

  // 获取指定演出项目的时间数据
  getPerformanceTimeData(performanceId) {
    const currentParkId = this.globalData.currentParkId;
    console.log('Getting performance time data for performance:', performanceId, 'in park:', currentParkId);
    
    if (!currentParkId) {
      console.error('No current park ID');
      return null;
    }
    
    if (!this.globalData.performanceTimeCache[currentParkId]) {
      console.error('No performance time cache for park:', currentParkId);
      console.log('Available parks in performance cache:', Object.keys(this.globalData.performanceTimeCache));
      return null;
    }
    
    console.log('Available performance IDs in cache:', Object.keys(this.globalData.performanceTimeCache[currentParkId]));
    console.log('Looking for performance ID:', performanceId, 'type:', typeof performanceId);
    
    // 尝试直接匹配
    let data = this.globalData.performanceTimeCache[currentParkId][performanceId];
    
    // 如果直接匹配失败，尝试类型转换
    if (!data) {
      // 如果传入的是字符串，尝试转换为数字
      if (typeof performanceId === 'string') {
        const numericId = parseInt(performanceId, 10);
        if (!isNaN(numericId)) {
          data = this.globalData.performanceTimeCache[currentParkId][numericId];
          console.log('Trying numeric ID:', numericId, 'result:', data);
        }
      }
      // 如果传入的是数字，尝试转换为字符串
      else if (typeof performanceId === 'number') {
        const stringId = performanceId.toString();
        data = this.globalData.performanceTimeCache[currentParkId][stringId];
        console.log('Trying string ID:', stringId, 'result:', data);
      }
    }
    
    console.log('Performance time data:', data);
    
    if (!data) {
      console.warn('No performance time data found for performance:', performanceId);
      console.log('Cache structure for park:', this.globalData.performanceTimeCache[currentParkId]);
    }
    
    return data || null;
  },

  // 获取所有排队时间数据
  getAllQueueTimeData() {
    const currentParkId = this.globalData.currentParkId;
    if (!currentParkId || !this.globalData.queueTimeCache[currentParkId]) {
      return {};
    }
    return this.globalData.queueTimeCache[currentParkId];
  },

  // 获取所有演出时间数据
  getAllPerformanceTimeData() {
    const currentParkId = this.globalData.currentParkId;
    if (!currentParkId || !this.globalData.performanceTimeCache[currentParkId]) {
      return {};
    }
    return this.globalData.performanceTimeCache[currentParkId];
  },

  // 排队时间更新回调
  onQueueTimeUpdated: null,
  
  // 演出时间更新回调
  onPerformanceTimeUpdated: null,
  
  /**
   * 设置AI助手开关状态
   * @param {boolean} enabled - 是否启用AI助手
   */
  setAiAssistantEnabled(enabled) {
    this.globalData.aiAssistantEnabled = enabled;
    
    // 保存到本地存储
    try {
      wx.setStorageSync('aiAssistantEnabled', enabled);
      console.log('AI助手开关状态已保存:', enabled);
    } catch (e) {
      console.error('保存AI助手开关状态失败:', e);
    }
    
    // 触发全局事件，通知相关页面更新
    this.globalEvents.emit('aiAssistantToggled', enabled);
  },
  
  /**
   * 获取AI助手开关状态
   * @returns {boolean} AI助手是否启用
   */
  getAiAssistantEnabled() {
    return this.globalData.aiAssistantEnabled;
  },
  
  /**
   * 从本地存储加载AI助手开关状态
   */
  loadAiAssistantConfig() {
    try {
      const enabled = wx.getStorageSync('aiAssistantEnabled');
      if (enabled !== '') {
        this.globalData.aiAssistantEnabled = enabled;
        console.log('从本地存储恢复AI助手开关状态:', enabled);
      }
    } catch (e) {
      console.error('加载AI助手开关状态失败:', e);
      // 使用默认值
      this.globalData.aiAssistantEnabled = true;
    }
  },

  /**
   * 全局分享给好友配置
   */
  onShareAppMessage() {
    return {
      title: '环球影城小助手 - 让游玩更精彩',
      path: '/pages/map/map',
      imageUrl: '/images/xiaoxiaolu_default_touxiang.jpg'
    };
  },

  /**
   * 全局分享到朋友圈配置
   */
  onShareTimeline() {
    return {
      title: '环球影城小助手 - 让游玩更精彩',
      query: 'from=timeline',
      imageUrl: '/images/xiaoxiaolu_default_touxiang.jpg'
    };
  }
});
