'use client';
import React, {
    useRef,
    useState,
    useEffect,
    useImperativeHandle,
    forwardRef,
    useCallback,
    useMemo
} from 'react';
// We will rename the CSS file to match the new component-based structure
import styles from '@/styles/Editor/LessonEditor.module.css';
import useBodyScrollLock from '@/hooks/useBodyScrollLock';
// Use the real API client (shared axios instance)
import apiClient from '@/api';

const ELEMENT_NODE = 1;

// Note: We previously had a MOCK client here. Switched to real apiClient to upload media to backend.

// --- CORE UTILITIES ---
const uid = () => crypto.randomUUID();

// --- COLUMN LAYOUT CONSTANTS ---
const BREAKPOINTS = ['base', 'sm', 'md', 'lg'];
const getInitialRatios = () => ({ base: [100], sm: [50, 50], md: [50, 50], lg: [50, 50] });
const COLUMN_PRESETS = {
    1: [[100]],
    2: [[50, 50], [30, 70], [70, 30], [33, 67], [67, 33]],
    3: [[33, 34, 33], [25, 50, 25], [50, 25, 25], [25, 25, 50]],
    4: [[25, 25, 25, 25], [20, 30, 30, 20]]
};
const WRAPPER_CLASS = "lesson-content";

// Normalizes layout ratios
function normalizeRatios(arr, cols) {
    const nums = (arr || []).map(n => Number(n));
    if (cols > 1 && nums.length === 1 && isFinite(nums[0]) && nums[0] > 0) {
        return nums;
    }
    const validNums = nums.filter(n => isFinite(n) && n > 0);
    if (validNums.length !== cols) {
        return Array.from({ length: cols }, () => 100 / cols);
    }
    return validNums;
}

