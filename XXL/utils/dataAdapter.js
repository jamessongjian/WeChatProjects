/**
 * 游乐场数据适配器
 * 用于统一处理不同游乐场的API数据结构
 */

// 默认字段映射配置
const defaultFieldMapping = {
  attraction: {
    id: 'id',
    name: '项目名称',
    image: 'image_url',
    queueTime: '排队时间',
    location: '项目地点',
    isIndoor: '是否室内',
    openTime: '开放时间',
    closeTime: '关闭时间',
    hasExpress: '支持优速通',
    latitude: ['经纬度', '纬度'],
    longitude: ['经纬度', '经度'],
    status: '是否关闭'
  },
  performance: {
    id: 'id',
    name: '演出名称',
    image: '图片URL',
    location: '演出地点',
    isIndoor: '是否室内',
    hasExpress: '支持优速通',
    queueTime: '排队时间',
    openTime: '开放时间',
    closeTime: '关闭时间',
    nextShow: '下一场时间',
    status: '是否关闭',
    showTimes: ['演出场次', '演出时间'],
    latitude: ['经纬度', '纬度'],
    longitude: ['经纬度', '经度']
  },
  restaurant: {
    id: 'id',
    name: '名称',
    image: '图片',
    location: '位置',
    isIndoor: '是否室内',
    price: '价格水平',
    openTime: '开放时间',
    closeTime: '关闭时间',
    latitude: ['经纬度', '纬度'],
    longitude: ['经纬度', '经度'],
    status: '项目状态',
    additionalInfo: '附加信息',
    description: '描述',
    products: '产品列表'
  },
  shop: {
    id: 'id',
    name: '商店名称',
    image: 'image_url',
    location: '商店位置',
    isIndoor: '是否室内',
    category: '商品类别',
    openTime: '营业时间',
    closeTime: '关闭时间',
    latitude: ['经纬度', '纬度'],
    longitude: ['经纬度', '经度'],
    status: '营业状态'
  },
  restroom: {
    id: 'id',
    name: '名称',
    image: 'image_url',
    location: '位置',
    latitude: '纬度',
    longitude: '经度',
    facilities: '设施信息',
    accessibility: '无障碍设施',
    babyChanging: '婴儿换尿布台',
    description: '描述'
  },
  charger: {
    id: 'id',
    name: '名称',
    image: 'image_url',
    location: '位置',
    latitude: '纬度',
    longitude: '经度',
    brand: '品牌',
    capacity: '容量',
    availableCount: '可用数量',
    totalCount: '总数量',
    status: '状态',
    description: '描述'
  },
  otherInfo: {
    name: 'item_name',
    summary: 'summary',
    detail: 'detail',
    duration: 'duration',
    flags: 'flag',
    suggestedQueries: 'suggested_querys',
    showTimes: '演出场次',
    notification: '通知信息'
  }
};

/**
 * 游乐园基本项目类
 * 所有项目类型的基类
 */
class ParkItem {
  constructor(data = {}) {
    this.id = data.id || '';
    this.number_id = data.number_id || '';
    this.name = data.name || '';
    this.type = data.type || '';
    this.image = data.image || '';
    this.latitude = data.latitude || null;
    this.longitude = data.longitude || null;
    this.location = data.location || '';
    this.isIndoor = data.isIndoor || false;
    this.status = data.status || '';
    this.openTime = data.openTime || '';
    this.waitTime = data.waitTime || '';
    this.waitUnit = data.waitUnit || '';
    this.colorTheme = data.colorTheme || 'gray';
    this.summary = data.summary || '';
    this.detail = data.detail || '';
    this.flags = data.flags || [];
    this.suggestedQueries = data.suggestedQueries || [];
    this.notification = data.notification || '';
  }
}

/**
 * 游乐设施类
 */
class Attraction extends ParkItem {
  constructor(data = {}) {
    super(data);
    this.type = 'attraction';
    this.queueTime = data.queueTime || 0;
    this.hasExpress = data.hasExpress || false;
    this.duration = data.duration || '';
  }
}

/**
 * 演出表演类
 */
class Performance extends ParkItem {
  constructor(data = {}) {
    super(data);
    this.type = 'performance';
    this.showTimes = data.showTimes || [];
    this.nextShow = data.nextShow || null;
    this.duration = data.duration || '';
    this.hasExpress = data.hasExpress || false;
  }
}

/**
 * 餐厅类
 */
class Restaurant extends ParkItem {
  constructor(data = {}) {
    super(data);
    this.type = 'restaurant';
    this.cuisine = data.cuisine || '';
    this.price = data.price || '';
    this.description = data.description || "";
    this.products = data.products || [];
  }
}

/**
 * 厕所类
 */
class Restroom extends ParkItem {
  constructor(data = {}) {
    super(data);
    this.type = 'restroom';
    this.facilities = data.facilities || []; // 设施信息，如无障碍设施、婴儿换尿布台等
    this.accessibility = data.accessibility || false; // 是否有无障碍设施
    this.babyChanging = data.babyChanging || false; // 是否有婴儿换尿布台
    this.description = data.description || "";
  }
}

/**
 * 商店类
 */
class Shop extends ParkItem {
  constructor(data = {}) {
    super(data);
    this.type = 'shop';
    this.category = data.category || '';
  }
}

/**
 * 充电宝类
 */
class Charger extends ParkItem {
  constructor(data = {}) {
    super(data);
    this.type = 'charger';
    this.brand = data.brand || ''; // 品牌
    this.capacity = data.capacity || ''; // 容量
    this.availableCount = data.availableCount || 0; // 可用数量
    this.totalCount = data.totalCount || 0; // 总数量
    this.description = data.description || "";
  }
}

/**
 * 游乐场数据适配器基类
 */
class ParkDataAdapter {
  constructor(parkId) {
    this.parkId = parkId;
    this.parkConfig = this.getParkSpecificMapping(); // 子类实现此方法
    this.numberIdCounter = 1;
  }

  /**
   * 子类必须实现的方法，提供特定游乐场的映射规则
   * @returns {Object} - 特定游乐场的映射配置
   */
  getParkSpecificMapping() {
    return {}; // 默认返回空对象
  }
  
  /**
   * 通用的开放/关闭时间映射函数
   * @returns {Function} 处理开放时间的映射函数
   */
  getDefaultOpenTimeMapper() {
    return (value) => {
      if (value) {
        return value;
      }
      if (typeof value === 'object' && value.open && value.close) {
        return `${value.open}-${value.close}`;
      }
      return value || '';
    };
  }
  
  /**
   * 通用的室内项目映射函数
   * @returns {Function} 处理室内项目的映射函数
   */
  getDefaultIndoorMapper() {
    return (value) => value === '室内项目' || value === '室内' || value === 'INDOOR' || value === 1 || value === true;
  }
  
  /**
   * 通用的快速通道映射函数
   * @returns {Function} 处理快速通道的映射函数
   */
  getDefaultExpressMapper() {
    return (value) => value === '优速通' || value === '快速通道' || value === 'FASTPASS' || value === 1 || value === true;
  }
  
  /**
   * 通用的演出场次映射函数
   * @returns {Function} 处理演出场次的映射函数
   */
  getDefaultShowTimesMapper() {
    return (value) => {
      
      if (value && Array.isArray(value)) {
        // 检查数组元素的类型
        if (value.length > 0) {
          const firstItem = value[0];
          
          // 如果是对象格式（包含时间和满座信息）
          if (typeof firstItem === 'object' && firstItem !== null) {
            const result = value.map(show => ({
              time: show.时间 || show.time || '',
              isFull: show.是否已满 || show.isFull || false
            }));
            return result;
          }
          // 如果是简单的时间字符串数组
          else if (typeof firstItem === 'string') {
            const result = value.map(timeStr => ({
              time: timeStr,
              isFull: false
            }));
            return result;
          }
        }
      }
      return [];
    };
  }

