# BJP Local Body — Application Flow Redesign Plan

**Status:** Approved, pending local implementation
**Scope:** Frontend + small backend fix. Zero changes to DB schema or admin panel.
**Do not touch live server until local build is tested end-to-end.**

---

## Approved User Flows (All 7 Positions)

### FLOW 1 — Municipal Corporation Councillor (Urban)

```
1.  Welcome screen
2.  Enter mobile number
3.  Enter OTP
4.  Enter BJP Membership ID (optional / skip)
5.  Enter EPIC number
6.  Voter card displayed → Confirm or Re-enter
7.  Upload passport photo (optional)
8.  District
    → Pre-filled from EPIC (e.g. Chennai)
    → Can change via 38-district dropdown
9.  Local Body + Position
    → Toggle: URBAN selected
    → Body Type: Corporation
    → Corporation Name: dropdown filtered by district
        e.g. Chennai    → Greater Chennai Corporation
             Coimbatore → Coimbatore Municipal Corporation
    → Ward: dropdown (Ward 1 to Ward N)
        e.g. Chennai    → Ward 1 to Ward 200
             Coimbatore → Ward 1 to Ward 100
    → Position: auto-set → "Corporation Ward Member"
10. Social media links (optional)
11. Pitch video upload (optional)
12. Work / Experience (500 words)
13. Local area understanding (500 words)
14. Ward priorities + Grievance plan (optional)
15. Document upload (optional)
16. Review all → Edit or Submit
17. Submitted
```

### FLOW 2 — Municipal Councillor (Urban)

```
1–7. Same as Flow 1
8.  District
    → Pre-filled from EPIC (e.g. Dindigul)
    → Can change via 38-district dropdown
9.  Local Body + Position
    → Toggle: URBAN selected
    → Body Type: Municipality
    → Municipality Name: dropdown filtered by district
        e.g. Dindigul → Kodaikanal / Palani
             Erode    → Bhavani / Gobichettipalayam / Sathyamangalam
    → Ward: free text (no master data available)
    → Position: auto-set → "Municipality Ward Member"
10–17. Same as Flow 1
```

### FLOW 3 — Town Panchayat Councillor (Urban)

```
1–7. Same as Flow 1
8.  District
    → Pre-filled from EPIC (e.g. Coimbatore)
    → Can change via 38-district dropdown
9.  Local Body + Position
    → Toggle: URBAN selected
    → Body Type: Town Panchayat
    → Town Panchayat Name: dropdown filtered by district
        e.g. Coimbatore → Annur / Perur / Sulur
             Erode      → Anthiyur / Chennimalai / Perundurai
    → Ward: free text (no master data available)
    → Position: auto-set → "Town Panchayat Ward Member"
10–17. Same as Flow 1
```

### FLOW 4 — District Panchayat Ward Member (Rural)

```
1–7. Same as Flow 1
8.  District
    → Pre-filled from EPIC (e.g. Thiruvallur)
    → Can change via 38-district dropdown
9.  Local Body + Position
    → Toggle: RURAL selected
    → Position: District Panchayat Ward Member
    → Ward: dropdown (Ward 1 to Ward N based on district)
        e.g. Thiruvallur  → Ward 1 to Ward 25
             Vellore       → Ward 1 to Ward 14
             Kancheepuram  → Ward 1 to Ward 11
10–17. Same as Flow 1
```

### FLOW 5 — Panchayat Union Ward Member (Rural)

```
1–7. Same as Flow 1
8.  District
    → Pre-filled from EPIC (e.g. Kancheepuram)
    → Can change via 38-district dropdown
9.  Local Body + Position
    → Toggle: RURAL selected
    → Position: Panchayat Union Ward Member
    → Panchayat Union: dropdown filtered by district
        e.g. Kancheepuram → Kancheepuram / Walajabad /
                             Uthiramerur / Sriperumbudur / Kundrathur
    → Ward: free text (no master data available)
10–17. Same as Flow 1
```

### FLOW 6 — Village Panchayat President (Rural)

