Repo Comparison: Local (bjp-membership) vs GitHub (bjp_mebership)
Files present ONLY in local (not in GitHub)
File	Purpose
backend/src/controllers/uploadController.js	New media upload endpoint
backend/render.yaml	Render.com deployment config
frontend/public/bjp_candidate_card_916_template.html	Candidate card HTML template
frontend/src/pages/CandidateVerificationPage.jsx	Public verify page (/verify/:id)
USER FLOW — What changed

GitHub flow (13 steps):

WELCOME → AWAIT_MOBILE → AWAIT_OTP → AWAIT_MEMBERSHIP → AWAIT_EPIC
→ CONFIRM_VOTER → LOCAL_BODY → POSITION → SOCIAL → WORK → LOCAL_AREA
→ REVIEW → SUBMITTING → SUBMITTED

Local flow (17 steps — 4 new steps added):

WELCOME → AWAIT_MOBILE → AWAIT_OTP → AWAIT_MEMBERSHIP → AWAIT_EPIC
→ CONFIRM_VOTER → [PHOTO_UPLOAD] → LOCAL_BODY → POSITION → SOCIAL
→ [VIDEO_UPLOAD] → WORK → LOCAL_AREA → [SHORT_TEXTS] → [DOC_UPLOAD]
→ REVIEW → SUBMITTING → SUBMITTED
New step	When	What it collects
PHOTO_UPLOAD	After voter confirmed	Passport-style photo upload
VIDEO_UPLOAD	After social media	Campaign/intro video upload
SHORT_TEXTS	After local area essay	Development priorities + grievance plan (max 150 words each)
DOC_UPLOAD	After short texts	Supporting document upload

New form fields in local:

photoUrl, videoUrl, documentUrl — media upload links
devPriorities — development priorities (short text)
grievancePlan — grievance handling plan (short text)

New imports in local ChatbotPage:

html2canvas + QRCode — for generating a downloadable candidate card after submission (uses the bjp_candidate_card_916_template.html template)
Membership ID — behaviour change
	GitHub	Local
Membership ID	Required (400 error if missing)	Optional (collected but not enforced)
New API routes in local
Route	Present in GitHub?	Purpose
POST /organiser-message	No	User sends a message to the organiser after submission
POST /upload/media	No	Upload photo/video/document to cloud storage

The postOrganiserMessage endpoint lets the applicant send a follow-up note (linked to their application_id) after they've submitted — entirely new feature.

Already-applied response — subtle change
	GitHub	Local
already_applied: true returns	{ application_id, submitted_at, mobile } (minimal)	Full application object (all fields)

Local passes the full application back so the chatbot can reconstruct and display the complete submitted data to the returning user.

Position validation — logic tightened
	GitHub	Local
Validates	Only 1st preference	All 3 preferences
ADMIN FLOW — No changes

adminController.js, admin routes (backend/src/routes/admin.js), and all admin pages are identical between GitHub and local.

New public route (frontend)

Local adds:

/verify       → CandidateVerificationPage
/verify/:id   → CandidateVerificationPage

This is a public verification page — anyone can open a link like /verify/APP123 to view a submitted candidate's details (likely used for the QR code on the candidate card).

Summary

The local version is a significant feature upgrade over GitHub. The main themes:

Richer application — candidates now upload photo, video, and documents; write two additional short-text fields
Candidate card — QR-code-enabled shareable card generated at submission (html2canvas + QRCode)
Public verification — /verify/:id page for anyone to verify a candidate card
Post-submission messaging — applicants can message the organiser after submitting
Membership ID relaxed — no longer a hard requirement