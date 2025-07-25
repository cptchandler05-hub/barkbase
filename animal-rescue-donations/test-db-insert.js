
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testInsert() {
  console.log('🧪 Testing basic database insertion...');
  
  // Simple test record with minimal required fields
  const testRecord = {
    api_source: 'test',
    organization_id: 'TEST123',
    url: 'https://test.com',
    name: 'Test Dog',
    type: 'Dog',
    species: 'Dog',
    primary_breed: 'Test Breed',
    age: 'Adult',
    gender: 'Male',
    size: 'Medium',
    status: 'adoptable',
    city: 'Test City',
    state: 'Test State',
    visibility_score: 50,
    last_updated_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    petfinder_id: 'test-' + Date.now()
  };

  console.log('📝 Test record:', JSON.stringify(testRecord, null, 2));
  console.log('📊 Has id field:', 'id' in testRecord);

  try {
    const { data, error } = await supabase
      .from('dogs')
      .insert([testRecord])
      .select();

    if (error) {
      console.error('❌ Insert failed:', error);
    } else {
      console.log('✅ Insert successful!');
      console.log('📦 Returned data:', data);
      
      // Clean up - delete the test record
      if (data && data[0] && data[0].id) {
        await supabase
          .from('dogs')
          .delete()
          .eq('id', data[0].id);
        console.log('🧹 Cleaned up test record');
      }
    }
  } catch (err) {
    console.error('❌ Test failed:', err);
  }
}

testInsert();