  /**
   * 获取字段值
   * @param {Object} item - 项目数据
   * @param {string|Array} fieldPath - 字段路径
   * @returns {*} - 字段值
   */
  getFieldValue(item, fieldPath) {
    if (!item) {
      return null;
    }
    
    // 对于特殊字段进行预处理
    if (fieldPath === '纬度' || fieldPath === 'latitude') {
      // 直接尝试获取纬度字段
      const directValue = item['纬度'] || item['latitude'];
      if (directValue !== undefined) {
        return directValue;
      }
      
      // 尝试从经纬度对象中获取
      if (item['经纬度'] && typeof item['经纬度'] === 'object') {
        return item['经纬度']['纬度'] || item['经纬度'].lat;
      }
      if (item.location && typeof item.location === 'object') {
        return item.location.lat || item.location.latitude;
      }
    }
    
    if (fieldPath === '经度' || fieldPath === 'longitude') {
      // 直接尝试获取经度字段
      const directValue = item['经度'] || item['longitude'];
      if (directValue !== undefined) {
        return directValue;
      }
      
      // 尝试从经纬度对象中获取
      if (item['经纬度'] && typeof item['经纬度'] === 'object') {
        return item['经纬度']['经度'] || item['经纬度'].lng;
      }
      if (item.location && typeof item.location === 'object') {
        return item.location.lng || item.location.longitude;
      }
    }
    
    // 处理数组路径（嵌套字段）
    if (Array.isArray(fieldPath)) {
      let value = item;
      
      // 遍历字段路径
      for (const path of fieldPath) {
        // 如果当前值为 null 或 undefined，返回 null
        if (value === null || value === undefined) {
          return null;
        }
        
        // 如果当前值不是对象，无法继续访问其属性
        if (typeof value !== 'object') {
          return null;
        }
        
        // 获取下一级属性
        value = value[path];
      }
      
      return value;
    }
    
    // 处理单一字段
    return item[fieldPath];
  }

  /**
   * 获取字段映射配置
   * @param {string} type - 项目类型
   * @returns {Object} - 字段映射配置
   */
  getFieldMapping(type) {
    const defaultMapping = defaultFieldMapping[type];
    const specificMapping = this.parkConfig[type];
    return { ...defaultMapping, ...(specificMapping || {}) };
  }

  /**
   * 处理项目基本信息
   * @param {Object} item - 原始项目数据
   * @param {Object} mapping - 字段映射配置
   * @param {string} type - 项目类型
   * @returns {Object} - 基本信息对象
   */
  extractBaseInfo(item, mapping, type) {
    // 获取原始类型并映射为标准类型
    const originalType = this.getFieldValue(item, '项目类型');
    const mappedType = mapping.typeMapper ? mapping.typeMapper(originalType) : type;
    
    // 获取项目标识信息，确保有默认ID
    const nameField = mapping.name || 'name';
    const idField = mapping.id || 'id';
    
    const itemId = this.getFieldValue(item, idField) || `item-${this.numberIdCounter}`;
    const itemName = this.getFieldValue(item, nameField) || `未命名项目-${this.numberIdCounter}`;

    // 获取经纬度信息
    const latField = mapping.latitude || 'latitude';
    const lngField = mapping.longitude || 'longitude';
    
    const latitude = this.getFieldValue(item, latField);
    const longitude = this.getFieldValue(item, lngField);

    // 获取通知信息
    const notification = this.getFieldValue(item, '通知信息') || '';

    return {
      id: itemId,
      number_id: `${this.numberIdCounter++}`,
      name: itemName,
      image: this.getFieldValue(item, mapping.image) || '',
      type: mappedType, 
      latitude: latitude,
      longitude: longitude,
      location: this.getFieldValue(item, mapping.location) || '园区内',
      notification: notification
    };
  }

  /**
   * 创建游乐设施对象
   * @param {Object} item - 原始项目数据
   * @param {string} type - 项目类型
   * @returns {Attraction} - 游乐设施对象
   */
  createAttraction(item, type) {
    
    if (!item) {
      return null;
    }

    const mapping = this.getFieldMapping('attraction');
    if (!mapping) {
      return null;
    }

    // 获取基本信息
    const baseInfo = this.extractBaseInfo(item, mapping, type);
    
    // 创建游乐设施实例
    const attraction = new Attraction(baseInfo);
    
    // 处理特定字段
    if (mapping.queueTime) {
      attraction.queueTime = parseInt(this.getFieldValue(item, mapping.queueTime) || 0);
    }
    
    if (mapping.isIndoor && mapping.isIndoorMapper) {
      attraction.isIndoor = mapping.isIndoorMapper(this.getFieldValue(item, mapping.isIndoor));
    }
    
    if (mapping.openTime && mapping.openTimeMapper) {
      attraction.openTime = mapping.openTimeMapper(this.getFieldValue(item, mapping.openTime));
    }
    
    // 处理关闭时间
    if (mapping.closeTime) {
      const closeTime = this.getFieldValue(item, mapping.closeTime);
      if (closeTime) {
        attraction.closeTime = closeTime;
        // 如果已有openTime但没有包含结束时间，则组合展示
        if (attraction.openTime && !attraction.openTime.includes("-")) {
          attraction.openTime = `${attraction.openTime}-${closeTime}`;
        }
      }
    }
    
    if (mapping.status && mapping.statusMapper) {
      attraction.status = mapping.statusMapper(this.getFieldValue(item, mapping.status));
      
      // 特殊处理：如果有"是否关闭"字段，优先使用该字段
      if (item['是否关闭'] !== undefined) {
        const isClosedValue = item['是否关闭'];
        // 如果"是否关闭"为false，强制设置状态为开放中，不管"项目状态"如何
        if (isClosedValue === false) {
          attraction.status = '开放中';
        }
      }
    }
    
    if (mapping.hasExpress && mapping.hasExpressMapper) {
      attraction.hasExpress = mapping.hasExpressMapper(this.getFieldValue(item, mapping.hasExpress));
    }
    
    // 处理依赖字段
    this.processAttractionDependencies(attraction);
    
    return attraction;
  }

  /**
   * 创建演出表演对象
   * @param {Object} item - 原始项目数据
   * @param {string} type - 项目类型
   * @returns {Performance} - 演出表演对象
   */
  createPerformance(item, type) {
    
    if (!item) {
      return null;
    }

    const mapping = this.getFieldMapping('performance');
    if (!mapping) {
      return null;
    }

    // 获取基本信息
    const baseInfo = this.extractBaseInfo(item, mapping, type);
    
    // 创建演出表演实例
    const performance = new Performance(baseInfo);
    
    // 处理特定字段
    if (mapping.isIndoor && mapping.isIndoorMapper) {
      performance.isIndoor = mapping.isIndoorMapper(this.getFieldValue(item, mapping.isIndoor));
    }
    
    if (mapping.openTime && mapping.openTimeMapper) {
      performance.openTime = mapping.openTimeMapper(this.getFieldValue(item, mapping.openTime));
    }
    
    // 处理关闭时间
    if (mapping.closeTime) {
      const closeTime = this.getFieldValue(item, mapping.closeTime);
      if (closeTime) {
        performance.closeTime = closeTime;
        // 如果已有openTime但没有包含结束时间，则组合展示
        if (performance.openTime && !performance.openTime.includes("-")) {
          performance.openTime = `${performance.openTime}-${closeTime}`;
        }
      }
    }
    
    if (mapping.status && mapping.statusMapper) {
      performance.status = mapping.statusMapper(this.getFieldValue(item, mapping.status));
      
      // 特殊处理：如果有"是否关闭"字段，优先使用该字段（适用于所有游乐场）
      if (item['是否关闭'] !== undefined) {
        const isClosedValue = item['是否关闭'];
        // 如果"是否关闭"为false，强制设置状态为开放中，不管"项目状态"如何
        if (isClosedValue === false) {
          performance.status = '开放中';
        }
      }
    }
    
    if (mapping.hasExpress && mapping.hasExpressMapper) {
      performance.hasExpress = mapping.hasExpressMapper(this.getFieldValue(item, mapping.hasExpress));
    }
    
    performance.nextShow = this.getFieldValue(item, mapping.nextShow) || null;
    
    // 检查是否已经有演出场次数据（可能来自补充信息合并）
    const existingShowTimes = item.showTimes;
    if (existingShowTimes && Array.isArray(existingShowTimes) && existingShowTimes.length > 0) {
      performance.showTimes = existingShowTimes;
    } else if (mapping.showTimes && mapping.showTimesMapper) {
      const showTimesValue = this.getFieldValue(item, mapping.showTimes);
      
      try {
        const mappedShowTimes = mapping.showTimesMapper(showTimesValue) || [];
        
        performance.showTimes = mappedShowTimes.filter(show => {
          const hasValidTime = show && show.time && typeof show.time === 'string';
          if (!hasValidTime) {
          }
          return hasValidTime;
        });
        
      } catch (error) {
        performance.showTimes = [];
      }
    } else {
      performance.showTimes = [];
    }
    
    // 处理依赖字段
    this.processPerformanceDependencies(performance);
    
    
    return performance;
  }

