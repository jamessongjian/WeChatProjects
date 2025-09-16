#!/bin/bash

# 微信云开发函数部署脚本
echo "开始部署微信云函数..."

# 进入云函数目录
cd cloudfunctions

# 安装并部署统一的 fetchServerData 云函数
echo "部署 fetchServerData 云函数（统一数据获取）..."
cd fetchServerData
npm install
cd ..

# 返回项目根目录
cd ..

echo "云函数部署完成！"
echo ""
echo "请在微信开发者工具中："
echo "1. 确保已开通云开发服务"
echo "2. 右键点击 cloudfunctions/fetchServerData 文件夹"
echo "3. 选择 '创建并部署：云端安装依赖（不上传node_modules）'"
echo ""
echo "🚀 统一云函数优势："
echo "✅ 所有服务端数据获取统一管理"
echo "✅ API端点完全隐藏在云端"
echo "✅ 敏感配置信息零暴露"
echo "✅ 支持多种数据获取操作"
echo "✅ 统一的错误处理和日志记录"
echo "✅ 更强的抗抓包能力"
echo "✅ 支持未登录用户访问公开数据"
echo ""
echo "支持的操作："
echo "- getParkData: 获取游乐场数据"
echo "- getItemOtherInfo: 获取项目补充信息"
echo "- getServerConfig: 获取服务端配置"
echo "- submitSubscription: 提交订阅信息"
echo "- getUserSubscriptions: 获取用户订阅"
echo "- getAttractionHistory: 获取项目历史排队时间"
echo ""
echo "支持的游乐场："
echo "- universal: 北京环球影城度假区"
echo "- disney: 上海迪士尼乐园"
echo "- chimelong: 广州长隆欢乐世界"
echo ""
echo "支持的数据类型："
echo "- attraction: 游乐项目"
echo "- performance: 表演项目"
echo "- restaurant: 餐厅"
echo "- restroom: 洗手间"
echo "- charger: 充电宝"
echo "- shop/shops: 商店（部分游乐场启用）"
