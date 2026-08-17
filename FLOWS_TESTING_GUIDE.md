# BJP Local Body App — 7 Positions Live Testing Guide (Real DB1 EPICs)

**File Path:** `FLOWS_TESTING_GUIDE.md`
**Application URL:** `http://localhost:5173` (Local Dev) or `https://bjp-mebership.vercel.app` (Live)
**Dev OTP:** `123456`

This guide contains **100% verified, real EPIC numbers from DB1 (`voter_db` on DigitalOcean)** matching the exact target districts for each flow!

---

## Real Voter DB (DB1) EPIC Numbers Matrix

|      Flow #      | Position Name                            | Contesting District |     Real DB1 EPIC No     | Voter Name in DB1 | Assembly Constituency in DB1        | Voter District in DB1 |
| :--------------: | :--------------------------------------- | :------------------ | :----------------------: | :---------------- | :---------------------------------- | :--------------------: |
| **Flow 1** | **Corporation Ward Member**        | Chennai             | **`AAQ0312140`** | Bhuvaneswari      | Dr.Radhakrishnan Nagar (`ass_11`) |   **CHENNAI**   |
| **Flow 2** | **Municipality Ward Member**       | Dindigul            | **`AEB1604248`** | Vairamani         | Palani (`ass_127`)                |   **DINDIGUL**   |
| **Flow 3** | **Town Panchayat Ward Member**     | Coimbatore          | **`AAQ0645036`** | Megala            | Palladam (`ass_115`)              |  **COIMBATORE**  |
| **Flow 4** | **District Panchayat Ward Member** | Thiruvallur         | **`AAQ0178764`** | Jaishankar        | Gummidipoondi (`ass_1`)           | **THIRUVALLUR** |
| **Flow 5** | **Panchayat Union Ward Member**    | Kancheepuram        | **`TRQ2226256`** | Abishek           | Uthiramerur (`ass_36`)            | **KANCHEEPURAM** |
| **Flow 6** | **Village Panchayat President**    | Kancheepuram        | **`TRQ2226256`** | Abishek           | Uthiramerur (`ass_36`)            | **KANCHEEPURAM** |
| **Flow 7** | **Village Panchayat Ward Member**  | Kancheepuram        | **`TRQ2226256`** | Abishek           | Uthiramerur (`ass_36`)            | **KANCHEEPURAM** |
| **Bonus** | **Chengalpattu Flow**              | Chengalpattu        | **`AAH5009568`** | Akansha Jaiswal   | Thiruporur (`ass_33`)             | **CHENGALPATTU** |

---

## Step-by-Step Testing Instructions

---

### FLOW 1 — Municipal Corporation Councillor (Urban)

* **Position**: Corporation Ward Member
* **Real DB1 EPIC**: **`AAQ0312140`** (*Bhuvaneswari*)
* **District**: `CHENNAI`

1. Open `http://localhost:5173` -> Mobile: `9876543210` -> OTP: `123456`.
2. Enter EPIC: **`AAQ0312140`** -> Confirm Voter Card (**Bhuvaneswari**).
3. **Contesting District Step**: Select `Chennai` -> Click **Confirm District**.
4. **Local Body & Position Step**:
   - Select Local Body Type: **Urban Local Body**
   - Select Urban Body Type: **Corporation**
   - Select Corporation Name: `Greater Chennai Corporation`
   - Select Ward Number: `Ward 12`
   - Click **Continue**.
5. Complete essays -> Click **Submit Application**.

✅ **Result**: Submits with `Position: Corporation Ward Member`.

---

### FLOW 2 — Municipal Councillor (Urban)

* **Position**: Municipality Ward Member
* **Real DB1 EPIC**: **`AEB1604248`** (*Vairamani*)
* **District**: `DINDIGUL`

1. Mobile: `9876543210` -> OTP: `123456`.
2. Enter EPIC: **`AEB1604248`** -> Confirm Voter Card (**Vairamani**).
3. **Contesting District Step**: Select `Dindigul` -> Click **Confirm District**.
4. **Local Body & Position Step**:
   - Select Local Body Type: **Urban Local Body**
   - Select Urban Body Type: **Municipality**
   - Select Municipality Name: `Kodaikanal`
   - Enter Ward Number / Name: `Ward 14`
   - Click **Continue**.
5. Complete essays -> Click **Submit Application**.

✅ **Result**: Submits with `Position: Municipality Ward Member`.

---

### FLOW 3 — Town Panchayat Councillor (Urban)

* **Position**: Town Panchayat Ward Member
* **Real DB1 EPIC**: **`AAQ0645036`** (*Megala*)
* **District**: `COIMBATORE`