  /**
   * 创建餐厅对象
   * @param {Object} item - 原始项目数据
   * @param {string} type - 项目类型
   * @returns {Restaurant} - 餐厅对象
   */
  createRestaurant(item, type) {
    
    if (!item) {
      return null;
    }

    const mapping = this.getFieldMapping('restaurant');
    if (!mapping) {
      return null;
    }

    // 获取基本信息
    const baseInfo = this.extractBaseInfo(item, mapping, type);
    
    // 创建餐厅实例
    const restaurant = new Restaurant(baseInfo);
    
    // 确保location不为空，给出友好的默认值
    if (!restaurant.location || restaurant.location.trim() === '') {
      restaurant.location = '园区内';
    }
    
    // 处理特定字段
    if (mapping.isIndoor && mapping.isIndoorMapper) {
      restaurant.isIndoor = mapping.isIndoorMapper(this.getFieldValue(item, mapping.isIndoor));
    }
    
    if (mapping.openTime && mapping.openTimeMapper) {
      const openTimeValue = this.getFieldValue(item, mapping.openTime);
      restaurant.openTime = mapping.openTimeMapper(openTimeValue);
    } else {
      // 处理嵌套的营业时间对象格式
      const openTimeValue = this.getFieldValue(item, mapping.openTime);
      if (openTimeValue && typeof openTimeValue === 'object' && openTimeValue.open && openTimeValue.close) {
        restaurant.openTime = `${openTimeValue.open}-${openTimeValue.close}`;
      }
    }
    
    // 处理关闭时间
    if (mapping.closeTime) {
      const closeTime = this.getFieldValue(item, mapping.closeTime);
      if (closeTime) {
        restaurant.closeTime = closeTime;
        // 如果已有openTime但没有包含结束时间，则组合展示
        if (restaurant.openTime && !restaurant.openTime.includes("-")) {
          restaurant.openTime = `${restaurant.openTime}-${closeTime}`;
        }
      }
    }
    
    // 特殊处理：直接尝试获取开放时间和关闭时间（适用于所有游乐场）
    // 如果常规方法未能获取到开放时间，则直接使用原始数据
    if (!restaurant.openTime && item['开放时间']) {
      restaurant.openTime = item['开放时间'];
      
      // 如果有关闭时间且开放时间不包含结束时间，则组合显示
      if (restaurant.closeTime && !restaurant.openTime.includes("-")) {
        restaurant.openTime = `${restaurant.openTime}-${restaurant.closeTime}`;
      }
    }
    
    if (mapping.status && mapping.statusMapper) {
      restaurant.status = mapping.statusMapper(this.getFieldValue(item, mapping.status));
    } else {
      restaurant.status = '开放中'; // 默认为开放中，如果没有明确状态
    }
    
    if (mapping.price) {
      restaurant.price = this.getFieldValue(item, mapping.price) || '';
    }
    
    // 处理附加信息
    if (mapping.additionalInfo) {
      const additionalInfo = this.getFieldValue(item, mapping.additionalInfo);
      if (additionalInfo) {
        restaurant.summary = additionalInfo;
      }
    }
    
    // 处理描述信息
    if (mapping.description) {
      restaurant.description = this.getFieldValue(item, mapping.description) || "";
    }
    
    // 处理产品列表
    if (mapping.products) {
      const productsValue = this.getFieldValue(item, mapping.products);
      restaurant.products = Array.isArray(productsValue) ? productsValue : [];
    }
    
    // 处理餐厅依赖字段
    this.processRestaurantDependencies(restaurant);
    
    return restaurant;
  }

  /**
   * 处理餐厅依赖字段
   * @param {Restaurant} restaurant - 餐厅对象
   */
  processRestaurantDependencies(restaurant) {
    // 获取当前时间
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    
    // 检查餐厅是否关闭
    if (restaurant.status === '已关闭') {
      restaurant.waitTime = '关闭';
      restaurant.waitUnit = '状态';
      restaurant.colorTheme = 'gray';
      return;
    }
    
    // 如果既没有开放时间也没有关闭时间，则默认为营业中
    if (!restaurant.openTime && !restaurant.closeTime) {
      restaurant.waitTime = '营业中';
      restaurant.waitUnit = '';
      restaurant.colorTheme = 'green';
      return;
    }
    
    // 解析开放时间和关闭时间
    let openHour = 0, openMinute = 0, closeHour = 23, closeMinute = 59;
    
    if (restaurant.openTime) {
      const match = restaurant.openTime.match(/(\d{1,2}):(\d{2})/);
      if (match) {
        openHour = parseInt(match[1], 10);
        openMinute = parseInt(match[2], 10);
      }
    }
    
    if (restaurant.closeTime) {
      const match = restaurant.closeTime.match(/(\d{1,2}):(\d{2})/);
      if (match) {
        closeHour = parseInt(match[1], 10);
        closeMinute = parseInt(match[2], 10);
      }
    }
    
    // 判断当前是否在营业时间内
    const currentTimeMinutes = currentHour * 60 + currentMinute;
    const openTimeMinutes = openHour * 60 + openMinute;
    const closeTimeMinutes = closeHour * 60 + closeMinute;
    
    if (currentTimeMinutes < openTimeMinutes) {
      // 还未开放
      const waitMinutes = openTimeMinutes - currentTimeMinutes;
      if (waitMinutes < 60) {
        restaurant.waitTime = waitMinutes;
        restaurant.waitUnit = '分钟';
        restaurant.colorTheme = 'orange';
      } else {
        const waitHours = Math.floor(waitMinutes / 60);
        restaurant.waitTime = waitHours;
        restaurant.waitUnit = '小时';
        restaurant.colorTheme = 'gray';
      }
    } else if (currentTimeMinutes >= closeTimeMinutes) {
      // 已结束营业
      restaurant.waitTime = '已结束';
      restaurant.waitUnit = '营业';
      restaurant.colorTheme = 'gray';
    } else {
      // 营业中，计算还有多久结束
      const remainingMinutes = closeTimeMinutes - currentTimeMinutes;
      if (remainingMinutes <= 30) {
        restaurant.waitTime = '即将结束';
        restaurant.waitUnit = '';
        restaurant.colorTheme = 'orange';
      } else {
        restaurant.waitTime = '营业中';
        restaurant.waitUnit = '';
        restaurant.colorTheme = 'green';
      }
    }
    
  }

