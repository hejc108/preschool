// Auto-generated & enriched presets for FR-02 Sương Mai Kindergarten

export interface PosterTemplate {
  id: string;
  code: string;
  name: string;
  defaultTitle: string;
  defaultBody: string;
  defaultTime: string;
  defaultLocation: string;
  defaultDeadline: string;
  defaultAudience: string;
  showTable: boolean;
  defaultTable?: {
    row1Label: string;
    row1Amt: string;
    row2Label: string;
    row2Amt: string;
  };
}

export interface AnnouncementMetadata {
  template_id?: string;
  is_bg_enabled?: boolean;
  custom_bg_url?: string | null;
  audience?: string;
  cards_visibility?: {
    time?: boolean;
    location?: boolean;
    table?: boolean;
    deadline?: boolean;
    seal?: boolean;
  };
  time_value?: string;
  location_value?: string;
  deadline_value?: string;
  table_data?: {
    row1_label?: string;
    row1_amt?: string;
    row2_label?: string;
    row2_amt?: string;
  };
  voice?: string;
  voice_type?: string;
  music?: string;
  background_music?: string;
  audio_url?: string | null;
  audio_synced?: boolean;
  has_poster?: boolean;
  has_audio?: boolean;
  is_urgent?: boolean;
  requires_acknowledgement?: boolean;
}

export interface AnnouncementItem {
  id: string;
  title: string;
  content: string;
  category?: string;
  status?: "DRAFT" | "PENDING_APPROVAL" | "PUBLISHED" | "ARCHIVED";
  target_role?: "ALL" | "TEACHER" | "PARENT";
  notification_channel?: "TEACHER" | "PARENT";
  class_id?: string | null;
  metadata?: AnnouncementMetadata;
  created_at?: string;
  updated_at?: string;
  created_by?: string | null;
  is_read?: boolean;
  read_at?: string | null;
  read_count?: number;
  total_target_count?: number;
  is_urgent?: boolean;
  requires_acknowledgement?: boolean;
  audio_url?: string | null;
  voice_type?: string;
  background_music?: string;
}

export const EMBEDDED_BACKGROUNDS: Record<string, string> = {
  "giay-moi": "/images/announcements/giay-moi.jpg",
  "le-hoi": "/images/announcements/le-hoi.jpg",
  "nghi-le": "/images/announcements/nghi-le.jpg",
  "lich-hoc": "/images/announcements/lich-hoc.jpg",
  "hoc-phi": "/images/announcements/hoc-phi.jpg",
  "thuc-don": "/images/announcements/thuc-don.jpg",
  "hoat-dong": "/images/announcements/hoat-dong.jpg",
  "da-ngoai": "/images/announcements/da-ngoai.jpg",
  "suc-khoe": "/images/announcements/suc-khoe.jpg",
  "khan-cap": "/images/announcements/khan-cap.jpg",
  "noi-bo": "/images/announcements/noi-bo.jpg",
  // Khóa ánh xạ dự phòng cho ngày 20/11 & các sự kiện lễ hội
  "20-11": "/images/announcements/le-hoi.jpg",
  "20/11": "/images/announcements/le-hoi.jpg",
  "nha-giao": "/images/announcements/le-hoi.jpg",
  "ngay-nha-giao": "/images/announcements/le-hoi.jpg",
};