```
1–7. Same as Flow 1
8.  District
    → Pre-filled from EPIC (e.g. Kancheepuram)
    → Can change via 38-district dropdown
9.  Local Body + Position
    → Toggle: RURAL selected
    → Position: Village Panchayat President
    → Block: dropdown filtered by district
        e.g. Kancheepuram → Kancheepuram / Walajabad /
                             Uthiramerur / Sriperumbudur / Kundrathur
    → Village Panchayat: dropdown filtered by block
        e.g. Kancheepuram block → Angambakkam / Ariyaperumpakkam /
                                   Arpaakkam / Asoor / ...
    → Ward: NOT REQUIRED — one president per panchayat
    → Position: auto-set → "Village Panchayat President"
10–17. Same as Flow 1
```

### FLOW 7 — Village Panchayat Ward Member (Rural)

```
1–7. Same as Flow 1
8.  District
    → Pre-filled from EPIC (e.g. Kancheepuram)
    → Can change via 38-district dropdown
9.  Local Body + Position
    → Toggle: RURAL selected
    → Position: Village Panchayat Ward Member
    → Block: dropdown filtered by district
        e.g. Kancheepuram → Kancheepuram / Walajabad /
                             Uthiramerur / Sriperumbudur / Kundrathur
    → Village Panchayat: dropdown filtered by block
        e.g. Kancheepuram block → Angambakkam / Ariyaperumpakkam /
                                   Arpaakkam / Asoor / ...
    → Ward: free text (no master data available)
    → Position: auto-set → "Village Panchayat Ward Member"
10–17. Same as Flow 1
```

---

## Source Data (6 Excel Files)

All files are in `C:\Users\Admin\Downloads\`

| File                                                       | Used For                                                   | Records                       |
| ---------------------------------------------------------- | ---------------------------------------------------------- | ----------------------------- |
| `Tamil_Nadu_25_Municipal_Corporations_Ward.xlsx`         | Corp names + ward counts per corp                          | 25 corps, 1,566 wards         |
| `Tamil_Nadu_Municipalities_District_Ward.xlsx`           | Municipality names by district                             | 166 municipalities            |
| `Tamil_Nadu_Town_Panchayat_District_Town_Panchayat.xlsx` | Town Panchayat names by district                           | 458 TPs                       |
| `Tamil_Nadu_District_Panchayat_Ward_Count.xlsx`          | Ward count per district (rural)                            | 37 districts                  |
| `Tamil_Nadu_Panchayat_Union_All_Districts.xlsx`          | Panchayat Union names by district                          | 388 unions                    |
| `ThamilNadu_Grama_Panchat list.xlsx`                     | Block names by district + Village Panchayat names by block | 388 blocks, 12,525 panchayats |

---

## Files to Change

```
bjp-localbody/
├── frontend/
│   ├── src/
│   │   ├── data/
│   │   │   └── localBodies.js          ← FULL REWRITE (data expansion)
│   │   └── pages/
│   │       └── ChatbotPage.jsx         ← STEP 8 + STEP 9 redesign
└── backend/
    └── src/
        └── controllers/
            └── chatController.js       ← SMALL FIX (rural validation only)
```

**Nothing else changes.** Admin panel, DB schema, other controllers — untouched.

---

## Implementation Steps

### STEP 1 — Extract Excel data into localBodies.js

**File:** `frontend/src/data/localBodies.js`
**Method:** Python script reads all 6 Excel files → outputs JS data objects

Data structures to build:

```js
// 25 corporations with ward counts
CORPORATIONS_BY_DISTRICT = {
  'Chennai': [{ name: 'Greater Chennai Corporation', wards: 200 }],
  'Coimbatore': [{ name: 'Coimbatore Municipal Corporation', wards: 100 }],
  ...
}

// 166 municipalities grouped by district
MUNICIPALITIES_BY_DISTRICT = {
  'Ariyalur': ['Ariyalur', 'Jayankondam'],
  'Dindigul': ['Kodaikanal', 'Palani'],
  ...
}