// Helper to convert hex to rgba
const hexToRgba = (hex, alpha = 1) => {
    if (!hex || typeof hex !== 'string' || hex.length < 4) return `rgba(255, 255, 255, ${alpha})`;
    let hexValue = hex.slice(1);
    if (hexValue.length === 3) {
        hexValue = hexValue[0] + hexValue[0] + hexValue[1] + hexValue[1] + hexValue[2] + hexValue[2];
    }
    const bigint = parseInt(hexValue, 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

// --- NEW & EXPANDED ICON LIBRARY ---
// Using 1.25rem (20px) as a standard size, but viewbox allows scaling
const I = ({ w = 20, h = 20, children, ...props }) => (
    <svg 
        xmlns="http://www.w3.org/2000/svg" 
        width={w} 
        height={h} 
        viewBox="0 0 20 20" 
        fill="currentColor" 
        aria-hidden="true" 
        {...props}
    >
        {children}
    </svg>
);

// UI & Navigation
const Icons = {
    Plus: (p) => <I {...p}><path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" /></I>,
    Trash: (p) => <I {...p}><path fillRule="evenodd" d="M9 2a1 1 0 00-1 1v1H4a1 1 0 000 2h1v9a2 2 0 002 2h6a2 2 0 002-2V6h1a1 1 0 100-2h-4V3a1 1 0 00-1-1H9zm2 6a1 1 0 10-2 0v6a1 1 0 102 0V8z" clipRule="evenodd" /></I>,
    Settings: (p) => <I {...p}><path fillRule="evenodd" d="M11.49 3.17a.5.5 0 01.499.03l.006.003 2.008.916a.5.5 0 01.242.424V5.8a.5.5 0 01-.17.385l-1.5 1.5a.5.5 0 01-.707 0l-1.5-1.5a.5.5 0 01-.17-.385V4.542a.5.5 0 01.242-.424l2.008-.916.006-.003a.5.5 0 01.05-.03zm-2.98.03a.5.5 0 00-.499-.03L8 3.084l-2.008.916a.5.5 0 00-.242.424V5.8a.5.5 0 00.17.385l1.5 1.5a.5.5 0 00.707 0l1.5-1.5a.5.5 0 00.17-.385V4.542a.5.5 0 00-.242-.424L8.51 3.2zM4.662 4.084L2.654 5a.5.5 0 00-.242.424V6.8a.5.5 0 00.17.385l1.5 1.5a.5.5 0 00.707 0l1.5-1.5a.5.5 0 00.17-.385V5.424a.5.5 0 00-.242-.424L4.662 4.084zM11.49 9.17a.5.5 0 01.499.03l.006.003 2.008.916a.5.5 0 01.242.424v1.258a.5.5 0 01-.17.385l-1.5 1.5a.5.5 0 01-.707 0l-1.5-1.5a.5.5 0 01-.17-.385V10.542a.5.5 0 01.242-.424l2.008-.916.006-.003a.5.5 0 01.05-.03zm-2.98.03a.5.5 0 00-.499-.03L8 9.084l-2.008.916a.5.5 0 00-.242.424v1.258a.5.5 0 00.17.385l1.5 1.5a.5.5 0 00.707 0l1.5-1.5a.5.5 0 00.17-.385V10.542a.5.5 0 00-.242-.424L8.51 9.2zM4.662 10.084L2.654 11a.5.5 0 00-.242.424v1.258a.5.5 0 00.17.385l1.5 1.5a.5.5 0 00.707 0l1.5-1.5a.5.5 0 00.17-.385V11.424a.5.5 0 00-.242-.424L4.662 10.084zM17.346 5a.5.5 0 00.242-.424V3.318a.5.5 0 00-.33-.464l-2.008-.916a.5.5 0 00-.499.03l-.006.003-2.008.916a.5.5 0 00-.242.424V4.54a.5.5 0 00.17.385l1.5 1.5a.5.5 0 00.707 0l1.5-1.5a.5.5 0 00.17-.385zM17.346 11a.5.5 0 00.242-.424V9.318a.5.5 0 00-.33-.464l-2.008-.916a.5.5 0 00-.499.03l-.006.003-2.008.916a.5.5 0 00-.242.424V10.54a.5.5 0 00.17.385l1.5 1.5a.5.5 0 00.707 0l1.5-1.5a.5.5 0 00.17-.385V10.542a.5.5 0 00-.242-.424L8.51 9.2zM4.662 10.084L2.654 11a.5.5 0 00-.242.424v1.258a.5.5 0 00.17.385l1.5 1.5a.5.5 0 00.707 0l1.5-1.5a.5.5 0 00.17-.385V11.424a.5.5 0 00-.242-.424L4.662 10.084zM17.346 5a.5.5 0 00.242-.424V3.318a.5.5 0 00-.33-.464l-2.008-.916a.5.5 0 00-.499.03l-.006.003-2.008.916a.5.5 0 00-.242.424V4.54a.5.5 0 00.17.385l1.5 1.5a.5.5 0 00.707 0l1.5-1.5a.5.5 0 00.17-.385zM17.346 11a.5.5 0 00.242-.424V9.318a.5.5 0 00-.33-.464l-2.008-.916a.5.5 0 00-.499.03l-.006.003-2.008.916a.5.5 0 00-.242.424V10.54a.5.5 0 00.17.385l1.5 1.5a.5.5 0 00.707 0l1.5-1.5a.5.5 0 00.17-.385V10.542a.5.5 0 00-.242-.424L8.51 9.2zM4.662 10.084L2.654 11a.5.5 0 00-.242.424v1.258a.5.5 0 00.17.385l1.5 1.5a.5.5 0 00.707 0l1.5-1.5a.5.5 0 00.17-.385V11.424a.5.5 0 00-.242-.424L4.662 10.084zM17.346 5a.5.5 0 00.242-.424V3.318a.5.5 0 00-.33-.464l-2.008-.916a.5.5 0 00-.499.03l-.006.003-2.008.916a.5.5 0 00-.242.424V4.54a.5.5 0 00.17.385l1.5 1.5a.5.5 0 00.707 0l1.5-1.5a.5.5 0 00.17-.385zM17.346 11a.5.5 0 00.242-.424V9.318a.5.5 0 00-.33-.464l-2.008-.916a.5.5 0 00-.499.03l-.006.003-2.008.916a.5.5 0 00-.242.424V10.54a.5.5 0 00.17.385l1.5 1.5a.5.5 0 00.707 0l1.5-1.5a.5.5 0 00.17-.385V10.542a.5.5 0 00-.242-.424L8.51 9.2zM4.662 10.084L2.654 11a.5.5 0 00-.242.424v1.258a.5.5 0 00.17.385l1.5 1.5a.5.5 0 00.707 0l1.5-1.5a.5.5 0 00.17-.385V11.424a.5.5 0 00-.242-.424L4.662 10.084zM17.346 5a.5.5 0 00.242-.424V3.318a.5.5 0 00-.33-.464l-2.008-.916a.5.5 0 00-.499.03l-.006.003-2.008.916a.5.5 0 00-.242.424V4.54a.5.5 0 00.17.385l1.5 1.5a.5.5 0 00.707 0l1.5-1.5a.5.5 0 00.17-.385zM17.346 11a.5.5 0 00.242-.424V9.318a.5.5 0 00-.33-.464l-2.008-.916a.5.5 0 00-.499.03l-.006.003-2.008.916a.5.5 0 00-.242.424V10.54a.5.5 0 00.17.385l1.5 1.5a.5.5 0 00.707 0l1.5-1.5a.5.5 0 00.17-.385V10.542a.5.5 0 00-.242-.424L8.51 9.2zM4.662 10.084L2.654 11a.5.5 0 00-.242.424v1.258a.5.5 0 00.17.385l1.5 1.5a.5.5 0 00.707 0l1.5-1.5a.5.5 0 00.17-.385V11.424a.5.5 0 00-.242-.424L4.662 10.084zM17.346 5a.5.5 0 00.242-.424V3.318a.5.5 0 00-.33-.464l-2.008-.916a.5.5 0 00-.499.03l-.006.003-2.008.916a.5.5 0 00-.242.424V4.54a.5.5 0 00.17.385l1.5 1.5a.5.5 0 00.707 0l1.5-1.5a.5.5 0 00.17-.385zM17.346 11a.5.5 0 00.242-.424V9.318a.5.5 0 00-.33-.464l-2.008-.916a.5.5 0 00-.499.03l-.006.003-2.008.916a.5.5 0 00-.242.424V10.54a.5.5 0 00.17.385l1.5 1.5a.5.5 0 00.707 0l1.5-1.5a.5.5 0 00.17-.385V10.542a.5.5 0 00-.242-.424L8.51 9.2zM4.662 10.084L2.654 11a.5.5 0 00-.242.424v1.258a.5.5 0 00.17.385l1.5 1.5a.5.5 0 00.707 0l1.5-1.5a.5.5 0 00.17-.385V11.424a.5.5 0 00-.242-.424L4.662 10.084zM17.346 5a.5.5 0 00.242-.424V3.318a.5.5 0 00-.33-.464l-2.008-.916a.5.5 0 00-.499.03l-.006.003-2.008.916a.5.5 0 00-.242.424V4.54a.5.5 0 00.17.385l1.5 1.5a.5.5 0 00.707 0l1.5-1.5a.5.5 0 00.17-.385zM17.346 11a.5.5 0 00.242-.424V9.318a.5.5 0 00-.33-.464l-2.008-.916a.5.5 0 00-.499.03l-.006.003-2.008.916a.5.5 0 00-.242.424V10.54a.5.5 0 00.17.385l1.5 1.5a.5.5 0 00.707 0l1.5-1.5a.5.5 0 00.17-.385V10.542a.5.5 0 00-.242-.424L8.51 9.2zM4.662 10.084L2.654 11a.5.5 0 00-.242.424v1.258a.5.5 0 00.17.385l1.5 1.5a.5.5 0 00.707 0l1.5-1.5a.5.5 0 00.17-.385V11.424a.5.5 0 00-.242-.424L4.662 10.084zM17.346 5a.5.5 0 00.242-.424V3.318a.5.5 0 00-.33-.464l-2.008-.916a.5.5 0 00-.499.03l-.006.003-2.008.916a.5.5 0 00-.242.424V4.54a.5.5 0 00.17.385l1.5 1.5a.5.5 0 00.707 0l1.5-1.5a.5.5 0 00.17-.385zM17.346 11a.5.5 0 00.242-.424V9.318a.5.5 0 00-.33-.464l-2.008-.916a.5.5 0 00-.499.03l-.006.003-2.008.916a.5.5 0 00-.242.424V10.54a.5.5 0 00.17.385l1.5 1.5a.5.5 0 00.707 0l1.5-1.5a.5.5 0 00.17-.385V10.542a.5.5 0 00-.242-.424L8.51 9.2zM4.662 10.084L2.654 11a.5.5 0 00-.242.424v1.258a.5.5 0 00.17.385l1.5 1.5a.5.5 0 00.707 0l1.5-1.5a.5.5 0 00.17-.385V11.424a.5.5 0 00-.242-.424L4.662 10.084zM17.346 5a.5.5 0 00.242-.424V3.318a.5.5 0 00-.33-.464l-2.008-.916a.5.5 0 00-.499.03l-.006.003-2.008.916a.5.5 0 00-.242.424V4.54a.5.5 0 00.17.385l1.5 1.5a.5.5 0 00.707 0l1.5-1.5a.5.5 0 00.17-.385zM17.346 11a.5.5 0 00.242-.424V9.318a.5.5 0 00-.33-.464l-2.008-.916a.5.5 0 00-.499.03l-.006.003-2.008.916a.5.5 0 00-.242.424V10.54a.5.5 0 00.17.385l1.5 1.5a.5.5 0 00.707 0l1.5-1.5a.5.5 0 00.17-.385V10.542a.5.5 0 00-.242-.424L8.51 9.2zM4.662 10.084L2.654 11a.5.5 0 00-.242.424v1.258a.5.5 0 00.17.385l1.5 1.5a.5.5 0 00.707 0l1.5-1.5a.5.5 0 00.17-.385V11.424a.5.5 0 00-.242-.424L4.662 10.084z" clipRule="evenodd" /></I>,
    Desktop: (p) => <I {...p}><path fillRule="evenodd" d="M3 5a2 2 0 012-2h10a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V5zm2 0h10v8H5V5z" clipRule="evenodd" /><path d="M13 16.5a1 1 0 11-2 0 1 1 0 012 0z" /><path fillRule="evenodd" d="M3 14.5a.5.5 0 01.5-.5h13a.5.5 0 010 1H12v1.5a1 1 0 11-2 0V15H3.5a.5.5 0 01-.5-.5z" clipRule="evenodd" /></I>,
    Tablet: (p) => <I {...p}><path fillRule="evenodd" d="M5 2a2 2 0 012-2h6a2 2 0 012 2v16a2 2 0 01-2 2H7a2 2 0 01-2-2V2zm2 0h6v16H7V2z" clipRule="evenodd" /><path d="M11 17a1 1 0 11-2 0 1 1 0 012 0z" /></I>,
    Mobile: (p) => <I {...p}><path fillRule="evenodd" d="M6 2a2 2 0 012-2h4a2 2 0 012 2v16a2 2 0 01-2 2H8a2 2 0 01-2-2V2zm2 0h4v16H8V2z" clipRule="evenodd" /><path d="M11 17a1 1 0 11-2 0 1 1 0 012 0z" /></I>,
    Duplicate: (p) => <I {...p}><path fillRule="evenodd" d="M4 2a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H6a2 2 0 01-2-2V2zm2 0h8v8H6V2z" clipRule="evenodd" /><path fillRule="evenodd" d="M3 5a1 1 0 011-1h.5a1 1 0 110 2H4a1 1 0 01-1-1zM3 9a1 1 0 011-1h.5a1 1 0 110 2H4a1 1 0 01-1-1zM7 13.5a1 1 0 10-2 0V16a1 1 0 01-1 1H3a1 1 0 100 2h1a3 3 0 003-3v-2.5zM13 16.5a1 1 0 10-2 0V17a1 1 0 11-2 0v-.5a3 3 0 00-3-3H4.5a1 1 0 100 2H5a1 1 0 011 1v.5a1 1 0 102 0v-.5a1 1 0 011-1h.5a1 1 0 100-2H9a3 3 0 00-3 3v.5a1 1 0 102 0V16a1 1 0 011-1h2a1 1 0 110 2h-1a1 1 0 01-1 1v.5a1 1 0 102 0V17a1 1 0 011-1h.5a1 1 0 100-2h-.5a1 1 0 01-1 1v.5z" clipRule="evenodd" /></I>,
    MoveUp: (p) => <I {...p}><path fillRule="evenodd" d="M10 3a1 1 0 011 1v11.586l3.293-3.293a1 1 0 111.414 1.414l-5 5a1 1 0 01-1.414 0l-5-5a1 1 0 111.414-1.414L9 15.586V4a1 1 0 011-1z" clipRule="evenodd" transform="translate(0 20) scale(1 -1) translate(0 20)" /></I>,
    MoveDown: (p) => <I {...p}><path fillRule="evenodd" d="M10 3a1 1 0 011 1v11.586l3.293-3.293a1 1 0 111.414 1.414l-5 5a1 1 0 01-1.414 0l-5-5a1 1 0 111.414-1.414L9 15.586V4a1 1 0 011-1z" clipRule="evenodd" /></I>,
    Palette: (p) => <I {...p}><path d="M10 2.5a.5.5 0 00-1 0V5a.5.5 0 001 0V2.5zM10 0a1 1 0 00-1 1V5a1 1 0 102 0V1a1 1 0 00-1-1z" /><path fillRule="evenodd" d="M10 18a7.5 7.5 0 006.467-3.756.5.5 0 01.86.51A8.5 8.5 0 1110 1.5a.5.5 0 010-1A9.5 9.5 0 1010 19V1.5a.5.5 0 010-1V19c-.662 0-1.306-.067-1.928-.198a.5.5 0 01.356-.964A8.44 8.44 0 0010 18z" clipRule="evenodd" /><path d="M13.5 10a.5.5 0 01.5-.5h3a.5.5 0 010 1h-3a.5.5 0 01-.5-.5z" /><path d="M17.5 13.5a.5.5 0 00-1 0v3a.5.5 0 001 0v-3z" /></I>,
    Code: (p) => <I {...p}><path fillRule="evenodd" d="M6.33 4.61l-4.72 4.72a.75.75 0 000 1.06l4.72 4.72a.75.75 0 001.06-1.06L3.165 10l4.225-4.225a.75.75 0 00-1.06-1.165zM13.67 4.61a.75.75 0 011.06 0l4.72 4.72a.75.75 0 010 1.06l-4.72 4.72a.75.75 0 01-1.06-1.06L16.835 10l-4.225-4.225a.75.75 0 011.06-1.165z" clipRule="evenodd" /></I>,
    Eye: (p) => <I {...p}><path fillRule="evenodd" d="M10 3a7 7 0 00-7 7 7 7 0 007 7 7 7 0 007-7 7 7 0 00-7-7zm0 1.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zm0 2.5a3 3 0 100 6 3 3 0 000-6z" clipRule="evenodd" /></I>,
    Edit: (p) => <I {...p}><path fillRule="evenodd" d="M13.293 3.293a1 1 0 011.414 0l2 2a1 1 0 010 1.414l-9 9a1 1 0 01-.39.242l-3 1a1 1 0 01-1.22-1.22l1-3a1 1 0 01.242-.39l9-9zM14 6.414l-8.5 8.5L5 15.414l.5-1.5L13.586 6l.414.414zM15 4.414L15.586 5 14 6.414 13.586 6 15 4.414z" clipRule="evenodd" /></I>,
    Fullscreen: (p) => <I {...p}><path fillRule="evenodd" d="M5 3a2 2 0 00-2 2v2a1 1 0 102 0V5h2a1 1 0 000-2H5zm10 0a2 2 0 012 2v2a1 1 0 11-2 0V5h-2a1 1 0 110-2h2zM3 13a2 2 0 002 2h2a1 1 0 110 2H5a2 2 0 01-2-2v-2a1 1 0 112 0v2zm14 0a2 2 0 01-2 2h-2a1 1 0 110 2h2a2 2 0 002-2v-2a1 1 0 11-2 0v2z" clipRule="evenodd" /></I>,
    FullscreenExit: (p) => <I {...p}><path fillRule="evenodd" d="M8 3a1 1 0 00-1 1v3a1 1 0 01-1 1H3a1 1 0 100 2h3a3 3 0 003-3V4a1 1 0 00-1-1zm4 0a1 1 0 011 1v3a3 3 0 003 3h3a1 1 0 110 2h-3a3 3 0 01-3-3V4a1 1 0 011-1zM3 12a1 1 0 011-1h3a3 3 0 013 3v3a1 1 0 11-2 0v-3a1 1 0 00-1-1H4a1 1 0 01-1-1zm14 0a1 1 0 00-1-1h-3a3 3 0 00-3 3v3a1 1 0 102 0v-3a1 1 0 011-1h3a1 1 0 001-1z" clipRule="evenodd" /></I>,
    Sidebar: (p) => <I {...p}><path fillRule="evenodd" d="M2 3a1 1 0 011-1h14a1 1 0 011 1v14a1 1 0 01-1 1H3a1 1 0 01-1-1V3zm1 1v12h12V4H3zm4 0v12h8V4H7z" clipRule="evenodd" /></I>,
    SidebarOpen: (p) => <I {...p}><path fillRule="evenodd" d="M2 3a1 1 0 011-1h14a1 1 0 011 1v14a1 1 0 01-1 1H3a1 1 0 01-1-1V3zm1 1v12h4V4H3zm6 0v12h8V4H9z" clipRule="evenodd" /></I>,
    PanelClose: (p) => <I {...p}><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></I>,
    Close: (p) => <I {...p}><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></I>,
    DragHandle: (p) => <I {...p} w={14} h={14}><path d="M5 3a1 1 0 11-2 0 1 1 0 012 0zM6 2a1 1 0 100 2 1 1 0 000-2zM5 7a1 1 0 11-2 0 1 1 0 012 0zM6 6a1 1 0 100 2 1 1 0 000-2zM5 11a1 1 0 11-2 0 1 1 0 012 0zM6 10a1 1 0 100 2 1 1 0 000-2zM9 3a1 1 0 11-2 0 1 1 0 012 0zM10 2a1 1 0 100 2 1 1 0 000-2zM9 7a1 1 0 11-2 0 1 1 0 012 0zM10 6a1 1 0 100 2 1 1 0 000-2zM9 11a1 1 0 11-2 0 1 1 0 012 0zM10 10a1 1 0 100 2 1 1 0 000-2z" /></I>,
    ChevronDown: (p) => <I {...p}><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" /></I>,

// Block Types
    Text: (p) => <I {...p}><path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h8a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" /></I>,
    Heading: (p) => <I {...p}><path fillRule="evenodd" d="M4 4a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zM4 9a1 1 0 011-1h6a1 1 0 110 2H5a1 1 0 01-1-1z" clipRule="evenodd" /><path fillRule="evenodd" d="M3 15a1 1 0 011-1h4a1 1 0 110 2H4a1 1 0 01-1-1zM9.5 3.5a1 1 0 100 2v10a1 1 0 102 0v-10a1 1 0 10-2 0z" clipRule="evenodd" /></I>,
    Image: (p) => <I {...p}><path fillRule="evenodd" d="M2 4a2 2 0 012-2h12a2 2 0 012 2v12a2 2 0 01-2 2H4a2 2 0 01-2-2V4zm2-1a1 1 0 00-1 1v12a1 1 0 001 1h12a1 1 0 001-1V4a1 1 0 00-1-1H4z" clipRule="evenodd" /><path d="M4 14.59l4-4 3 3 4-4 3 3V17H4v-2.41zM6 8a2 2 0 100-4 2 2 0 000 4z" /></I>,
    Audio: (p) => <I {...p}><path d="M6 9a1 1 0 011-1h1.06a1 1 0 01.94.65l.5 1.5a1 1 0 00.94.65h1.12a1 1 0 00.94-.65l.5-1.5a1 1 0 01.94-.65H15a1 1 0 010 2h-.06a1 1 0 01-.94.65l-.5 1.5a1 1 0 00-.94.65h-1.12a1 1 0 00-.94-.65l-.5-1.5a1 1 0 01-.94-.65H7a1 1 0 01-1-1z" /><path fillRule="evenodd" d="M3 3a2 2 0 012-2h10a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V3zm2-1a1 1 0 00-1 1v14a1 1 0 001 1h10a1 1 0 001-1V3a1 1 0 00-1-1H5z" clipRule="evenodd" /></I>,
    Video: (p) => <I {...p}><path d="M14.5 11.08l-3.6-2.08a1 1 0 00-1.4.86v4.28a1 1 0 001.4.86l3.6-2.08a1 1 0 000-1.72z" /><path fillRule="evenodd" d="M3 3a2 2 0 012-2h10a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V3zm2-1a1 1 0 00-1 1v14a1 1 0 001 1h10a1 1 0 001-1V3a1 1 0 00-1-1H5z" clipRule="evenodd" /></I>,
    Button: (p) => <I {...p}><path fillRule="evenodd" d="M4 5a2 2 0 012-2h8a2 2 0 012 2v10a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm2-1a1 1 0 00-1 1v10a1 1 0 001 1h8a1 1 0 001-1V5a1 1 0 00-1-1H6z" clipRule="evenodd" /><path d="M6 8.5a.5.5 0 01.5-.5h7a.5.5 0 010 1h-7a.5.5 0 01-.5-.5z" /></I>,
    Columns: (p) => <I {...p}><path fillRule="evenodd" d="M2 3a1 1 0 011-1h14a1 1 0 011 1v14a1 1 0 01-1 1H3a1 1 0 01-1-1V3zm9 1V16H3V4h8zm2 0V16h4V4h-4z" clipRule="evenodd" /></I>,
    Accordion: (p) => <I {...p}><path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" /></I>,
    Layout: (p) => <I {...p}><path fillRule="evenodd" d="M2 3a1 1 0 011-1h14a1 1 0 011 1v14a1 1 0 01-1 1H3a1 1 0 01-1-1V3zm1 1v12h12V4H3zm4 0v12h8V4H7z" clipRule="evenodd" /></I>,
    Column: (p) => <I {...p}><path fillRule="evenodd" d="M2 3a1 1 0 011-1h14a1 1 0 011 1v14a1 1 0 01-1 1H3a1 1 0 01-1-1V3zm1 1v12h12V4H3z" clipRule="evenodd" /></I>,
    Panel: (p) => <I {...p}><path fillRule="evenodd" d="M3 3a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h6a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" /></I>,
// Text Toolbar
    Bold: (p) => <I {...p}><path fillRule="evenodd" d="M8 4a1 1 0 011-1h.5a3.5 3.5 0 013.5 3.5V8a1 1 0 11-2 0V6.5a1.5 1.5 0 00-1.5-1.5H9a1 1 0 01-1-1zM8 12a1 1 0 011-1h1.5a3.5 3.5 0 013.5 3.5v.5a2 2 0 11-4 0v-.5a1.5 1.5 0 00-1.5-1.5H9a1 1 0 01-1-1z" clipRule="evenodd" /></I>,
    Italic: (p) => <I {...p}><path fillRule="evenodd" d="M7.5 3a1 1 0 011 1v.5h1.16l-2.66 9H6a1 1 0 110-2h.5l2-6H7.5a1 1 0 01-1-1V4a1 1 0 011-1zM12 3a1 1 0 011 1v.5h1.16l-2.66 9H10.5a1 1 0 110-2h.5l2-6H12.5a1 1 0 01-1-1V4a1 1 0 011-1z" clipRule="evenodd" /></I>,
    Underline: (p) => <I {...p}><path fillRule="evenodd" d="M6 3a1 1 0 011 1v6a3 3 0 106 0V4a1 1 0 112 0v6a5 5 0 01-10 0V4a1 1 0 011-1z" clipRule="evenodd" /><path d="M4 17a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1z" /></I>,
    List: (p) => <I {...p}><path fillRule="evenodd" d="M5 5a1 1 0 011-1h10a1 1 0 110 2H6a1 1 0 01-1-1zm0 5a1 1 0 011-1h10a1 1 0 110 2H6a1 1 0 01-1-1zm0 5a1 1 0 011-1h10a1 1 0 110 2H6a1 1 0 01-1-1zM2.5 6a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zm0 5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zm0 5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" clipRule="evenodd" /></I>,
    ListOrdered: (p) => <I {...p}><path fillRule="evenodd" d="M6 5a1 1 0 011-1h10a1 1 0 110 2H7a1 1 0 01-1-1zm0 5a1 1 0 011-1h10a1 1 0 110 2H7a1 1 0 01-1-1zm0 5a1 1 0 011-1h10a1 1 0 110 2H7a1 1 0 01-1-1z" clipRule="evenodd" /><path d="M2.12 15.34a.5.5 0 01.37.16l.13.2a.5.5 0 00.75 0l.13-.2a.5.5 0 01.62-.16 1 1 0 11.5 1.73l-.37.61a.5.5 0 01-.75 0l-.63-1.04a.5.5 0 01.37-.8zm-.13-5.26a1 1 0 100-2 1 1 0 000 2zm.59.16a1.5 1.5 0 10-1.18-2.66.5.5 0 01.5-.86 2.5 2.5 0 111.96 4.39.5.5 0 01-.78-.87zM3.5 3.5a1 1 0 10-2 0V4a1 1 0 102 0V3.5z" /></I>,
};

// Map to associate block types with their new icons
const BlockTypeIcons = {
    text: <Icons.Text />,
    heading: <Icons.Heading />,
    image: <Icons.Image />,
    audio: <Icons.Audio />,
    video: <Icons.Video />,
    button: <Icons.Button />,
    columns: <Icons.Columns />,
    accordion: <Icons.Accordion />,
    // For containers
    column: <I w={16} h={16}><path fillRule="evenodd" d="M2 3a1 1 0 011-1h14a1 1 0 011 1v14a1 1 0 01-1 1H3a1 1 0 01-1-1V3zm1 1v12h12V4H3z" clipRule="evenodd" /></I>,
    accItem: <I w={16} h={16}><path fillRule="evenodd" d="M2 3a1 1 0 011-1h14a1 1 0 011 1v14a1 1 0 01-1 1H3a1 1 0 01-1-1V3zm1 1v2h12V4H3zm0 4v2h12V8H3zm0 4v2h12v-2H3z" clipRule="evenodd" /></I>,
    accPanel: <I w={16} h={16}><path fillRule="evenodd" d="M3 3a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h6a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" /></I>,
    editor: <Icons.Eye />,
};

/**
 * Helper function to extract inline styles from an element
 */
const parseInlineStyles = (element) => {
    if (!element || !element.style) return {};
    const styles = {};
    const styleProps = [
        'backgroundColor', 'color', 'padding', 'margin', 
        'fontSize', 'border', 'borderRadius', 'textAlign'
    ];
    
    styleProps.forEach(prop => {
        const value = element.style[prop];
        if (value) styles[prop] = value;
    });
    
    return styles;
};

/**
 * Parses an HTML string into an array of block objects.
 * @param {string} htmlString - The HTML string to parse.
 * @returns {Array<Object>} An array of block objects.
 */
const htmlToBlocks = (htmlString) => {
    if (!htmlString || typeof window === 'undefined') {
        return [{ id: uid(), type: 'text', data: { text: '' }, styles: {} }];
    }
    try {
        // Normalize whitespace: trim and fix common spacing issues
        let normalizedHtml = htmlString
            .trim()
            // Remove excessive whitespace between tags while preserving single spaces
            .replace(/>\s+</g, '><')
            // Restore line breaks after block-level closing tags for readability
            .replace(/<\/(div|p|h1|h2|h3|h4|h5|h6|ul|ol|li|figure|details)>/gi, '</$1>\n');
        
        const doc = new DOMParser().parseFromString(normalizedHtml, 'text/html');
        const wrapper = doc.querySelector(`.${WRAPPER_CLASS}`);
        const rootNode = wrapper || doc.body;

        const parseNodes = (nodes) => {
            const blocks = [];
            Array.from(nodes).forEach(node => {
                if (node.nodeType !== ELEMENT_NODE) return;
                if (node.tagName === 'STYLE') return;
                const id = uid();
                if (node.tagName === 'DIV' && node.classList.contains(WRAPPER_CLASS)) {
                    blocks.push(...parseNodes(node.childNodes));
                    return;
                }

                if (node.classList.contains('zporta-columns')) {
                    // THIS IS THE FIX: Filter to *only* map over .zporta-column children
                    const columnElements = Array.from(node.children).filter(child => 
                        child.nodeType === ELEMENT_NODE && child.classList.contains('zporta-column')
                    );
                    const columns = columnElements.map(col => parseNodes(col.childNodes));
                    const ratios = {};
                    let columnCount = 0;
                    const style = node.style;
                    BREAKPOINTS.forEach(bp => {
                        const propValue = style.getPropertyValue(`--cols-${bp}`).trim();
                        if (propValue) {
                            const parsedRatios = propValue.split(' ').map(s => parseFloat(s.replace('fr', ''))).filter(n => !isNaN(n));
                            if (parsedRatios.length > 0) {
                                ratios[bp] = parsedRatios;
                                if (parsedRatios.length > columnCount) {
                                    columnCount = parsedRatios.length;
                                }
                            }
                        }
                    });

                    const hasParsedRatios = Object.keys(ratios).length > 0;
                    const finalColumnCount = columns.length || columnCount || 1;
                    const defaultRatios = getInitialRatios();
                    BREAKPOINTS.forEach(bp => {
                        if (!ratios[bp]) {
                            ratios[bp] = COLUMN_PRESETS[finalColumnCount]?.[0] || (bp === 'base' ? [100] : Array(finalColumnCount).fill(100 / finalColumnCount));
                        }
                    });

                    const layout = {
                        columns: finalColumnCount,
                        ratios: hasParsedRatios ? ratios : defaultRatios,
                    };
                    blocks.push({ id, type: 'columns', children: columns, layout, styles: parseInlineStyles(node) });
                } else if (node.tagName.startsWith('H')) {
                    blocks.push({ id, type: 'heading', data: { text: node.innerHTML }, styles: parseInlineStyles(node) });
                } else if (node.tagName === 'P' || node.tagName === 'UL' || node.tagName === 'OL' || (node.tagName === 'DIV' && !node.classList.contains('zporta-accordion') && !node.classList.contains('zporta-columns') && (node.querySelector('ul') || node.querySelector('ol')))) {
                    // Check if this text block contains nested complex blocks (accordion, columns, etc.)
                    const hasNestedAccordion = node.querySelector('.zporta-accordion');
                    const hasNestedColumns = node.querySelector('.zporta-columns');
                    const hasNestedButton = node.querySelector('.zporta-button');
                    
                    if (hasNestedAccordion || hasNestedColumns || hasNestedButton) {
                        // Parse nested structures as separate blocks instead of treating as text
                        blocks.push(...parseNodes(node.childNodes));
                    } else {
                        blocks.push({ id, type: 'text', data: { text: node.innerHTML }, styles: parseInlineStyles(node) });
                    }
                } else if (node.tagName === 'FIGURE' && node.querySelector('img')) {
                    const img = node.querySelector('img');
                    const link = node.querySelector('a');
                    const alignStyle = node.style.alignItems || 'center';
                    const align = alignStyle.includes('start') ? 'left' : alignStyle.includes('end') ? 'right' : 'center';
                    
                    // Extract maxWidth from img element's inline style
                    const imgMaxWidth = img?.style?.maxWidth || '';
                    
                    blocks.push({ 
                        id, 
                        type: 'image', 
                        data: { 
                            src: img?.src || '', 
                            caption: node.querySelector('figcaption')?.textContent || '',
                            align: align,
                            href: link?.href || '',
                            openInNewTab: link?.target === '_blank',
                            maxWidth: imgMaxWidth
                        }, 
                        styles: parseInlineStyles(node) 
                    });
                } else if (node.tagName === 'FIGURE' && node.querySelector('audio')) {
                    const audio = node.querySelector('audio');
                    blocks.push({ id, type: 'audio', data: { src: audio?.src || '' }, styles: parseInlineStyles(node) });
                } else if (node.tagName === 'FIGURE' && node.querySelector('video')) {
                    const video = node.querySelector('video');
                    blocks.push({ id, type: 'video', data: { src: video?.src || '' }, styles: parseInlineStyles(node) });
                } else if (node.tagName === 'A' && node.classList.contains('zporta-button')) {
                    // Extract align from justify-self style
                    const justifySelf = node.style.justifySelf || 'start';
                    const align = justifySelf === 'center' ? 'center' : justifySelf === 'end' ? 'right' : 'left';
                    
                    // Extract border radius
                    const radius = node.style.borderRadius || 'var(--r-md)';
                    
                    const data = {
                        text: node.textContent,
                        href: node.href,
                        variant: Array.from(node.classList).find(c => c.startsWith('zporta-btn--'))?.replace('zporta-btn--', '') || 'primary',
                        size: Array.from(node.classList).find(c => c.startsWith('zporta-btnSize--'))?.replace('zporta-btnSize--', '') || 'md',
                        full: node.classList.contains('zporta-btn--block'),
                        align: align,
                        radius: radius
                    };
                    blocks.push({ id, type: 'button', data, styles: parseInlineStyles(node) });
                } else if (node.classList.contains('zporta-accordion')) {
                    const themeMatch = Array.from(node.classList).find(c => c.startsWith('zporta-acc--'));
                    const radius = node.style.getPropertyValue('--acc-radius') || '8px';
                    const allowMultiple = node.dataset.allowMultiple === '1';
                    const firstIsOpen = !!node.querySelector(':scope > details[open]');
                    const firstSummary = node.querySelector(':scope > details > summary.zporta-acc-title');
                    const titleAlign = firstSummary?.dataset.align || 'left';
                    const titleSize = firstSummary?.dataset.size || 'md';
                    const icon = firstSummary?.dataset.icon || 'chevron';
                    const items = [];
                    Array.from(node.querySelectorAll(':scope > details.zporta-acc-item')).forEach(d => {
                        const title = d.querySelector(':scope > summary.zporta-acc-title')?.textContent || 'Untitled';
                        const panelDiv = d.querySelector(':scope > div.zporta-acc-panel');
                        let blocksInPanel = [];

                        if (panelDiv) {
                            // Recursively parse panel contents - this will detect nested accordions
                            blocksInPanel = parseNodes(panelDiv.childNodes);
                            
                            // Debug: log if we find nested accordions
                            if (panelDiv.querySelector('.zporta-accordion')) {
                                console.log('✓ Nested accordion detected in panel:', title);
                            }
                        } else {
                            const otherNodes = Array.from(d.childNodes).filter(n => n.nodeType === ELEMENT_NODE && n.tagName !== 'SUMMARY');
                            if (otherNodes.length > 0) {
                                blocksInPanel = parseNodes(otherNodes);
                            }
                        }

                        items.push({
                            id: uid(),
                            title,
                            blocks: blocksInPanel,
                        });
                    });
                    blocks.push({ id, type: 'accordion', items, styles: parseInlineStyles(node), options: {
                        allowMultiple, openFirst: firstIsOpen, radius,
                        theme: themeMatch ? themeMatch.replace('zporta-acc--', '') : 'light',
                        titleAlign, titleSize, icon
                    }});
                    } else if (node.tagName === 'DIV' && (node.innerHTML.trim() || node.classList.contains('zporta-column'))){
                        if (node.classList.contains('zporta-acc-panel') || node.classList.contains('zporta-column')) {
                            // Do nothing, these are handled by their parent parsers
                        } else {
                            // Check if this DIV contains complex nested structures
                            const hasNestedAccordion = node.querySelector('.zporta-accordion');
                            const hasNestedColumns = node.querySelector('.zporta-columns');
                            
                            if (hasNestedAccordion || hasNestedColumns) {
                                // Parse nested structures as separate blocks
                                blocks.push(...parseNodes(node.childNodes));
                            } else {
                                console.warn("Parsing unexpected DIV as text block:", node);
                                blocks.push({ id, type: 'text', data: { text: node.innerHTML }, styles: parseInlineStyles(node) });
                            }
                        }
                    }
            });
            return blocks;
        };

        const initialBlocks = parseNodes(rootNode.childNodes);
        return initialBlocks.length > 0 ? initialBlocks : [{ id: uid(), type: 'text', data: { text: '' }, styles: {} }];
    } catch (error) {
        console.error("Error parsing HTML to blocks:", error, "HTML:", htmlString);
        return [{ id: uid(), type: 'text', data: { text: '<p>Error loading content.</p>' }, styles: {} }];
    }
};

/**
 * Serializes an array of block objects into a clean HTML string.
 * @param {Array<Object>} blocks - The array of block objects to serialize.
 * @returns {string} The resulting HTML string.
 */
const blocksToHtml = (blocks) => {
    return blocks.map(block => {
        if (!block) return '';
        const styleString = Object.entries(block.styles || {}).map(([k, v]) => `${k.replace(/([A-Z])/g, "-$1").toLowerCase()}:${v}`).join(';');

        switch (block.type) {
            case 'heading':
                return `<h2 style="${styleString}">${block.data.text || ''}</h2>`;
            case 'text':
                const isEmpty = !block.data.text || block.data.text.trim() === '' || block.data.text.trim() === '<br>';
                const hasBlockElements = /<\/(ul|ol|div|p)>/.test(block.data.text);
                if (hasBlockElements) {
                    return `<div style="${styleString}">${isEmpty ? '<br>' : block.data.text}</div>`;
                }
                return `<p style="${styleString}">${isEmpty ? '<br>' : block.data.text}</p>`;
            case 'image': {
                const align = block.data.align || 'center';
                const alignStyle = `display:flex;flex-direction:column;align-items:${align === 'left' ? 'flex-start' : align === 'right' ? 'flex-end' : 'center'};`;
                const combinedStyle = [styleString, alignStyle].filter(Boolean).join(' ');
                // Persist maxWidth onto the <img> so the size survives copy/save and re-import
                const imgInlineStyles = [];
                if (block.data.maxWidth) {
                    imgInlineStyles.push(`max-width:${block.data.maxWidth}`);
                    // Ensure responsive rendering when maxWidth set
                    imgInlineStyles.push('width:100%');
                    imgInlineStyles.push('height:auto');
                }
                const imgStyleAttr = imgInlineStyles.length ? ` style="${imgInlineStyles.join(';')}"` : '';
                const imgTag = `<img src="${block.data.src || ''}" alt="${block.data.caption || ''}"${imgStyleAttr} />`;
                const imgContent = block.data.href 
                    ? `<a href="${block.data.href}"${block.data.openInNewTab ? ' target="_blank" rel="noopener noreferrer"' : ''}>${imgTag}</a>`
                    : imgTag;
                return `<figure style="${combinedStyle}">${imgContent}${block.data.caption ? `<figcaption>${block.data.caption}</figcaption>` : ''}</figure>`;
            }
            case 'audio':
                return `<figure style="${styleString}"><audio controls src="${block.data.src || ''}"></audio></figure>`;
            case 'video':
                return `<figure style="${styleString}"><video controls src="${block.data.src || ''}"></video></figure>`;
            case 'button': {
                const v = block.data?.variant || 'primary';
                const s = block.data?.size || 'md';
                const f = block.data?.full ? ' zporta-btn--block' : '';
                const alignStyle = `justify-self: ${block.data?.align === 'center' ? 'center' : block.data?.align === 'right' ? 'end' : 'start'};`;
                const radiusStyle = `border-radius: ${block.data?.radius || 'var(--r-md)'};`;
                const combinedStyle = [styleString, alignStyle, radiusStyle].filter(Boolean).join(' ');
                return `<a href="${block.data?.href || '#'}" class="zporta-button zporta-btn--${v} zporta-btnSize--${s}${f}" style="${combinedStyle}">${block.data?.text || 'Click Me'}</a>`;
            }
            case 'columns': {
                let allStyles = styleString;
                if (block.layout && block.layout.ratios) {
                    const ratioRules = BREAKPOINTS
                        .map(bp => {
                            if (block.layout.columns && block.layout.ratios[bp] && block.layout.ratios[bp].length > 0) {
                                const normalized = normalizeRatios(block.layout.ratios[bp], block.layout.columns);
                                if (Array.isArray(normalized) && normalized.length > 0) {
                                    return `--cols-${bp}: ${normalized.map(r => `${r}fr`).join(' ')};`;
                                }
                            }
                            return null;
                        })
                        .filter(Boolean);
                    allStyles = [styleString, ...ratioRules].filter(Boolean).join('; ');
                }
                const columnsHtml = (block.children || []).map(col => `<div class="zporta-column">${blocksToHtml(col || [])}</div>`).join('');
                return `<div class="zporta-columns" style="${allStyles.trim()}">${columnsHtml}</div>`;
            }
            case 'accordion': {
                 const o = block.options || {};
                 const theme = o.theme || 'light';
                 const allowMulti = !!o.allowMultiple;
                 const openFirst = !!o.openFirst;
                 const radius = o.radius || '8px';
                 const titleAlign = o.titleAlign || 'left';
                 const titleSize = o.titleSize || 'md';
                 const icon = o.icon || 'chevron';
                 const itemsHtml = (block.items || []).map((item, i) => {
                   const inner = blocksToHtml(item.blocks || []);
                   const openAttr = openFirst && i === 0 ? ' open' : '';
                   return `<details class="zporta-acc-item"${openAttr}>
                            <summary class="zporta-acc-title" data-align="${titleAlign}" data-size="${titleSize}" data-icon="${icon}">${item.title || 'Untitled'}</summary>
                            <div class="zporta-acc-panel">${inner}</div>
                           </details>`;
                 }).join('');
                 const allowAttr = allowMulti ? ' data-allow-multiple="1"' : '';
                 return `<div class="zporta-accordion zporta-acc--${theme}"${allowAttr} style="--acc-radius:${radius};${styleString}">${itemsHtml}</div>`;
            }
            default:
                console.warn("Unknown block type during serialization:", block.type);
                return '';
        }
    }).join('\n');
};

// --- Block Components ---
// (Part 3 will start here)

// ... (Part 2 code - htmlToBlocks - ends here)

// --- Block Components ---

/**
 * A reusable placeholder for empty media blocks.
 */
const Placeholder = ({ icon, title, description, onClick }) => (
    <button
        type="button"
        className={styles.placeholder}
        onMouseDown={(e) => { e.stopPropagation(); }}
        onMouseUp={(e) => { e.stopPropagation(); }}
        onClick={(e) => {
            e.stopPropagation();
            onClick(e);
        }}
    >
        <div className={styles.placeholderIcon}>{icon}</div>
        <div className={styles.placeholderContent}>
            <span className={styles.placeholderTitle}>{title}</span>
            <span className={styles.placeholderDescription}>{description}</span>
        </div>
    </button>
);

/**
 * Block: Heading
 * Renders an editable H2 tag.
 */
const HeadingBlock = ({ id, data, styles: blockStyles, isEditing, onUpdate, onSelectLayer, onShowSettings }) => {
    const handleBlur = useCallback((e) => {
        const updatedText = e.currentTarget.innerHTML;
        if (updatedText !== data.text) {
            onUpdate({ ...data, text: updatedText });
        }
    }, [data, onUpdate]);

    return isEditing ? <h2
        style={blockStyles}
        contentEditable
        suppressContentEditableWarning
        onBlur={handleBlur}
        className={`${styles.blockInput} ${styles.blockContentEditable} ${styles.headingEditable}`}
        dangerouslySetInnerHTML={{ __html: data.text || '' }}/>
    : <h2 style={blockStyles} dangerouslySetInnerHTML={{ __html: data.text || 'Heading' }}/>;
};

/**

/**
 * Block: Text
 * Renders an editable div that supports rich text (bold, italic, lists).
 */
const TextBlock = ({ id, data, styles: blockStyles, isEditing, onUpdate, onSelectLayer, onShowSettings }) => {
     const handleBlur = useCallback((e) => {
        const updatedText = e.currentTarget.innerHTML;
        if (updatedText !== data.text) {
            onUpdate({ ...data, text: updatedText });
        }
    }, [data, onUpdate]);

    return isEditing ? <div
        style={blockStyles}
        contentEditable
        suppressContentEditableWarning
        onBlur={handleBlur}
        className={`${styles.blockInput} ${styles.blockContentEditable} ${styles.blockTextarea}`}
        dangerouslySetInnerHTML={{ __html: data.text || '' }} />
    : (
        /<\/(ul|ol|div|p)>/.test(data.text)
        ? <div style={blockStyles} dangerouslySetInnerHTML={{ __html: data.text || '<br>' }} />
        : <p style={blockStyles} dangerouslySetInnerHTML={{ __html: data.text || 'Paragraph text will appear here.' }} />
    );
};

/**
 * Block: Image
 * Renders an image with an optional caption.
 */
const ImageBlock = ({ data, styles: blockStyles, isEditing, onUpdate, openImagePicker, onShowSettings }) => {
    if (data.uploading) return <div className={styles.uploadingIndicator}>Uploading Image...</div>;
    if (!data.src) {
        return isEditing
            ? <Placeholder icon={<Icons.Image />} title="Image" description="Click to upload an image" onClick={openImagePicker} />
            : null;
    }
    
    // Determine alignment style
    const align = data.align || 'center';
    const alignStyle = {
        display: 'flex',
        flexDirection: 'column',
        alignItems: align === 'left' ? 'flex-start' : align === 'right' ? 'flex-end' : 'center'
    };
    
    // Apply maxWidth if specified
    const imgStyle = data.maxWidth ? { maxWidth: data.maxWidth, width: '100%', height: 'auto' } : {};
    
    // Wrap image in link if href exists
    const imgElement = (
        <img src={data.src} alt={data.caption || ''} className={styles.imageContent} style={imgStyle} />
    );
    
    const imageContent = !isEditing && data.href ? (
        <a 
            href={data.href} 
            target={data.openInNewTab ? '_blank' : undefined}
            rel={data.openInNewTab ? 'noopener noreferrer' : undefined}
            style={{ display: 'inline-block' }}
        >
            {imgElement}
        </a>
    ) : imgElement;
    
    return (
        <figure
            style={{ ...blockStyles, ...alignStyle }}
            className={`${styles.imageFigure} ${isEditing ? styles.mediaEditable : ''}`}
            onClick={(e)=>{ if (isEditing) { e.stopPropagation(); openImagePicker(); } }}
            title={isEditing ? 'Click to replace image' : undefined}
        >
            {imageContent}
            {isEditing && (
                <input
                    type="text"
                    value={data.caption || ''}
                    onChange={(e) => onUpdate({ ...data, caption: e.target.value})}
                    placeholder="Add a caption..."
                    className={styles.captionInput}
                    onClick={(e)=>e.stopPropagation()}
                />
            )}
            {!isEditing && data.caption && <figcaption className={styles.captionContent}>{data.caption}</figcaption>}
        </figure>
    );
};

/**
 * Block: Audio
 * Renders an HTML5 audio player.
 */
const AudioBlock = ({ data, styles: blockStyles, isEditing, openAudioPicker, onShowSettings }) => {
    if (data.uploading) return <div className={styles.uploadingIndicator}>Uploading Audio...</div>;
    if (!data.src) {
        return isEditing
            ? <Placeholder icon={<Icons.Audio />} title="Audio" description="Click to upload an MP3 file" onClick={openAudioPicker} />
            : null;
    }
    return (
        <div
            style={blockStyles}
            className={`${styles.audioWrapper} ${isEditing ? styles.mediaEditable : ''}`}
            onClick={(e)=>{ if (isEditing) { e.stopPropagation(); openAudioPicker(); } }}
            onDoubleClick={(e)=>{ if (isEditing) { e.stopPropagation(); openAudioPicker(); } }}
            title={isEditing ? 'Click to replace audio' : undefined}
        >
            {isEditing && (
                <button type="button" className={styles.mediaGearBtn} onClick={(e)=>{ e.stopPropagation(); onShowSettings(); }} aria-label="Audio settings" title="Audio settings">
                    <Icons.Settings w={16} h={16} />
                </button>
            )}
            <audio controls src={data.src} className={styles.audioElement}></audio>
        </div>
    );
};

/**
 * Block: Video
 * Renders an HTML5 video player.
 */
const VideoBlock = ({ data, styles: blockStyles, isEditing, openVideoPicker, onShowSettings }) => {
    if (data.uploading) return <div className={styles.uploadingIndicator}>Uploading Video...</div>;
    if (!data.src) {
        return isEditing
            ? <Placeholder icon={<Icons.Video />} title="Video" description="Click to upload a video file" onClick={openVideoPicker} />
            : null;
    }
    return (
        <div
            style={blockStyles}
            className={`${styles.videoWrapper} ${isEditing ? styles.mediaEditable : ''}`}
            onClick={(e)=>{ if (isEditing) { e.stopPropagation(); openVideoPicker(); } }}
            title={isEditing ? 'Click to replace video' : undefined}
        >
            {isEditing && (
                <button type="button" className={styles.mediaGearBtn} onClick={(e)=>{ e.stopPropagation(); onShowSettings(); }} aria-label="Video settings" title="Video settings">
                    <Icons.Settings w={16} h={16} />
                </button>
            )}
            <video controls src={data.src} className={styles.videoElement}></video>
        </div>
    );
};

/**
 * Block: Button
 * Renders a customizable link button.
 */
const ButtonBlock = ({ data, styles: blockStyles, isEditing, onUpdate }) => {
    const { text='', href='#', variant='primary', size='md', full=false, align='left', radius='var(--r-md)' } = data || {};
    if (isEditing) {
        return (
            <div className={styles.buttonEditor}>
                <input type="text" name="buttonText" aria-label="Button text" value={text} onChange={(e)=>onUpdate({ ...data, text:e.target.value })} placeholder="Button Text"/>
                <input type="url"  name="buttonHref" aria-label="Button link URL" value={href} onChange={(e)=>onUpdate({ ...data, href:e.target.value })} placeholder="https://example.com"/>
            </div>
        );
    }
    const cls = `${styles.btn} ${styles[`btn_${variant}`]} ${styles[`btnSize_${size}`]} ${full ? styles.btnBlock : ''}`;
    const style = { ...blockStyles, justifySelf:(align==='center'?'center':align==='right'?'end':'start'), borderRadius:radius };
    return <a href={href} className={cls} style={style}>{text || 'Click Me'}</a>;
};

// Map of block types to their React components
const blockMap = {
    heading: HeadingBlock,
    text: TextBlock,
    image: ImageBlock,
    audio: AudioBlock,
    video: VideoBlock,
    button: ButtonBlock,
    // Complex blocks (Columns, Accordion) will be defined in Part 4
    // and added to this map there.
};

// --- CORE UI COMPONENTS ---

/**
 * Floating toolbar for rich text editing (Bold, Italic, Lists).
 */
const TextToolbar = ({ onExecCommand }) => {
    const [showColorPicker, setShowColorPicker] = useState(false);
    const [showFontPicker, setShowFontPicker] = useState(false);
    const [showLinkInput, setShowLinkInput] = useState(false);
    const [textColor, setTextColor] = useState('#000000');
    const [colorInput, setColorInput] = useState('#000000');
    const [linkUrl, setLinkUrl] = useState('');
    const [inLink, setInLink] = useState(false);
    const colorPickerRef = useRef(null);
    const fontPickerRef = useRef(null);
    const linkInputRef = useRef(null);
    const savedSelectionRef = useRef(null);

    const saveSelection = useCallback(() => {
        try {
            const sel = window.getSelection();
            if (sel && sel.rangeCount > 0) {
                const range = sel.getRangeAt(0).cloneRange();
                const containerEl = (range.startContainer?.nodeType === 1
                    ? range.startContainer
                    : range.startContainer?.parentElement)?.closest('[contenteditable="true"]');
                savedSelectionRef.current = { range, containerEl };
            }
        } catch {}
    }, []);

    const restoreSelection = useCallback(() => {
        const saved = savedSelectionRef.current;
        if (!saved) return false;
        const sel = window.getSelection();
        if (!sel) return false;
        try {
            if (saved.containerEl && typeof saved.containerEl.focus === 'function') {
                saved.containerEl.focus();
            }
            sel.removeAllRanges();
            sel.addRange(saved.range);
            return true;
        } catch {
            return false;
        }
    }, []);

    const commands = [
        { cmd: 'bold', icon: <Icons.Bold w={16} h={16} />, title: 'Bold' },
        { cmd: 'italic', icon: <Icons.Italic w={16} h={16} />, title: 'Italic' },
        { cmd: 'underline', icon: <Icons.Underline w={16} h={16} />, title: 'Underline' },
        { cmd: 'insertUnorderedList', icon: <Icons.List w={16} h={16} />, title: 'Bulleted List' },
        { cmd: 'insertOrderedList', icon: <Icons.ListOrdered w={16} h={16} />, title: 'Numbered List' },
    ];

    const fonts = [
        'Arial', 'Helvetica', 'Times New Roman', 'Georgia', 'Courier New', 
        'Verdana', 'Trebuchet MS', 'Comic Sans MS', 'Impact', 'Palatino',
        'Garamond', 'Bookman', 'Tahoma', 'Lucida Console'
    ];

    const handleMouseDown = (e, cmd, value = null) => {
        e.preventDefault();
        e.stopPropagation();
        // For simple commands, just execute via callback (it persists content)
        onExecCommand(cmd, value);
    };

    const handleColorChange = (e) => {
        const color = e.target.value;
        setTextColor(color);
        setColorInput(color);
        restoreSelection();
        onExecCommand('foreColor', color);
    };

    const handleColorInputChange = (e) => {
        const value = e.target.value;
        setColorInput(value);
        // Validate hex color format
        if (/^#[0-9A-F]{6}$/i.test(value) || /^#[0-9A-F]{3}$/i.test(value)) {
            setTextColor(value);
            restoreSelection();
            onExecCommand('foreColor', value);
        }
    };

    const handleFontChange = (font) => {
        restoreSelection();
        onExecCommand('fontName', font);
        setShowFontPicker(false);
    };

    const handleInsertLink = () => {
        if (linkUrl.trim()) {
            const url = linkUrl.startsWith('http') ? linkUrl : `https://${linkUrl}`;
            
            // Restore selection first
            if (!restoreSelection()) {
                setShowLinkInput(false);
                return;
            }
            
            const sel = window.getSelection();
            if (!sel || sel.rangeCount === 0) {
                setShowLinkInput(false);
                return;
            }
            
            // Get the selected text
            const selectedText = sel.toString().trim();
            
            // If there's selected text, wrap it in a link
            if (selectedText) {
                onExecCommand('createLink', url);
            } else {
                // If no text is selected, insert "link" or the URL as clickable text
                const linkText = url.replace(/^https?:\/\//, '').split('/')[0]; // Extract domain
                const range = sel.getRangeAt(0);
                const linkElement = document.createElement('a');
                linkElement.href = url;
                linkElement.textContent = linkText;
                range.insertNode(linkElement);
                
                // Move cursor after the link
                range.setStartAfter(linkElement);
                range.collapse(true);
                sel.removeAllRanges();
                sel.addRange(range);
            }
            
            setLinkUrl('');
            setShowLinkInput(false);
        }
    };

    const handleRemoveLink = () => {
        restoreSelection();
        onExecCommand('unlink', null);
        setShowLinkInput(false);
    };

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (colorPickerRef.current && !colorPickerRef.current.contains(event.target)) {
                setShowColorPicker(false);
            }
            if (fontPickerRef.current && !fontPickerRef.current.contains(event.target)) {
                setShowFontPicker(false);
            }
            if (linkInputRef.current && !linkInputRef.current.contains(event.target)) {
                setShowLinkInput(false);
            }
        };
        if (showColorPicker || showFontPicker || showLinkInput) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [showColorPicker, showFontPicker, showLinkInput]);

    // Track if selection is inside a link and prefill URL when opening link popup
    useEffect(() => {
        const onSelChange = () => {
            try {
                const sel = window.getSelection();
                if (!sel || sel.rangeCount === 0) { setInLink(false); return; }
                const node = sel.anchorNode;
                const el = (node && node.nodeType === 1 ? node : node?.parentElement);
                const a = el?.closest && el.closest('a');
                setInLink(!!a);
                if (a && showLinkInput && !linkUrl) {
                    setLinkUrl(a.getAttribute('href') || '');
                }
            } catch {}
        };
        document.addEventListener('selectionchange', onSelChange);
        return () => document.removeEventListener('selectionchange', onSelChange);
    }, [showLinkInput, linkUrl]);

    return (
        <div className={styles.textToolbar} onMouseDown={e => e.preventDefault()} onClick={e => e.stopPropagation()}>
            {commands.map(({ cmd, icon, title }) => (
                <button
                    key={cmd}
                    type="button"
                    className={styles.toolbarButton}
                    title={title}
                    onMouseDown={e => handleMouseDown(e, cmd)}
                    onClick={e => e.preventDefault()}
                >
                    {icon}
                </button>
            ))}
            
            {/* Font Picker */}
            <div style={{ position: 'relative', display: 'inline-block' }} ref={fontPickerRef}>
                <button
                    type="button"
                    className={styles.toolbarButton}
                    title="Font Family"
                    onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        saveSelection();
                        setShowFontPicker(!showFontPicker);
                        setShowColorPicker(false);
                        setShowLinkInput(false);
                    }}
                    onClick={e => e.preventDefault()}
                    style={{ position: 'relative', fontSize: '14px', fontWeight: 'bold' }}
                >
                    A
                </button>
                {showFontPicker && (
                    <div style={{
                        position: 'absolute',
                        top: '100%',
                        left: '0',
                        marginTop: '4px',
                        padding: '4px',
                        backgroundColor: 'white',
                        border: '1px solid #ddd',
                        borderRadius: '4px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                        zIndex: 99999,
                        maxHeight: '200px',
                        overflowY: 'auto',
                        minWidth: '150px',
                        color: '#111'
                    }}>
                        {fonts.map(font => (
                            <button
                                key={font}
                                type="button"
                                onMouseDown={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    handleFontChange(font);
                                }}
                                style={{
                                    display: 'block',
                                    width: '100%',
                                    padding: '6px 10px',
                                    border: 'none',
                                    background: 'transparent',
                                    textAlign: 'left',
                                    cursor: 'pointer',
                                    fontFamily: font,
                                    fontSize: '14px',
                                    color: '#111'
                                }}
                                onMouseEnter={(e) => e.target.style.backgroundColor = '#f0f0f0'}
                                onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                            >
                                {font}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Color Picker */}
            <div style={{ position: 'relative', display: 'inline-block' }} ref={colorPickerRef}>
                <button
                    type="button"
                    className={styles.toolbarButton}
                    title="Text Color"
                    onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        saveSelection();
                        setShowColorPicker(!showColorPicker);
                        setShowFontPicker(false);
                        setShowLinkInput(false);
                    }}
                    onClick={e => e.preventDefault()}
                    style={{ position: 'relative' }}
                >
                    <Icons.Palette w={16} h={16} />
                    <span style={{
                        position: 'absolute',
                        bottom: '2px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        width: '14px',
                        height: '3px',
                        backgroundColor: textColor,
                        borderRadius: '2px'
                    }}></span>
                </button>
                {showColorPicker && (
                    <div style={{
                        position: 'absolute',
                        top: '100%',
                        left: '0',
                        marginTop: '4px',
                        padding: '12px',
                        backgroundColor: 'white',
                        border: '1px solid #ddd',
                        borderRadius: '6px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                        zIndex: 99999,
                        minWidth: '180px',
                        color: '#111'
                    }}>
                        <div style={{ marginBottom: '8px' }}>
                            <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px', color: '#666' }}>
                                Color Picker
                            </label>
                            <input
                                type="color"
                                value={textColor}
                                onChange={handleColorChange}
                                onMouseDown={e => e.preventDefault()}
                                style={{ 
                                    width: '100%', 
                                    height: '36px', 
                                    border: '1px solid #ddd',
                                    borderRadius: '4px',
                                    cursor: 'pointer' 
                                }}
                            />
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px', color: '#666' }}>
                                Hex Code
                            </label>
                            <input
                                type="text"
                                value={colorInput}
                                onChange={handleColorInputChange}
                                onMouseDown={e => e.preventDefault()}
                                placeholder="#000000"
                                style={{ 
                                    width: '100%', 
                                    padding: '6px 8px',
                                    border: '1px solid #ddd',
                                    borderRadius: '4px',
                                    fontSize: '13px',
                                    fontFamily: 'monospace',
                                    color: '#111',
                                    background: '#fff'
                                }}
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* Link Button */}
            <div style={{ position: 'relative', display: 'inline-block' }} ref={linkInputRef}>
                <button
                    type="button"
                    className={styles.toolbarButton}
                    title="Insert Link"
                    onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        saveSelection();
                        setShowLinkInput(!showLinkInput);
                        setShowColorPicker(false);
                        setShowFontPicker(false);
                        // Prefill if selection already in a link
                        try {
                            const sel = window.getSelection();
                            const node = sel && sel.anchorNode;
                            const el = (node && node.nodeType === 1 ? node : node?.parentElement);
                            const a = el?.closest && el.closest('a');
                            if (a) setLinkUrl(a.getAttribute('href') || '');
                        } catch {}
                    }}
                    onClick={e => e.preventDefault()}
                    style={{ position: 'relative', backgroundColor: inLink ? 'rgba(255,255,255,0.15)' : undefined }}
                >
                    🔗
                </button>
                {showLinkInput && (
                    <div style={{
                        position: 'absolute',
                        top: '100%',
                        left: '0',
                        marginTop: '4px',
                        padding: '12px',
                        backgroundColor: 'white',
                        border: '1px solid #ddd',
                        borderRadius: '6px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                        zIndex: 99999,
                        minWidth: '280px',
                        color: '#111'
                    }}>
                        <div style={{ marginBottom: '4px' }}>
                            <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px', color: '#666', fontWeight: '600' }}>
                                Add Link to Text
                            </label>
                            <p style={{ fontSize: '11px', color: '#888', margin: '0 0 8px 0', lineHeight: '1.4' }}>
                                Select text first, then add a link. Example: &ldquo;click here&rdquo; → add URL
                            </p>
                            <input
                                type="text"
                                value={linkUrl}
                                onChange={(e) => setLinkUrl(e.target.value)}
                                onMouseDown={e => e.preventDefault()}
                                onKeyPress={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        handleInsertLink();
                                    }
                                }}
                                placeholder="https://example.com"
                                style={{ 
                                    width: '100%', 
                                    padding: '6px 8px',
                                    border: '1px solid #ddd',
                                    borderRadius: '4px',
                                    fontSize: '13px',
                                    color: '#111',
                                    background: '#fff'
                                }}
                                autoFocus
                            />
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                                type="button"
                                onMouseDown={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    handleInsertLink();
                                }}
                                style={{
                                    flex: 1,
                                    padding: '6px 12px',
                                    backgroundColor: '#0A2342',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontSize: '12px',
                                    fontWeight: '500'
                                }}
                            >
                                Insert Link
                            </button>
                            <button
                                type="button"
                                onMouseDown={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    handleRemoveLink();
                                }}
                                style={{
                                    padding: '6px 12px',
                                    backgroundColor: '#f5f5f5',
                                    color: '#333',
                                    border: '1px solid #ddd',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontSize: '12px'
                                }}
                            >
                                Remove Link
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

