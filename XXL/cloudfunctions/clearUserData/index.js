// 云函数入口文件
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const userCollection = db.collection('users');

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  
  console.log('强制清除用户登录状态, openid:', openid);
  
  if (!openid) {
    return {
      success: false,
      message: '获取用户openid失败'
    };
  }
  
  try {
    // 查询用户是否存在
    const userResult = await userCollection.where({
      _openid: openid
    }).get();
    
    if (userResult.data.length === 0) {
      // 用户不存在，直接返回成功
      return {
        success: true,
        message: '用户不存在，无需清除'
      };
    }
    
    // 用户存在，强制更新为未登录状态
    const user = userResult.data[0];
    await userCollection.doc(user._id).update({
      data: {
        lastLogoutTime: db.serverDate(),
        isLoggedIn: false,
        forceLogout: true // 添加强制登出标记
      }
    });
    
    // 也可以选择直接删除用户记录（谨慎使用）
    /*
    await userCollection.doc(user._id).remove();
    console.log('已删除用户记录');
    */
    
    return {
      success: true,
      message: '强制清除用户登录状态成功'
    };
  } catch (error) {
    console.error('强制清除用户登录状态失败:', error);
    return {
      success: false,
      error: error.message
    };
  }
}; 