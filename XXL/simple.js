var fs = require("fs"); var content = fs.readFileSync("utils/dataAdapter.js", "utf8"); content = content.replace("this.openTime = data.openTime || ;", "this.openTime = data.openTime || ;
    this.closeTime = data.closeTime || ;"); fs.writeFileSync("utils/dataAdapter.js", content);
