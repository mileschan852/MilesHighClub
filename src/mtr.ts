// Hong Kong MTR station list, ordered by line then position.
// Used for the "Closest MTR" dropdown in the booking form and profile.
export const MTR_STATIONS: string[] = [
  // Island Line
  'Kennedy Town', 'HKU', 'Sai Ying Pun', 'Sheung Wan', 'Hong Kong', 'Central',
  'Admiralty', 'Wan Chai', 'Causeway Bay', 'Tin Hau', 'Fortress Hill',
  'North Point', 'Quarry Bay', 'Tai Koo', 'Sai Wan Ho', 'Shau Kei Wan',
  'Heng Fa Chuen', 'Chai Wan',
  // Tsuen Wan Line
  'Central', 'Admiralty', 'Tsim Sha Tsui', 'Jordan', 'Yau Ma Tei', 'Mong Kok',
  'Prince Edward', 'Sham Shui Po', 'Cheung Sha Wan', 'Lai Chi Kok', 'Mei Foo',
  'Lai King', 'Kwai Fong', 'Kwai Hing', 'Tai Wo Hau', 'Tsuen Wan',
  // Kwun Tong Line
  'Whampoa', 'Ho Man Tin', 'Yau Ma Tei', 'Mong Kok East', 'Lok Fu', 'Wong Tai Sin',
  'Diamond Hill', 'Choi Hung', 'Kowloon Tong', 'Kwun Tong', 'Ngau Tau Kok',
  'Lam Tin', 'Yau Tong', 'Tiu Keng Leng',
  // Tseung Kwan O Line
  'Tiu Keng Leng', 'Tseung Kwan O', 'Hang Hau', 'Po Lam', 'LOHAS Park',
  // East Rail Line
  'Admiralty', 'Exhibition Centre', 'Hung Hom', 'Mong Kok East', 'Kowloon Tong',
  'Tai Wai', 'Sha Tin', 'Fo Tan', 'Racecourse', 'University', 'Tai Po Market',
  'Tai Wo', 'Fanling', 'Sheung Shui', 'Lo Wu', 'Lok Ma Chau',
  // Tuen Ma Line
  'Wu Kai Sha', 'Ma On Shan', 'Heng On', 'Tai Shui Hang', 'Shek Mun',
  'City One', 'Che Kung Temple', 'Sha Tin Wai', 'Tai Wai', 'Kau To Shan',
  'To Kwa Wan', 'Sung Wong Toi', 'Kai Tak', 'Diamond Hill', 'Kai Ching',
  'Sung On', 'Hung Hom', 'East Tsim Sha Tsui', 'Austin',
  'Nam Cheong', 'Mei Foo', 'Tsuen Wan West', 'Kam Sheung Road', 'Yuen Long',
  'Long Ping', 'Tin Shui Wai', 'Siu Hong', 'Tuen Mun',
  // Tung Chung / Airport lines
  'Olympic', 'Kowloon', 'Tsing Yi', 'Airport', 'AsiaWorld-Expo',
  'Tung Chung', 'Sunny Bay', 'Disneyland Resort',
  // South Island Line
  'Admiralty', 'Ocean Park', 'Wong Chuk Hang', 'Lei Tung', 'South Horizons',
  // Island/other
  'Happy Valley',
]

