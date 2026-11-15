// Persian / Jalali Date utilities & deadline calculators

const PERSIAN_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];

export function toPersianDigits(input) {
  if (input === null || input === undefined) return '';
  return String(input).replace(/[0-9]/g, (w) => PERSIAN_DIGITS[+w]);
}

// Gregorian to Jalali algorithm (accurate and lightweight)
export function gregorianToJalali(gy, gm, gd) {
  const g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  let jy = (gy <= 1600) ? 0 : 979;
  gy -= (gy <= 1600) ? 621 : 1600;
  const gy2 = (gm > 2) ? (gy + 1) : gy;
  let days = (365 * gy) + Math.floor((gy2 + 3) / 4) - Math.floor((gy2 + 99) / 100) +
    Math.floor((gy2 + 399) / 400) - 80 + gd + g_d_m[gm - 1];
  jy += 33 * Math.floor(days / 12053);
  days %= 12053;
  jy += 4 * Math.floor(days / 1461);
  days %= 1461;
  jy += Math.floor((days - 1) / 365);
  if (days > 0) days = (days - 1) % 365;
  let jm, jd;
  if (days < 186) {
    jm = 1 + Math.floor(days / 31);
    jd = 1 + (days % 31);
  } else {
    jm = 7 + Math.floor((days - 186) / 30);
    jd = 1 + ((days - 186) % 30);
  }
  return [jy, jm, jd];
}

const JALALI_MONTH_NAMES = [
  'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
  'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'
];

export function formatJalali(isoString, includeTime = true) {
  if (!isoString) return '—';
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return '—';

  const [jy, jm, jd] = gregorianToJalali(date.getFullYear(), date.getMonth() + 1, date.getDate());
  const monthName = JALALI_MONTH_NAMES[jm - 1];
  const dateStr = `${toPersianDigits(jd)} ${monthName} ${toPersianDigits(jy)}`;

  if (!includeTime) return dateStr;
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  return `${dateStr}، ساعت ${toPersianDigits(h)}:${toPersianDigits(m)}`;
}

// Relative time in Persian: "همین الان", "۲ دقیقه پیش", "۳ روز پیش"
export function formatRelative(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now - date;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 45) return 'همین الان';
  if (diffMin < 60) return `${toPersianDigits(diffMin)} دقیقه پیش`;
  if (diffHour < 24) return `${toPersianDigits(diffHour)} ساعت پیش`;
  if (diffDay === 1) return 'دیروز';
  if (diffDay < 30) return `${toPersianDigits(diffDay)} روز پیش`;
  return formatJalali(isoString, false);
}

// Deadline calculator & status indicator
export function getDeadlineStatus(deadlineIso) {
  if (!deadlineIso) {
    return {
      status: 'none',
      label: 'بدون مهلت',
      badgeClass: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
      isOverdue: false
    };
  }

  const deadline = new Date(deadlineIso);
  const now = new Date();
  const diffMs = deadline - now;
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMs <= 0) {
    const overdueHours = Math.abs(diffHours);
    const overdueDays = Math.abs(diffDays);
    const text = overdueHours < 24
      ? `${toPersianDigits(Math.max(1, overdueHours))} ساعت تاخیر`
      : `${toPersianDigits(overdueDays)} روز تاخیر`;

    return {
      status: 'overdue',
      label: `گذشته از مهلت (${text})`,
      badgeClass: 'bg-rose-100 text-rose-750 dark:bg-rose-950/60 dark:text-rose-400 border border-rose-300 dark:border-rose-800 animate-pulse',
      isOverdue: true
    };
  }

  if (diffHours < 6) {
    return {
      status: 'urgent',
      label: `${toPersianDigits(Math.max(1, diffHours))} ساعت مانده`,
      badgeClass: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-800',
      isOverdue: false
    };
  }

  if (diffDays === 0) {
    return {
      status: 'warning',
      label: `${toPersianDigits(diffHours)} ساعت مانده (امروز)`,
      badgeClass: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400',
      isOverdue: false
    };
  }

  if (diffDays === 1) {
    return {
      status: 'normal',
      label: 'فردا',
      badgeClass: 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300',
      isOverdue: false
    };
  }

  return {
    status: 'plenty',
    label: `${toPersianDigits(diffDays)} روز مانده`,
    badgeClass: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
    isOverdue: false
  };
}
