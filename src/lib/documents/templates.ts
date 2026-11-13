import { DocumentTemplateCode } from '@/lib/types/schema';

export interface DocumentTemplateMeta {
  code: DocumentTemplateCode;
  name: string;
  label: string;
  categoryCodeFallback: string;
  defaultSymbol: string;
  description: string;
  initialHtml: string;
}

export const DOCUMENT_TEMPLATES: DocumentTemplateMeta[] = [
  {
    code: 'CONG_VAN',
    name: 'Công văn hành chính',
    label: 'Công văn hành chính',
    categoryCodeFallback: 'CV_DEN_DI',
    defaultSymbol: 'CV-MNSM',
    description: 'Dùng cho thông báo, hướng dẫn nghiệp vụ và điều hành nội bộ',
    initialHtml: `
<p style="text-align: center;"><strong>V/v hướng dẫn triển khai nhiệm vụ trọng tâm tháng ... năm học 2026 - 2027</strong></p>
<p style="text-align: center;">Kính gửi: Các tổ chuyên môn, cán bộ, giáo viên, nhân viên nhà trường</p>
<p>Thực hiện kế hoạch năm học 2026 - 2027 của Trường Mầm non Sương Mai, Ban Giám hiệu nhà trường hướng dẫn các tổ chuyên môn, cán bộ, giáo viên và nhân viên triển khai các nhiệm vụ trọng tâm sau:</p>
<p><strong>1. Công tác nuôi dưỡng, chăm sóc và giáo dục trẻ</strong></p>
<p>- Tiếp tục duy trì nghiêm túc nền nếp đón - trả trẻ, bảo đảm an toàn tuyệt đối về thể chất và tinh thần cho trẻ trong toàn trường.</p>
<p>- Thực hiện đúng chế độ sinh hoạt một ngày theo lứa tuổi; đổi mới hình thức tổ chức hoạt động học và chơi lấy trẻ làm trung tâm.</p>
<p><strong>2. Công tác vệ sinh an toàn thực phẩm và y tế học đường</strong></p>
<p>- Bếp ăn thực hiện nghiêm quy trình giao nhận thực phẩm, lưu mẫu thức ăn 24 giờ và bảo đảm thực đơn cân đối dưỡng chất.</p>
<p>- Bộ phận y tế theo dõi sát sao tình hình sức khỏe, cập nhật sổ theo dõi và kịp thời phát hiện các bệnh truyền nhiễm mùa vụ.</p>
<p><strong>3. Tổ chức thực hiện</strong></p>
<p>- Tổ trưởng các tổ chuyên môn chịu trách nhiệm phổ biến và kiểm tra việc thực hiện của giáo viên trong tổ.</p>
<p>Đề nghị các bộ phận nghiêm túc triển khai thực hiện./.</p>
`.trim(),
  },
  {
    code: 'QUYET_DINH',
    name: 'Quyết định (V/v...)',
    label: 'Quyết định (V/v...)',
    categoryCodeFallback: 'CV_DEN_DI',
    defaultSymbol: 'QĐ-MNSM',
    description: 'Dùng thành lập hội đồng, ban hành quy chế hoặc quyết định nhân sự',
    initialHtml: `
<p style="text-align: center;"><strong>QUYẾT ĐỊNH</strong></p>
<p style="text-align: center;"><strong>Về việc thành lập Hội đồng kiểm tra nội bộ năm học 2026 - 2027</strong></p>
<p style="text-align: center;"><strong>HIỆU TRƯỞNG TRƯỜNG MẦM NON SƯƠNG MAI</strong></p>
<p style="text-align: justify;"><em>Căn cứ Điều lệ trường mầm non ban hành kèm theo Thông tư số 52/2020/TT-BGDĐT ngày 31/12/2020 của Bộ trưởng Bộ Giáo dục và Đào tạo;</em></p>
<p style="text-align: justify;"><em>Căn cứ Kế hoạch thực hiện nhiệm vụ năm học 2026 - 2027 của Trường Mầm non Sương Mai;</em></p>
<p style="text-align: justify;"><em>Xét đề nghị của Phó Hiệu trưởng phụ trách chuyên môn,</em></p>
<p style="text-align: center;"><strong>QUYẾT ĐỊNH:</strong></p>
<p style="text-align: justify;"><strong>Điều 1.</strong> Thành lập Hội đồng kiểm tra nội bộ Trường Mầm non Sương Mai năm học 2026 - 2027 gồm các ông (bà) có tên sau:</p>
<p style="text-align: justify;">1. Bà Hiệu trưởng - Chủ tịch Hội đồng;</p>
<p style="text-align: justify;">2. Bà Phó Hiệu trưởng chuyên môn - Phó Chủ tịch Hội đồng;</p>
<p style="text-align: justify;">3. Các Tổ trưởng chuyên môn - Ủy viên.</p>
<p style="text-align: justify;"><strong>Điều 2.</strong> Hội đồng có nhiệm vụ xây dựng kế hoạch, tổ chức kiểm tra định kỳ và đột xuất các hoạt động chăm sóc, nuôi dưỡng, giáo dục trẻ và quản lý tài sản, cơ sở vật chất theo quy định.</p>
<p style="text-align: justify;"><strong>Điều 3.</strong> Các bộ phận liên quan và các ông (bà) có tên tại Điều 1 chịu trách nhiệm thi hành Quyết định này kể từ ngày ký./.</p>
`.trim(),
  },
  {
    code: 'KE_HOACH',
    name: 'Kế hoạch tổ chức / hoạt động',
    label: 'Kế hoạch tổ chức / hoạt động',
    categoryCodeFallback: 'KE_HOACH',
    defaultSymbol: 'KH-MNSM',
    description: 'Dùng xây dựng kế hoạch chuyên đề, sự kiện lễ hội, dã ngoại',
    initialHtml: `
<p style="text-align: center;"><strong>KẾ HOẠCH</strong></p>
<p style="text-align: center;"><strong>Tổ chức chuyên đề hoạt động trải nghiệm cho trẻ mầm non năm học 2026 - 2027</strong></p>
<p><strong>I. MỤC ĐÍCH, YÊU CẦU</strong></p>
<p><strong>1. Mục đích:</strong></p>
<p>- Giúp trẻ phát triển kỹ năng quan sát, tư duy phản biện và khả năng hợp tác nhóm thông qua các hoạt động thực tế.</p>
<p>- Tạo môi trường học tập thân thiện, sáng tạo và an toàn cho trẻ.</p>
<p><strong>2. Yêu cầu:</strong></p>
<p>- Đảm bảo an toàn tuyệt đối cho 100% trẻ tham gia.</p>
<p>- Nội dung trải nghiệm phù hợp với đặc điểm tâm sinh lý lứa tuổi mầm non.</p>
<p><strong>II. NỘI DUNG VÀ HÌNH THỨC TỔ CHỨC</strong></p>
<p>- Thời gian tổ chức: Dự kiến từ ngày ... đến ngày ...</p>
<p>- Địa điểm: Khuôn viên sân trường và vườn thực nghiệm trường Mầm non Sương Mai.</p>
<p>- Đối tượng tham gia: Trẻ các khối Mẫu giáo Bé, Nhỡ, Lớn.</p>
<p><strong>III. PHÂN CÔNG NHIỆM VỤ</strong></p>
<p>- Tổ Chuyên môn: Xây dựng giáo án chi tiết và chuẩn bị đồ dùng trải nghiệm.</p>
<p>- Bộ phận Y tế: Chuẩn bị tủ thuốc sơ cấp cứu và kiểm tra điều kiện y tế sân bãi.</p>
<p>- Bộ phận Nhà bếp: Chuẩn bị nước uống và bữa ăn nhẹ bảo đảm an toàn vệ sinh thực phẩm.</p>
`.trim(),
  },
  {
    code: 'TO_TRINH',
    name: 'Tờ trình',
    label: 'Tờ trình',
    categoryCodeFallback: 'BIEU_MAU',
    defaultSymbol: 'TTr-MNSM',
    description: 'Dùng xin phê duyệt kinh phí, bổ sung trang thiết bị, nhân sự',
    initialHtml: `
<p style="text-align: center;"><strong>TỜ TRÌNH</strong></p>
<p style="text-align: center;"><strong>Về việc đề nghị phê duyệt kinh phí mua sắm thiết bị dạy học và đồ dùng trải nghiệm</strong></p>
<p style="text-align: center;">Kính gửi: Hiệu trưởng Trường Mầm non Sương Mai</p>
<p style="text-align: justify;">Căn cứ nhu cầu thực tế phục vụ công tác giảng dạy, nuôi dưỡng và chăm sóc trẻ tại các nhóm lớp trong năm học 2026 - 2027;</p>
<p style="text-align: justify;">Căn cứ biên bản đề xuất vật tư của các tổ chuyên môn ngày ... tháng ... năm 2026,</p>
<p style="text-align: justify;">Bộ phận Chuyên môn kính trình Hiệu trưởng xem xét, phê duyệt chủ trương và kinh phí mua sắm bổ sung thiết bị, đồ dùng cụ thể như sau:</p>
<p><strong>1. Danh mục đề xuất mua sắm:</strong></p>
<p>- Bộ học cụ phát triển vận động ngoài trời: 02 bộ;</p>
<p>- Đồ chơi góc sáng tạo và nguyên vật liệu trải nghiệm: 05 bộ/lớp;</p>
<p><strong>2. Dự toán kinh phí:</strong> Tổng dự toán ước tính: ... đồng (Bằng chữ: ...).</p>
<p><strong>3. Nguồn kinh phí:</strong> Trích từ nguồn kinh phí hoạt động chuyên môn năm học 2026 - 2027.</p>
<p style="text-align: justify;">Kính trình Hiệu trưởng xem xét, quyết định để bộ phận chuyên môn sớm triển khai thực hiện./.</p>
`.trim(),
  },
  {
    code: 'BIEN_BAN',
    name: 'Biên bản họp',
    label: 'Biên bản họp',
    categoryCodeFallback: 'BIEU_MAU',
    defaultSymbol: 'BB-MNSM',
    description: 'Dùng ghi nhận cuộc họp Ban Giám hiệu, họp hội đồng, giao ban',
    initialHtml: `
<p style="text-align: center;"><strong>BIÊN BẢN</strong></p>
<p style="text-align: center;"><strong>Họp Ban Giám hiệu và Hội đồng chuyên môn tháng ... năm học 2026 - 2027</strong></p>
<p><strong>1. Thời gian, địa điểm:</strong></p>
<p>- Thời gian: Vào hồi ... giờ ... phút, ngày ... tháng ... năm ...</p>
<p>- Địa điểm: Văn phòng Trường Mầm non Sương Mai.</p>
<p><strong>2. Thành phần tham dự:</strong></p>
<p>- Chủ trì: Bà ... - Hiệu trưởng nhà trường.</p>
<p>- Thư ký: Bà ... - Thư ký hội đồng.</p>
<p>- Thành phần: Các Phó Hiệu trưởng, Tổ trưởng chuyên môn và các cán bộ phụ trách liên quan (Có mặt: .../..., Vắng mặt: ... có lý do).</p>
<p><strong>3. Nội dung cuộc họp:</strong></p>
<p>- Đồng chí Hiệu trưởng đánh giá công tác tháng vừa qua và triển khai kế hoạch công tác tháng tới.</p>
<p>- Ý kiến thảo luận của các thành viên tham dự.</p>
<p><strong>4. Kết luận của Chủ trì cuộc họp:</strong></p>
<p>- Thống nhất thông qua các nội dung kế hoạch đã nêu.</p>
<p>Biên bản kết thúc vào hồi ... giờ ... phút cùng ngày, đã được đọc lại cho mọi người cùng nghe và nhất trí ký tên./.</p>
`.trim(),
  },
  {
    code: 'BLANK',
    name: 'Trang trắng (Tự soạn)',
    label: 'Trang trắng (Tự soạn)',
    categoryCodeFallback: 'BIEU_MAU',
    defaultSymbol: 'CV-MNSM',
    description: 'Trang trắng để tự do soạn thảo nội dung theo yêu cầu công việc',
    initialHtml: `
<p style="text-align: center;"><strong>TIÊU ĐỀ VĂN BẢN</strong></p>
<p style="text-align: center;"><em>(Ghi trích yếu nội dung văn bản)</em></p>
<p>Nhập nội dung văn bản tại đây...</p>
`.trim(),
  },
];

export function getDocumentTemplate(code?: string | null): DocumentTemplateMeta {
  const found = DOCUMENT_TEMPLATES.find((t) => t.code === code);
  return found || DOCUMENT_TEMPLATES[0];
}