/**
 * Contextual controls for a block (Move, Duplicate, Settings, Delete).
 */
const BlockControls = ({ blockId, onMoveUp, onMoveDown, onDuplicate, onShowSettings, onDelete, isFirst, isLast }) => (
    <div className={styles.blockControls}
         data-block-id={blockId}
         onMouseDown={(e) => { /* prevent editor canvas selection/blur */ e.preventDefault(); e.stopPropagation(); }}
         onClick={(e) => { e.stopPropagation(); }}>
        <button
            type="button"
            id={`block-${blockId}-move-up`}
            data-block-id={blockId}
            onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); onMoveUp(); }}
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
            className={styles.controlButton}
            title="Move Up"
            disabled={isFirst}
        >
            <Icons.MoveUp w={16} h={16} />
        </button>
        <button
            type="button"
            id={`block-${blockId}-move-down`}
            data-block-id={blockId}
            onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); onMoveDown(); }}
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
            className={styles.controlButton}
            title="Move Down"
            disabled={isLast}
        >
            <Icons.MoveDown w={16} h={16} />
        </button>
        <button
            type="button"
            id={`block-${blockId}-duplicate`}
            data-block-id={blockId}
            onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); onDuplicate(); }}
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
            className={styles.controlButton}
            title="Duplicate Block"
        >
            <Icons.Duplicate w={16} h={16} />
        </button>
        <button
            type="button"
            id={`block-${blockId}-settings`}
            data-block-id={blockId}
            onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); onShowSettings(); }}
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
            className={styles.controlButton}
            title="Settings & Layout"
            aria-controls="editor-settings-panel"
        >
            <Icons.Settings w={16} h={16} />
        </button>
        <button
            type="button"
            id={`block-${blockId}-delete`}
            data-block-id={blockId}
            onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(); }}
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
            className={`${styles.controlButton} ${styles.deleteButton}`}
            title="Delete Block"
        >
            <Icons.Trash w={16} h={16} />
        </button>
    </div>
);

