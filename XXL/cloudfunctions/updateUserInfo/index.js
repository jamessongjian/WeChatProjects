// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const usersCollection = db.collection('users')

// 获取用户状态（积分和VIP等级）
async function getUserStatus(openid) {
  try {
    console.log('获取用户状态，openid:', openid)
    
    const userQuery = await usersCollection.where({
      openid: openid
    }).get()
    
    if (userQuery.data.length === 0) {
      console.log('用户不存在，返回默认状态')
      return {
        success: true,
        data: {
          points: 0,
          userType: 'normal',
          assistantCount: 0,
          planningCount: 0,
          vipExpireDate: '2000-01-01',
          message: '用户不存在，返回默认状态'
        }
      }
    }
    
    const user = userQuery.data[0]
    console.log('找到用户，完整数据:', user)
    
    // 检查用户是否已登录
    if (user.isLoggedIn === false) {
      console.log('用户已退出登录，返回默认状态')
      return {
        success: true,
        data: {
          points: 0,
          userType: 'normal',
          assistantCount: 0,
          planningCount: 0,
          vipExpireDate: '2000-01-01',
          message: '用户已退出登录'
        }
      }
    }
    
    console.log('用户状态字段详情:', {
      points: user.points,
      userType: user.userType,
      assistantCount: user.assistantCount,
      planningCount: user.planningCount,
      vipExpireDate: user.vipExpireDate,
      lastUpgradeDate: user.lastUpgradeDate,
      isLoggedIn: user.isLoggedIn
    })
    
    const responseData = {
      points: user.points || 0,
      userType: user.userType || 'normal',
      assistantCount: user.assistantCount || 0,
      planningCount: user.planningCount || 0,
      vipExpireDate: user.vipExpireDate || '2000-01-01',
      lastUpdate: new Date().toISOString()
    }
    
    console.log('准备返回的数据:', responseData)
    
    return {
      success: true,
      data: responseData
    }
    
  } catch (error) {
    console.error('获取用户状态失败:', error)
    return {
      success: false,
      error: '获取用户状态失败: ' + error.message,
      data: {
        points: 0,
        userType: 'normal',
        assistantCount: 0,
        planningCount: 0,
        vipExpireDate: '2000-01-01'
      }
    }
  }
}

// VIP升级处理函数
async function upgradeVip(openid, upgradeData) {
  try {
    console.log('处理VIP升级，openid:', openid, 'upgradeData:', upgradeData)
    
    // 查询当前用户
    const userQuery = await usersCollection.where({
      openid: openid
    }).get()
    
    if (userQuery.data.length === 0) {
      console.log('用户不存在，无法升级')
      return {
        success: false,
        error: '用户不存在'
      }
    }
    
    const currentUser = userQuery.data[0]
    console.log('当前用户数据:', currentUser)
    
    // 更新用户数据
    const updateData = {
      userType: upgradeData.userType,
      points: upgradeData.points,
      assistantCount: upgradeData.assistantCount || 0,
      planningCount: upgradeData.planningCount || 0,
      vipExpireDate: upgradeData.vipExpireDate || '2000-01-01',
      lastUpgradeDate: db.serverDate(),
      isLoggedIn: true
    }
    
    console.log('准备更新的数据:', updateData)
    
    // 更新数据库
    const updateResult = await usersCollection.doc(currentUser._id).update({
      data: updateData
    })
    
    console.log('数据库更新结果:', updateResult)
    
    // 验证更新是否成功，重新查询用户数据
    const verifyQuery = await usersCollection.where({
      openid: openid
    }).get()
    
    if (verifyQuery.data.length > 0) {
      const updatedUser = verifyQuery.data[0]
      console.log('验证更新后的用户数据:', {
        userType: updatedUser.userType,
        points: updatedUser.points,
        assistantCount: updatedUser.assistantCount,
        planningCount: updatedUser.planningCount,
        vipExpireDate: updatedUser.vipExpireDate
      })
    }
    
    return {
      success: true,
      data: {
        ...updateData,
        message: 'VIP升级成功'
      }
    }
    
  } catch (error) {
    console.error('VIP升级失败:', error)
    return {
      success: false,
      error: error.message || 'VIP升级失败'
    }
  }
}

