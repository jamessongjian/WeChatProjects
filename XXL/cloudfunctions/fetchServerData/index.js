// 云函数入口文件 - 统一的服务端数据获取
const cloud = require('wx-server-sdk');
const axios = require('axios');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

// 服务端配置（敏感信息在云端管理）
const SERVER_CONFIG = {
  baseUrl: 'https://doctorj.com.cn/',
  apiEndpoints: {
    subscription: '/api/wechat/subscription',
    allInfo: '/api/global/all-info'
  }
};

// 游乐场API配置（敏感信息在云端管理）
const PARK_CONFIGS = {
  'universal': {
    id: 'universal',
    name: '北京环球影城度假区',
    apiEndpoint: 'https://doctorj.com.cn/api/bjuniversal',
    apiConfig: {
      attraction: {
        path: '/attractions',
        enabled: true
      },
      performance: {
        path: '/performances', 
        enabled: true
      },
      restaurant: {
        path: '/restaurants',
        enabled: true
      },
      shop: {
        path: '/shops',
        enabled: false // 暂时关闭
      },
      restroom: {
        path: '/restrooms',
        enabled: true
      },
      charger: {
        path: '/power-banks',
        enabled: true
      },
      otherInfo: {
        path: '/item-other-info',
        enabled: true,
        responseMapping: {
          data: 'data'
        }
      }
    }
  },
  'disney': {
    id: 'disney',
    name: '上海迪士尼乐园',
    apiEndpoint: 'https://doctorj.com.cn/api/shdisney',
    apiConfig: {
      attraction: {
        path: '/attractions',
        enabled: true
      },
      performance: {
        path: '/performances',
        enabled: true
      },
      restaurant: {
        path: '/restaurants',
        enabled: true
      },
      shop: {
        path: '/shops',
        enabled: false // 暂时关闭
      },
      restroom: {
        path: '/restrooms',
        enabled: true
      },
      charger: {
        path: '/power-banks',
        enabled: true
      },
      otherInfo: {
        path: '/item-other-info',
        enabled: true,
        responseMapping: {
          data: 'data'
        }
      }
    }
  },
  'chimelong': {
    id: 'chimelong',
    name: '广州长隆欢乐世界',
    apiEndpoint: 'https://doctorj.com.cn/api/chimelong',
    apiConfig: {
      attraction: {
        path: '/attractions',
        enabled: true
      },
      performance: {
        path: '/performances',
        enabled: true
      },
      restaurant: {
        path: '/restaurants',
        enabled: true
      },
      shops: {
        path: '/shops',
        enabled: true // 长隆的商店是启用的
      },
      otherInfo: {
        path: '/item-other-info',
        enabled: true,
        responseMapping: {
          data: 'data'
        }
      }
    }
  }
};

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  
  console.log('fetchServerData 云函数调用，openid:', openid, 'event:', event);
  
  try {
    const { action, ...params } = event;
    
    if (!action) {
      return {
        success: false,
        error: '缺少action参数'
      };
    }
    
    // 根据action调用相应的处理函数
    switch (action) {
      case 'getParkData':
        return await handleGetParkData(params);
      case 'getItemOtherInfo':
        return await handleGetItemOtherInfo(params);
      case 'getServerConfig':
        return await handleGetServerConfig(params);
      case 'submitSubscription':
        return await handleSubmitSubscription(params);
      case 'getUserSubscriptions':
        return await handleGetUserSubscriptions(params);
      case 'getAttractionHistory':
        return await handleGetAttractionHistory(params);
      case 'getAttractionWaitTimes':
        return await handleGetAttractionWaitTimes(params);
      case 'getPerformanceSchedules':
        return await handleGetPerformanceSchedules(params);
      default:
        return {
          success: false,
          error: `未知的action: ${action}`
        };
    }
  } catch (error) {
    console.error('fetchServerData 云函数执行失败:', error);
    return {
      success: false,
      error: error.message || '服务器内部错误',
      errorDetail: JSON.stringify(error.message || error)
    };
  }
};

