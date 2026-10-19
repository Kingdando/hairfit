const DEPOSIT_RATE = 0.2;
function fail(message, status = 400) { const error = new Error(message); error.status = status; throw error; }
function depositAmount(price) { return Math.round(Number(price) * DEPOSIT_RATE * 100) / 100; }
function validateSlot(value, salon, duration, now = new Date()) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:00$/.test(value)) fail('Choose a valid date and time.');
  const date = new Date(value.replace(' ', 'T') + '+08:00');
  if (!Number.isFinite(date.getTime()) || date <= now) fail('Choose a future appointment.');
  const local = new Date(date.getTime() + 8 * 3600000).toISOString().slice(0, 19).replace('T', ' ');
  if (local !== value) fail('Choose a valid calendar date.');
  const minutes = text => Number(text.slice(0, 2)) * 60 + Number(text.slice(3, 5));
  if (salon.opening_time && salon.closing_time) {
    const open = minutes(salon.opening_time), close = minutes(salon.closing_time), start = minutes(value.slice(11));
    if (open !== close) {
      const end = close > open ? close : close + 1440;
      const adjusted = close > open || start >= open ? start : start + 1440;
      if (adjusted < open || adjusted + Number(duration) > end) fail('Choose a time within salon hours that allows the full service to finish.');
    }
  }
  return value;
}
function validateProof(reference, image) {
  if (typeof reference !== 'string' || !/^\d{10,20}$/.test(reference.trim())) fail('Enter the 10–20 digit GCash reference number.');
  if (typeof image !== 'string' || image.length > 3.5 * 1024 * 1024 || !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(image)) fail('Upload a JPG, PNG, or WebP payment receipt under 2.5 MB.');
}
module.exports = { DEPOSIT_RATE, depositAmount, validateSlot, validateProof, fail };