// 扣减智能助手次数
async function deductAssistantCount(openid) {
  try {
    console.log('扣减智能助手次数，openid:', openid)
    
    // 查询当前用户
    const userQuery = await usersCollection.where({
      openid: openid
    }).get()
    
    if (userQuery.data.length === 0) {
      console.log('用户不存在，无法扣减次数')
      return {
        success: false,
        error: '用户不存在'
      }
    }
    
    const currentUser = userQuery.data[0]
    console.log('当前用户数据:', currentUser)
    
    // 检查用户是否已登录
    if (currentUser.isLoggedIn === false) {
      console.log('用户已退出登录，无法扣减次数')
      return {
        success: false,
        error: '用户未登录'
      }
    }
    
    // 检查当前智能助手次数
    const currentAssistantCount = currentUser.assistantCount || 0
    
    if (currentAssistantCount <= 0) {
      console.log('智能助手次数不足，无法扣减')
      return {
        success: false,
        error: '智能助手次数不足'
      }
    }
    
    // 扣减次数
    const newAssistantCount = currentAssistantCount - 1
    
    // 更新数据库
    const updateResult = await usersCollection.doc(currentUser._id).update({
      data: {
        assistantCount: newAssistantCount,
        lastUsedDate: db.serverDate()
      }
    })
    
    console.log('智能助手次数扣减结果:', updateResult)
    
    return {
      success: true,
      data: {
        previousCount: currentAssistantCount,
        newCount: newAssistantCount,
        message: '智能助手次数扣减成功'
      }
    }
    
  } catch (error) {
    console.error('扣减智能助手次数失败:', error)
    return {
      success: false,
      error: error.message || '扣减智能助手次数失败'
    }
  }
}

