// 测试高德地图路线规划
const runTests = () => {
  console.log('开始测试高德地图路线规划...\n');

  // 测试数据
  const startLat = 39.852698;
  const startLng = 116.681212;
  const endLat = 39.8546790046534;
  const endLng = 116.68404301623862;
  const key = 'e3cfffd24698d48feb850481e05b9a03';

  // 测试坐标转换
  console.log('坐标转换测试：');
  const testCases = [
    {
      name: '萌转过山车',
      lat: 39.8546790046534,
      lng: 116.68404301623862
    },
    {
      name: '起点',
      lat: 39.852698,
      lng: 116.681212
    }
  ];

  testCases.forEach((test, index) => {
    console.log(`\n测试点 ${index + 1}: ${test.name}`);
    console.log(`原始坐标：纬度=${test.lat}, 经度=${test.lng}`);
    console.log(`高德格式：${test.lng},${test.lat}`);
  });

  // 测试路线规划
  console.log('\n路线规划测试：');
  wx.request({
    url: 'https://restapi.amap.com/v3/direction/driving',
    data: {
      key: key,
      origin: `${startLng},${startLat}`,
      destination: `${endLng},${endLat}`,
      extensions: 'all'
    },
    success: (res) => {
      console.log('路线规划测试结果：');
      console.log('状态码：', res.data.status);
      
      if (res.data.status === '1') {
        const route = res.data.route;
        console.log('路线距离：', route.paths[0].distance, '米');
        console.log('预计时间：', route.paths[0].duration, '秒');
        console.log('路线点数量：', route.paths[0].steps.length);
        
        // 打印第一个路段的详细信息
        if (route.paths[0].steps.length > 0) {
          const firstStep = route.paths[0].steps[0];
          console.log('第一个路段：');
          console.log('  - 距离：', firstStep.distance, '米');
          console.log('  - 时间：', firstStep.duration, '秒');
          console.log('  - 方向：', firstStep.action);
          console.log('  - 辅助信息：', firstStep.assistant_action);
        }
      } else {
        console.log('获取路线失败：', res.data.info);
      }
    },
    fail: (err) => {
      console.error('请求失败：', err);
    }
  });
};

// 导出测试函数
module.exports = {
  runTests
}; 