// 处理获取游乐场数据
async function handleGetParkData({ parkId, token }) {
  if (!parkId) {
    return {
      success: false,
      error: '缺少游乐场ID参数'
    };
  }
  
  // 如果没有token，使用默认token或空字符串（某些API可能不需要认证）
  if (!token) {
    console.log(`${parkId} 没有提供token，使用默认处理`);
    token = ''; // 使用空token，让API服务器决定是否需要认证
  }
  
  // 获取游乐场配置
  const parkConfig = PARK_CONFIGS[parkId];
  if (!parkConfig) {
    return {
      success: false,
      error: `未找到游乐场配置: ${parkId}`
    };
  }
  
  console.log(`【云函数调试】开始获取 ${parkId} 的所有数据类型`);
  console.log(`【云函数调试】游乐场配置:`, parkConfig);
  console.log(`【云函数调试】token状态:`, token ? '已提供' : '未提供');
  
  // 准备请求
  const requests = [];
  const requestTypes = [];
  
  // 遍历所有API配置，处理所有启用的数据类型
  Object.keys(parkConfig.apiConfig).forEach(configKey => {
    const config = parkConfig.apiConfig[configKey];
    
    // 跳过没有path或未启用的配置
    if (!config.path || config.enabled === false) {
      console.log(`跳过 ${configKey}：${!config.path ? '没有路径' : '未启用'}`);
      return;
    }
    
    // otherInfo 也一起获取，方便数据适配器处理
    // if (configKey === 'otherInfo') {
    //   return;
    // }
    
    console.log(`【云函数调试】添加 ${configKey} 请求: ${config.path}`);
    
    const apiUrl = `${parkConfig.apiEndpoint}${config.path}`;
    console.log(`【云函数调试】完整API URL: ${apiUrl}`);
    
    // 准备请求头
    const headers = {
      'Content-Type': 'application/json'
    };
    
    // 只有当token不为空时才添加Authorization header
    if (token && token.trim() !== '') {
      headers['Authorization'] = `Bearer ${token}`;
      console.log(`【云函数调试】使用token认证`);
    } else {
      console.log(`【云函数调试】无token，使用匿名访问`);
    }
    
    console.log(`【云函数调试】请求头:`, headers);
    
    requests.push(
      axios.get(apiUrl, {
        headers: headers,
        timeout: 8000 // 减少到8秒超时，配合分批处理
      })
    );
    requestTypes.push(configKey);
  });
  
  if (requests.length === 0) {
    return {
      success: false,
      error: '没有可用的API配置'
    };
  }
  
  // 分批处理请求以避免超时，每批最多3个请求
  const batchSize = 3;
  const responseData = {};
  
  for (let i = 0; i < requests.length; i += batchSize) {
    const batchRequests = requests.slice(i, i + batchSize);
    const batchTypes = requestTypes.slice(i, i + batchSize);
    
    console.log(`处理第${Math.floor(i/batchSize) + 1}批请求，包含: ${batchTypes.join(', ')}`);
    
    try {
      // 为每批请求设置较短的超时时间
      const results = await Promise.allSettled(batchRequests);
      
      // 处理当前批次的结果
      results.forEach((result, index) => {
        const type = batchTypes[index];
        
        if (result.status === 'fulfilled') {
          const response = result.value;
          console.log(`【云函数调试】${type} API响应状态:`, response.status);
          console.log(`【云函数调试】${type} API响应数据结构:`, {
            hasData: !!response.data,
            code: response.data?.code,
            dataType: typeof response.data?.data,
            dataLength: Array.isArray(response.data?.data) ? response.data.data.length : 'not array'
          });
          
          if (response.status === 200 && response.data) {
            if (response.data.code === 0) {
              const apiDataArray = response.data.data || [];
              responseData[type] = apiDataArray;
              console.log(`【云函数调试】${type} 成功获取数据，数量:`, apiDataArray.length);
              
              // 打印前2个数据样本
              if (apiDataArray.length > 0) {
                console.log(`【云函数调试】${type} 数据样本:`, apiDataArray.slice(0, 2));
              }
            } else {
              console.warn(`${type} API返回错误:`, response.data);
              responseData[type] = [];
            }
          } else {
            console.warn(`${type} API响应异常:`, response.status, response.data);
            responseData[type] = [];
          }
        } else {
          console.error(`${type} API请求失败:`, result.reason?.message || result.reason);
          responseData[type] = [];
        }
      });
      
      // 批次间稍作延迟，避免服务器压力过大
      if (i + batchSize < requests.length) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      
    } catch (error) {
      console.error(`第${Math.floor(i/batchSize) + 1}批请求处理失败:`, error);
      // 为失败的批次设置空数据
      batchTypes.forEach(type => {
        responseData[type] = [];
      });
    }
  }
  
  // 记录获取的数据统计
  const dataStats = {};
  Object.keys(responseData).forEach(type => {
    dataStats[type] = responseData[type].length;
  });
  console.log(`${parkId} 数据获取完成:`, dataStats);
  console.log(`${parkId} 返回数据结构:`, {
    '数据键': Object.keys(responseData),
    '详细统计': dataStats,
    '样本数据': Object.keys(responseData).reduce((sample, key) => {
      sample[key] = responseData[key].slice(0, 1); // 只取第一个数据作为样本
      return sample;
    }, {})
  });
  
  return {
    success: true,
    data: responseData,
    parkId: parkId,
    timestamp: new Date().toISOString()
  };
}

