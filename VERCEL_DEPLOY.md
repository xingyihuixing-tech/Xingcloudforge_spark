# Vercel 部署指南

## 部署步骤

### 1. 准备工作
确保您已经有 Gemini API Key。如果没有,请访问:
https://makersuite.google.com/app/apikey

### 2. 部署到 Vercel

#### 方式一: 通过 Vercel CLI
```bash
# 安装 Vercel CLI
npm i -g vercel

# 登录
vercel login

# 部署
vercel
```

#### 方式二: 通过 Vercel 网站
1. 访问 https://vercel.com
2. 点击 "Import Project"
3. 导入您的 Git 仓库或上传项目文件夹
4. Vercel 会自动检测到这是一个 Vite 项目

### 3. 配置环境变量 (重要!)

在 Vercel 项目设置中添加环境变量:

1. 进入项目 Dashboard
2. 点击 "Settings" → "Environment Variables"
3. 添加以下变量:

```
Name: VITE_GEMINI_API_KEY
Value: 您的 Gemini API Key
Environment: Production, Preview, Development (全选)
```

**注意**: 
- 必须使用 `VITE_` 前缀,这样 Vite 才能在构建时注入环境变量
- 不要将 API Key 提交到代码库中
- `.env.local` 文件只用于本地开发

### 4. 重新部署
添加环境变量后,点击 "Redeploy" 重新部署项目

### 5. 验证部署
访问 Vercel 提供的 URL,检查应用是否正常运行

## 本地开发

```bash
# 1. 复制环境变量模板
cp .env.example .env.local

# 2. 编辑 .env.local,填入您的 API Key
# GEMINI_API_KEY=your_actual_api_key

# 3. 安装依赖
npm install

# 4. 启动开发服务器
npm run dev
```

## 故障排除

### API Key 不生效
- 确认环境变量名称为 `VITE_GEMINI_API_KEY`
- 确认已在 Vercel 中正确配置
- 重新部署项目

### 构建失败
- 检查 `package.json` 中的依赖是否完整
- 查看 Vercel 构建日志获取详细错误信息
