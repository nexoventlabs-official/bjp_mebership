Deployment Readiness Audit — Local → Digital Ocean (tnbjp.com)
Overall verdict: NOT READY — 3 blockers must be fixed before deploying.

BLOCKER 1 — Cloudinary credentials hardcoded in source code
File: bjp-membership/backend/src/controllers/uploadController.js

api_key: process.env.CLOUDINARY_API_KEY || '587186263567254',
api_secret: process.env.CLOUDINARY_API_SECRET || 'p6auY1cSEsSPjVE56Ii19gBzQ_k',
Real credentials are sitting in source code as fallback values. Anyone with repo access can upload/delete files from your Cloudinary account. Do this right now, regardless of deployment:

Go to Cloudinary → Settings → Access Keys → revoke/regenerate these keys
Remove the hardcoded fallback values from uploadController.js
Add them only as environment variables on Digital Ocean
BLOCKER 2 — Candidate card shows blank Local Body Ward (field mapping bug)
File: bjp-membership/frontend/src/pages/CandidateVerificationPage.jsx

The verification page reads from appData.ward_details.urban_body_name etc., but the application model stores data in appData.local_body.local_body. These keys don't match — the ward/location section on every candidate card will be empty for all existing and new applicants.

What the page reads	What's actually in the DB
appData.ward_details.urban_body_name	appData.local_body.local_body
appData.ward_details.ward	appData.local_body.ward
appData.ward_details.panchayat_union	appData.local_body.panchayat_union
appData.ward_details.village_panchayat	appData.local_body.village_panchayat
Fix in getLbSummary() (line 70):

// Change this:
const type = appData.ward_details?.urban_type || 'Urban Local Body'
const name = appData.ward_details?.urban_body_name || ''
const ward = appData.ward_details?.ward || ''
// To this:
const lb = appData.local_body || {}
const type = lb.local_body_type || 'Urban Local Body'
const name = lb.local_body || ''
const ward = lb.ward || ''
Same fix for the rural branch (use appData.local_body.panchayat_union, .village_panchayat, .ward).

BLOCKER 3 — Frontend API URL still hardcoded to Render
File: bjp-membership/frontend/src/api/index.js

baseURL: import.meta.env.VITE_API_URL || 'https://bjp-membership-backend.onrender.com',
The fallback points to Render. If VITE_API_URL is not set in Vercel before deploying, all API calls from tnbjp.com will go to the Render backend (the old live backend), not to Digital Ocean. You must set VITE_API_URL to your DO backend URL in Vercel's environment before building.

Required env vars to set on Digital Ocean (backend)
The .env.example is missing 3 new vars. These MUST be set on Digital Ocean or the upload feature breaks:

Variable	Currently missing from .env.example
CLOUDINARY_CLOUD_NAME	Yes — add it
CLOUDINARY_API_KEY	Yes — add it
CLOUDINARY_API_SECRET	Yes — add it
Also confirm on Digital Ocean:

CLIENT_ORIGIN must include https://www.tnbjp.com (not just the Vercel URL)
ADMIN_SESSION_SECRET must be a real random string (not the default change-me)
Minor items (not blockers, clean up later)
Issue	File	Impact
render.yaml is for Render, irrelevant on DO	backend/render.yaml	None — dead file
bjp_candidate_card_916_template.html not used	frontend/public/	None — dead file
cropperjs in package.json but never imported	frontend/package.json	Adds ~120KB to bundle
Video upload timeout risk — axios timeout is 30s but videos can be 100MB	api/index.js:9	Large videos will timeout client-side before upload finishes
What IS working fine
All 4 new chatbot flow steps (photo, video, short texts, doc upload) — logic is correct
Organiser messaging endpoint — complete
CandidateVerificationPage routing and card design — works, just needs the field mapping fix
QR code generation — works correctly (points to current URL)
Admin flow — identical to live, no regression
Session persistence and inactivity logout — correct
Position validation tightening — correct
Pre-deploy checklist
[ ] Rotate Cloudinary credentials NOW (they're in git history)
[ ] Remove hardcoded fallback credentials from uploadController.js
[ ] Fix ward_details → local_body field mapping in CandidateVerificationPage.jsx
[ ] Set VITE_API_URL in Vercel → your Digital Ocean backend URL
[ ] Set CLOUDINARY_* vars in Digital Ocean environment
[ ] Add www.tnbjp.com to CLIENT_ORIGIN on Digital Ocean
[ ] Set a real ADMIN_SESSION_SECRET on Digital Ocean
[ ] Deploy backend first, verify /health, then deploy frontend


Additionally:
Additional Blockers Found
BLOCKER 4 — Mobile number exposed on public API (DPDP Act violation)

File: bjp-membership/backend/src/models/applicationModel.js

The public /api/application/:id endpoint returns every field with no field projection except _id. This means anyone who knows an application ID — or scans a QR code from a candidate card — can call:

GET /api/application/BJP-2026-XXXXXX

and get the candidate's mobile number, full voter name, EPIC number, home address details, social media links, and written statements. Your global CLAUDE.md says "Never output individual voter PII" (DPDP Act 2023). QR codes on publicly-shared candidate cards are essentially public links to full PII records.

Fix: Add a projection to strip mobile (and optionally voter deep fields like serial/booth) from the public endpoint response.

BLOCKER 5 — Placeholder phone numbers hardcoded in UI shown to every real applicant

File: bjp-membership/frontend/src/pages/ChatbotPage.jsx

+91 98765 43210 | +91 91234 56789

These appear under "BJP Organiser Helpline Numbers" in the success screen shown to every applicant after submission. These are dummy numbers — every real applicant will see them and some will try calling. This needs real helpline numbers or the section must be removed before going live.

BLOCKER 6 — All file uploads happen sequentially in a single 30-second submit call; videos will silently fail

File: bjp-membership/frontend/src/pages/ChatbotPage.jsx and bjp-membership/frontend/src/api/index.js

On "Confirm & Submit", the code uploads photo → video → document sequentially, then submits the application — all within a single 30-second axios timeout window:

timeout: 30000  // 30 seconds for EVERYTHING

A 100MB video on a typical Indian 4G connection (~3–5 Mbps actual) takes 2–3 minutes to upload. The upload silently catches the timeout error and continues — so the application is saved with an empty video_url. The user sees "🎉 Submit Application — done!" and believes their video was uploaded. It wasn't. No error is shown.

This affects photo and document uploads too on weak connections. Fix: set a separate, longer timeout on the uploadMedia call specifically (or separate it from the application submission axios instance).

Updated Blockers Summary
#	Issue	File
1	Cloudinary API secret hardcoded in source	uploadController.js:8
2	ward_details vs local_body field mapping bug on candidate card	CandidateVerificationPage.jsx:70-82
3	Frontend API baseURL still points to Render	api/index.js:7
4	Mobile + PII exposed on public application endpoint (DPDP)	applicationModel.js:38
5	Fake placeholder phone numbers shown to all applicants	ChatbotPage.jsx:1641
6	All file uploads sequential in 30s timeout — large uploads silently fail	ChatbotPage.jsx:2407, api/index.js:9

Plus the env var gaps (Cloudinary vars missing from .env.example, CORS not set for tnbjp.com) which I'd call required pre-flight, not hard blockers.