const app = getApp();

Component({
  data: {
    selected: 0,
    color: "#999",
    selectedColor: "#07C160",
    backgroundColor: "#fff",
    list: []
  },

  attached() {
    this.updateTabBarList();
    
    // 监听AI助手开关状态变化
    app.globalEvents.on('aiAssistantToggled', this.updateTabBarList.bind(this));
  },

  detached() {
    // 移除事件监听
    app.globalEvents.off('aiAssistantToggled', this.updateTabBarList.bind(this));
  },

  methods: {
    updateTabBarList() {
      const aiEnabled = app.getAiAssistantEnabled();
      
      let list = [];
      
      // 根据AI助手开关状态决定是否显示聊天tab
      if (aiEnabled) {
        list.push({
          pagePath: "pages/index/index",
          text: "聊天",
          iconPath: "/images/tab-chat.png",
          selectedIconPath: "/images/tab-chat-active.png"
        });
      }
      
      // 其他固定的tab
      list.push(
        {
          pagePath: "pages/screen/screen",
          text: "大屏",
          iconPath: "/images/tab-screen.png",
          selectedIconPath: "/images/tab-screen-active.png"
        },
        {
          pagePath: "pages/map/map",
          text: "地图",
          iconPath: "/images/tab-map.png",
          selectedIconPath: "/images/tab-map-active.png"
        },
        {
          pagePath: "pages/plan/plan",
          text: "规划",
          iconPath: "/images/tab-plan.png",
          selectedIconPath: "/images/tab-plan-active.png"
        },
        {
          pagePath: "pages/profile/profile",
          text: "我的",
          iconPath: "/images/tab-profile.png",
          selectedIconPath: "/images/tab-profile-active.png"
        }
      );

      this.setData({
        list: list
      });
    },

    // 设置当前选中的tab
    setSelected(pagePath) {
      const { list } = this.data;
      const selectedIndex = list.findIndex(item => item.pagePath === pagePath);
      
      if (selectedIndex !== -1) {
        this.setData({
          selected: selectedIndex
        });
      }
    },

    switchTab(e) {
      const data = e.currentTarget.dataset;
      const url = data.path;
      
      // 如果是聊天页面且AI助手已关闭，显示提示
      if (url === 'pages/index/index' && !app.getAiAssistantEnabled()) {
        wx.showToast({
          title: '该功能正在开发中',
          icon: 'none',
          duration: 2000
        });
        return;
      }
      
      wx.switchTab({ url: `/${url}` });
      this.setData({
        selected: data.index
      });
    }
  }
});
