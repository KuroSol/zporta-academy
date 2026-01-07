/**
 * Color Contrast Checker Utility
 * Ensures text is always readable against background colors
 * Using WCAG 2.1 accessibility standards
 */

/**
 * Convert hex color to RGB
 * @param {string} hex - Color in hex format (#RRGGBB)
 * @returns {object} RGB object with r, g, b properties
 */
export const hexToRgb = (hex) => {
  if (!hex || typeof hex !== 'string') return { r: 0, g: 0, b: 0 };
  
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 0, g: 0, b: 0 };
};

/**
 * Convert RGB to hex color
 * @param {number} r - Red value (0-255)
 * @param {number} g - Green value (0-255)
 * @param {number} b - Blue value (0-255)
 * @returns {string} Color in hex format (#RRGGBB)
 */
export const rgbToHex = (r, g, b) => {
  return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
};

/**
 * Calculate relative luminance of a color
 * Based on WCAG 2.1 standards
 * @param {string} color - Color in hex or rgb format
 * @returns {number} Luminance value (0-1)
 */
export const getLuminance = (color) => {
  let rgb;
  
  // Handle rgb/rgba format
  if (color.startsWith('rgb')) {
    const matches = color.match(/\d+/g);
    rgb = {
      r: parseInt(matches[0]),
      g: parseInt(matches[1]),
      b: parseInt(matches[2])
    };
  } else {
    // Handle hex format
    rgb = hexToRgb(color);
  }

  // Convert RGB values to 0-1 range
  const [r, g, b] = [rgb.r, rgb.g, rgb.b].map(val => {
    val = val / 255;
    return val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4);
  });

  // Calculate luminance
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/**
 * Calculate contrast ratio between two colors
 * WCAG 2.1 formula
 * @param {string} color1 - Foreground color
 * @param {string} color2 - Background color
 * @returns {number} Contrast ratio (1-21)
 */
export const getContrastRatio = (color1, color2) => {
  const lum1 = getLuminance(color1);
  const lum2 = getLuminance(color2);
  
  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);
  
  return (lighter + 0.05) / (darker + 0.05);
};

/**
 * Check if contrast ratio meets WCAG standards
 * @param {number} ratio - Contrast ratio
 * @param {string} level - 'AA' or 'AAA'
 * @param {string} size - 'normal' or 'large'
 * @returns {boolean} True if meets standard
 */
export const meetsWCAGStandard = (ratio, level = 'AA', size = 'normal') => {
  const standards = {
    'AA': { normal: 4.5, large: 3 },
    'AAA': { normal: 7, large: 4.5 }
  };
  
  return ratio >= standards[level][size];
};

/**
 * Adjust color brightness
 * @param {string} color - Color in hex format
 * @param {number} factor - Brightness factor (-1 to 1)
 * @returns {string} Adjusted color in hex format
 */
export const adjustBrightness = (color, factor) => {
  const rgb = hexToRgb(color);
  
  const adjusted = {
    r: Math.min(255, Math.max(0, Math.round(rgb.r + (rgb.r * factor)))),
    g: Math.min(255, Math.max(0, Math.round(rgb.g + (rgb.g * factor)))),
    b: Math.min(255, Math.max(0, Math.round(rgb.b + (rgb.b * factor))))
  };
  
  return rgbToHex(adjusted.r, adjusted.g, adjusted.b);
};

/**
 * Get optimal text color for a background
 * Returns either white or black, or automatically adjusts provided color
 * @param {string} backgroundColor - Background color
 * @param {string} textColor - Optional custom text color
 * @returns {string} Optimal text color (hex)
 */
export const getOptimalTextColor = (backgroundColor, textColor = null) => {
  // Calculate luminance of background
  const bgLuminance = getLuminance(backgroundColor);
  
  // If no custom text color provided, use white or black
  if (!textColor) {
    // Light background (luminance > 0.5) needs dark text
    // Dark background needs light text
    return bgLuminance > 0.5 ? '#000000' : '#FFFFFF';
  }
  
  // Check contrast with provided text color
  const ratio = getContrastRatio(textColor, backgroundColor);
  const minRatio = 4.5; // AA standard for normal text
  
  // If contrast is sufficient, return original color
  if (ratio >= minRatio) {
    return textColor;
  }
  
  // Try to adjust the text color to meet contrast requirement
  const textRgb = hexToRgb(textColor);
  const textLuminance = getLuminance(textColor);
  
  // If text is light, try darkening it
  // If text is dark, try lightening it
  const isTextLight = textLuminance > 0.5;
  const adjustment = isTextLight ? -0.3 : 0.3;
  
  return adjustBrightness(textColor, adjustment);
};

/**
 * Ensure element has proper text contrast
 * DOM-based function that checks and fixes real elements
 * @param {HTMLElement} element - HTML element to check
 * @param {boolean} forceBlackWhite - Force white/black contrast
 */
export const ensureTextContrast = (element, forceBlackWhite = false) => {
  if (!element) return;
  
  const styles = window.getComputedStyle(element);
  const backgroundColor = styles.backgroundColor;
  const textColor = styles.color;
  
  let optimalColor;
  
  if (forceBlackWhite) {
    optimalColor = getOptimalTextColor(backgroundColor);
  } else {
    optimalColor = getOptimalTextColor(backgroundColor, textColor);
  }
  
  element.style.color = optimalColor;
};

/**
 * Ensure heading/title has perfect contrast (force dark text)
 * More aggressive than regular text - headings MUST be readable
 * @param {HTMLElement} element - Heading element to fix
 */
