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
import styles from '@/styles/Editor/LessonEditor.module.css';
const ELEMENT_NODE = 1;

// --- MOCK API CLIENT ---
// NOTE: Replace with your actual API client import
const apiClient = {
    get: async (url) => {
        if (url === '/lessons/templates/') {
            return Promise.resolve({
                data: [{
                    id: 1,
                    name: "Zporta Academic Blue",
                    predefined_css: `h2 { color: #0A2342; } .zporta-highlight { background-color: #e0f2fe; }`
                }]
            });
        }
        console.warn(`GET request to ${url} is using a MOCK API client in LessonEditor.js`);
        return Promise.reject(new Error(`GET request to ${url} not mocked.`));
    },
    post: async (url, formData) => {
        if (url === '/user_media/upload/') {
            console.warn(`POST request to ${url} is using a MOCK API client in LessonEditor.js`);
            await new Promise(res => setTimeout(res, 1000)); // Simulate upload delay
            const mediaType = formData.get('media_type');
            let placeholderUrl;
            if (mediaType === 'image') {
                placeholderUrl = `https://placehold.co/800x450/e0f2fe/4a5568?text=Image+${Date.now()}`;
            } else if (mediaType === 'audio') {
                placeholderUrl = 'https://www.w3schools.com/html/horse.mp3'; // Placeholder audio
            } else if (mediaType === 'video') {
                placeholderUrl = 'https://www.w3schools.com/html/mov_bbb.mp4'; // Placeholder video
            }
            return Promise.resolve({ data: { url: placeholderUrl } });
        }
        return Promise.reject(new Error(`POST request to ${url} not mocked.`));
    }
};
// --- END MOCK API CLIENT ---

// --- UTILITIES ---
const uid = () => crypto.randomUUID();

// --- ICONS ---
// Refined and slightly more modern SVGs
const PlusIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>);
const TrashIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>);
const AudioIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path><path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path></svg>);
const VideoIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="23 7 16 12 23 17 23 7"></polygon><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg>);
const ImageIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>);
const TextIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="17" y1="10" x2="3" y2="10"></line><line x1="21" y1="6" x2="3" y2="6"></line><line x1="21" y1="14" x2="3" y2="14"></line><line x1="17" y1="18" x2="3" y2="18"></line></svg>);
const HeadingIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 12h12M6 4v16M18 4v16"></path><path d="M10 4v7h4V4"></path></svg>);
const ButtonIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="10" rx="2" ry="2"></rect><path d="M12 12h.01"></path><path d="M16 12h.01"></path><path d="M8 12h.01"></path></svg>);
const ColumnsIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="12" y1="3" x2="12" y2="21"></line></svg>);
const AccordionIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="4" rx="1" ry="1"/><rect x="3" y="10" width="18" height="4" rx="1" ry="1"/><rect x="3" y="17" width="18" height="4" rx="1" ry="1"/></svg>);
const SettingsIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>);
const DesktopIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>);
const TabletIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"></rect><line x1="12" y1="18" x2="12.01" y2="18"></line></svg>);
const MobileIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect><line x1="12" y1="18" x2="12.01" y2="18"></line></svg>);
const DuplicateIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>);
const MoveUpIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="19" x2="12" y2="5"></line><polyline points="5 12 12 5 19 12"></polyline></svg>);
const MoveDownIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><polyline points="19 12 12 19 5 12"></polyline></svg>);
const PaletteIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="13.5" cy="6.5" r=".5" fill="currentColor"></circle><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"></circle><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"></circle><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"></circle><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"></path></svg>);

// --- Column Layout Constants ---
const BREAKPOINTS = ['base', 'sm', 'md', 'lg'];
const getInitialRatios = () => ({ base: [100], sm: [50, 50], md: [50, 50], lg: [50, 50] });
const COLUMN_PRESETS = {
    1: [[100]],
    2: [[50, 50], [30, 70], [70, 30], [33, 67], [67, 33]],
    3: [[33, 34, 33], [25, 50, 25], [50, 25, 25], [25, 25, 50]],
    4: [[25, 25, 25, 25], [20, 30, 30, 20]]
};
const WRAPPER_CLASS = "lesson-content";
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

