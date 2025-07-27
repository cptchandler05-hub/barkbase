// ZIP code to state mapping for broader geographic search
const ZIP_TO_STATE_MAP: { [key: string]: string } = {
  // Massachusetts ZIP codes
  '01': 'MA', '02': 'MA',
  // New York ZIP codes  
  '10': 'NY', '11': 'NY', '12': 'NY', '13': 'NY', '14': 'NY',
  // California ZIP codes
  '90': 'CA', '91': 'CA', '92': 'CA', '93': 'CA', '94': 'CA', '95': 'CA', '96': 'CA',
  // Texas ZIP codes
  '75': 'TX', '76': 'TX', '77': 'TX', '78': 'TX', '79': 'TX',
  // Florida ZIP codes
  '32': 'FL', '33': 'FL', '34': 'FL',
  // Illinois ZIP codes
  '60': 'IL', '61': 'IL', '62': 'IL',
  // Pennsylvania ZIP codes
  '15': 'PA', '16': 'PA', '17': 'PA', '18': 'PA', '19': 'PA',
  // Ohio ZIP codes
  '43': 'OH', '44': 'OH', '45': 'OH',
  // Michigan ZIP codes
  '48': 'MI', '49': 'MI',
  // Georgia ZIP codes
  '30': 'GA', '31': 'GA',
  // North Carolina ZIP codes
  '27': 'NC', '28': 'NC',
  // New Jersey ZIP codes
  '07': 'NJ', '08': 'NJ',
  // Virginia ZIP codes
  '22': 'VA', '23': 'VA', '24': 'VA',
  // Washington ZIP codes
  '98': 'WA', '99': 'WA',
  // Colorado ZIP codes
  '80': 'CO', '81': 'CO',
  // Arizona ZIP codes
  '85': 'AZ', '86': 'AZ',
  // Maryland ZIP codes
  '20': 'MD', '21': 'MD',
  // Wisconsin ZIP codes
  '53': 'WI', '54': 'WI',
  // Minnesota ZIP codes
  '55': 'MN', '56': 'MN',
  // Tennessee ZIP codes
  '37': 'TN', '38': 'TN',
  // Missouri ZIP codes
  '63': 'MO', '64': 'MO', '65': 'MO',
  // Alabama ZIP codes
  '35': 'AL', '36': 'AL',
  // Louisiana ZIP codes
  '70': 'LA', '71': 'LA',
  // Kentucky ZIP codes
  '40': 'KY', '41': 'KY', '42': 'KY',
  // Oregon ZIP codes
  '97': 'OR',
  // Oklahoma ZIP codes
  '73': 'OK', '74': 'OK',
  // Connecticut ZIP codes
  '06': 'CT',
  // Iowa ZIP codes
  '50': 'IA', '51': 'IA', '52': 'IA',
  // Mississippi ZIP codes
  '38': 'MS', '39': 'MS',
  // Arkansas ZIP codes
  '71': 'AR', '72': 'AR',
  // Kansas ZIP codes
  '66': 'KS', '67': 'KS',
  // Utah ZIP codes
  '84': 'UT',
  // Nevada ZIP codes
  '89': 'NV',
  // New Mexico ZIP codes
  '87': 'NM', '88': 'NM',
  // West Virginia ZIP codes
  '24': 'WV', '25': 'WV', '26': 'WV',
  // Nebraska ZIP codes
  '68': 'NE', '69': 'NE',
  // Idaho ZIP codes
  '83': 'ID',
  // Hawaii ZIP codes
  '96': 'HI',
  // Maine ZIP codes
  '03': 'ME', '04': 'ME',
  // New Hampshire ZIP codes
  '03': 'NH',
  // Vermont ZIP codes
  '05': 'VT',
  // Delaware ZIP codes
  '19': 'DE',
  // Rhode Island ZIP codes
  '02': 'RI',
  // Montana ZIP codes
  '59': 'MT',
  // North Dakota ZIP codes
  '58': 'ND',
  // South Dakota ZIP codes
  '57': 'SD',
  // Alaska ZIP codes
  '99': 'AK',
  // Wyoming ZIP codes
  '82': 'WY',
  // South Carolina ZIP codes
  '29': 'SC',
  // Indiana ZIP codes
  '46': 'IN', '47': 'IN'
};

export function getStateFromZip(zipCode: string): string | null {
  if (!zipCode || zipCode.length !== 5 || !/^\d{5}$/.test(zipCode)) {
    return null;
  }
  
  const prefix = zipCode.substring(0, 2);
  return ZIP_TO_STATE_MAP[prefix] || null;
}

