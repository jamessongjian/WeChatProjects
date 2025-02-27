Page({
  data: {
    userInfo: null,
    messages: [
      { text: 'Hello, how can I help you?', isUser: false, avatar: '/images/bot-avatar.png' }
    ],
    inputText: ''
  },

  onLoad() {
    wx.getUserProfile({
      desc: 'Display your nickname and avatar',
      success: (res) => {
        this.setData({
          userInfo: res.userInfo
        });
      },
      fail: () => {
        console.log('Failed to get user profile');
        // Set default user info
        this.setData({
          userInfo: {
            avatarUrl: '/images/default-avatar.png',
            nickName: 'Guest'
          }
        });
      }
    });
  },
  
  onInputChange(e) {
    this.setData({
      inputText: e.detail.value
    });
  },

  sendMessage() {
    if (this.data.inputText.trim() !== '') {
      const newMessage = { text: this.data.inputText, isUser: true, avatar: this.data.userInfo.avatarUrl };
      this.setData({
        messages: [...this.data.messages, newMessage],
        inputText: ''
      });

      // Simulate bot response
      setTimeout(() => {
        const botMessage = { text: 'This is a bot response.', isUser: false, avatar: '/images/bot-avatar.png' };
        this.setData({
          messages: [...this.data.messages, botMessage]
        });
      }, 1000);
    }
  }
}); 