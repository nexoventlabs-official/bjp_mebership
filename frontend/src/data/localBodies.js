// Tamil Nadu local body data for the candidate application flow.
// Rural / Urban selection drives which positions and location fields are shown.
// Urban local bodies mirror the EDM registration dataset.

export const ALL_DISTRICTS = [
  'Ariyalur', 'Chengalpattu', 'Chennai', 'Coimbatore', 'Cuddalore', 'Dharmapuri',
  'Dindigul', 'Erode', 'Kallakurichi', 'Kanchipuram', 'Kanyakumari', 'Karur',
  'Krishnagiri', 'Madurai', 'Mayiladuthurai', 'Nagapattinam', 'Namakkal', 'Nilgiris',
  'Perambalur', 'Pudukkottai', 'Ramanathapuram', 'Ranipet', 'Salem', 'Sivaganga',
  'Tenkasi', 'Thanjavur', 'Theni', 'Thoothukudi', 'Tiruchirappalli', 'Tirunelveli',
  'Tirupathur', 'Tiruppur', 'Tiruvallur', 'Tiruvannamalai', 'Tiruvarur', 'Vellore',
  'Viluppuram', 'Virudhunagar',
]

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

// Urban local body TYPES (drives the "Select Local Body Type" dropdown).
export const URBAN_BODY_TYPES = ['Town Panchayat', 'Municipality', 'Corporation']

