// 云函数入口文件
const cloud = require('wx-server-sdk')

// 初始化云函数
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

// 获取数据库引用
const db = cloud.database()

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID;
  
  console.log('初始化数据库请求, openid:', openid);
  
  // 需要初始化的集合和它们的初始文档
  const collections = [
    { 
      name: 'users',
      initialDoc: {
        _id: 'system_initialize_record',
        openid: 'system',
        nickName: 'System',
        avatarUrl: '',
        createDate: new Date(),
        lastLoginDate: new Date(),
        userType: 'system'
      }
    },
    // 可以在这里添加其他需要初始化的集合
  ];
  
  const results = {};
  
  console.log('开始初始化数据库集合');
  
  try {
    // 检查云环境
    const envInfo = {
      env: process.env.TCB_ENV || cloud.DYNAMIC_CURRENT_ENV,
      runtime: process.env.TENCENTCLOUD_SERVICE_RUNTIME_ENV
    };
    console.log('当前云环境信息:', envInfo);
    
    // 检查并创建每个集合
    for (const collection of collections) {
      const collectionName = collection.name;
      
      try {
        // 尝试查询集合，看是否存在
        await db.collection(collectionName).limit(1).get();
        results[collectionName] = `集合 ${collectionName} 已存在`;
        console.log(`集合 ${collectionName} 已存在`);
      } catch (error) {
        // 如果集合不存在，尝试创建它
        if (error.errCode === -502005 || (error.errMsg && error.errMsg.indexOf('collection not exists') > -1)) {
          try {
            // 创建集合
            const result = await db.createCollection(collectionName);
            results[collectionName] = `集合 ${collectionName} 创建成功`;
            console.log(`集合 ${collectionName} 创建成功`, result);
            
            // 添加初始化文档
            if (collection.initialDoc) {
              try {
                const addResult = await db.collection(collectionName).add({
                  data: collection.initialDoc
                });
                
                console.log(`添加初始文档到${collectionName}成功`, addResult);
                results[`${collectionName}_init`] = `初始文档添加成功`;
              } catch (addError) {
                console.error(`添加初始文档到${collectionName}失败:`, addError);
                results[`${collectionName}_init`] = `初始文档添加失败: ${addError.errMsg || JSON.stringify(addError)}`;
              }
            }
          } catch (createErr) {
            if (createErr.errCode === -501001 || (createErr.errMsg && createErr.errMsg.indexOf('collection has exists') > -1)) {
              results[collectionName] = `集合 ${collectionName} 已存在`;
              console.log(`集合 ${collectionName} 已存在`);
            } else {
              results[collectionName] = `创建集合 ${collectionName} 失败: ${createErr.errMsg || JSON.stringify(createErr)}`;
              console.error(`创建集合 ${collectionName} 失败:`, createErr);
            }
          }
        } else {
          results[collectionName] = `检查集合 ${collectionName} 失败: ${error.errMsg || JSON.stringify(error)}`;
          console.error(`检查集合 ${collectionName} 失败:`, error);
        }
      }
    }
    
    // 检查是否添加了当前用户的记录
    try {
      // 查询是否存在当前用户的记录
      const userQuery = await db.collection('users').where({
        openid: openid
      }).get();
      
      if (userQuery.data.length === 0 && openid !== 'system' && openid) {
        // 添加当前用户的记录
        const now = new Date();
        const defaultPoints = 0; // 默认积分改为0
        const newUser = {
          openid: openid,
          nickName: '小小鹿momo',
          avatarUrl: '/images/xiaoxiaolu_default_touxiang.jpg',
          createDate: now,
          lastLoginDate: now,
          userType: 'normal', // 默认普通用户
          points: defaultPoints, // 默认积分0
          // 新增VIP相关字段
          assistantCount: 0, // 智能助手次数
          planningCount: 0, // 旅行规划次数
          vipExpireDate: '2000-01-01', // VIP有效期
          isLoggedIn: true // 设置为已登录状态
        };
        
        try {
          const addResult = await db.collection('users').add({
            data: newUser
          });
          
          console.log('添加当前用户记录成功', addResult);
          results['current_user'] = '当前用户记录添加成功';
        } catch (addError) {
          console.error('添加当前用户记录失败:', addError);
          results['current_user'] = `添加当前用户记录失败: ${addError.errMsg || JSON.stringify(addError)}`;
        }
      } else {
        console.log('当前用户记录已存在');
        results['current_user'] = '当前用户记录已存在';
      }
    } catch (error) {
      console.error('检查当前用户记录失败:', error);
      results['current_user'] = `检查当前用户记录失败: ${error.errMsg || JSON.stringify(error)}`;
    }
    
    return {
      success: true,
      message: '数据库初始化完成',
      results: results,
      openid: openid,
      env: envInfo
    }
  } catch (error) {
    console.error('初始化数据库失败:', error);
    return {
      success: false,
      error: error.message || JSON.stringify(error),
      results: results,
      openid: openid
    }
  }
} 