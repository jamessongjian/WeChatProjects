// 模拟微信小程序环境
global.wx = {
  request: jest.fn(),
  getLocation: jest.fn(),
  openLocation: jest.fn(),
  showToast: jest.fn(),
  createSelectorQuery: jest.fn(() => ({
    select: jest.fn().mockReturnThis(),
    boundingClientRect: jest.fn().mockReturnThis(),
    exec: jest.fn()
  }))
};

// 模拟全局对象
global.getApp = jest.fn(() => ({
  globalData: {
    userInfo: {
      avatarUrl: 'test-avatar.png',
      nickName: 'Test User'
    }
  }
})); 