// Salon opening-hours helpers.
// Salons are in the Philippines (UTC+8, no daylight saving), so "now" is always
// evaluated in Philippine time no matter where the phone is set.
const PH_UTC_OFFSET_HOURS = 8;

type SalonHours = {
  opening_time?: string | null;
  closing_time?: string | null;
};

// "09:00" or "09:00:00" -> minutes since midnight (null if missing/invalid)
function toMinutes(value?: string | null): number | null {
  if (!value) return null;
  const [hours, minutes] = value.split(":").map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  return hours * 60 + minutes;
}

// "18:00:00" -> "6:00 PM"
export function formatSalonTime(value?: string | null): string {
  const total = toMinutes(value);
  if (total === null) return "";
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  const suffix = hours >= 12 ? "PM" : "AM";
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${hour12}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

// Salons with no hours saved are treated as open (same as "Contact for hours").
export function isSalonOpenNow(salon: SalonHours, now: Date = new Date()): boolean {
  const open = toMinutes(salon.opening_time);
  const close = toMinutes(salon.closing_time);
  if (open === null || close === null || open === close) return true;

  const current =
    ((now.getUTCHours() + PH_UTC_OFFSET_HOURS) % 24) * 60 + now.getUTCMinutes();

  // Normal hours (9:00-18:00) vs. overnight hours (20:00-02:00)
  return open < close
    ? current >= open && current < close
    : current >= open || current < close;
}

// "Closed · Opens 9:00 AM" / "Open until 6:00 PM"
export function salonStatusText(salon: SalonHours, now: Date = new Date()): string {
  const open = isSalonOpenNow(salon, now);
  if (!salon.opening_time || !salon.closing_time) return "";
  return open
    ? `Open until ${formatSalonTime(salon.closing_time)}`
    : `Closed · Opens ${formatSalonTime(salon.opening_time)}`;
}