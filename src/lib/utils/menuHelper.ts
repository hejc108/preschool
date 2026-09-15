import { WeeklyMenu, DayOfWeek, MealCategory } from '../types/schema';

// Reference epoch: 2026-09-01 is Week 1
const EPOCH_START = new Date('2026-09-01T00:00:00Z');

/**
 * Calculates current menu week (1 to 4) based on modulo 4 arithmetic
 */
export function getCurrentMenuWeek(currentDate: Date = new Date()): number {
  const target = new Date(currentDate);
  target.setHours(0, 0, 0, 0);
  
  const diffTime = Math.max(0, target.getTime() - EPOCH_START.getTime());
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  const diffWeeks = Math.floor(diffDays / 7);
  
  return (diffWeeks % 4) + 1;
}

/**
 * Converts JavaScript Date.getDay() (0=Sun, 1=Mon...6=Sat) to DayOfWeek enum
 */
export function getDayOfWeekEnum(date: Date = new Date()): DayOfWeek {
  const day = date.getDay();
  switch (day) {
    case 1: return 'MONDAY';
    case 2: return 'TUESDAY';
    case 3: return 'WEDNESDAY';
    case 4: return 'THURSDAY';
    case 5: return 'FRIDAY';
    default: return 'MONDAY'; // Weekend defaults to Monday view
  }
}

/**
 * Helper to check if a dish contains an allergen matching student allergies string
 */
export function checkDishAllergen(dishName: string, dishAllergens: string[] | undefined, studentAllergies: string | undefined): { hasAllergen: boolean; warningLabel?: string } {
  if (!studentAllergies || studentAllergies.toLowerCase().includes('không') || studentAllergies.trim() === '') {
    return { hasAllergen: false };
  }

  const normalizedStudent = studentAllergies.toLowerCase();
  
  // Check dish allergens list
  if (dishAllergens && dishAllergens.length > 0) {
    for (const alg of dishAllergens) {
      if (normalizedStudent.includes(alg.toLowerCase()) || alg.toLowerCase().includes(normalizedStudent)) {
        return { hasAllergen: true, warningLabel: `Có ${alg}` };
      }
    }
  }

  // Check keywords in dish name
  const allergenKeywords = [
    { key: 'tôm', label: 'Hải sản / Tôm' },
    { key: 'hải sản', label: 'Hải sản' },
    { key: 'sữa', label: 'Sữa bò (Lactose)' },
    { key: 'trứng', label: 'Trứng' },
    { key: 'lạc', label: 'Đậu phộng' },
    { key: 'đậu phộng', label: 'Đậu phộng' }
  ];

  for (const item of allergenKeywords) {
    if (normalizedStudent.includes(item.key) && dishName.toLowerCase().includes(item.key)) {
      return { hasAllergen: true, warningLabel: `Có ${item.label}` };
    }
  }

  return { hasAllergen: false };
}