// 扣减旅行规划次数
async function deductPlanningCount(openid) {
  try {
    console.log('扣减旅行规划次数，openid:', openid)
    
    // 查询当前用户
    const userQuery = await usersCollection.where({
      openid: openid
    }).get()
    
    if (userQuery.data.length === 0) {
      console.log('用户不存在，无法扣减次数')
      return {
        success: false,
        error: '用户不存在'
      }
    }
    
    const currentUser = userQuery.data[0]
    console.log('当前用户数据:', currentUser)
    
    // 检查用户是否已登录
    if (currentUser.isLoggedIn === false) {
      console.log('用户已退出登录，无法扣减次数')
      return {
        success: false,
        error: '用户未登录'
      }
    }
    
    // 检查当前旅行规划次数
    const currentPlanningCount = currentUser.planningCount || 0
    
    if (currentPlanningCount <= 0) {
      console.log('旅行规划次数不足，无法扣减')
      return {
        success: false,
        error: '旅行规划次数不足'
      }
    }
    
    // 扣减次数
    const newPlanningCount = currentPlanningCount - 1
    
    // 更新数据库
    const updateResult = await usersCollection.doc(currentUser._id).update({
      data: {
        planningCount: newPlanningCount,
        lastUsedDate: db.serverDate()
      }
    })
    
    console.log('旅行规划次数扣减结果:', updateResult)
    
    return {
      success: true,
      data: {
        previousCount: currentPlanningCount,
        newCount: newPlanningCount,
        message: '旅行规划次数扣减成功'
      }
    }
    
  } catch (error) {
    console.error('扣减旅行规划次数失败:', error)
    return {
      success: false,
      error: error.message || '扣减旅行规划次数失败'
    }
  }
}

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = event.openid || wxContext.OPENID
  
  console.log('==========================================')
  console.log('🔥 updateUserInfo 云函数被调用')
  console.log('⏰ 调用时间:', new Date().toLocaleString())
  console.log('📋 完整参数:', JSON.stringify(event, null, 2))
  
  // 测试模式处理
  if (event.test === true) {
    console.log('updateUserInfo云函数健康检查测试模式');
    return {
      success: true,
      test: true,
      message: 'updateUserInfo云函数测试成功'
    };
  }
  
  console.log('🎯 提取的action:', event.action)
  console.log('📝 action类型:', typeof event.action)
  console.log('✅ action匹配getUserStatus:', event.action === 'getUserStatus')
  console.log('🔑 event对象的所有键:', Object.keys(event))
  console.log('👤 openid:', openid)
  console.log('==========================================')
  
  // 检查操作类型
  const { action, userInfo, upgradeData } = event
  
  // 如果是获取用户状态
  if (action === 'getUserStatus') {
    console.log('匹配到getUserStatus操作，调用getUserStatus函数')
    const result = await getUserStatus(openid)
    console.log('getUserStatus返回结果:', JSON.stringify(result, null, 2))
    return result
  }
  
  // 如果是VIP升级
  if (action === 'upgradeVip') {
    console.log('匹配到upgradeVip操作，调用upgradeVip函数')
    const result = await upgradeVip(openid, upgradeData)
    console.log('upgradeVip返回结果:', JSON.stringify(result, null, 2))
    return result
  }
  
  // 如果是扣减智能助手次数
  if (action === 'deductAssistantCount') {
    console.log('匹配到deductAssistantCount操作，调用deductAssistantCount函数')
    const result = await deductAssistantCount(openid)
    console.log('deductAssistantCount返回结果:', JSON.stringify(result, null, 2))
    return result
  }
  
  // 如果是扣减旅行规划次数
  if (action === 'deductPlanningCount') {
    console.log('匹配到deductPlanningCount操作，调用deductPlanningCount函数')
    const result = await deductPlanningCount(openid)
    console.log('deductPlanningCount返回结果:', JSON.stringify(result, null, 2))
    return result
  }
  
  // 如果没有匹配的action，继续原有的更新用户信息逻辑
  
  if (!userInfo) {
    return {
      success: false,
      error: '未提供用户信息'
    }
  }
  
  try {
    // 查询当前用户
    const userQuery = await usersCollection.where({
      openid: openid
    }).get()
    
    // 如果用户不存在
    if (userQuery.data.length === 0) {
      console.log('用户不存在，尝试创建新用户');
      
      // 创建新用户记录
      const now = db.serverDate();
      
      // 构造新用户数据结构 - 不再自动设置points和userType
      const newUser = {
        openid: openid,
        nickName: userInfo.nickName || '小小鹿momo',
        avatarUrl: userInfo.avatarUrl || '/images/xiaoxiaolu_default_touxiang.jpg',
        phoneNumber: '',
        createDate: now,
        lastLoginDate: now,
        isLoggedIn: true // 设置为已登录状态
        // 移除了 points 和 userType 的自动设置
      };
      
      // 添加新用户记录
      const result = await usersCollection.add({
        data: newUser
      });
      
      const userId = result._id;
      
      // 获取新创建的用户信息
      const newUserData = await usersCollection.doc(userId).get();
      
      return {
        success: true,
        message: '用户不存在，已创建新用户',
        isNewUser: true,
        userId: userId,
        userInfo: newUserData.data
      };
    }
    
    // 获取用户ID
    const userId = userQuery.data[0]._id
    
    // 准备需要更新的数据
    const updateData = {}
    
    // 只允许更新特定字段
    if (userInfo.avatarUrl) {
      updateData.avatarUrl = userInfo.avatarUrl
    }
    
    if (userInfo.nickName) {
      updateData.nickName = userInfo.nickName
    }
    
    // 添加更新时间
    updateData.updateDate = db.serverDate()
    
    // 更新用户数据
    await usersCollection.doc(userId).update({
      data: updateData
    })
    
    // 查询更新后的用户信息
    const updatedUser = await usersCollection.doc(userId).get()
    
    return {
      success: true,
      message: '用户信息更新成功',
      userId: userId,
      userInfo: updatedUser.data
    }
  } catch (error) {
    console.error('更新用户信息失败:', error)
    
    // 根据错误类型返回不同的错误信息
    let errorMsg = '更新用户信息失败';
    
    if (error.errCode === -502005 || (error.errMsg && error.errMsg.includes('collection not exists'))) {
      errorMsg = '数据库集合不存在，请初始化数据库';
      
      return {
        success: false,
        error: errorMsg,
        dbError: true,
        errorCode: error.errCode || -502005,
        errorMsg: error.errMsg || '数据库集合不存在',
        details: JSON.stringify(error)
      };
    }
    
    return {
      success: false,
      error: errorMsg,
      details: error.message || JSON.stringify(error)
    }
  }
} 