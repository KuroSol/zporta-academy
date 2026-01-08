/**
 * Color Contrast Checker - Usage Examples
 * Real-world examples of how to use the system
 */

// ============================================
// EXAMPLE 1: Global Setup (Already Done!)
// ============================================
/*
In your _app.js:

import { useGlobalContrastChecker } from '@/components/ContrastCheckerProvider';

export default function MyApp({ Component, pageProps }) {
  // This line automatically fixes all contrast issues on every page!
  useGlobalContrastChecker();
  
  return <Component {...pageProps} />;
}

Result: ✅ Entire app protected from contrast issues
*/

// ============================================
// EXAMPLE 2: Card with User-Picked Color
// ============================================
import { getOptimalTextColor } from '@/utils/contrastChecker';

export function UserCard({ userName, userColor, userBio }) {
  return (
    <div style={{
      backgroundColor: userColor,  // Could be any color!
      color: getOptimalTextColor(userColor),  // Auto-optimal text color
      padding: '20px',
      borderRadius: '8px'
    }}>
      <h2 style={{ color: getOptimalTextColor(userColor) }}>
        {userName}
      </h2>
      <p>{userBio}</p>
    </div>
  );
}

// Usage:
// <UserCard 
//   userName="John" 
//   userColor="#FF6B6B"  // Could be any color!
//   userBio="Hello world"
// />
// Result: Text will be readable on ANY background color!


// ============================================
// EXAMPLE 3: Dark Mode Support
// ============================================
import { usePageContrast } from '@/hooks/useContrastChecker';

export function MyApp() {
  const [isDarkMode, setIsDarkMode] = useState(false);
  
  // Auto-fix colors when theme changes
  usePageContrast();
  
  return (
    <div className={isDarkMode ? 'dark-theme' : 'light-theme'}>
      {/* All text colors automatically adjust for dark/light mode */}
      <button onClick={() => setIsDarkMode(!isDarkMode)}>
        Toggle Dark Mode
      </button>
      
      {/* Text will remain readable in both modes! */}
      <h1>Always Readable Heading</h1>
    </div>
  );
}

// Result: No matter if you switch to dark mode, text stays readable


// ============================================
// EXAMPLE 4: Testing Before Rendering
// ============================================
import { getContrastRatio, meetsWCAGStandard } from '@/utils/contrastChecker';

export function SafeColoredText({ backgroundColor, textColor, children }) {
  // Check if colors have good contrast
  const ratio = getContrastRatio(textColor, backgroundColor);
  const isReadable = meetsWCAGStandard(ratio);
  
  if (!isReadable) {
    console.warn(`⚠️ Colors have low contrast: ${ratio}:1`);
  }
  
  return (
    <div style={{
      backgroundColor,
      color: isReadable ? textColor : '#000000'  // Fallback if bad
    }}>
      {children}
    </div>
  );
}

// Usage:
// <SafeColoredText 
//   backgroundColor="#FFFFFF"
//   textColor="#FAFAFA"
//   children="Text that will be checked"
// />


// ============================================
// EXAMPLE 5: Styled Component Integration
// ============================================
import styled from 'styled-components';

const StyledCard = styled.div`
  background-color: ${props => props.bgColor};
  color: ${props => getOptimalTextColor(props.bgColor)};  // Auto-optimal!
  padding: 20px;
  border-radius: 8px;
  
  h1 {
    color: ${props => getOptimalTextColor(props.bgColor)};
  }
  
  p {
    color: ${props => getOptimalTextColor(props.bgColor)};
  }
`;

export function Card({ bgColor, title, text }) {
  return (
    <StyledCard bgColor={bgColor}>
      <h1>{title}</h1>
      <p>{text}</p>
    </StyledCard>
  );
}

// Usage:
// <Card bgColor="#3498DB" title="Hello" text="Readable text" />


// ============================================
// EXAMPLE 6: Form with Dynamic Background
// ============================================
import { useRef } from 'react';
import { useContrastFix } from '@/hooks/useContrastChecker';

export function CustomForm({ formBgColor }) {
  const formRef = useRef(null);
  
  // Automatically fix text contrast on this form
  useContrastFix(formRef);
  
  return (
    <form ref={formRef} style={{ backgroundColor: formBgColor }}>
      <input 
        type="text" 
        placeholder="Text will be readable"
        style={{ color: getOptimalTextColor(formBgColor) }}
      />
      <button>Submit</button>
    </form>
  );
}

// Result: Form text stays readable no matter what background color


// ============================================
// EXAMPLE 7: Color Palette Consistency
// ============================================

const COLOR_PALETTE = {
  primary: '#3498DB',
  success: '#27AE60',
  warning: '#F39C12',
  error: '#E74C3C',
  light: '#ECF0F1',
  dark: '#2C3E50'
};

