# Clone and Run FaceFit

This guide explains how to download FaceFit from a Git repository and run it locally.

## Requirements

Install these tools before starting:

- [Git](https://git-scm.com/downloads)
- [Node.js](https://nodejs.org/) 24 LTS (includes npm)
- [Expo Go for SDK 57](https://expo.dev/go?sdkVersion=57) on an Android or iOS phone, or an Android/iOS emulator
- MySQL 8 or MariaDB for the API and database
- Python 3.10 or newer if you want to use face analysis

## 1. Clone the repository

Open PowerShell, Terminal, or Git Bash and run:

```bash
git clone <repository-url>
cd <repository-folder>/FaceFit
```

Replace `<repository-url>` with the HTTPS or SSH URL shown on the repository's GitHub page. Replace `<repository-folder>` with the folder created by `git clone`.

If the repository contains FaceFit at its root instead of inside a `FaceFit` folder, use only:

```bash
cd <repository-folder>
```

## 2. Configure and start the API

Create the server environment file.

Windows PowerShell:

```powershell
Copy-Item server/.env.example server/.env
```

macOS, Linux, or Git Bash:

```bash
cp server/.env.example server/.env
```

Open `server/.env` and enter your MySQL username and password. Change `JWT_SECRET` to a long, random value. The default API port is `3000`.

Make sure MySQL or MariaDB is running, then install the server packages and create the database:

```bash
cd server
npm install
npm run db:init
npm run dev
```

Keep this terminal open. The API should be available at `http://localhost:3000`. To verify it, open `http://localhost:3000/api/health` in a browser.

## 3. Configure and start the Expo app

Open a second terminal in the FaceFit folder, then create the app environment file.

Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

macOS, Linux, or Git Bash:

```bash
cp .env.example .env
```

The default `EXPO_PUBLIC_API_URL=auto` setting lets Expo Go use the computer that serves the app. Then install and start the app:

```bash
npm install
npm start
```

FaceFit uses Expo SDK 57. If Expo Go reports a version mismatch after an update,
stop the existing Expo terminal and run `npx expo start --clear` from the FaceFit
folder, then scan the new QR code with Expo Go for SDK 57.

After Expo starts, you can:

- Scan the QR code with Expo Go on a phone.
- Press `a` to open an Android emulator.
- Press `i` to open an iOS simulator on macOS.
- Press `w` to open the web version.

The computer and physical phone must be connected to the same Wi-Fi network. If automatic API detection does not work, find the computer's local IPv4 address and update `.env`:

```env
EXPO_PUBLIC_API_URL=http://192.168.1.10:3000
```

Replace `192.168.1.10` with the computer's actual IPv4 address, then stop and restart Expo.

## 4. Run face analysis (optional)

Face analysis requires a third terminal. From the FaceFit folder, run the commands for your operating system.

Windows PowerShell:

```powershell
cd face-analysis-service
py -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app:app --host 0.0.0.0 --port 8000
```

macOS or Linux:

```bash
cd face-analysis-service
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app:app --host 0.0.0.0 --port 8000
```

The API uses `http://127.0.0.1:8000` by default through the `FACE_ANALYSIS_URL` value in `server/.env`.

## Daily startup

After the first setup, start each required service in a separate terminal:

```bash
# Terminal 1: API
cd FaceFit/server
npm run dev

# Terminal 2: Expo app
cd FaceFit
npm start
```

Start the Python service in a third terminal only when face analysis is needed.

## Common problems

- **Expo cannot connect to the API:** Confirm the phone and computer use the same Wi-Fi, allow Node.js through the firewall, and use the computer's IPv4 address in `.env`.
- **Database connection fails:** Confirm MySQL is running and the `DB_HOST`, `DB_PORT`, `DB_USER`, and `DB_PASSWORD` values in `server/.env` are correct.
- **Port already in use:** Change `PORT` in `server/.env` and `EXPO_PUBLIC_API_PORT` in `.env` to the same available port.
- **Dependencies behave unexpectedly:** Stop the running process, run `npm install` again in both `FaceFit` and `FaceFit/server`, then restart the services.
- **PowerShell blocks virtual-environment activation:** Run `Set-ExecutionPolicy -Scope Process Bypass`, then activate `.venv` again.

## Booking deposits and schedule requests

Clients can browse and request future appointments even while a salon is closed.
The appointment and full service duration must fit the salon's saved opening hours.
New bookings require a 20% down payment before confirmation. Clients contact the
salon for its GCash recipient, then upload a receipt and reference number from
**My bookings**. No money is collected automatically by FaceFit. Salon owners must
check their GCash transaction history before verifying proof and confirming.
Upcoming pending bookings from before this update receive a deposit record automatically. Previously confirmed or completed bookings keep their original payment agreement.

Clients request a reschedule from **My bookings**. The original appointment and
its deposit stay unchanged while the request is pending. Owners approve or decline
requests from **Booking requests**. **Book again** starts a new booking request;
it requires a separate deposit. Clients should agree cancellation/refund terms with
the salon before sending payment; this version does not issue automatic refunds.

Restart the API after updating. Startup creates the `booking_deposits` and
`booking_changes` tables without changing existing appointments. `npm run db:init`
also prepares them. Payment receipts are stored in the database and returned only
through the authenticated customer/owner booking endpoints.

Booking checks (from `FaceFit/server`):

```bash
npm run check
npm run test:bookings
npm run test:bookings:integration
```

The integration check uses the configured local database and rolls back its test
records. It creates the two feature tables if they do not exist.

## Appointment reminders and late arrivals

Keep the API running for scheduled reminders. Its worker checks every 30 seconds,
using Philippine time, and creates in-app notifications 15 minutes before a
confirmed appointment and when it starts. Notification badges and open booking
lists refresh every 10 seconds. This does not send SMS, email, or device push
notifications and does not call a paid AI API.

Owners must use **Mark client arrived** in the booking card when the client is
physically present. Check-in opens 30 minutes before the appointment and closes
at the end of the 15-minute grace period. Confirmed appointments without a recorded
arrival are automatically cancelled at that deadline. Both parties are notified.
Previously historical appointments are not retroactively cancelled when enabling
this feature. Pending/unconfirmed bookings are not subject to this arrival rule.

The client can use **Request reschedule** on an automatically cancelled appointment.
It stays cancelled until the owner approves a valid future slot. Approval restores
confirmation and retains the payment record; no new time is chosen automatically
and no additional deposit is collected by this reschedule flow. Reminder history
is stored by appointment time to avoid duplicate notices after a server restart.

## Staff schedule transparency

The full staff schedule list appears directly on the booking Date & time
step and in the owner Staff management page. No staff filter is needed. Select a date or use the
Previous/Next buttons, then refresh to see current availability. Available ranges
follow the salon's saved operating hours, staff availability switch, and pending
or confirmed bookings. A full service must fit inside a free range. Confirmed
bookings without an assigned stylist are shown as awaiting staff assignment and
reserve salon capacity conservatively across staff. Separate staff shifts and
breaks are not configured in this version.

The salon owner can see booking times, client names, and booked services. Signed-in customers see booked clients by first name only. Public requests
see busy times/status without names. Full names and services are restricted to
the matching salon owner by the API. Run `npm run test:staff` in the server folder to check schedule
calculations and owner-only access to names.

## Waiting for a busy stylist

The time picker lists both free and busy stylists who accept appointments. Selecting
one marked **Busy at this time ? join waiting queue** submits a pending queue request.
The requested time is not a guaranteed service start. Clients still submit their
required payment proof, and the salon verifies it before confirmation.

**Confirm next in queue** checks queue order and existing confirmed appointments.
Once the stylist is free, the owner confirms the next client. If the requested time
has passed, the server sets a new start shortly after confirmation, within salon
hours, and notifies the client. Queue entries do not start arrival timers or reserve
an extra simultaneous service slot. Once confirmed, normal arrival reminders apply.
Restart the API after updating to load these routes and queue support.