// 处理获取项目补充信息
async function handleGetItemOtherInfo({ parkId, token }) {
  if (!parkId) {
    return {
      success: false,
      error: '缺少游乐场ID参数'
    };
  }
  
  // 如果没有token，使用默认处理
  if (!token) {
    console.log(`${parkId} 获取补充信息没有提供token，使用默认处理`);
    token = ''; // 使用空token，让API服务器决定是否需要认证
  }
  
  // 获取游乐场配置
  const parkConfig = PARK_CONFIGS[parkId];
  if (!parkConfig) {
    return {
      success: false,
      error: `未找到游乐场配置: ${parkId}`
    };
  }
  
  // 检查是否有补充信息API配置
  if (!parkConfig.apiConfig.otherInfo || !parkConfig.apiConfig.otherInfo.enabled) {
    return {
      success: false,
      error: `游乐场 ${parkId} 没有补充信息API配置`
    };
  }
  
  console.log(`开始获取 ${parkId} 的补充信息`);
  
  const otherInfoUrl = `${parkConfig.apiEndpoint}${parkConfig.apiConfig.otherInfo.path}`;
  
  // 准备请求头
  const headers = {
    'Content-Type': 'application/json'
  };
  
  // 只有当token不为空时才添加Authorization header
  if (token && token.trim() !== '') {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  // 发送请求
  try {
    console.log(`请求补充信息URL: ${otherInfoUrl}`);
    console.log(`请求头:`, headers);
    
    const response = await axios.get(otherInfoUrl, {
      headers: headers,
      timeout: 8000 // 减少到8秒超时
    });
    
    console.log(`${parkId} 补充信息API响应状态:`, response.status);
    console.log(`${parkId} 补充信息API响应数据结构:`, Object.keys(response.data || {}));
    
    if (response.status === 200 && response.data) {
      // 获取数据路径并返回相应数据
      const responseMapping = parkConfig.apiConfig.otherInfo.responseMapping || { data: 'data' };
      const dataPath = responseMapping.data;
      const data = dataPath ? response.data[dataPath] : response.data;
      
      console.log(`${parkId} 补充信息数据映射:`, {
        responseMapping: responseMapping,
        dataPath: dataPath,
        原始数据键: Object.keys(response.data || {}),
        映射后数据类型: Array.isArray(data) ? 'array' : typeof data,
        映射后数据长度: Array.isArray(data) ? data.length : '非数组'
      });
      
      // 确保返回的是数组
      const finalData = Array.isArray(data) ? data : [];
      
      console.log(`${parkId} 补充信息获取完成，数据长度: ${finalData.length}`);
      
      return {
        success: true,
        data: finalData,
        parkId: parkId,
        timestamp: new Date().toISOString()
      };
    } else {
      console.warn(`补充信息API响应异常:`, response.status, response.data);
      return {
        success: false,
        error: `获取补充信息失败: ${response.status}`
      };
    }
  } catch (error) {
    console.error(`获取 ${parkId} 补充信息时发生错误:`, error.message);
    console.error(`错误详情:`, {
      url: otherInfoUrl,
      headers: headers,
      error: error.response ? {
        status: error.response.status,
        data: error.response.data
      } : error.message
    });
    
    return {
      success: false,
      error: `获取补充信息失败: ${error.message}`,
      details: error.response ? {
        status: error.response.status,
        data: error.response.data
      } : null
    };
  }
}

// 处理获取服务端配置信息
async function handleGetServerConfig() {
  console.log('开始从服务端获取配置信息...');
  
  const url = SERVER_CONFIG.baseUrl + SERVER_CONFIG.apiEndpoints.allInfo;
  
  try {
    const response = await axios.get(url, {
      timeout: 8000 // 增加到12秒超时
    });
    
    console.log('服务端配置获取成功:', response.data);
    
    if (response.status === 200 && response.data && response.data.success) {
      return {
        success: true,
        data: response.data.data,
        timestamp: new Date().toISOString()
      };
    } else {
      console.warn('服务端返回配置信息格式错误:', response.data);
      return {
        success: false,
        error: '服务端返回数据格式错误'
      };
    }
  } catch (error) {
    console.error('获取服务端配置失败:', error);
    throw error;
  }
}

// 处理提交订阅
async function handleSubmitSubscription({ subscriptionData }) {
  if (!subscriptionData) {
    return {
      success: false,
      error: '缺少订阅数据'
    };
  }
  
  const url = SERVER_CONFIG.baseUrl + SERVER_CONFIG.apiEndpoints.subscription;
  
  try {
    const response = await axios.post(url, subscriptionData, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 8000 // 增加到12秒超时
    });
    
    if (response.status === 200 && response.data) {
      return {
        success: true,
        data: response.data,
        timestamp: new Date().toISOString()
      };
    } else {
      return {
        success: false,
        error: `提交订阅失败: ${response.status}`
      };
    }
  } catch (error) {
    console.error('提交订阅失败:', error);
    throw error;
  }
}

