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
  
  // 检查当前云环境
  if (event.getEnv) {
    return {
      success: true,
      env: process.env.TENCENTCLOUD_SERVICE_RUNTIME_ENV || cloud.DYNAMIC_CURRENT_ENV,
      openid,
      message: '环境检查成功'
    };
  }
  
  // 仅检查云函数状态
  if (event.checkOnly) {
    return {
      success: true,
      functionName: 'login',
      status: 'active',
      time: new Date().toISOString(),
      openid,
      message: '云函数运行正常'
    };
  }
  
  const { userInfo, forceDbAccess } = event;
  
  console.log('登录请求, openid:', openid, '用户信息:', userInfo, '强制访问数据库:', forceDbAccess);
  
  // 强制访问数据库，确保每次登录都检查数据库连接
  if (forceDbAccess) {
    try {
      // 尝试访问用户集合，检查是否存在
      await userCollection.limit(1).get();
      console.log('数据库访问成功，users集合存在');
    } catch (dbError) {
      console.error('数据库访问失败:', dbError);
      // 返回数据库错误，但不中断登录流程
      return {
        success: true, // 登录仍然成功
        dbError: dbError.errMsg || JSON.stringify(dbError),
        openid,
        errorCode: dbError.errCode || -1,
        time: new Date().toISOString()
      };
    }
  }
  
  try {
    // 查询用户是否已存在
    const { data: existingUsers } = await userCollection.where({
      openid: openid
    }).get();
    
    let userId;
    let userData;
    
    if (existingUsers && existingUsers.length > 0) {
      // 已存在的用户，更新登录时间
      const user = existingUsers[0];
      userId = user._id;
      
      // 更新最后登录时间和登录状态
      await userCollection.doc(userId).update({
        data: {
          lastLoginDate: db.serverDate(),
          isLoggedIn: true
        }
      });
      
      // 重新获取更新后的用户信息
      const { data } = await userCollection.doc(userId).get();
      userData = data;
      
      console.log('已有用户登录，ID:', userId);
    } else {
      // 新用户，创建用户记录
      const now = db.serverDate();
      
      // 构造新用户数据结构
      const defaultPoints = 0; // 默认积分改为0
      const newUser = {
        openid: openid,
        nickName: userInfo?.nickName || '小小鹿momo', // 使用传入的昵称或默认昵称
        avatarUrl: userInfo?.avatarUrl || '/images/xiaoxiaolu_default_touxiang.jpg', // 使用传入的头像或默认头像
        phoneNumber: '', // 默认为空
        createDate: now,
        lastLoginDate: now,
        userType: 'normal', // 默认普通用户
        chatRemaining: 0, // 默认对话次数
        planRemaining: 0, // 默认规划次数
        points: defaultPoints, // 默认积分0
        // 新增VIP相关字段
        assistantCount: 0, // 智能助手次数
        planningCount: 0, // 旅行规划次数
        vipExpireDate: '2000-01-01', // VIP有效期
        isLoggedIn: true, // 设置为已登录状态
      };
      
      // 添加新用户记录
      const result = await userCollection.add({
        data: newUser
      });
      
      userId = result._id;
      
      // 获取新创建的用户信息
      const { data } = await userCollection.doc(userId).get();
      userData = data;
      
      console.log('新用户注册成功，ID:', userId);
    }
    
    return {
      success: true,
      dbSuccess: true, // 标记数据库操作成功
      userId,
      userInfo: userData,
      openid,
      time: new Date().toISOString()
    };
  } catch (error) {
    console.error('登录处理失败:', error);
    
    // 根据错误类型返回不同的错误信息
    let errorMsg = '登录失败，请重试';
    let errorCode = -1;
    
    if (error.errCode) {
      errorCode = error.errCode;
      if (error.errCode === -502005) {
        errorMsg = '数据库集合不存在，请初始化数据库';
      }
    }
    
    return {
      success: false,
      error: errorMsg,
      errorCode: errorCode,
      dbError: error.errMsg || JSON.stringify(error),
      openid,
      errorDetail: JSON.stringify(error)
    };
  }
}; 