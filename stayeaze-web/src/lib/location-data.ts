/**
 * Comprehensive Indian States, Cities & Pincode Validation Dataset
 */

export interface StateData {
  name: string;
  code: string;
  pincodePrefixes: string[]; // First 2 digits of pincodes matching this state
  cities: string[];
}

export const INDIAN_STATES_DATA: StateData[] = [
  {
    name: 'Andhra Pradesh',
    code: 'AP',
    pincodePrefixes: ['51', '52', '53'],
    cities: ['Visakhapatnam', 'Vijayawada', 'Guntur', 'Nellore', 'Kurnool', 'Rajahmundry', 'Tirupati', 'Kakinada', 'Kadapa', 'Anantapur', 'Eluru', 'Vizianagaram']
  },
  {
    name: 'Assam',
    code: 'AS',
    pincodePrefixes: ['78'],
    cities: ['Guwahati', 'Silchar', 'Dibrugarh', 'Jorhat', 'Nagaon', 'Tinsukia', 'Tezpur', 'Bongaigaon']
  },
  {
    name: 'Bihar',
    code: 'BR',
    pincodePrefixes: ['80', '81', '82', '83', '84', '85'],
    cities: ['Patna', 'Gaya', 'Bhagalpur', 'Muzaffarpur', 'Purnia', 'Darbhanga', 'Bihar Sharif', 'Arrah', 'Begusarai', 'Katihar']
  },
  {
    name: 'Chandigarh',
    code: 'CH',
    pincodePrefixes: ['16'],
    cities: ['Chandigarh']
  },
  {
    name: 'Delhi',
    code: 'DL',
    pincodePrefixes: ['11'],
    cities: ['New Delhi', 'North Delhi', 'South Delhi', 'East Delhi', 'West Delhi', 'Central Delhi', 'Dwarka', 'Rohini', 'Connaught Place']
  },
  {
    name: 'Goa',
    code: 'GA',
    pincodePrefixes: ['40'],
    cities: ['Panaji', 'Margao', 'Vasco da Gama', 'Mapusa', 'Ponda']
  },
  {
    name: 'Gujarat',
    code: 'GJ',
    pincodePrefixes: ['36', '37', '38', '39'],
    cities: ['Ahmedabad', 'Surat', 'Vadodara', 'Rajkot', 'Bhavnagar', 'Jamnagar', 'Junagadh', 'Gandhinagar', 'Anand', 'Navsari', 'Morbi', 'Nadiad']
  },
  {
    name: 'Haryana',
    code: 'HR',
    pincodePrefixes: ['12', '13'],
    cities: ['Gurugram', 'Faridabad', 'Panipat', 'Ambala', 'Yamunanagar', 'Rohtak', 'Hisar', 'Karnal', 'Sonipat', 'Panchkula']
  },
  {
    name: 'Himachal Pradesh',
    code: 'HP',
    pincodePrefixes: ['17'],
    cities: ['Shimla', 'Dharamshala', 'Mandi', 'Solan', 'Kullu', 'Manali', 'Hamirpur', 'Una']
  },
  {
    name: 'Jammu and Kashmir',
    code: 'JK',
    pincodePrefixes: ['18', '19'],
    cities: ['Srinagar', 'Jammu', 'Anantnag', 'Baramulla', 'Udhampur']
  },
  {
    name: 'Jharkhand',
    code: 'JH',
    pincodePrefixes: ['81', '82', '83'],
    cities: ['Ranchi', 'Jamshedpur', 'Dhanbad', 'Bokaro', 'Hazaribagh', 'Deoghar']
  },
  {
    name: 'Karnataka',
    code: 'KA',
    pincodePrefixes: ['56', '57', '58', '59'],
    cities: ['Bengaluru', 'Mysuru', 'Hubballi', 'Mangaluru', 'Belagavi', 'Davanagere', 'Ballari', 'Kalaburagi', 'Tumakuru', 'Shivamogga', 'Udupi', 'Bidar']
  },
  {
    name: 'Kerala',
    code: 'KL',
    pincodePrefixes: ['67', '68', '69'],
    cities: ['Thiruvananthapuram', 'Kochi', 'Kozhikode', 'Thrissur', 'Kollam', 'Palakkad', 'Alappuzha', 'Kannur', 'Kottayam', 'Malappuram']
  },
  {
    name: 'Madhya Pradesh',
    code: 'MP',
    pincodePrefixes: ['45', '46', '47', '48'],
    cities: ['Bhopal', 'Indore', 'Jabalpur', 'Gwalior', 'Ujjain', 'Sagar', 'Dewas', 'Satna', 'Ratlam', 'Rewa']
  },
  {
    name: 'Maharashtra',
    code: 'MH',
    pincodePrefixes: ['40', '41', '42', '43', '44'],
    cities: ['Mumbai', 'Pune', 'Nagpur', 'Thane', 'Nashik', 'Aurangabad', 'Solapur', 'Kolhapur', 'Navi Mumbai', 'Amravati', 'Nanded', 'Sangli', 'Jalgaon']
  },
  {
    name: 'Odisha',
    code: 'OR',
    pincodePrefixes: ['75', '76', '77'],
    cities: ['Bhubaneswar', 'Cuttack', 'Rourkela', 'Berhampur', 'Sambalpur', 'Puri', 'Balasore']
  },
  {
    name: 'Punjab',
    code: 'PB',
    pincodePrefixes: ['14', '15'],
    cities: ['Ludhiana', 'Amritsar', 'Jalandhar', 'Patiala', 'Bathinda', 'Mohali', 'Pathankot', 'Hoshiarpur']
  },
  {
    name: 'Puducherry',
    code: 'PY',
    pincodePrefixes: ['60'],
    cities: ['Puducherry', 'Karaikal', 'Mahe', 'Yanam']
  },
  {
    name: 'Rajasthan',
    code: 'RJ',
    pincodePrefixes: ['30', '31', '32', '33', '34'],
    cities: ['Jaipur', 'Jodhpur', 'Kota', 'Bikaner', 'Ajmer', 'Udaipur', 'Bhilwara', 'Alwar', 'Sikar', 'Sri Ganganagar']
  },
  {
    name: 'Tamil Nadu',
    code: 'TN',
    pincodePrefixes: ['60', '61', '62', '63', '64'],
    cities: ['Chennai', 'Coimbatore', 'Madurai', 'Tiruchirappalli', 'Salem', 'Tiruppur', 'Erode', 'Vellore', 'Tirunelveli', 'Thanjavur', 'Kanchipuram']
  },
  {
    name: 'Telangana',
    code: 'TG',
    pincodePrefixes: ['50'],
    cities: ['Hyderabad', 'Warangal', 'Nizamabad', 'Karimnagar', 'Khammam', 'Ramagundam', 'Mahbubnagar', 'Nalgonda']
  },
  {
    name: 'Uttar Pradesh',
    code: 'UP',
    pincodePrefixes: ['20', '21', '22', '23', '24', '25', '26', '27', '28'],
    cities: ['Lucknow', 'Kanpur', 'Ghaziabad', 'Agra', 'Varanasi', 'Meerut', 'Prayagraj', 'Noida', 'Bareilly', 'Aligarh', 'Gorakhpur', 'Mathura', 'Saharanpur']
  },
  {
    name: 'Uttarakhand',
    code: 'UK',
    pincodePrefixes: ['24', '26'],
    cities: ['Dehradun', 'Haridwar', 'Roorkee', 'Haldwani', 'Rishikesh', 'Nainital', 'Kashipur']
  },
  {
    name: 'West Bengal',
    code: 'WB',
    pincodePrefixes: ['70', '71', '72', '73', '74'],
    cities: ['Kolkata', 'Howrah', 'Durgapur', 'Asansol', 'Siliguri', 'Bardhaman', 'Malda', 'Kharagpur', 'Haldia', 'Baharampur']
  }
];

