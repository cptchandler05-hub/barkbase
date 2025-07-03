export function getRandomRuralZip(): string {
  const ruralZips = [
    // 🐕 Texas
    "77833", // Brenham, TX
    "79065", // Pampa, TX
    "76801", // Brownwood, TX
    "76401", // Stephenville, TX
    "76520", // Cameron, TX

    // 🐕 Arkansas
    "72801", // Russellville, AR
    "72501", // Batesville, AR
    "71923", // Camden, AR
    "71601", // Pine Bluff, AR
    "72032", // Conway, AR

    // 🐕 Alabama
    "35640", // Hartselle, AL
    "36904", // Butler, AL
    "36784", // Uniontown, AL
    "36027", // Eufaula, AL
    "36420", // Andalusia, AL

    // 🐕 Mississippi
    "39483", // Tylertown, MS
    "39046", // Canton, MS
    "39701", // Columbus, MS
    "38701", // Greenville, MS
    "38930", // Greenwood, MS
    "39350", // Philadelphia, MS

    // 🐕 Georgia
    "31750", // Fitzgerald, GA
    "39840", // Georgetown, GA
    "31036", // Hawkinsville, GA
    "30540", // Ellijay, GA
    "30830", // Waynesboro, GA

    // 🐕 Other rural zones
    "24501", // Lynchburg, VA
    "59715", // Bozeman, MT
    "97420", // Coos Bay, OR
    "57601", // Mobridge, SD
    "58201", // Grand Forks, ND
    "65775", // West Plains, MO
    "47424", // Linton, IN
    "38583", // Sparta, TN
  ];

  const index = Math.floor(Math.random() * ruralZips.length);
  return ruralZips[index];
}