export const ensureHeadingContrast = (element) => {
  if (!element) return;
  
  const styles = window.getComputedStyle(element);
  const backgroundColor = styles.backgroundColor;
  
  // For headings, ALWAYS use dark text on light bg, light text on dark bg
  const bgLuminance = getLuminance(backgroundColor);
  
  // Force maximum contrast for readability
  if (bgLuminance > 0.4) {
    // Light background → Use BLACK text
    element.style.color = '#000000 !important';
  } else {
    // Dark background → Use WHITE text
    element.style.color = '#FFFFFF !important';
  }
  
  // Also add font-weight for extra visibility
  if (element.tagName.match(/^H[1-6]$/)) {
    element.style.fontWeight = 'bold !important';
  }
};

/**
 * Scan and fix contrast issues in entire page
 * Should be called on page load and after DOM changes
 * Prioritizes headings and titles for better visibility
 * SKIPS elements with user-set colors (inline styles or data-attributes)
 * @param {string} selector - CSS selector for elements to check (default: all text elements)
 */
export const scanAndFixContrast = (selector = 'body *') => {
  const elements = document.querySelectorAll(selector);
  
  // First, prioritize and fix all headings/titles with MAXIMUM contrast
  const headingSelectors = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'title', '[role="heading"]'];
  headingSelectors.forEach(headingSelector => {
    const headings = document.querySelectorAll(headingSelector);
    headings.forEach(heading => {
      // Skip if user has manually set colors
      if (hasUserSetColors(heading)) return;
      
      if (heading.offsetHeight > 0 && heading.offsetWidth > 0) {
        // Use aggressive contrast for headings
        ensureHeadingContrast(heading);
      }
    });
  });
  
  // Also fix any element with heading-like classes
  const headingClasses = ['heading', 'title', 'headline', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'];
  headingClasses.forEach(className => {
    const elements = document.querySelectorAll(`[class*="${className}"]`);
    elements.forEach(element => {
      // Skip if user has manually set colors
      if (hasUserSetColors(element)) return;
      
      if (element.offsetHeight > 0 && element.offsetWidth > 0) {
        ensureHeadingContrast(element);
      }
    });
  });
  
  // Then fix all other elements
  elements.forEach(element => {
    // Skip if user has manually set colors
    if (hasUserSetColors(element)) return;
    
    // Skip certain elements that shouldn't be modified
    const skipTags = ['SCRIPT', 'STYLE', 'NOSCRIPT', 'META', 'LINK', 'HEAD'];
    if (skipTags.includes(element.tagName)) return;
    
    // Skip headings - already fixed above
    if (element.tagName.match(/^H[1-6]$/)) return;
    
    // Only check visible elements with actual text
    if (element.offsetHeight > 0 && element.offsetWidth > 0) {
      const hasText = Array.from(element.childNodes).some(
        node => node.nodeType === 3 && node.textContent.trim().length > 0
      );
      
      if (hasText || element.children.length === 0) {
        ensureTextContrast(element);
      }
    }
  });
};

/**
 * Check if element has user-set colors
 * Don't override if user manually changed colors
 * @param {HTMLElement} element - Element to check
 * @returns {boolean} True if user has set custom colors
 */
export const hasUserSetColors = (element) => {
  if (!element) return false;
  
  // Check for inline style attributes with color/background
  const inlineStyle = element.getAttribute('style') || '';
  if (inlineStyle.includes('color') || inlineStyle.includes('background')) {
    return true;
  }
  
  // Check for data attributes indicating user customization
  if (element.hasAttribute('data-user-color') || 
      element.hasAttribute('data-user-bg') ||
      element.hasAttribute('data-customized')) {
    return true;
  }
  
  // Check for user-edited classes using the proper classList API
  if (element.classList && element.classList.length > 0) {
    // Check each class name
    if (element.classList.contains('user-customized') || 
        element.classList.contains('user-styled') ||
        element.classList.contains('user-color')) {
      return true;
    }
  }
  
  return false;
};

/**
 * Watch for dynamic content and fix contrast issues
 * Useful for React applications with frequent updates
 */
export const setupContrastObserver = () => {
  // Create observer to watch for DOM changes
  const observer = new MutationObserver((mutations) => {
    let shouldScan = false;
    
    mutations.forEach(mutation => {
      if (mutation.type === 'childList' || mutation.type === 'attributes') {
        shouldScan = true;
      }
    });
    
    if (shouldScan) {
      // Debounce to avoid excessive scanning
      clearTimeout(setupContrastObserver.scanTimeout);
      setupContrastObserver.scanTimeout = setTimeout(() => {
        scanAndFixContrast();
      }, 500);
    }
  });
  
  // Start observing
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['style', 'class'],
    attributeOldValue: false
  });
  
  return observer;
};

/**
 * React Hook for managing contrast checking
 * Usage: useContrastChecker() in any component
 */
export const useContrastChecker = () => {
  const checkElement = (element) => {
    ensureTextContrast(element);
  };
  
  const checkPage = () => {
    scanAndFixContrast();
  };
  
  const getOptimalColor = (bgColor, textColor) => {
    return getOptimalTextColor(bgColor, textColor);
  };
  
  return {
    checkElement,
    checkPage,
    getOptimalColor,
    getContrastRatio
  };
};

export default {
  hexToRgb,
  rgbToHex,
  getLuminance,
  getContrastRatio,
  meetsWCAGStandard,
  adjustBrightness,
  getOptimalTextColor,
  ensureTextContrast,
  scanAndFixContrast,
  setupContrastObserver,
  useContrastChecker
};
