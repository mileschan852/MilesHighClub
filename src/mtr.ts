// Hong Kong MTR station list, ordered by line then position.
// Used for the "Closest MTR" dropdown in the booking form and profile.
export const MTR_STATIONS: string[] = [
  // Island Line
  'Kennedy Town', 'HKU', 'Sai Ying Pun', 'Sheung Wan', 'Hong Kong', 'Central',
  'Admiralty', 'Wan Chai', 'Causeway Bay', 'Tin Hau', 'Fortress Hill',
  'North Point', 'Quarry Bay', 'Taikoo', 'Shau Kei Wan', 'Heng Fa Chuen', 'Chai Wan',
  // Tsuen Wan Line
  'Central', 'Admiralty', 'Tsim Sha Tsui', 'Jordan', 'Yau Ma Tei', 'Mong Kok',
  'Prince Edward', 'Sham Shui Po', 'Cheung Sha Wan', 'Lai Chi Kok', 'Mei Foo',
  'Lai King', 'Kwai Fong', 'Kwai Hing', 'Tai Wo Hau', 'Tsuen Wan',
  // Kwun Tong Line
  'Whampoa', 'Ho Man Tin', 'Yau Ma Tei', 'Mong Kok East', 'Lok Fu', 'Wong Tai Sin',
  'Diamond Hill', 'Choi Hung', 'Kowloon Tong', 'Kwun Tong', 'Ngau Tau Kok',
  'Kwun Tong', 'Lam Tin', 'Yau Tong', 'Tiu Keng Leng',
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
  'Sung On', 'To Kwa Wan', 'Hung Hom', 'East Tsim Sha Tsui', 'Austin',
  'Nam Cheong', 'Mei Foo', 'Tsuen Wan West', 'Kam Sheung Road', 'Yuen Long',
  'Long Ping', 'Tin Shui Wai', 'Siu Hong', 'Tuen Mun',
  // Island/other
  'Olympic', 'Kowloon', 'Tsing Yi', 'Airport', 'AsiaWorld-Expo',
  'Tung Chung', 'Sunny Bay', 'Disneyland Resort',
  // South Island Line
  'Admiralty', 'Ocean Park', 'Wong Chuk Hang', 'Lei Tung', 'South Horizons',
  // Light-rail-adjacent / others commonly asked
  'Happy Valley',
]

export const UNIQUE_MTR_STATIONS: string[] = Array.from(new Set(MTR_STATIONS)).sort((a, b) => a.localeCompare(b))