  /**
   * 创建商店对象
   * @param {Object} item - 原始项目数据
   * @param {string} type - 项目类型
   * @returns {Shop} - 商店对象
   */
  createShop(item, type) {
    
    if (!item) {
      return null;
    }

    const mapping = this.getFieldMapping('shop');
    if (!mapping) {
      return null;
    }

    // 获取基本信息
    const baseInfo = this.extractBaseInfo(item, mapping, type);
    
    // 创建商店实例
    const shop = new Shop(baseInfo);
    
    // 处理特定字段
    if (mapping.isIndoor && mapping.isIndoorMapper) {
      shop.isIndoor = mapping.isIndoorMapper(this.getFieldValue(item, mapping.isIndoor));
    }
    
    if (mapping.openTime && mapping.openTimeMapper) {
      shop.openTime = mapping.openTimeMapper(this.getFieldValue(item, mapping.openTime));
    }
    
    // 处理关闭时间
    if (mapping.closeTime) {
      const closeTime = this.getFieldValue(item, mapping.closeTime);
      if (closeTime) {
        shop.closeTime = closeTime;
        // 如果已有openTime但没有包含结束时间，则组合展示
        if (shop.openTime && !shop.openTime.includes("-")) {
          shop.openTime = `${shop.openTime}-${closeTime}`;
        }
      }
    }
    
    if (mapping.status && mapping.statusMapper) {
      shop.status = mapping.statusMapper(this.getFieldValue(item, mapping.status));
      
      // 特殊处理：如果有"是否关闭"字段，优先使用该字段
      if (item['是否关闭'] !== undefined) {
        const isClosedValue = item['是否关闭'];
        // 如果"是否关闭"为false，强制设置状态为开放中，不管"项目状态"如何
        if (isClosedValue === false) {
          shop.status = '开放中';
        }
      }
    }
    
    // 特殊处理：直接尝试获取开放时间和关闭时间
    if (!shop.openTime && item['开放时间']) {
      shop.openTime = item['开放时间'];
      
      // 如果有关闭时间且开放时间不包含结束时间，则组合显示
      if (shop.closeTime && !shop.openTime.includes("-")) {
        shop.openTime = `${shop.openTime}-${shop.closeTime}`;
      }
    }
    
    if (mapping.category) {
      shop.category = this.getFieldValue(item, mapping.category) || '';
    }
    
    // 处理商店依赖字段
    this.processShopDependencies(shop);
    
    return shop;
  }

  createRestroom(item, type) {
    
    if (!item) {
      return null;
    }

    const mapping = this.getFieldMapping('restroom');
    if (!mapping) {
      return null;
    }

    // 获取基本信息
    const baseInfo = this.extractBaseInfo(item, mapping, type);
    
    // 创建厕所实例
    const restroom = new Restroom(baseInfo);
    
    // 处理厕所特有字段
    if (mapping.facilities) {
      restroom.facilities = this.getFieldValue(item, mapping.facilities) || [];
    }
    
    if (mapping.accessibility) {
      restroom.accessibility = this.getFieldValue(item, mapping.accessibility) || false;
    }
    
    if (mapping.babyChanging) {
      restroom.babyChanging = this.getFieldValue(item, mapping.babyChanging) || false;
    }
    
    // 设置厕所的默认状态
    restroom.status = '开放中';
    restroom.waitTime = '可用';
    restroom.waitUnit = '';
    restroom.colorTheme = 'green';
    
    return restroom;
  }

  createCharger(item, type) {
    
    if (!item) {
      return null;
    }

    const mapping = this.getFieldMapping('charger');
    if (!mapping) {
      return null;
    }

    // 获取基本信息
    const baseInfo = this.extractBaseInfo(item, mapping, type);
    
    // 创建充电宝实例
    const charger = new Charger(baseInfo);
    
    // 处理充电宝特有字段
    if (mapping.brand) {
      charger.brand = this.getFieldValue(item, mapping.brand) || '';
    }
    
    if (mapping.capacity) {
      charger.capacity = this.getFieldValue(item, mapping.capacity) || '';
    }
    
    if (mapping.availableCount) {
      charger.availableCount = parseInt(this.getFieldValue(item, mapping.availableCount) || 0);
    }
    
    if (mapping.totalCount) {
      charger.totalCount = parseInt(this.getFieldValue(item, mapping.totalCount) || 0);
    }
    
    if (mapping.description) {
      charger.description = this.getFieldValue(item, mapping.description) || "";
    }
    
    // 处理充电宝依赖字段
    this.processChargerDependencies(charger);
    
    return charger;
  }

  /**
   * 处理充电宝依赖字段
   * @param {Charger} charger - 充电宝对象
   */
  processChargerDependencies(charger) {
    // 充电宝都显示为可用状态，不区分数量
    charger.waitTime = '可用';
    charger.waitUnit = '';
    charger.colorTheme = 'green';
    charger.status = '可用';
    
  }

  /**
   * 处理商店依赖字段
   * @param {Shop} shop - 商店对象
   */
  processShopDependencies(shop) {
    // 获取当前时间
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    
    // 检查商店是否关闭
    if (shop.status === '已关闭') {
      shop.waitTime = '关闭';
      shop.waitUnit = '状态';
      shop.colorTheme = 'gray';
      return;
    }
    
    // 如果既没有开放时间也没有关闭时间，则默认为营业中
    if (!shop.openTime && !shop.closeTime) {
      shop.waitTime = '营业中';
      shop.waitUnit = '';
      shop.colorTheme = 'green';
      console.log(`商店 ${shop.name} 没有营业时间信息，默认设置为营业中`);
      return;
    }
    
    // 解析开放时间和关闭时间
    let openHour = 0, openMinute = 0, closeHour = 23, closeMinute = 59;
    
    if (shop.openTime) {
      const match = shop.openTime.match(/(\d{1,2}):(\d{2})/);
      if (match) {
        openHour = parseInt(match[1], 10);
        openMinute = parseInt(match[2], 10);
      }
    }
    
    if (shop.closeTime) {
      const match = shop.closeTime.match(/(\d{1,2}):(\d{2})/);
      if (match) {
        closeHour = parseInt(match[1], 10);
        closeMinute = parseInt(match[2], 10);
      }
    }
    
    // 判断当前是否在营业时间内
    const currentTimeMinutes = currentHour * 60 + currentMinute;
    const openTimeMinutes = openHour * 60 + openMinute;
    const closeTimeMinutes = closeHour * 60 + closeMinute;
    
    if (currentTimeMinutes < openTimeMinutes) {
      // 还未开放
      const waitMinutes = openTimeMinutes - currentTimeMinutes;
      if (waitMinutes <= 120) {
        // 小于等于2小时，按分钟显示
        shop.waitTime = waitMinutes;
        shop.waitUnit = '分钟后开放';
        shop.colorTheme = 'orange';
      } else {
        // 超过2小时，按小时显示
        const waitHours = Math.floor(waitMinutes / 60);
        shop.waitTime = waitHours;
        shop.waitUnit = '小时后开放';
        shop.colorTheme = 'gray';
      }
    } else if (currentTimeMinutes >= closeTimeMinutes) {
      // 已结束营业
      shop.waitTime = '已结束';
      shop.waitUnit = '营业';
      shop.colorTheme = 'gray';
    } else {
      // 营业中，计算还有多久结束
      const remainingMinutes = closeTimeMinutes - currentTimeMinutes;
      if (remainingMinutes <= 30) {
        shop.waitTime = '即将结束';
        shop.waitUnit = '营业';
        shop.colorTheme = 'orange';
      } else {
        shop.waitTime = '营业中';
        shop.waitUnit = '';
        shop.colorTheme = 'green';
      }
    }
    
    console.log(`商店 ${shop.name} 状态: ${shop.waitTime} ${shop.waitUnit}, 颜色: ${shop.colorTheme}`);
  }

  /**
   * 处理游乐设施依赖字段
   * @param {Attraction} attraction - 游乐设施对象
   */
  processAttractionDependencies(attraction) {
    // 处理等待时间和状态相关逻辑
    if (attraction.status === '已关闭' || attraction.status === '已结束') {
      attraction.waitTime = '关闭';
      attraction.waitUnit = '状态';
    } else if (attraction.queueTime === -1) {
      attraction.waitTime = '关闭';
      attraction.waitUnit = '状态';
    } else if (attraction.status === 'closed' || attraction.waitTime === '关闭') {
      // 优先检查状态字段和waitTime字段，如果已经标记为关闭，保持关闭状态
      attraction.waitTime = '关闭';
      attraction.waitUnit = '状态';
    } else if (attraction.queueTime >= 0) {
      // 检查是否在运营时间内，只有在运营时间内才使用排队时间
      const shouldUseQueueTime = this.shouldUseQueueTime(attraction);
      
      if (shouldUseQueueTime) {
        attraction.waitTime = attraction.queueTime;
        attraction.waitUnit = '分钟';
      } else {
        // 不在运营时间内，按运营时间处理
        this.processAttractionByOperatingTime(attraction);
      }
    } else {
      // 如果没有排队时间数据，检查运营时间
      this.processAttractionByOperatingTime(attraction);
    }
    
    // 添加颜色主题
    attraction.colorTheme = this.getColorTheme(attraction.waitTime, attraction.waitUnit);
  }