// Named urban local bodies grouped by type (from the EDM dataset).
export const LOCAL_BODIES = {
  corporations: [
    { district: 'Chengalpattu', name: 'Tambaram' }, { district: 'Chennai', name: 'Chennai' },
    { district: 'Coimbatore', name: 'Coimbatore' }, { district: 'Cuddalore', name: 'Cuddalore' },
    { district: 'Dindigul', name: 'Dindigul' }, { district: 'Erode', name: 'Erode' },
    { district: 'Kanchipuram', name: 'Kanchipuram' }, { district: 'Kanyakumari', name: 'Nagercoil' },
    { district: 'Karur', name: 'Karur' }, { district: 'Krishnagiri', name: 'Hosur' },
    { district: 'Madurai', name: 'Madurai' }, { district: 'Salem', name: 'Salem' },
    { district: 'Thanjavur', name: 'Kumbakonam' }, { district: 'Thanjavur', name: 'Thanjavur' },
    { district: 'Thoothukudi', name: 'Thoothukudi' }, { district: 'Tiruchirappalli', name: 'Tiruchirappalli' },
    { district: 'Tirunelveli', name: 'Tirunelveli' }, { district: 'Tiruppur', name: 'Tiruppur' },
    { district: 'Tiruvallur', name: 'Avadi' }, { district: 'Vellore', name: 'Vellore' },
    { district: 'Virudhunagar', name: 'Sivakasi' },
  ],
  municipalities: [
    { district: 'Ariyalur', name: 'Ariyalur' }, { district: 'Ariyalur', name: 'Jayankondam' },
    { district: 'Chengalpattu', name: 'Chengalpattu' }, { district: 'Chengalpattu', name: 'Maduranthakam' },
    { district: 'Chengalpattu', name: 'Maraimalai Nagar' }, { district: 'Chengalpattu', name: 'Nandivaram-Guduvancheri' },
    { district: 'Coimbatore', name: 'Mettupalayam' }, { district: 'Coimbatore', name: 'Pollachi' },
    { district: 'Cuddalore', name: 'Chidambaram' }, { district: 'Cuddalore', name: 'Panruti' },
    { district: 'Cuddalore', name: 'Virudhachalam' }, { district: 'Dharmapuri', name: 'Dharmapuri' },
    { district: 'Dindigul', name: 'Kodaikanal' }, { district: 'Dindigul', name: 'Palani' },
    { district: 'Erode', name: 'Bhavani' }, { district: 'Erode', name: 'Gobichettipalayam' },
    { district: 'Erode', name: 'Sathyamangalam' }, { district: 'Kallakurichi', name: 'Kallakurichi' },
    { district: 'Kanyakumari', name: 'Colachel' }, { district: 'Kanyakumari', name: 'Padmanabhapuram' },
    { district: 'Karur', name: 'Kulithalai' }, { district: 'Krishnagiri', name: 'Krishnagiri' },
    { district: 'Madurai', name: 'Melur' }, { district: 'Madurai', name: 'Thirumangalam' },
    { district: 'Mayiladuthurai', name: 'Mayiladuthurai' }, { district: 'Nagapattinam', name: 'Nagapattinam' },
    { district: 'Namakkal', name: 'Namakkal' }, { district: 'Namakkal', name: 'Tiruchengode' },
    { district: 'Nilgiris', name: 'Coonoor' }, { district: 'Nilgiris', name: 'Udhagamandalam' },
    { district: 'Perambalur', name: 'Perambalur' }, { district: 'Pudukkottai', name: 'Pudukkottai' },
    { district: 'Ramanathapuram', name: 'Paramakudi' }, { district: 'Ramanathapuram', name: 'Ramanathapuram' },
    { district: 'Ranipet', name: 'Arakkonam' }, { district: 'Ranipet', name: 'Ranipet' },
    { district: 'Salem', name: 'Attur' }, { district: 'Salem', name: 'Mettur' },
    { district: 'Sivaganga', name: 'Karaikudi' }, { district: 'Sivaganga', name: 'Sivaganga' },
    { district: 'Tenkasi', name: 'Sankarankovil' }, { district: 'Tenkasi', name: 'Tenkasi' },
    { district: 'Thanjavur', name: 'Pattukkottai' }, { district: 'Theni', name: 'Bodinayakanur' },
    { district: 'Theni', name: 'Theni-Allinagaram' }, { district: 'Thoothukudi', name: 'Kovilpatti' },
    { district: 'Tiruchirappalli', name: 'Manapparai' }, { district: 'Tirunelveli', name: 'Ambasamudram' },
    { district: 'Tirupathur', name: 'Ambur' }, { district: 'Tirupathur', name: 'Vaniyambadi' },
    { district: 'Tiruppur', name: 'Dharapuram' }, { district: 'Tiruvallur', name: 'Thiruvallur' },
    { district: 'Tiruvannamalai', name: 'Arani' }, { district: 'Tiruvannamalai', name: 'Tiruvannamalai' },
    { district: 'Tiruvarur', name: 'Mannargudi' }, { district: 'Tiruvarur', name: 'Tiruvarur' },
    { district: 'Vellore', name: 'Gudiyatham' }, { district: 'Viluppuram', name: 'Tindivanam' },
    { district: 'Viluppuram', name: 'Viluppuram' }, { district: 'Virudhunagar', name: 'Aruppukottai' },
    { district: 'Virudhunagar', name: 'Rajapalayam' }, { district: 'Virudhunagar', name: 'Srivilliputhur' },
    { district: 'Virudhunagar', name: 'Virudhunagar' },
  ],
  town_panchayats: [
    { district: 'Ariyalur', name: 'Udayarpalayam' }, { district: 'Chengalpattu', name: 'Mamallapuram' },
    { district: 'Chengalpattu', name: 'Thirukalukundram' }, { district: 'Coimbatore', name: 'Annur' },
    { district: 'Coimbatore', name: 'Perur' }, { district: 'Coimbatore', name: 'Sulur' },
    { district: 'Cuddalore', name: 'Bhuvanagiri' }, { district: 'Cuddalore', name: 'Kurinjipadi' },
    { district: 'Dharmapuri', name: 'Harur' }, { district: 'Dharmapuri', name: 'Pennagaram' },
    { district: 'Dindigul', name: 'Natham' }, { district: 'Dindigul', name: 'Nilakottai' },
    { district: 'Erode', name: 'Anthiyur' }, { district: 'Erode', name: 'Chennimalai' },
    { district: 'Erode', name: 'Perundurai' }, { district: 'Kallakurichi', name: 'Chinnasalem' },
    { district: 'Kanchipuram', name: 'Uthiramerur' }, { district: 'Kanyakumari', name: 'Kanniyakumari' },
    { district: 'Karur', name: 'Aravakurichi' }, { district: 'Krishnagiri', name: 'Kaveripattinam' },
    { district: 'Madurai', name: 'Vadipatti' }, { district: 'Nagapattinam', name: 'Velankanni' },
    { district: 'Namakkal', name: 'Sendamangalam' }, { district: 'Nilgiris', name: 'Kotagiri' },
    { district: 'Perambalur', name: 'Arumbavur' }, { district: 'Pudukkottai', name: 'Ponnamaravathi' },
    { district: 'Ramanathapuram', name: 'Thondi' }, { district: 'Ranipet', name: 'Thakkolam' },
    { district: 'Salem', name: 'Omalur' }, { district: 'Salem', name: 'Vazhapadi' },
    { district: 'Sivaganga', name: 'Singampunari' }, { district: 'Tenkasi', name: 'Sivagiri' },
    { district: 'Thanjavur', name: 'Orathanadu' }, { district: 'Theni', name: 'Uthamapalayam' },
    { district: 'Thoothukudi', name: 'Srivaikuntam' }, { district: 'Tiruchirappalli', name: 'Manachanallur' },
    { district: 'Tiruchirappalli', name: 'Thottiyam' }, { district: 'Tirunelveli', name: 'Cheranmahadevi' },
    { district: 'Tirunelveli', name: 'Nanguneri' }, { district: 'Tirupathur', name: 'Natrampalli' },
    { district: 'Tiruppur', name: 'Avinashi' }, { district: 'Tiruppur', name: 'Madathukulam' },
    { district: 'Tiruvallur', name: 'Gummidipoondi' }, { district: 'Tiruvallur', name: 'Uthukottai' },
    { district: 'Tiruvannamalai', name: 'Chengam' }, { district: 'Tiruvannamalai', name: 'Polur' },
    { district: 'Tiruvarur', name: 'Muthupet' }, { district: 'Tiruvarur', name: 'Needamangalam' },
    { district: 'Vellore', name: 'Pallikonda' }, { district: 'Viluppuram', name: 'Gingee' },
    { district: 'Viluppuram', name: 'Marakkanam' }, { district: 'Virudhunagar', name: 'Watrap' },
  ],
}

export function positionsFor(bodyType) {
  if (bodyType === 'rural') return RURAL_POSITIONS
  if (bodyType === 'urban') return URBAN_POSITIONS
  return []
}

// Returns the list of local bodies for a given urban body type, sorted by name.
// Each item: { name, district, label } where label is "name — district".
export function bodiesForType(urbanType) {
  const key = urbanType === 'Corporation' ? 'corporations'
    : urbanType === 'Municipality' ? 'municipalities'
    : urbanType === 'Town Panchayat' ? 'town_panchayats' : null
  if (!key) return []
  return LOCAL_BODIES[key]
    .map((b) => ({ name: b.name, district: b.district, label: `${b.name} — ${b.district}` }))
    .sort((a, b) => a.label.localeCompare(b.label))
}
