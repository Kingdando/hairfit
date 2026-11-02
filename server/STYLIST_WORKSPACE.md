# Hairstylist workspace

Sign in with an owner-created staff account. The workspace contains Overview, Appointments, AI Hairstyle Viewer, Availability, Clients, Portfolio, Insights, and Profile. Digital hair consultation assessments and home service management are intentionally excluded.

- Overview and notifications refresh every 30 seconds while the workspace is mounted. These are in-app updates, not operating system push notifications.
- Only appointments assigned to the signed-in stylist can be read or changed. Pending appointments still require salon confirmation and payment verification.
- Confirmed appointments progress through arrival, in progress, then completion. Arrival is recorded from 30 minutes before until 15 minutes after the appointment. Clients can also check in from My bookings. A no-show requires the 15-minute grace period to expire without arrival.
- Stylists can approve or reject assigned rescheduling requests. Approvals check salon hours, the stylist's saved availability, and overlapping appointments. Deposits stay attached to the booking.
- Weekly schedules use Philippine time and same-day start/end times. Breaks, days off and blocked periods apply to new booking requests, rescheduling and the public schedule. Changes that conflict with existing future appointments are rejected.
- New haircut bookings snapshot the selected hairstyle, available face shape/hair length/type, and generated preview when present. Older bookings retain their saved haircut name; missing scan details and references display an empty state.
- Portfolio uploads require an explicit client-permission checkbox. Only the owning stylist can delete them. Clients can submit or update individual stylist ratings after completed bookings.
- Insights use real assigned bookings and individual stylist reviews, not salon-wide ratings.

The API creates the additional workspace tables during its normal startup migration. Restart the API after updating server files.

Validation:

```powershell
npm run test:stylist
node --test --test-concurrency=1 tests/booking-policy.test.js tests/booking-flow.integration.js tests/staff-schedule.test.js tests/stylist-dashboard.test.js tests/stylist-policy.test.js tests/stylist-workspace.integration.js
```

Database integration fixtures are isolated in transactions and rolled back. Run them sequentially to avoid locks between fixture transactions.
