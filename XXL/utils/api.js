// 获取游乐场数据 - 使用云函数
function fetchParkData(parkNameOrId, token) {
  const app = getApp();
  let park;
  
  // 尝试通过 ID 直接获取配置
  park = app.getParkConfigById(parkNameOrId);
  
  // 如果未找到，尝试将输入作为名称处理
  if (!park) {
    // 检查是否是游乐场名称
    const parks = app.globalData.parks;
    if (parks[parkNameOrId]) {
      park = parks[parkNameOrId];
    } else {
      // 最后尝试从名称映射中获取ID
      const { parkNameToId } = require('./data');
      const parkId = parkNameToId[parkNameOrId];
      if (parkId) {
        park = app.getParkConfigById(parkId);
      }
    }
  }
  
  if (!park) {
    return Promise.reject(new Error(`无效的游乐场ID或名称: ${parkNameOrId}`));
  }
  
  // 使用统一云函数获取数据
  const cloudHelper = require('./cloudHelper');
  
  return cloudHelper.safeCallFunction({
    name: 'fetchServerData',
    data: {
      action: 'getParkData',
      parkId: park.id,
      token: token || '' // 如果token为null/undefined，使用空字符串
    },
    timeout: 15000, // 15秒超时
    retries: 2,     // 最多重试2次
  }).then((res) => {
    if (res.result.success) {
      // 转换为原来的格式以兼容现有代码
      const data = {};
      const serverData = res.result.data;
      
      // 遍历服务端返回的所有数据类型
      Object.keys(serverData).forEach(type => {
        data[type] = { data: serverData[type] || [] };
      });
      return data;
    } else {
      throw new Error(res.result.error || '获取游乐场数据失败');
    }
  });
}

// 获取项目补充信息
function fetchItemOtherInfo(parkNameOrId, token) {
  const app = getApp();
  let park;
  
  // 尝试通过 ID 直接获取配置
  park = app.getParkConfigById(parkNameOrId);
  
  // 如果未找到，尝试将输入作为名称处理
  if (!park) {
    // 检查是否是游乐场名称
    const parks = app.globalData.parks;
    if (parks[parkNameOrId]) {
      park = parks[parkNameOrId];
    } else {
      // 最后尝试从名称映射中获取ID
      const { parkNameToId } = require('./data');
      const parkId = parkNameToId[parkNameOrId];
      if (parkId) {
        park = app.getParkConfigById(parkId);
      }
    }
  }
  
  if (!park) {
    return Promise.reject(new Error(`无效的游乐场ID或名称: ${parkNameOrId}`));
  }
  
  // 使用统一云函数获取项目补充信息（配置检查由云函数处理）
  const cloudHelper = require('./cloudHelper');
  
  return cloudHelper.safeCallFunction({
    name: 'fetchServerData',
    data: {
      action: 'getItemOtherInfo',
      parkId: park.id,
      token: token || '' // 如果token为null/undefined，使用空字符串
    },
    timeout: 15000, // 15秒超时
    retries: 2,     // 最多重试2次
  }).then((res) => {
    if (res.result.success) {
      return res.result.data;
    } else {
      throw new Error(res.result.error || '获取项目补充信息失败');
    }
  });
}

// 微信登录接口
function wxLogin(code) {
  return new Promise((resolve, reject) => {
    // 获取全局配置的服务器URL
    const app = getApp();
    const serverConfig = app.globalData.serverConfig;
    const url = `${serverConfig.baseUrl}api/auth/login`;
    
    wx.request({
      url: url,
      method: 'POST',
      header: {
        'Content-Type': 'application/json'
      },
      data: {
        code: code
      },
      success: (res) => {
        if (res.statusCode === 200 && res.data.success) {
          // 登录成功
          resolve(res.data);
        } else {
          // 登录失败
          reject(new Error(res.data.message || '登录失败'));
        }
      },
      fail: (err) => {
        console.error('登录请求失败:', err);
        reject(new Error(`网络请求失败: ${err.errMsg}`));
      }
    });
  });
}

// 获取微信登录code并调用登录接口
function getWxLoginCode() {
  return new Promise((resolve, reject) => {
    wx.login({
      success: (res) => {
        if (res.code) {
          console.log('获取微信登录code成功:', res.code);
          // 调用登录接口
          wxLogin(res.code)
            .then((loginResult) => {
              console.log('登录接口调用成功:', loginResult);
              resolve(loginResult);
            })
            .catch((error) => {
              console.error('登录接口调用失败:', error);
              reject(error);
            });
        } else {
          console.error('获取微信登录code失败:', res.errMsg);
          reject(new Error('获取微信登录code失败: ' + res.errMsg));
        }
      },
      fail: (err) => {
        console.error('wx.login调用失败:', err);
        reject(new Error('wx.login调用失败: ' + err.errMsg));
      }
    });
  });
}