/**
 * Returns all available Indian States
 */
export function getStatesList(): string[] {
  return INDIAN_STATES_DATA.map((s) => s.name).sort();
}

/**
 * Returns cities for a given selected state
 */
export function getCitiesForState(stateName: string): string[] {
  if (!stateName) return [];
  const stateObj = INDIAN_STATES_DATA.find(
    (s) => s.name.toLowerCase() === stateName.trim().toLowerCase() || s.code.toLowerCase() === stateName.trim().toLowerCase()
  );
  return stateObj ? stateObj.cities.sort() : [];
}

/**
 * Validates a 6-digit Indian Pincode and verifies if it matches the selected state.
 */
export function validatePincodeForState(
  pincode: string,
  stateName?: string
): { isValid: boolean; message: string; matchedState?: string } {
  if (!pincode || !pincode.trim()) {
    return { isValid: false, message: 'Pincode is required' };
  }

  const cleanPin = pincode.trim();
  if (!/^[1-9][0-9]{5}$/.test(cleanPin)) {
    return { isValid: false, message: 'Invalid Pincode format (Must be 6 digits and cannot start with 0)' };
  }

  const prefix = cleanPin.substring(0, 2);

  // Find which state this pincode prefix belongs to
  const matchingState = INDIAN_STATES_DATA.find((s) => s.pincodePrefixes.includes(prefix));

  if (!stateName || !stateName.trim()) {
    if (matchingState) {
      return { isValid: true, message: `✅ Valid Pincode (Belongs to ${matchingState.name})`, matchedState: matchingState.name };
    }
    return { isValid: true, message: '✅ Valid 6-digit Pincode format' };
  }

  // Check if selected state matches pincode prefix
  const selectedStateObj = INDIAN_STATES_DATA.find(
    (s) => s.name.toLowerCase() === stateName.trim().toLowerCase() || s.code.toLowerCase() === stateName.trim().toLowerCase()
  );

  if (selectedStateObj && !selectedStateObj.pincodePrefixes.includes(prefix)) {
    const belongsTo = matchingState ? matchingState.name : 'a different region';
    return {
      isValid: false,
      message: `❌ Pincode ${cleanPin} belongs to ${belongsTo}, but "${stateName}" is selected`,
      matchedState: matchingState?.name,
    };
  }

  return { isValid: true, message: `✅ Valid Pincode for ${stateName}`, matchedState: selectedStateObj?.name };
}
