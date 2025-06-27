#!/usr/bin/env node

// Test what gets cleaned up in Convex dashboard
import { readFileSync } from 'fs';

// Load .env.local manually
try {
  const envContent = readFileSync('.env.local', 'utf8');
  envContent.split('\n').forEach(line => {
    const [key, value] = line.split('=');
    if (key && value) {
      process.env[key] = value;
    }
  });
} catch (e) {
  // .env.local not found, continue
}

async function testDataCleanup() {
  console.log('🔍 Testing Convex data cleanup behavior...\n');

  const convexUrl = process.env.VITE_CONVEX_URL;
  if (!convexUrl) {
    console.error('❌ VITE_CONVEX_URL not found in .env.local');
    process.exit(1);
  }

  console.log('📊 Convex URL:', convexUrl);
  console.log('\n📋 What gets cleaned up automatically:');
  
  console.log('\n1. 🔒 Security Events:');
  console.log('   - Automatically deleted after 24 hours');
  console.log('   - Location: securityEvents table');
  console.log('   - Purpose: Prevent database bloat from security logs');
  
  console.log('\n2. 💾 Rate Limit States:');
  console.log('   - Updated only every 5 operations (bandwidth optimization)');
  console.log('   - Session timeouts after 1 hour of inactivity');
  console.log('   - Location: rateLimitStates table');
  
  console.log('\n3. 🫧 Bubbles:');
  console.log('   - Immediately deleted when popped');
  console.log('   - Location: bubbles table');
  console.log('   - Purpose: Real-time game synchronization');
  
  console.log('\n4. 🚫 Client Blocks:');
  console.log('   - Expire after 5 minutes');
  console.log('   - Location: rateLimitStates.blockExpiresAt field');
  console.log('   - Purpose: Temporary security blocks');

  console.log('\n📱 To test in the dashboard:');
  console.log('1. Open Convex dashboard: https://dashboard.convex.dev');
  console.log('2. Navigate to your project: digit-duel');
  console.log('3. Go to "Data" tab');
  console.log('4. Watch these tables:');
  console.log('   - securityEvents (should clean up old entries)');
  console.log('   - rateLimitStates (updates every 5 operations)');
  console.log('   - bubbles (immediate deletion when popped)');
  
  console.log('\n🧪 To trigger data changes:');
  console.log('1. Run your app: npm run dev');
  console.log('2. Click buttons rapidly to trigger rate limiting');
  console.log('3. Pop bubbles in the game');
  console.log('4. Wait 24 hours to see security event cleanup');
  
  console.log('\n✅ Data that persists:');
  console.log('- counters (permanent until manually reset)');
  console.log('- gameStats (permanent game statistics)');
  
  console.log('\n🔄 Test commands you can run:');
  console.log('npx convex dev          # Start development server');
  console.log('npx convex dashboard    # Open dashboard');
  console.log('npx convex logs         # View function logs');
  console.log('npx convex data export  # Export all data');
}

testDataCleanup().catch(console.error);