// 处理获取用户订阅
async function handleGetUserSubscriptions({ userId }) {
  if (!userId) {
    return {
      success: false,
      error: '缺少用户ID'
    };
  }
  
  const url = `${SERVER_CONFIG.baseUrl}api/wechat/subscription/list?user_id=${userId}`;
  
  try {
    const response = await axios.get(url, {
      timeout: 8000 // 增加到12秒超时
    });
    
    if (response.status === 200 && response.data) {
      return {
        success: true,
        data: response.data,
        timestamp: new Date().toISOString()
      };
    } else {
      return {
        success: false,
        error: `获取用户订阅失败: ${response.status}`
      };
    }
  } catch (error) {
    console.error('获取用户订阅失败:', error.message || error);
    return {
      success: false,
      error: `获取用户订阅失败: ${error.message || '网络错误'}`,
      errorDetail: JSON.stringify(error.message || error)
    };
  }
}

// 处理获取项目历史排队时间数据
async function handleGetAttractionHistory({ parkId, attractionName, token }) {
  if (!parkId) {
    return {
      success: false,
      error: '缺少游乐场ID参数'
    };
  }
  
  if (!attractionName) {
    return {
      success: false,
      error: '缺少项目名称参数'
    };
  }
  
  // 历史数据API需要认证，如果没有token直接返回错误
  if (!token || token.trim() === '') {
    console.log(`${parkId} 获取历史数据需要认证，但没有提供有效token`);
    return {
      success: false,
      error: '获取历史数据需要登录认证，请先登录',
      requireAuth: true
    };
  }
  
  // 获取游乐场配置
  const parkConfig = PARK_CONFIGS[parkId];
  if (!parkConfig) {
    return {
      success: false,
      error: `未找到游乐场配置: ${parkId}`
    };
  }
  
  console.log(`【云函数-历史数据】开始获取 ${parkId} 项目 ${attractionName} 的历史数据`);
  console.log(`【云函数-历史数据】请求时间: ${new Date().toLocaleString()}`);
  
  const historyUrl = `${parkConfig.apiEndpoint}/attraction-wait-times/${encodeURIComponent(attractionName)}`;
  console.log(`【云函数-历史数据】请求URL: ${historyUrl}`);
  
  // 准备请求头
  const headers = {
    'Content-Type': 'application/json'
  };
  
  // 添加认证header（此时已确保token存在）
  headers['Authorization'] = `Bearer ${token}`;
  console.log(`【云函数-历史数据】使用token进行认证: ${token.substring(0, 10)}...`);
  
  const requestStartTime = Date.now();
  
  try {
    console.log(`【云函数-历史数据】开始发送HTTP请求，超时设置: 8000ms`);
    
    // 发送请求
    const response = await axios.get(historyUrl, {
      headers: headers,
      timeout: 8000 // 8秒超时
    });
    
    const requestEndTime = Date.now();
    const requestDuration = requestEndTime - requestStartTime;
    console.log(`【云函数-历史数据】HTTP请求完成，耗时: ${requestDuration}ms`);
    
    if (response.status === 200 && response.data) {
      if (response.data.code === 0) {
        console.log(`【云函数-历史数据】${parkId} 项目 ${attractionName} 历史数据获取成功`);
        
        return {
          success: true,
          data: response.data.data,
          parkId: parkId,
          attractionName: attractionName,
          timestamp: new Date().toISOString()
        };
      } else {
        console.warn(`【云函数-历史数据】API返回错误:`, response.data);
        return {
          success: false,
          error: `API返回错误: ${response.data.message || '未知错误'}`
        };
      }
    } else {
      console.warn(`【云函数-历史数据】API响应异常:`, response.status, response.data);
      return {
        success: false,
        error: `获取历史数据失败: ${response.status}`
      };
    }
  } catch (error) {
    const requestEndTime = Date.now();
    const requestDuration = requestEndTime - requestStartTime;
    
    console.error('【云函数-历史数据】请求失败，耗时:', requestDuration + 'ms');
    console.error('【云函数-历史数据】错误详情:', error);
    
    // 处理不同类型的错误
    let errorMessage = '获取历史数据失败';
    if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
      // 超时错误
      console.error('【云函数-历史数据】确认为超时错误！');
      console.error('【云函数-历史数据】超时详情:', {
        code: error.code,
        message: error.message,
        duration: requestDuration,
        timeoutSetting: 8000
      });
      errorMessage = '请求超时，请稍后重试';
    } else if (error.response) {
      // 服务器响应了错误状态码
      console.error('【云函数-历史数据】服务器错误:', error.response.status);
      errorMessage = `服务器错误: ${error.response.status}`;
    } else if (error.request) {
      // 请求已发送但没有收到响应
      console.error('【云函数-历史数据】网络无响应');
      errorMessage = '网络请求超时或无响应';
    } else {
      // 其他错误
      console.error('【云函数-历史数据】其他错误:', error.message);
      errorMessage = error.message || '未知错误';
    }
    
    return {
      success: false,
      error: errorMessage,
      errorDetail: JSON.stringify(error.message || error)
    };
  }
}

