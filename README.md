# 药师帮数据整理助手

这是一个 Chrome MV3 扩展，用于整理 `https://dian.ysbang.cn/#/indexContent` 的搜索结果。插件只捕获 `/wholesale-drug/sales/getWholesaleList/v4270` 响应被页面解密并 `JSON.parse` 后的结构化商品数据，并在页面右侧显示悬窗，整理出品名、单价、库存、商家、厂家、有效期、包邮、追溯码、限购等字段，支持筛选、复制 CSV/JSON、下载 CSV/JSON。

## 安装

1. 打开 Chrome 的 `chrome://extensions/`。
2. 开启“开发者模式”。
3. 点击“加载已解压的扩展程序”。
4. 选择本仓库根目录。
5. 如果药师帮页面已经打开，刷新一次页面，让主世界脚本从页面启动时开始监听。

## 使用

1. 打开 `https://dian.ysbang.cn/#/indexContent`。
2. 在网站里正常搜索商品。
3. 接口解析到商品数据后，页面右侧会自动出现“药师帮数据整理助手”悬窗。
4. 使用右侧悬窗里的筛选、复制或下载按钮整理当前页结果；点击悬窗右上角按钮可最小化到右侧，再点击侧边小按钮可展开。

## 说明

- 当前版本只捕获页面解密并 `JSON.parse` 后的商品数组，适配 `/wholesale-drug/sales/getWholesaleList/v4270` 这类加密响应。
- 仅在当前 URL 为 `https://dian.ysbang.cn/#/indexContent` 且捕获到接口解析结果时显示右侧悬窗。
- 不再从页面商品卡片读取数据；如果没有捕获到接口解析结果，不会显示整理悬窗。
- 库存固定读取 `joinCarMap.stockAvailable`。
- 数据仅在当前页面内整理和导出，不会上传到外部服务。
