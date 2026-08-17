# BJP Local Body — End-to-End Testing Plan
**Date:** 2026-08-17  
**Scope:** All 7 position flows + edge cases + backend validation + post-submit verification  
**Purpose:** Confirm the redesigned local build is ready for live server deployment.  
**Verdict rule:** Every test must show ✅ PASS. One ❌ FAIL = not ready to deploy.

---

## 1. Setup Before Testing

### 1.1 Build the frontend (mandatory — dist is stale)
```bash
cd "D:\digital ocean\bjplocalbody\frontend"
npm run build
```
Expected: `dist/assets/index-*.js` and `dist/assets/index-*.css` regenerated with new hashes.  
If build fails → fix the error before testing anything.

### 1.2 Start the backend
```bash
cd "D:\digital ocean\bjplocalbody\backend"
node src/server.js
# or if you use nodemon:
npx nodemon src/server.js
```
Confirm: `Server running on port 5001` (or whatever your local port is).  
Confirm: `/health` endpoint returns `{ voterDb: true, appDb: true }`.

### 1.3 Start the frontend dev server
```bash
cd "D:\digital ocean\bjplocalbody\frontend"
npm run dev
```
Open: `http://localhost:5173` (or whatever Vite assigns).

### 1.4 Dev OTP shortcut
- Backend has a dev bypass: OTP `123456` is always accepted when `NODE_ENV !== 'production'`.
- Use this for all tests unless you are specifically testing OTP failure.

### 1.5 Test data reference

| District | Body available | Use for |
|----------|----------------|---------|
| Chennai | Greater Chennai Corporation (200 wards) | Flow 1 |
| Dindigul | Municipalities (Kodaikanal, Palani etc.) | Flow 2 |
| Coimbatore | Town Panchayats (Annur, Perur, Sulur) | Flow 3 |
| Tiruvallur | District Panchayat (25 wards) | Flow 4 |
| Kanchipuram | Panchayat Unions (5 unions), Blocks (5), VPs | Flows 5, 6, 7 |

---

## 2. Authentication — Common Steps (Used in All Flows)

> Run this once to verify auth is working before doing the 7 flows.

| # | Action | Expected Result | Status |
|---|--------|----------------|--------|
| A1 | Open `http://localhost:5173` | Welcome banner shows. BJP logo visible. Start Application button visible. | ☐ |
| A2 | Click "Start Application" | Bot asks for mobile number. | ☐ |
| A3 | Enter a 10-digit mobile number, submit | Bot sends "OTP sent to XXXXXXXX" message. | ☐ |
| A4 | Enter wrong OTP (e.g. `000000`) | Error message: "Invalid OTP" or similar. Does NOT advance. | ☐ |
| A5 | Enter correct OTP (`123456`) | Bot advances — asks for BJP Membership ID. | ☐ |
| A6 | Skip Membership ID (leave blank, submit) | Bot advances to EPIC step. Membership is optional. | ☐ |
| A7 | Enter an invalid EPIC (e.g. `XXXXX`) | Error: "Invalid EPIC / Voter ID format." Does NOT advance. | ☐ |
| A8 | Enter a valid EPIC from the voter DB | Voter card displays: name, district, assembly, age/gender. | ☐ |
| A9 | Click "Re-enter ID" on voter card | Bot goes back to EPIC input. | ☐ |
| A10 | Enter valid EPIC again, confirm voter | Bot asks for Candidate Photo. | ☐ |

**AUTH RESULT:** ☐ PASS &nbsp;&nbsp; ☐ FAIL

---

## 3. DISTRICT STEP — Verify the new step works correctly

> After voter is confirmed, photo upload appears. After photo → District step.

| # | Action | Expected Result | Status |
|---|--------|----------------|--------|
| D1 | After confirming voter, skip/upload photo | Bot says "In which district are you planning to contest?" and shows the District card. | ☐ |
| D2 | Check the dropdown default value | Voter's district (from EPIC) is pre-selected. Example: if EPIC is from Chennai voter, Chennai is pre-filled. | ☐ |
| D3 | Change district via dropdown | Can select any of the 38 districts from the list. | ☐ |
| D4 | Try to click Continue with no district selected | Button is disabled / not clickable when district is empty. | ☐ |
| D5 | Select a district and click Continue | District value appears in the chat as user message. Bot transitions to "Local Body Details" card. | ☐ |

**DISTRICT RESULT:** ☐ PASS &nbsp;&nbsp; ☐ FAIL

---