  /**
   * 判断是否应该使用排队时间数据
   * @param {Attraction} attraction - 游乐设施对象
   * @returns {boolean} - 是否应该使用排队时间
   */
  shouldUseQueueTime(attraction) {
    // 如果没有运营时间信息，默认使用排队时间
    if (!attraction.openTime && !attraction.closeTime) {
      return true;
    }

    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTimeMinutes = currentHour * 60 + currentMinute;
    
    // 解析运营时间
    let openTimeMinutes = 0;
    let closeTimeMinutes = 23 * 60 + 59;
    
    if (attraction.openTime) {
      const openMatch = attraction.openTime.match(/(\d{1,2}):(\d{2})/);
      if (openMatch) {
        openTimeMinutes = parseInt(openMatch[1]) * 60 + parseInt(openMatch[2]);
      }
    }
    
    if (attraction.closeTime) {
      const closeMatch = attraction.closeTime.match(/(\d{1,2}):(\d{2})/);
      if (closeMatch) {
        closeTimeMinutes = parseInt(closeMatch[1]) * 60 + parseInt(closeMatch[2]);
      }
    }

    // 扩展运营时间范围：开放前1小时到关闭后0小时
    const extendedOpenTime = openTimeMinutes - 60; // 开放前1小时
    const extendedCloseTime = closeTimeMinutes; // 关闭时间

    const shouldUse = currentTimeMinutes >= extendedOpenTime && currentTimeMinutes <= extendedCloseTime;
    
    console.log(`🎢 [排队时间判断] ${attraction.name}:`, {
      当前时间: `${currentHour}:${currentMinute.toString().padStart(2, '0')}`,
      运营时间: `${attraction.openTime}-${attraction.closeTime}`,
      扩展时间范围: `${Math.floor(extendedOpenTime/60)}:${(extendedOpenTime%60).toString().padStart(2, '0')}-${Math.floor(extendedCloseTime/60)}:${(extendedCloseTime%60).toString().padStart(2, '0')}`,
      是否使用排队时间: shouldUse,
      排队时间: attraction.queueTime
    });

    return shouldUse;
  }

