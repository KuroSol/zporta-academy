/**
 * Contrast Checker Testing & Debugging Utility
 * Use this for testing and debugging contrast issues
 */

import {
  getContrastRatio,
  getLuminance,
  getOptimalTextColor,
  meetsWCAGStandard,
  hexToRgb,
  rgbToHex
} from './contrastChecker';

/**
 * Detailed contrast report for debugging
 * @param {string} textColor - Text color
 * @param {string} backgroundColor - Background color
 * @returns {object} Detailed analysis
 */
export const generateContrastReport = (textColor, backgroundColor) => {
  const ratio = getContrastRatio(textColor, backgroundColor);
  const textLuminance = getLuminance(textColor);
  const bgLuminance = getLuminance(backgroundColor);
  const meetsAA = meetsWCAGStandard(ratio, 'AA', 'normal');
  const meetsAAA = meetsWCAGStandard(ratio, 'AAA', 'normal');
  const optimalColor = getOptimalTextColor(backgroundColor, textColor);

  return {
    textColor,
    backgroundColor,
    contrastRatio: parseFloat(ratio.toFixed(2)),
    textLuminance: parseFloat(textLuminance.toFixed(3)),
    bgLuminance: parseFloat(bgLuminance.toFixed(3)),
    meetsWCAG_AA: meetsAA,
    meetsWCAG_AAA: meetsAAA,
    status: meetsAA ? '✅ PASS (AA)' : '❌ FAIL',
    optimalTextColor: optimalColor,
    recommendation: meetsAA 
      ? `Text is readable! (Ratio: ${parseFloat(ratio.toFixed(2))}:1)`
      : `Too similar colors! Change text to ${optimalColor} (Ratio would be: 7+:1)`
  };
};

/**
 * Pretty print contrast report to console
 * @param {string} textColor - Text color
 * @param {string} backgroundColor - Background color
 */
export const printContrastReport = (textColor, backgroundColor) => {
  const report = generateContrastReport(textColor, backgroundColor);
  
  console.group(`📊 Contrast Analysis: ${textColor} on ${backgroundColor}`);
  console.log(`%cContrast Ratio: ${report.contrastRatio}:1`, 'font-weight: bold; font-size: 14px;');
  console.log(`Text Luminance: ${report.textLuminance}`);
  console.log(`Background Luminance: ${report.bgLuminance}`);
  console.log(`Meets WCAG AA: ${report.meetsWCAG_AA ? '✅ Yes' : '❌ No'}`);
  console.log(`Meets WCAG AAA: ${report.meetsWCAG_AAA ? '✅ Yes' : '❌ No'}`);
  console.log(`Status: ${report.status}`);
  console.log(`Recommendation: ${report.recommendation}`);
  if (!report.meetsWCAG_AA) {
    console.log(`%cSuggested Fix: Use ${report.optimalTextColor} for text`, 'color: green; font-weight: bold;');
  }
  console.groupEnd();
  
  return report;
};

/**
 * Find all contrast issues on current page
 * @returns {array} Array of problem elements
 */
export const findContrastIssues = () => {
  const issues = [];
  const elements = document.querySelectorAll('body *');

  elements.forEach((element, index) => {
    const skipTags = ['SCRIPT', 'STYLE', 'NOSCRIPT', 'META', 'LINK'];
    if (skipTags.includes(element.tagName)) return;

    if (element.offsetHeight > 0 && element.offsetWidth > 0) {
      const styles = window.getComputedStyle(element);
      const bgColor = styles.backgroundColor;
      const textColor = styles.color;
      
      if (bgColor && textColor) {
        const ratio = getContrastRatio(textColor, bgColor);
        
        if (!meetsWCAGStandard(ratio, 'AA', 'normal')) {
          issues.push({
            element,
            textColor,
            backgroundColor: bgColor,
            contrastRatio: parseFloat(ratio.toFixed(2)),
            selector: element.className || element.tagName,
            text: element.textContent?.substring(0, 50) || ''
          });
        }
      }
    }
  });

  return issues;
};

/**
 * Report all contrast issues found on page
 */
