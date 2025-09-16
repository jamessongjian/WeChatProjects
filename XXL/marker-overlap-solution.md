# Marker重叠处理解决方案

## 功能概述

在地图页面中，当多个marker的位置距离在10米以内时，系统会自动调整其中一个marker的位置，避免视觉上的重叠。

## 实现原理

### 1. 重叠检测
- 使用Haversine公式计算两个marker之间的实际距离
- 当距离小于10米阈值时，判定为重叠
- **碰撞规则**：
  - 游乐项目(attraction)和演出(performance)之间会检测碰撞（因为会一起显示）
  - 其他类型（餐厅、充电宝、卫生间等）只在同类型内检测碰撞

### 2. 位置调整策略
- **方向性调整**: 沿着两点连线方向移动重叠的marker
- **垂直偏移**: 添加垂直方向的偏移，避免所有调整都在同一直线上
- **圆形分散**: 对于完全重合的点，使用8个方向均匀分散
- **动态距离**: 根据迭代次数增加调整距离，确保彻底解决重叠

### 3. 迭代优化
- 最多进行5次迭代，确保复杂重叠情况也能得到解决
- 每次迭代增加调整距离，避免反复重叠

## 配置参数

```javascript
const MARKER_OVERLAP_CONFIG = {
  threshold: 10,               // 重叠检测阈值（米）
  adjustmentDistance: 0.000045, // 调整距离（经纬度），约10米偏移
  maxIterations: 5,            // 最大迭代次数
  enableVisualFeedback: true   // 是否启用视觉反馈
};
```

## 核心函数

### `shouldCheckCollision(marker1, marker2)`
碰撞检测规则函数，负责：
- 判断两个marker是否需要进行碰撞检测
- 游乐项目和演出之间需要检测碰撞
- 其他类型只在同类型内检测碰撞
- 返回布尔值表示是否需要检测

### `adjustOverlappingMarkers(markers)`
主要的重叠处理函数，负责：
- 检测所有marker之间的距离
- 识别重叠的marker对
- 调用位置调整算法
- 记录调整信息并提供反馈

### `calculateAdjustedPosition(lat1, lng1, lat2, lng2, adjustmentDistance, iteration)`
位置调整算法，包含：
- 动态距离计算
- 方向向量计算
- 垂直偏移添加
- 特殊情况处理（完全重合点）

## 使用方式

该功能已集成到`calculateMarkerPositions`函数中，会在marker位置计算完成后自动执行：

```javascript
// 处理marker重叠问题
this.adjustOverlappingMarkers(markers);
```

## 调试信息

在开发者工具中，可以通过控制台查看详细的调整日志：
- 重叠检测过程
- 每次位置调整的详细信息
- 调整前后的距离对比
- 最终调整统计

## 性能考虑

- 时间复杂度：O(n²) × 迭代次数
- 对于大量marker，建议在聚合前进行重叠处理
- 使用缓存机制避免重复计算

## 测试建议

1. **基本重叠测试**: 创建两个距离5米的marker，验证调整效果
2. **多点重叠测试**: 创建3-4个相近的marker，测试迭代调整
3. **完全重合测试**: 创建相同坐标的marker，测试圆形分散
4. **边界情况测试**: 测试9.9米和10.1米的距离边界

## 注意事项

- 调整后的marker位置可能与实际地理位置略有偏差
- 在高缩放级别下，调整效果更明显
- 原始位置信息会保存在`originalPosition`属性中
- 被调整的marker会标记`isAdjusted: true`