## 4. FLOW 1 — Municipal Corporation Councillor (Urban)

**District to use:** Chennai (Greater Chennai Corporation — 200 wards)

| # | Action | Expected Result | Status |
|---|--------|----------------|--------|
| F1-1 | Complete steps A1–A10 and D1–D5 with district = Chennai | Local Body Details card appears. | ☐ |
| F1-2 | In the card, click "Urban Local Body" toggle | Urban section expands. Rural section hidden. | ☐ |
| F1-3 | Select "Corporation" from the body type dropdown | A second dropdown appears: "Select Local Body". | ☐ |
| F1-4 | Verify the corporation dropdown | Only "Greater Chennai Corporation" in the list (since we selected Chennai). No other cities' corps appear. | ☐ |
| F1-5 | Select "Greater Chennai Corporation" | Ward dropdown appears. | ☐ |
| F1-6 | Verify ward dropdown | Shows Ward 1 to Ward 200. Exactly 200 options. | ☐ |
| F1-7 | Check the auto-position hint | "Position will be auto-set: Corporation Ward Member" label is visible. | ☐ |
| F1-8 | Select Ward 50, click Continue | Chat shows "Urban · Greater Chennai Corporation · Ward 50". Bot moves to Social Media step (no separate Position step). | ☐ |
| F1-9 | Complete Social, Video, Work, Local Area, Short Texts, Doc Upload | All steps complete without error. | ☐ |
| F1-10 | On Review screen — Local Body section | Shows: Corporation, Greater Chennai Corporation, Ward 50. Position: Corporation Ward Member. | ☐ |
| F1-11 | Click Submit | Success screen appears with Application ID (BJP-2026-XXXXXX). | ☐ |
| F1-12 | Open browser DevTools → Network → find the submit POST request → inspect payload | `body_type: "urban"`, `local_body.local_body_type: "Corporation"`, `local_body.local_body: "Greater Chennai Corporation"`, `local_body.ward: "50"`, `position_preferences[0]: "Corporation Ward Member"` | ☐ |

**FLOW 1 RESULT:** ☐ PASS &nbsp;&nbsp; ☐ FAIL

---

## 5. FLOW 2 — Municipal Councillor (Urban)

**District to use:** Dindigul (has municipalities like Kodaikanal, Palani)

| # | Action | Expected Result | Status |
|---|--------|----------------|--------|
| F2-1 | Complete auth + district = Dindigul | Local Body Details card. | ☐ |
| F2-2 | Select "Urban Local Body" | Urban section shows. | ☐ |
| F2-3 | Select "Municipality" from body type | Municipality name dropdown appears. | ☐ |
| F2-4 | Verify municipality dropdown | Shows only Dindigul's municipalities (e.g. Kodaikanal, Palani, Dindigul, etc.). NOT other districts. | ☐ |
| F2-5 | Select a municipality | Ward field appears — it is a **free text** input (not a dropdown). | ☐ |
| F2-6 | Check auto-position hint | "Position will be auto-set: Municipality Ward Member" | ☐ |
| F2-7 | Type a ward number in the text field (e.g. "12"), click Continue | Chat shows "Urban · [Municipality] · Ward 12". Goes to Social step. No Position step. | ☐ |
| F2-8 | Complete remaining steps and submit | Submits successfully. | ☐ |
| F2-9 | Check payload: `position_preferences[0]` | Must be `"Municipality Ward Member"` | ☐ |

**FLOW 2 RESULT:** ☐ PASS &nbsp;&nbsp; ☐ FAIL

---

## 6. FLOW 3 — Town Panchayat Councillor (Urban)

**District to use:** Coimbatore (has Town Panchayats: Annur, Perur, Sulur, etc.)

| # | Action | Expected Result | Status |
|---|--------|----------------|--------|
| F3-1 | Complete auth + district = Coimbatore | Local Body Details card. | ☐ |
| F3-2 | Select "Urban Local Body" → "Town Panchayat" | Town Panchayat name dropdown appears. | ☐ |
| F3-3 | Verify town panchayat dropdown | Shows only Coimbatore's town panchayats. Check for: Annur, Perur, Sulur. | ☐ |
| F3-4 | Select a town panchayat | Ward field appears — **free text** input. | ☐ |
| F3-5 | Check auto-position hint | "Position will be auto-set: Town Panchayat Ward Member" | ☐ |
| F3-6 | Enter ward "5", click Continue | No separate Position step. Goes to Social. | ☐ |
| F3-7 | Submit and verify payload | `position_preferences[0]: "Town Panchayat Ward Member"` | ☐ |

