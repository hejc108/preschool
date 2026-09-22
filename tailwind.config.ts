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
        // TONE CHỦ ĐẠO: ĐỎ ẤM (WARM RED - LẤY TỪ NGỌN ĐUỐC LOGO SƯƠNG MAI)
        primary: {
          50: '#FFEBEE',   // Nền hồng nhạt dịu
          100: '#FFCDD2',  // Hover nhẹ, viền mềm
          200: '#EF9A9A',  // Badge nền nhẹ
          300: '#E57373',  // Điểm nhấn phụ
          400: '#EF5350',  // Đỏ sáng
          500: '#F44336',  // Đỏ ngọn đuốc tươi
          600: '#E53935',  // Màu nút chính, text quan trọng
          700: '#D32F2F',  // Màu chủ đạo ngọn đuốc Logo Sương Mai (#D32F2F)
          800: '#C62828',  // Deep red active state
          900: '#B71C1C',  // Border đậm
        },
        // TONE PHỤ: VÀNG CAM (WARM GOLD / ORANGE - LẤY TỪ CHÂN ĐẾ LOGO SƯƠNG MAI)
        secondary: {
          50: '#FFF3E0',   // Nền cam nhạt
          100: '#FFE0B2',  // Badge viền
          200: '#FFCC80',  // Accent nhẹ
          300: '#FFB74D',  // Vàng cam
          400: '#FFA726',  // Cam nhã nhặn (#FFA726)
          500: '#FF9800',  // Cam chân đế
          600: '#FB8C00',  // Chân đế Logo Sương Mai chính (#FB8C00)
          700: '#F57C00',  // Cam đậm
        },
        // TONE NỀN: TRẮNG SÁNG ẤM & SẠCH SẼ
        surface: {
          base: '#FFFDF9',    // Nền trang tổng thể (Warm White)
          light: '#FFFDF9',   // Alias tương thích
          card: '#FFFFFF',    // Nền bảng, card trắng tinh
          border: '#F0EAE1',  // Đường kẻ viền mờ tinh tế
          sidebar: '#FFF9F5', // Sidebar trắng kem ấm
          muted: '#786F66',   // Text phụ mờ nhẹ
        },
        accent: {
          gold: '#FB8C00',
          warm: '#FFF3E0',
          goldDark: '#F57C00',
        },
        kitchen: {
          badge: '#FFEBEE',
          text: '#D32F2F',
          border: '#FFCDD2',
        },
        status: {
          validGreen: '#10B981',
          lateAmber: '#FB8C00',
          dangerSoft: '#E53935',
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