// --- DATA SERIALIZATION / DESERIALIZATION ---
const htmlToBlocks = (htmlString) => {
    if (!htmlString || typeof window === 'undefined') {
        return [{ id: uid(), type: 'text', data: { text: '' }, styles: {} }];
    }
    try {
        const doc = new DOMParser().parseFromString(htmlString, 'text/html');
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
                    const columns = Array.from(node.children).map(col => parseNodes(col.childNodes));
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
                    blocks.push({ id, type: 'columns', children: columns, layout, styles: {} });
                } else if (node.tagName.startsWith('H')) {
                    blocks.push({ id, type: 'heading', data: { text: node.innerHTML }, styles: {} });
                } else if (node.tagName === 'P') {
                    blocks.push({ id, type: 'text', data: { text: node.innerHTML }, styles: {} });
                } else if (node.tagName === 'FIGURE' && node.querySelector('img')) {
                    const img = node.querySelector('img');
                    blocks.push({ id, type: 'image', data: { src: img?.src || '', caption: node.querySelector('figcaption')?.textContent || '' }, styles: {} });
                } else if (node.tagName === 'FIGURE' && node.querySelector('audio')) {
                    const audio = node.querySelector('audio');
                    blocks.push({ id, type: 'audio', data: { src: audio?.src || '' }, styles: {} });
                } else if (node.tagName === 'FIGURE' && node.querySelector('video')) {
                    const video = node.querySelector('video');
                    blocks.push({ id, type: 'video', data: { src: video?.src || '' }, styles: {} });
                } else if (node.tagName === 'A' && node.classList.contains('zporta-button')) {
                    const data = {
                      text: node.textContent,
                      href: node.href,
                      variant: Array.from(node.classList).find(c => c.startsWith('zporta-btn--'))?.replace('zporta-btn--', '') || 'primary',
                      size: Array.from(node.classList).find(c => c.startsWith('zporta-btnSize--'))?.replace('zporta-btnSize--', '') || 'md',
                      full: node.classList.contains('zporta-btn--block')
                    };
                    blocks.push({ id, type: 'button', data, styles: {} });
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
                        
                        // --- START FIX ---
                        // Find the panel div specifically
                        const panelDiv = d.querySelector(':scope > div.zporta-acc-panel');
                        let blocksInPanel = [];

                        if (panelDiv) {
                            // Parse the *children* of the panel div, not the div itself
                            blocksInPanel = parseNodes(panelDiv.childNodes);
                        } else {
                            // Fallback: if no panel div, parse whatever other elements are there
                            const otherNodes = Array.from(d.childNodes).filter(n => n.nodeType === ELEMENT_NODE && n.tagName !== 'SUMMARY');
                            if (otherNodes.length > 0) {
                                blocksInPanel = parseNodes(otherNodes);
                            }
                        }
                        // --- END FIX ---

                        items.push({
                            id: uid(),
                            title,
                            blocks: blocksInPanel, // Use the correctly parsed blocks
                        });
                    });
                    blocks.push({ id, type: 'accordion', items, styles: {}, options: {
                        allowMultiple, openFirst: firstIsOpen, radius,
                        theme: themeMatch ? themeMatch.replace('zporta-acc--', '') : 'light',
                        titleAlign, titleSize, icon
                    }});
                    } else if (node.tagName === 'DIV' && node.innerHTML.trim()){
                    // --- START FIX ---
                    // Don't parse the accordion panel wrapper as a block itself.
                    // It is handled by the 'zporta-accordion' block logic.
                    if (node.classList.contains('zporta-acc-panel')) {
                        // Do nothing, ignore this node.
                    } else {
                    // --- END FIX ---
                        console.warn("Parsing unexpected DIV as text block:", node);
                        blocks.push({ id, type: 'text', data: { text: node.innerHTML }, styles: {} });
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

const blocksToHtml = (blocks) => {
    return blocks.map(block => {
        if (!block) return '';
        const styleString = Object.entries(block.styles || {}).map(([k, v]) => `${k.replace(/([A-Z])/g, "-$1").toLowerCase()}:${v}`).join(';');

        switch (block.type) {
            case 'heading':
                return `<h2 style="${styleString}">${block.data.text || ''}</h2>`;
            case 'text':
                return `<p style="${styleString}">${block.data.text || '<br>'}</p>`;
            case 'image':
                return `<figure style="${styleString}"><img src="${block.data.src || ''}" alt="${block.data.caption || ''}" /><figcaption>${block.data.caption || ''}</figcaption></figure>`;
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

const HeadingBlock = ({ id, data, styles: blockStyles, isEditing, onUpdate }) => {
    const handleBlur = useCallback((e) => {
        const updatedText = e.currentTarget.innerHTML;
        if (updatedText !== data.text) {
            onUpdate({ ...data, text: updatedText });
        }
    }, [data, onUpdate]);

    return isEditing ? <div
        contentEditable
        suppressContentEditableWarning
        onBlur={handleBlur}
        className={`${styles.blockInput} ${styles.blockContentEditable} ${styles.headingEditable}`}
        dangerouslySetInnerHTML={{ __html: data.text || '' }}/>
    : <h2 style={blockStyles} dangerouslySetInnerHTML={{ __html: data.text || 'Heading' }}/>;
};

const TextBlock = ({ id, data, styles: blockStyles, isEditing, onUpdate }) => {
     const handleBlur = useCallback((e) => {
        const updatedText = e.currentTarget.innerHTML;
        if (updatedText !== data.text) {
            onUpdate({ ...data, text: updatedText });
        }
    }, [data, onUpdate]);

    return isEditing ? <div
        contentEditable
        suppressContentEditableWarning
        onBlur={handleBlur}
        className={`${styles.blockInput} ${styles.blockContentEditable} ${styles.blockTextarea}`}
        dangerouslySetInnerHTML={{ __html: data.text || '' }} />
    : <p style={blockStyles} dangerouslySetInnerHTML={{ __html: data.text || 'Paragraph text will appear here.' }} />;
};

const ImageBlock = ({ data, styles: blockStyles, isEditing, onUpdate, openImagePicker }) => {
    if (data.uploading) return <div className={styles.uploadingIndicator}>Uploading Image...</div>;
    if (!data.src) {
        return isEditing
            ? <Placeholder icon={<ImageIcon />} title="Image" description="Click to upload an image" onClick={openImagePicker} />
            : null;
    }
    return (
        <figure
            style={blockStyles}
            className={`${styles.imageFigure} ${isEditing ? styles.mediaEditable : ''}`}
            onClick={(e)=>{ if (isEditing) { e.stopPropagation(); openImagePicker(); } }}
            title={isEditing ? 'Click to replace image' : undefined}
        >
            {isEditing && (
                <button type="button" className={styles.mediaGearBtn} onClick={(e)=>{ e.stopPropagation(); openImagePicker(); }} aria-label="Replace image" title="Replace image">
                    <SettingsIcon />
                </button>
            )}
            <img src={data.src} alt={data.caption || ''} className={styles.imageContent}/>
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

const AudioBlock = ({ data, styles: blockStyles, isEditing, openAudioPicker }) => {
    if (data.uploading) return <div className={styles.uploadingIndicator}>Uploading Audio...</div>;
    if (!data.src) {
        return isEditing
            ? <Placeholder icon={<AudioIcon />} title="Audio" description="Click to upload an MP3 file" onClick={openAudioPicker} />
            : null;
    }
    return (
        <div style={blockStyles} className={`${styles.audioWrapper} ${isEditing ? styles.mediaEditable : ''}`}>
            {isEditing && (
                <button type="button" className={styles.mediaGearBtn} onClick={(e)=>{ e.stopPropagation(); openAudioPicker(); }} aria-label="Replace audio" title="Replace audio">
                    <SettingsIcon />
                </button>
            )}
            <audio controls src={data.src} className={styles.audioElement}></audio>
        </div>
    );
};

const VideoBlock = ({ data, styles: blockStyles, isEditing, openVideoPicker }) => {
    if (data.uploading) return <div className={styles.uploadingIndicator}>Uploading Video...</div>;
    if (!data.src) {
        return isEditing
            ? <Placeholder icon={<VideoIcon />} title="Video" description="Click to upload a video file" onClick={openVideoPicker} />
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
                <button type="button" className={styles.mediaGearBtn} onClick={(e)=>{ e.stopPropagation(); openVideoPicker(); }} aria-label="Replace video" title="Replace video">
                    <SettingsIcon />
                </button>
            )}
            <video controls src={data.src} className={styles.videoElement}></video>
        </div>
    );
};

const ButtonBlock = ({ data, styles: blockStyles, isEditing, onUpdate }) => {
    const { text='', href='#', variant='primary', size='md', full=false, align='left', radius='var(--r-md)' } = data || {};
    if (isEditing) {
        return (
            <div className={styles.buttonEditor}>
                <input type="text" value={text} onChange={(e)=>onUpdate({ ...data, text:e.target.value })} placeholder="Button Text"/>
                <input type="url"  value={href} onChange={(e)=>onUpdate({ ...data, href:e.target.value })} placeholder="https://example.com"/>
            </div>
        );
    }
    const cls = `${styles.btn} ${styles[`btn_${variant}`]} ${styles[`btnSize_${size}`]} ${full ? styles.btnBlock : ''}`;
    const style = { ...blockStyles, justifySelf:(align==='center'?'center':align==='right'?'end':'start'), borderRadius:radius };
    return <a href={href} className={cls} style={style}>{text || 'Click Me'}</a>;
};

const ColumnsBlock = ({ id, children, layout, styles: blockStyles, isEditing, onUpdateBlock, onDeleteBlock, onAddBlock, onMoveBlock, openImagePickerFor, openAudioPickerFor, openVideoPickerFor, onShowSettings, onReorderColumn, selectedBlockId, setSelectedBlockId }) => {
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
       className={styles.columnsContainer}
       onMouseDown={(e)=>e.stopPropagation()}
       onClick={(e)=>e.stopPropagation()}
   >
            {(children || []).map((column, colIndex) => (
                <div
                    key={colIndex}
                    className={`${styles.column} ${dropTarget === colIndex ? styles.dropIndicator : ''}`}
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
                        onAddBlock={onAddBlock} // <-- FIX
                        onMoveBlock={onMoveBlock} // Pass down
                        openImagePickerFor={openImagePickerFor}
                        openAudioPickerFor={openAudioPickerFor}
                        openVideoPickerFor={openVideoPickerFor}
                        onShowSettings={onShowSettings}
                        parentId={id}
                        parentIndex={colIndex}  
                        selectedBlockId={selectedBlockId}
                        setSelectedBlockId={setSelectedBlockId}
                    />
                </div>
            ))}
        </div>
    );
};

const AccordionBlock = ({ id, items = [], options = {}, styles: blockStyles, isEditing, onUpdateBlock, onDeleteBlock, onAddBlock, onMoveBlock, onShowSettings, selectedBlockId, setSelectedBlockId, openImagePickerFor, openAudioPickerFor, openVideoPickerFor }) => {

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
            <div key={it.id} className={styles.accItem}>
            <div className={styles.accHeader}>
                {isEditing ? (
                <input
                    className={styles.accTitleInput}
                    value={it.title || ''}
                    onChange={(e)=>updateItemTitle(it.id, e.target.value)}
                    placeholder="Section title"
                    onClick={e=>e.stopPropagation()}
                />
                ) : (
                    <div className={styles.accTitle} style={{ textAlign: options?.titleAlign || 'left', fontSize: options?.titleSize==='sm' ? '0.95rem' : options?.titleSize==='lg' ? '1.15rem' : '1.05rem' }}>
                        {it.title || 'Untitled'}
                    </div>
                )}
                {isEditing && (
                <div className={styles.accHeaderBtns}>
                    <button type="button" className={styles.controlButton} onClick={(e)=>{ e.stopPropagation(); onShowSettings(id); }} title="Accordion settings"><SettingsIcon/></button>
                    <button type="button" className={styles.controlButton} onClick={(e)=>{ e.stopPropagation(); deleteItem(it.id); }} title="Delete section"><TrashIcon/></button>
                </div>
                )}
            </div>
            <div className={styles.accPanel}>
              <div className={styles.accPanelInner}>
                <BlockRenderer
                    blocks={it.blocks}
                    isEditing={isEditing}
                    onUpdateBlock={onUpdateBlock}
                    onDeleteBlock={onDeleteBlock}
                    /* Route all adds/moves explicitly into THIS item by id */
                    onAddBlock={onAddBlock} // <-- FIX
                    onMoveBlock={onMoveBlock}
                    onShowSettings={onShowSettings}
                    selectedBlockId={selectedBlockId}
                    setSelectedBlockId={setSelectedBlockId}
                    openImagePickerFor={openImagePickerFor}
                    openAudioPickerFor={openAudioPickerFor}
                    openVideoPickerFor={openVideoPickerFor}
                    /* For nested operations, bind the parent to the ITEM id */
                    parentId={it.id}
                    parentIndex={null}
                />
              </div>
              </div>
            </div>
        ))}
        {isEditing && (
            <button type="button" className={`${styles.btn} ${styles.btn_secondary} ${styles.btnSize_sm}`} onClick={addItem}>Add section</button>
        )}
        </div>
    );
};

const blockMap = {
    heading: HeadingBlock,
    text: TextBlock,
    image: ImageBlock,
    audio: AudioBlock,
    video: VideoBlock,
    button: ButtonBlock,
    columns: ColumnsBlock,
    accordion: AccordionBlock
};

// --- RENDERER & UI ---
const BlockRenderer = ({
    blocks = [],
    isEditing,
    onUpdateBlock,
    onDeleteBlock,
    onAddBlock,
    onMoveBlock, // Receive move handler
    openImagePickerFor = () => {},
    openAudioPickerFor = () => {},
    openVideoPickerFor = () => {},
    onShowSettings,
    onReorderColumn,
    parentId = null,
    parentIndex = null, // Receive index for nested blocks (columns, accordion items)
    selectedBlockId,
    setSelectedBlockId,
    suppressTerminalAddAtEnd = false
}) => (
    <div className={styles.renderer}>
        {blocks.map((block, index) => {
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
            const isSelected = isEditing && block.id === selectedBlockId;

            return (
                <div key={block.id} className={styles.blockContainer}>
                    <div
                        className={`${styles.blockWrapper} ${!hasContent && isEditing ? styles.blockWrapperEmpty : ''} ${isSelected ? styles.blockWrapperSelected : ''}`}
                        onClick={(e) => {
                            if (isEditing) {
                                e.stopPropagation();
                                setSelectedBlockId(block.id);
                            }
                        }}
                    >
                        {isEditing && (
                            <div className={styles.blockControls}>
                                <button type="button" onClick={(e) => { e.stopPropagation(); onMoveBlock(block.id, index, -1, parentId, parentIndex); }} className={styles.controlButton} title="Move Up" disabled={index === 0}><MoveUpIcon /></button>
                                <button type="button" onClick={(e) => { e.stopPropagation(); onMoveBlock(block.id, index, 1, parentId, parentIndex); }} className={styles.controlButton} title="Move Down" disabled={index === blocks.length - 1}><MoveDownIcon /></button>
                                <button type="button" onClick={(e) => { e.stopPropagation(); onAddBlock(block.type, index + 1, parentId, parentIndex, block); /* Pass block for duplication */ }} className={styles.controlButton} title="Duplicate Block"><DuplicateIcon /></button>
                                <button type="button" onClick={(e) => { e.stopPropagation(); onShowSettings(block.id); }} className={styles.controlButton} title="Settings & Layout"><SettingsIcon /></button>
                                <button type="button" onClick={(e) => { e.stopPropagation(); onDeleteBlock(block.id); }} className={`${styles.controlButton} ${styles.deleteButton}`} title="Delete Block"><TrashIcon /></button>
                            </div>
                        )}
                        <Component
                            {...block}
                            isEditing={isEditing}
                            onUpdate={(newData) => {
                                const updatedData = typeof newData === 'object' ? newData : { text: newData };
                                onUpdateBlock(block.id, { data: { ...(block.data || {}), ...updatedData } });
                            }}
                            openImagePicker={() => openImagePickerFor(block.id)}
                            openAudioPicker={() => openAudioPickerFor(block.id)}
                            openVideoPicker={() => openVideoPickerFor(block.id)}
                            // Pass necessary props down to nested components like ColumnsBlock and AccordionBlock
                            onUpdateBlock={onUpdateBlock}
                            onDeleteBlock={onDeleteBlock}
                            onAddBlock={onAddBlock}
                            onMoveBlock={onMoveBlock} // Pass down move handler
                            onShowSettings={onShowSettings}
                            onReorderColumn={onReorderColumn} // Only relevant for ColumnsBlock
                            selectedBlockId={selectedBlockId}
                            setSelectedBlockId={setSelectedBlockId}
                            openImagePickerFor={openImagePickerFor} // Pass down specific pickers
                            openAudioPickerFor={openAudioPickerFor}
                            openVideoPickerFor={openVideoPickerFor}
                            parentId={parentId} // keep the same parent container id
                            parentIndex={parentIndex}  // Pass index within the current list
                        />
                    </div>
                    {isEditing && !(
                        suppressTerminalAddAtEnd &&
                        index === blocks.length - 1
                    ) && (
                        <AddBlockButton onAdd={(type) => onAddBlock(type, index + 1, parentId, parentIndex)} />
                    )}
                </div>
            );
        })}
        {isEditing && blocks.length === 0 && (
            <div className={styles.emptyEditorState}><AddBlockButton onAdd={(type) => onAddBlock(type, 0, parentId, parentIndex)} isFirst={true} /></div>
        )}
    </div>
);

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
        { type: 'heading', label: 'Heading', icon: <HeadingIcon/> },
        { type: 'text', label: 'Text', icon: <TextIcon/> },
        { type: 'image', label: 'Image', icon: <ImageIcon/> },
        { type: 'audio', label: 'Audio', icon: <AudioIcon/> },
        { type: 'video', label: 'Video', icon: <VideoIcon/> },
        { type: 'button', label: 'Button', icon: <ButtonIcon/> },
        { type: 'columns', label: 'Columns', icon: <ColumnsIcon/> },
        { type: 'accordion', label: 'Accordion', icon: <AccordionIcon/> }
    ];
    //const handleAdd = (type) => { onAdd(type); setIsOpen(false); }
    const handleAdd = (type, e) => {
        if (e) e.stopPropagation();
        onAdd(type);
        setIsOpen(false);
    }

    return (
        <div className={`${styles.addBlockWrapper} ${isFirst ? styles.addBlockWrapperFirst : ''}`}>
            <div className={styles.addBlockLine}></div>
            <div className={styles.addBlockButtonContainer}>
                <button type="button" onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }} className={styles.addBlockButton} aria-label="Add new block" aria-haspopup="true" aria-expanded={isOpen}>
                    <PlusIcon />
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

