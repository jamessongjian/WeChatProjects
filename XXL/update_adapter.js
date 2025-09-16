const fs = require("fs");const path = require("path");const filePath = "utils/dataAdapter.js";let content = fs.readFileSync(filePath, "utf8");
content = content.replace(/if \(mapping\.openTime && mapping\.openTimeMapper\) {\n      attraction\.openTime = mapping\.openTimeMapper\(this\.getFieldValue\(item, mapping\.openTime\)\);\n    }/g, "if (mapping.openTime && mapping.openTimeMapper) {
      attraction.openTime = mapping.openTimeMapper(this.getFieldValue(item, mapping.openTime));
    }

    // 处理关闭时间
    if (mapping.closeTime) {
      const closeTime = this.getFieldValue(item, mapping.closeTime);
      if (closeTime) {
        attraction.closeTime = closeTime;
        // 如果已有openTime但没有包含结束时间，则组合展示
        if (attraction.openTime && !attraction.openTime.includes(\"-\")) {
          attraction.openTime = `${attraction.openTime}-${closeTime}`;
        }
      }
    }");
content = content.replace(/if \(mapping\.openTime && mapping\.openTimeMapper\) {\n      performance\.openTime = mapping\.openTimeMapper\(this\.getFieldValue\(item, mapping\.openTime\)\);\n    }/g, "if (mapping.openTime && mapping.openTimeMapper) {
      performance.openTime = mapping.openTimeMapper(this.getFieldValue(item, mapping.openTime));
    }

    // 处理关闭时间
    if (mapping.closeTime) {
      const closeTime = this.getFieldValue(item, mapping.closeTime);
      if (closeTime) {
        performance.closeTime = closeTime;
        // 如果已有openTime但没有包含结束时间，则组合展示
        if (performance.openTime && !performance.openTime.includes(\"-\")) {
          performance.openTime = `${performance.openTime}-${closeTime}`;
        }
      }
    }");
fs.writeFileSync(filePath, content, "utf8");console.log("数据适配器已更新");
