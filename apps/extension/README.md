# @timenote/extension

Chrome Side Panel 扩展，Manifest V3。

## 开发

```bash
# 监听模式构建
pnpm dev:ext
# 或在 extension 目录下
pnpm dev
```

构建产物在 `dist/`，修改源码后自动重新构建。

## 本地安装

1. 构建生产版本：

```bash
pnpm build:ext
```

2. 打开 Chrome，访问 `chrome://extensions/`
3. 开启右上角「开发者模式」
4. 点击「加载已解压的扩展程序」，选择 `apps/extension/dist` 目录

> 修改代码后需重新 `pnpm build:ext`，然后在扩展管理页点击刷新按钮。

## 发布到 Chrome Web Store

1. 更新 `manifest.json` 中的 `version`
2. 构建：`pnpm build:ext`
3. 将 `dist/` 目录打包为 zip
4. 前往 [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole) 上传 zip

```bash
cd apps/extension && zip -r ../timenote-extension.zip dist/
```