  /**
   * 根据运营时间处理游乐设施状态
   * @param {Attraction} attraction - 游乐设施对象
   */
  processAttractionByOperatingTime(attraction) {
    if (attraction.openTime || attraction.closeTime) {
      console.log(`🎢 [运营时间处理] ${attraction.name}:`, {
        openTime: attraction.openTime,
        closeTime: attraction.closeTime,
        status: attraction.status
      });
      
      const now = new Date();
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();
      const currentTimeMinutes = currentHour * 60 + currentMinute;
      
      // 解析运营时间
      let openTimeMinutes = 0;
      let closeTimeMinutes = 23 * 60 + 59;
      
      if (attraction.openTime) {
        const openMatch = attraction.openTime.match(/(\d{1,2}):(\d{2})/);
        if (openMatch) {
          openTimeMinutes = parseInt(openMatch[1]) * 60 + parseInt(openMatch[2]);
        }
      }
      
      if (attraction.closeTime) {
        const closeMatch = attraction.closeTime.match(/(\d{1,2}):(\d{2})/);
        if (closeMatch) {
          closeTimeMinutes = parseInt(closeMatch[1]) * 60 + parseInt(closeMatch[2]);
        }
      }
      
      console.log(`🎢 [运营时间判断] ${attraction.name}:`, {
        当前时间: `${currentHour}:${currentMinute.toString().padStart(2, '0')}`,
        开放时间: attraction.openTime,
        关闭时间: attraction.closeTime,
        当前时间分钟: currentTimeMinutes,
        开放时间分钟: openTimeMinutes,
        关闭时间分钟: closeTimeMinutes
      });
      
      if (currentTimeMinutes < openTimeMinutes) {
        // 还未开放 - 判断是否在游乐场营业时间内
        const waitMinutes = openTimeMinutes - currentTimeMinutes;
        
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
          isParkOpen = currentTimeMinutes >= 8 * 60 && currentTimeMinutes <= 22 * 60;
        }
        
        if (waitMinutes <= 120) {
          // 小于等于2小时，按分钟显示
          attraction.waitTime = waitMinutes;
          // 如果在营业时间内，显示为等待时间；否则显示为"分钟后开放"
          attraction.waitUnit = isParkOpen ? '分钟' : '分钟后开放';
        } else {
          // 超过2小时，按小时显示
          const waitHours = Math.floor(waitMinutes / 60);
          attraction.waitTime = waitHours;
          // 如果在营业时间内，显示为等待时间；否则显示为"小时后开放"
          attraction.waitUnit = isParkOpen ? '小时' : '小时后开放';
        }
      } else if (currentTimeMinutes >= closeTimeMinutes) {
        // 已关闭
        attraction.waitTime = '关闭';
        attraction.waitUnit = '状态';
      } else {
        // 运营中但没有排队数据
        attraction.waitTime = (attraction.status === '开放中') ? '开放中' : '未知';
        attraction.waitUnit = '状态';
      }
    } else {
      // 没有时间信息，使用状态
      attraction.waitTime = (attraction.status === '开放中') ? '开放中' : '未知';
      attraction.waitUnit = '状态';
    }
  }

  /**
   * 处理演出表演依赖字段
   * @param {Performance} performance - 演出表演对象
   */
  processPerformanceDependencies(performance) {
    if (performance.status !== '开放中') {
      performance.waitTime = '关闭';
      performance.waitUnit = '状态';
    } else if (!performance.showTimes || performance.showTimes.length === 0) {
      console.log(`🎭 [演出调试] ${performance.name} 没有场次数据，检查演出时间:`, {
        hasShowTimes: !!performance.showTimes,
        showTimesLength: performance.showTimes?.length,
        openTime: performance.openTime,
        closeTime: performance.closeTime
      });
      
      // 如果有演出时间信息，根据时间判断状态
      if (performance.openTime || performance.closeTime) {
        const now = new Date();
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();
        const currentTimeMinutes = currentHour * 60 + currentMinute;
        
        // 解析演出时间
        let openTimeMinutes = 0;
        let closeTimeMinutes = 23 * 60 + 59;
        
        if (performance.openTime) {
          const openMatch = performance.openTime.match(/(\d{1,2}):(\d{2})/);
          if (openMatch) {
            openTimeMinutes = parseInt(openMatch[1]) * 60 + parseInt(openMatch[2]);
          }
        }
        
        if (performance.closeTime) {
          const closeMatch = performance.closeTime.match(/(\d{1,2}):(\d{2})/);
          if (closeMatch) {
            closeTimeMinutes = parseInt(closeMatch[1]) * 60 + parseInt(closeMatch[2]);
          }
        }
        
        console.log(`🎭 [演出时间判断] ${performance.name}:`, {
          当前时间: `${currentHour}:${currentMinute.toString().padStart(2, '0')}`,
          开放时间: performance.openTime,
          关闭时间: performance.closeTime,
          当前时间分钟: currentTimeMinutes,
          开放时间分钟: openTimeMinutes,
          关闭时间分钟: closeTimeMinutes
        });
        
        if (currentTimeMinutes < openTimeMinutes) {
          // 还未开始 - 判断是否在游乐场营业时间内
          const waitMinutes = openTimeMinutes - currentTimeMinutes;
          
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
            isParkOpen = currentTimeMinutes >= 8 * 60 && currentTimeMinutes <= 22 * 60;
          }
          
          if (waitMinutes <= 120) {
            // 小于等于2小时，按分钟显示
            performance.waitTime = waitMinutes;
            // 如果在营业时间内，显示为等待时间；否则显示为"分钟后开始"
            performance.waitUnit = isParkOpen ? '分钟' : '分钟后开始';
          } else {
            // 超过2小时，按小时显示
            const waitHours = Math.floor(waitMinutes / 60);
            performance.waitTime = waitHours;
            // 如果在营业时间内，显示为等待时间；否则显示为"小时后开始"
            performance.waitUnit = isParkOpen ? '小时' : '小时后开始';
          }
        } else if (currentTimeMinutes >= closeTimeMinutes) {
          // 已结束
          performance.waitTime = '结束';
          performance.waitUnit = '';
        } else {
          // 进行中
          performance.waitTime = '常驻';
          performance.waitUnit = '演出';
        }
      } else {
        // 没有时间信息，默认为常驻
        performance.waitTime = '常驻';
        performance.waitUnit = '演出';
      }
    } else {
      const now = new Date();
      try {
        // 查找下一场演出，确保每个时间都是有效的
        const validShowTimes = performance.showTimes.filter(show => {
          if (!show || !show.time) return false;
          
          try {
            let showTime;
            const timeString = show.time;
            
            // 简化时间处理，只处理HH:MM格式，假设都是今天的场次
            if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(timeString)) {
              const [hours, minutes] = timeString.split(':').map(num => parseInt(num, 10));
              
              // 创建时间对象用于比较
              showTime = new Date();
              showTime.setHours(hours, minutes, 0, 0);
              
              // 简化日志
              console.log(`演出 ${performance.name} 场次: ${timeString}, 当前时间: ${now.getHours()}:${now.getMinutes()}`);
            } else {
              console.warn(`演出 ${performance.name} 的场次时间格式不支持: ${timeString}`);
              return false;
            }
            
            // 保存解析后时间供后续使用
            show._parsedTime = showTime;
            
            // 增加时间缓冲，避免边界时间的不稳定
            // 如果距离演出开始还有1分钟以上，才认为是未来场次
            const timeDiffMinutes = Math.floor((showTime - now) / (1000 * 60));
            return timeDiffMinutes >= 1;
          } catch (err) {
            console.warn(`演出 ${performance.name} 解析场次时间出错: ${err.message}`);
            return false;
          }
        });
        
        console.log(`演出 ${performance.name} 今日剩余场次数量: ${validShowTimes.length}`);
        
        if (validShowTimes.length > 0) {
          // 按时间排序，找出最近的一场
          validShowTimes.sort((a, b) => a._parsedTime - b._parsedTime);
          const nextShow = validShowTimes[0];
          
          // 计算等待时间（分钟）- 增加精度和稳定性
          const timeDiff = Math.max(1, Math.floor((nextShow._parsedTime - now) / (1000 * 60)));
          performance.waitTime = timeDiff;
          performance.waitUnit = '分钟';
          console.log(`演出 ${performance.name} 下一场: ${nextShow.time}, 等待: ${timeDiff}分钟`);
        } else {
          // 检查是否有今天已结束的场次
          const pastShows = performance.showTimes.filter(show => {
            if (!show || !show.time) return false;
            
            try {
              const timeString = show.time;
              if (!/^\d{1,2}:\d{2}(:\d{2})?$/.test(timeString)) return false;
              
              const [hours, minutes] = timeString.split(':').map(num => parseInt(num, 10));
              const showTime = new Date();
              showTime.setHours(hours, minutes, 0, 0);
              
              // 保存解析后的时间
              show._parsedTime = showTime;
              return true;
            } catch (err) {
              return false;
            }
          });
          
          if (pastShows.length > 0) {
            // 所有今天的演出场次
            pastShows.sort((a, b) => b._parsedTime - a._parsedTime);
            
            // 检查是否所有场次都已结束
            const allEnded = pastShows.every(show => show._parsedTime < now);
            
            if (allEnded) {
              performance.waitTime = '已结束';
              performance.waitUnit = '';
              console.log(`演出 ${performance.name} 今日场次已全部结束`);
            } else {
              // 如果有未结束场次但不在validShowTimes中，说明都已满
              performance.waitTime = '已满';
              performance.waitUnit = '';
              console.log(`演出 ${performance.name} 今日场次已满`);
            }
          } else {
            // 没有任何有效场次
            performance.waitTime = '无场次';
            performance.waitUnit = '';
            console.log(`演出 ${performance.name} 无有效场次`);
          }
        }
      } catch (error) {
        console.error(`计算演出等待时间失败 [${performance.name}]:`, error);
        performance.waitTime = '数据错误';
        performance.waitUnit = '';
      }
    }
    
    // 添加颜色主题
    performance.colorTheme = this.getColorTheme(performance.waitTime, performance.waitUnit);
  }

  /**
   * 根据等待时间获取颜色主题
   * @param {string|number} waitTime - 等待时间
   * @param {string} waitUnit - 等待时间单位
   * @returns {string} - 颜色主题
   */
  getColorTheme(waitTime, waitUnit) {
    if (waitTime === '关闭' || waitTime === '已结束' || waitTime === '结束') {
      return 'gray';
    }
    if (waitTime === '常驻') {
      return 'green';
    }
    
    // 处理"xx后开始"和"xx后开放"的情况
    if (waitUnit === '分钟后开始' || waitUnit === '分钟后开放') {
      // 分钟级别的等待，显示橙色
      return 'orange';
    }
    if (waitUnit === '小时后开始' || waitUnit === '小时后开放') {
      // 小时级别的等待，根据小时数判断
      if (typeof waitTime === 'number') {
        if (waitTime <= 2) {
          return 'orange'; // 2小时内显示橙色
        } else {
          return 'gray';   // 超过2小时显示灰色，表示太久了
        }
      }
      return 'gray'; // 默认灰色
    }
    
    if (waitUnit === '分钟' && typeof waitTime === 'number') {
      if (waitTime < 30) {
        return 'green';
      } else if (waitTime < 60) {
        return 'orange';
      } else {
        return 'red';
      }
    }
    return 'gray'; // 默认返回灰色
  }
  
  /**
   * 处理补充信息
   * @param {Array} itemInstances - 项目实例列表
   * @param {Array} otherInfoItems - 补充信息列表
   */
  processOtherInfo(itemInstances, otherInfoItems) {
    console.log(`🔍 [补充信息] 开始处理补充信息:`, {
      项目实例数量: itemInstances.length,
      补充信息数量: otherInfoItems?.length || 0,
      补充信息类型: typeof otherInfoItems,
      补充信息是否为数组: Array.isArray(otherInfoItems),
      补充信息内容: otherInfoItems
    });
    
    if (!otherInfoItems || !Array.isArray(otherInfoItems) || otherInfoItems.length === 0) {
      console.log(`🔍 [补充信息] 没有补充信息数据，跳过处理`, {
        otherInfoItems存在: !!otherInfoItems,
        是数组: Array.isArray(otherInfoItems),
        长度: otherInfoItems?.length,
        实际值: otherInfoItems
      });
      return;
    }
    
    const { calculateSimilarity } = require('./utils');
    
    otherInfoItems.forEach((item, index) => {
      const itemName = this.getFieldValue(item, defaultFieldMapping.otherInfo.name);
      console.log(`🔍 [补充信息] 处理第${index + 1}个补充信息:`, {
        原始数据: item,
        提取的名称: itemName,
        映射字段: defaultFieldMapping.otherInfo.name,
        数据字段列表: Object.keys(item)
      });
      
      if (!itemName) {
        console.log(`🔍 [补充信息] 第${index + 1}个补充信息没有有效名称，跳过`);
        return;
      }
      
      let targetItem = null;
      let highestSimilarity = 0;
      
      itemInstances.forEach(instance => {
        if (!instance.name) return;
        if (instance.type !== 'attraction' && instance.type !== 'performance') return;
        
        const similarity = calculateSimilarity(instance.name, itemName);
        if (similarity > highestSimilarity) {
          highestSimilarity = similarity;
          targetItem = instance;
        }
      });
      
      if (highestSimilarity >= 0.3 && targetItem) {
        console.log(`🔍 [补充信息] 匹配成功: ${itemName} -> ${targetItem.name} (相似度: ${highestSimilarity.toFixed(2)})`);
        
        const summary = this.getFieldValue(item, defaultFieldMapping.otherInfo.summary) || '';
        const detail = this.getFieldValue(item, defaultFieldMapping.otherInfo.detail) || '';
        const duration = this.getFieldValue(item, defaultFieldMapping.otherInfo.duration) || '';
        const showTimesData = this.getFieldValue(item, defaultFieldMapping.otherInfo.showTimes);
        
        console.log(`🔍 [补充信息] 提取的补充信息:`, {
          summary: summary,
          detail: detail,
          duration: duration,
          showTimesData: showTimesData,
          summaryField: defaultFieldMapping.otherInfo.summary,
          detailField: defaultFieldMapping.otherInfo.detail,
          durationField: defaultFieldMapping.otherInfo.duration,
          showTimesField: defaultFieldMapping.otherInfo.showTimes,
          原始数据中的summary: item[defaultFieldMapping.otherInfo.summary],
          原始数据中的detail: item[defaultFieldMapping.otherInfo.detail],
          原始数据中的duration: item[defaultFieldMapping.otherInfo.duration]
        });
        
        targetItem.summary = summary;
        targetItem.detail = detail;
        targetItem.duration = duration;
        
        // 处理演出场次数据
        if (showTimesData && targetItem.type === 'performance') {
          console.log(`🔍 [补充信息] 处理演出场次数据:`, {
            原始数据: showTimesData,
            数据类型: typeof showTimesData,
            是否数组: Array.isArray(showTimesData)
          });
          
          // 使用演出场次映射器处理数据
          const showTimesMapper = this.getDefaultShowTimesMapper();
          const processedShowTimes = showTimesMapper(showTimesData);
          
          console.log(`🔍 [补充信息] 演出场次处理结果:`, {
            处理后数据: processedShowTimes,
            场次数量: processedShowTimes.length
          });
          
          targetItem.showTimes = processedShowTimes;
        }
        
        const flags = this.getFieldValue(item, defaultFieldMapping.otherInfo.flags);
        if (flags) {
          targetItem.flags = flags.split('#').filter(tag => tag.trim());
          console.log(`🔍 [补充信息] 提取的flags:`, targetItem.flags);
        }
        
        const suggestedQueries = this.getFieldValue(item, defaultFieldMapping.otherInfo.suggestedQueries);
        if (suggestedQueries) {
          targetItem.suggestedQueries = suggestedQueries.split('#').filter(query => query.trim());
          console.log(`🔍 [补充信息] 提取的suggestedQueries:`, targetItem.suggestedQueries);
        }
        
        // 处理通知信息字段
        const notification = this.getFieldValue(item, defaultFieldMapping.otherInfo.notification);
        console.log(`🔔 [补充信息通知调试] 项目 ${targetItem.name}:`, {
          通知信息字段名: defaultFieldMapping.otherInfo.notification,
          原始数据中的通知信息: item[defaultFieldMapping.otherInfo.notification],
          提取的通知信息: notification,
          补充信息原始数据: item
        });
        if (notification) {
          targetItem.notification = notification;
          console.log(`🔍 [补充信息] 成功设置通知信息:`, targetItem.notification);
        } else {
          console.log(`🔍 [补充信息] 未找到通知信息`);
        }
        
        console.log(`🔍 [补充信息] ${targetItem.name} 补充信息合并完成`);
      } else {
        console.log(`🔍 [补充信息] 未找到匹配项目: ${itemName} (最高相似度: ${highestSimilarity.toFixed(2)})`);
      }
    });
  }

  /**
   * 处理API数据
   * @param {Object} apiData - API返回的数据
   * @returns {Array} - 处理后的项目列表
   */
  processApiData(apiData) {
    console.log('开始处理API数据');
    console.log('API数据类型:', Object.keys(apiData));
    
    if (!apiData) {
      console.warn('API数据为空');
      return [];
    }

    try {
      const itemInstances = [];
      let otherInfoItems = [];
      
      // 遍历数据类型
      console.log(`🔍 [API数据结构] 所有数据类型:`, Object.keys(apiData));
      Object.keys(apiData).forEach(type => {
        // 跳过商店和餐厅数据
        if (type === 'shop' || type === 'shops' /*|| type === 'restaurant' || type === 'restaurants'*/) {
          console.log(`暂时屏蔽 ${type} 类型数据的加载`);
          return;
        }
        
        const items = apiData[type];
        
        // 跳过空数据
        if (!items) {
          console.log(`类型 ${type} 的数据为空`);
          return;
        }
        
        // 获取要处理的数据数组
        let dataArray = items;
        
        // 如果是包含data字段的对象，使用data字段的值
        if (!Array.isArray(items) && items.data && Array.isArray(items.data)) {
          dataArray = items.data;
          console.log(`类型 ${type} 的数据在 data 字段中，长度: ${dataArray.length}`);
        }
        
        // 如果不是数组，跳过处理
        if (!Array.isArray(dataArray)) {
          console.log(`类型 ${type} 的数据不是数组，无法处理`);
          return;
        }
        
        console.log(`处理数据类型: ${type}, 数据长度: ${dataArray.length}, 游乐场ID: ${this.parkId}`);
        
        // 如果是补充信息，先保存起来，最后统一处理
        if (type === 'otherInfo' || type === 'other_info' || type === 'basicInfo' || type === 'basic_info' || type.toLowerCase().includes('info')) {
          console.log(`🔍 [补充信息识别] 发现可能的补充信息类型: ${type}，数据长度: ${dataArray.length}`);
          if (dataArray.length > 0) {
            console.log(`🔍 [补充信息识别] ${type} 样本数据:`, dataArray[0]);
          }
          otherInfoItems = dataArray;
          return;
        }
        
        // 样本数据：打印第一条记录的关键字段，帮助分析
        if (dataArray.length > 0) {
          const sampleItem = dataArray[0];
          console.log(`${type} 样本数据:`, {
            id: sampleItem.id,
            name: sampleItem.name || sampleItem['项目名称'] || sampleItem['演出名称'] || sampleItem['名称'],
            type: sampleItem['项目类型'],
            status: sampleItem['项目状态'],
            isClosed: sampleItem['是否关闭']
          });
        }
        
        // 处理每个项目
        dataArray.forEach(item => {
          try {
            if (!item) return;
            
            let instance = null;
            
            // 根据类型创建不同的实例
            const baseType = type.endsWith('s') ? type.slice(0, -1) : type;
            console.log(`处理项目类型: ${type} -> 基础类型: ${baseType}`);
            
            switch (baseType) {
              case 'attraction':
                instance = this.createAttraction(item, type);
                break;
              case 'performance':
                instance = this.createPerformance(item, type);
                break;
              case 'restaurant':
                instance = this.createRestaurant(item, type);
                break;
              case 'restroom':
                instance = this.createRestroom(item, type);
                break;
              case 'shop':
                instance = this.createShop(item, type);
                break;
              case 'charger':
                instance = this.createCharger(item, type);
                break;
              default:
                console.warn(`未知的数据类型: ${type}，跳过处理`);
            }
            
            if (instance) {
              itemInstances.push(instance);
            }
          } catch (error) {
            console.error(`处理项目时发生错误 [${type}]:`, error);
          }
        });
      });
      
      // 处理补充信息，将其合并到项目实例中
      if (otherInfoItems.length > 0) {
        console.log(`处理补充信息，合并到项目实例中，补充信息数量: ${otherInfoItems.length}`);
        try {
          this.processOtherInfo(itemInstances, otherInfoItems);
        } catch (error) {
          console.error(`处理补充信息时发生错误:`, error);
        }
      }
      
      console.log('数据处理完成，生成项目实例数量:', itemInstances.length);
      return itemInstances;
    } catch (error) {
      console.error('处理API数据时发生错误:', error);
      return [];
    }
  }
}

