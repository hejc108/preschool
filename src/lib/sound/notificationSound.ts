// ==============================================================================
// src/lib/sound/notificationSound.ts
// Quản lý Âm thanh Thông báo PWA (Notification Sound & Autoplay Resilience)
// Hệ thống Quản lý Vận hành Trường Mầm non Sương Mai (mamnonsuongmai.edu.vn)
// ==============================================================================

const SOUND_ENABLED_KEY = 'suongmai_pwa_notification_sound_enabled';
const NOTIFICATION_SOUND_PATH = '/sounds/acb-zalo-ting.mp3';
const BACKUP_SOUND_PATH = '/sounds/notification.mp3';

let sharedAudioContext: AudioContext | null = null;
let isAudioUnlocked = false;
let unlockListenerAttached = false;

/**
 * Khởi tạo hoặc lấy đối tượng AudioContext dùng chung
 */
export function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!sharedAudioContext) {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioCtx) {
      sharedAudioContext = new AudioCtx();
    }
  }
  return sharedAudioContext;
}

/**
 * Mở khóa chính sách Autoplay của trình duyệt ngay khi người dùng có tương tác đầu tiên
 * (PointerDown, TouchStart, Click, KeyDown)
 */
export function unlockAudioContext(): void {
  if (typeof window === 'undefined' || isAudioUnlocked) return;

  try {
    const ctx = getAudioContext();
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    // Kích hoạt nhẹ một silent audio để mở khóa hoàn toàn HTMLAudioElement trên iOS/Safari/Chrome
    const silentAudio = new Audio();
    silentAudio.src = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';
    silentAudio.volume = 0.01;
    const playPromise = silentAudio.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          silentAudio.pause();
          silentAudio.currentTime = 0;
        })
        .catch(() => {});
    }

    isAudioUnlocked = true;
    detachUnlockListeners();
  } catch (_) {}
}

function handleFirstUserGesture(): void {
  unlockAudioContext();
}

/**
 * Đăng ký lắng nghe tương tác đầu tiên của người dùng để mở khóa Autoplay
 */
export function setupAutoplayUnlock(): void {
  if (typeof window === 'undefined' || isAudioUnlocked || unlockListenerAttached) return;

  const events = ['pointerdown', 'touchstart', 'click', 'keydown'];
  events.forEach((ev) => {
    window.addEventListener(ev, handleFirstUserGesture, { once: true, passive: true });
  });
  unlockListenerAttached = true;
}

function detachUnlockListeners(): void {
  if (typeof window === 'undefined') return;
  const events = ['pointerdown', 'touchstart', 'click', 'keydown'];
  events.forEach((ev) => {
    window.removeEventListener(ev, handleFirstUserGesture);
  });
}

/**
 * Kiểm tra trạng thái bật/tắt âm thanh thông báo của người dùng
 */
export function isNotificationSoundEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const val = localStorage.getItem(SOUND_ENABLED_KEY);
    return val !== 'false'; // Mặc định là bật (true)
  } catch {
    return true;
  }
}

/**
 * Lưu cấu hình bật/tắt âm thanh thông báo vào localStorage
 */
export function setNotificationSoundEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(SOUND_ENABLED_KEY, enabled ? 'true' : 'false');
  } catch {}
}

/**
 * Sinh âm thanh chuông "Ping" sư phạm nhẹ nhàng trực tiếp qua Web Audio API
 * Fallback dự phòng khi không tải được file .mp3 hoặc khi cần đảm bảo phát ngay lập tức
 */
export function playSynthesizedPing(targetVolume = 0.3): void {
  if (typeof window === 'undefined') return;

  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;
    // Hợp âm chuông ngân nhẹ nhàng C6 (1046.5Hz) & E6 (1318.5Hz)
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(1046.5, now);

    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1318.5, now + 0.05);

    // Envelope mượt mà: attack 8ms, decay tự nhiên 0.45s
    gainNode.gain.setValueAtTime(0.001, now);
    gainNode.gain.linearRampToValueAtTime(targetVolume, now + 0.015);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);

    osc1.connect(gainNode);
    osc2.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc1.start(now);
    osc1.stop(now + 0.45);
    osc2.start(now + 0.05);
    osc2.stop(now + 0.45);
  } catch (err) {
    console.warn('[NotificationSound] Web Audio synthesis error:', err);
  }
}

/**
 * Kích hoạt tệp âm thanh chuông báo ngắn (.mp3) đi kèm khi có thông báo mới
 * Thực thi theo đúng chuẩn JavaScript: new Audio('/sounds/notification.mp3').play()
 * kèm fallback dự phòng qua Web Audio API AudioContext
 */
export async function playNotificationSound(): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  // Rà soát cấu hình của người dùng (tôn trọng khi người dùng chọn tắt âm)
  if (!isNotificationSoundEnabled()) {
    return false;
  }

  // Luôn đảm bảo AudioContext sẵn sàng
  unlockAudioContext();

  try {
    const audio = new Audio(NOTIFICATION_SOUND_PATH);
    audio.volume = 1.0; // Âm lượng chuẩn hóa tối đa, trong trẻo và rõ nét

    const playPromise = audio.play();
    if (playPromise !== undefined) {
      await playPromise;
      return true;
    }
    return true;
  } catch (err: any) {
    console.warn('[NotificationSound] HTML5 Audio acb-zalo-ting play error, trying backup:', err);
    try {
      const fallbackAudio = new Audio(BACKUP_SOUND_PATH);
      fallbackAudio.volume = 1.0;
      await fallbackAudio.play();
      return true;
    } catch (_) {
      try {
        playSynthesizedPing(0.6);
        return true;
      } catch (synthErr) {
        console.warn('[NotificationSound] All audio playback channels failed:', synthErr);
        return false;
      }
    }
  }
}

/**
 * Hàm phát trực tiếp tiếng Ting chuẩn ACB One / Zalo (alias)
 */
export async function playAcbZaloTing(): Promise<boolean> {
  return playNotificationSound();
}
