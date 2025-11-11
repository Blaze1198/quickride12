// Simple test to verify React Hooks error is resolved
// This will check if the navigation component can be loaded without hooks violations

const fs = require('fs');
const path = require('path');

console.log('🔍 TESTING REACT HOOKS FIX IN RIDER NAVIGATION COMPONENT');
console.log('='.repeat(60));

// Read the navigation.tsx file
const navigationPath = '/app/frontend/app/(rider)/navigation.tsx';
const content = fs.readFileSync(navigationPath, 'utf8');

// Count hooks and analyze structure
const lines = content.split('\n');
let hookCount = 0;
let hooksBeforeEarlyReturns = 0;
let earlyReturnLines = [];
let hookLines = [];

// Hook patterns to detect
const hookPatterns = [
  /useState\s*\(/,
  /useEffect\s*\(/,
  /useRef\s*\(/,
  /useMemo\s*\(/,
  /useCallback\s*\(/,
  /useAuthStore\s*\(/,
  /useSafeAreaInsets\s*\(/,
  /useRouter\s*\(/
];

// Component-level early return patterns (not inside functions or useEffect)
const earlyReturnPatterns = [
  /^\s*if\s*\([^)]*\)\s*{\s*return\s*\(/,
  /^\s*if\s*\([^)]*\)\s*return\s*\(/
];

lines.forEach((line, index) => {
  const lineNum = index + 1;
  
  // Check for hooks
  hookPatterns.forEach(pattern => {
    if (pattern.test(line)) {
      hookCount++;
      hookLines.push({ line: lineNum, content: line.trim() });
    }
  });
  
  // Check for early returns
  earlyReturnPatterns.forEach(pattern => {
    if (pattern.test(line)) {
      earlyReturnLines.push({ line: lineNum, content: line.trim() });
    }
  });
});

// Find the first early return line
const firstEarlyReturn = earlyReturnLines.length > 0 ? earlyReturnLines[0].line : Infinity;

// Count hooks before first early return
hooksBeforeEarlyReturns = hookLines.filter(hook => hook.line < firstEarlyReturn).length;

console.log('📊 HOOKS ANALYSIS RESULTS:');
console.log(`Total hooks found: ${hookCount}`);
console.log(`Hooks before first early return: ${hooksBeforeEarlyReturns}`);
console.log(`First early return at line: ${firstEarlyReturn === Infinity ? 'None found' : firstEarlyReturn}`);

console.log('\n🎯 HOOK LOCATIONS:');
hookLines.forEach((hook, index) => {
  const status = hook.line < firstEarlyReturn ? '✅' : '❌';
  console.log(`${status} Hook ${index + 1}: Line ${hook.line} - ${hook.content.substring(0, 60)}...`);
});

console.log('\n🚪 EARLY RETURN LOCATIONS:');
earlyReturnLines.forEach((ret, index) => {
  console.log(`${index + 1}. Line ${ret.line} - ${ret.content.substring(0, 60)}...`);
});

// Check if fix is successful
const isFixed = hookCount === hooksBeforeEarlyReturns;

console.log('\n' + '='.repeat(60));
if (isFixed) {
  console.log('✅ REACT HOOKS ERROR FIX SUCCESSFUL!');
  console.log('✅ All hooks are called before any early returns');
  console.log('✅ Component should no longer have "Rendered more hooks" error');
} else {
  console.log('❌ REACT HOOKS ERROR STILL EXISTS!');
  console.log(`❌ ${hookCount - hooksBeforeEarlyReturns} hooks are called after early returns`);
  console.log('❌ Component will still have "Rendered more hooks" error');
}

console.log('\n📋 SUMMARY:');
console.log(`- Total hooks: ${hookCount}`);
console.log(`- Hooks before early returns: ${hooksBeforeEarlyReturns}`);
console.log(`- Hooks after early returns: ${hookCount - hooksBeforeEarlyReturns}`);
console.log(`- Fix status: ${isFixed ? 'SUCCESSFUL' : 'FAILED'}`);

process.exit(isFixed ? 0 : 1);