// 游乐场特定的适配器类
class UniversalParkAdapter extends ParkDataAdapter {
  constructor() {
    super('universal');
  }
  
  /**
   * 提供特定于环球影城的映射规则
   * @returns {Object} - 环球影城特定的映射配置
   */
  getParkSpecificMapping() {
    return {
      attraction: {
        // 只保留不同于默认配置的部分
        latitude: '纬度',
        longitude: '经度',
        statusMapper: (value) => {
          const statusMap = {
            '0': '开放中',
            '1': '已关闭',
          };
          return statusMap[value] || '未知状态';
        },
        isIndoorMapper: this.getDefaultIndoorMapper(),
        hasExpressMapper: this.getDefaultExpressMapper(),
        openTimeMapper: this.getDefaultOpenTimeMapper(),
        typeMapper: (value) => {
          const typeMap = {
            'scenic': 'attraction',
            'ride': 'attraction',
            'perform': 'performance'
          };
          return typeMap[value] || 'attraction';
        }
      },
      performance: {
        // 只保留不同于默认配置的部分
        latitude: '纬度',
        longitude: '经度',
        status: '项目状态',
        statusMapper: (value) => {
          // 先检查布尔值类型的"是否关闭"
          if (value === false) {
            return '开放中';  // false表示"不是关闭的"，即"开放中"
          } else if (value === true) {
            return '已关闭';  // true表示"是关闭的"
          }
          
          // 然后检查数字或字符串格式
          if (value === 0 || value === '0' || value === '开放中') {
            return '开放中';
          } else if (value === 1 || value === '1' || value === '关闭中') {
            return '已关闭';
          }
          
          // 默认情况
          return '未知状态';
        },
        isIndoorMapper: this.getDefaultIndoorMapper(),
        hasExpressMapper: this.getDefaultExpressMapper(),
        openTimeMapper: this.getDefaultOpenTimeMapper(),
        showTimesMapper: this.getDefaultShowTimesMapper()
      },
      restaurant: {
        latitude: '纬度',
        longitude: '经度',
        openTime: '开放时间',
        closeTime: '关闭时间',
        status: '项目状态',
        additionalInfo: '附加信息',
        products: '产品列表',
        description: '描述',
        statusMapper: (value) => {
          // 处理为空的情况
          if (value === undefined || value === null || value === '') {
            return '开放中'; // 默认为开放中
          }
          
          // 处理数字或字符串格式
          if (value === 0 || value === '0' || value === '开放中') {
            return '开放中';
          } else if (value === 1 || value === '1' || value === '关闭中') {
            return '已关闭';
          }
          
          return value || '开放中';
        },
        openTimeMapper: (value) => {
          console.log(`Universal餐厅开放时间映射器: 原始值=${value}`);
          if (!value || value === '') {
            return '';
          }
          // 如果包含连字符，表示已经是格式化的时间段
          if (typeof value === 'string' && value.includes('-')) {
            return value;
          }
          return value;
        }
      }
    };
  }
}

