# Deployment Status Report — tnbjp.com (Local Body Candidate Application)

**Scope:** Expanded chatbot registration flow (media uploads, development priorities / grievance plan, 9:16 poster + QR verify page, organiser message) backed by Backblaze B2 (S3-compatible) + sharp.
**Environment:** Droplet `129.212.233.215` · path `/var/www/bjp-localbody` · PM2 `bjp-localbody-backend` (port 5001) · domain `tnbjp.com`.
**Overall verdict:** Feature deployed and live. 4 functional blockers and 1 operational blocker remain before it is fully production-safe.

---

## What is live and working

- Backend deployed (git pulled, `npm install` clean — 0 vulnerabilities), PM2 restarted, `/health` green (`voterDb: true`, `appDb: true`).
- Frontend rebuilt on the droplet (build hashes match local).
- New media upload endpoint `POST /api/upload/media` — verified end-to-end: a 2000x2000 test image was resized/compressed to 4.5 KB JPEG via sharp and stored in B2.
- New endpoint `POST /api/organiser-message` — one message per application, stored in `organiser_messages`.
- Application record now persists `photo_url`, `video_url`, `document_url`, `development_priorities`, `grievance_plan`.
- Admin **Application Detail** page renders all new fields (passport photo, pitch video, supporting document, development priorities, grievance plan, organiser message).
- All 4 co-hosted sites return HTTP 200 (`tnbjp.com`, `tnbjp.org`, `vanigan.digital`, `election2026sir.in`); only `bjp-localbody-backend` was restarted, the other 3 backends were untouched.
- Frontend API base URL is same-origin (`import.meta.env.VITE_API_URL || ''`) — calls route to the DO backend via nginx.
- `ADMIN_SESSION_SECRET` is a custom value (not the default), `CLIENT_ORIGIN=https://tnbjp.com`, and the 6 Backblaze B2 vars are set on the droplet.
- Admin detail response now joins the one-time organiser message as `organiser_message { text, sent_at }` (fixed and deployed).

---

## Blockers (must fix before full production sign-off)

### BLOCKER 1 — Local body / ward is blank on the public verify card
**File:** `frontend/src/pages/CandidateVerificationPage.jsx` — `getLbSummary()` (lines ~73-80)
The verify page reads from `appData.ward_details.*`, but applications are stored under `appData.local_body.*`. The keys don't match, so the location/ward line is empty on every candidate card (existing and new).

| Page reads | Actual DB field |
|---|---|
| `appData.ward_details.urban_type` / `urban_body_name` | `appData.local_body.local_body_type` / `local_body` |
| `appData.ward_details.ward` | `appData.local_body.ward` |
| `appData.ward_details.panchayat_union` | `appData.local_body.panchayat_union` |
| `appData.ward_details.village_panchayat` | `appData.local_body.village_panchayat` |

**Fix:** In both the urban and rural branches of `getLbSummary()`, read from `appData.local_body`.

### BLOCKER 2 — Mobile number + PII exposed on the public application endpoint (DPDP)
**File:** `backend/src/models/applicationModel.js` — `findApplicationById()` (projection `{ _id: 0 }` only)
The public `GET /api/application/:id` returns the full record — mobile, EPIC, full voter name, booth/part, social links. Anyone who knows an application ID (or scans a QR code on a shared candidate card) can retrieve full PII.
**Fix:** Add a projection to strip `mobile` and deep voter fields (serial/booth/relation) from the public endpoint response. The admin endpoint keeps full detail.

### BLOCKER 3 — Placeholder helpline numbers shown to every applicant
**File:** `frontend/src/pages/ChatbotPage.jsx` (line ~1616)
The post-submission success screen shows dummy numbers under "BJP Organiser Helpline Numbers":
```
+91 98765 43210 | +91 91234 56789
```
Every real applicant sees these.
**Fix:** Replace with real helpline numbers, or remove the section until they are available.

### BLOCKER 4 — All uploads run inside a single 30-second timeout; large videos silently fail
**Files:** `frontend/src/api/index.js` (`timeout: 30000`) and `frontend/src/pages/ChatbotPage.jsx`
`uploadMedia` uses the shared axios instance with a 30s timeout and no override. A 100 MB video on a typical Indian 4G connection takes 2-3 minutes — the request times out, the error is swallowed, and the application can be saved with an empty `video_url` while the user sees a success message.
**Fix:** Give `uploadMedia` a dedicated, longer timeout (or a separate axios instance) so large media uploads complete before submit.

### OPERATIONAL BLOCKER — Backblaze bucket is private
Bucket `bjpmembership` is set to Private, so uploaded media URLs return HTTP 401 and will not display in the poster or on the verify page. Uploads themselves succeed.
**Fix:** Set the bucket to Public in Backblaze, or create a dedicated public bucket and point `B2_BUCKET_NAME` / `B2_PUBLIC_BASE` at it.

---

## Minor items (clean up later, not blockers)

| Item | Detail |
|---|---|
| `CLIENT_ORIGIN` missing `www.` host | Set to `https://tnbjp.com` only. Same-origin serving makes this low-risk, but add `www.tnbjp.com` if that host is served. |
| Unused `cropperjs` dependency | Listed in `frontend/package.json`, never imported — adds bundle weight. |
| Bundle size warning | Main JS chunk ~823 KB (gzip ~247 KB); consider code-splitting later. |

---

## Recommended order of action

1. Set the Backblaze bucket public (unblocks all media display).
2. Fix Blocker 1 (verify-card field mapping) — clear correctness fix.
3. Fix Blocker 4 (upload timeout) — prevents silent data loss.
4. Fix Blocker 2 (strip PII from public endpoint) — DPDP compliance.
5. Replace the placeholder helpline numbers (Blocker 3) with real numbers.