// FULL 4-WEEK ROTATING MENU SEED DATA (5 MEALS/DAY: BREAKFAST, LUNCH_MAIN, LUNCH_SOUP, DESSERT, AFTERNOON_SNACK)
export const INITIAL_4WEEK_MENU: WeeklyMenu[] = [
  // --- TUẦN 1 ---
  { id: 'm-w1-mon-1', week_number: 1, day_of_week: 'MONDAY', meal_type: 'BREAKFAST', dish_name: 'Cháo sườn non hạt sen', allergens: [] },
  { id: 'm-w1-mon-2', week_number: 1, day_of_week: 'MONDAY', meal_type: 'LUNCH_MAIN', dish_name: 'Thịt lợn rim nấm xào ngũ sắc', allergens: [] },
  { id: 'm-w1-mon-3', week_number: 1, day_of_week: 'MONDAY', meal_type: 'LUNCH_SOUP', dish_name: 'Canh bí đỏ thịt băm', allergens: [] },
  { id: 'm-w1-mon-4', week_number: 1, day_of_week: 'MONDAY', meal_type: 'DESSERT', dish_name: 'Dưa hấu tươi', allergens: [] },
  { id: 'm-w1-mon-5', week_number: 1, day_of_week: 'MONDAY', meal_type: 'AFTERNOON_SNACK', dish_name: 'Sữa học đường & Bánh flan', allergens: ['Sữa bò', 'Trứng'] },

  { id: 'm-w1-tue-1', week_number: 1, day_of_week: 'TUESDAY', meal_type: 'BREAKFAST', dish_name: 'Bún bò Huế nhỏ mầm non', allergens: [] },
  { id: 'm-w1-tue-2', week_number: 1, day_of_week: 'TUESDAY', meal_type: 'LUNCH_MAIN', dish_name: 'Cá hồi sốt cam tỏi', allergens: ['Hải sản'] },
  { id: 'm-w1-tue-3', week_number: 1, day_of_week: 'TUESDAY', meal_type: 'LUNCH_SOUP', dish_name: 'Canh mồng tơi nấu nghêu', allergens: ['Hải sản'] },
  { id: 'm-w1-tue-4', week_number: 1, day_of_week: 'TUESDAY', meal_type: 'DESSERT', dish_name: 'Chuối suôn chín ngọt', allergens: [] },
  { id: 'm-w1-tue-5', week_number: 1, day_of_week: 'TUESDAY', meal_type: 'AFTERNOON_SNACK', dish_name: 'Chè đậu xanh nước cốt dừa', allergens: [] },

  { id: 'm-w1-wed-1', week_number: 1, day_of_week: 'WEDNESDAY', meal_type: 'BREAKFAST', dish_name: 'Phở gà ta băm nhuyễn', allergens: [] },
  { id: 'm-w1-wed-2', week_number: 1, day_of_week: 'WEDNESDAY', meal_type: 'LUNCH_MAIN', dish_name: 'Tôm rim me ngọt mầm non', allergens: ['Tôm', 'Hải sản'] },
  { id: 'm-w1-wed-3', week_number: 1, day_of_week: 'WEDNESDAY', meal_type: 'LUNCH_SOUP', dish_name: 'Canh cải cúc thịt nạc băm', allergens: [] },
  { id: 'm-w1-wed-4', week_number: 1, day_of_week: 'WEDNESDAY', meal_type: 'DESSERT', dish_name: 'Xoài chín cắt miếng', allergens: [] },
  { id: 'm-w1-wed-5', week_number: 1, day_of_week: 'WEDNESDAY', meal_type: 'AFTERNOON_SNACK', dish_name: 'Sữa chua dầm dâu tây', allergens: ['Sữa bò'] },

  { id: 'm-w1-thu-1', week_number: 1, day_of_week: 'THURSDAY', meal_type: 'BREAKFAST', dish_name: 'Bánh mì gối kẹp mứt dâu & Sữa tươi', allergens: ['Sữa bò'] },
  { id: 'm-w1-thu-2', week_number: 1, day_of_week: 'THURSDAY', meal_type: 'LUNCH_MAIN', dish_name: 'Đậu phụ dồn thịt sốt cà chua', allergens: [] },
  { id: 'm-w1-thu-3', week_number: 1, day_of_week: 'THURSDAY', meal_type: 'LUNCH_SOUP', dish_name: 'Canh khoai mỡ nấu tôm tươi', allergens: ['Tôm', 'Hải sản'] },
  { id: 'm-w1-thu-4', week_number: 1, day_of_week: 'THURSDAY', meal_type: 'DESSERT', dish_name: 'Quýt đường ngọt', allergens: [] },
  { id: 'm-w1-thu-5', week_number: 1, day_of_week: 'THURSDAY', meal_type: 'AFTERNOON_SNACK', dish_name: 'Súp cua gà nấm tuyết', allergens: ['Hải sản', 'Trứng'] },

  { id: 'm-w1-fri-1', week_number: 1, day_of_week: 'FRIDAY', meal_type: 'BREAKFAST', dish_name: 'Bánh bơ nướng & Sữa hạt dinh dưỡng', allergens: ['Sữa bò'] },
  { id: 'm-w1-fri-2', week_number: 1, day_of_week: 'FRIDAY', meal_type: 'LUNCH_MAIN', dish_name: 'Chả lợn nướng lá lốt & Trứng cuộn', allergens: ['Trứng'] },
  { id: 'm-w1-fri-3', week_number: 1, day_of_week: 'FRIDAY', meal_type: 'LUNCH_SOUP', dish_name: 'Canh rau ngót nấu giàn cua', allergens: ['Hải sản'] },
  { id: 'm-w1-fri-4', week_number: 1, day_of_week: 'FRIDAY', meal_type: 'DESSERT', dish_name: 'Thạch rau câu trái cây', allergens: [] },
  { id: 'm-w1-fri-5', week_number: 1, day_of_week: 'FRIDAY', meal_type: 'AFTERNOON_SNACK', dish_name: 'Bánh bao nhân thịt trứng cút', allergens: ['Trứng'] },

  // --- TUẦN 2 (Khớp TC-MENU-01: Nui thịt heo, Gà kho mắm, Canh rau dền nấu tôm, Nabati, Bún cá) ---
  { id: 'm-w2-tue-1', week_number: 2, day_of_week: 'TUESDAY', meal_type: 'BREAKFAST', dish_name: 'Nui thịt heo băm rau củ', allergens: [] },
  { id: 'm-w2-tue-2', week_number: 2, day_of_week: 'TUESDAY', meal_type: 'LUNCH_MAIN', dish_name: 'Gà kho mắm gừng nhẹ mầm non', allergens: [] },
  { id: 'm-w2-tue-3', week_number: 2, day_of_week: 'TUESDAY', meal_type: 'LUNCH_SOUP', dish_name: 'Canh rau dền nấu tôm tươi', allergens: ['Tôm', 'Hải sản'] },
  { id: 'm-w2-tue-4', week_number: 2, day_of_week: 'TUESDAY', meal_type: 'DESSERT', dish_name: 'Bánh Nabati xốp mềm', allergens: ['Sữa bò'] },
  { id: 'm-w2-tue-5', week_number: 2, day_of_week: 'TUESDAY', meal_type: 'AFTERNOON_SNACK', dish_name: 'Bún cá rô đồng rút xương', allergens: ['Hải sản'] },

  { id: 'm-w2-mon-1', week_number: 2, day_of_week: 'MONDAY', meal_type: 'BREAKFAST', dish_name: 'Cháo lươn xứ Nghệ mềm mầm non', allergens: ['Hải sản'] },
  { id: 'm-w2-mon-2', week_number: 2, day_of_week: 'MONDAY', meal_type: 'LUNCH_MAIN', dish_name: 'Thịt bò xào khoai tây sợi', allergens: [] },
  { id: 'm-w2-mon-3', week_number: 2, day_of_week: 'MONDAY', meal_type: 'LUNCH_SOUP', dish_name: 'Canh bí xanh nấu sườn', allergens: [] },
  { id: 'm-w2-mon-4', week_number: 2, day_of_week: 'MONDAY', meal_type: 'DESSERT', dish_name: 'Táo Mỹ gọt vỏ', allergens: [] },
  { id: 'm-w2-mon-5', week_number: 2, day_of_week: 'MONDAY', meal_type: 'AFTERNOON_SNACK', dish_name: 'Sữa đậu nành & Bánh quy', allergens: [] },

  { id: 'm-w2-wed-1', week_number: 2, day_of_week: 'WEDNESDAY', meal_type: 'BREAKFAST', dish_name: 'Bánh mỳ gối phết bơ tỏi & Sữa', allergens: ['Sữa bò'] },
  { id: 'm-w2-wed-2', week_number: 2, day_of_week: 'WEDNESDAY', meal_type: 'LUNCH_MAIN', dish_name: 'Cá diêu hồng chiên xù', allergens: ['Hải sản'] },
  { id: 'm-w2-wed-3', week_number: 2, day_of_week: 'WEDNESDAY', meal_type: 'LUNCH_SOUP', dish_name: 'Canh chua cá chép thì là', allergens: ['Hải sản'] },
  { id: 'm-w2-wed-4', week_number: 2, day_of_week: 'WEDNESDAY', meal_type: 'DESSERT', dish_name: 'Chuối tây chín', allergens: [] },
  { id: 'm-w2-wed-5', week_number: 2, day_of_week: 'WEDNESDAY', meal_type: 'AFTERNOON_SNACK', dish_name: 'Cháo gà hạt sen', allergens: [] },

  { id: 'm-w2-thu-1', week_number: 2, day_of_week: 'THURSDAY', meal_type: 'BREAKFAST', dish_name: 'Bún mọc sườn non mầm non', allergens: [] },
  { id: 'm-w2-thu-2', week_number: 2, day_of_week: 'THURSDAY', meal_type: 'LUNCH_MAIN', dish_name: 'Thịt lợn kho trứng cút', allergens: ['Trứng'] },
  { id: 'm-w2-thu-3', week_number: 2, day_of_week: 'THURSDAY', meal_type: 'LUNCH_SOUP', dish_name: 'Canh bắp cải nấu thịt băm', allergens: [] },
  { id: 'm-w2-thu-4', week_number: 2, day_of_week: 'THURSDAY', meal_type: 'DESSERT', dish_name: 'Ổi hồng gọt vỏ', allergens: [] },
  { id: 'm-w2-thu-5', week_number: 2, day_of_week: 'THURSDAY', meal_type: 'AFTERNOON_SNACK', dish_name: 'Sữa chua nếp cẩm mầm non', allergens: ['Sữa bò'] },

  { id: 'm-w2-fri-1', week_number: 2, day_of_week: 'FRIDAY', meal_type: 'BREAKFAST', dish_name: 'Mỳ Ý sốt bò băm phô mai', allergens: ['Sữa bò'] },
  { id: 'm-w2-fri-2', week_number: 2, day_of_week: 'FRIDAY', meal_type: 'LUNCH_MAIN', dish_name: 'Chả mực Hạ Long viên nhỏ', allergens: ['Hải sản'] },
  { id: 'm-w2-fri-3', week_number: 2, day_of_week: 'FRIDAY', meal_type: 'LUNCH_SOUP', dish_name: 'Canh mồng tơi nấu cua đồng', allergens: ['Hải sản'] },
  { id: 'm-w2-fri-4', week_number: 2, day_of_week: 'FRIDAY', meal_type: 'DESSERT', dish_name: 'Cam sành vắt nước', allergens: [] },
  { id: 'm-w2-fri-5', week_number: 2, day_of_week: 'FRIDAY', meal_type: 'AFTERNOON_SNACK', dish_name: 'Bánh su kem mầm non', allergens: ['Sữa bò', 'Trứng'] },

  // --- TUẦN 3 ---
  { id: 'm-w3-mon-1', week_number: 3, day_of_week: 'MONDAY', meal_type: 'BREAKFAST', dish_name: 'Cháo tôm bí đỏ dinh dưỡng', allergens: ['Tôm', 'Hải sản'] },
  { id: 'm-w3-mon-2', week_number: 3, day_of_week: 'MONDAY', meal_type: 'LUNCH_MAIN', dish_name: 'Thịt đùi lợn rim dừa thơm', allergens: [] },
  { id: 'm-w3-mon-3', week_number: 3, day_of_week: 'MONDAY', meal_type: 'LUNCH_SOUP', dish_name: 'Canh tần xá nấu thịt', allergens: [] },
  { id: 'm-w3-mon-4', week_number: 3, day_of_week: 'MONDAY', meal_type: 'DESSERT', dish_name: 'Dưa lê ngọt mầm non', allergens: [] },
  { id: 'm-w3-mon-5', week_number: 3, day_of_week: 'MONDAY', meal_type: 'AFTERNOON_SNACK', dish_name: 'Sữa tươi & Bánh quy bơ', allergens: ['Sữa bò'] },

  { id: 'm-w3-tue-1', week_number: 3, day_of_week: 'TUESDAY', meal_type: 'BREAKFAST', dish_name: 'Bánh giầy giò nạc nhỏ', allergens: [] },
  { id: 'm-w3-tue-2', week_number: 3, day_of_week: 'TUESDAY', meal_type: 'LUNCH_MAIN', dish_name: 'Cá basa sốt cà chua', allergens: ['Hải sản'] },
  { id: 'm-w3-tue-3', week_number: 3, day_of_week: 'TUESDAY', meal_type: 'LUNCH_SOUP', dish_name: 'Canh bí đỏ nấu tôm', allergens: ['Tôm', 'Hải sản'] },
  { id: 'm-w3-tue-4', week_number: 3, day_of_week: 'TUESDAY', meal_type: 'DESSERT', dish_name: 'Đu đủ chín', allergens: [] },
  { id: 'm-w3-tue-5', week_number: 3, day_of_week: 'TUESDAY', meal_type: 'AFTERNOON_SNACK', dish_name: 'Chè hạt sen đậu đỏ', allergens: [] },

  { id: 'm-w3-wed-1', week_number: 3, day_of_week: 'WEDNESDAY', meal_type: 'BREAKFAST', dish_name: 'Phở bò chín mầm non', allergens: [] },
  { id: 'm-w3-wed-2', week_number: 3, day_of_week: 'WEDNESDAY', meal_type: 'LUNCH_MAIN', dish_name: 'Gà chiên mắm bơ thơm', allergens: [] },
  { id: 'm-w3-wed-3', week_number: 3, day_of_week: 'WEDNESDAY', meal_type: 'LUNCH_SOUP', dish_name: 'Canh khoai mỡ nấu thịt', allergens: [] },
  { id: 'm-w3-wed-4', week_number: 3, day_of_week: 'WEDNESDAY', meal_type: 'DESSERT', dish_name: 'Chuối ngự', allergens: [] },
  { id: 'm-w3-wed-5', week_number: 3, day_of_week: 'WEDNESDAY', meal_type: 'AFTERNOON_SNACK', dish_name: 'Súp ngô ngọt gà xé', allergens: ['Trứng'] },

  { id: 'm-w3-thu-1', week_number: 3, day_of_week: 'THURSDAY', meal_type: 'BREAKFAST', dish_name: 'Cháo thịt băm cà rốt', allergens: [] },
  { id: 'm-w3-thu-2', week_number: 3, day_of_week: 'THURSDAY', meal_type: 'LUNCH_MAIN', dish_name: 'Tôm hấp nước dừa mầm non', allergens: ['Tôm', 'Hải sản'] },
  { id: 'm-w3-thu-3', week_number: 3, day_of_week: 'THURSDAY', meal_type: 'LUNCH_SOUP', dish_name: 'Canh rau ngót nấu thịt băm', allergens: [] },
  { id: 'm-w3-thu-4', week_number: 3, day_of_week: 'THURSDAY', meal_type: 'DESSERT', dish_name: 'Mận Hà Nội ngâm ngọt', allergens: [] },
  { id: 'm-w3-thu-5', week_number: 3, day_of_week: 'THURSDAY', meal_type: 'AFTERNOON_SNACK', dish_name: 'Bánh nướng đậu xanh & Sữa', allergens: ['Sữa bò'] },

  { id: 'm-w3-fri-1', week_number: 3, day_of_week: 'FRIDAY', meal_type: 'BREAKFAST', dish_name: 'Bún chả lợn mầm non', allergens: [] },
  { id: 'm-w3-fri-2', week_number: 3, day_of_week: 'FRIDAY', meal_type: 'LUNCH_MAIN', dish_name: 'Bò nướng tảng viên bơ', allergens: [] },
  { id: 'm-w3-fri-3', week_number: 3, day_of_week: 'FRIDAY', meal_type: 'LUNCH_SOUP', dish_name: 'Canh chua tôm thơm', allergens: ['Tôm', 'Hải sản'] },
  { id: 'm-w3-fri-4', week_number: 3, day_of_week: 'FRIDAY', meal_type: 'DESSERT', dish_name: 'Dưa hấu đỏ', allergens: [] },
  { id: 'm-w3-fri-5', week_number: 3, day_of_week: 'FRIDAY', meal_type: 'AFTERNOON_SNACK', dish_name: 'Sữa chua nha đam mầm non', allergens: ['Sữa bò'] },

  // --- TUẦN 4 (Khớp TC-MENU-03: Canh cải thảo tôm) ---
  { id: 'm-w4-mon-1', week_number: 4, day_of_week: 'MONDAY', meal_type: 'BREAKFAST', dish_name: 'Cháo cua đồng hạt kê', allergens: ['Hải sản'] },
  { id: 'm-w4-mon-2', week_number: 4, day_of_week: 'MONDAY', meal_type: 'LUNCH_MAIN', dish_name: 'Thịt lợn luộc chấm sốt cà', allergens: [] },
  { id: 'm-w4-mon-3', week_number: 4, day_of_week: 'MONDAY', meal_type: 'LUNCH_SOUP', dish_name: 'Canh bí xanh tôm tươi', allergens: ['Tôm', 'Hải sản'] },
  { id: 'm-w4-mon-4', week_number: 4, day_of_week: 'MONDAY', meal_type: 'DESSERT', dish_name: 'Táo ta gọt vỏ', allergens: [] },
  { id: 'm-w4-mon-5', week_number: 4, day_of_week: 'MONDAY', meal_type: 'AFTERNOON_SNACK', dish_name: 'Sữa hạt sen dừa', allergens: [] },

  { id: 'm-w4-tue-1', week_number: 4, day_of_week: 'TUESDAY', meal_type: 'BREAKFAST', dish_name: 'Nui xào bò mầm non', allergens: [] },
  { id: 'm-w4-tue-2', week_number: 4, day_of_week: 'TUESDAY', meal_type: 'LUNCH_MAIN', dish_name: 'Cá quả rim gừng thơm', allergens: ['Hải sản'] },
  { id: 'm-w4-tue-3', week_number: 4, day_of_week: 'TUESDAY', meal_type: 'LUNCH_SOUP', dish_name: 'Canh rau cải nấu nạc băm', allergens: [] },
  { id: 'm-w4-tue-4', week_number: 4, day_of_week: 'TUESDAY', meal_type: 'DESSERT', dish_name: 'Dưa gang ngọt', allergens: [] },
  { id: 'm-w4-tue-5', week_number: 4, day_of_week: 'TUESDAY', meal_type: 'AFTERNOON_SNACK', dish_name: 'Bánh mỳ phết bơ & Sữa', allergens: ['Sữa bò'] },

  { id: 'm-w4-wed-1', week_number: 4, day_of_week: 'WEDNESDAY', meal_type: 'BREAKFAST', dish_name: 'Phở gà rắc hành hoa mầm non', allergens: [] },
  { id: 'm-w4-wed-2', week_number: 4, day_of_week: 'WEDNESDAY', meal_type: 'LUNCH_MAIN', dish_name: 'Trứng chiên thịt nạc & Xúc xích', allergens: ['Trứng'] },
  { id: 'm-w4-wed-3', week_number: 4, day_of_week: 'WEDNESDAY', meal_type: 'LUNCH_SOUP', dish_name: 'Canh mồng tơi nấu tôm khô', allergens: ['Tôm', 'Hải sản'] },
  { id: 'm-w4-wed-4', week_number: 4, day_of_week: 'WEDNESDAY', meal_type: 'DESSERT', dish_name: 'Chuối suôn chín', allergens: [] },
  { id: 'm-w4-wed-5', week_number: 4, day_of_week: 'WEDNESDAY', meal_type: 'AFTERNOON_SNACK', dish_name: 'Chè khoai môn cốt dừa', allergens: [] },

  { id: 'm-w4-thu-1', week_number: 4, day_of_week: 'THURSDAY', meal_type: 'BREAKFAST', dish_name: 'Bánh mì sandwich mứt cam', allergens: [] },
  { id: 'm-w4-thu-2', week_number: 4, day_of_week: 'THURSDAY', meal_type: 'LUNCH_MAIN', dish_name: 'Gà sốt teriyaki mầm non', allergens: [] },
  { id: 'm-w4-thu-3', week_number: 4, day_of_week: 'THURSDAY', meal_type: 'LUNCH_SOUP', dish_name: 'Canh bắp cải nấu thịt', allergens: [] },
  { id: 'm-w4-thu-4', week_number: 4, day_of_week: 'THURSDAY', meal_type: 'DESSERT', dish_name: 'Bưởi da xanh tách tép', allergens: [] },
  { id: 'm-w4-thu-5', week_number: 4, day_of_week: 'THURSDAY', meal_type: 'AFTERNOON_SNACK', dish_name: 'Sữa chua hoa quả dầm', allergens: ['Sữa bò'] },

  { id: 'm-w4-fri-1', week_number: 4, day_of_week: 'FRIDAY', meal_type: 'BREAKFAST', dish_name: 'Cháo sườn non hạt kê', allergens: [] },
  { id: 'm-w4-fri-2', week_number: 4, day_of_week: 'FRIDAY', meal_type: 'LUNCH_MAIN', dish_name: 'Thịt lợn viên sốt nấm', allergens: [] },
  { id: 'm-w4-fri-3', week_number: 4, day_of_week: 'FRIDAY', meal_type: 'LUNCH_SOUP', dish_name: 'Canh cải thảo tôm tươi', allergens: ['Tôm', 'Hải sản'] },
  { id: 'm-w4-fri-4', week_number: 4, day_of_week: 'FRIDAY', meal_type: 'DESSERT', dish_name: 'Thạch dừa xiêm', allergens: [] },
  { id: 'm-w4-fri-5', week_number: 4, day_of_week: 'FRIDAY', meal_type: 'AFTERNOON_SNACK', dish_name: 'Bánh mì nướng bơ đường & Sữa tươi', allergens: ['Sữa bò'] }
];
