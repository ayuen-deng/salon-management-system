/**
 * Formats a duration in minutes into a clean human-readable string.
 * - Under 60m: "45 min"
 * - 60m to 1439m: "2 h 15 min" or "3 h"
 * - 1440m+ (1 day+): "17 days" or "1 day"
 */
export function formatDuration(minutes: number): string {
  if (isNaN(minutes) || minutes < 0) return '0 min';
  
  if (minutes < 60) {
    return `${minutes} min`;
  }
  
  const days = Math.floor(minutes / 1440);
  if (days >= 1) {
    return days === 1 ? '1 day' : `${days} days`;
  }
  
  const hours = Math.floor(minutes / 60);
  const remainingMins = minutes % 60;
  if (remainingMins === 0) {
    return `${hours} h`;
  }
  return `${hours} h ${remainingMins} min`;
}

/**
 * Returns today's calendar date string in Africa/Kampala (YYYY-MM-DD).
 */
export function getKampalaDateString(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Kampala' }).format(date);
}