// Helper to convert hex to rgba for transparent previews
const hexToRgba = (hex, alpha = 1) => {
    const bigint = parseInt(hex.slice(1), 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const SettingsPanel = ({ block, onUpdateStyle, onUpdateLayout, onUpdateBlock, onClose }) => {
    const panelRef = useRef();
    const [localStyles, setLocalStyles] = useState(block.styles || {});
    // State to manage the text input for color, synced with the color picker
    const [bgColorText, setBgColorText] = useState(localStyles.backgroundColor || '#ffffff');

    useEffect(() => {
        const initialStyles = block.styles || {};
        setLocalStyles(initialStyles);
        setBgColorText(initialStyles.backgroundColor || '#ffffff');
    }, [block.styles]);

    useEffect(() => {
        const handleClickOutside = (event) => { if (panelRef.current && !panelRef.current.contains(event.target)) onClose(); };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [onClose]);

    // Handles changes from the color input (type="color")
    const handleColorInputChange = (e) => {
        const { name, value } = e.target;
        const newStyles = { ...localStyles, [name]: value };
        setLocalStyles(newStyles);
        setBgColorText(value); // Sync text input
        onUpdateStyle(block.id, newStyles);
    };

    // Handles changes from the text input for color
    const handleColorTextChange = (e) => {
        const newValue = e.target.value;
        setBgColorText(newValue);
        // Basic validation for hex color
        if (/^#[0-9A-F]{6}$/i.test(newValue) || /^#[0-9A-F]{3}$/i.test(newValue)) {
            const newStyles = { ...localStyles, backgroundColor: newValue };
            setLocalStyles(newStyles);
            onUpdateStyle(block.id, newStyles);
        }
    };

     // Handles generic style changes (padding, border, etc.)
     const handleGenericStyleChange = (e) => {
        const { name, value } = e.target;
        const newStyles = { ...localStyles, [name]: value };
        setLocalStyles(newStyles);
        onUpdateStyle(block.id, newStyles);
    };

    return (
        <div className={styles.settingsPanelWrapper}>
            <div className={styles.settingsPanel} ref={panelRef}>
                <button onClick={onClose} className={styles.settingsCloseButton} aria-label="Close settings">&times;</button>
                {block.type === 'button' && (
                    <>
                        <h4>Button Options</h4>
                        <div className={styles.csGroup}>
                            <label>Variant</label>
                            <div className={styles.csBtnGroup}>
                                {['primary','secondary','ghost','link'].map(v=>(
                                    <button key={v} className={block.data?.variant===v?styles.active:''} onClick={()=>onUpdateBlock(block.id,{ data:{...block.data, variant:v}})}>{v}</button>
                                ))}
                            </div>
                        </div>
                        <div className={styles.csGroup}>
                            <label>Size</label>
                            <div className={styles.csBtnGroup}>
                                {['sm','md','lg'].map(s=>(
                                    <button key={s} className={block.data?.size===s?styles.active:''} onClick={()=>onUpdateBlock(block.id,{ data:{...block.data, size:s}})}>{s.toUpperCase()}</button>
                                ))}
                            </div>
                        </div>
                        <div className={styles.csGroup}>
                             <label className={styles.csCheckboxLabel}>
                                <input type="checkbox" checked={!!block.data?.full} onChange={(e)=>onUpdateBlock(block.id,{ data:{...block.data, full:e.target.checked}})}/>
                                <span>Full width</span>
                             </label>
                        </div>
                        <div className={styles.csGroup}>
                            <label>Align</label>
                            <div className={styles.csBtnGroup}>
                                {['left','center','right'].map(a=>(
                                    <button key={a} className={block.data?.align===a?styles.active:''} onClick={()=>onUpdateBlock(block.id,{ data:{...block.data, align:a}})}>{a}</button>
                                ))}
                            </div>
                        </div>
                        <div className={styles.styleControl}>
                            <label>Corner radius</label>
                            <input type="text" value={block.data?.radius||'var(--r-md)'} onChange={(e)=>onUpdateBlock(block.id,{ data:{...block.data, radius:e.target.value}})} placeholder="e.g., 8px or var(--r-lg)"/>
                        </div>
                    </>
                )}
                {block.type === 'accordion' && (
                    <>
                        <h4>Accordion Options</h4>
                        <div className={styles.csGroup}>
                             <label className={styles.csCheckboxLabel}>
                                 <input type="checkbox" checked={!!block.options?.allowMultiple} onChange={(e)=>onUpdateBlock(block.id,{ options:{ ...(block.options||{}), allowMultiple:e.target.checked }})}/>
                                 <span>Allow multiple open</span>
                             </label>
                        </div>
                        <div className={styles.csGroup}>
                            <label>Title size</label>
                            <div className={styles.csBtnGroup}>
                                {['sm','md','lg'].map(s=>(
                                    <button key={s} className={block.options?.titleSize===s?styles.active:''} onClick={()=>onUpdateBlock(block.id,{ options:{...block.options, titleSize:s}})}>{s.toUpperCase()}</button>
                                ))}
                            </div>
                        </div>
                        <div className={styles.csGroup}>
                            <label>Title align</label>
                            <div className={styles.csBtnGroup}>
                                {['left','center','right'].map(a=>(
                                    <button key={a} className={block.options?.titleAlign===a?styles.active:''} onClick={()=>onUpdateBlock(block.id,{ options:{...block.options, titleAlign:a}})}>{a}</button>
                                ))}
                            </div>
                        </div>
                        <div className={styles.csGroup}>
                            <label>Toggle icon</label>
                            <div className={styles.csBtnGroup}>
                                {['chevron','plus','none'].map(i=>(
                                    <button key={i} className={block.options?.icon===i?styles.active:''} onClick={()=>onUpdateBlock(block.id,{ options:{...block.options, icon:i}})}>{i}</button>
                                ))}
                            </div>
                        </div>
                        <div className={styles.csGroup}>
                            <label>Theme</label>
                            <div className={styles.csBtnGroup}>
                                {['light','dark','outline'].map(t=>(
                                    <button key={t} className={block.options?.theme===t?styles.active:''} onClick={()=>onUpdateBlock(block.id,{ options:{...block.options, theme:t}})}>{t}</button>
                                ))}
                            </div>
                        </div>
                         <div className={styles.csGroup}>
                            <label className={styles.csCheckboxLabel}>
                                <input type="checkbox" checked={!!block.options?.openFirst} onChange={(e)=>onUpdateBlock(block.id,{ options:{...block.options, openFirst:e.target.checked}})} />
                                <span>Open first section by default</span>
                             </label>
                         </div>
                        <div className={styles.styleControl}>
                            <label>Corner radius</label>
                            <input type="text" value={block.options?.radius||'8px'} onChange={(e)=>onUpdateBlock(block.id,{ options:{...block.options, radius:e.target.value}})} placeholder="e.g., 8px or var(--r-md)"/>
                        </div>
                    </>
                )}
                {block.type==='columns' ? (
                    <ColumnSettings block={block} onUpdateLayout={onUpdateLayout} />
                ) : block.type!=='button' && block.type!=='accordion' ? (
                    <>
                        <h4>Block Styles</h4>
                        <div className={`${styles.styleControl} ${styles.colorControl}`}>
                            <label htmlFor={`bgColor-${block.id}`}>Background</label>
                            <div className={styles.colorInputWrapper}>
                                <div className={styles.colorPreview} style={{ backgroundColor: localStyles.backgroundColor || '#ffffff' }}>
                                    <PaletteIcon />
                                    <input
                                        id={`bgColor-${block.id}`}
                                        type="color"
                                        name="backgroundColor"
                                        value={localStyles.backgroundColor || '#ffffff'}
                                        onChange={handleColorInputChange}
                                        className={styles.colorPickerInput}
                                    />
                                </div>
                                <input
                                    type="text"
                                    value={bgColorText}
                                    onChange={handleColorTextChange}
                                    className={styles.colorTextInput}
                                    placeholder="#ffffff"
                                />
                            </div>
                        </div>
                        <div className={styles.styleControl}>
                            <label>Padding</label>
                            <input type="text" name="padding" value={localStyles.padding || ''} onChange={handleGenericStyleChange} placeholder="e.g., 1rem or 10px 20px" />
                        </div>
                        <div className={styles.styleControl}>
                            <label>Border</label>
                            <input type="text" name="border" value={localStyles.border || ''} onChange={handleGenericStyleChange} placeholder="e.g., 1px solid #ccc" />
                        </div>
                        <div className={styles.styleControl}>
                             <label>Border Radius</label>
                             <input type="text" name="borderRadius" value={localStyles.borderRadius || ''} onChange={handleGenericStyleChange} placeholder="e.g., 8px or var(--r-md)" />
                        </div>
                    </>
                ) : null}
            </div>
        </div>
    );
};

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
                value={inputValue}
                onChange={handleInputChange}
                placeholder="e.g. 30 70 or 100 for stack"
                className={`${styles.csCustomInput} ${error ? styles.inputError : ''}`}
            />
            {error && <p className={styles.csValidationError}>{error}</p>}
        </div>
    );
};

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
    }, [block.layout, localLayout]);

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
            <h4>Column Layout</h4>
            <div className={styles.csGroup}>
                <label>Number of Columns</label>
                <div className={styles.csBtnGroup}>
                    {[1, 2, 3, 4].map(num => (
                        <button key={num} onClick={() => handleColumnCountChange(num)} className={localLayout.columns === num ? styles.active : ''}>{num}</button>
                    ))}
                </div>
            </div>
            <hr className={styles.csSeparator} />
            {BREAKPOINTS.map(bp => (
                <div key={bp} className={styles.csGroup}>
                    <label>{BREAKPOINT_MAP[bp]}</label>
                    {localLayout.columns > 1 && bp !== 'base' && (
                        <div className={styles.csPresets}>
                            {(COLUMN_PRESETS[localLayout.columns] || []).map((preset, i) => (
                                <button
                                    key={i}
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

// --- EDITOR ROOT COMPONENT ---
const LessonEditor = forwardRef(({ initialContent = '', mediaCategory = 'general', externalCss = '', onEditorReady }, ref) => {
    const editorRootRef = useRef(null);
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
    const [editingStylesFor, setEditingStylesFor] = useState(null);
    const [selectedBlockId, setSelectedBlockId] = useState(null);
    const [isCodeDirty, setIsCodeDirty] = useState(false);
    const codeDebounceRef = useRef(null);
    const isProcessingBlur = useRef(false); // Ref to track blur processing

     useEffect(() => {
        setIsMounted(true);
        setBlocks(htmlToBlocks(initialContent)); // Initialize blocks here after mount
        const themeEl = document.createElement('style');
        themeEl.id = themeStyleId;
        document.head.appendChild(themeEl);
        return () => { try { themeEl.remove(); } catch {} };
    }, [themeStyleId]); // Only run on mount/unmount

    useEffect(() => {
        if (isMounted) {
             console.log("[LessonEditor] Initial content prop changed, re-parsing HTML to blocks.");
             setBlocks(htmlToBlocks(initialContent));
        }
    }, [initialContent, isMounted]); // Rerun if initialContent changes *after* mount


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
        const finalHtml = `<div class="${WRAPPER_CLASS}">${html}</div>`;
        const oneStyle = `<style>${STRUCTURAL_CSS}</style>`; // No need to prefix structural CSS
        return `${oneStyle}\n${finalHtml}`.trim();
    }, []);

    useImperativeHandle(ref, () => ({
        async flush() {
            console.log("[LessonEditor] flush() called.");
            const root = editorRootRef.current;
            if (!root) {
                console.log("[LessonEditor] No editor root found.");
                return;
            }

            let activeElement = document.activeElement;
            let needsBlur = false;
            let elementToBlur = null;

            if (activeElement && root.contains(activeElement) && activeElement.isContentEditable) {
                 console.log("[LessonEditor] Active element needs blur:", activeElement);
                 needsBlur = true;
                 elementToBlur = activeElement;
            } else {
                // Check if any block input is focused even if not activeElement (e.g., iframe focus issue)
                const focusedInput = root.querySelector('[contenteditable="true"]:focus');
                if(focusedInput) {
                    console.log("[LessonEditor] Found focused editable, needs blur:", focusedInput);
                    needsBlur = true;
                    elementToBlur = focusedInput;
                } else {
                   console.log("[LessonEditor] No contentEditable element has focus.");
                }
            }

            if (needsBlur && elementToBlur) {
                isProcessingBlur.current = true; // Set flag before blurring
                console.log("[LessonEditor] Blurring element:", elementToBlur);
                elementToBlur.blur(); // Triggers the onBlur handler which updates state
                // Wait a short time for React state update triggered by blur
                await new Promise(resolve => setTimeout(resolve, 50));
                isProcessingBlur.current = false; // Clear flag after timeout
                console.log("[LessonEditor] Blur processing finished.");
            } else {
                 console.log("[LessonEditor] No blur needed or no element to blur.");
            }
        },
        getContent: () => {
             if (isProcessingBlur.current) {
                 console.warn("[LessonEditor] getContent called while blur is processing. Content might be stale.");
             }
             console.log("[LessonEditor] getContent() called. Current blocks state:", blocks);
             const result = generateFinalHtml(blocks);
             console.log("[LessonEditor] getContent() returning HTML"); // Avoid logging potentially large HTML string
             return result;
        },
        getAppliedCSS: () => appliedCss,
        setCSS: (css) => applyCssToEditor(css || ''),
    }), [blocks, generateFinalHtml, appliedCss, applyCssToEditor, editorId]); // Include dependencies

    // Recursive helper to find and modify/delete/insert blocks
    const findAndModifyBlockRecursive = useCallback((targetBlocks, targetId, callback) => {
        let changed = false;
        const result = targetBlocks.reduce((acc, block) => {
            if (!block) return acc;

            // Direct match
            if (block.id === targetId) {
                const modifiedBlock = callback(block);
                if (modifiedBlock) acc.push(modifiedBlock); // Add if callback returns a block (update/keep)
                changed = true; // Mark change even if deleted (callback returns null)
                return acc;
            }

            // Recurse into Columns
            if (block.type === 'columns' && Array.isArray(block.children)) {
                let childChanged = false;
                const newChildren = block.children.map(col => {
                    const resultCol = findAndModifyBlockRecursive(col || [], targetId, callback);
                    if (resultCol !== (col || [])) { // Check if the array itself changed
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

            // Recurse into Accordion Items
             if (block.type === 'accordion' && Array.isArray(block.items)) {
                let itemChanged = false;
                const newItems = block.items.map(item => {
                    const newBlocks = findAndModifyBlockRecursive(item.blocks || [], targetId, callback);
                    if (newBlocks !== (item.blocks || [])) {
                        itemChanged = true;
                        return { ...item, blocks: newBlocks };
                    }
                    return item;
                });
                 if (itemChanged) {
                    acc.push({ ...block, items: newItems });
                    changed = true;
                } else {
                    acc.push(block);
                }
                return acc;
            }

            // No match, keep block
            acc.push(block);
            return acc;
        }, []);

        // Return the original array if no changes were made, otherwise the new array
        return changed ? result : targetBlocks;
    }, []);
    
     // Recursive helper to insert a block (fixed)
     const insertBlockRecursive = useCallback(
       (targetBlocks, insertIndex, newBlock, parentId, colIndexOrItemIdx) => {
         // Insert at current level
         if (parentId === null) {
           const arr = [...targetBlocks];
           arr.splice(insertIndex, 0, newBlock);
           return arr;
         }

         let changed = false;
         const next = targetBlocks.map(block => {
           if (!block) return block;
       // ✅ NEW: If parentId matches an ACCORDION *ITEM* id, insert into that item's blocks
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

           // Direct parent
           if (block.id === parentId) {
             // Columns: insert into children[colIndex]
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
             // Accordion: insert into items[idx].blocks
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
        // NEW: if parentId matches an ACCORDION *ITEM* id, insert there
        if (block.type === 'accordion' && Array.isArray(block.items)) {
          const items = [...block.items];
          const foundIdx = items.findIndex(it => it && it.id === parentId);
          if (foundIdx !== -1) {
            const item = items[foundIdx];
            const b = [...(item.blocks || [])];
            b.splice(insertIndex, 0, newBlock);
            items[foundIdx] = { ...item, blocks: b };
            changed = true;
            return { ...block, items };
          }
        }

           // Recurse: columns
           if (block.type === 'columns' && Array.isArray(block.children)) {
             const newChildren = block.children.map(col =>
               insertBlockRecursive(col || [], insertIndex, newBlock, parentId, colIndexOrItemIdx)
             );
             if (newChildren.some((col, i) => col !== (block.children[i] || []))) {
               changed = true;
               return { ...block, children: newChildren };
             }
           }

           // Recurse: accordion items
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

    const handleUpdateBlock = useCallback((blockId, newBlockData) => {
         if (isProcessingBlur.current) {
             console.log("[LessonEditor] Skipping update during blur processing for block:", blockId);
             return; // Avoid state update while blur is explicitly handled by flush
         }
        console.log(`[LessonEditor] handleUpdateBlock called for ID: ${blockId}`);
        setBlocks(currentBlocks => {
            const updatedBlocks = findAndModifyBlockRecursive(currentBlocks, blockId, block => ({
                ...block,
                ...newBlockData
            }));
             if (updatedBlocks === currentBlocks) {
                 console.log("[LessonEditor] No change detected in handleUpdateBlock.");
             } else {
                 console.log("[LessonEditor] Blocks state updated via handleUpdateBlock.");
             }
            return updatedBlocks;
        });
    }, [findAndModifyBlockRecursive]);

    const handleDeleteBlock = useCallback((blockId) => {
        setBlocks(current => findAndModifyBlockRecursive(current, blockId, () => null)); // Callback returns null to delete
        // If the deleted block was selected, deselect
        if (selectedBlockId === blockId) {
            setSelectedBlockId(null);
        }
         // Also close settings panel if it was open for the deleted block
        if (editingStylesFor === blockId) {
            setEditingStylesFor(null);
        }
    }, [findAndModifyBlockRecursive, selectedBlockId, editingStylesFor]);

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
            // Deep clone the block to duplicate, generating new IDs for nested elements
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
                        id: uid(), // New ID for item
                        blocks: item.blocks ? item.blocks.map(cloneWithNewIds) : []
                    }));
                }

                return {
                    ...block,
                    id: newId,
                    data: clonedData,
                    styles: clonedStyles,
                    options: clonedOptions,
                    children: clonedChildren,
                    items: clonedItems
                };
            };
            newBlock = cloneWithNewIds(blockToDuplicate);
        } else {
            // Create a new default block
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
        setSelectedBlockId(newBlock.id); // Select the newly added/duplicated block
    }, [insertBlockRecursive]);


    const handleMoveBlock = useCallback((blockId, currentIndex, direction, parentId, parentIndex) => {
        const newIndex = currentIndex + direction;

        setBlocks(currentBlocks => {
            let blockToMove = null;
            let sourceArray = null;
            let changed = false;

            // Find and remove the block from its current position recursively
            const findAndRemove = (blocksArray) => {
                if (!Array.isArray(blocksArray)) return blocksArray;
                const index = blocksArray.findIndex(b => b && b.id === blockId);
                if (index !== -1) {
                    blockToMove = blocksArray[index];
                    sourceArray = blocksArray; // Reference to modify later
                    return [...blocksArray.slice(0, index), ...blocksArray.slice(index + 1)];
                }

                // Recurse
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
                console.warn("Could not find block to move:", blockId);
                return currentBlocks; // Block not found or already moved
            }

             // Now insert the block at the new position
            return insertBlockRecursive(blocksWithoutMoved, newIndex, blockToMove, parentId, parentIndex);

        });
    }, [insertBlockRecursive]); // Dependencies will include helpers if they are not useCallback


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
                setBlocks(current => findAndModifyBlockRecursive(current, blockId, block => ({ ...block, data: { ...(block.data || {}), src: response.data.url, uploading: false } })));
            } else { throw new Error(response.data.error || 'Upload failed.'); }
        } catch (err) {
            setUploadError(err.message || `A server error occurred.`);
             setBlocks(current => findAndModifyBlockRecursive(current, blockId, block => ({...block, data: { ...(block.data || {}), uploading: false }})));
        }
    };

    const renderedPreview = useMemo(() => <BlockRenderer blocks={blocks} isEditing={false} />, [blocks]);

    const editingBlock = useMemo(() => {
        if (!editingStylesFor) return null;
        let foundBlock = null;
        const findBlockRecursive = (blockArray) => {
             if (!Array.isArray(blockArray)) return;
             for (const block of blockArray) {
                 if (!block) continue;
                 if (block.id === editingStylesFor) { foundBlock = block; return; }
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
    }, [editingStylesFor, blocks]);


    useEffect(() => {
        if (view !== 'code' || !isCodeDirty) {
            setCodeText(generateFinalHtml(blocks));
             if (view !== 'code') setIsCodeDirty(false);
        }
    }, [blocks, view, isCodeDirty, generateFinalHtml]); // Added isCodeDirty dependency

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
     }, [codeImportEnabled]); // Removed setBlocks from deps

    const handleImportCode = useCallback(() => {
        try {
            setCodeError('');
            const newBlocks = htmlToBlocks(codeText || '');
            setBlocks(newBlocks);
            setIsCodeDirty(false); // Mark as clean after successful import
        } catch (e) { setCodeError('Invalid HTML. Please check code.'); }
    }, [codeText]); // Removed setBlocks from deps


    useEffect(() => { // Sync back changes from code view if enabled and dirty when switching tabs
        if (view !== 'code' && codeImportEnabled && isCodeDirty) {
             try {
                 const newBlocks = htmlToBlocks(codeText);
                 setBlocks(newBlocks);
                 setCodeError('');
                 setIsCodeDirty(false);
             } catch (e) { setCodeError('Invalid HTML.'); }
        }
     }, [view, codeImportEnabled, isCodeDirty, codeText]); // Removed setBlocks

    useEffect(() => { // Cleanup debounce timer
        return () => { if (codeDebounceRef.current) clearTimeout(codeDebounceRef.current); };
    }, []);

    if (!isMounted) return <div className={styles.loadingState}>Loading Editor...</div>;

    return (
        <div id={editorId} className={styles.editorContainer} ref={editorRootRef}>
            <header className={styles.header}>
                <h1>Lesson Editor</h1>
                <p>Visually build your lesson page, block by block.</p>
            </header>
            {uploadError && <div className={styles.uploadError} onClick={() => setUploadError('')}>{uploadError} (click to dismiss)</div>}

            <div className={styles.editorWrapper}>
                <div className={styles.tabs}>
                    <div>
                        <button onClick={() => setView('editor')} className={`${styles.tabButton} ${view === 'editor' ? styles.active : ''}`}>Editor</button>
                        <button onClick={() => setView('preview')} className={`${styles.tabButton} ${view === 'preview' ? styles.active : ''}`}>Preview</button>
                        <button onClick={() => setView('code')} className={`${styles.tabButton} ${view === 'code' ? styles.active : ''}`}>Code</button>
                    </div>
                    {view === 'preview' && (
                        <div className={styles.deviceToggles}>
                            <button onClick={()=> setPreviewDevice('desktop')} className={previewDevice === 'desktop' ? styles.active : ''} title="Desktop View"><DesktopIcon /></button>
                            <button onClick={()=> setPreviewDevice('tablet')} className={previewDevice === 'tablet' ? styles.active : ''} title="Tablet View"><TabletIcon /></button>
                            <button onClick={()=> setPreviewDevice('mobile')} className={previewDevice === 'mobile' ? styles.active : ''} title="Mobile View"><MobileIcon /></button>
                        </div>
                    )}
                </div>

                <div className={styles.contentArea}>
                    {view === 'editor' ? (
                        <div className={styles.editorView} onClick={() => setSelectedBlockId(null)}>
                            <BlockRenderer
                                blocks={blocks}
                                isEditing={true}
                                onUpdateBlock={handleUpdateBlock}
                                onDeleteBlock={handleDeleteBlock}
                                onAddBlock={handleAddBlock}
                                onMoveBlock={handleMoveBlock} // Pass move handler
                                openImagePickerFor={openImagePickerFor}
                                openAudioPickerFor={openAudioPickerFor}
                                openVideoPickerFor={openVideoPickerFor}
                                onShowSettings={setEditingStylesFor}
                                onReorderColumn={handleReorderColumn}
                                selectedBlockId={selectedBlockId}
                                setSelectedBlockId={setSelectedBlockId}
                            />
                            {editingBlock && <SettingsPanel
                                block={editingBlock}
                                onUpdateStyle={handleUpdateStyle}
                                onUpdateBlock={handleUpdateBlock}
                                onUpdateLayout={handleUpdateLayout}
                                onClose={() => setEditingStylesFor(null)}
                            />}
                        </div>
                    ) : view === 'preview' ? (
                        <div className={`${styles.previewWrapper} ${styles[previewDevice]}`}>
                            <div className={styles.previewView}>{renderedPreview}</div>
                        </div>
                    ) : ( // Code View
                        <div className={styles.codeView}>
                            <div className={styles.codeToolbar}>
                                <label className={styles.codeToggle}>
                                    <input type="checkbox" checked={codeImportEnabled} onChange={(e)=>setCodeImportEnabled(e.target.checked)} />
                                    Enable import/edit
                                </label>
                                <div className={styles.codeActions}>
                                    <button type="button" className={`${styles.btn} ${styles.btn_secondary} ${styles.btnSize_sm}`} onClick={handleCopyCode}>Copy</button>
                                    <button type="button" className={`${styles.btn} ${styles.btn_primary} ${styles.btnSize_sm}`} onClick={handleImportCode} disabled={!codeImportEnabled} title={codeImportEnabled ? 'Import pasted code' : "Check 'Enable import/edit' first"}>
                                        Import
                                    </button>
                                </div>
                            </div>
                            {codeError && (<div className={styles.uploadError} onClick={()=>setCodeError('')}>{codeError} (click to dismiss)</div>)}
                            <textarea
                                className={styles.codeTextarea}
                                value={codeText}
                                onChange={(e)=> handleCodeChange(e.target.value)}
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
            </div>

            {/* Optional Debug Panel */}
            {/* <div className={styles.debugView}><h4>Live State (Blocks)</h4><pre>{JSON.stringify(blocks, null, 2)}</pre></div> */}

            {/* Hidden File Inputs */}
            <input ref={imageUploadInputRef} type="file" accept="image/*,.png,.jpg,.jpeg,.gif,.webp,.svg" onChange={(e) => handleFileUpload(e, 'image')} className={styles.visuallyHiddenInput} tabIndex={-1} aria-hidden="true" />
            <input ref={audioUploadInputRef} type="file" accept="audio/*,.mp3,.wav,.m4a,.ogg,.aac" onChange={(e) => handleFileUpload(e, 'audio')} className={styles.visuallyHiddenInput} tabIndex={-1} aria-hidden="true" />
            <input ref={videoUploadInputRef} type="file" accept="video/*,.mp4,.mov,.avi,.webm,.ogg" onChange={(e) => handleFileUpload(e, 'video')} className={styles.visuallyHiddenInput} tabIndex={-1} aria-hidden="true" />
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
                    // Handle direct descendant and other combinators carefully
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
