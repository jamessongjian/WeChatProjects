const { fetchParkData, fetchItemOtherInfo } = require('./api');
const { createParkAdapter } = require('./dataAdapter');

// 游乐场名称到ID的映射
const parkNameToId = {
  '北京环球影城': 'universal',
  '北京环球影城度假区': 'universal',
  '上海迪士尼': 'disney',
  '上海迪士尼乐园': 'disney',
  '广州长隆': 'chimelong',
  '广州长隆欢乐世界': 'chimelong'
};

// ID到游乐场名称的映射(用于API请求)
const parkIdToName = {
  'universal': '北京环球影城',
  'disney': '上海迪士尼',
  'chimelong': '广州长隆欢乐世界'
};

// 处理游乐场数据
const processParkData = (parkId, apiData, globalData) => {
  // 初始化游乐场数据
  initParkData(globalData);
  
  try {
    // 使用数据适配器处理API数据
    const adapter = createParkAdapter(parkId);
    const allItems = adapter.processApiData(apiData);
    
    // 保存所有项目到全局变量
    globalData.allItems[parkId] = allItems;
    globalData.parkData[parkId] = allItems;

    return allItems;
  } catch (error) {
    console.error('【数据处理】失败:', error.message);
    throw error;
  }
};

// 初始化游乐场数据
const initParkData = (globalData) => {
  // 确保currentParkId有默认值
  if (!globalData.currentParkId) {
    globalData.currentParkId = 'universal'; // 设置默认游乐场
    console.log('currentParkId未设置，使用默认值:', globalData.currentParkId);
  }
  
  const parkId = globalData.currentParkId;
  console.log('初始化游乐场数据，parkId:', parkId);
  
  // 确保基础数据结构存在
  if (!globalData.favorites) {
    globalData.favorites = {};
  }
  if (!globalData.parkData) {
    globalData.parkData = {};
  }
  if (!globalData.allItems) {
    globalData.allItems = {};
  }
  
  // 为当前游乐场初始化数据
  if (!globalData.favorites[parkId]) {
    globalData.favorites[parkId] = [];
  }
  if (!globalData.parkData[parkId]) {
    globalData.parkData[parkId] = [];
  }
  if (!globalData.allItems[parkId]) {
    globalData.allItems[parkId] = [];
  }
  
  console.log('游乐场数据初始化完成，当前parkId:', parkId);
};

// 获取游乐场数据
const getParkData = async (parkId, token) => {
  try {
    // 确保 parkId 是有效的 ID 而不是名称
    let actualParkId = parkId;
    if (!parkIdToName[parkId]) {
      actualParkId = parkNameToId[parkId];
      if (!actualParkId) {
        throw new Error(`未知的游乐场名称或ID: ${parkId}`);
      }
    }
    
    const parkName = parkIdToName[actualParkId];
    console.log('【数据加载】开始获取', parkName, '数据');
    
    // 获取主要API数据
    const apiData = await fetchParkData(actualParkId, token);
    
    // 记录数据量
    const totalItems = Object.keys(apiData || {}).reduce((sum, key) => {
      const count = apiData[key]?.data?.length || (Array.isArray(apiData[key]) ? apiData[key].length : 0);
      return sum + count;
    }, 0);
    console.log('【数据加载】获取到', totalItems, '个项目');
    
    // 处理数据
    const allItems = processParkData(actualParkId, apiData, getApp().globalData);
    
    // 获取并处理补充信息
    try {
      console.log(`【补充信息】开始获取 ${actualParkId} 的补充信息`);
      const otherInfoData = await fetchItemOtherInfo(actualParkId, token);
      
      console.log(`【补充信息】获取结果:`, {
        数据类型: typeof otherInfoData,
        是否为数组: Array.isArray(otherInfoData),
        数据长度: Array.isArray(otherInfoData) ? otherInfoData.length : '非数组',
        数据内容: otherInfoData
      });
      
      if (otherInfoData && Array.isArray(otherInfoData) && otherInfoData.length > 0) {
        const adapter = createParkAdapter(actualParkId);
        if (adapter && typeof adapter.processOtherInfo === 'function') {
          console.log('【补充信息】处理', otherInfoData.length, '条补充信息');
          adapter.processOtherInfo(allItems, otherInfoData);
        } else {
          console.warn('【补充信息】未找到适配器或processOtherInfo方法');
        }
      } else {
        console.log('【补充信息】没有可用的补充信息数据');
      }
    } catch (error) {
      console.warn('【补充信息】获取失败:', error.message);
      console.error('【补充信息】错误详情:', error);
    }
    
    if (allItems && Array.isArray(allItems) && allItems.length > 0) {
      console.log('【数据加载】处理完成，共', allItems.length, '个项目');
    } else {
      console.warn('【数据加载】没有获取到有效的项目数据');
    }
    
    return allItems;
  } catch (error) {
    console.error('【数据加载】失败:', error.message);
    throw error;
  }
};

module.exports = {
  processParkData,
  initParkData,
  getParkData,
  parkIdToName,
  parkNameToId
}; 