**FLOW 3 RESULT:** ☐ PASS &nbsp;&nbsp; ☐ FAIL

---

## 7. FLOW 4 — District Panchayat Ward Member (Rural)

**District to use:** Tiruvallur (25 wards)

| # | Action | Expected Result | Status |
|---|--------|----------------|--------|
| F4-1 | Complete auth + district = Tiruvallur | Local Body Details card. | ☐ |
| F4-2 | Select "Rural Local Body" | Rural section shows. Urban section hidden. | ☐ |
| F4-3 | Select position: "District Panchayat Ward Member" | Only one field appears: "District Panchayat Ward" dropdown. No block, no village, no union field. | ☐ |
| F4-4 | Verify ward dropdown | Shows Ward 1 to Ward 25. Exactly 25 options for Tiruvallur. | ☐ |
| F4-5 | Test with a different district — change district to Vellore | Re-enter the Local Body step. Ward dropdown shows Vellore's count (14 wards). | ☐ |
| F4-6 | Select Tiruvallur again, choose Ward 10, click Continue | Chat shows "Rural · District Panchayat Ward 10". No Position step. Goes to Social. | ☐ |
| F4-7 | Submit and verify payload | `body_type: "rural"`, `local_body.panchayat_union: ""`, `local_body.village_panchayat: ""`, `local_body.ward: "10"`, `position_preferences[0]: "District Panchayat Ward Member"` | ☐ |
| F4-8 | Backend validation check: submit with ward missing | Should return 400 error: "Select your District Panchayat Ward." | ☐ |

**FLOW 4 RESULT:** ☐ PASS &nbsp;&nbsp; ☐ FAIL

---

## 8. FLOW 5 — Panchayat Union Ward Member (Rural)

**District to use:** Kanchipuram (5 unions: Kancheepuram, Walajabad, Uthiramerur, Sriperumbudur, Kundrathur)

| # | Action | Expected Result | Status |
|---|--------|----------------|--------|
| F5-1 | Complete auth + district = Kanchipuram | Local Body Details card. | ☐ |
| F5-2 | Select "Rural Local Body" → Position: "Panchayat Union Ward Member" | Panchayat Union dropdown appears. No block/village field. | ☐ |
| F5-3 | Verify union dropdown | Shows exactly: Kancheepuram, Walajabad, Uthiramerur, Sriperumbudur, Kundrathur. | ☐ |
| F5-4 | Select "Walajabad" | Ward field appears — **free text** input. | ☐ |
| F5-5 | Enter ward number "3", click Continue | Chat shows "Rural · Walajabad · Ward 3". No Position step. Goes to Social. | ☐ |
| F5-6 | Submit and verify payload | `local_body.panchayat_union: "Walajabad"`, `local_body.village_panchayat: ""`, `local_body.ward: "3"`, `position_preferences[0]: "Panchayat Union Ward Member"` | ☐ |
| F5-7 | Backend validation check: submit without selecting union | Should return 400: "Select Panchayat Union and Ward." | ☐ |

**FLOW 5 RESULT:** ☐ PASS &nbsp;&nbsp; ☐ FAIL

---

## 9. FLOW 6 — Village Panchayat President (Rural)

**District to use:** Kanchipuram → Block: Kancheepuram → any Village Panchayat

| # | Action | Expected Result | Status |
|---|--------|----------------|--------|
| F6-1 | Complete auth + district = Kanchipuram | Local Body Details card. | ☐ |
| F6-2 | Select "Rural Local Body" → Position: "Village Panchayat President" | Block dropdown appears. NO ward field at this stage. | ☐ |
| F6-3 | Verify block dropdown | Shows Kanchipuram's blocks: Kancheepuram, Walajabad, Uthiramerur, Sriperumbudur, Kundrathur. | ☐ |
| F6-4 | Select block "Kancheepuram" | Village Panchayat dropdown appears. | ☐ |
| F6-5 | Verify village panchayat dropdown | Shows Kancheepuram block's village panchayats (Angambakkam, Ariyaperumpakkam, etc.). Should have multiple entries. | ☐ |
| F6-6 | **KEY CHECK:** Verify no ward field appears | After selecting a village panchayat, NO ward input should be visible. This is Village Panchayat President — one president per panchayat, no ward. | ☐ |
| F6-7 | Click Continue with block + village selected | Chat shows "Rural · Kancheepuram · [Village Name]". No Position step. Goes to Social. | ☐ |
| F6-8 | Submit and verify payload | `local_body.panchayat_union: "Kancheepuram"`, `local_body.village_panchayat: "[VillageName]"`, `local_body.ward: ""`, `position_preferences[0]: "Village Panchayat President"` | ☐ |
| F6-9 | Backend validation check: submit without selecting village | Should return 400: "Select Block and Village Panchayat." | ☐ |

