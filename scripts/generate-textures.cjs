/**
 * 扫描 public/magic 目录，自动生成贴图配置
 * 在 npm run dev / npm run build 前自动执行
 */
const fs = require('fs');
const path = require('path');

const MAGIC_DIR = path.join(__dirname, '../public/magic');
const OUTPUT_FILE = path.join(__dirname, '../src/generated/magic-textures.json');

// 分类配置
const CATEGORIES = {
  cute: { label: '萌物', icon: '🐱' },
  magic_circle: { label: '法阵', icon: '🔮' },
  star: { label: '星空', icon: '⭐' },
  rings: { label: '光环', icon: '💫' },
  myth: { label: '神兽', icon: '🐉' },
};

// 支持的图片格式
const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp', '.gif'];

function scanDirectory(dirPath) {
  const result = {};
  
  // 遍历分类目录
  for (const category of Object.keys(CATEGORIES)) {
    const categoryPath = path.join(dirPath, category);
    result[category] = [];
    
    if (!fs.existsSync(categoryPath)) {
      console.log(`  ⚠️ 目录不存在: ${category}/`);
      continue;
    }
    
    const files = fs.readdirSync(categoryPath)
      .filter(file => IMAGE_EXTENSIONS.includes(path.extname(file).toLowerCase()))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    
    files.forEach((file, index) => {
      const ext = path.extname(file);
      const baseName = path.basename(file, ext);
      result[category].push({
        value: `/magic/${category}/${file}`,
        label: `${CATEGORIES[category].label} ${index + 1}`,
        filename: file
      });
    });
    
    console.log(`  ✅ ${category}: ${files.length} 张图片`);
  }
  
  return result;
}

function main() {
  console.log('🔍 扫描法阵贴图目录...\n');
  
  // 确保输出目录存在
  const outputDir = path.dirname(OUTPUT_FILE);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  // 扫描并生成配置
  const textures = scanDirectory(MAGIC_DIR);
  
  // 计算总数
  const total = Object.values(textures).reduce((sum, arr) => sum + arr.length, 0);
  
  // 写入 JSON 文件
  const output = {
    generatedAt: new Date().toISOString(),
    categories: CATEGORIES,
    textures
  };
  
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2), 'utf-8');
  
  console.log(`\n✨ 完成！共 ${total} 张贴图`);
  console.log(`📄 配置已写入: src/generated/magic-textures.json\n`);
}

main();
