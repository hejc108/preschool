import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // TONE CHỦ ĐẠO: XANH LƠ (SKY / CYAN / SOFT BLUE)
        primary: {
          50: '#F0F9FF',   // Nền siêu nhạt
          100: '#E0F2FE',  // Hover, viền mềm
          200: '#BAE6FD',  // Badge nền nhẹ
          300: '#7DD3FC',  // Điểm nhấn phụ
          400: '#38BDF8',  // Cyan tươi sáng
          500: '#0EA5E9',  // Xanh lơ chủ đạo (Sky Blue chính)
          600: '#0284C7',  // Màu nút chính, text quan trọng
          700: '#0369A1',  // Màu viền hoặc header sidebar
        },
        // TONE NỀN: TRẮNG SÁNG & SẠCH SẼ
        surface: {
          base: '#F8FAFC',    // Nền trang tổng thể (Light Slate/Ice White)
          light: '#F8FAFC',   // Alias tương thích
          card: '#FFFFFF',    // Nền bảng, card trắng tinh
          border: '#E2E8F0',  // Đường kẻ viền mờ tinh tế
          sidebar: '#F0F9FF', // Sidebar xanh lơ nhạt
          muted: '#64748B',   // Text phụ mờ nhẹ
        },
        accent: {
          gold: '#D4A373',
          warm: '#FEF3C7',
          goldDark: '#B45309',
        },
        kitchen: {
          badge: '#E0F2FE',
          text: '#0284C7',
          border: '#BAE6FD',
        },
        status: {
          validGreen: '#10B981',
          lateAmber: '#F59E0B',
          dangerSoft: '#EF4444',
        }
      },
      borderRadius: {
        'convent': '1rem',
        'pill': '9999px',
      }
    },
  },
  plugins: [],
};
export default config;