class DisneyParkAdapter extends ParkDataAdapter {
  constructor() {
    super('disney');
    console.log('创建迪士尼适配器');
  }
  
  /**
   * 提供特定于迪士尼的映射规则
   * @returns {Object} - 迪士尼特定的映射配置
   */
  getParkSpecificMapping() {
    console.log('加载迪士尼特定映射规则');
    const mapping = {
      attraction: {
        // 只保留不同于默认配置的部分
        latitude: 'latitude',
        longitude: 'longitude',
        statusMapper: (value) => {
          // 处理布尔值类型的"是否关闭"
          if (value === false || value === 0) {
            return '开放中';  // false表示"不是关闭的"，即"开放中"
          } else if (value === true || value === 1) {
            return '已关闭';  // true表示"是关闭的"
          }
          // 原有的字符串类型处理
          return value === 'OPEN' ? '开放中' : '已关闭';
        },
        isIndoorMapper: this.getDefaultIndoorMapper(),
        hasExpressMapper: this.getDefaultExpressMapper(),
        openTimeMapper: this.getDefaultOpenTimeMapper()
      },
      performance: {
        // 只保留不同于默认配置的部分
        latitude: 'latitude',
        longitude: 'longitude',
        statusMapper: (value) => {
          // 处理布尔值类型的"是否关闭"
          if (value === false || value === 0) {
            return '开放中';  // false表示"不是关闭的"，即"开放中"
          } else if (value === true || value === 1) {
            return '已关闭';  // true表示"是关闭的"
          }
          // 原有的字符串类型处理
          return value === 'OPEN' ? '开放中' : '已关闭';
        },
        isIndoorMapper: this.getDefaultIndoorMapper(),
        hasExpressMapper: this.getDefaultExpressMapper(),
        openTimeMapper: this.getDefaultOpenTimeMapper(),
        showTimesMapper: this.getDefaultShowTimesMapper()
      },
      restaurant: {
        latitude: 'latitude',
        longitude: 'longitude',
        openTime: '开放时间',
        closeTime: '关闭时间',
        status: '项目状态',
        additionalInfo: '附加信息',
        products: '产品列表',
        description: '描述',
        statusMapper: (value) => {
          // 处理布尔值类型的"是否关闭"
          if (value === false || value === 0) {
            return '开放中';  // false表示"不是关闭的"，即"开放中"
          } else if (value === true || value === 1) {
            return '已关闭';  // true表示"是关闭的"
          }
          // 原有的字符串类型处理
          return value === 'OPEN' ? '开放中' : '已关闭';
        },
        openTimeMapper: this.getDefaultOpenTimeMapper()
      }
    };
    console.log('迪士尼映射规则:', {
      attractions: Object.keys(mapping.attraction),
      performances: Object.keys(mapping.performance),
      restaurants: Object.keys(mapping.restaurant)
    });
    return mapping;
  }
}

class ChimelongParkAdapter extends ParkDataAdapter {
  constructor() {
    super('chimelong');
  }
  
  /**
   * 提供特定于长隆的映射规则
   * @returns {Object} - 长隆特定的映射配置
   */
  getParkSpecificMapping() {
    return {
      attraction: {
        // 只保留不同于默认配置的部分
        latitude: 'latitude',
        longitude: 'longitude',
        statusMapper: (value) => value === '营业中' ? '开放中' : '已关闭',
        isIndoorMapper: this.getDefaultIndoorMapper(),
        hasExpressMapper: this.getDefaultExpressMapper(),
        openTimeMapper: this.getDefaultOpenTimeMapper()
      },
      performance: {
        // 只保留不同于默认配置的部分
        latitude: 'latitude',
        longitude: 'longitude',
        statusMapper: (value) => value === '营业中' ? '开放中' : '已关闭',
        isIndoorMapper: this.getDefaultIndoorMapper(),
        hasExpressMapper: this.getDefaultExpressMapper(),
        openTimeMapper: this.getDefaultOpenTimeMapper(),
        showTimesMapper: this.getDefaultShowTimesMapper()
      },
      restaurant: {
        name: '名称',
        image: '图片',
        location: '餐厅位置',
        latitude: '纬度',
        longitude: '经度',
        openTime: '营业时间',
        closeTime: '关闭时间',
        status: '项目状态',
        additionalInfo: '附加信息',
        products: '产品列表',
        description: '描述',
        statusMapper: (value) => {
          // 处理为空的情况
          if (value === undefined || value === null || value === '') {
            return '开放中'; // 默认为开放中
          }
          
          // 处理长隆特有的状态值
          if (value === '营业中' || value === '开放中') {
            return '开放中';
          } else if (value === '关闭中' || value === '已关闭') {
            return '已关闭';
          }
          
          return value || '开放中';
        },
        openTimeMapper: this.getDefaultOpenTimeMapper()
      }
    };
  }
}

// 工厂函数
function createParkAdapter(parkId) {
  switch (parkId) {
    case 'universal':
      return new UniversalParkAdapter();
    case 'disney':
      return new DisneyParkAdapter();
    case 'chimelong':
      return new ChimelongParkAdapter();
    default:
      throw new Error(`未知的游乐场ID: ${parkId}`);
  }
}

module.exports = {
  createParkAdapter,
  ParkItem,
  Attraction,
  Performance,
  Restaurant,
  Shop,
  Charger
}; 