export const reportAllContrastIssues = () => {
  const issues = findContrastIssues();
  
  console.group(`🔍 Contrast Issues Found: ${issues.length}`);
  
  if (issues.length === 0) {
    console.log('%c✅ No contrast issues found! All colors are readable.', 'color: green; font-weight: bold;');
  } else {
    issues.forEach((issue, idx) => {
      console.group(`Issue ${idx + 1}: ${issue.selector}`);
      console.log(`Text: "${issue.text}"`);
      console.log(`Contrast Ratio: ${issue.contrastRatio}:1 (needs 4.5:1)`);
      console.log(`Text Color: ${issue.textColor}`);
      console.log(`Background: ${issue.backgroundColor}`);
      console.log('Element:', issue.element);
      console.groupEnd();
    });
  }
  
  console.groupEnd();
  
  return issues;
};

/**
 * Interactive contrast tester
 * Test different color combinations
 * Usage: testColorCombination('#FFFFFF', '#000000')
 */
export const testColorCombination = (bgColor, fgColor) => {
  console.clear();
  const report = printContrastReport(fgColor, bgColor);
  
  // Create visual preview
  const previewDiv = document.createElement('div');
  previewDiv.id = 'contrast-test-preview';
  previewDiv.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    padding: 20px;
    border-radius: 8px;
    font-size: 16px;
    font-weight: bold;
    z-index: 99999;
    box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    background-color: ${bgColor};
    color: ${fgColor};
    max-width: 300px;
  `;
  previewDiv.innerHTML = `
    <div>Contrast Test Preview</div>
    <div style="font-size: 12px; margin-top: 10px;">
      Ratio: ${report.contrastRatio}:1<br>
      Status: ${report.status}
    </div>
  `;
  
  // Remove old preview if exists
  const oldPreview = document.getElementById('contrast-test-preview');
  if (oldPreview) oldPreview.remove();
  
  // Add new preview
  document.body.appendChild(previewDiv);
  
  return report;
};

/**
 * Color palette contrast checker
 * Test multiple colors against a background
 * Usage: testPalette('#FFFFFF', ['#000000', '#FF0000', '#00FF00'])
 */
export const testPalette = (backgroundColor, colors) => {
  console.group(`🎨 Palette Contrast Test against ${backgroundColor}`);
  
  const results = colors.map(color => {
    const ratio = getContrastRatio(color, backgroundColor);
    const passes = meetsWCAGStandard(ratio, 'AA');
    
    return {
      color,
      ratio: parseFloat(ratio.toFixed(2)),
      status: passes ? '✅ Pass' : '❌ Fail'
    };
  });
  
  results.forEach(result => {
    const status = result.status === '✅ Pass' ? '%c' : '%c';
    const color = result.status === '✅ Pass' ? 'green' : 'red';
    console.log(
      `%c${result.color}%c - Ratio: ${result.ratio}:1 - ${status}${result.status}`,
      `background-color: ${result.color}; color: white; padding: 5px;`,
      'color: default;',
      `color: ${color}; font-weight: bold;`
    );
  });
  
  console.groupEnd();
  
  return results;
};

/**
 * Generate color suggestion report
 * Given a background, suggest good text colors
 */
export const suggestColors = (backgroundColor) => {
  console.group(`🎯 Color Suggestions for ${backgroundColor}`);
  
  const suggestions = [
    '#000000', '#FFFFFF', '#333333', '#CCCCCC',
    '#1A1A1A', '#EEEEEE', '#222222', '#DDDDDD'
  ];
  
  const results = testPalette(backgroundColor, suggestions);
  
  const passing = results.filter(r => r.status === '✅ Pass');
  const failing = results.filter(r => r.status === '❌ Fail');
  
  console.log('%cPassing Colors:', 'font-weight: bold; color: green;');
  passing.forEach(r => console.log(`  ${r.color} (${r.ratio}:1)`));
  
  if (failing.length > 0) {
    console.log('%cFailing Colors:', 'font-weight: bold; color: red;');
    failing.forEach(r => console.log(`  ${r.color} (${r.ratio}:1)`));
  }
  
  console.groupEnd();
  
  return { passing, failing };
};

/**
 * Export all debugging functions
 */
export default {
  generateContrastReport,
  printContrastReport,
  findContrastIssues,
  reportAllContrastIssues,
  testColorCombination,
  testPalette,
  suggestColors
};