/**
 * The "+" button and menu to add a new block.
 */
const AddBlockButton = ({ onAdd, isFirst = false }) => {
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target) && !e.target.closest(`.${styles.addBlockButton}`)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const blockTypes = [
        { type: 'heading', label: 'Heading', icon: <Icons.Heading/> },
        { type: 'text', label: 'Text', icon: <Icons.Text/> },
        { type: 'image', label: 'Image', icon: <Icons.Image/> },
        { type: 'audio', label: 'Audio', icon: <Icons.Audio/> },
        { type: 'video', label: 'Video', icon: <Icons.Video/> },
        { type: 'button', label: 'Button', icon: <Icons.Button/> },
        { type: 'columns', label: 'Columns', icon: <Icons.Columns/> },
        { type: 'accordion', label: 'Accordion', icon: <Icons.Accordion/> }
    ];

    const handleAdd = (type, e) => {
        if (e) e.stopPropagation();
        onAdd(type);
        setIsOpen(false);
    }

    return (
        <div className={`${styles.addBlockWrapper} ${isFirst ? styles.addBlockWrapperFirst : ''} ${isOpen ? styles.addBlockWrapperOpen : ''}`}>
            <div className={styles.addBlockLine}></div>
            <div className={styles.addBlockButtonContainer}>
                <button type="button" onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }} className={styles.addBlockButton} aria-label="Add new block" aria-haspopup="true" aria-expanded={isOpen}>
                    <Icons.Plus />
                </button>
            </div>
            {isOpen && (
                <div className={styles.addBlockMenu} ref={menuRef} role="menu">
                    {blockTypes.map(b => (
                        <button
                          type="button"
                          key={b.type}
                          onClick={(e) => handleAdd(b.type, e)}
                          className={styles.addBlockMenuItem}
                          role="menuitem"
                        >
                            {b.icon}<span>{b.label}</span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

// --- RENDERER & COMPLEX BLOCKS ---
// (Part 4 will start here)


// ... (Part 3 code - AddBlockButton - ends here)

// --- RENDERER & COMPLEX BLOCKS ---

/**
 * Block: Columns
 * Renders nested BlockRenderers inside a responsive grid.
 */
const ColumnsBlock = ({ id, children, layout, styles: blockStyles, isEditing, onUpdateBlock, onDeleteBlock, onAddBlock, onMoveBlock, openImagePickerFor, openAudioPickerFor, openVideoPickerFor, onShowSettings, onReorderColumn, onSelectLayer, onExecCommand, onSetSelectedLayer, selectedLayer }) => {
    const [draggedItem, setDraggedItem] = useState(null);
    const [dropTarget, setDropTarget] = useState(null);
    const [dragEnabled, setDragEnabled] = useState(false);

    const responsiveStyles = useMemo(() => {
        if (!layout || !layout.ratios) return blockStyles || {};
        const style = { ...blockStyles };
        for (const bp of BREAKPOINTS) {
            const vals = normalizeRatios(layout.ratios[bp], layout.columns);
            if (vals && vals.length) {
                style[`--cols-${bp}`] = vals.map(r => `${r}fr`).join(' ');
            }
        }
        style['--cols-count'] = String(layout.columns);
        return style;
    }, [layout, blockStyles]);

    const handleDragStart = (e, index) => {
        if (!dragEnabled) { e.preventDefault(); return; }
        setDraggedItem({ blockId: id, fromIndex: index });
        e.dataTransfer.effectAllowed = 'move';
        e.currentTarget.classList.add(styles.columnDragging);
    };
    const handleDragOver = (e, index) => {
        e.preventDefault();
        if (draggedItem && draggedItem.fromIndex !== index) {
            setDropTarget(index);
        }
    };
    const handleDragLeave = () => setDropTarget(null);
    const handleDrop = (e, toIndex) => {
        e.preventDefault();
        if (draggedItem) {
            onReorderColumn(draggedItem.blockId, draggedItem.fromIndex, toIndex);
        }
        resetDragState(e.currentTarget);
    };
    const handleDragEnd = (e) => resetDragState(e.currentTarget);
    const resetDragState = (element) => {
        if (element) element.classList.remove(styles.columnDragging);
        setDraggedItem(null);
        setDropTarget(null);
    };
    const handleKeyDown = (e, index) => {
        if (!e.altKey) return;
        if (e.key === 'ArrowLeft' && index > 0) {
            e.preventDefault(); onReorderColumn(id, index, index - 1);
        }
        if (e.key === 'ArrowRight' && index < (children || []).length - 1) {
            e.preventDefault(); onReorderColumn(id, index, index + 1);
        }
    };

    return (
        <div
          style={responsiveStyles}
          className={`${styles.columnsContainer} columnsContainer`}
        >
            {(children || []).map((column, colIndex) => (
                <div
                    key={colIndex}
                    className={`${styles.column} column ${dropTarget === colIndex ? styles.dropIndicator : ''}`}
                    data-layer-type="Column"
                    data-layer-label={`Column ${colIndex + 1}`}
                    data-layer-id={`${id}::col${colIndex}`} // Unique ID for the column layer
                    onClick={(e) => {
                        if (!isEditing) return;
                        // Only select the column when clicking empty space of the column itself
                        if (e.target !== e.currentTarget) return;
                        e.stopPropagation();
                        onSelectLayer(e.currentTarget);
                    }}
                    draggable={isEditing && dragEnabled}
                    onDragStart={(e) => handleDragStart(e, colIndex)}
                    onDragOver={(e) => handleDragOver(e, colIndex)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, colIndex)}
                    onDragEnd={handleDragEnd}
                    onMouseDown={(e) => setDragEnabled(e.altKey)}
                    onMouseUp={() => setDragEnabled(false)}
                    onMouseLeave={() => setDragEnabled(false)}
                    onKeyDown={(e) => handleKeyDown(e, colIndex)}
                    tabIndex={isEditing ? 0 : -1}
                    aria-label={ isEditing ? `Column ${colIndex + 1}. Hold Alt and drag or use Alt+Arrows to reorder.` : undefined }
                >
                    <BlockRenderer
                        blocks={column}
                        isEditing={isEditing}
                        onUpdateBlock={onUpdateBlock}
                        onDeleteBlock={onDeleteBlock}
                        onAddBlock={onAddBlock}
                        onMoveBlock={onMoveBlock}
                        openImagePickerFor={openImagePickerFor}
                        openAudioPickerFor={openAudioPickerFor}
                        openVideoPickerFor={openVideoPickerFor}
                        onShowSettings={onShowSettings}
                        onReorderColumn={onReorderColumn}
                        onSelectLayer={onSelectLayer}
                        onExecCommand={onExecCommand}
                        onSetSelectedLayer={onSetSelectedLayer}
                        selectedLayer={selectedLayer}
                        parentId={id} // The ID of this ColumnsBlock
                        parentIndex={colIndex} // The index of this column
                    />
                </div>
            ))}
        </div>
    );
};

/**
 * Block: Accordion
 * Renders a list of collapsible items, each containing a nested BlockRenderer.
 */
const AccordionBlock = ({ id, items = [], options = {}, styles: blockStyles, isEditing, onUpdateBlock, onDeleteBlock, onAddBlock, onMoveBlock, onShowSettings, onSelectLayer, onExecCommand, onSetSelectedLayer, selectedLayer, openImagePickerFor, openAudioPickerFor, openVideoPickerFor }) => {

    const addItem = () => {
        const newItem = { id: uid(), title: `Section ${items.length + 1}`, blocks: [] };
        onUpdateBlock(id, { items: [...items, newItem] });
    };
    const deleteItem = (itemId) => {
        onUpdateBlock(id, { items: items.filter(i => i.id !== itemId) });
    };
    const updateItemTitle = (itemId, title) => {
        onUpdateBlock(id, { items: items.map(i => i.id === itemId ? { ...i, title } : i) });
    };

    return (
        <div className={styles.accordion} style={blockStyles}>
        {items.map((it, idx) => (
            <div
              key={it.id}
              className={`${styles.accItem} accItem`}
              data-layer-type="Accordion Item"
              data-layer-label={it.title || `Item ${idx + 1}`}
              data-layer-id={it.id}
              onClick={(e) => {
                if (!isEditing) return;
                // Only select the item when clicking its own container space
                if (e.target !== e.currentTarget) return;
                e.stopPropagation();
                onSelectLayer(e.currentTarget);
              }}
            >
            <div className={styles.accHeader}>
                {isEditing ? (
                <input
                    name="accordionTitle"
                    className={styles.accTitleInput}
                    value={it.title || ''}
                    onChange={(e)=>updateItemTitle(it.id, e.target.value)}
                    placeholder="Section title"
                    onClick={e=>e.stopPropagation()}
                    aria-label="Accordion section title"
                />
                ) : (
                    <div className={styles.accTitle} style={{ textAlign: options?.titleAlign || 'left', fontSize: options?.titleSize==='sm' ? '0.95rem' : options?.titleSize==='lg' ? '1.15rem' : '1.05rem' }}>
                        {it.title || 'Untitled'}
                    </div>
                )}
                {isEditing && (
                <div className={styles.accHeaderBtns} onMouseDown={(e)=>{ e.preventDefault(); e.stopPropagation(); }} onClick={(e)=> e.stopPropagation()}>
                    <button
                        type="button"
                        className={styles.controlButton}
                        onMouseDown={(e)=>{ e.preventDefault(); e.stopPropagation(); onShowSettings(id); }}
                        onClick={(e)=>{ e.preventDefault(); e.stopPropagation(); }}
                        title="Accordion settings"
                    >
                        <Icons.Settings w={16} h={16} />
                    </button>
                    <button
                        type="button"
                        className={styles.controlButton}
                        onMouseDown={(e)=>{ e.preventDefault(); e.stopPropagation(); deleteItem(it.id); }}
                        onClick={(e)=>{ e.preventDefault(); e.stopPropagation(); }}
                        title="Delete section"
                    >
                        <Icons.Trash w={16} h={16} />
                    </button>
                </div>
                )}
            </div>
            <div
              className={`${styles.accPanel} accPanel`}
              data-layer-type="Accordion Panel"
              data-layer-label="Panel"
              data-layer-id={`${it.id}::panel`}
              onClick={(e) => {
                if (!isEditing) return;
                if (e.target !== e.currentTarget) return;
                e.stopPropagation();
                onSelectLayer(e.currentTarget);
              }}
            >
              <div className={styles.accPanelInner}>
                <BlockRenderer
                    blocks={it.blocks}
                    isEditing={isEditing}
                    onUpdateBlock={onUpdateBlock}
                    onDeleteBlock={onDeleteBlock}
                    onAddBlock={onAddBlock}
                    onMoveBlock={onMoveBlock}
                    onShowSettings={onShowSettings}
                    onExecCommand={onExecCommand}
                    onSelectLayer={onSelectLayer}
                    onSetSelectedLayer={onSetSelectedLayer}
                    selectedLayer={selectedLayer}
                    openImagePickerFor={openImagePickerFor}
                    openAudioPickerFor={openAudioPickerFor}
                    openVideoPickerFor={openVideoPickerFor}
                    parentId={it.id} // The ID of this AccordionItem
                    parentIndex={null} // Accordion items only have one block list, no index needed
                />
              </div>
            </div>
            </div>
        ))}
        {isEditing && (
            <button type="button" className={`${styles.btn} ${styles.btn_secondary} ${styles.btnSize_sm} ${styles.accAddButton}`} onClick={addItem}>
                <Icons.Plus w={16} h={16} /> Add Section
            </button>
        )}
        </div>
    );
};

// Add complex blocks to the map
blockMap.columns = ColumnsBlock;
blockMap.accordion = AccordionBlock;

/**
 * The core recursive rendering component.
 * Renders a list of blocks and handles all interactions.
 */
const BlockRenderer = ({
    blocks = [],
    isEditing,
    onUpdateBlock,
    onDeleteBlock,
    onAddBlock,
    onMoveBlock,
    openImagePickerFor = () => {},
    openAudioPickerFor = () => {},
    openVideoPickerFor = () => {},
    onShowSettings,
    onReorderColumn,
    onExecCommand,
    onSelectLayer,
    onSetSelectedLayer,
    selectedLayer,
    parentId = null,
    parentIndex = null,
}) => (
    <div className={styles.blockRendererRoot}>
        {blocks.map((block, index) => {
            if (!block) return null; // Safety check
            const Component = blockMap[block.type];
            if (!Component) return <div key={block.id || index}>Unknown block type: {block.type}</div>;
            
            const hasContent = (
                block.type === 'columns' || block.type === 'accordion' ||
                (block.data && (
                    (block.type === 'image' || block.type === 'audio' || block.type === 'video')
                    ? !!block.data.src
                    : (typeof block.data.text !== 'undefined' && block.data.text !== '')
                ))
            );
            
            // Check if the *block's layer* is selected
            const isSelected = isEditing && selectedLayer?.id === block.id;
            
            // Show toolbar if selected and it's a text or heading block
            const showTextToolbar = isSelected && (block.type === 'text' || block.type === 'heading');

            return (
                <div
                  key={block.id}
                  className={styles.blockContainer}
                  data-block-id={block.id} // Used for DOM lookups
                  data-block-type={block.type}
                >
                    <div
                        className={`${styles.blockWrapper} blockWrapper ${!hasContent && isEditing ? styles.blockWrapperEmpty : ''}`}
                        data-layer-type={block.type.charAt(0).toUpperCase() + block.type.slice(1)}
                        data-layer-label={block.data?.text?.substring(0, 20) || block.data?.src || block.type}
                        data-layer-id={block.id} // This is the ID for the layer itself
                        onClick={(e) => {
                            if (isEditing) {
                                e.stopPropagation();
                                onSelectLayer(e.currentTarget);
                            }
                        }}
                    >
                        {showTextToolbar && (
                            <div onMouseDown={(e)=>e.stopPropagation()} onClick={(e)=>e.stopPropagation()}>
                                <TextToolbar onExecCommand={onExecCommand(block.id)} />
                            </div>
                        )}

                        {isEditing && (
                            <div onMouseDown={(e)=>e.stopPropagation()} onClick={(e)=>e.stopPropagation()}>
                                <BlockControls 
                                    blockId={block.id}
                                    onMoveUp={() => onMoveBlock(block.id, index, -1, parentId, parentIndex)}
                                    onMoveDown={() => onMoveBlock(block.id, index, 1, parentId, parentIndex)}
                                    onDuplicate={() => onAddBlock(block.type, index + 1, parentId, parentIndex, block)}
                                    onShowSettings={() => onShowSettings(block.id)}
                                    onDelete={() => onDeleteBlock(block.id)}
                                    isFirst={index === 0}
                                    isLast={index === blocks.length - 1}
                                />
                            </div>
                        )}
                        <Component
                            {...block}
                            isEditing={isEditing}
                            onUpdate={(newData) => {
                                const updatedData = (typeof newData === 'object')
                                  ? newData
                                  : { text: newData };
                                onUpdateBlock(block.id, {
                                  data: { ...(block.data || {}), ...updatedData }
                                });
                            }}
                            openImagePicker={() => openImagePickerFor(block.id)}
                            openAudioPicker={() => openAudioPickerFor(block.id)}
                            openVideoPicker={() => openVideoPickerFor(block.id)}
                            onSelectLayer={onSelectLayer}
                            // Pass down all props for nested renderers
                            onUpdateBlock={onUpdateBlock}
                            onDeleteBlock={onDeleteBlock}
                            onAddBlock={onAddBlock}
                            onMoveBlock={onMoveBlock}
                            onShowSettings={onShowSettings}
                            onExecCommand={onExecCommand}
                            onReorderColumn={onReorderColumn}
                            onSetSelectedLayer={onSetSelectedLayer}
                            selectedLayer={selectedLayer}
                            openImagePickerFor={openImagePickerFor}
                            openAudioPickerFor={openAudioPickerFor}
                            openVideoPickerFor={openVideoPickerFor}
                            parentId={parentId}
                            parentIndex={parentIndex}
                        />
                    </div>
                    {isEditing && (
                        <AddBlockButton onAdd={(type) => onAddBlock(type, index + 1, parentId, parentIndex)} />
                    )}
                </div>
            );
        })}
        {isEditing && blocks.length === 0 && (
            <div className={styles.emptyEditorState}>
                <AddBlockButton onAdd={(type) => onAddBlock(type, 0, parentId, parentIndex)} isFirst={true} />
            </div>
        )}
    </div>
);


// --- UI PANELS ---
// (Part 5 will start here)

// ... (Part 4 code - BlockRenderer - ends here)

// --- UI PANELS ---

/**
 * A reusable, animated panel for showing settings.
 * It detects clicks outside to close itself.
 * * --- THIS IS THE MODIFIED COMPONENT ---
 * It now renders as a pop-up modal, not a sidebar.
 */
const SettingsPanel = ({ title, children, onClose }) => {
    const panelRef = useRef();

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (panelRef.current && !panelRef.current.contains(event.target)) {
                onClose();
            }
        };
        // Use mousedown to catch click before it bubbles up
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [onClose]);

    return (
        <div className={styles.settingsPanelWrapper} role="dialog" aria-modal="true">
            <div className={`${styles.settingsPanel} modal-scroll-content`} id="editor-settings-panel" ref={panelRef}>
                {/* We use the simple close button, positioned by new CSS */}
                <button onClick={onClose} className={styles.settingsCloseButton} aria-label="Close settings">
                    {/* We use the new icon, but the CSS will position it like the old 'x' */}
                    <Icons.Close w={20} h={20} />
                </button>
                
                {/* We render the title and children directly, without header/body divs */}
                <h4 style={{ marginTop: 0, marginBottom: '1.5rem' }}>{title}</h4>
                
                {children}
            </div>
        </div>
    );
};


/**
 * A reusable form control for color pickers with text input.
 */
const ColorControl = ({ label, value, onChange }) => {
    const [textValue, setTextValue] = useState(value || '');

    useEffect(() => {
        setTextValue(value || '');
    }, [value]);

    const handleColorInputChange = (e) => {
        const newValue = e.target.value;
        setTextValue(newValue);
        onChange(newValue);
    };

    const handleColorTextChange = (e) => {
        const newValue = e.target.value;
        setTextValue(newValue);
        // Basic validation for hex color (or empty string to reset)
        if (/^#[0-9A-F]{6}$/i.test(newValue) || /^#[0-9A-F]{3}$/i.test(newValue) || newValue === '') {
            onChange(newValue);
        }
    };

    const safeLabel = String(label || 'color').trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9_\-:.]/g, '');
    const inputId = `color-${safeLabel}`;
    return (
        <div className={`${styles.styleControl} ${styles.colorControl}`}>
            <label htmlFor={inputId}>{label}</label>
            <div className={styles.colorInputWrapper}>
                <div className={styles.colorPreview} style={{ backgroundColor: value || '#ffffff' }}>
                    <Icons.Palette w={16} h={16} />
                    <input
                        id={inputId}
                        name={inputId}
                        type="color"
                        value={value || '#ffffff'}
                        onChange={handleColorInputChange}
                        className={styles.colorPickerInput}
                    />
                </div>
                <input
                    type="text"
                    name={`${inputId}-hex`}
                    value={textValue}
                    onChange={handleColorTextChange}
                    className={styles.colorTextInput}
                    placeholder="#ffffff"
                    aria-label={`${label} hex value`}
                />
            </div>
        </div>
    );
}