// 处理获取景点排队时间
async function handleGetAttractionWaitTimes({ parkId }) {
  if (!parkId) {
    return {
      success: false,
      error: '缺少游乐场ID参数'
    };
  }
  
  // 获取游乐场配置
  const parkConfig = PARK_CONFIGS[parkId];
  if (!parkConfig) {
    return {
      success: false,
      error: `未找到游乐场配置: ${parkId}`
    };
  }
  
  console.log(`开始获取 ${parkId} 的景点排队时间`);
  
  // 构建API URL - 使用您提供的接口地址
  let waitTimesUrl;
  if (parkId === 'universal') {
    waitTimesUrl = 'https://doctorj.com.cn/api/bjuniversal/attractions/basic-info';
  } else if (parkId === 'disney') {
    waitTimesUrl = 'https://doctorj.com.cn/api/shdisney/attractions/basic-info';
  } else if (parkId === 'chimelong') {
    waitTimesUrl = 'https://doctorj.com.cn/api/chimelong/attractions/basic-info';
  } else {
    return {
      success: false,
      error: `暂不支持的游乐场: ${parkId}`
    };
  }
  
  console.log(`排队时间请求URL: ${waitTimesUrl}`);
  
  try {
    // 发送请求获取排队时间
    const response = await axios.get(waitTimesUrl, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 8000
    });
    
    console.log(`${parkId} 排队时间API响应状态:`, response.status);
    console.log(`${parkId} 排队时间API响应数据结构:`, {
      hasData: !!response.data,
      code: response.data?.code,
      dataType: typeof response.data?.data,
      dataLength: Array.isArray(response.data?.data) ? response.data.data.length : 'not array'
    });
    
    if (response.status === 200 && response.data) {
      if (response.data.code === 0) {
        const waitTimesData = response.data.data || [];
        console.log(`${parkId} 排队时间数据获取完成，数量:`, waitTimesData.length);
        
        // 打印前2个数据样本
        if (waitTimesData.length > 0) {
          console.log(`${parkId} 排队时间数据样本:`, waitTimesData.slice(0, 2));
        }
        
        return {
          success: true,
          data: waitTimesData,
          parkId: parkId,
          timestamp: new Date().toISOString()
        };
      } else {
        console.warn(`排队时间API返回错误:`, response.data);
        return {
          success: false,
          error: `API返回错误: ${response.data.message || '未知错误'}`
        };
      }
    } else {
      console.warn(`排队时间API响应异常:`, response.status, response.data);
      return {
        success: false,
        error: `获取排队时间失败: ${response.status}`
      };
    }
  } catch (error) {
    console.error('获取排队时间失败:', error);
    
    // 处理不同类型的错误
    let errorMessage = '获取排队时间失败';
    if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
      // 超时错误
      errorMessage = '请求超时，请稍后重试';
    } else if (error.response) {
      // 服务器响应了错误状态码
      errorMessage = `服务器错误: ${error.response.status}`;
    } else if (error.request) {
      // 请求已发送但没有收到响应
      errorMessage = '网络请求超时或无响应';
    } else {
      // 其他错误
      errorMessage = error.message || '未知错误';
    }
    
    return {
      success: false,
      error: errorMessage,
      errorDetail: JSON.stringify(error.message || error)
    };
  }
}