// 458 town panchayats grouped by district
TOWN_PANCHAYATS_BY_DISTRICT = {
  'Ariyalur': ['Udayarpalayam', 'Varadarajanpettai'],
  'Coimbatore': ['Annur', 'Perur', 'Sulur'],
  ...
}

// District Panchayat ward counts (for dropdown 1–N)
DISTRICT_PANCHAYAT_WARD_COUNT = {
  'Kancheepuram': 11,
  'Chengalpattu': 16,
  'Thiruvallur': 25,
  ...
}

// 388 panchayat unions grouped by district
PANCHAYAT_UNIONS_BY_DISTRICT = {
  'Ariyalur': ['Andimadam', 'Ariyalur', 'Jayankondan', 'Sendurai', ...],
  'Kancheepuram': ['Kancheepuram', 'Walajabad', 'Uthiramerur', 'Sriperumbudur', 'Kundrathur'],
  ...
}

// 388 blocks grouped by district (same source as panchayat unions)
BLOCKS_BY_DISTRICT = {
  'Kancheepuram': ['Kancheepuram', 'Walajabad', 'Uthiramerur', 'Sriperumbudur', 'Kundrathur'],
  ...
}

// 12,525 village panchayats grouped by block
PANCHAYATS_BY_BLOCK = {
  'KANCHEEPURAM': ['Angambakkam', 'Ariyaperumpakkam', 'Arpaakkam', 'Asoor', ...],
  'WALAJABAD': [...],
  ...
}
```

Helper functions to keep (updated):

```js
export function corporationsForDistrict(district) { ... }
export function municipalitiesForDistrict(district) { ... }
export function townPanchayatsForDistrict(district) { ... }
export function wardsForCorporation(corpName) { ... }  // returns array [1..N]
export function districtPanchayatWards(district) { ... } // returns array [1..N]
export function unionsForDistrict(district) { ... }
export function blocksForDistrict(district) { ... }
export function panchayatsForBlock(block) { ... }
```

---

### STEP 2 — Add District Step to ChatbotPage.jsx

**New chat state:** `S.DISTRICT` — insert between `S.CONFIRM_VOTER` and `S.PHOTO_UPLOAD`

**New component:** `DistrictMsg`

- Pre-fills with `data.voter.district`
- Shows full 38-district dropdown
- User can confirm or change
- On submit: saves `data.contestDistrict`
- Passes `contestDistrict` into subsequent steps

**State transition change:**

```
BEFORE: CONFIRM_VOTER → PHOTO_UPLOAD → LOCAL_BODY
AFTER:  CONFIRM_VOTER → DISTRICT [NEW] → PHOTO_UPLOAD → LOCAL_BODY
```

Add `S.DISTRICT` to session restore `stepTypeMap` so mid-session refresh works.

---

### STEP 3 — Rewrite LocalBodyMsg Component in ChatbotPage.jsx

**Component receives:** `contestDistrict` as prop (from Step 2)

**New internal state:**

```js
bodyType          // 'urban' | 'rural'
urbanBodyType     // 'Corporation' | 'Municipality' | 'Town Panchayat'
urbanBodyName     // selected body name
urbanWard         // ward number (string)
ruralPosition     // one of 4 rural positions
ruralUnion        // for Panchayat Union Ward Member
ruralUnionWard    // for Panchayat Union Ward Member
ruralBlock        // for Village Panchayat flows
ruralPanchayat    // for Village Panchayat flows
ruralVPWard       // for Village Panchayat Ward Member only
ruralDPWard       // for District Panchayat Ward Member
```

**Urban rendering logic:**

```
if urbanBodyType === 'Corporation':
  show corporationsForDistrict(contestDistrict) dropdown
  then wardsForCorporation(selected) dropdown

if urbanBodyType === 'Municipality':
  show municipalitiesForDistrict(contestDistrict) dropdown
  then free text ward input

