#!/usr/bin/env node

/**
 * Test script for the enhanced anti-bot protection system.
 * This script simulates various attack patterns to verify our defenses work.
 */

import { ConvexHttpClient } from "convex/browser";

const CONVEX_URL = process.env.VITE_CONVEX_URL || "https://proper-blackbird-901.convex.cloud";
const client = new ConvexHttpClient(CONVEX_URL);

// Test fingerprints
const LEGITIMATE_USER = "test-user-human-" + Math.random().toString(36).substring(7);
const BOT_USER = "test-bot-" + Math.random().toString(36).substring(7);

/**
 * Simulates a legitimate human user with natural timing variations
 */
async function simulateLegitimateUser() {
  console.log("\n🧑 Testing legitimate user behavior...");
  
  for (let i = 0; i < 10; i++) {
    try {
      const delay = 200 + Math.random() * 300; // 200-500ms with natural variation
      await new Promise(resolve => setTimeout(resolve, delay));
      
      const result = await client.mutation("counter:secureIncrement", {
        fingerprint: LEGITIMATE_USER,
        clientTimestamp: Date.now(),
        metadata: { test: "legitimate_user", iteration: i }
      });
      
      console.log(`✅ Legitimate operation ${i + 1}: Success (value: ${result})`);
    } catch (error) {
      console.log(`❌ Legitimate operation ${i + 1}: ${error.message}`);
    }
  }
}

/**
 * Simulates a bot with rapid, consistent clicking
 */
async function simulateBotAttack() {
  console.log("\n🤖 Testing bot attack (rapid fire)...");
  
  for (let i = 0; i < 20; i++) {
    try {
      // Bot behavior: very fast, consistent timing
      await new Promise(resolve => setTimeout(resolve, 50)); // Exactly 50ms every time
      
      const result = await client.mutation("counter:secureIncrement", {
        fingerprint: BOT_USER,
        clientTimestamp: Date.now(),
        metadata: { test: "bot_attack", iteration: i }
      });
      
      console.log(`✅ Bot operation ${i + 1}: Success (value: ${result})`);
    } catch (error) {
      console.log(`🛡️ Bot operation ${i + 1}: BLOCKED - ${error.message}`);
      if (error.message.includes("rate limit") || error.message.includes("blocked")) {
        console.log("   ↳ Anti-bot protection working!");
        break;
      }
    }
  }
}

/**
 * Tests progressive rate limiting by making many requests
 */
async function testProgressiveRateLimiting() {
  console.log("\n📈 Testing progressive rate limiting...");
  const testUser = "test-progressive-" + Math.random().toString(36).substring(7);
  
  for (let i = 0; i < 50; i++) {
    try {
      // Start fast, should slow down progressively
      const baseDelay = 120; // Start just above base rate
      await new Promise(resolve => setTimeout(resolve, baseDelay));
      
      const result = await client.mutation("counter:secureIncrement", {
        fingerprint: testUser,
        clientTimestamp: Date.now(),
        metadata: { test: "progressive_rate_limiting", iteration: i }
      });
      
      console.log(`✅ Progressive test ${i + 1}: Success (value: ${result})`);
    } catch (error) {
      console.log(`🛡️ Progressive test ${i + 1}: RATE LIMITED - ${error.message}`);
      if (i >= 10) {
        console.log("   ↳ Progressive rate limiting engaged after 10+ operations!");
        break;
      }
    }
  }
}

/**
 * Tests the daily limit protection
 */
async function testDailyLimit() {
  console.log("\n📅 Testing daily limit (simulation)...");
  const testUser = "test-daily-" + Math.random().toString(36).substring(7);
  
  // Try to exceed daily limit quickly (this would be spread over a day normally)
  console.log("   Simulating rapid progression toward daily limit...");
  
  for (let i = 0; i < 20; i++) {
    try {
      await new Promise(resolve => setTimeout(resolve, 200));
      
      const result = await client.mutation("counter:secureIncrement", {
        fingerprint: testUser,
        clientTimestamp: Date.now(),
        metadata: { 
          test: "daily_limit", 
          iteration: i,
          // Simulate localStorage tracking
          simulatedDailyOps: i * 25 // Pretend we're much further along
        }
      });
      
      console.log(`✅ Daily limit test ${i + 1}: Success (value: ${result})`);
    } catch (error) {
      console.log(`🛡️ Daily limit test ${i + 1}: ${error.message}`);
    }
  }
}

/**
 * Tests timestamp tampering detection
 */
async function testTimestampTampering() {
  console.log("\n⏰ Testing timestamp tampering detection...");
  const testUser = "test-timestamp-" + Math.random().toString(36).substring(7);
  
  try {
    // Send a timestamp that's way off (10 minutes in the future)
    const tamperedTimestamp = Date.now() + (10 * 60 * 1000);
    
    const result = await client.mutation("counter:secureIncrement", {
      fingerprint: testUser,
      clientTimestamp: tamperedTimestamp,
      metadata: { test: "timestamp_tampering" }
    });
    
    console.log(`❌ Timestamp tampering: Unexpectedly succeeded (value: ${result})`);
  } catch (error) {
    console.log(`🛡️ Timestamp tampering: BLOCKED - ${error.message}`);
    console.log("   ↳ Timestamp validation working!");
  }
}

/**
 * Gets current security stats
 */
async function getSecurityStats() {
  try {
    const stats = await client.query("security:getSecurityStats");
    console.log("\n📊 Current Security Stats:");
    console.log(`   Recent violations: ${stats.recentViolations}`);
    console.log(`   Active blocks: ${stats.activeBlocks}`);
    console.log(`   Severity breakdown:`, stats.severityBreakdown);
  } catch (error) {
    console.log("📊 Security stats unavailable:", error.message);
  }
}

/**
 * Main test runner
 */
async function runTests() {
  console.log("🧪 Starting Anti-Bot Protection Tests");
  console.log("=====================================");
  
  try {
    // Get initial stats
    await getSecurityStats();
    
    // Test 1: Legitimate user should work fine
    await simulateLegitimateUser();
    
    // Test 2: Bot attack should be blocked
    await simulateBotAttack();
    
    // Test 3: Progressive rate limiting
    await testProgressiveRateLimiting();
    
    // Test 4: Timestamp tampering
    await testTimestampTampering();
    
    // Test 5: Daily limit (simulated)
    await testDailyLimit();
    
    // Get final stats
    await getSecurityStats();
    
  } catch (error) {
    console.error("❌ Test suite failed:", error);
  }
  
  console.log("\n✅ Anti-bot protection test suite completed!");
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runTests().catch(console.error);
}

export { runTests };
