/**
 * Date and Time Utilities for Indian Standard Time (IST, UTC+5:30)
 */

export const IST_TIMEZONE = 'Asia/Kolkata';

/**
 * Format date & time in Indian Standard Time (IST)
 * Example: "27 Aug 2026, 03:26 PM IST"
 */
export function formatISTDateTime(
  dateInput?: string | Date | number | null,
  options?: { showSeconds?: boolean; showTimezone?: boolean }
): string {
  if (!dateInput) return '—';
  try {
    const d = typeof dateInput === 'string' || typeof dateInput === 'number' ? new Date(dateInput) : dateInput;
    if (isNaN(d.getTime())) return String(dateInput);

    const formatted = new Intl.DateTimeFormat('en-IN', {
      timeZone: IST_TIMEZONE,
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: options?.showSeconds ? '2-digit' : undefined,
      hour12: true,
    }).format(d);

    return options?.showTimezone === false ? formatted : `${formatted} IST`;
  } catch {
    return String(dateInput);
  }
}

/**
 * Format date only in Indian Standard Time (IST)
 * Example: "27 Aug 2026"
 */
export function formatISTDate(dateInput?: string | Date | number | null): string {
  if (!dateInput) return '—';
  try {
    const d = typeof dateInput === 'string' || typeof dateInput === 'number' ? new Date(dateInput) : dateInput;
    if (isNaN(d.getTime())) return String(dateInput);

    return new Intl.DateTimeFormat('en-IN', {
      timeZone: IST_TIMEZONE,
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(d);
  } catch {
    return String(dateInput);
  }
}

/**
 * Format time only in Indian Standard Time (IST)
 * Example: "03:26 PM IST"
 */
export function formatISTTime(
  dateInput?: string | Date | number | null,
  options?: { showSeconds?: boolean; showTimezone?: boolean }
): string {
  if (!dateInput) return '—';
  try {
    const d = typeof dateInput === 'string' || typeof dateInput === 'number' ? new Date(dateInput) : dateInput;
    if (isNaN(d.getTime())) return String(dateInput);

    const formatted = new Intl.DateTimeFormat('en-IN', {
      timeZone: IST_TIMEZONE,
      hour: '2-digit',
      minute: '2-digit',
      second: options?.showSeconds ? '2-digit' : undefined,
      hour12: true,
    }).format(d);

    return options?.showTimezone === false ? formatted : `${formatted} IST`;
  } catch {
    return String(dateInput);
  }
}

/**
 * Get current timestamp ISO or formatted in IST
 */
export function getISTNowString(): string {
  return formatISTDateTime(new Date());
}
