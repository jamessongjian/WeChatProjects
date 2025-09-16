Page({
  data: {
    favorites: [
      {
        id: 1,
        name: '过山车',
        image: '/images/attraction1.jpg',
        queueTime: '15min',
        queueLevel: 'low'
      },
      {
        id: 2,
        name: '旋转木马',
        image: '/images/attraction2.jpg',
        queueTime: '30min',
        queueLevel: 'medium'
      },
      {
        id: 3,
        name: '摩天轮',
        image: '/images/attraction3.jpg',
        queueTime: '45min',
        queueLevel: 'high'
      }
    ],
    recommendQueries: [
      '热门景点',
      '排队时间短',
      '适合儿童',
      '刺激项目'
    ]
  },

  onLoad: function() {
    // 从本地存储获取收藏列表
    const favorites = wx.getStorageSync('favorites') || [];
    this.setData({ favorites });
  }
}); 