// Station -> official MTR line colour (per the official system map).
// Interchange stations use their "home" line colour as listed above.
export const MTR_LINE_COLORS: Record<string, string> = {
  // Island Line (teal)
  'Kennedy Town': '#00888A', 'HKU': '#00888A', 'Sai Ying Pun': '#00888A',
  'Sheung Wan': '#00888A', 'Hong Kong': '#00888A', 'Central': '#00888A',
  'Admiralty': '#00888A', 'Wan Chai': '#00888A', 'Causeway Bay': '#00888A',
  'Tin Hau': '#00888A', 'Fortress Hill': '#00888A', 'North Point': '#00888A',
  'Quarry Bay': '#00888A', 'Tai Koo': '#00888A', 'Sai Wan Ho': '#00888A',
  'Shau Kei Wan': '#00888A', 'Heng Fa Chuen': '#00888A', 'Chai Wan': '#00888A',
  'Happy Valley': '#00888A',
  // Tsuen Wan Line (red)
  'Tsim Sha Tsui': '#ED1B24', 'Jordan': '#ED1B24', 'Yau Ma Tei': '#ED1B24',
  'Mong Kok': '#ED1B24', 'Prince Edward': '#ED1B24', 'Sham Shui Po': '#ED1B24',
  'Cheung Sha Wan': '#ED1B24', 'Lai Chi Kok': '#ED1B24', 'Mei Foo': '#ED1B24',
  'Lai King': '#ED1B24', 'Kwai Fong': '#ED1B24', 'Kwai Hing': '#ED1B24',
  'Tai Wo Hau': '#ED1B24', 'Tsuen Wan': '#ED1B24',
  // Kwun Tong Line (green)
  'Whampoa': '#00A040', 'Ho Man Tin': '#00A040', 'Lok Fu': '#00A040',
  'Wong Tai Sin': '#00A040', 'Diamond Hill': '#00A040', 'Choi Hung': '#00A040',
  'Kowloon Tong': '#00A040', 'Kwun Tong': '#00A040', 'Ngau Tau Kok': '#00A040',
  'Lam Tin': '#00A040', 'Yau Tong': '#00A040', 'Tiu Keng Leng': '#00A040',
  // Tseung Kwan O Line (purple)
  'Tseung Kwan O': '#7D499D', 'Hang Hau': '#7D499D', 'Po Lam': '#7D499D',
  'LOHAS Park': '#7D499D',
  // East Rail Line (light blue)
  'Exhibition Centre': '#0075C9', 'Hung Hom': '#0075C9',
  'Mong Kok East': '#0075C9', 'Tai Wai': '#0075C9', 'Sha Tin': '#0075C9',
  'Fo Tan': '#0075C9', 'Racecourse': '#0075C9', 'University': '#0075C9',
  'Tai Po Market': '#0075C9', 'Tai Wo': '#0075C9', 'Fanling': '#0075C9',
  'Sheung Shui': '#0075C9', 'Lo Wu': '#0075C9', 'Lok Ma Chau': '#0075C9',
  // Tuen Ma Line (brown)
  'Wu Kai Sha': '#9C2E2B', 'Ma On Shan': '#9C2E2B', 'Heng On': '#9C2E2B',
  'Tai Shui Hang': '#9C2E2B', 'Shek Mun': '#9C2E2B', 'City One': '#9C2E2B',
  'Che Kung Temple': '#9C2E2B', 'Sha Tin Wai': '#9C2E2B', 'Kau To Shan': '#9C2E2B',
  'To Kwa Wan': '#9C2E2B', 'Sung Wong Toi': '#9C2E2B', 'Kai Tak': '#9C2E2B',
  'Kai Ching': '#9C2E2B', 'Sung On': '#9C2E2B', 'East Tsim Sha Tsui': '#9C2E2B',
  'Austin': '#9C2E2B', 'Nam Cheong': '#9C2E2B', 'Tsuen Wan West': '#9C2E2B',
  'Kam Sheung Road': '#9C2E2B', 'Yuen Long': '#9C2E2B', 'Long Ping': '#9C2E2B',
  'Tin Shui Wai': '#9C2E2B', 'Siu Hong': '#9C2E2B', 'Tuen Mun': '#9C2E2B',
  // Tung Chung Line (orange)
  'Olympic': '#F7943E', 'Kowloon': '#F7943E', 'Tsing Yi': '#F7943E',
  'Tung Chung': '#F7943E', 'Sunny Bay': '#F7943E',
  // Airport Express (teal-green)
  'Airport': '#00888A', 'AsiaWorld-Expo': '#00888A',
  // Disneyland Resort Line (pink)
  'Disneyland Resort': '#F173AC',
  // South Island Line (yellow)
  'Ocean Park': '#CBD300', 'Wong Chuk Hang': '#CBD300',
  'Lei Tung': '#CBD300', 'South Horizons': '#CBD300',
}

export const UNIQUE_MTR_STATIONS: string[] = Array.from(new Set(MTR_STATIONS)).sort((a, b) => a.localeCompare(b))
