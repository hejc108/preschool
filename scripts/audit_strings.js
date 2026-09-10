const fs = require('fs');
const path = require('path');

const projectRoot = path.join(__dirname, '..');
const viPath = path.join(projectRoot, 'src/locales/vi.json');
const enPath = path.join(projectRoot, 'src/locales/en.json');

const vi = JSON.parse(fs.readFileSync(viPath, 'utf8'));
const en = JSON.parse(fs.readFileSync(enPath, 'utf8'));

function getNestedValue(obj, keyPath) {
  const parts = keyPath.split('.');
  let curr = obj;
  for (const p of parts) {
    if (curr && typeof curr === 'object' && p in curr) {
      curr = curr[p];
    } else {
      return null;
    }
  }
  return typeof curr === 'string' ? curr : null;
}

const targetFiles = [
  { section: 'Xác Thực System (Auth)', route: '/auth', file: 'src/app/auth/page.tsx' },
  { section: 'Admin Web Portal - Khung Giao Diện (Layout & Sidebar)', route: '/admin (Layout)', file: 'src/app/admin/layout.tsx' },
  { section: 'Admin Web Portal - Bảng Điều Hành', route: '/admin/dashboard', file: 'src/app/admin/dashboard/page.tsx' },
  { section: 'Admin Web Portal - Giám Sát Bếp Ăn', route: '/admin/kitchen', file: 'src/app/admin/kitchen/page.tsx' },
  { section: 'Admin Web Portal - Hồ Sơ Bé', route: '/admin/students', file: 'src/app/admin/students/page.tsx' },
  { section: 'Admin Web Portal - Ghi Danh Nhập Học', route: '/admin/admissions', file: 'src/app/admin/admissions/page.tsx' },
  { section: 'Teacher Mobile PWA', route: '/teacher', file: 'src/app/teacher/page.tsx' },
  { section: 'Parent Mobile PWA', route: '/parent', file: 'src/app/parent/page.tsx' },
  { section: 'Components Dung Chung', route: 'Component', file: 'src/components/LanguageSwitcher.tsx' }
];

let markdownOutput = `# BẢNG ĐỐI SOẢN VĂN BẢN GIAO DIỆN HỆ THỐNG (UI STRINGS AUDIT)
**Dự án:** Hệ Sinh Thái Quản Lý Mầm Non Sương Mai (Trường Dòng Mầm Non Đa Minh)  
**Ngày thực hiện:** ${new Date().toISOString().split('T')[0]}  
**Mục tiêu:** Rà soát toàn bộ chuỗi văn bản tĩnh, nhãn nút bấm, thông báo, tiêu đề trên 3 phân hệ để PO nghiệm thu.

---

`;

for (const tf of targetFiles) {
  const fullPath = path.join(projectRoot, tf.file);
  if (!fs.existsSync(fullPath)) continue;

  const content = fs.readFileSync(fullPath, 'utf8');
  const lines = content.split('\n');

  markdownOutput += `### ${tf.section} - \`${tf.route}\` (\`${tf.file}\`)\n\n`;
  markdownOutput += `| STT | File & Dòng Code | Vị trí / Loại UI | Text Tiếng Việt đang hiển thị | Text Tiếng Anh (nếu có) | PO Chốt Tiếng Việt | PO Chốt Tiếng Anh |\n`;
  markdownOutput += `|:---:|:---|:---|:---|:---|:---|:---|\n`;

  let stt = 1;
  lines.forEach((lineText, idx) => {
    const lineNum = idx + 1;
    const codeRef = `\`${tf.file}:${lineNum}\``;

    // Match t('key')
    const tMatches = [...lineText.matchAll(/t\(\s*['"]([^'"]+)['"]\s*\)/g)];
    for (const match of tMatches) {
      const key = match[1];
      const viVal = getNestedValue(vi, key) || key;
      const enVal = getNestedValue(en, key) || '';

      let uiType = 'Chuỗi văn bản (i18n)';
      if (lineText.includes('<h1') || lineText.includes('<h2') || lineText.includes('<h3') || lineText.includes('<h4')) {
        uiType = 'Tiêu đề (Header)';
      } else if (lineText.includes('<button') || lineText.includes('btn_')) {
        uiType = 'Nút bấm (Button)';
      } else if (lineText.includes('<Link') || lineText.includes('href=')) {
        uiType = 'Liên kết (Link / Menu)';
      } else if (lineText.includes('<th') || lineText.includes('col_')) {
        uiType = 'Tên cột bảng (Table Header)';
      } else if (lineText.includes('placeholder')) {
        uiType = 'Gợi ý nhập liệu (Placeholder)';
      } else if (lineText.includes('badge') || lineText.includes('rounded-pill')) {
        uiType = 'Huy hiệu / Trạng thái (Badge)';
      } else if (lineText.includes('label')) {
        uiType = 'Nhãn Form (Form Label)';
      }

      markdownOutput += `| ${stt++} | ${codeRef} | ${uiType} | ${viVal.replace(/\|/g, '\\|')} | ${enVal.replace(/\|/g, '\\|')} | | |\n`;
    }

    // Match hardcoded strings inside JSX elements or alerts/placeholders
    const alertMatches = [...lineText.matchAll(/alert\(\s*[`'"]([^`'"]+)[`'"]\s*\)/g)];
    for (const match of alertMatches) {
      const rawText = match[1].replace(/\${[^}]+}/g, '[Giá trị]').trim();
      if (rawText && !lineText.includes("t('")) {
        markdownOutput += `| ${stt++} | ${codeRef} | Thông báo (Alert Dialog) | ${rawText.replace(/\|/g, '\\|')} | | | |\n`;
      }
    }

    // Match option values/labels
    const optionMatches = [...lineText.matchAll(/<option[^>]*>([^<]+)<\/option>/g)];
    for (const match of optionMatches) {
      const optText = match[1].trim();
      if (optText && !optText.startsWith('{')) {
        markdownOutput += `| ${stt++} | ${codeRef} | Lựa chọn Dropdown (Option) | ${optText.replace(/\|/g, '\\|')} | | | |\n`;
      }
    }

    // Match hardcoded tags/labels in flex-wrap tag buttons
    const tagMatches = [...lineText.matchAll(/['"](#[\w_]+|🌡️[^'"]+|🏡[^'"]+|✈️[^'"]+|🩺[^'"]+)['"]/g)];
    for (const match of tagMatches) {
      const tagText = match[1];
      if (tagText && !lineText.includes('selectedTags')) {
        markdownOutput += `| ${stt++} | ${codeRef} | Thẻ Ghi Chú / Tag | ${tagText.replace(/\|/g, '\\|')} | | | |\n`;
      }
    }
  });

  markdownOutput += `\n---\n\n`;
}

fs.writeFileSync(path.join(projectRoot, 'UI_STRINGS_AUDIT.md'), markdownOutput, 'utf8');
console.log('Successfully generated UI_STRINGS_AUDIT.md');
