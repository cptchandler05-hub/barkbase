
require('dotenv').config({ path: './.env.local' });

async function testFieldNames() {
  console.log('🔍 TESTING RESCUEGROUPS FIELD NAMES');
  
  const baseUrl = 'https://api.rescuegroups.org/v5/public/animals/search/available/dogs';
  
  // Test 1: No field specification (should return default fields)
  console.log('\n1️⃣ Testing without field specification:');
  await testFields(baseUrl + '?limit=1');
  
  // Test 2: Test some common field patterns
  const fieldTests = [
    'id,name,age,size,breed',
    'id,name,ageGroup,sizeGroup,breedPrimary',
    'id,name,generalAge,sizes,breedPrimary',
    'id,name,animalAge,animalSize,animalBreed'
  ];
  
  for (let i = 0; i < fieldTests.length; i++) {
    console.log(`\n${i + 2}️⃣ Testing fields: ${fieldTests[i]}`);
    const url = `${baseUrl}?limit=1&fields[animals]=${fieldTests[i]}`;
    await testFields(url);
  }
}

async function testFields(url) {
  try {
    const response = await fetch(url, {
      headers: {
        'Authorization': process.env.RESCUEGROUPS_API_KEY,
        'Content-Type': 'application/json'
      }
    });
    
    if (response.ok) {
      const result = await response.json();
      const animal = result.data?.[0];
      if (animal?.attributes) {
        console.log(`   ✅ Fields returned: ${Object.keys(animal.attributes).join(', ')}`);
        console.log(`   📋 Sample values:`, JSON.stringify(animal.attributes, null, 2).slice(0, 200));
      } else {
        console.log(`   ❌ No animal data returned`);
      }
    } else {
      console.log(`   ❌ Error ${response.status}: ${await response.text()}`);
    }
  } catch (error) {
    console.log(`   ❌ Request failed: ${error.message}`);
  }
}

testFieldNames().catch(console.error);