// 处理获取演出时间表
async function handleGetPerformanceSchedules({ parkId }) {
  if (!parkId) {
    return {
      success: false,
      error: '缺少游乐场ID参数'
    };
  }
  
  // 获取游乐场配置
  const parkConfig = PARK_CONFIGS[parkId];
  if (!parkConfig) {
    return {
      success: false,
      error: `未找到游乐场配置: ${parkId}`
    };
  }
  
  console.log(`开始获取 ${parkId} 的演出时间表`);
  
  // 构建API URL - 使用演出时间表接口
  let schedulesUrl;
  if (parkId === 'universal') {
    schedulesUrl = 'https://doctorj.com.cn/api/bjuniversal/performances/basic-info';
  } else if (parkId === 'disney') {
    schedulesUrl = 'https://doctorj.com.cn/api/shdisney/performances/basic-info';
  } else if (parkId === 'chimelong') {
    schedulesUrl = 'https://doctorj.com.cn/api/chimelong/performances/basic-info';
  } else {
    return {
      success: false,
      error: `暂不支持的游乐场: ${parkId}`
    };
  }
  
  console.log(`演出时间表请求URL: ${schedulesUrl}`);
  
  try {
    // 发送请求获取演出时间表
    const response = await axios.get(schedulesUrl, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 8000
    });
    
    console.log(`${parkId} 演出时间表API响应状态:`, response.status);
    console.log(`${parkId} 演出时间表API响应数据结构:`, {
      hasData: !!response.data,
      code: response.data?.code,
      dataType: typeof response.data?.data,
      dataLength: Array.isArray(response.data?.data) ? response.data.data.length : 'not array'
    });
    
    if (response.status === 200 && response.data) {
      if (response.data.code === 0) {
        const schedulesData = response.data.data || [];
        console.log(`${parkId} 演出时间表数据获取完成，数量:`, schedulesData.length);
        
        // 打印前2个数据样本
        if (schedulesData.length > 0) {
          console.log(`${parkId} 演出时间表数据样本:`, schedulesData.slice(0, 2));
        }
        
        return {
          success: true,
          data: schedulesData,
          parkId: parkId,
          timestamp: new Date().toISOString()
        };
      } else {
        console.warn(`演出时间表API返回错误:`, response.data);
        return {
          success: false,
          error: `API返回错误: ${response.data.message || '未知错误'}`
        };
      }
    } else {
      console.warn(`演出时间表API响应异常:`, response.status, response.data);
      return {
        success: false,
        error: `获取演出时间表失败: ${response.status}`
      };
    }
  } catch (error) {
    console.error('获取演出时间表失败:', error);
    
    // 处理不同类型的错误
    let errorMessage = '获取演出时间表失败';
    if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
      // 超时错误
      errorMessage = '请求超时，请稍后重试';
    } else if (error.response) {
      // 服务器响应了错误状态码
      errorMessage = `服务器错误: ${error.response.status}`;
    } else if (error.request) {
      // 请求已发送但没有收到响应
      errorMessage = '网络请求超时或无响应';
    } else {
      // 其他错误
      errorMessage = error.message || '未知错误';
    }
    
    return {
      success: false,
      error: errorMessage,
      errorDetail: JSON.stringify(error.message || error)
    };
  }
}
