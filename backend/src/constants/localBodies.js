// Local body positions by body type — mirrors the frontend data file so the
// server can validate submissions.
export const RURAL_POSITIONS = [
  'Village Panchayat Ward Member',
  'Village Panchayat President',
  'Panchayat Union Ward Member',
  'District Panchayat Ward Member',
]

export const URBAN_POSITIONS = [
  'Corporation Ward Member',
  'Municipality Ward Member',
  'Town Panchayat Ward Member',
]

// Urban local body types (for validating the local_body payload).
export const URBAN_BODY_TYPES = ['Town Panchayat', 'Municipality', 'Corporation']

export const ALL_DISTRICTS = [
  'Ariyalur', 'Chengalpattu', 'Chennai', 'Coimbatore', 'Cuddalore', 'Dharmapuri',
  'Dindigul', 'Erode', 'Kallakurichi', 'Kanchipuram', 'Kanyakumari', 'Karur',
  'Krishnagiri', 'Madurai', 'Mayiladuthurai', 'Nagapattinam', 'Namakkal', 'Nilgiris',
  'Perambalur', 'Pudukkottai', 'Ramanathapuram', 'Ranipet', 'Salem', 'Sivaganga',
  'Tenkasi', 'Thanjavur', 'Theni', 'Thoothukudi', 'Tiruchirappalli', 'Tirunelveli',
  'Tirupathur', 'Tiruppur', 'Tiruvallur', 'Tiruvannamalai', 'Tiruvarur', 'Vellore',
  'Viluppuram', 'Virudhunagar',
]

export function positionsFor(bodyType) {
  if (bodyType === 'rural') return RURAL_POSITIONS
  if (bodyType === 'urban') return URBAN_POSITIONS
  return []
}
