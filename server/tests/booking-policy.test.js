const test = require('node:test');
const assert = require('node:assert/strict');
const { validateSlot, depositAmount, validateProof } = require('../src/services/booking-policy');
const hours = { opening_time: '09:00:00', closing_time: '18:00:00' };
const now = new Date('2026-10-15T23:00:00+08:00');
test('allows advance appointments when salon is currently closed', () => {
  assert.equal(validateSlot('2026-10-16 09:00:00', hours, 60, now), '2026-10-16 09:00:00');
});
test('rejects past, invalid dates, and appointments finishing after closing', () => {
  for (const value of ['2026-10-15 09:00:00', '2027-02-30 10:00:00', '2026-10-16 08:00:00', '2026-10-16 17:30:00']) {
    assert.throws(() => validateSlot(value, hours, 60, now));
  }
});
test('supports overnight salon hours without accepting closed daytime hours', () => {
  const overnight = { opening_time:'20:00:00', closing_time:'02:00:00' };
  validateSlot('2026-10-16 23:30:00', overnight, 60, now);
  validateSlot('2026-10-17 01:00:00', overnight, 60, now);
  assert.throws(() => validateSlot('2026-10-17 01:30:00', overnight, 60, now));
  assert.throws(() => validateSlot('2026-10-16 12:00:00', overnight, 60, now));
});
test('calculates down payment in centavos and rejects invalid proof input', () => {
  assert.equal(depositAmount(999.99), 200);
  assert.throws(() => validateProof('not-a-reference', 'data:image/jpeg;base64,AAAA'));
  assert.throws(() => validateProof('1234567890123', 'https://example.com/receipt'));
});