/**
 * Input for custom column ratio strings (e.g., "30 70").
 */
const CustomRatioInput = ({ ratios, columnCount, onChange }) => {
    const [inputValue, setInputValue] = useState(ratios.join(' '));
    const [error, setError] = useState('');

    useEffect(() => {
        setInputValue(ratios.join(' '));
        setError('');
    }, [ratios, columnCount]);

    const handleInputChange = (e) => {
        const value = e.target.value;
        setInputValue(value);
        if (value.trim() === '') {
            setError('');
            onChange([]);
            return;
        }
        const parts = value.trim().split(/\s+/);
        const numbers = parts.map(s => parseFloat(s));
        if (parts.some(s => isNaN(parseFloat(s)) || parseFloat(s) <= 0)) {
            setError('Use positive numbers only.');
            return;
        }
        if (numbers.length !== columnCount && numbers.length !== 1) {
            setError(`Provide 1 value for stacking or ${columnCount} values.`);
            return;
        }
        setError('');
        onChange(numbers);
    };

    return (
        <div>
            <input
                type="text"
                name="customRatios"
                value={inputValue}
                onChange={handleInputChange}
                placeholder="e.g. 30 70 or 100 for stack"
                className={`${styles.csCustomInput} ${error ? styles.inputError : ''}`}
                aria-label="Custom column ratios"
            />
            {error && <p className={styles.csValidationError}>{error}</p>}
        </div>
    );
};

/**
 * Specific settings panel for the Columns block.
 */
const ColumnSettings = ({ block, onUpdateLayout }) => {
    const [localLayout, setLocalLayout] = useState(() => {
        const currentLayout = block.layout;
        const columns = currentLayout?.columns || 2;
        const ratios = currentLayout?.ratios || getInitialRatios();
        return { columns, ratios };
    });
    const BREAKPOINT_MAP = { base: 'Mobile (<640px)', sm: 'Tablet (640px+)', md: 'Laptop (768px+)', lg: 'Desktop (1024px+)' };

    useEffect(() => {
        const currentLayout = block.layout;
        const columns = currentLayout?.columns || 2;
        const ratios = currentLayout?.ratios || getInitialRatios();
        if (JSON.stringify({ columns, ratios }) !== JSON.stringify(localLayout)) {
            setLocalLayout({ columns, ratios });
        }
    }, [block.layout]);

    const handleColumnCountChange = (newCount) => {
        const defaultPreset = COLUMN_PRESETS[newCount]?.[0] || Array(newCount).fill(100 / newCount);
        let newRatios;
        if (newCount === 1) {
            newRatios = { base: [100], sm: [100], md: [100], lg: [100] };
        } else {
            newRatios = {
                base: [100], // Default stack on mobile
                sm: [...defaultPreset],
                md: [...defaultPreset],
                lg: [...defaultPreset]
            };
        }
        const newLayout = { ...localLayout, columns: newCount, ratios: newRatios };
        setLocalLayout(newLayout);
        onUpdateLayout(block.id, newLayout);
    };

    const handleLayoutChangeForBreakpoint = (breakpoint, newRatiosArray) => {
        if (!Array.isArray(newRatiosArray) || newRatiosArray.length === 0) return;
        const normalized = normalizeRatios(newRatiosArray, localLayout.columns);
        if (!Array.isArray(normalized) || normalized.length === 0) return;

        const newRatios = { ...(localLayout.ratios || {}), [breakpoint]: normalized };
        const newLayout = { ...localLayout, ratios: newRatios };
        setLocalLayout(newLayout);
        onUpdateLayout(block.id, newLayout);
    };

    return (
        <div className={styles.columnSettings}>
            <div className={styles.csGroup} role="group" aria-labelledby={`cols-label-${block.id}`}>
                <span id={`cols-label-${block.id}`} className={styles.csGroupLabel}>Number of Columns</span>
                <div className={styles.csBtnGroup}>
                    {[1, 2, 3, 4].map(num => (
                        <button key={num} type="button" onClick={() => handleColumnCountChange(num)} className={localLayout.columns === num ? styles.active : ''}>{num}</button>
                    ))}
                </div>
            </div>
            <hr className={styles.csSeparator} />
            {BREAKPOINTS.map(bp => (
                <div key={bp} className={styles.csGroup} role="group" aria-labelledby={`bp-${bp}-label-${block.id}`}>
                    <span id={`bp-${bp}-label-${block.id}`} className={styles.csGroupLabel}>{BREAKPOINT_MAP[bp]}</span>
                    {localLayout.columns > 1 && bp !== 'base' && (
                        <div className={styles.csPresets}>
                            {(COLUMN_PRESETS[localLayout.columns] || []).map((preset, i) => (
                                <button
                                    key={i}
                                    type="button"
                                    className={`${styles.csPresetButton} ${JSON.stringify(preset) === JSON.stringify(localLayout.ratios?.[bp]) ? styles.active : ''}`}
                                    onClick={() => handleLayoutChangeForBreakpoint(bp, preset)}
                                >
                                    {preset.join(' / ')}
                                </button>
                            ))}
                        </div>
                    )}
                    <CustomRatioInput
                        ratios={localLayout.ratios?.[bp] || (bp === 'base' || localLayout.columns === 1 ? [100] : [])}
                        columnCount={localLayout.columns}
                        onChange={(newRatios) => handleLayoutChangeForBreakpoint(bp, newRatios)}
                    />
                </div>
            ))}
        </div>
    );
};

/**
 * The "Photoshop-style" layer outline panel.
 */
const LayerOutline = ({ editorRoot, selectedLayer, onSelectLayer }) => {
    const [items, setItems] = useState([]);

    useEffect(() => {
        if (!editorRoot) return;
        const newItems = [];
        const walk = (el, depth = 0) => {
            // Only capture elements we've marked as layers
            const layerType = el.dataset?.layerType;
            if (layerType) {
                let label = el.dataset?.layerLabel || layerType;
                if (layerType === 'Block' && el.dataset?.blockType) {
                    label = el.dataset.blockType.charAt(0).toUpperCase() + el.dataset.blockType.slice(1);
                } else if (layerType === 'Column') {
                    label = `Column ${parseInt(el.dataset.layerId.split('::col')[1], 10) + 1}`;
                } else if (layerType === 'Accordion Item') {
                    label = el.querySelector(`.${styles.accTitleInput}`)?.value || el.dataset?.layerLabel || 'Accordion Item';
                }

                // Skip showing "Accordion Panel" in the outline - just show its contents
                if (layerType !== 'Accordion Panel') {
                    newItems.push({
                        id: el.dataset.layerId,
                        el: el,
                        label: label,
                        type: layerType,
                        depth,
                        active: selectedLayer?.id === el.dataset.layerId,
                    });
                }
            }
            
            // Recurse into child elements
            if (layerType === 'Column' || layerType === 'Accordion Panel' || layerType === 'Renderer') {
                // For containers, look for the blockRendererRoot and walk its children
                // Note: In Accordion Panel the renderer is wrapped in an extra inner div,
                // so we must search any descendant instead of only direct children.
                const blockRenderer = (layerType === 'Accordion Panel')
                    ? el.querySelector(`.${styles.blockRendererRoot}`)
                    : el.querySelector(`:scope > .${styles.blockRendererRoot}`);
                if (blockRenderer) {
                    // If it's an Accordion Panel, don't increase depth (since we're skipping it in the outline)
                    const nextDepth = layerType === 'Accordion Panel' ? depth : depth + 1;
                    
                    Array.from(blockRenderer.children || []).forEach(child => {
                        // Each child is a blockContainer, walk into the blockWrapper
                        const blockWrapper = child.querySelector(`.${styles.blockWrapper}`);
                        if (blockWrapper) {
                            walk(blockWrapper, nextDepth);
                        }
                    });
                }
            } else {
                // For regular blocks, recurse into direct children
                Array.from(el.children || []).forEach(child => {
                    walk(child, depth + 1);
                });
            }
        };
        
        walk(editorRoot, 0);
        setItems(newItems);
    }, [editorRoot, selectedLayer]); // Re-scan on selection change to update active state

    return (
        <div className={styles.outlinePanel} role="tree">
            {items.map((it) => (
                <div
                    key={it.id}
                    className={styles.outlineItem}
                    data-active={it.active ? 'true' : 'false'}
                    onClick={(e) => { e.stopPropagation(); onSelectLayer(it.el); }}
                    role="treeitem"
                    aria-selected={it.active}
                    tabIndex={0}
                    onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && onSelectLayer(it.el)}
                >
                    {Array.from({ length: it.depth }).map((_, k) => (
                        <span className={styles.outlineIndent} key={k} />
                    ))}
                    <span className={styles.outlineIcon}>
                        {it.type === 'Renderer' && <Icons.Layout w={14} h={14} />}
                        {it.type === 'Columns' && <Icons.Columns w={14} h={14} />}
                        {it.type === 'Column' && <Icons.Column w={14} h={14} />}
                        {it.type === 'Accordion' && <Icons.Accordion w={14} h={14} />}
                        {it.type === 'Accordion Item' && <Icons.Panel w={14} h={14} />}
                        {it.type === 'Accordion Panel' && <Icons.Panel w={14} h={14} />}
                        {it.type === 'Heading' && <Icons.Heading w={14} h={14} />}
                        {it.type === 'Text' && <Icons.Text w={14} h={14} />}
                        {it.type === 'Image' && <Icons.Image w={14} h={14} />}
                        {it.type === 'Video' && <Icons.Video w={14} h={14} />}
                        {it.type === 'Audio' && <Icons.Audio w={14} h={14} />}
                        {it.type === 'Button' && <Icons.Button w={14} h={14} />}
                    </span>
                    <span className={styles.outlineLabel}>{it.label}</span>
                </div>
            ))}
        </div>
    );
}

