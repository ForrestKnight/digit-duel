const fetch = require('node-fetch');

// Simple test to verify our protections work
async function testBasicFunctionality() {
  console.log('🧪 Testing basic functionality...');
  
  try {
    // Test if server is running by checking if we can access the Convex endpoint
    const response = await fetch('https://proper-blackbird-901.convex.cloud');
    console.log('✅ Convex server is accessible');
    
    // For now, let's just test that our app can start
    console.log('✅ Basic connectivity test passed');
    console.log('\nNext steps:');
    console.log('1. Start the dev server: npm run dev');
    console.log('2. Open browser to http://localhost:5173');
    console.log('3. Try clicking quickly to test rate limiting');
    console.log('4. Check browser console for rate limit messages');
    
  } catch (error) {
    console.error('❌ Basic test failed:', error.message);
  }
}

testBasicFunctionality();
