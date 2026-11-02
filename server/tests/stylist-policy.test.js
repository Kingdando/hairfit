const test = require('node:test');
const assert = require('node:assert/strict');
const { validateSettings, allowsSlot, validateContext } = require('../src/services/stylist-workspace');
const schedule = () => ({ weekly: Array.from({ length: 7 }, () => ({ enabled: true, start: '09:00', end: '18:00', breakStart: '12:00', breakEnd: '13:00' })), blocks: [{ start: '2099-01-05 14:00:00', end: '2099-01-05 15:00:00' }] });
test('work hours enforce the whole service, breaks, days off and time away', () => {
  const settings = validateSettings(schedule());
  assert.equal(allowsSlot(settings, '2099-01-05 09:00:00', 60), true);
  assert.equal(allowsSlot(settings, '2099-01-05 08:30:00', 60), false);
  assert.equal(allowsSlot(settings, '2099-01-05 17:30:00', 60), false);
  assert.equal(allowsSlot(settings, '2099-01-05 11:30:00', 60), false);
  assert.equal(allowsSlot(settings, '2099-01-05 13:00:00', 60), true);
  assert.equal(allowsSlot(settings, '2099-01-05 14:30:00', 60), false);
  assert.equal(allowsSlot(settings, '2099-01-05 15:00:00', 60), true);
  const day = new Date('2099-01-05T12:00:00Z').getUTCDay(); settings.weekly[day].enabled = false;
  assert.equal(allowsSlot(settings, '2099-01-05 09:00:00', 60), false);
  assert.equal(allowsSlot({}, '2099-01-05 09:00:00', 60), true);
});
test('rejects malformed schedules and invalid calendar days', () => {
  assert.throws(() => validateSettings({ weekly: [null], blocks: [] }));
  const bad = schedule(); bad.weekly[0] = null;
  assert.throws(() => validateSettings(bad));
  const breaks = schedule(); breaks.weekly[0].breakEnd = '20:00';
  assert.throws(() => validateSettings(breaks));
  const date = schedule(); date.blocks = [{ start: '2099-02-30 09:00:00', end: '2099-03-04 09:00:00' }];
  assert.throws(() => validateSettings(date));
});
test('haircut snapshots reject remote image URLs, oversized text and preserve missing fields', () => {
  assert.equal(validateContext(undefined), null);
  assert.deepEqual(validateContext({ hairstyle: 'Bob', faceShape: 'oval' }), { hairstyle: 'Bob', faceShape: 'oval', hairLength: null, hairType: null, referenceImage: null });
  assert.throws(() => validateContext({ referenceImage: 'https://example.com/photo.jpg' }));
  assert.throws(() => validateContext({ hairstyle: 'x'.repeat(121) }));
});