1. Mobile: `9876543210` -> OTP: `123456`.
2. Enter EPIC: **`AAQ0645036`** -> Confirm Voter Card (**Megala**).
3. **Contesting District Step**: Select `Coimbatore` -> Click **Confirm District**.
4. **Local Body & Position Step**:
   - Select Local Body Type: **Urban Local Body**
   - Select Urban Body Type: **Town Panchayat**
   - Select Town Panchayat Name: `Annur`
   - Enter Ward Number / Name: `Ward 5`
   - Click **Continue**.
5. Complete essays -> Click **Submit Application**.

✅ **Result**: Submits with `Position: Town Panchayat Ward Member`.

---

### FLOW 4 — District Panchayat Ward Member (Rural)

* **Position**: District Panchayat Ward Member
* **Real DB1 EPIC**: **`AAQ0178764`** (*Jaishankar*)
* **District**: `THIRUVALLUR`

1. Mobile: `9876543210` -> OTP: `123456`.
2. Enter EPIC: **`AAQ0178764`** -> Confirm Voter Card (**Jaishankar**).
3. **Contesting District Step**: Select `Thiruvallur` -> Click **Confirm District**.
4. **Local Body & Position Step**:
   - Select Local Body Type: **Rural Local Body**
   - Select Position: **District Panchayat Ward Member**
   - Select District Panchayat Ward: `Ward 12`
   - Click **Continue**.
5. Complete essays -> Click **Submit Application**.

✅ **Result**: Submits with `Position: District Panchayat Ward Member`.

---

### FLOW 5 — Panchayat Union Ward Member (Rural)

* **Position**: Panchayat Union Ward Member
* **Real DB1 EPIC**: **`TRQ2226256`** (*Abishek*)
* **District**: `KANCHEEPURAM`

1. Mobile: `9876543210` -> OTP: `123456`.
2. Enter EPIC: **`TRQ2226256`** -> Confirm Voter Card (**Abishek**, Uthiramerur — Kancheepuram).
3. **Contesting District Step**: Select `Kancheepuram` -> Click **Confirm District**.
4. **Local Body & Position Step**:
   - Select Local Body Type: **Rural Local Body**
   - Select Position: **Panchayat Union Ward Member**
   - Select Union: `Walajabad`
   - Enter Ward Number / Name: `Ward 4`
   - Click **Continue**.
5. Complete essays -> Click **Submit Application**.

✅ **Result**: Submits with `Position: Panchayat Union Ward Member`.

---

### FLOW 6 — Village Panchayat President (Rural)

* **Position**: Village Panchayat President
* **Real DB1 EPIC**: **`TRQ2226256`** (*Abishek*)
* **District**: `KANCHEEPURAM`

1. Mobile: `9876543210` -> OTP: `123456`.
2. Enter EPIC: **`TRQ2226256`** -> Confirm Voter Card (**Abishek**, Uthiramerur — Kancheepuram).
3. **Contesting District Step**: Select `Kancheepuram` -> Click **Confirm District**.
4. **Local Body & Position Step**:
   - Select Local Body Type: **Rural Local Body**
   - Select Position: **Village Panchayat President**
   - Select Block: `KANCHEEPURAM`
   - Select Village Panchayat: `Angambakkam`
   - *(Ward Number field is hidden for President)*
   - Click **Continue**.
5. Complete essays -> Click **Submit Application**.

✅ **Result**: Submits without requiring a Ward.

---

### FLOW 7 — Village Panchayat Ward Member (Rural)

* **Position**: Village Panchayat Ward Member
* **Real DB1 EPIC**: **`TRQ2226256`** (*Abishek*)
* **District**: `KANCHEEPURAM`

1. Mobile: `9876543210` -> OTP: `123456`.
2. Enter EPIC: **`TRQ2226256`** -> Confirm Voter Card (**Abishek**, Uthiramerur — Kancheepuram).
3. **Contesting District Step**: Select `Kancheepuram` -> Click **Confirm District**.
4. **Local Body & Position Step**:
   - Select Local Body Type: **Rural Local Body**
   - Select Position: **Village Panchayat Ward Member**
   - Select Block: `KANCHEEPURAM`
   - Select Village Panchayat: `Angambakkam`
   - Enter Ward Number / Name: `Ward 2`
   - Click **Continue**.
5. Complete essays -> Click **Submit Application**.

✅ **Result**: Submits with all 3 rural fields (`Block`, `VP`, `Ward`).

---

### BONUS — Chengalpattu District Flow

* **Real DB1 EPIC**: **`AAH5009568`** (*Akansha Jaiswal*)
* **District in DB1**: `CHENGALPATTU` (Thiruporur — 33)

1. Enter EPIC: **`AAH5009568`** -> Displays **Akansha Jaiswal** (Thiruporur — 33, District: `CHENGALPATTU`).
2. Select Contesting District: `Chengalpattu` -> Proceed with Chengalpattu local body selection!