if urbanBodyType === 'Town Panchayat':
  show townPanchayatsForDistrict(contestDistrict) dropdown
  then free text ward input
```

**Rural rendering logic:**

```
if ruralPosition === 'District Panchayat Ward Member':
  show districtPanchayatWards(contestDistrict) dropdown

if ruralPosition === 'Panchayat Union Ward Member':
  show unionsForDistrict(contestDistrict) dropdown
  then free text ward input

if ruralPosition === 'Village Panchayat President':
  show blocksForDistrict(contestDistrict) dropdown
  then panchayatsForBlock(selectedBlock) dropdown
  [no ward field]

if ruralPosition === 'Village Panchayat Ward Member':
  show blocksForDistrict(contestDistrict) dropdown
  then panchayatsForBlock(selectedBlock) dropdown
  then free text ward input
```

**Output payload from this component (must match exactly):**

Urban:

```js
{
  bodyType: 'urban',
  localBody: {
    urbanType: 'Corporation' | 'Municipality' | 'Town Panchayat',
    urbanBody: 'body name',
    urbanWard: 'ward'
  },
  positionPrefs: ['Corporation Ward Member', '', '']  // auto-set, index 0 only
}
```

Rural:

```js
{
  bodyType: 'rural',
  localBody: {
    ruralUnion: 'panchayat union name OR block name',  // maps to panchayat_union in backend
    ruralPanchayat: 'village panchayat name',           // maps to village_panchayat in backend
    ruralWard: 'ward number'
  },
  positionPrefs: ['Village Panchayat Ward Member', '', '']  // auto-set
}
```

**Key rule:** Output shape must stay identical to current — `localBodyPayload()` function reads these fields and converts them for the backend.

---

### STEP 4 — Remove Separate PositionMsg Step (Urban only)

For Urban: position is auto-set inside LocalBodyMsg — `PositionMsg` step is skipped entirely.

**State transition change (urban path):**

```
BEFORE: LOCAL_BODY → POSITION → SOCIAL
AFTER:  LOCAL_BODY → SOCIAL   (position already in data.positionPrefs)
```

For Rural: position is selected at the top of the LocalBodyMsg component itself — `PositionMsg` step is also skipped.

**handleLocalBodySubmit change:**

```js
// BEFORE
const handleLocalBodySubmit = async ({ bodyType, localBody }) => {
  patchData({ bodyType, localBody, positionPrefs: ['', '', ''] })
  addMsg('bot', 'position', {})
  setChatState(S.POSITION)
}

// AFTER
const handleLocalBodySubmit = async ({ bodyType, localBody, positionPrefs }) => {
  patchData({ bodyType, localBody, positionPrefs })
  addMsg('bot', 'social', {})
  setChatState(S.SOCIAL)
}
```

---

### STEP 5 — Backend Fix (chatController.js)

**Problem:** Current rural validation requires all 3 fields regardless of position.
Village Panchayat President has no ward. District Panchayat Ward Member has no union/panchayat.

**Current code (line ~132):**

```js
if (!panchayatUnion || !villagePanchayat || !ward) {
  return res.status(400).json({ success: false, message: 'Enter Panchayat Union, Village Panchayat and Ward / Area.' })
}
localBody = { type: 'rural', panchayat_union: panchayatUnion, village_panchayat: villagePanchayat, ward }
```

**New code — validate based on position:**

```js
const ruralPosition = prefs[0]  // read after prefs are parsed (move validation order)

