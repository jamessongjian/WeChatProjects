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
  
  console.log('用户退出登录, openid:', openid);
  
  try {
    // 查询用户是否存在
    const userResult = await userCollection.where({
      openid: openid
    }).get();
    
    if (userResult.data.length === 0) {
      // 用户不存在，直接返回
      return {
        success: false,
        message: '用户不存在'
      };
    }
    
    // 用户存在，标记用户已退出登录
    const user = userResult.data[0];
    await userCollection.doc(user._id).update({
      data: {
        lastLogoutTime: db.serverDate(),
        isLoggedIn: false // 添加一个字段标记用户登录状态
      }
    });
    
    return {
      success: true,
      message: '退出登录成功'
    };
  } catch (error) {
    console.error('退出登录失败:', error);
    return {
      success: false,
      error: error.message
    };
  }
}; 