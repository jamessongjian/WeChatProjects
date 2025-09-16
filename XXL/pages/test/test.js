Page({
  data: {
    longitude: 116.681212,
    latitude: 39.852698,
    scale: 15,
    markers: [],
    polyline: [],
    // 云函数测试相关
    testResults: [],
    isTestingCloud: false
  },

  onLoad() {
    this.planRoute();
  },

  // 测试排队时间API
  async testWaitTimes() {
    console.log('🧪 开始测试排队时间API...');
    
    wx.showLoading({
      title: '测试排队时间...',
      mask: true
    });

    try {
      // 测试使用utils/api.js中的函数
      const { fetchAttractionWaitTimes } = require('../../utils/api');
      
      console.log('测试北京环球影城排队时间...');
      const universalWaitTimes = await fetchAttractionWaitTimes('universal');
      console.log('北京环球影城排队时间数据:', universalWaitTimes);
      
      console.log('测试上海迪士尼排队时间...');
      const disneyWaitTimes = await fetchAttractionWaitTimes('disney');
      console.log('上海迪士尼排队时间数据:', disneyWaitTimes);

      // 测试演出时间表
      const { fetchPerformanceSchedules } = require('../../utils/api');
      
      console.log('测试北京环球影城演出时间表...');
      const universalSchedules = await fetchPerformanceSchedules('universal');
      console.log('北京环球影城演出时间表数据:', universalSchedules);
      
      console.log('测试上海迪士尼演出时间表...');
      const disneySchedules = await fetchPerformanceSchedules('disney');
      console.log('上海迪士尼演出时间表数据:', disneySchedules);
      
      wx.hideLoading();
      wx.showModal({
        title: '测试结果',
        content: `排队时间 - 环球影城: ${universalWaitTimes.length}个景点, 迪士尼: ${disneyWaitTimes.length}个景点\n演出时间表 - 环球影城: ${universalSchedules.length}个演出, 迪士尼: ${disneySchedules.length}个演出`,
        showCancel: false
      });
      
    } catch (error) {
      console.error('排队时间测试失败:', error);
      wx.hideLoading();
      wx.showModal({
        title: '测试失败',
        content: error.message || '未知错误',
        showCancel: false
      });
    }
  },

  // 测试更新优化效果
  async testUpdateOptimization() {
    console.log('🧪 开始测试更新优化效果...');
    
    wx.showLoading({
      title: '测试更新优化...',
      mask: true
    });

    const app = getApp();
    
    try {
      console.log('=== 测试完整数据更新 ===');
      const startTime1 = Date.now();
      await new Promise((resolve, reject) => {
        // 模拟完整数据更新
        wx.cloud.callFunction({
          name: 'fetchServerData',
          data: {
            action: 'getParkData',
            parkId: 'universal',
            token: app.globalData.token || ''
          }
        }).then(res => {
          const endTime1 = Date.now();
          console.log(`完整数据更新耗时: ${endTime1 - startTime1}ms`);
          console.log('完整数据大小:', JSON.stringify(res.result.data).length, '字符');
          resolve(res);
        }).catch(reject);
      });
      
      console.log('=== 测试排队时间更新 ===');
      const startTime2 = Date.now();
      await new Promise((resolve, reject) => {
        // 模拟排队时间更新
        wx.cloud.callFunction({
          name: 'fetchServerData',
          data: {
            action: 'getAttractionWaitTimes',
            parkId: 'universal'
          }
        }).then(res => {
          const endTime2 = Date.now();
          console.log(`排队时间更新耗时: ${endTime2 - startTime2}ms`);
          console.log('排队时间数据大小:', JSON.stringify(res.result.data).length, '字符');
          resolve(res);
        }).catch(reject);
      });
      
      wx.hideLoading();
      wx.showModal({
        title: '优化测试完成',
        content: '请查看控制台日志对比两种更新方式的性能差异',
        showCancel: false
      });
      
    } catch (error) {
      console.error('优化测试失败:', error);
      wx.hideLoading();
      wx.showModal({
        title: '测试失败',
        content: error.message || '未知错误',
        showCancel: false
      });
    }
  },

  // 测试所有云函数
  async testAllCloudFunctions() {
    if (this.data.isTestingCloud) return;
    
    this.setData({ 
      isTestingCloud: true, 
      testResults: [] 
    });
    
    wx.showLoading({
      title: '测试云函数中...',
      mask: true
    });
    
    console.log('🧪 开始测试真实云函数...');
    
    const tests = [
      {
        name: 'fetchServerData',
        data: { action: 'getServerConfig' },
        description: '获取服务端配置'
      },
      {
        name: 'fetchServerData',
        data: { action: 'getAttractionWaitTimes', parkId: 'universal' },
        description: '获取北京环球影城排队时间'
      },
      {
        name: 'fetchServerData',
        data: { action: 'getAttractionWaitTimes', parkId: 'disney' },
        description: '获取上海迪士尼排队时间'
      },
      {
        name: 'fetchServerData',
        data: { action: 'getPerformanceSchedules', parkId: 'universal' },
        description: '获取北京环球影城演出时间表'
      },
      {
        name: 'fetchServerData',
        data: { action: 'getPerformanceSchedules', parkId: 'disney' },
        description: '获取上海迪士尼演出时间表'
      },
      {
        name: 'login',
        data: { checkOnly: true },
        description: '登录云函数健康检查'
      },
      {
        name: 'checkLogin',
        data: { test: true },
        description: '检查登录状态'
      },
      {
        name: 'updateUserInfo',
        data: { test: true, testMode: true, userInfo: { test: true } },
        description: '更新用户信息测试'
      },
      {
        name: 'fetchServerData',
        data: { 
          action: 'getParkData', 
          parkId: 'universal', 
          token: wx.getStorageSync('token') || 'test_token' 
        },
        description: '获取环球影城数据'
      }
    ];
    
    const results = [];
    
    for (let i = 0; i < tests.length; i++) {
      const test = tests[i];
      console.log(`🔧 测试 ${i + 1}/${tests.length}: ${test.description}`);
      
      const result = await this.testSingleCloudFunction(test.name, test.data, test.description);
      results.push(result);
      
      // 更新UI显示当前结果
      this.setData({ testResults: results });
      
      // 添加延迟避免请求过快
      if (i < tests.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    wx.hideLoading();
    this.setData({ isTestingCloud: false });
    
    // 显示测试结果摘要
    const successful = results.filter(r => r.success).length;
    const total = results.length;
    
    wx.showModal({
      title: '云函数测试完成',
      content: `共测试 ${total} 个功能\n✅ 成功: ${successful}\n❌ 失败: ${total - successful}`,
      showCancel: false,
      confirmText: '查看控制台'
    });
    
    console.log('📊 云函数测试完成，详细结果:', results);
  },

  // 测试单个云函数
  async testSingleCloudFunction(functionName, testData, description) {
    const startTime = Date.now();
    
    try {
      console.log(`📞 调用云函数: ${functionName}`, testData);
      
      const result = await wx.cloud.callFunction({
        name: functionName,
        data: testData
      });
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      console.log(`✅ ${description} - 成功 (${duration}ms)`, result.result);
      
      return {
        success: true,
        functionName,
        description,
        duration,
        result: result.result,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      console.error(`❌ ${description} - 失败 (${duration}ms)`, {
        error: error.message,
        errCode: error.errCode,
        errMsg: error.errMsg
      });
      
      return {
        success: false,
        functionName,
        description,
        duration,
        error: error.message,
        errCode: error.errCode,
        errMsg: error.errMsg,
        timestamp: new Date().toISOString()
      };
    }
  },

  // 测试单个云函数（按钮触发）
  async testFetchServerData() {
    console.log('🧪 测试 fetchServerData 云函数...');
    const result = await this.testSingleCloudFunction(
      'fetchServerData', 
      { action: 'getServerConfig' }, 
      '获取服务端配置'
    );
    
    wx.showModal({
      title: result.success ? '✅ 测试成功' : '❌ 测试失败',
      content: result.success 
        ? `响应时间: ${result.duration}ms\n请查看控制台详细结果`
        : `错误: ${result.error}\n错误码: ${result.errCode || 'N/A'}`,
      showCancel: false
    });
  },

  async testLogin() {
    console.log('🧪 测试 login 云函数...');
    const result = await this.testSingleCloudFunction(
      'login', 
      { checkOnly: true }, 
      '登录云函数健康检查'
    );
    
    wx.showModal({
      title: result.success ? '✅ 测试成功' : '❌ 测试失败',
      content: result.success 
        ? `响应时间: ${result.duration}ms\n请查看控制台详细结果`
        : `错误: ${result.error}\n错误码: ${result.errCode || 'N/A'}`,
      showCancel: false
    });
  },

  // 解压polyline坐标
  decodePolyline(coors) {
    const points = [];
    for (let i = 2; i < coors.length; i++) {
      coors[i] = coors[i-2] + coors[i]/1000000;
    }
    
    // 将解压后的坐标转换为地图需要的格式
    for (let i = 0; i < coors.length; i += 2) {
      points.push({
        latitude: coors[i],
        longitude: coors[i + 1]
      });
    }
    return points;
  },

  planRoute() {
    const key = 'OKFBZ-XH76B-K6CU2-NQ56L-ZJBKO-UFFLW';
    
    // 起点和终点坐标
    const startX = 116.681212;
    const startY = 39.852698;
    const endX = 116.684043;
    const endY = 39.854679;

    // 构建步行路线规划API请求URL，添加policy=LEAST_TIME参数
    const url = `https://apis.map.qq.com/ws/direction/v1/walking/?from=${startY},${startX}&to=${endY},${endX}&policy=LEAST_TIME&key=${key}`;

    // 调用步行路线规划API
    wx.request({
      url: url,
      success: (res) => {
        if (res.data.status === 0) {
          const route = res.data.result.routes[0];
          const coors = route.polyline;
          
          // 解压坐标点
          const points = this.decodePolyline(coors);
          
          // 更新地图上的路线
          this.setData({
            polyline: [{
              points: points,
              color: '#FF0000DD',
              width: 4,
              arrowLine: true
            }]
          });
        }
      }
    });
  }
}); 