if (ruralPosition === 'District Panchayat Ward Member') {
  const ward = String(lbIn.ward || '').trim()
  if (!ward) return res.status(400).json({ success: false, message: 'Select your ward.' })
  localBody = { type: 'rural', ward }

} else if (ruralPosition === 'Panchayat Union Ward Member') {
  const panchayatUnion = String(lbIn.panchayat_union || '').trim()
  const ward = String(lbIn.ward || '').trim()
  if (!panchayatUnion || !ward) return res.status(400).json({ success: false, message: 'Select Panchayat Union and enter Ward.' })
  localBody = { type: 'rural', panchayat_union: panchayatUnion, ward }

} else if (ruralPosition === 'Village Panchayat President') {
  const panchayatUnion = String(lbIn.panchayat_union || '').trim()
  const villagePanchayat = String(lbIn.village_panchayat || '').trim()
  if (!panchayatUnion || !villagePanchayat) return res.status(400).json({ success: false, message: 'Select Block and Village Panchayat.' })
  localBody = { type: 'rural', panchayat_union: panchayatUnion, village_panchayat: villagePanchayat }

} else {
  // Village Panchayat Ward Member — all 3 required
  const panchayatUnion = String(lbIn.panchayat_union || '').trim()
  const villagePanchayat = String(lbIn.village_panchayat || '').trim()
  const ward = String(lbIn.ward || '').trim()
  if (!panchayatUnion || !villagePanchayat || !ward) return res.status(400).json({ success: false, message: 'Select Block, Village Panchayat and enter Ward.' })
  localBody = { type: 'rural', panchayat_union: panchayatUnion, village_panchayat: villagePanchayat, ward }
}
```

**Note:** Move position parsing to BEFORE the local_body block so `prefs[0]` is available.
`backend/src/constants/localBodies.js` — no changes needed.

---

### STEP 6 — Update ReviewMsg in ChatbotPage.jsx

ReviewMsg currently shows local body + position fields. Update display to match new structure:

- Urban: show Body Type, Body Name, Ward, Position (auto-set)
- Rural District Panchayat: show Ward only
- Rural Panchayat Union: show Union, Ward
- Rural Village Panchayat President: show Block, Village Panchayat
- Rural Village Panchayat Ward Member: show Block, Village Panchayat, Ward

Edit mode inside ReviewMsg also needs updating — same cascading dropdowns as LocalBodyMsg.

---

## Build Order

```
[ ] 1. Python script → extract Excel data → localBodies.js
[ ] 2. localBodies.js — verify all helper functions work correctly
[ ] 3. Backend fix — chatController.js rural validation
[ ] 4. DistrictMsg component + S.DISTRICT state
[ ] 5. LocalBodyMsg rewrite — urban path first
[ ] 6. LocalBodyMsg rewrite — rural path
[ ] 7. Remove PositionMsg from flow (skip step, keep component for now)
[ ] 8. ReviewMsg update — display + edit mode
[ ] 9. Full local test — all 7 flows end to end
[ ] 10. Deploy to live server only after all 7 pass
```

---

## Local Testing Checklist

Before pushing to live, verify each flow manually:

```
[ ] Flow 1 — Corporation: district filter works, ward dropdown shows correct count
[ ] Flow 2 — Municipality: district filter works, ward accepts free text
[ ] Flow 3 — Town Panchayat: district filter works, ward accepts free text
[ ] Flow 4 — District Panchayat: ward dropdown 1–N correct for each district
[ ] Flow 5 — Panchayat Union: union dropdown filtered by district, ward free text
[ ] Flow 6 — Village Panchayat President: block → panchayat chain works, no ward shown
[ ] Flow 7 — Village Panchayat Ward Member: block → panchayat → ward free text
[ ] Session restore works at S.DISTRICT step
[ ] Changing district resets all downstream selections
[ ] Review screen shows correct fields per position
[ ] Edit from review screen works for all 7
[ ] Backend accepts submission for all 7 (no 400 errors)
[ ] Existing application data in admin panel unaffected
```

---

## What Does NOT Change

- Steps 1–7 and 10–17 of the application flow
- `backend/src/constants/localBodies.js`
- `backend/src/services/applicationService.js`
- All admin panel pages (ApplicationsPage, ApplicationDetailPage, ReportsPage)
- MongoDB schema
- Final submit payload field names (`body_type`, `local_body`, `position_preferences`)
- Translations file (add new strings only — do not remove existing)
- All other apps on the server (bjptn, edm, vanigan)

---

*Plan approved. Implement locally. Test all 7 flows. Deploy only after full pass.*