// Create safe color combinations
const SAFE_PALETTE = Object.entries(COLOR_PALETTE).reduce((acc, [key, color]) => {
  acc[key] = {
    background: color,
    text: getOptimalTextColor(color)
  };
  return acc;
}, {});

export function Button({ variant = 'primary', children }) {
  const colors = SAFE_PALETTE[variant];
  
  return (
    <button style={{
      backgroundColor: colors.background,
      color: colors.text,
      padding: '10px 20px',
      border: 'none',
      borderRadius: '4px',
      cursor: 'pointer'
    }}>
      {children}
    </button>
  );
}

// Usage:
// <Button variant="primary">Click me</Button>
// <Button variant="success">Success!</Button>
// <Button variant="error">Error</Button>
// Result: All buttons have perfect contrast automatically!


// ============================================
// EXAMPLE 8: Checking Multiple Colors
// ============================================
import { testPalette } from '@/utils/contrastChecker.debug';

export function ColorPaletteTest() {
  const backgroundColor = '#FFFFFF';
  const colors = ['#000000', '#FF0000', '#00FF00', '#0000FF'];
  
  // Check which colors work with this background
  const results = colors.map(color => ({
    color,
    ratio: getContrastRatio(color, backgroundColor),
    readable: getContrastRatio(color, backgroundColor) >= 4.5
  }));
  
  return (
    <div>
      <h2>Color Contrast Test</h2>
      {results.map(result => (
        <div key={result.color} style={{
          backgroundColor: backgroundColor,
          color: result.color,
          padding: '10px',
          margin: '5px 0',
          border: `2px solid ${result.readable ? 'green' : 'red'}`
        }}>
          {result.color} - Ratio: {result.ratio.toFixed(2)}:1 ({result.readable ? '✅' : '❌'})
        </div>
      ))}
    </div>
  );
}


// ============================================
// EXAMPLE 9: Dynamic Theme Switcher
// ============================================
import { useState } from 'react';

export function ThemeSwitcher() {
  const [theme, setTheme] = useState('light');
  usePageContrast();  // Re-check contrast when theme changes
  
  const themes = {
    light: {
      bg: '#FFFFFF',
      text: '#000000',
      accent: '#3498DB'
    },
    dark: {
      bg: '#1A1A1A',
      text: '#FFFFFF',
      accent: '#3498DB'
    },
    sepia: {
      bg: '#F4EAE4',
      text: '#5B4636',
      accent: '#8B7355'
    }
  };
  
  const currentTheme = themes[theme];
  
  return (
    <div style={{ 
      backgroundColor: currentTheme.bg,
      color: currentTheme.text,
      padding: '20px'
    }}>
      <h1>Current Theme: {theme}</h1>
      
      <div>
        {Object.keys(themes).map(t => (
          <button 
            key={t}
            onClick={() => setTheme(t)}
            style={{
              marginRight: '10px',
              backgroundColor: currentTheme.accent,
              color: getOptimalTextColor(currentTheme.accent)
            }}
          >
            {t}
          </button>
        ))}
      </div>
      
      {/* Content here stays readable in any theme */}
      <p>This text automatically adjusts for readability!</p>
    </div>
  );
}

// Result: Text always readable when switching themes


// ============================================
// EXAMPLE 10: Accessibility Report
// ============================================
import { reportAllContrastIssues } from '@/utils/contrastChecker.debug';

export function AccessibilityCheck() {
  const [issues, setIssues] = useState([]);
  
  const runCheck = () => {
    // Run in browser console
    console.log('Checking page contrast...');
    const foundIssues = reportAllContrastIssues();
    setIssues(foundIssues);
  };
  
  return (
    <div>
      <button onClick={runCheck}>Check Accessibility</button>
      {issues.length === 0 ? (
        <p style={{ color: 'green' }}>✅ No contrast issues found!</p>
      ) : (
        <div style={{ color: 'red' }}>
          <p>❌ Found {issues.length} contrast issues:</p>
          {issues.map((issue, idx) => (
            <div key={idx}>
              <p>Ratio: {issue.contrastRatio}:1 (needs 4.5:1)</p>
              <p>Element: {issue.selector}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


// ============================================
// QUICK COPY-PASTE SOLUTIONS
// ============================================
/*

// ✅ Safe background with auto text color
<div style={{
  backgroundColor: userColor,
  color: getOptimalTextColor(userColor)
}}>
  {text}
</div>

// ✅ Auto-fix specific element
const ref = useRef(null);
useContrastFix(ref);
<div ref={ref}>{content}</div>

// ✅ Check if colors work
if (meetsWCAGStandard(getContrastRatio(textColor, bgColor))) {
  // Safe to use
}

// ✅ Get suggestions
const bestTextColor = getOptimalTextColor(userPickedColor);

// ✅ Test in console
reportAllContrastIssues();
testColorCombination('#FFFFFF', '#000000');
*/
