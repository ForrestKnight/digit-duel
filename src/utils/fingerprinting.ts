/**
 * Client fingerprinting utility for security tracking and user identification.
 * 
 * This module generates a stable fingerprint based on various browser and device
 * characteristics without relying on cookies or localStorage. The fingerprint
 * is used for rate limiting and security monitoring.
 * 
 * @remarks
 * The fingerprinting is privacy-conscious and doesn't collect personally
 * identifiable information. It's used purely for security purposes.
 */

/**
 * Generates a stable client fingerprint based on browser characteristics.
 * 
 * @returns A stable fingerprint string for the current client
 */
export function generateClientFingerprint(): string {
  const characteristics: string[] = [];

  // Screen characteristics
  characteristics.push(`screen:${screen.width}x${screen.height}x${screen.colorDepth}`);
  
  // Timezone
  characteristics.push(`tz:${Intl.DateTimeFormat().resolvedOptions().timeZone}`);
  
  // Language
  characteristics.push(`lang:${navigator.language}`);
  
  // Platform
  characteristics.push(`platform:${navigator.platform}`);
  
  // User agent (hashed for privacy)
  characteristics.push(`ua:${hashString(navigator.userAgent)}`);
  
  // Hardware concurrency
  characteristics.push(`cores:${navigator.hardwareConcurrency || 'unknown'}`);
  
  // Memory (if available)
  const memory = (navigator as any).deviceMemory;
  if (memory) {
    characteristics.push(`mem:${memory}`);
  }
  
  // Touch support
  characteristics.push(`touch:${('ontouchstart' in window)}`);
  
  // Canvas fingerprint (basic)
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.textBaseline = 'top';
      ctx.font = '14px Arial';
      ctx.fillText('Digit Duel Security Check', 2, 2);
      characteristics.push(`canvas:${hashString(canvas.toDataURL())}`);
    }
  } catch (e) {
    // Canvas fingerprinting blocked or failed
    characteristics.push('canvas:blocked');
  }
  
  // WebGL fingerprint (basic)
  try {
    const gl = document.createElement('canvas').getContext('webgl');
    if (gl) {
      const renderer = gl.getParameter(gl.RENDERER);
      const vendor = gl.getParameter(gl.VENDOR);
      characteristics.push(`webgl:${hashString(renderer + vendor)}`);
    }
  } catch (e) {
    characteristics.push('webgl:blocked');
  }

  // Combine all characteristics and hash
  const fingerprint = hashString(characteristics.join('|'));
  
  return fingerprint.substring(0, 32); // Truncate for consistency
}

/**
 * Simple hash function for generating consistent identifiers.
 * 
 * @param str - String to hash
 * @returns Hash of the input string
 */
function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * Validates that a fingerprint looks legitimate.
 * 
 * @param fingerprint - Fingerprint to validate
 * @returns Whether the fingerprint appears valid
 */
export function validateFingerprint(fingerprint: string): boolean {
  if (!fingerprint || typeof fingerprint !== 'string') {
    return false;
  }
  
  // Check length and format
  if (fingerprint.length < 8 || fingerprint.length > 64) {
    return false;
  }
  
  // Check for valid characters (alphanumeric)
  if (!/^[a-z0-9]+$/i.test(fingerprint)) {
    return false;
  }
  
  // Check for obviously fake patterns
  if (/^(.{1,3})\1+$/.test(fingerprint)) { // Repeating patterns
    return false;
  }
  
  return true;
}

/**
 * Gets or generates a fingerprint with local caching for consistency.
 * The fingerprint is regenerated on each session for privacy.
 * 
 * @returns Current session fingerprint
 */
let cachedFingerprint: string | null = null;

export function getSessionFingerprint(): string {
  if (cachedFingerprint && validateFingerprint(cachedFingerprint)) {
    return cachedFingerprint;
  }
  
  cachedFingerprint = generateClientFingerprint();
  return cachedFingerprint;
}

/**
 * Detects if the client environment appears to be automated (bot detection).
 * 
 * @returns Object with bot detection results
 */
export function detectAutomatedEnvironment(): {
  isLikelyBot: boolean;
  confidence: number;
  indicators: string[];
} {
  const indicators: string[] = [];
  let suspicionScore = 0;
  
  // Check for headless browser indicators
  if (navigator.webdriver) {
    indicators.push('webdriver_present');
    suspicionScore += 50;
  }
  
  // Check for common automation frameworks
  const automationProps = [
    'webdriver', 'callPhantom', '_phantom', '__phantom',
    '__selenium_unwrapped', '__selenium_evaluate', '__webdriver_evaluate',
    '__driver_evaluate', '__webdriver_script_function', '__webdriver_script_func',
    'spawn', 'emit', 'ping'
  ];
  
  for (const prop of automationProps) {
    if (prop in window) {
      indicators.push(`automation_${prop}`);
      suspicionScore += 20;
    }
  }
  
  // Check for missing expected properties
  if (!(window as any).chrome && navigator.userAgent.includes('Chrome')) {
    indicators.push('missing_chrome_object');
    suspicionScore += 15;
  }
  
  // Check for unusual screen dimensions
  if (screen.width === 0 || screen.height === 0) {
    indicators.push('invalid_screen_dimensions');
    suspicionScore += 30;
  }
  
  // Check for missing touch events on mobile
  const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  if (isMobile && !('ontouchstart' in window)) {
    indicators.push('mobile_without_touch');
    suspicionScore += 25;
  }
  
  // Check for consistent timing
  const start = performance.now();
  for (let i = 0; i < 100; i++) {
    Math.random();
  }
  const executionTime = performance.now() - start;
  
  if (executionTime < 0.1) { // Suspiciously fast
    indicators.push('suspiciously_fast_execution');
    suspicionScore += 20;
  }
  
  const confidence = Math.min(suspicionScore / 100, 1);
  const isLikelyBot = confidence > 0.5;
  
  return {
    isLikelyBot,
    confidence,
    indicators,
  };
}

/**
 * Generates metadata about the client environment for security analysis.
 * 
 * @returns Object with client environment metadata
 */
export function getClientMetadata(): Record<string, unknown> {
  const botDetection = detectAutomatedEnvironment();
  
  return {
    fingerprint: getSessionFingerprint(),
    userAgent: navigator.userAgent,
    language: navigator.language,
    platform: navigator.platform,
    screenResolution: `${screen.width}x${screen.height}`,
    colorDepth: screen.colorDepth,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    hardwareConcurrency: navigator.hardwareConcurrency,
    deviceMemory: (navigator as any).deviceMemory,
    connectionType: (navigator as any).connection?.effectiveType,
    touchSupport: 'ontouchstart' in window,
    cookieEnabled: navigator.cookieEnabled,
    doNotTrack: navigator.doNotTrack,
    botDetection,
    timestamp: Date.now(),
  };
}

