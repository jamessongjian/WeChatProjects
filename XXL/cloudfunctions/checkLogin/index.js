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
  
  console.log('检查用户登录状态, openid:', openid);
  
  // 测试模式处理
  if (event.test === true) {
    console.log('checkLogin云函数健康检查测试模式');
    return {
      success: true,
      test: true,
      message: 'checkLogin云函数测试成功'
    };
  }
  
  try {
    // 查询用户是否存在 - 修复字段名错误
    const userResult = await userCollection.where({
      openid: openid  // 修改为正确的字段名
    }).get();
    
    if (userResult.data.length === 0) {
      // 用户不存在
      return {
        success: false,
        isLogin: false,
        message: '用户未登录'
      };
    }
    
    // 用户存在，检查登录状态
    const user = userResult.data[0];
    
    // 如果用户存在但标记为未登录，返回未登录状态
    if (user.isLoggedIn === false) {
      return {
        success: true,
        isLogin: false,
        message: '用户未登录'
      };
    }
    
    // 用户已登录，返回完整的用户信息（包括VIP权益）
    console.log('用户已登录，返回完整信息:', {
      userType: user.userType,
      points: user.points,
      assistantCount: user.assistantCount,
      planningCount: user.planningCount,
      vipExpireDate: user.vipExpireDate
    });
    
    return {
      success: true,
      isLogin: true,
      user: {
        // 基本信息
        _id: user._id,
        openid: user.openid,
        nickName: user.nickName,
        avatarUrl: user.avatarUrl,
        createDate: user.createDate,
        lastLoginDate: user.lastLoginDate,
        
        // VIP权益信息
        userType: user.userType || 'normal',
        points: user.points || 0,
        assistantCount: user.assistantCount || 0,
        planningCount: user.planningCount || 0,
        vipExpireDate: user.vipExpireDate || '2000-01-01',
        
        // 登录状态
        isLoggedIn: user.isLoggedIn !== false
      }
    };
  } catch (error) {
    console.error('检查登录状态失败:', error);
    return {
      success: false,
      isLogin: false,
      error: error.message
    };
  }
}; 