// 提交订阅提醒到服务器 - 使用云函数
function submitSubscription(subscriptionData) {
  const cloudHelper = require('./cloudHelper');
  
  return cloudHelper.safeCallFunction({
    name: 'fetchServerData',
    data: {
      action: 'submitSubscription',
      subscriptionData: subscriptionData
    },
    timeout: 15000, // 15秒超时
    retries: 2,     // 最多重试2次
  }).then((res) => {
    if (res.result.success) {
      return res.result.data;
    } else {
      throw new Error(res.result.error || '提交订阅失败');
    }
  });
}

// 获取用户订阅列表 - 使用云函数
function getUserSubscriptions(userId) {
  const cloudHelper = require('./cloudHelper');
  
  return cloudHelper.safeCallFunction({
    name: 'fetchServerData',
    data: {
      action: 'getUserSubscriptions',
      userId: userId
    },
    timeout: 15000, // 15秒超时
    retries: 2,     // 最多重试2次
  }).then((res) => {
    if (res.result.success) {
      return res.result.data;
    } else {
      throw new Error(res.result.error || '获取用户订阅失败');
    }
  });
}

// 获取景点排队时间 - 使用云函数
function fetchAttractionWaitTimes(parkNameOrId) {
  const app = getApp();
  let park;
  
  // 尝试通过 ID 直接获取配置
  park = app.getParkConfigById(parkNameOrId);
  
  // 如果未找到，尝试将输入作为名称处理
  if (!park) {
    // 检查是否是游乐场名称
    const parks = app.globalData.parks;
    if (parks[parkNameOrId]) {
      park = parks[parkNameOrId];
    } else {
      // 最后尝试从名称映射中获取ID
      const { parkNameToId } = require('./data');
      const parkId = parkNameToId[parkNameOrId];
      if (parkId) {
        park = app.getParkConfigById(parkId);
      }
    }
  }
  
  if (!park) {
    return Promise.reject(new Error(`无效的游乐场ID或名称: ${parkNameOrId}`));
  }
  
  // 使用统一云函数获取排队时间数据
  const cloudHelper = require('./cloudHelper');
  
  return cloudHelper.safeCallFunction({
    name: 'fetchServerData',
    data: {
      action: 'getAttractionWaitTimes',
      parkId: park.id
    },
    timeout: 10000, // 10秒超时
    retries: 2,     // 最多重试2次
  }).then((res) => {
    if (res.result.success) {
      console.log('【fetchAttractionWaitTimes】云函数返回的排队时间数据:', res.result.data);
      return res.result.data;
    } else {
      throw new Error(res.result.error || '获取景点排队时间失败');
    }
  });
}

// 获取演出时间表 - 使用云函数
function fetchPerformanceSchedules(parkNameOrId) {
  const app = getApp();
  let park;
  
  // 尝试通过 ID 直接获取配置
  park = app.getParkConfigById(parkNameOrId);
  
  // 如果未找到，尝试将输入作为名称处理
  if (!park) {
    // 检查是否是游乐场名称
    const parks = app.globalData.parks;
    if (parks[parkNameOrId]) {
      park = parks[parkNameOrId];
    } else {
      // 最后尝试从名称映射中获取ID
      const { parkNameToId } = require('./data');
      const parkId = parkNameToId[parkNameOrId];
      if (parkId) {
        park = app.getParkConfigById(parkId);
      }
    }
  }
  
  if (!park) {
    return Promise.reject(new Error(`无效的游乐场ID或名称: ${parkNameOrId}`));
  }
  
  // 使用统一云函数获取演出时间表数据
  const cloudHelper = require('./cloudHelper');
  
  return cloudHelper.safeCallFunction({
    name: 'fetchServerData',
    data: {
      action: 'getPerformanceSchedules',
      parkId: park.id
    },
    timeout: 10000, // 10秒超时
    retries: 2,     // 最多重试2次
  }).then((res) => {
    if (res.result.success) {
      console.log('【fetchPerformanceSchedules】云函数返回的演出时间表数据:', res.result.data);
      return res.result.data;
    } else {
      throw new Error(res.result.error || '获取演出时间表失败');
    }
  });
}

// 删除用户订阅
function deleteUserSubscription(userId, messageId) {
  return new Promise((resolve, reject) => {
    // 获取全局配置的服务器URL
    const app = getApp();
    const serverConfig = app.globalData.serverConfig;
    const url = `${serverConfig.baseUrl}api/wechat/subscription/delete`;
    
    wx.request({
      url: url,
      method: 'POST',
      header: {
        'Content-Type': 'application/json'
      },
      data: {
        user_id: userId,
        message_id: messageId
      },
      success: (res) => {
        if (res.statusCode === 200 && res.data.status === 'success') {
          // 删除成功
          resolve(res.data);
        } else {
          // 删除失败
          reject(new Error(res.data.message || '删除订阅失败'));
        }
      },
      fail: (err) => {
        console.error('删除订阅请求失败:', err);
        reject(new Error(`网络请求失败: ${err.errMsg}`));
      }
    });
  });
}

module.exports = {
  fetchParkData,
  fetchItemOtherInfo,
  fetchAttractionWaitTimes,
  fetchPerformanceSchedules,
  submitSubscription,
  getWxLoginCode,
  wxLogin,
  getUserSubscriptions,
  deleteUserSubscription
}; 