export const POSTER_TEMPLATES: PosterTemplate[] = [
  {
    "id": "giay-moi",
    "code": "01",
    "name": "Giấy mời",
    "defaultTitle": "Giấy Mời Họp Phụ Huynh Đầu Năm Học 2026 - 2027",
    "defaultBody": "Trân trọng kính mời Quý Phụ huynh đến tham dự buổi họp triển khai kế hoạch chăm sóc, nuôi dưỡng và giáo dục trẻ năm học mới tại lớp học của bé.",
    "defaultTime": "08:00 Thứ Bảy, 19/09/2026",
    "defaultLocation": "Phòng học các lớp Khối Mầm - Chồi - Lá",
    "defaultDeadline": "Kính mong Quý Phụ huynh có mặt đúng giờ • Hotline BGH: 0262.352.1234",
    "defaultAudience": "Toàn trường",
    "showTable": false
  },
  {
    "id": "le-hoi",
    "code": "02",
    "name": "Lễ hội",
    "defaultTitle": "Lễ Hội Trăng Rằm & Vui Tết Trung Thu",
    "defaultBody": "Trân trọng kính mời Quý Phụ huynh cùng các bé đến tham dự chương trình \"Đêm Hội Trăng Rằm\" với nhiều tiết mục múa lân, rước đèn ông sao và phá cỗ trông trăng đầy ý nghĩa.",
    "defaultTime": "18:30 Thứ Năm, 24/09/2026\n(Tức ngày 14 tháng 08 Âm lịch)",
    "defaultLocation": "Sân khấu chính - Trường Mầm non Sương Mai",
    "defaultDeadline": "Trang phục lễ hội truyền thống • Hỗ trợ BGH: 0262.352.1234",
    "defaultAudience": "Toàn trường",
    "showTable": false
  },
  {
    "id": "nghi-le",
    "code": "03",
    "name": "Nghỉ lễ/Nghỉ hè",
    "defaultTitle": "Thông Báo Lịch Nghỉ Lễ & Trực Ban BGH",
    "defaultBody": "Nhà trường trân trọng thông báo lịch nghỉ lễ tới toàn thể Quý Phụ huynh. Kính chúc gia đình và các bé có kỳ nghỉ lễ thật vui vẻ, an toàn và ấm áp.",
    "defaultTime": "Nghỉ từ 01/09 đến hết ngày 03/09/2026",
    "defaultLocation": "Toàn thể học sinh đi học lại: Thứ Năm, 04/09/2026",
    "defaultDeadline": "Hotline trực ban BGH nhà trường: 0262.352.1234",
    "defaultAudience": "Toàn trường",
    "showTable": false
  },
  {
    "id": "lich-hoc",
    "code": "04",
    "name": "Điều chỉnh lịch học",
    "defaultTitle": "Điều Chỉnh Giờ Đón & Trả Trẻ Mùa Đông",
    "defaultBody": "Để đảm bảo sức khỏe cho các bé khi thời tiết chuyển lạnh, nhà trường điều chỉnh khung giờ đón trẻ buổi sáng và trả trẻ buổi chiều áp dụng từ tuần tới.",
    "defaultTime": "Đón trẻ: 07:15 - 08:00 • Trả trẻ: 16:30 - 17:15",
    "defaultLocation": "Khu vực sảnh đón chính và các lớp học",
    "defaultDeadline": "Áp dụng từ Thứ Hai, 02/11/2026 • BGH: 0262.352.1234",
    "defaultAudience": "Toàn trường",
    "showTable": false
  },
  {
    "id": "hoc-phi",
    "code": "05",
    "name": "Học phí",
    "defaultTitle": "Thông Báo Khoản Thu Học Phí & Tiền Ăn Tháng 11",
    "defaultBody": "Nhà trường gửi tới Quý Phụ huynh bảng kê chi tiết các khoản thu bán trú tháng 11. Phụ huynh vui lòng hoàn thành đúng thời hạn quy định.",
    "defaultTime": "Thời hạn thanh toán: Từ 01/11 đến hết 10/11/2026",
    "defaultLocation": "Văn phòng Kế toán hoặc Chuyển khoản ngân hàng",
    "defaultDeadline": "STK Vietcombank: 0231.000.6789 - Mầm non Sương Mai",
    "defaultAudience": "Toàn trường",
    "showTable": true,
    "defaultTable": {
      "row1Label": "Học phí bán trú tháng 11",
      "row1Amt": "1.250.000 đ",
      "row2Label": "Tiền ăn (22 ngày x 35.000đ)",
      "row2Amt": "770.000 đ"
    }
  },
  {
    "id": "thuc-don",
    "code": "06",
    "name": "Thực đơn",
    "defaultTitle": "Thực Đơn Bán Trú & Dinh Dưỡng Tuần Mới",
    "defaultBody": "Thực đơn được xây dựng cân đối 4 nhóm chất dinh dưỡng theo chuẩn Bộ GD&ĐT. Phụ huynh có bé dị ứng thực phẩm vui lòng báo lại giáo viên chủ nhiệm.",
    "defaultTime": "Áp dụng tuần 2 (Từ 09/11 đến 13/11/2026)",
    "defaultLocation": "Bếp ăn một chiều đạt chuẩn ATTP Sương Mai",
    "defaultDeadline": "Bé ăn sáng: 07:30 • Trưa: 10:45 • Xế chiều: 14:15",
    "defaultAudience": "Toàn trường",
    "showTable": true,
    "defaultTable": {
      "row1Label": "Bữa chính trưa",
      "row1Amt": "Cơm dẻo + Tôm rim thịt + Canh bí đỏ",
      "row2Label": "Bữa phụ chiều",
      "row2Amt": "Sữa chua hạt sen + Bánh flan"
    }
  },
  {
    "id": "hoat-dong",
    "code": "07",
    "name": "Hoạt động",
    "defaultTitle": "Ngày Hội Sáng Tạo & Khám Phá Khoa Học",
    "defaultBody": "Các bé sẽ được tham gia trải nghiệm vẽ tranh, quan sát thiên nhiên và trưng bày sản phẩm nghệ thuật ngay tại khuôn viên sân trường.",
    "defaultTime": "08:30 - 10:30 Thứ Sáu, 16/10/2026",
    "defaultLocation": "Khuôn viên vườn cổ tích & sân trường Sương Mai",
    "defaultDeadline": "Bé mặc trang phục thoải mái, mang giày quai hậu",
    "defaultAudience": "Khối Chồi & Khối Lá",
    "showTable": false
  },
  {
    "id": "da-ngoai",
    "code": "08",
    "name": "Dã ngoại",
    "defaultTitle": "Kế Hoạch Tham Quan Nông Trại Xanh Của Bé",
    "defaultBody": "Nhà trường tổ chức chuyến tham quan thực tế giúp các bé khám phá thiên nhiên. Phụ huynh chuẩn bị mũ, bình nước cá nhân và cho bé mặc đồng phục trường.",
    "defaultTime": "07:30 - 11:30 Thứ Bảy, 21/11/2026",
    "defaultLocation": "Nông trại giáo dục sinh thái Krông Pắc",
    "defaultDeadline": "Tập trung tại sảnh trường lúc 07:15 sáng • BGH: 0262.352.1234",
    "defaultAudience": "Khối Lá (5-6 tuổi)",
    "showTable": false
  },
  {
    "id": "suc-khoe",
    "code": "09",
    "name": "Y tế / Khám sức khỏe",
    "defaultTitle": "Lịch Khám Sức Khỏe Định Kỳ & Đo Chỉ Số WHO Đợt 1",
    "defaultBody": "Bộ phận Y tế nhà trường phối hợp cùng Trạm Y tế khám tổng quát (Răng - Hàm - Mặt, Tai - Mũi - Họng, cân đo chỉ số WHO) cho 100% trẻ đang theo học.",
    "defaultTime": "08:00 - 11:00 Ngày 15/10/2026",
    "defaultLocation": "Phòng Y tế Trường Mầm non Sương Mai",
    "defaultDeadline": "Phụ huynh cho bé đi học đầy đủ và đúng giờ • BGH: 0262.352.1234",
    "defaultAudience": "Toàn trường",
    "showTable": false
  },
  {
    "id": "khan-cap",
    "code": "10",
    "name": "Cảnh báo khẩn",
    "defaultTitle": "THÔNG BÁO KHẨN: Cho Trẻ Nghỉ Học Phòng Tránh Bão",
    "defaultBody": "Thực hiện công điện khẩn của Phòng GD&ĐT, nhà trường thông báo cho toàn thể học sinh nghỉ học ngày mai để đảm bảo an toàn tuyệt đối cho các bé.",
    "defaultTime": "Nghỉ học từ ngày mai cho đến khi có thông báo mới",
    "defaultLocation": "Học sinh ở nhà cùng phụ huynh để đảm bảo an toàn",
    "defaultDeadline": "Đường dây nóng hỗ trợ khẩn cấp 24/7: 0262.352.1234",
    "defaultAudience": "Toàn trường",
    "showTable": false
  },
  {
    "id": "noi-bo",
    "code": "11",
    "name": "Thông báo nội bộ",
    "defaultTitle": "Lịch Họp Hội Đồng Sư Phạm & Chuyên Môn Tháng 11",
    "defaultBody": "Kính mời toàn thể Cán bộ, Giáo viên nhà trường tham dự buổi họp chuyên môn định kỳ. Đề nghị các tổ chuẩn bị đầy đủ hồ sơ sổ sách theo phân công.",
    "defaultTime": "17:30 Thứ Sáu, 06/11/2026",
    "defaultLocation": "Hội trường tầng 2 - Trường Mầm non Sương Mai",
    "defaultDeadline": "100% Cán bộ, Giáo viên, Nhân viên có mặt đúng giờ",
    "defaultAudience": "Cán bộ & Giáo viên",
    "showTable": false
  }
];