// --- EDITOR ROOT COMPONENT ---
const LessonEditor = forwardRef(({ initialContent = '', mediaCategory = 'general', externalCss = '', onEditorReady }, ref) => {
    const rendererRef = useRef(null); // Ref to the .renderer element
    const imageUploadInputRef = useRef(null);
    const audioUploadInputRef = useRef(null);
    const videoUploadInputRef = useRef(null);
    const editorId = useMemo(() => `zporta-editor-${uid().slice(0, 8)}`, []);
    const themeStyleId = useMemo(() => `${editorId}-theme`, [editorId]);

    const [blocks, setBlocks] = useState([]);
    const [view, setView] = useState('editor');
    const [codeText, setCodeText] = useState('');
    const [codeImportEnabled, setCodeImportEnabled] = useState(false);
    const [codeError, setCodeError] = useState('');
    const [isMounted, setIsMounted] = useState(false);
    const [uploadError, setUploadError] = useState('');
    const [appliedCss, setAppliedCss] = useState('');
    const [previewDevice, setPreviewDevice] = useState('desktop');
    
    // UI State
    const [isOutlineOpen, setIsOutlineOpen] = useState(true); // Default open on desktop
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    
    const [editingBlockId, setEditingBlockId] = useState(null); // The *ID* of the block being edited

    // On mount: collapse the sidebar by default on small screens (mobile)
    useEffect(() => {
        if (typeof window === 'undefined') return;
        if (window.innerWidth < 768) {
            setIsOutlineOpen(false);
        }
    }, []);
    
    // Lock body scroll when any modal/popup is open (using global scroll lock system)
    useBodyScrollLock(isSettingsOpen || !!editingBlockId);
    
    const editorRootRef = useRef(null);
    // Layer & Selection State
    const [selectedLayer, setSelectedLayer] = useState(null); // { id: string, el: HTMLElement, type: string }
    
    const [isCodeDirty, setIsCodeDirty] = useState(false);
    
    // --- Canvas click: "deepest block wins" ---
    const handleCanvasMouseDown = useCallback((e) => {
        const t = e.target;

        // 1) Ignore clicks coming from editor UI chrome (controls/toolbars/menus)
        if (
            t.closest(`.${styles.blockControls}`) ||
            t.closest(`.${styles.textToolbar}`) ||
            t.closest(`.${styles.addBlockMenu}`)
        ) {
            return;
        }

        // 2) Ignore while actively editing a contentEditable element (prevent losing caret)
        if (t.isContentEditable && (document.activeElement === t || t.closest('[contenteditable="true"]'))) {
            return; // Let the user edit text
        }

        // 3) Otherwise select the closest layer host
        const host = t.closest('[data-layer-id]');
        if (host) {
            // Only stopPropagation if we're NOT inside a contentEditable element
            if (!t.closest('[contenteditable="true"]')) {
                e.stopPropagation();
            }
            handleSelectLayer(host);
        }
        // If no host is found, let the event bubble (root selection will apply)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ------------------------------------------------------------
    const codeDebounceRef = useRef(null);
    const isProcessingBlur = useRef(false);

    // --- Effects ---

    useEffect(() => {
        setIsMounted(true);
        setBlocks(htmlToBlocks(initialContent)); // Initialize blocks here after mount
        const themeEl = document.createElement('style');
        themeEl.id = themeStyleId;
        document.head.appendChild(themeEl);
        
        // Select the root renderer on mount
        if (rendererRef.current) {
            handleSelectLayer(rendererRef.current);
        }

        return () => { try { themeEl.remove(); } catch {} };
    }, [themeStyleId]); // Only run on mount/unmount

    useEffect(() => {
        if (isMounted) {
             setBlocks(htmlToBlocks(initialContent));
        }
    }, [initialContent, isMounted]);


    useEffect(() => {
        if (onEditorReady && typeof onEditorReady === 'function') {
            Promise.resolve().then(onEditorReady);
        }
    }, [onEditorReady]);

    const applyCssToEditor = useCallback((rawCss = '') => {
        const target = document.getElementById(themeStyleId);
        if (target) {
            target.textContent = prefixCss(`#${editorId}`, rawCss);
        }
        setAppliedCss(rawCss);
    }, [editorId, themeStyleId]);

    useEffect(() => {
        if(isMounted && externalCss !== appliedCss) {
            applyCssToEditor(externalCss || '');
        }
    }, [externalCss, isMounted, appliedCss, applyCssToEditor]);

    // --- Content Generation ---

    const generateFinalHtml = useCallback((blocksArg) => {
        const STRUCTURAL_CSS = `
.${WRAPPER_CLASS} .zporta-columns{display:grid !important; gap:var(--space-6, 1.5rem); grid-template-columns: var(--cols-base, 1fr) !important; align-items:start;}
.${WRAPPER_CLASS} .zporta-column{min-width:0;}
.${WRAPPER_CLASS} .zporta-column>*{word-break:break-word;max-width:100%}
.${WRAPPER_CLASS} .zporta-column img,.${WRAPPER_CLASS} .zporta-column video,.${WRAPPER_CLASS} .zporta-column iframe{max-width:100%;height:auto;display:block}
.${WRAPPER_CLASS} .zporta-button{display:inline-flex;align-items:center;justify-content:center;font-weight:600;text-decoration:none;border:1px solid transparent;padding:.6rem 1.1rem;border-radius:var(--r-md);transition:filter .15s}
.${WRAPPER_CLASS} .zporta-button:hover{filter:brightness(.95)}
.${WRAPPER_CLASS} .zporta-btn--block{display:flex;width:100%;text-align:center}
.${WRAPPER_CLASS} .zporta-btnSize--sm{padding:.4rem .85rem;font-size:.9rem}
.${WRAPPER_CLASS} .zporta-btnSize--md{padding:.6rem 1.1rem;font-size:1rem}
.${WRAPPER_CLASS} .zporta-btnSize--lg{padding:.8rem 1.3rem;font-size:1.1rem}
.${WRAPPER_CLASS} .zporta-btn--primary{background:var(--zporta-dark-blue,#0A2342);color:#fff;border-color:var(--zporta-dark-blue,#0A2342)}
.${WRAPPER_CLASS} .zporta-btn--secondary{background:#fff;color:var(--zporta-dark-blue,#0A2342);border-color:var(--zporta-dark-blue,#0A2342)}
.${WRAPPER_CLASS} .zporta-btn--ghost{background:transparent;color:var(--zporta-dark-blue,#0A2342);border-color:var(--zporta-border-color,#e2e8f0)}
.${WRAPPER_CLASS} .zporta-btn--link{background:transparent;color:var(--zporta-dark-blue,#0A2342);border:0;padding:0;text-decoration:underline}
.${WRAPPER_CLASS} .zporta-accordion{width:100%}
.${WRAPPER_CLASS} .zporta-acc-item{border:1px solid var(--zporta-border-color,#e2e8f0);border-radius:var(--acc-radius,8px);margin:0 0 12px 0;overflow:hidden;background:var(--zporta-background-light,#fff)}
.${WRAPPER_CLASS} .zporta-acc-title{cursor:pointer;display:block;padding:.75rem 1rem;background:var(--zporta-background-medium,#f8fafc);font-weight:600;position:relative;padding-right:3rem;list-style:none}
.${WRAPPER_CLASS} .zporta-acc-title::-webkit-details-marker{display:none}
.${WRAPPER_CLASS} .zporta-acc-title[data-align="center"]{text-align:center}
.${WRAPPER_CLASS} .zporta-acc-title[data-align="right"]{text-align:right}
.${WRAPPER_CLASS} .zporta-acc-title[data-size="sm"]{font-size:.9rem}
.${WRAPPER_CLASS} .zporta-acc-title[data-size="md"]{font-size:1rem}
.${WRAPPER_CLASS} .zporta-acc-title[data-size="lg"]{font-size:1.1rem}
.${WRAPPER_CLASS} .zporta-acc-title::after{content:'';position:absolute;right:1rem;top:50%;width:.6em;height:.6em;transform:translateY(-50%) rotate(45deg);border-right:2px solid currentColor;border-bottom:2px solid currentColor;transition:transform .2s ease}
.${WRAPPER_CLASS} details[open] > .zporta-acc-title::after{transform:translateY(-50%) rotate(225deg)}
.${WRAPPER_CLASS} .zporta-acc-title[data-icon="plus"]::after{content:'+';border:0;font-weight:700;font-size:1.5em;transform:translateY(-50%);transition:transform .2s ease}
.${WRAPPER_CLASS} details[open] > .zporta-acc-title[data-icon="plus"]::after{transform:translateY(-50%) rotate(45deg)}
.${WRAPPER_CLASS} .zporta-acc-title[data-icon="none"]::after{display:none}
.${WRAPPER_CLASS} .zporta-acc--outline .zporta-acc-item{border-style:dashed}
.${WRAPPER_CLASS} .zporta-acc--dark .zporta-acc-item{background:#0f172a;border-color:#1f2a44}
.${WRAPPER_CLASS} .zporta-acc--dark .zporta-acc-title{background:#0b1220;color:#e2e8f0}
.${WRAPPER_CLASS} .zporta-acc--dark .zporta-acc-panel{background:#0f172a;color:#cbd5e1}
.${WRAPPER_CLASS} .zporta-acc-panel{padding:1rem;border-top:1px solid var(--zporta-border-color,#e2e8f0)}
@media (min-width:640px){.${WRAPPER_CLASS} .zporta-columns{grid-template-columns: var(--cols-sm, var(--cols-base, 1fr)) !important;}}
@media (min-width:768px){.${WRAPPER_CLASS} .zporta-columns{grid-template-columns: var(--cols-md, var(--cols-sm, var(--cols-base, 1fr))) !important;}}
@media (min-width:1024px){.${WRAPPER_CLASS} .zporta-columns{grid-template-columns: var(--cols-lg, var(--cols-md, var(--cols-sm, var(--cols-base, 1fr)))) !important;}}`;
        
        const html = blocksToHtml(blocksArg || []);
        
        // Format HTML with proper indentation and line breaks for better copy/paste
        const formattedHtml = html
            .replace(/></g, '>\n<')  // Add line breaks between tags
            .replace(/\n\s*\n/g, '\n');  // Remove multiple consecutive newlines
        
        const finalHtml = `<div class="${WRAPPER_CLASS}">\n${formattedHtml}\n</div>`;
        const oneStyle = `<style>${STRUCTURAL_CSS}</style>`;
        return `${oneStyle}\n\n${finalHtml}`;
    }, []);

    // --- Imperative Handle (API) ---

    useImperativeHandle(ref, () => ({
        async flush() {
            const root = editorRootRef.current;
            if (!root) return;

            let activeElement = document.activeElement;
            let needsBlur = false;
            let elementToBlur = null;

            if (activeElement && root.contains(activeElement) && activeElement.isContentEditable) {
                 needsBlur = true;
                 elementToBlur = activeElement;
            } else {
                const focusedInput = root.querySelector('[contenteditable="true"]:focus');
                if(focusedInput) {
                     needsBlur = true;
                     elementToBlur = focusedInput;
                }
            }

            if (needsBlur && elementToBlur) {
                isProcessingBlur.current = true;
                elementToBlur.blur(); // Triggers the onBlur handler which updates state
                await new Promise(resolve => setTimeout(resolve, 50));
                isProcessingBlur.current = false;
            }
        },
        getContent: () => {
             const result = generateFinalHtml(blocks);
             return result;
        },
        getAppliedCSS: () => appliedCss,
        setCSS: (css) => applyCssToEditor(css || ''),
    }), [blocks, generateFinalHtml, appliedCss, applyCssToEditor, editorId]);

    // --- Recursive Block Modifiers ---

    const findAndModifyBlockRecursive = useCallback((targetBlocks, targetId, callback) => {
        let changed = false;
        const result = targetBlocks.reduce((acc, block) => {
            if (!block) return acc;
            if (block.id === targetId) {
                const modifiedBlock = callback(block);
                if (modifiedBlock) acc.push(modifiedBlock);
                changed = true;
                return acc;
            }
            if (block.type === 'columns' && Array.isArray(block.children)) {
                let childChanged = false;
                const newChildren = block.children.map(col => {
                    const resultCol = findAndModifyBlockRecursive(col || [], targetId, callback);
                    if (resultCol !== (col || [])) {
                        childChanged = true;
                    }
                    return resultCol;
                });
                if (childChanged) {
                    acc.push({ ...block, children: newChildren });
                    changed = true;
                } else {
                    acc.push(block);
                }
                return acc;
            }
             if (block.type === 'accordion' && Array.isArray(block.items)) {
                let itemChanged = false;
                const newItems = block.items.map(item => {
                    const newBlocks = findAndModifyBlockRecursive(item.blocks || [], targetId, callback);
                    if (newBlocks !== (item.blocks || [])) {
                        itemChanged = true;
                        return { ...item, blocks: newBlocks };
                    }
                    // Also check for modifications to the item itself (e.g., AccordionItem deletion)
                    if (item.id === targetId) {
                        const modifiedItem = callback(item); // This will be null for deletion
                        if (modifiedItem) acc.push(modifiedItem); // Should not happen for blocks
                        itemChanged = true;
                        return null; // Signal to filter this item out
                    }
                    return item;
                }).filter(Boolean); // Filter out null (deleted) items
                 if (itemChanged) {
                    acc.push({ ...block, items: newItems });
                    changed = true;
                } else {
                    acc.push(block);
                }
                return acc;
             }
            acc.push(block);
            return acc;
        }, []);
        return changed ? result : targetBlocks;
    }, []);
    
     const insertBlockRecursive = useCallback(
        (targetBlocks, insertIndex, newBlock, parentId, colIndexOrItemIdx) => {
         if (parentId === null) {
           const arr = [...targetBlocks];
           arr.splice(insertIndex, 0, newBlock);
           return arr;
         }

         let changed = false;
         const next = targetBlocks.map(block => {
           if (!block) return block;
           if (block.type === 'accordion' && Array.isArray(block.items)) {
                const items = [...block.items];
                const foundIdx = items.findIndex(it => it && it.id === parentId);
                if (foundIdx !== -1) {
                    const item = items[foundIdx];
                    const newBlocks = [...(item.blocks || [])];
                    newBlocks.splice(insertIndex, 0, newBlock);
                    items[foundIdx] = { ...item, blocks: newBlocks };
                    changed = true;
                    return { ...block, items };
                }
           }
           if (block.id === parentId) {
             if (block.type === 'columns' && colIndexOrItemIdx !== null) {
               const children = (block.children || []).map(col => Array.isArray(col) ? [...col] : []);
               const idx = colIndexOrItemIdx;
               const col = children[idx] || [];
               const newCol = [...col];
               newCol.splice(insertIndex, 0, newBlock);
               children[idx] = newCol;
               changed = true;
               return { ...block, children };
             }
             if (block.type === 'accordion' && colIndexOrItemIdx !== null) {
               const items = [...(block.items || [])];
               const idx = colIndexOrItemIdx;
               if (idx < items.length) {
                 const item = items[idx];
                 const b = [...(item.blocks || [])];
                 b.splice(insertIndex, 0, newBlock);
                 items[idx] = { ...item, blocks: b };
                 changed = true;
                 return { ...block, items };
               }
             }
             return block;
           }
           if (block.type === 'columns' && Array.isArray(block.children)) {
             const newChildren = block.children.map(col =>
               insertBlockRecursive(col || [], insertIndex, newBlock, parentId, colIndexOrItemIdx)
             );
             if (newChildren.some((col, i) => col !== (block.children[i] || []))) {
               changed = true;
               return { ...block, children: newChildren };
             }
           }
           if (block.type === 'accordion' && Array.isArray(block.items)) {
             let localChanged = false;
             const newItems = block.items.map(item => {
               const nb = insertBlockRecursive(item.blocks || [], insertIndex, newBlock, parentId, colIndexOrItemIdx);
               if (nb !== (item.blocks || [])) {
                 localChanged = true;
                 return { ...item, blocks: nb };
               }
               return item;
             });
             if (localChanged) {
               changed = true;
               return { ...block, items: newItems };
             }
           }
           return block;
         });
         return changed ? next : targetBlocks;
        },
        []
      );
    
    // --- State Handlers ---

    const handleUpdateBlock = useCallback((blockId, newBlockData) => {
         if (isProcessingBlur.current) {
              return;
         }
        setBlocks(currentBlocks => {
            const updatedBlocks = findAndModifyBlockRecursive(currentBlocks, blockId, block => ({
                ...block,
                ...newBlockData
            }));
            return updatedBlocks;
        });
    }, [findAndModifyBlockRecursive]);

    const handleDeleteBlock = useCallback((blockId) => {
        setBlocks(current => findAndModifyBlockRecursive(current, blockId, () => null));
        if (selectedLayer?.id === blockId) {
            handleSelectLayer(rendererRef.current); // Select root
        }
        if (editingBlockId === blockId) {
            setIsSettingsOpen(false);
            setEditingBlockId(null);
        }
    }, [findAndModifyBlockRecursive, selectedLayer, editingBlockId]);

    const handleUpdateStyle = useCallback((blockId, newStyles) => {
        handleUpdateBlock(blockId, { styles: newStyles });
    }, [handleUpdateBlock]);

     const handleUpdateLayout = useCallback((blockId, newLayout) => {
         setBlocks(current => findAndModifyBlockRecursive(current, blockId, block => {
             const childrenCount = newLayout.columns;
             const currentChildren = block.children || [];
             let newChildren = [...currentChildren];

             if (childrenCount > currentChildren.length) {
                 for (let i = currentChildren.length; i < childrenCount; i++) newChildren.push([]);
             } else if (childrenCount < currentChildren.length) {
                 const columnsToMerge = newChildren.splice(childrenCount);
                 if (!Array.isArray(newChildren[childrenCount - 1])) {
                     newChildren[childrenCount - 1] = [];
                 }
                 columnsToMerge.forEach(col => {
                     if (Array.isArray(col)) {
                         newChildren[childrenCount - 1].push(...col);
                     }
                 });
             }
             return { ...block, layout: newLayout, children: newChildren };
         }));
     }, [findAndModifyBlockRecursive]);

      const handleReorderColumn = useCallback((blockId, fromIndex, toIndex) => {
         setBlocks(current => findAndModifyBlockRecursive(current, blockId, block => {
             if (!block.children || block.children.length <= Math.max(fromIndex, toIndex)) {
                 return block;
             }
             const newChildren = [...block.children];
             const [movedItem] = newChildren.splice(fromIndex, 1);
             newChildren.splice(toIndex, 0, movedItem);

             const newLayout = { ...block.layout, ratios: { ...(block.layout?.ratios || {}) } };
             Object.keys(newLayout.ratios).forEach(bp => {
                 const bpRatios = newLayout.ratios[bp];
                 if(Array.isArray(bpRatios) && bpRatios.length > Math.max(fromIndex, toIndex)) {
                     const currentBpRatios = [...bpRatios];
                     const [movedRatio] = currentBpRatios.splice(fromIndex, 1);
                     currentBpRatios.splice(toIndex, 0, movedRatio);
                     newLayout.ratios[bp] = currentBpRatios;
                 }
             });
             return { ...block, children: newChildren, layout: newLayout };
         }));
     }, [findAndModifyBlockRecursive]);

    const handleAddBlock = useCallback((type, index, parentId = null, colIndexOrItemIdx = null, blockToDuplicate = null) => {
        let newBlock;
        if (blockToDuplicate) {
            const cloneWithNewIds = (block) => {
                const newId = uid();
                let clonedData = { ...(block.data || {}) };
                let clonedStyles = { ...(block.styles || {}) };
                let clonedOptions = { ...(block.options || {}) };
                let clonedChildren = null;
                let clonedItems = null;

                if (block.children) {
                    clonedChildren = block.children.map(col => col.map(cloneWithNewIds));
                }
                if (block.items) {
                     clonedItems = block.items.map(item => ({
                        ...item,
                        id: uid(),
                        blocks: item.blocks ? item.blocks.map(cloneWithNewIds) : []
                    }));
                }
                return { ...block, id: newId, data: clonedData, styles: clonedStyles, options: clonedOptions, children: clonedChildren, items: clonedItems };
            };
            newBlock = cloneWithNewIds(blockToDuplicate);
        } else {
            newBlock = { id: uid(), type, data: {}, styles: {} };
             if (type === 'columns') {
                newBlock.children = [[], []];
                newBlock.layout = { columns: 2, ratios: getInitialRatios() };
            } else if (type === 'image' || type === 'audio' || type === 'video') {
                newBlock.data = { uploading: false, src: '' };
            } else if (type === 'button') {
                newBlock.data = { text: 'Click Me', href: '#', variant:'primary', size:'md', full:false, align:'left', radius:'var(--r-md)' };
            } else if (type === 'accordion') {
                newBlock.items = [{ id: uid(), title: 'Section 1', blocks: [] }];
                newBlock.options = { allowMultiple: false, titleSize:'md', titleAlign:'left', icon:'chevron', theme:'light', openFirst:true, radius:'8px' };
            } else {
                newBlock.data = { text: '' };
            }
        }

        setBlocks(currentBlocks => insertBlockRecursive(currentBlocks, index, newBlock, parentId, colIndexOrItemIdx));
        
        // Select the new block
        setTimeout(() => {
             const newEl = editorRootRef.current?.querySelector(`[data-layer-id="${newBlock.id}"]`);
             if(newEl) handleSelectLayer(newEl);
        }, 0);
    }, [insertBlockRecursive]);


    const handleMoveBlock = useCallback((blockId, currentIndex, direction, parentId, parentIndex) => {
        const newIndex = currentIndex + direction;
        setBlocks(currentBlocks => {
            let blockToMove = null;
            let sourceArray = null;
            const findAndRemove = (blocksArray) => {
                if (!Array.isArray(blocksArray)) return blocksArray;
                const index = blocksArray.findIndex(b => b && b.id === blockId);
                if (index !== -1) {
                    blockToMove = blocksArray[index];
                    sourceArray = blocksArray;
                    return [...blocksArray.slice(0, index), ...blocksArray.slice(index + 1)];
                }
                return blocksArray.map(block => {
                    if (!block) return block;
                    if (block.type === 'columns' && block.children) {
                        const newChildren = block.children.map(col => findAndRemove(col || []));
                        if (newChildren.some((col, i) => col !== (block.children[i] || []))) {
                            return { ...block, children: newChildren };
                        }
                    }
                     if (block.type === 'accordion' && block.items) {
                         const newItems = block.items.map(item => {
                             const newBlocks = findAndRemove(item.blocks || []);
                             if(newBlocks !== (item.blocks || [])) {
                                 return {...item, blocks: newBlocks};
                             }
                             return item;
                         });
                         if (newItems.some((item, i) => item !== block.items[i])) {
                              return { ...block, items: newItems };
                         }
                     }
                    return block;
                });
            };
            const blocksWithoutMoved = findAndRemove(currentBlocks);
            if (!blockToMove || !sourceArray) {
                return currentBlocks;
            }
            return insertBlockRecursive(blocksWithoutMoved, newIndex, blockToMove, parentId, parentIndex);
        });
    }, [insertBlockRecursive]);

    const handleExecCommand = useCallback((blockId) => (command, value = null) => {
        document.execCommand(command, false, value);
        const blockElement = editorRootRef.current?.querySelector(`[data-block-id="${blockId}"]`);
        if (!blockElement) return;
        const editorDiv = blockElement.querySelector(`.${styles.blockContentEditable}`);
        if (editorDiv) {
            const updatedText = editorDiv.innerHTML;
            let currentText = '';
            const findBlockRecursive = (blockArray) => {
                 if (!Array.isArray(blockArray)) return;
                 for (const block of blockArray) {
                     if (!block) continue;
                     if (block.id === blockId) {
                        currentText = block.data.text;
                        return true;
                     }
                     if (block.children && Array.isArray(block.children)) {
                         for (const childCol of block.children) {
                             if (findBlockRecursive(childCol)) return true;
                         }
                     }
                     if (block.items && Array.isArray(block.items)) {
                         for (const item of block.items) {
                             if (findBlockRecursive(item.blocks)) return true;
                         }
                     }
                 }
                 return false;
            };
            findBlockRecursive(blocks);
            if (updatedText !== currentText) {
                handleUpdateBlock(blockId, { data: { text: updatedText } });
            }
        }
    }, [blocks, handleUpdateBlock]);

    // --- Layer Selection ---
    
    const handleSelectLayer = useCallback((el) => {
            if (!el) return;
            
            const newLayerId = el.dataset.layerId;
            const newLayerType = el.dataset.layerType;

            setSelectedLayer(currentLayer => {
                // Prevent re-setting state if it's the same layer
                if (currentLayer && currentLayer.id === newLayerId) {
                    return currentLayer;
                }

                // Remove highlight from old layer
                if (currentLayer?.el) {
                    currentLayer.el.classList.remove(styles.isLayerSelected);
                }

                // Add highlight to new layer
                el.classList.add(styles.isLayerSelected);
                el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });

                return {
                    id: newLayerId,
                    el: el,
                    type: newLayerType,
                };
            });

        }, []); // Empty dependency array makes this function stable

    // --- Settings Panel Logic ---

    const handleShowSettings = useCallback((blockId) => {
        setEditingBlockId(blockId);
        setIsSettingsOpen(true);
        // Also select the block's layer - use blockWrapper selector to ensure we get the right element
        const el = editorRootRef.current?.querySelector(`.blockWrapper[data-layer-id="${blockId}"]`);
        if (el) {
            handleSelectLayer(el);
        } else {
            // Fallback for non-wrapper blocks (columns, accordion items, etc.)
            const fallbackEl = editorRootRef.current?.querySelector(`[data-layer-id="${blockId}"]`);
            if (fallbackEl) handleSelectLayer(fallbackEl);
        }
    }, [handleSelectLayer]);

    const handleCloseSettings = useCallback(() => {
        setIsSettingsOpen(false);
        setEditingBlockId(null);
    }, []);

    // --- Fullscreen Mode ---
    const toggleFullscreen = useCallback(() => {
        const elem = editorRootRef.current;
        if (!elem) return;

        if (!isFullscreen) {
            // Enter fullscreen
            if (elem.requestFullscreen) {
                elem.requestFullscreen();
            } else if (elem.webkitRequestFullscreen) { // Safari
                elem.webkitRequestFullscreen();
            } else if (elem.msRequestFullscreen) { // IE11
                elem.msRequestFullscreen();
            }
        } else {
            // Exit fullscreen
            if (document.exitFullscreen) {
                document.exitFullscreen();
            } else if (document.webkitExitFullscreen) { // Safari
                document.webkitExitFullscreen();
            } else if (document.msExitFullscreen) { // IE11
                document.msExitFullscreen();
            }
        }
    }, [isFullscreen]);

    // Listen for fullscreen change events
    useEffect(() => {
        const handleFullscreenChange = () => {
            const isCurrentlyFullscreen = !!(
                document.fullscreenElement ||
                document.webkitFullscreenElement ||
                document.msFullscreenElement
            );
            setIsFullscreen(isCurrentlyFullscreen);
        };

        document.addEventListener('fullscreenchange', handleFullscreenChange);
        document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
        document.addEventListener('msfullscreenchange', handleFullscreenChange);

        return () => {
            document.removeEventListener('fullscreenchange', handleFullscreenChange);
            document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
            document.removeEventListener('msfullscreenchange', handleFullscreenChange);
        };
    }, []);

    const editingBlock = useMemo(() => {
        if (!editingBlockId) return null;
        let foundBlock = null;
        const findBlockRecursive = (blockArray) => {
             if (!Array.isArray(blockArray)) return;
             for (const block of blockArray) {
                 if (!block) continue;
                 if (block.id === editingBlockId) { foundBlock = block; return; }
                 if (block.children && Array.isArray(block.children)) {
                     block.children.forEach(childColumn => { findBlockRecursive(childColumn); });
                 }
                 if (block.items && Array.isArray(block.items)) {
                      block.items.forEach(item => { findBlockRecursive(item.blocks || []); });
                 }
                 if (foundBlock) return;
             }
        };
        findBlockRecursive(blocks);
        return foundBlock;
    }, [editingBlockId, blocks]);

    // --- File Uploads ---

    const openImagePickerFor = useCallback((blockId) => {
        const el = imageUploadInputRef.current;
        if (!el) return;
        el.setAttribute('data-block-id', blockId);
        el.click();
    }, []);
    const openAudioPickerFor = useCallback((blockId) => {
        const el = audioUploadInputRef.current;
        if (!el) return;
        el.setAttribute('data-block-id', blockId);
        el.click();
    }, []);
    const openVideoPickerFor = useCallback((blockId) => {
        const el = videoUploadInputRef.current;
        if (!el) return;
        el.setAttribute('data-block-id', blockId);
        el.click();
    }, []);

    const handleFileUpload = async (e, mediaType) => {
        const file = e.target.files[0];
        const blockId = e.target.getAttribute('data-block-id');
        e.target.value = null;
        if (!file || !blockId) return;

        const nameLc = (file.name || '').toLowerCase();
        let isValid = false;
        if (mediaType === 'image') isValid = file.type.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg)$/.test(nameLc);
        if (mediaType === 'audio') isValid = file.type.startsWith('audio/') || /\.(mp3|wav|m4a|ogg|aac)$/.test(nameLc);
        if (mediaType === 'video') isValid = file.type.startsWith('video/') || /\.(mp4|mov|avi|webm|ogg)$/.test(nameLc);

        if (!isValid) { setUploadError(`Please choose a valid ${mediaType} file.`); return; }
        setUploadError('');
        setBlocks(current => findAndModifyBlockRecursive(current, blockId, block => ({...block, data: { ...(block.data || {}), uploading: true }})));

        const formData = new FormData();
        formData.append('file', file);
        formData.append('media_type', mediaType);
        formData.append('media_category', mediaCategory);

        try {
            const response = await apiClient.post('/user_media/upload/', formData);
            if (response.data.url) {
                // Normalize to https if backend returns http
                const safeUrl = String(response.data.url).replace('http://', 'https://');
                setBlocks(current => findAndModifyBlockRecursive(current, blockId, block => ({ ...block, data: { ...(block.data || {}), src: safeUrl, uploading: false } })));
            } else { throw new Error(response.data.error || 'Upload failed.'); }
        } catch (err) {
            setUploadError(err.message || `A server error occurred.`);
             setBlocks(current => findAndModifyBlockRecursive(current, blockId, block => ({...block, data: { ...(block.data || {}), uploading: false }})));
        }
    };

    // --- View Switching & Code ---

    const renderedPreview = useMemo(() => <BlockRenderer blocks={blocks} isEditing={false} />, [blocks]);

    useEffect(() => {
        if (view !== 'code' || !isCodeDirty) {
            setCodeText(generateFinalHtml(blocks));
             if (view !== 'code') setIsCodeDirty(false);
        }
    }, [blocks, view, isCodeDirty, generateFinalHtml]);

    const handleCopyCode = useCallback(async () => {
        try { await navigator.clipboard.writeText(codeText || ''); } catch (e) {}
    }, [codeText]);

     const handleCodeChange = useCallback((val) => {
        setCodeText(val);
        setIsCodeDirty(true);
        if (!codeImportEnabled) return;

        if (codeDebounceRef.current) clearTimeout(codeDebounceRef.current);
        codeDebounceRef.current = setTimeout(() => {
            try {
                const newBlocks = htmlToBlocks(val);
                setBlocks(newBlocks);
                setCodeError('');
            } catch (e) { setCodeError('Invalid HTML. Please check code.'); }
        }, 300);
     }, [codeImportEnabled]);

    const handleImportCode = useCallback(() => {
        try {
            setCodeError('');
            const newBlocks = htmlToBlocks(codeText || '');
            setBlocks(newBlocks);
            setIsCodeDirty(false);
        } catch (e) { setCodeError('Invalid HTML. Please check code.'); }
    }, [codeText]);


    useEffect(() => {
        if (view !== 'code' && codeImportEnabled && isCodeDirty) {
             try {
                 const newBlocks = htmlToBlocks(codeText);
                 setBlocks(newBlocks);
                 setCodeError('');
                 setIsCodeDirty(false);
             } catch (e) { setCodeError('Invalid HTML.'); }
        }
     }, [view, codeImportEnabled, isCodeDirty, codeText]);

    useEffect(() => {
        return () => { if (codeDebounceRef.current) clearTimeout(codeDebounceRef.current); };
    }, []);

    // --- Render ---

    if (!isMounted) return <div className={styles.loadingState}>Loading Editor...</div>;

    const getSettingsTitle = () => {
        if (!editingBlock) return "Settings";
        return `${editingBlock.type.charAt(0).toUpperCase() + editingBlock.type.slice(1)} Settings`;
    };

    return (
        <div 
            id={editorId} 
            className={`${styles.editorContainer} ${isOutlineOpen ? styles.asideOpen : ''}`} 
            ref={editorRootRef}
            onKeyDown={(e) => {
                // Keyboard: Esc → parent; Shift+Esc → root
                if (e.key !== 'Escape') return;
                if (!selectedLayer) return;
                e.preventDefault();
                e.stopPropagation();
                
                if (e.shiftKey) {
                    const root = rendererRef.current;
                    if (root) handleSelectLayer(root);
                    return;
                }
                
                // Find parent layer in the DOM
                const parentLayer = selectedLayer.el.parentElement.closest('[data-layer-id]');
                if (parentLayer) {
                    handleSelectLayer(parentLayer);
                } else if (rendererRef.current) {
                    handleSelectLayer(rendererRef.current); // Fallback to root
                }
            }}
        >
            <header className={styles.header}>
                <div className={styles.headerMain}>
                    <button 
                        type="button" 
                        className={styles.headerToggle} 
                        onClick={() => setIsOutlineOpen(!isOutlineOpen)}
                        title={isOutlineOpen ? "Hide Layers" : "Show Layers"}
                    >
                        <Icons.Panel />
                    </button>
                    <h1>Lesson Editor</h1>
                </div>
                <div className={styles.headerTabs}>
                    <button
                        type="button"
                        onClick={() => setView('editor')}
                        className={`${styles.tabButton} ${view === 'editor' ? styles.active : ''}`}
                        aria-pressed={view === 'editor'}
                    >
                        <Icons.Edit w={16} h={16} /><span>Editor</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setView('preview')}
                        className={`${styles.tabButton} ${view === 'preview' ? styles.active : ''}`}
                        aria-pressed={view === 'preview'}
                    >
                        <Icons.Eye w={16} h={16} /><span>Preview</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setView('code')}
                        className={`${styles.tabButton} ${view === 'code' ? styles.active : ''}`}
                        aria-pressed={view === 'code'}
                    >
                        <Icons.Code w={16} h={16} /><span>Code</span>
                    </button>
                </div>
                <div className={styles.headerActions}>
                    {view === 'preview' && (
                        <div className={styles.deviceToggles}>
                            <button
                                type="button"
                                onClick={() => setPreviewDevice('desktop')}
                                className={previewDevice === 'desktop' ? styles.active : ''}
                                title="Desktop View"
                            >
                                <Icons.Desktop />
                            </button>
                            <button
                                type="button"
                                onClick={() => setPreviewDevice('tablet')}
                                className={previewDevice === 'tablet' ? styles.active : ''}
                                title="Tablet View"
                            >
                                <Icons.Tablet />
                            </button>
                            <button
                                type="button"
                                onClick={() => setPreviewDevice('mobile')}
                                className={previewDevice === 'mobile' ? styles.active : ''}
                                title="Mobile View"
                            >
                                <Icons.Mobile />
                            </button>
                        </div>
                    )}
                    <button
                        type="button"
                        className={styles.fullscreenButton}
                        onClick={toggleFullscreen}
                        title={isFullscreen ? "Exit Fullscreen (Esc)" : "Enter Fullscreen (F11)"}
                    >
                        {isFullscreen ? <Icons.FullscreenExit /> : <Icons.Fullscreen />}
                    </button>
                </div>
            </header>

            {uploadError && (
            <div className={styles.uploadError} onClick={() => setUploadError('')}>
                {uploadError} (click to dismiss)
            </div>
            )}

            <div className={styles.editorLayout}>
                {/* Mobile-only backdrop (visible via CSS @media). Click to close sidebar */}
                {isOutlineOpen && (
                    <div
                        className={styles.sidebarBackdrop}
                        onClick={() => setIsOutlineOpen(false)}
                        aria-hidden="true"
                    />
                )}
                <aside className={styles.editorSidebar}>
                    <LayerOutline 
                        editorRoot={rendererRef.current}
                        selectedLayer={selectedLayer}
                        onSelectLayer={handleSelectLayer}
                    />
                </aside>

                <main className={styles.editorMain}>
                    <div className={styles.contentArea}>
                        {view === 'editor' ? (
                        <div className={styles.editorView}>
                            <div
                                ref={rendererRef}
                                className={`${styles.renderer} renderer`}
                                data-layer-type="Renderer"
                                data-layer-label="Editor Canvas"
                                data-layer-id="root"
                                onMouseDown={handleCanvasMouseDown}
                                onClick={(e) => {
                                    // Only select root when clicking empty canvas space
                                    const t = e.target;
                                    if (
                                        t !== e.currentTarget ||
                                        t.closest(`.${styles.blockControls}`) ||
                                        t.closest(`.${styles.textToolbar}`) ||
                                        t.closest(`.${styles.addBlockMenu}`) ||
                                        t.closest(`.${styles.outlinePanel}`) ||
                                        t.closest(`.${styles.settingsPanelWrapper}`) ||
                                        t.closest('[contenteditable="true"]')
                                    ) {
                                        return;
                                    }
                                    e.stopPropagation();
                                    handleSelectLayer(e.currentTarget);
                                }}
                            >
                                <BlockRenderer
                                    blocks={blocks}
                                    isEditing={true}
                                    onUpdateBlock={handleUpdateBlock}
                                    onDeleteBlock={handleDeleteBlock}
                                    onAddBlock={handleAddBlock}
                                    onMoveBlock={handleMoveBlock}
                                    onExecCommand={handleExecCommand}
                                    openImagePickerFor={openImagePickerFor}
                                    openAudioPickerFor={openAudioPickerFor}
                                    openVideoPickerFor={openVideoPickerFor}
                                    onShowSettings={handleShowSettings}
                                    onReorderColumn={handleReorderColumn}
                                    onSelectLayer={handleSelectLayer}
                                    onSetSelectedLayer={setSelectedLayer}
                                    selectedLayer={selectedLayer}
                                />
                            </div>

                            {isSettingsOpen && editingBlock && (
                                <SettingsPanel
                                    title={getSettingsTitle()}
                                    onClose={handleCloseSettings}
                                >
                                {/* --- 1. General Style Settings (For ALL blocks) --- */}
                                <h4>Block Styles</h4>
                                {/* This is the CORRECTED Text Align block */}
                                {(editingBlock.type === 'text' || editingBlock.type === 'heading') && (
                                    <div className={styles.csGroup} role="group" aria-labelledby={`text-align-label-${editingBlock.id}`}>
                                        <span id={`text-align-label-${editingBlock.id}`} className={styles.csGroupLabel}>Text Align</span>
                                        <div className={styles.csBtnGroup}>
                                            {['left', 'center', 'right'].map(a => (
                                                <button
                                                    key={a} type="button"
                                                    className={editingBlock.styles?.textAlign === a ? styles.active : ''}
                                                    onClick={() => handleUpdateStyle(editingBlock.id, { ...editingBlock.styles, textAlign: a })}
                                                >
                                                    {a.charAt(0).toUpperCase() + a.slice(1)}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                <ColorControl 
                                    label="Background"
                                        value={editingBlock.styles?.backgroundColor}
                                        onChange={(val) => handleUpdateStyle(editingBlock.id, { ...editingBlock.styles, backgroundColor: val })}
                                    />
                                    <ColorControl 
                                        label="Text Color"
                                        value={editingBlock.styles?.color}
                                        onChange={(val) => handleUpdateStyle(editingBlock.id, { ...editingBlock.styles, color: val })}
                                    />
                                    
                                    <div className={styles.styleControl}>
                                        <label htmlFor={`style-padding-${editingBlock.id}`}>Padding</label>
                                        <input id={`style-padding-${editingBlock.id}`} type="text" name="padding" value={editingBlock.styles?.padding || ''} onChange={(e) => handleUpdateStyle(editingBlock.id, {...editingBlock.styles, padding: e.target.value})} placeholder="e.g., 1rem" />
                                    </div>
                                    <div className={styles.styleControl}>
                                        <label htmlFor={`style-margin-${editingBlock.id}`}>Margin</label>
                                        <input id={`style-margin-${editingBlock.id}`} type="text" name="margin" value={editingBlock.styles?.margin || ''} onChange={(e) => handleUpdateStyle(editingBlock.id, {...editingBlock.styles, margin: e.target.value})} placeholder="e.g., 1rem 0" />
                                    </div>
                                    <div className={styles.styleControl}>
                                        <label htmlFor={`style-fontSize-${editingBlock.id}`}>Font Size</label>
                                        <input id={`style-fontSize-${editingBlock.id}`} type="text" name="fontSize" value={editingBlock.styles?.fontSize || ''} onChange={(e) => handleUpdateStyle(editingBlock.id, {...editingBlock.styles, fontSize: e.target.value})} placeholder="e.g., 1.2rem" />
                                    </div>
                                    <div className={styles.styleControl}>
                                        <label htmlFor={`style-border-${editingBlock.id}`}>Border</label>
                                        <input id={`style-border-${editingBlock.id}`} type="text" name="border" value={editingBlock.styles?.border || ''} onChange={(e) => handleUpdateStyle(editingBlock.id, {...editingBlock.styles, border: e.target.value})} placeholder="e.g., 1px solid #ccc" />
                                    </div>
                                    <div className={styles.styleControl}>
                                        <label htmlFor={`style-borderRadius-${editingBlock.id}`}>Border Radius</label>
                                        <input id={`style-borderRadius-${editingBlock.id}`} type="text" name="borderRadius" value={editingBlock.styles?.borderRadius || ''} onChange={(e) => handleUpdateStyle(editingBlock.id, {...editingBlock.styles, borderRadius: e.target.value})} placeholder="e.g., 8px" />
                                    </div>
                                    
                                    <hr className={styles.csSeparator} />

                                    {/* --- 2. Block-Specific Settings --- */}
                                    {editingBlock.type === 'image' && (
                                        <>
                                            <h4>Image Options</h4>
                                            <div className={styles.csGroup} role="group" aria-labelledby={`img-align-label-${editingBlock.id}`}>
                                                <span id={`img-align-label-${editingBlock.id}`} className={styles.csGroupLabel}>Alignment</span>
                                                <div className={styles.csBtnGroup}>
                                                    {['left', 'center', 'right'].map(a => (
                                                        <button
                                                            key={a} type="button"
                                                            className={editingBlock.data?.align === a ? styles.active : ''}
                                                            onClick={() => handleUpdateBlock(editingBlock.id, { data: { ...editingBlock.data, align: a } })}
                                                        >
                                                            {a.charAt(0).toUpperCase() + a.slice(1)}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                            <div className={styles.csGroup} role="group" aria-labelledby={`img-size-label-${editingBlock.id}`}>
                                                <span id={`img-size-label-${editingBlock.id}`} className={styles.csGroupLabel}>Image Size</span>
                                                <div className={styles.csBtnGroup}>
                                                    {[
                                                        { label: 'Small', value: '300px' },
                                                        { label: 'Medium', value: '500px' },
                                                        { label: 'Large', value: '800px' },
                                                        { label: 'Full', value: '100%' }
                                                    ].map(({ label, value }) => (
                                                        <button
                                                            key={value}
                                                            type="button"
                                                            className={editingBlock.data?.maxWidth === value ? styles.active : ''}
                                                            onClick={() => handleUpdateBlock(editingBlock.id, { data: { ...editingBlock.data, maxWidth: value } })}
                                                        >
                                                            {label}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                            <div className={styles.styleControl}>
                                                <label htmlFor={`image-custom-width-${editingBlock.id}`}>Custom Max Width</label>
                                                <input 
                                                    id={`image-custom-width-${editingBlock.id}`}
                                                    type="text"
                                                    name="imageMaxWidth"
                                                    value={editingBlock.data?.maxWidth || ''}
                                                    onChange={(e) => handleUpdateBlock(editingBlock.id, { data: { ...editingBlock.data, maxWidth: e.target.value } })}
                                                    placeholder="e.g., 600px, 80%, or leave empty for full size"
                                                />
                                            </div>
                                            <div className={styles.styleControl}>
                                                <label htmlFor={`image-href-${editingBlock.id}`}>Link URL (optional)</label>
                                                <input 
                                                    id={`image-href-${editingBlock.id}`}
                                                    type="url"
                                                    name="imageHref"
                                                    value={editingBlock.data?.href || ''}
                                                    onChange={(e) => handleUpdateBlock(editingBlock.id, { data: { ...editingBlock.data, href: e.target.value } })}
                                                    placeholder="https://example.com or leave empty"
                                                />
                                            </div>
                                            {editingBlock.data?.href && (
                                                <div className={styles.csGroup}>
                                                    <label className={styles.csCheckboxLabel}>
                                                        <input 
                                                            type="checkbox"
                                                            checked={!!editingBlock.data?.openInNewTab}
                                                            onChange={(e) => handleUpdateBlock(editingBlock.id, { data: { ...editingBlock.data, openInNewTab: e.target.checked } })}
                                                        />
                                                        <span>Open link in new tab</span>
                                                    </label>
                                                </div>
                                            )}
                                        </>
                                    )}
                                    {editingBlock.type === 'button' && (
                                        <>
                                            <h4>Button Options</h4>
                                            <div className={styles.csGroup} role="group" aria-labelledby={`btn-variant-label-${editingBlock.id}`}>
                                                <span id={`btn-variant-label-${editingBlock.id}`} className={styles.csGroupLabel}>Variant</span>
                                                <div className={styles.csBtnGroup}>
                                                    {['primary','secondary','ghost','link'].map(v=>(
                                                        <button key={v} type="button" className={editingBlock.data?.variant===v?styles.active:''} onClick={()=>handleUpdateBlock(editingBlock.id,{ data:{...editingBlock.data, variant:v}})}>{v}</button>
                                                    ))}
                                                </div>
                                            </div>
                                            <div className={styles.csGroup} role="group" aria-labelledby={`btn-size-label-${editingBlock.id}`}>
                                                <span id={`btn-size-label-${editingBlock.id}`} className={styles.csGroupLabel}>Size</span>
                                                <div className={styles.csBtnGroup}>
                                                    {['sm','md','lg'].map(s=>(
                                                        <button key={s} type="button" className={editingBlock.data?.size===s?styles.active:''} onClick={()=>handleUpdateBlock(editingBlock.id,{ data:{...editingBlock.data, size:s}})}>{s.toUpperCase()}</button>
                                                    ))}
                                                </div>
                                            </div>
                                            <div className={styles.csGroup}>
                                                <label className={styles.csCheckboxLabel}>
                                                    <input type="checkbox" checked={!!editingBlock.data?.full} onChange={(e)=>handleUpdateBlock(editingBlock.id,{ data:{...editingBlock.data, full:e.target.checked}})}/>
                                                    <span>Full width</span>
                                                </label>
                                            </div>
                                            <div className={styles.csGroup} role="group" aria-labelledby={`btn-align-label-${editingBlock.id}`}>
                                                <span id={`btn-align-label-${editingBlock.id}`} className={styles.csGroupLabel}>Align</span>
                                                <div className={styles.csBtnGroup}>
                                                    {['left','center','right'].map(a=>(
                                                        <button key={a} type="button" className={editingBlock.data?.align===a?styles.active:''} onClick={()=>handleUpdateBlock(editingBlock.id,{ data:{...editingBlock.data, align:a}})}>{a}</button>
                                                    ))}
                                                </div>
                                            </div>
                                            <div className={styles.styleControl}>
                                                <label htmlFor={`button-radius-${editingBlock.id}`}>Corner radius</label>
                                                <input id={`button-radius-${editingBlock.id}`} type="text" value={editingBlock.data?.radius||'var(--r-md)'} onChange={(e)=>handleUpdateBlock(editingBlock.id,{ data:{...editingBlock.data, radius:e.target.value}})} placeholder="e.g., 8px"/>
                                            </div>

                                        </>
                                    )}
                                    {editingBlock.type === 'accordion' && (
                                        <>
                                            <h4>Accordion Options</h4>
                                            <div className={styles.csGroup}>
                                                <label className={styles.csCheckboxLabel}>
                                                    <input type="checkbox" checked={!!editingBlock.options?.allowMultiple} onChange={(e)=>handleUpdateBlock(editingBlock.id,{ options:{ ...(editingBlock.options||{}), allowMultiple:e.target.checked }})}/>
                                                    <span>Allow multiple open</span>
                                                </label>
                                            </div>
                                            <div className={styles.csGroup} role="group" aria-labelledby={`acc-title-size-label-${editingBlock.id}`}>
                                                <span id={`acc-title-size-label-${editingBlock.id}`} className={styles.csGroupLabel}>Title size</span>
                                                <div className={styles.csBtnGroup}>
                                                    {['sm','md','lg'].map(s=>(
                                                        <button key={s} type="button" className={editingBlock.options?.titleSize===s?styles.active:''} onClick={()=>handleUpdateBlock(editingBlock.id,{ options:{...editingBlock.options, titleSize:s}})}>{s.toUpperCase()}</button>
                                                    ))}
                                                </div>
                                            </div>
                                            <div className={styles.csGroup} role="group" aria-labelledby={`acc-title-align-label-${editingBlock.id}`}>
                                                <span id={`acc-title-align-label-${editingBlock.id}`} className={styles.csGroupLabel}>Title align</span>
                                                <div className={styles.csBtnGroup}>
                                                    {['left','center','right'].map(a=>(
                                                        <button key={a} type="button" className={editingBlock.options?.titleAlign===a?styles.active:''} onClick={()=>handleUpdateBlock(editingBlock.id,{ options:{...editingBlock.options, titleAlign:a}})}>{a}</button>
                                                    ))}
                                                </div>
                                            </div>
                                            <div className={styles.csGroup} role="group" aria-labelledby={`acc-toggle-icon-label-${editingBlock.id}`}>
                                                <span id={`acc-toggle-icon-label-${editingBlock.id}`} className={styles.csGroupLabel}>Toggle icon</span>
                                                <div className={styles.csBtnGroup}>
                                                    {['chevron','plus','none'].map(i=>(
                                                        <button key={i} type="button" className={editingBlock.options?.icon===i?styles.active:''} onClick={()=>handleUpdateBlock(editingBlock.id,{ options:{...editingBlock.options, icon:i}})}>{i}</button>
                                                    ))}
                                                </div>
                                            </div>
                                            <div className={styles.csGroup} role="group" aria-labelledby={`acc-theme-label-${editingBlock.id}`}>
                                                <span id={`acc-theme-label-${editingBlock.id}`} className={styles.csGroupLabel}>Theme</span>
                                                <div className={styles.csBtnGroup}>
                                                    {['light','dark','outline'].map(t=>(
                                                        <button key={t} type="button" className={editingBlock.options?.theme===t?styles.active:''} onClick={()=>handleUpdateBlock(editingBlock.id,{ options:{...editingBlock.options, theme:t}})}>{t}</button>
                                                    ))}
                                                </div>
                                            </div>
                                            <div className={styles.csGroup}>
                                                <label className={styles.csCheckboxLabel}>
                                                    <input type="checkbox" checked={!!editingBlock.options?.openFirst} onChange={(e)=>handleUpdateBlock(editingBlock.id,{ options:{...editingBlock.options, openFirst:e.target.checked}})} />
                                                    <span>Open first section by default</span>
                                                </label>
                                            </div>
                                            <div className={styles.styleControl}>
                                                <label htmlFor={`accordion-radius-${editingBlock.id}`}>Corner radius</label>
                                                <input id={`accordion-radius-${editingBlock.id}`} type="text" value={editingBlock.options?.radius||'8px'} onChange={(e)=>handleUpdateBlock(editingBlock.id,{ options:{...editingBlock.options, radius:e.target.value}})} placeholder="e.g., 8px"/>
                                            </div>
                                        </>
                                    )}
                                    {editingBlock.type === 'columns' && (
                                        <ColumnSettings block={editingBlock} onUpdateLayout={handleUpdateLayout} />
                                    )}
                                </SettingsPanel>
                            )}
                        </div>
                        ) : view === 'preview' ? (
                        <div className={`${styles.previewWrapper} ${styles[previewDevice]}`}>
                            <div className={styles.previewView}>{renderedPreview}</div>
                        </div>
                        ) : (
                        <div className={styles.codeView}>
                            <div className={styles.codeToolbar}>
                                <label className={styles.codeToggle}>
                                    <input
                                    type="checkbox"
                                    checked={codeImportEnabled}
                                    onChange={e => setCodeImportEnabled(e.target.checked)}
                                    />
                                    Enable import/edit
                                </label>
                                <div className={styles.codeActions}>
                                    <button
                                        type="button"
                                        className={`${styles.btn} ${styles.btn_secondary} ${styles.btnSize_sm}`}
                                        onClick={handleCopyCode}
                                    >
                                        Copy
                                    </button>
                                    <button
                                        type="button"
                                        className={`${styles.btn} ${styles.btn_primary} ${styles.btnSize_sm}`}
                                        onClick={handleImportCode}
                                        disabled={!codeImportEnabled}
                                        title={codeImportEnabled ? 'Import pasted code' : "Check 'Enable import/edit' first"}
                                    >
                                        Import
                                    </button>
                                </div>
                            </div>
                            {codeError && (
                            <div className={styles.uploadError} onClick={() => setCodeError('')}>
                                {codeError} (click to dismiss)
                            </div>
                            )}
                            <textarea
                                className={styles.codeTextarea}
                                value={codeText}
                                onChange={e => handleCodeChange(e.target.value)}
                                spellCheck={false}
                                readOnly={!codeImportEnabled}
                                aria-label="Lesson HTML Code"
                            />
                            <p className={styles.codeInfo}>
                            The code includes layout styles and content. Theme/custom CSS is applied separately.
                            </p>
                        </div>
                        )}
                    </div>
                </main>
            </div>

            {/* Hidden File Inputs */}
            <input
                ref={imageUploadInputRef}
                type="file"
                accept="image/*,.png,.jpg,.jpeg,.gif,.webp,.svg"
                onChange={e => handleFileUpload(e, 'image')}
                className={styles.visuallyHiddenInput}
                tabIndex={-1}
                aria-hidden="true"
            />
            <input
                ref={audioUploadInputRef}
                type="file"
                accept="audio/*,.mp3,.wav,.m4a,.ogg,.aac"
                onChange={e => handleFileUpload(e, 'audio')}
                className={styles.visuallyHiddenInput}
                tabIndex={-1}
                aria-hidden="true"
            />
            <input
                ref={videoUploadInputRef}
                type="file"
                accept="video/*,.mp4,.mov,.avi,.webm,.ogg"
                onChange={e => handleFileUpload(e, 'video')}
                className={styles.visuallyHiddenInput}
                tabIndex={-1}
                aria-hidden="true"
            />
        </div>
    );
});
LessonEditor.displayName = 'LessonEditor';

// --- CSS Prefixing Utility ---
function prefixCss(scope, css) {
    if (!css || typeof css !== 'string') return '';
    try {
        return css.split(/}\s*/).map(block => {
            if (!block.trim()) return '';
            const parts = block.split('{');
            const sel = parts[0]?.trim();
            const body = parts.slice(1).join('{').trim();
            if (!body || !sel) return `${block.trim()}}`;
            if (sel.startsWith('@')) return `${sel} {${body}}`;
            if (!scope) return `${sel} {${body}}`;

            const prefixedSelectors = sel.split(',')
                .map(s => s.trim()).filter(Boolean)
                .map(individualSelector => {
                    if (individualSelector.startsWith(scope)) return individualSelector;
                    const pseudoMatch = individualSelector.match(/::?[\w-]+(\(.*\))?$/);
                    const baseSelector = pseudoMatch ? individualSelector.slice(0, pseudoMatch.index) : individualSelector;
                    const pseudoPart = pseudoMatch ? pseudoMatch[0] : '';
                    if (/^[>~+]/.test(baseSelector.trim())) {
                        return `${scope}${baseSelector.trim()}${pseudoPart}`;
                    }
                    return `${scope} ${baseSelector}${pseudoPart}`;
                })
                .join(', ');
            return `${prefixedSelectors} {${body}}`;
        }).join('\n');
    } catch (error) {
        console.error("Error prefixing CSS:", error);
        return css;
    }
}

export default LessonEditor;