export function getRandomRuralZip(): string {
  const ruralZips = [
    // 🐕 Texas - Expanded coverage
    "77833", "79065", "76801", "76401", "76520", "78934", "77954", "76462", "79316", "78932",
    
    // 🐕 Arkansas - More rural areas
    "72801", "72501", "71923", "71601", "72032", "72653", "71740", "72450", "72932", "71635",
    
    // 🐕 Alabama - Deep rural coverage
    "35640", "36904", "36784", "36027", "36420", "35960", "35457", "36532", "35016", "36730",
    
    // 🐕 Mississippi - Delta and hill country
    "39483", "39046", "39701", "38701", "38930", "39350", "39452", "39744", "39071", "38940",
    
    // 🐕 Georgia - Rural farming communities
    "31750", "39840", "31036", "30540", "30830", "31028", "31792", "30436", "31635", "31331",
    
    // 🐕 Louisiana - Bayou and rural parishes
    "71235", "71270", "70748", "71463", "70529", "71343", "70755", "71439", "70763", "71446",
    
    // 🐕 Oklahoma - Plains and rural towns
    "74825", "74743", "73662", "74937", "73844", "74756", "74631", "73960", "74720", "73758",
    
    // 🐕 Kentucky - Appalachian and rural areas
    "42748", "41049", "42141", "41858", "42633", "41464", "42445", "41751", "40823", "42501",
    
    // 🐕 Tennessee - Mountain and rural counties
    "38583", "37688", "38226", "37387", "38057", "37397", "38251", "37381", "38019", "37890",
    
    // 🐕 North Carolina - Rural mountains and eastern plains
    "27529", "27205", "28139", "27215", "28327", "27258", "28430", "27371", "28518", "27217",
    
    // 🐕 South Carolina - Rural farming areas
    "29554", "29170", "29031", "29633", "29341", "29936", "29543", "29541", "29070", "29829",
    
    // 🐕 Florida - Rural inland areas
    "34974", "33440", "34972", "33471", "34445", "34266", "34481", "34972", "34266", "33935",
    
    // 🐕 West Virginia - Mountain communities
    "25403", "26062", "25560", "24731", "26623", "25932", "26802", "25143", "26651", "25972",
    
    // 🐕 Virginia - Rural valleys and counties
    "24501", "23927", "24579", "23093", "24265", "23306", "24370", "23395", "24437", "23138",
    
    // 🐕 Montana - Wide open spaces
    "59715", "59718", "59870", "59322", "59353", "59440", "59252", "59718", "59935", "59270",
    
    // 🐕 Wyoming - Rural ranching areas
    "82414", "82633", "82063", "82240", "82731", "82430", "82325", "82729", "82513", "82215",
    
    // 🐕 Idaho - Rural farming communities
    "83025", "83318", "83530", "83647", "83672", "83449", "83537", "83610", "83468", "83274",
    
    // 🐕 Utah - Rural counties
    "84515", "84540", "84626", "84775", "84728", "84513", "84533", "84624", "84758", "84511",
    
    // 🐕 Nevada - Rural desert towns
    "89049", "89408", "89316", "89419", "89045", "89021", "89008", "89317", "89048", "89301",
    
    // 🐕 Oregon - Rural coast and inland
    "97420", "97759", "97350", "97626", "97720", "97450", "97541", "97721", "97630", "97752",
    
    // 🐕 Washington - Rural eastern areas
    "98943", "99161", "99301", "98832", "99147", "99039", "98946", "99114", "98922", "99150",
    
    // 🐕 North Dakota - Rural plains
    "58201", "58472", "58718", "58529", "58830", "58474", "58545", "58831", "58759", "58476",
    
    // 🐕 South Dakota - Rural farming areas
    "57601", "57626", "57442", "57770", "57649", "57469", "57758", "57632", "57473", "57779",
    
    // 🐕 Nebraska - Rural farming communities
    "68930", "68738", "68847", "68642", "69201", "68739", "68852", "68648", "69211", "68741",
    
    // 🐕 Kansas - Rural plains
    "67901", "67736", "67950", "67843", "66952", "67741", "67953", "67846", "66956", "67744",
    
    // 🐕 Iowa - Rural farming areas
    "50424", "52169", "50536", "52213", "50665", "52175", "50541", "52218", "50669", "52179",
    
    // 🐕 Missouri - Rural Ozarks and plains
    "65775", "63558", "64468", "63565", "64474", "63570", "64475", "63567", "64476", "63572",
    
    // 🐕 Illinois - Rural downstate
    "62471", "61729", "62864", "61734", "62869", "61738", "62865", "61739", "62871", "61741",
    
    // 🐕 Indiana - Rural farming areas
    "47424", "47635", "47747", "47639", "47750", "47640", "47751", "47642", "47753", "47644",
    
    // 🐕 Ohio - Rural counties
    "45612", "43723", "45616", "43728", "45618", "43730", "45619", "43732", "45620", "43734",
    
    // 🐕 Michigan - Rural northern areas
    "49729", "49837", "49745", "49840", "49749", "49841", "49751", "49845", "49753", "49847",
    
    // 🐕 Wisconsin - Rural farming areas
    "54729", "54837", "54745", "54840", "54749", "54841", "54751", "54845", "54753", "54847",
    
    // 🐕 Minnesota - Rural northern areas
    "56729", "56837", "56745", "56840", "56749", "56841", "56751", "56845", "56753", "56847",
    
    // 🐕 New Mexico - Rural desert areas
    "87901", "88264", "87930", "88267", "87932", "88268", "87933", "88270", "87935", "88272",
    
    // 🐕 Arizona - Rural desert communities
    "85643", "86025", "85648", "86028", "85650", "86030", "85652", "86032", "85654", "86034",
    
    // 🐕 Colorado - Rural mountain areas
    "81230", "80424", "81235", "80427", "81237", "80428", "81239", "80430", "81240", "80432",
    
    // 🐕 California - Rural inland areas
    "95220", "96107", "95225", "96109", "95227", "96110", "95230", "96112", "95232", "96114",
    
    // 🐕 Alaska - Remote communities
    "99603", "99729", "99605", "99730", "99607", "99731", "99609", "99733", "99611", "99734",
    
    // 🐕 Hawaii - Rural areas
    "96729", "96837", "96731", "96840", "96733", "96841", "96734", "96845", "96736", "96847"
  ];

  const index = Math.floor(Math.random() * ruralZips.length);
  return ruralZips[index];
}
