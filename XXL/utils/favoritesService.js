/**
 * 收藏功能管理服务
 * 统一管理小程序中的收藏相关功能
 */

const favoritesService = {
  /**
   * 添加或移除收藏
   * @param {Object} app 全局app实例
   * @param {String} parkName 当前游乐园名称
   * @param {String|Object} item 要收藏的项目ID或完整项目对象
   * @param {Boolean} saveToStorage 是否保存到本地存储
   * @param {Function} callback 操作完成后的回调
   * @returns {Boolean} 操作后的收藏状态
   */
  toggleFavorite(app, parkName, item, saveToStorage = true, callback) {
    if (!app || !parkName) {
      console.error('toggleFavorite: 缺少必要参数', { app: !!app, parkName });
      return false;
    }
    
    // 确保favorites存在于app.globalData中
    if (!app.globalData.favorites) {
      app.globalData.favorites = {};
    }
    
    // 获取当前游乐园的收藏列表
    const favorites = app.globalData.favorites[parkName] || [];
    
    // 确定项目ID (可以接受ID字符串或完整项目对象)
    const itemId = typeof item === 'object' ? item.id : item;
    
    if (!itemId) {
      console.error('toggleFavorite: 项目ID无效', {
        itemType: typeof item,
        item: JSON.stringify(item).substring(0, 100),
        parkName
      });
      
      // 如果项目是对象但没有id，尝试检查是否有其他可用的唯一标识符
      if (typeof item === 'object') {
        // 创建一个默认的ID以允许继续操作
        if (item.name) {
          console.log('使用name作为备用ID:', item.name);
          item.id = 'id_' + item.name.replace(/\s/g, '_');
          return this.toggleFavorite(app, parkName, item, saveToStorage, callback);
        }
      }
      
      return false;
    }
    
    // 查找项目在收藏列表中的索引
    const index = favorites.findIndex(fav => {
      if (typeof fav === 'object') {
        return fav.id === itemId;
      } else {
        return fav === itemId;
      }
    });
    
    let isFavorite = false;
    
    if (index === -1) {
      // 添加到收藏
      if (typeof item === 'object') {
        favorites.push(item);
      } else {
        favorites.push(itemId);
      }
      isFavorite = true;
      
      // 短震动反馈
      wx.vibrateShort({ type: 'medium' });
      
      // 提示收藏成功
      wx.showToast({
        title: '已添加到收藏',
        icon: 'success',
        duration: 1500
      });
    } else {
      // 从收藏中移除
      favorites.splice(index, 1);
      isFavorite = false;
      
      // 短震动反馈
      wx.vibrateShort({ type: 'light' });
      
      // 提示取消收藏
      wx.showToast({
        title: '已取消收藏',
        icon: 'none',
        duration: 1500
      });
    }
    
    // 更新全局数据
    app.globalData.favorites[parkName] = favorites;
    
    // 保存到本地存储
    if (saveToStorage) {
      // 使用新方法保存
      this.saveAllFavoritesToStorage(app);
    }
    
    // 发布收藏变更事件
    if (app.globalEvents && app.globalEvents.emit) {
      app.globalEvents.emit('favoritesUpdated', {
        parkName,
        favorites,
        itemId,
        isFavorite
      });
    }
    
    // 执行回调
    if (typeof callback === 'function') {
      callback(isFavorite);
    }
    
    return isFavorite;
  },
  
  /**
   * 检查项目是否已收藏
   * @param {Object} app 全局app实例
   * @param {String} parkName 当前游乐园名称
   * @param {String|Object} item 要检查的项目ID或完整项目对象
   * @returns {Boolean} 是否已收藏
   */
  isFavorite(app, parkName, item) {
    if (!app || !parkName) {
      return false;
    }
    
    // 确保favorites存在于app.globalData中
    if (!app.globalData.favorites) {
      return false;
    }
    
    const favorites = app.globalData.favorites[parkName] || [];
    const itemId = typeof item === 'object' ? item.id : item;
    
    if (!itemId) {
      return false;
    }
    
    // 检查项目是否在收藏列表中
    return favorites.some(fav => {
      if (typeof fav === 'object') {
        return fav.id === itemId;
      } else {
        return fav === itemId;
      }
    });
  },
  
  /**
   * 获取所有收藏项目
   * @param {Object} app 全局app实例
   * @param {String} parkName 当前游乐园名称
   * @returns {Array} 收藏项目列表
   */
  getFavorites(app, parkName) {
    if (!app || !parkName) {
      return [];
    }
    
    if (!app.globalData.favorites) {
      app.globalData.favorites = {};
    }
    
    return app.globalData.favorites[parkName] || [];
  },
  
  /**
   * 保存所有收藏数据到存储（包括用户ID关联）
   * @param {Object} app 全局app实例
   */
  saveAllFavoritesToStorage(app) {
    if (!app || !app.globalData.favorites) {
      return;
    }
    
    try {
      // 获取当前登录用户ID（如果有）
      const userInfo = wx.getStorageSync('userInfo');
      const userId = userInfo ? userInfo.userId || userInfo.nickName : 'guest';
      
      // 保存所有收藏信息
      wx.setStorageSync('favorites', app.globalData.favorites);
      
      // 同时保存与用户关联的副本，以支持多用户
      if (userId) {
        // 使用用户ID来存储该用户的收藏
        wx.setStorageSync(`favorites_${userId}`, app.globalData.favorites);
      }
      
      console.log('已保存收藏数据，关联用户:', userId);
    } catch (error) {
      console.error('保存收藏数据失败:', error);
    }
  },
  
  /**
   * 从存储加载收藏数据（根据当前用户）
   * @param {Object} app 全局app实例
   * @returns {Object} 收藏数据
   */
  loadFromStorage(app) {
    if (!app) {
      return {};
    }
    
    try {
      // 获取当前登录用户ID（如果有）
      const userInfo = wx.getStorageSync('userInfo');
      const userId = userInfo ? userInfo.userId || userInfo.nickName : 'guest';
      
      let favorites;
      
      // 优先尝试加载用户特定的收藏
      if (userId && userId !== 'guest') {
        favorites = wx.getStorageSync(`favorites_${userId}`);
      }
      
      // 如果没有用户特定的收藏，使用通用收藏
      if (!favorites) {
        favorites = wx.getStorageSync('favorites') || {};
      }
      
      app.globalData.favorites = favorites;
      console.log('已加载收藏数据，关联用户:', userId);
      
      return favorites;
    } catch (error) {
      console.error('加载收藏数据失败:', error);
      app.globalData.favorites = {};
      return {};
    }
  },
  
  /**
   * 合并多个收藏列表（例如用户登录后合并游客收藏和用户收藏）
   * @param {Object} app 全局app实例
   */
  mergeGuestFavorites(app) {
    if (!app) return;
    
    try {
      // 获取当前登录用户ID
      const userInfo = wx.getStorageSync('userInfo');
      const userId = userInfo ? userInfo.userId || userInfo.nickName : null;
      
      // 如果没有用户ID，不进行合并
      if (!userId || userId === 'guest') return;
      
      // 获取游客收藏和用户收藏
      const guestFavorites = wx.getStorageSync('favorites') || {};
      const userFavorites = wx.getStorageSync(`favorites_${userId}`) || {};
      
      // 合并收藏（处理每个游乐园）
      const mergedFavorites = { ...userFavorites };
      
      Object.keys(guestFavorites).forEach(parkName => {
        if (!mergedFavorites[parkName]) {
          // 如果用户没有这个游乐园的收藏，直接使用游客的
          mergedFavorites[parkName] = guestFavorites[parkName];
        } else {
          // 合并两个列表，避免重复
          const guestItems = guestFavorites[parkName];
          const userItems = mergedFavorites[parkName];
          
          guestItems.forEach(guestItem => {
            // 检查是否已存在
            const guestId = typeof guestItem === 'object' ? guestItem.id : guestItem;
            const exists = userItems.some(userItem => {
              const userId = typeof userItem === 'object' ? userItem.id : userItem;
              return userId === guestId;
            });
            
            // 如果不存在，添加到用户收藏
            if (!exists) {
              userItems.push(guestItem);
            }
          });
        }
      });
      
      // 更新全局数据和存储
      app.globalData.favorites = mergedFavorites;
      this.saveAllFavoritesToStorage(app);
      
      console.log('已合并游客收藏到用户账户');
    } catch (error) {
      console.error('合并收藏数据失败:', error);
    }
  }
};

module.exports = favoritesService; 