**FLOW 6 RESULT:** ☐ PASS &nbsp;&nbsp; ☐ FAIL

---

## 10. FLOW 7 — Village Panchayat Ward Member (Rural)

**District to use:** Kanchipuram → Block: Walajabad → any Village Panchayat

| # | Action | Expected Result | Status |
|---|--------|----------------|--------|
| F7-1 | Complete auth + district = Kanchipuram | Local Body Details card. | ☐ |
| F7-2 | Select "Rural Local Body" → Position: "Village Panchayat Ward Member" | Block dropdown appears. | ☐ |
| F7-3 | Select block "Walajabad" | Village Panchayat dropdown appears. | ☐ |
| F7-4 | Verify village panchayat dropdown | Shows Walajabad block's panchayats. Different list from Kancheepuram block. | ☐ |
| F7-5 | Select a village panchayat | Ward field appears — **free text** input (unlike Flow 4's dropdown). | ☐ |
| F7-6 | Enter ward "2", click Continue | Chat shows "Rural · Walajabad · [Village] · Ward 2". No Position step. | ☐ |
| F7-7 | Submit and verify payload | `local_body.panchayat_union: "Walajabad"`, `local_body.village_panchayat: "[VillageName]"`, `local_body.ward: "2"`, `position_preferences[0]: "Village Panchayat Ward Member"` | ☐ |
| F7-8 | Backend validation: submit without ward | Should return 400: "Select Block, Village Panchayat and Ward." | ☐ |

**FLOW 7 RESULT:** ☐ PASS &nbsp;&nbsp; ☐ FAIL

---

## 11. DISTRICT NORMALIZATION — Voter DB to UI

> The voter DB stores district in ALL CAPS with variant spellings. Verify the normalization works.

| DB Value | Expected UI Display | Status |
|----------|---------------------|--------|
| `KANNIYAKUMARI` | `Kanyakumari` | ☐ |
| `THE NILGIRIS` | `Nilgiris` | ☐ |
| `KANCHEEPURAM` | `Kanchipuram` | ☐ |
| `THIRUVALLUR` | `Tiruvallur` | ☐ |
| `THIRUVARUR` | `Tiruvarur` | ☐ |
| `VILLUPURAM` | `Viluppuram` | ☐ |
| `THOOTHUKKUDI` | `Thoothukudi` | ☐ |

**How to test:** Find a voter EPIC from each district in your test data. After EPIC is confirmed, check that the district shown in the Voter Card and pre-filled in the District step uses the correct canonical spelling (not the ALL CAPS DB value).

**NORMALIZATION RESULT:** ☐ PASS &nbsp;&nbsp; ☐ FAIL (or ☐ SKIP if you don't have EPICs for all districts)

---

## 12. EDGE CASES

### 12.1 Change District Resets Downstream

| # | Action | Expected Result | Status |
|---|--------|----------------|--------|
| EC1 | Select district = Chennai, then go to Local Body, pick Corporation | Corporation dropdown shows Chennai's corp. | ☐ |
| EC2 | Go back / re-open a prior session, change district to Coimbatore | When Local Body card is re-entered, the body list now shows Coimbatore's options (not Chennai's). Previous selection is cleared. | ☐ |

### 12.2 District With No Corporation / Municipality / Town Panchayat

| # | Action | Expected Result | Status |
|---|--------|----------------|--------|
| EC3 | Select a rural district (e.g. Ariyalur), Urban → Corporation | Dropdown shows "None in this district" or empty. Continue button stays disabled. | ☐ |
| EC4 | Same district, Urban → Municipality | Shows municipalities for Ariyalur if any exist, or "None in this district". | ☐ |

### 12.3 Session Restore at DISTRICT Step

| # | Action | Expected Result | Status |
|---|--------|----------------|--------|
| EC5 | Complete auth through to S.DISTRICT step, then refresh the page | Page reloads. Chat history is restored. District card is shown where you left off (not back at welcome). | ☐ |
| EC6 | Complete through to S.LOCAL_BODY step, refresh | Chat restores to Local Body card. District is still selected (not blank). | ☐ |

### 12.4 Skip Photo Upload

| # | Action | Expected Result | Status |
|---|--------|----------------|--------|
| EC7 | At photo upload step, click "Skip" or similar | App moves to District step. `photo_url` is empty string in final payload. | ☐ |
| EC8 | Submit application without photo | Backend accepts it (photo is optional). Application ID returned. | ☐ |

### 12.5 Already Applied Mobile Number

| # | Action | Expected Result | Status |
|---|--------|----------------|--------|
| EC9 | Use the same mobile number that already has a submitted application | After OTP verification, the bot shows "Already submitted" message with the existing Application ID instead of starting a new form. | ☐ |

### 12.6 Switching Urban ↔ Rural Resets Fields

| # | Action | Expected Result | Status |
|---|--------|----------------|--------|
| EC10 | In Local Body card, select Urban → choose Corporation → select body → then switch to Rural | All urban fields are cleared. Rural flow starts fresh. | ☐ |
| EC11 | Select Rural → pick position → fill fields → switch to Urban | All rural fields cleared. Urban flow starts fresh. | ☐ |

**EDGE CASES RESULT:** ☐ PASS &nbsp;&nbsp; ☐ FAIL

---

## 13. REVIEW SCREEN — Verify display per position

> After completing all steps, Review screen appears before Submit.

| # | Position | Fields shown in Review | Status |
|---|----------|----------------------|--------|
| R1 | Corporation Ward Member | Body type: Urban, Type: Corporation, Body: [Corp Name], Ward: [N], Position: Corporation Ward Member | ☐ |
| R2 | Municipality Ward Member | Body type: Urban, Type: Municipality, Body: [Muni Name], Ward: [text], Position: Municipality Ward Member | ☐ |
| R3 | Town Panchayat Ward Member | Body type: Urban, Type: Town Panchayat, Body: [TP Name], Ward: [text], Position: Town Panchayat Ward Member | ☐ |
| R4 | District Panchayat Ward Member | Body type: Rural, Ward: [N], Position: District Panchayat Ward Member | ☐ |
| R5 | Panchayat Union Ward Member | Body type: Rural, Panchayat Union: [Union], Ward: [text], Position: Panchayat Union Ward Member | ☐ |
| R6 | Village Panchayat President | Body type: Rural, Block: [Block], Village Panchayat: [VP], **no ward shown**, Position: Village Panchayat President | ☐ |
| R7 | Village Panchayat Ward Member | Body type: Rural, Block: [Block], Village Panchayat: [VP], Ward: [text], Position: Village Panchayat Ward Member | ☐ |
| R8 | Contest District | Shown on review screen | ☐ |

**REVIEW SCREEN RESULT:** ☐ PASS &nbsp;&nbsp; ☐ FAIL

---

## 14. BACKEND VALIDATION — Reject bad payloads

> Use DevTools → Network, or a REST client (Postman / curl) to send these intentionally broken payloads to `POST /api/chat/submit`.  
> This confirms the backend validation is position-aware.

| # | Payload sent | Expected HTTP response | Status |
|---|-------------|----------------------|--------|
| BV1 | Rural, `position_preferences[0]: "District Panchayat Ward Member"`, `local_body.ward: ""` | 400 — "Select your District Panchayat Ward." | ☐ |
| BV2 | Rural, `position_preferences[0]: "Panchayat Union Ward Member"`, `local_body.panchayat_union: ""`, `local_body.ward: "3"` | 400 — "Select Panchayat Union and Ward." | ☐ |
| BV3 | Rural, `position_preferences[0]: "Village Panchayat President"`, `local_body.panchayat_union: "Block"`, `local_body.village_panchayat: ""` | 400 — "Select Block and Village Panchayat." | ☐ |
| BV4 | Rural, `position_preferences[0]: "Village Panchayat Ward Member"`, all 3 fields filled | 200 — success (valid payload) | ☐ |
| BV5 | Urban, `body_type: "urban"`, `local_body.local_body_type: "Corporation"`, `local_body.local_body: ""` | 400 — "Select your local body." | ☐ |
| BV6 | Urban, all valid fields, `position_preferences[0]: "Corporation Ward Member"` | 200 — success | ☐ |
| BV7 | Missing `mobile` | 400 — "A verified mobile number is required." | ☐ |

**BACKEND VALIDATION RESULT:** ☐ PASS &nbsp;&nbsp; ☐ FAIL

---

## 15. POST-SUBMIT — Candidate Verification Page

> After a successful submission, you get an Application ID. Test the public verify page.

| # | Action | Expected Result | Status |
|---|--------|----------------|--------|
| PV1 | Open `http://localhost:5173/verify/[APPLICATION_ID]` from a Corp submission | Candidate card shows: name, district, **local body (Corporation name + ward)**, position. NOT blank. | ☐ |
| PV2 | Open verify page for a VP President submission | Card shows: Block name + Village Panchayat name. No ward line. | ☐ |
| PV3 | Open verify page for a VP Ward Member submission | Card shows: Block + Village + Ward. | ☐ |
| PV4 | Open verify page for District Panchayat Ward Member | Card shows: District Panchayat Ward N. | ☐ |
| PV5 | Click Download Card button | Downloads a 9:16 image with candidate details. | ☐ |
| PV6 | Open verify page with a fake ID (e.g. `/verify/BJP-0000-0000`) | "Application not found" message shown. No crash. | ☐ |

**CANDIDATE CARD RESULT:** ☐ PASS &nbsp;&nbsp; ☐ FAIL

---

## 16. ADMIN PANEL — Applications visible correctly

| # | Action | Expected Result | Status |
|---|--------|----------------|--------|
| AP1 | Log into admin panel (`/admin`) | Login works. | ☐ |
| AP2 | Open Applications list | Newly submitted test applications appear. | ☐ |
| AP3 | Open a Corp application detail | Shows: district, Corporation name, ward, position. Not blank. | ☐ |
| AP4 | Open a Village Panchayat President application | Shows: block, village panchayat. Ward is blank/empty (correct for president). | ☐ |
| AP5 | Open a District Panchayat Ward Member application | Shows: ward only. Union and village panchayat are blank (correct). | ☐ |

**ADMIN PANEL RESULT:** ☐ PASS &nbsp;&nbsp; ☐ FAIL

---

## 17. KNOWN ISSUES — Not blockers for redesign, document and decide

| # | Issue | Location | Action needed before LIVE? |
|---|-------|----------|--------------------------|
| KI1 | Public application endpoint (`GET /api/application/:id`) returns mobile + full voter PII | `backend/src/models/applicationModel.js` — `findApplicationByIdPublic()` | Yes — DPDP Act blocker |
| KI2 | Candidate photo fallback is an Unsplash stock photo URL (external, public person) | `CandidateVerificationPage.jsx:64` | Recommended before LIVE |
| KI3 | Backblaze B2 bucket is Private → uploaded photos/videos return 401 on the card | Server-side config — B2 console | Must fix before LIVE (media will not display) |

---

## 18. FINAL VERDICT CHECKLIST

Fill this after completing all tests.

| Section | Result |
|---------|--------|
| AUTH (A1–A10) | ☐ PASS ☐ FAIL |
| DISTRICT STEP (D1–D5) | ☐ PASS ☐ FAIL |
| FLOW 1 — Corporation Councillor | ☐ PASS ☐ FAIL |
| FLOW 2 — Municipal Councillor | ☐ PASS ☐ FAIL |
| FLOW 3 — Town Panchayat Councillor | ☐ PASS ☐ FAIL |
| FLOW 4 — District Panchayat Ward Member | ☐ PASS ☐ FAIL |
| FLOW 5 — Panchayat Union Ward Member | ☐ PASS ☐ FAIL |
| FLOW 6 — Village Panchayat President | ☐ PASS ☐ FAIL |
| FLOW 7 — Village Panchayat Ward Member | ☐ PASS ☐ FAIL |
| DISTRICT NORMALIZATION | ☐ PASS ☐ SKIP |
| EDGE CASES | ☐ PASS ☐ FAIL |
| REVIEW SCREEN (R1–R8) | ☐ PASS ☐ FAIL |
| BACKEND VALIDATION (BV1–BV7) | ☐ PASS ☐ FAIL |
| CANDIDATE CARD (PV1–PV6) | ☐ PASS ☐ FAIL |
| ADMIN PANEL (AP1–AP5) | ☐ PASS ☐ FAIL |

---

### DEPLOYMENT DECISION

**If ALL sections = PASS:**
> ✅ READY FOR DEPLOYMENT. Push to live server. Fix KI1 (PII endpoint) before or immediately after going live.

**If ANY section = FAIL:**
> ❌ NOT READY. Fix the failing test(s), re-run that section only, then re-assess.

---

*Generated: 2026-08-17 | Scope: bjp-localbody redesign — 7 position flows | Do not deploy until all ✅*
