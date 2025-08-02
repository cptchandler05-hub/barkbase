
const https = require('https');

async function testRescueGroupsConnection() {
  console.log('🧪 Testing RescueGroups API connection...');
  
  const apiKey = process.env.RESCUEGROUPS_API_KEY;
  
  if (!apiKey) {
    console.error('❌ RESCUEGROUPS_API_KEY not found in environment');
    return;
  }
  
  console.log('✅ API Key found (length:', apiKey.length, ')');
  
  const postData = JSON.stringify({
    apikey: apiKey,
    objectType: 'animals',
    objectAction: 'publicSearch',
    search: {
      resultStart: 0,
      resultLimit: 5,
      resultSort: 'animalID',
      resultOrder: 'asc',
      filters: [
        {
          fieldName: 'animalSpecies',
          operation: 'equal',
          criteria: 'Dog'
        },
        {
          fieldName: 'animalStatus',
          operation: 'equal', 
          criteria: 'Available'
        }
      ],
      fields: [
        'animalID',
        'animalName',
        'animalBreed',
        'animalSpecies',
        'animalGeneralAge',
        'animalGeneralSizePotential',
        'animalLocationCitystate',
        'animalLocationZip'
      ]
    }
  });

  const options = {
    hostname: 'api.rescuegroups.org',
    port: 443,
    path: '/http/v2.json',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      console.log('📡 Response status:', res.statusCode);
      console.log('📡 Response headers:', res.headers);
      
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          console.log('✅ API Response received');
          console.log('📊 Response keys:', Object.keys(response));
          
          if (response.data && Array.isArray(response.data)) {
            console.log('🐕 Found', response.data.length, 'dogs');
            if (response.data.length > 0) {
              console.log('📋 Sample dog:', {
                id: response.data[0].animalID,
                name: response.data[0].animalName,
                breed: response.data[0].animalBreed
              });
            }
          } else if (response.messages) {
            console.log('📨 API Messages:', response.messages);
          }
          
          resolve(response);
        } catch (error) {
          console.error('❌ JSON Parse Error:', error.message);
          console.log('📝 Raw response:', data.substring(0, 500));
          reject(error);
        }
      });
    });

    req.on('error', (error) => {
      console.error('❌ Request Error:', error.message);
      reject(error);
    });

    req.write(postData);
    req.end();
  });
}

testRescueGroupsConnection()
  .then(() => {
    console.log('🎉 Test completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Test failed:', error.message);
    process.exit(1);
  });
