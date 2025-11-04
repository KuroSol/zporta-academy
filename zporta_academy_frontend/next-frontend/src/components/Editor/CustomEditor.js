import React, {
    useRef,
    useState,
    useEffect,
    useImperativeHandle,
    forwardRef,
    useCallback,
    useMemo
} from 'react';

// Use your real API client
import apiClient from '@/api';

/**
 * A professional-grade, feature-rich, and self-contained WYSIWYG editor for React.
 * Merges advanced functionality (accordions, layouts) with a modern, responsive design.
 */
const CustomEditor = forwardRef(({
    placeholder = 'Start writing...',
    initialContent = '',
    mediaCategory = 'general',
    editable = true,
    enablePrivacyToggle = false,
}, ref) => {

    // --- REFS --- //
    const editorRef = useRef(null);
    const imageUploadInputRef = useRef(null);
    const audioUploadInputRef = useRef(null);
    const wordUploadInputRef = useRef(null);
    const linkPopoverRef = useRef(null);
    const editorId = useMemo(() => `custom-editor-${Math.random().toString(36).substr(2, 9)}`, []);


    // --- STATE MANAGEMENT --- //
    const [content, setContent] = useState('');
    const [isMounted, setIsMounted] = useState(false);
    const [isMammothLoaded, setIsMammothLoaded] = useState(false);
    const [wordCount, setWordCount] = useState(0);
    const [viewSource, setViewSource] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [uploadError, setUploadError] = useState('');
    const [selectedElement, setSelectedElement] = useState(null);
    const [elementToReplace, setElementToReplace] = useState(null);
    const [modal, setModal] = useState({ isOpen: false, type: null, data: null });
    const [activeFormats, setActiveFormats] = useState({});
    const [linkPopover, setLinkPopover] = useState({ visible: false, target: null, href: '' });
    const [privacy, setPrivacy] = useState('private');

    // --- LIFECYCLE & CONTENT SYNC --- //

    useEffect(() => {
        // Dynamically load the Mammoth.js script for Word document conversion
        const mammothScript = document.createElement('script');
        mammothScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.7.0/mammoth.browser.min.js';
        mammothScript.async = true;
        mammothScript.onload = () => setIsMammothLoaded(true);
        document.body.appendChild(mammothScript);
        
        // Inject the editor's scoped styles into the document head
        const styleElement = document.createElement('style');
        styleElement.id = `${editorId}-styles`;
        styleElement.innerHTML = getEditorStyles(editorId);
        document.head.appendChild(styleElement);


        setIsMounted(true);
        if (initialContent) {
            setContent(initialContent);
        }

        return () => {
            if (mammothScript.parentNode) document.body.removeChild(mammothScript);
            if (styleElement.parentNode) document.head.removeChild(styleElement);
        };
    }, [editorId, initialContent]);

    useEffect(() => {
        // Sync the editor's innerHTML with the component's state
        if (isMounted && !viewSource && editorRef.current) {
            if (editorRef.current.innerHTML !== content) {
                editorRef.current.innerHTML = content;
                // Add empty paragraphs at the start/end if content starts/ends with a media block
                ensureCursorSpace(editorRef.current);
                // Re-attach listeners to dynamically added content
                addClickListenersToMedia(editorRef.current);
                enableResizingForExistingImages(editorRef.current);
            }
            updateWordCount(editorRef.current.innerText);
        } else if (viewSource) {
            updateWordCount(content);
        }
    }, [content, viewSource, isMounted]);

    // --- IMPERATIVE HANDLE --- //
    // Exposes specific functions to parent components via the ref
    useImperativeHandle(ref, () => ({
        getContent: () => viewSource ? content : (editorRef.current?.innerHTML || ''),
        getPrivacy: () => privacy,
        clearEditorSelection: clearSelection,
        focus: () => editorRef.current?.focus(),
    }));

    // --- CORE EDITOR LOGIC --- //
    const updateStateFromEditor = useCallback(() => {
        if (editorRef.current && !viewSource) {
            const currentHTML = editorRef.current.innerHTML;
            if (content !== currentHTML) {
                setContent(currentHTML);
            }
            updateWordCount(editorRef.current.innerText);
            updateActiveFormats();
        }
    }, [content, viewSource]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleCommand = (command, value = null) => {
        if (editable && !viewSource && editorRef.current) {
            document.execCommand(command, false, value);
            editorRef.current.focus();
            updateStateFromEditor();
        }
    };

    // Inserts a new DOM element at the cursor position
    const insertElementAndFocus = (element) => {
        if (!editorRef.current || viewSource) return;
        editorRef.current.focus();
        const selection = window.getSelection();
        const range = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;

        if (range) {
            range.deleteContents();
            range.insertNode(element);
        } else {
            editorRef.current.appendChild(element);
        }
        
        // Add click listener if it's a custom block
        if (element.matches('[data-editable-block]')) {
             element.addEventListener('click', handleElementClick);
        }

        // Create a new paragraph after the inserted element to ensure the user can keep typing.
        const newParagraph = document.createElement('p');
        newParagraph.innerHTML = '<br>'; // Use a <br> to ensure it has height and is a valid new line.
        
        // Insert the new paragraph immediately after the media element.
        // Using parentNode ensures this works even if the element was inserted into another node.
        if (element.parentNode) {
            element.parentNode.insertBefore(newParagraph, element.nextSibling);
        }

        // Move the cursor into the new paragraph
        const newRange = document.createRange();
        newRange.setStart(newParagraph, 0);
        newRange.collapse(true);

        if (selection) {
            selection.removeAllRanges();
            selection.addRange(newRange);
        }
        updateStateFromEditor();
    };


    // --- SELECTION & FORMATTING STATE --- //
    const updateActiveFormats = useCallback(() => {
        if (viewSource || !document.queryCommandState) return;
        setActiveFormats({
            bold: document.queryCommandState('bold'),
            italic: document.queryCommandState('italic'),
            underline: document.queryCommandState('underline'),
            strikeThrough: document.queryCommandState('strikeThrough'),
            insertOrderedList: document.queryCommandState('insertOrderedList'),
            insertUnorderedList: document.queryCommandState('insertUnorderedList'),
        });
    }, [viewSource]);

    const updateWordCount = (text) => {
        setWordCount(text.trim().split(/\s+/).filter(Boolean).length);
    };
    
    // --- LINK POPOVER LOGIC --- //
    const handleLinkPopover = useCallback(() => {
        if (viewSource || !editorRef.current) return;
        const selection = window.getSelection();
        if (!selection || selection.isCollapsed) {
            setLinkPopover({ visible: false, target: null, href: '' });
            return;
        }
        
        let parentEl = selection.getRangeAt(0).startContainer;
        if (parentEl.nodeType !== Node.ELEMENT_NODE) parentEl = parentEl.parentNode;
        
        const link = parentEl.closest('a');

        if (link && editorRef.current.contains(link)) {
            const rect = link.getBoundingClientRect();
            setLinkPopover({ visible: true, target: link, href: link.getAttribute('href') || '' });
            
            // Position the popover relative to the link
            const popoverEl = linkPopoverRef.current;
            if (popoverEl) {
                const editorRect = editorRef.current.getBoundingClientRect();
                popoverEl.style.top = `${rect.bottom - editorRect.top + 5}px`;
                popoverEl.style.left = `${rect.left - editorRect.left}px`;
            }
        } else {
            setLinkPopover({ visible: false, target: null, href: '' });
        }
    }, [viewSource]);

    // Effect to handle editor interactions for updating toolbar state
    useEffect(() => {
        const handleInteraction = () => {
            if (document.activeElement === editorRef.current) {
                updateActiveFormats();
                handleLinkPopover();
            } else {
                 setLinkPopover({ visible: false, target: null, href: '' });
            }
        };

        const editorDiv = editorRef.current;
        if(editorDiv){
            document.addEventListener('selectionchange', handleInteraction);
            editorDiv.addEventListener('keyup', handleInteraction);
        }
        
        return () => {
            if(editorDiv){
                document.removeEventListener('selectionchange', handleInteraction);
                editorDiv.removeEventListener('keyup', handleInteraction);
            }
        }
    }, [updateActiveFormats, handleLinkPopover]);
    // ADDED: Handles key presses for special cases, like creating a new line after a non-editable block.
    const handleKeyDown = useCallback((e) => {
        if (e.key === 'Enter') {
            const selection = window.getSelection();
            if (!selection || selection.rangeCount === 0) return;

            const range = selection.getRangeAt(0);
            // Check if the cursor is at the very beginning of the editor or collapsed
            if (!range.collapsed || range.startOffset === 0) return;

            const precedingNode = range.startContainer.childNodes[range.startOffset - 1];

            // Check if the element right before the cursor is a non-editable media block
            if (precedingNode && precedingNode.nodeType === Node.ELEMENT_NODE && precedingNode.matches('[data-editable-block]')) {
                e.preventDefault(); // Stop the default Enter behavior

                // Create a new empty paragraph to serve as the new line
                const newParagraph = document.createElement('p');
                newParagraph.innerHTML = '<br>'; // A line break is needed to make the paragraph visible

                // Insert the new paragraph immediately after the media block
                precedingNode.parentNode.insertBefore(newParagraph, precedingNode.nextSibling);

                // Move the cursor into the new paragraph
                const newRange = document.createRange();
                newRange.setStart(newParagraph, 0);
                newRange.collapse(true);
                selection.removeAllRanges();
                selection.addRange(newRange);

                updateStateFromEditor();
            }
        }
    }, [updateStateFromEditor]); // Dependency ensures the callback has the latest update function

    // --- ELEMENT MANIPULATION --- //
    const clearSelection = () => {
        if (selectedElement) {
            selectedElement.classList.remove('editorElementSelected');
            setSelectedElement(null);
        }
    };

    const handleElementClick = (e) => {
        const targetBlock = e.target.closest('[data-editable-block]');
        
        // If user is selecting text, don't treat it as a block selection
        if (window.getSelection()?.type === 'Range' && !e.target.closest('figcaption, .accordionHeader')) {
            if (selectedElement && !selectedElement.contains(window.getSelection().anchorNode)) {
                 clearSelection();
            }
            return;
        }

        if (targetBlock) {
            e.stopPropagation();
            if (selectedElement === targetBlock) return;
            clearSelection();
            targetBlock.classList.add('editorElementSelected');
            setSelectedElement(targetBlock);
        } else if (editorRef.current?.contains(e.target) && !e.target.closest('a')) {
            // Clicked inside the editor but not on a selectable block
            clearSelection();
        }
    };

    // Close popovers or clear selection when clicking outside the editor
    useEffect(() => {
        const handleClickOutside = (event) => {
            const container = document.getElementById(editorId);
            if (container && !container.contains(event.target) && !event.target.closest('.linkPopover')) {
                clearSelection();
                setLinkPopover({ visible: false, target: null, href: '' });
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [editorId]);
    
    const handleDeleteSelectedElement = () => {
        if (selectedElement) {
            selectedElement.remove();
            clearSelection();
            updateStateFromEditor();
        }
    };

    const handleReplaceSelectedMedia = () => {
        if (!selectedElement) return;
        setElementToReplace(selectedElement);
        if (selectedElement.dataset.editableBlock === "image") {
            imageUploadInputRef.current?.click();
        } else if (selectedElement.dataset.editableBlock === "audio") {
            audioUploadInputRef.current?.click();
        } else {
            setElementToReplace(null);
        }
    };

    // --- MEDIA & BLOCK CREATION --- //
    const createResizableImage = (src, alt = 'User content') => {
        const wrapper = document.createElement('figure');
        wrapper.className = 'imageWrapper alignCenter';
        wrapper.setAttribute('contenteditable', 'false');
        wrapper.setAttribute('data-editable-block', 'image');

        const img = document.createElement('img');
        img.src = src;
        img.alt = alt;

        const resizeHandle = document.createElement('div');
        resizeHandle.className = 'resizeHandle';

        const caption = document.createElement('figcaption');
        caption.setAttribute('contenteditable', 'true');
        caption.setAttribute('data-placeholder', 'Add a caption...');

        wrapper.append(img, resizeHandle, caption);
        enableMediaResizing(wrapper, img, resizeHandle);
        return wrapper;
    };

    const createEditableAudio = (src) => {
        // Make the audio wrapper a figure element for semantic consistency with the image
        const wrapper = document.createElement('figure'); 
        wrapper.className = 'audioWrapper alignCenter';
        wrapper.setAttribute('contenteditable', 'false');
        wrapper.setAttribute('data-editable-block', 'audio');

        const audio = document.createElement('audio');
        audio.src = src;
        audio.controls = true;
        
        const resizeHandle = document.createElement('div');
        resizeHandle.className = 'resizeHandle';

        wrapper.append(audio, resizeHandle);
        // Call the resizing function for the new audio element
        enableMediaResizing(wrapper, audio, resizeHandle); 
        return wrapper;
    };

    const createTable = (rows, cols) => {
        const table = document.createElement('table');
        const tbody = document.createElement('tbody');
        for (let i = 0; i < rows; i++) {
            const tr = document.createElement('tr');
            for (let j = 0; j < cols; j++) {
                // Each cell starts with a paragraph to ensure proper line breaks
                tr.insertCell().innerHTML = '<p><br></p>';
            }
            tbody.appendChild(tr);
        }
        table.appendChild(tbody);

        const wrapper = document.createElement('div');
        wrapper.className = 'tableWrapper';
        wrapper.setAttribute('data-editable-block', 'table');
        wrapper.setAttribute('contenteditable', 'false');
        wrapper.appendChild(table);
        return wrapper;
    };
    
    // MERGED: Create multi-column layout
    const createLayout = (numColumns) => {
        const wrapper = document.createElement('div');
        wrapper.className = 'layoutContainer';
        wrapper.setAttribute('data-editable-block', 'layout');
        wrapper.setAttribute('contenteditable', 'false');
        
        for (let i = 0; i < numColumns; i++) {
            const col = document.createElement('div');
            col.className = 'layoutColumn';
            col.setAttribute('contenteditable', 'true');
            col.innerHTML = `<p>Column ${i + 1}</p>`;
            wrapper.appendChild(col);
        }
        return wrapper;
    };
    
    // MERGED: Create Accordion block
    const createAccordion = (title) => {
        const wrapper = document.createElement('div');
        wrapper.className = 'accordionItem';
        wrapper.setAttribute('data-editable-block', 'accordion');
        wrapper.setAttribute('contenteditable', 'false');

        const header = document.createElement('div');
        header.className = 'accordionHeader';
        header.setAttribute('contenteditable', 'true');
        header.textContent = title;
        
        const content = document.createElement('div');
        content.className = 'accordionContent';
        content.setAttribute('contenteditable', 'true');
        content.innerHTML = '<p>Accordion content...</p>';
        
        wrapper.append(header, content);
        return wrapper;
    };

    // --- UPLOAD & INSERTION --- //
    const handleFileUpload = async (e, mediaType) => {
        const file = e.target.files[0];
        if (!file) {
            setElementToReplace(null);
            return;
        }

        const currentTargetElement = elementToReplace;
        setElementToReplace(null);
        if (e?.target) e.target.value = null; // Reset file input
        setUploadError('');

        const formData = new FormData();
        formData.append('file', file);
        formData.append('media_type', mediaType);
        formData.append('media_category', mediaCategory);

        try {
            const response = await apiClient.post('/user_media/upload/', formData);
            if (response.data.url) {
                const url = (response.data.url || '').replace('http://', 'https://');
                if (currentTargetElement) {
                    // Replacing existing media
                    const mediaTag = currentTargetElement.querySelector(mediaType === 'image' ? 'img' : 'audio');
                    if (mediaTag) mediaTag.src = url;
                } else {
                    // Inserting new media
                    const newElement = mediaType === 'image' ? createResizableImage(url) : createEditableAudio(url);
                    insertElementAndFocus(newElement);
                }
                updateStateFromEditor();
            } else {
                setUploadError(response.data.error || `${mediaType.charAt(0).toUpperCase() + mediaType.slice(1)} upload failed.`);
            }
        } catch (err) {
            // ADDED: Detailed logging to help debug the actual error from your API
            console.error("--- ZPORTA EDITOR UPLOAD ERROR ---", err);
            // The error message now tries to be more specific if possible
            setUploadError(err.response?.data?.error || err.message || `A server error occurred during ${mediaType} upload.`);
        }
    };

    // Insert from URL helpers (parity with old editor)
    const insertImageFromUrl = (url, alt = 'User content') => {
        if (!url) return;
        const safe = url.replace('http://', 'https://');
        insertElementAndFocus(createResizableImage(safe, alt));
    };
    const insertAudioFromUrl = (url) => {
        if (!url) return;
        const safe = url.replace('http://', 'https://');
        insertElementAndFocus(createEditableAudio(safe));
    };


    const handleWordUpload = async (e) => {
            const file = e.target.files[0];
            if (!file || !window.mammoth) {
                setUploadError(!file ? "No file selected." : "Word import library not loaded.");
                return;
            }
            if (e?.target) e.target.value = null;
            setUploadError('');

            if (!file.type.includes('wordprocessingml')) {
                setUploadError('Please upload a valid .docx file.');
                return;
            }

    const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const { value } = await window.mammoth.convertToHtml({ arrayBuffer: event.target.result });
                handleCommand('insertHTML', value);
                // After insertion, re-initialize interactive elements
                setTimeout(() => {
                    if (editorRef.current) {
                        addClickListenersToMedia(editorRef.current);
                        enableResizingForExistingImages(editorRef.current);
                        updateStateFromEditor();
                    }
                }, 100);
            } catch (error) {
                setUploadError('Could not import the Word document.');
            }
        };
        reader.readAsArrayBuffer(file);
    };

    // --- DYNAMIC CONTENT HELPERS --- //
    // Re-applies click listeners to content that might be pasted or loaded
    const addClickListenersToMedia = (container) => {
        container?.querySelectorAll('[data-editable-block]').forEach(el => {
            el.removeEventListener('click', handleElementClick);
            el.addEventListener('click', handleElementClick);
        });
    };

    const enableResizingForExistingImages = (container) => {
        // Handle existing images
        container?.querySelectorAll('.imageWrapper, .audioWrapper').forEach(wrapper => {
            const img = wrapper.querySelector('img');
            const handle = wrapper.querySelector('.resizeHandle');
            if (img && handle) {
                enableMediaResizing(wrapper, img, handle);
            }
            
            // Handle existing audio
            const audio = wrapper.querySelector('audio');
            if (audio && handle) {
                enableMediaResizing(wrapper, audio, handle);
            }
        });
    };
    
    // Ensures there's always a line before/after a media block if it's at the edge of the content.
    const ensureCursorSpace = (container) => {
        if (!container) return;
    
        // Check if the FIRST element is a media block
        const firstChild = container.firstChild;
        if (firstChild && firstChild.nodeType === Node.ELEMENT_NODE && firstChild.matches('[data-editable-block]')) {
            const newParagraph = document.createElement('p');
            newParagraph.innerHTML = '<br>';
            container.insertBefore(newParagraph, firstChild);
        }
    
        // Check if the LAST element is a media block
        const lastChild = container.lastChild;
        if (lastChild && lastChild.nodeType === Node.ELEMENT_NODE && lastChild.matches('[data-editable-block]')) {
            // Also check if the element before it is not already an empty paragraph
            if (!lastChild.previousSibling || lastChild.previousSibling.textContent.trim() !== '') {
                const newParagraph = document.createElement('p');
                newParagraph.innerHTML = '<br>';
                container.appendChild(newParagraph);
            }
        }
    };


    // Logic for resizing images via a drag handle
    const enableMediaResizing = (wrapper, mediaElement, resizeHandle) => {
        let isResizing, startX, startWidth;

        const onMouseDown = (e) => {
            e.preventDefault(); e.stopPropagation();
            isResizing = true;
            startX = e.clientX;
            startWidth = wrapper.offsetWidth; // Resize the wrapper, not the media element directly
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
            wrapper.classList.add('isResizing');
        };

        const onMouseMove = (e) => {
            if (isResizing) {
                // Ensure image doesn't get smaller than 50px
                // For both images and audio, we set the wrapper's width
                wrapper.style.width = `${Math.max(150, startWidth + (e.clientX - startX))}px`;
            }
        };

        const onMouseUp = () => {
            isResizing = false;
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            wrapper.classList.remove('isResizing');
            updateStateFromEditor();
        };

        resizeHandle.removeEventListener('mousedown', onMouseDown); // Avoid duplicate listeners
        resizeHandle.addEventListener('mousedown', onMouseDown);
    };


    // --- MODAL & POPOVER HANDLERS --- //
    const handleModalSubmit = (data) => {
        switch (modal.type) {
            case 'link':
                handleCommand('createLink', data.url);
                break;
            case 'image':
                insertImageFromUrl(data.url, data.alt);
                break;
            case 'audio':
                insertAudioFromUrl(data.url);
                break;
            case 'image-edit':
                if (modal.data?.element) {
                    const img = modal.data.element.querySelector('img');
                    const caption = modal.data.element.querySelector('figcaption');
                    if(img) { img.src = data.url; img.alt = data.alt; }
                    if(caption) caption.textContent = data.caption;
                    updateStateFromEditor();
                }
                break;
            case 'table':
                 if (data.rows > 0 && data.cols > 0) {
                     insertElementAndFocus(createTable(parseInt(data.rows, 10), parseInt(data.cols, 10)));
                 }
                break;
            case 'layout':
                 if (data.cols > 0) {
                     insertElementAndFocus(createLayout(parseInt(data.cols, 10)));
                 }
                break;
            case 'accordion':
                 if (data.title) {
                     insertElementAndFocus(createAccordion(data.title));
                 }
                break;
            default:
                break;
        }
        setModal({ isOpen: false, type: null, data: null });
    };

    const handleEditImage = () => {
        if (!selectedElement || selectedElement.dataset.editableBlock !== 'image') return;
        
        const img = selectedElement.querySelector('img');
        const caption = selectedElement.querySelector('figcaption');
        if (img) {
            setModal({
                isOpen: true, type: 'image-edit',
                data: { element: selectedElement, url: img.src, alt: img.alt, caption: caption?.textContent || '' }
            });
        }
    };
    
    // MERGED FEATURE: Add another content block to a selected accordion
    const handleAddAccordionContent = () => {
        if (!selectedElement || selectedElement.dataset.editableBlock !== 'accordion') return;
        
        const newContent = document.createElement('div');
        newContent.className = 'accordionContent';
        newContent.setAttribute('contenteditable', 'true');
        newContent.innerHTML = '<p>New content section...</p>';
        selectedElement.appendChild(newContent);
        updateStateFromEditor();
    };

    const handleMediaAlignment = (alignment) => {
        if (selectedElement && (selectedElement.dataset.editableBlock === 'image' || selectedElement.dataset.editableBlock === 'audio')) {
            selectedElement.classList.remove('alignLeft', 'alignCenter', 'alignRight', 'alignFull');
            if (alignment) {
                selectedElement.classList.add(alignment);
            }
            updateStateFromEditor();
        }
    };

    // --- JSX RENDER --- //
    if (!isMounted) return <div className="loadingPlaceholder">Loading Editor...</div>;
    
    const selectedBlockType = selectedElement?.dataset.editableBlock;

    return (
        <div id={editorId} className={`editorContainer ${isFullscreen ? 'fullscreen' : ''} ${!editable ? 'isReadonly' : ''}`}>
            {modal.isOpen && <Modal onSubmit={handleModalSubmit} type={modal.type} data={modal.data} onClose={() => setModal({ isOpen: false, type: null, data: null })} />}
            
            <div className="toolbar">
                {/* --- Main Formatting Group --- */}
                <div className="toolbarGroup">
                    <button type="button" className={activeFormats.bold ? 'active' : ''} onClick={() => handleCommand('bold')} title="Bold"><Icon path={ICONS.bold} /></button>
                    <button type="button" className={activeFormats.italic ? 'active' : ''} onClick={() => handleCommand('italic')} title="Italic"><Icon path={ICONS.italic} /></button>
                    <button type="button" className={activeFormats.underline ? 'active' : ''} onClick={() => handleCommand('underline')} title="Underline"><Icon path={ICONS.underline} /></button>
                    <button type="button" className={activeFormats.strikeThrough ? 'active' : ''} onClick={() => handleCommand('strikeThrough')} title="Strikethrough"><Icon path={ICONS.strikethrough} /></button>
                    <button type="button" onClick={() => setModal({ isOpen: true, type: 'link'})} title="Insert Link"><Icon path={ICONS.link} /></button>
                    <div className="dropdown">
                        <button type="button" title="Headings"><Icon path={ICONS.heading}/></button>
                         <div className="dropdownContent">
                            <button type="button" className="dropdownItem" onClick={() => handleCommand('formatBlock', 'p')}>Paragraph</button>
                            <button type="button" className="dropdownItem" onClick={() => handleCommand('formatBlock', 'h2')}><h2>Heading 2</h2></button>
                            <button type="button" className="dropdownItem" onClick={() => handleCommand('formatBlock', 'h3')}><h3>Heading 3</h3></button>
                         </div>
                    </div>
                    {/* MERGED: Font Size */}
                    <div className="dropdown">
                        <button type="button" title="Font Size"><Icon path={ICONS.fontSize}/></button>
                         <div className="dropdownContent">
                            <button type="button" className="dropdownItem" onClick={() => handleCommand('fontSize', '1')}><span style={{fontSize: '0.75rem'}}>Small</span></button>
                            <button type="button" className="dropdownItem" onClick={() => handleCommand('fontSize', '3')}><span style={{fontSize: '1rem'}}>Normal</span></button>
                            <button type="button" className="dropdownItem" onClick={() => handleCommand('fontSize', '5')}><span style={{fontSize: '1.5rem'}}>Large</span></button>
                            <button type="button" className="dropdownItem" onClick={() => handleCommand('fontSize', '7')}><span style={{fontSize: '2rem'}}>Huge</span></button>

                         </div>
                    </div>
                    <label className="colorInputLabel" title="Text Color">
                        <Icon path={ICONS.palette} />
                        <input type="color" onInput={(e) => handleCommand('foreColor', e.target.value)} />
                    </label>
                </div>

                {/* --- Alignment & List Group --- */}
                <div className="toolbarGroup">
                    <button type="button" onClick={() => handleCommand('justifyLeft')} title="Align Left"><Icon path={ICONS.alignLeft} /></button>
                    <button type="button" onClick={() => handleCommand('justifyCenter')} title="Align Center"><Icon path={ICONS.alignCenter} /></button>
                    <button type="button" onClick={() => handleCommand('justifyRight')} title="Align Right"><Icon path={ICONS.alignRight} /></button>
                    <button type="button" className={activeFormats.insertUnorderedList ? 'active' : ''} onClick={() => handleCommand('insertUnorderedList')} title="Bulleted List"><Icon path={ICONS.listUnordered} /></button>
                    <button type="button" className={activeFormats.insertOrderedList ? 'active' : ''} onClick={() => handleCommand('insertOrderedList')} title="Numbered List"><Icon path={ICONS.listOrdered} /></button>
                    <button type="button" onClick={() => handleCommand('formatBlock', 'blockquote')} title="Blockquote"><Icon path={ICONS.blockquote} /></button>
                </div>

                {/* --- Insertion Group --- */}
                <div className="toolbarGroup">
                        {/* Image: upload or URL */}
                        <div className="dropdown">
                            <button type="button" title="Image"><Icon path={ICONS.image}/></button>
                            <div className="dropdownContent">
                                <button type="button" className="dropdownItem" onClick={() => imageUploadInputRef.current?.click()}>Upload from device</button>
                                <button type="button" className="dropdownItem" onClick={() => setModal({ isOpen: true, type: 'image' })}>Insert from URL</button>
                            </div>
                        </div>
                        {/* Audio: upload or URL */}
                        <div className="dropdown">
                             <button type="button" title="Audio"><Icon path={ICONS.audio} /></button>
                            <div className="dropdownContent">
                                <button type="button" className="dropdownItem" onClick={() => audioUploadInputRef.current?.click()}>Upload from device</button>
                                <button type="button" className="dropdownItem" onClick={() => setModal({ isOpen: true, type: 'audio' })}>Insert from URL</button>
                            </div>
                        </div>
                    <button type="button" onClick={() => setModal({isOpen: true, type: 'table'})} title="Insert Table"><Icon path={ICONS.table} /></button>
                    <button type="button" onClick={() => setModal({isOpen: true, type: 'layout'})} title="Insert Columns"><Icon path={ICONS.columns} /></button>
                    <button type="button" onClick={() => setModal({isOpen: true, type: 'accordion'})} title="Insert Accordion"><Icon path={ICONS.accordion} /></button>
                    <button type="button" onClick={() => handleCommand('insertHorizontalRule')} title="Horizontal Rule"><Icon path={ICONS.hr} /></button>
                    <button type="button" onClick={() => wordUploadInputRef.current?.click()} title="Import from Word" disabled={!isMammothLoaded}><Icon path={ICONS.word} /></button> 
                </div>

                {/* --- CONTEXTUAL: General Element Actions --- */}
                {selectedElement && (
                    <div className="toolbarGroup">
                         {selectedBlockType === 'image' && <button type="button" onClick={handleEditImage} title="Edit Image Details"><Icon path={ICONS.edit} /></button>}
                         {(selectedBlockType === 'image' || selectedBlockType === 'audio') && <button type="button" onClick={handleReplaceSelectedMedia} title="Replace Media"><Icon path={ICONS.replace} /></button>}
                         {selectedBlockType === 'accordion' && <button type="button" onClick={handleAddAccordionContent} title="Add Content Section"><Icon path={ICONS.addSection} /></button>}
                         <button type="button" onClick={handleDeleteSelectedElement} title="Delete Element"><Icon path={ICONS.trash} /></button>
                    </div>
                )}
                
                {/* --- CONTEXTUAL: Accordion Style (Caret / Plus / Chevron) --- */}
                {selectedBlockType === 'accordion' && (
                    <div className="toolbarGroup">
                        {(() => {
                            const variant = selectedElement?.dataset.accVariant || 'caret';
                            const setVariant = (v) => {
                                if (!selectedElement) return;
                                selectedElement.dataset.accVariant = v;
                                updateStateFromEditor();
                            };
                            return (
                                <>
                                    <button
                                        type="button"
                                        className={variant === 'caret' ? 'active' : ''}
                                        onClick={() => setVariant('caret')}
                                        title="Accordion style: caret"
                                    >
                                        ▶
                                    </button>
                                    <button
                                        type="button"
                                        className={variant === 'plus' ? 'active' : ''}
                                        onClick={() => setVariant('plus')}
                                        title="Accordion style: plus"
                                    >
                                        +
                                    </button>
                                    <button
                                        type="button"
                                        className={variant === 'chevron' ? 'active' : ''}
                                        onClick={() => setVariant('chevron')}
                                        title="Accordion style: chevron"
                                    >
                                        ❯
                                    </button>
                                </>
                            );
                        })()}
                    </div>
                )}

                {/* --- CONTEXTUAL: Image Alignment --- */}
                {(selectedBlockType === 'image' || selectedBlockType === 'audio') && (
                    <div className="toolbarGroup">
                        <button type="button" onClick={() => handleMediaAlignment('alignLeft')} title="Align Left"><Icon path={ICONS.imageAlignLeft} /></button>
                        <button type="button" onClick={() => handleMediaAlignment('alignCenter')} title="Align Center"><Icon path={ICONS.imageAlignCenter} /></button>
                        <button type="button" onClick={() => handleMediaAlignment('alignRight')} title="Align Right"><Icon path={ICONS.imageAlignRight} /></button>
                        <button type="button" onClick={() => handleMediaAlignment('alignFull')} title="Full Width"><Icon path={ICONS.arrowsH} /></button>
                    </div>
                )}

                {/* --- Utility Group --- */}
                <div className="toolbarGroup rightAlignedGroup">
                    <button type="button" onClick={() => handleCommand('removeFormat')} title="Clear Formatting"><Icon path={ICONS.clear} /></button>
                    <button type="button" onClick={() => setViewSource(p => !p)} className={viewSource ? 'active' : ''} title="Source Code"><Icon path={ICONS.code} /></button>
                    <button type="button" onClick={() => setIsFullscreen(p => !p)} title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}>
                        {isFullscreen ? <Icon path={ICONS.compress} /> : <Icon path={ICONS.expand} />}
                    </button>
                </div>
            </div>

            {uploadError && <p className="editorUploadError" onClick={() => setUploadError('')}>{uploadError} (click to dismiss)</p>}
            
            <div className="editorArea">
                {linkPopover.visible && (
                    <div ref={linkPopoverRef} className="linkPopover">
                        <a href={linkPopover.href} target="_blank" rel="noopener noreferrer">{linkPopover.href}</a>
                        <button type="button" onClick={() => handleCommand('unlink')}><Icon path={ICONS.unlink} /></button>
                    </div>
                )}
                {viewSource ? (
                    <textarea value={content} onChange={(e) => {setContent(e.target.value); updateWordCount(e.target.value)}} className="sourceView" placeholder={placeholder} disabled={!editable} />
                ) : (
                    <div ref={editorRef} contentEditable={editable} className="editor" data-placeholder={placeholder} onClick={handleElementClick} onInput={updateStateFromEditor} onKeyDown={handleKeyDown} />
                
                )}
            </div>
            
            <div className="statusBar">
                <span>Words: {wordCount}</span>
                {enablePrivacyToggle && (
                    <div className="privacyToggle">
                        <label><input type="radio" name={`privacy-${editorId}`} value="private" checked={privacy === 'private'} onChange={(e) => setPrivacy(e.target.value)} /> Private</label>
                        <label><input type="radio" name={`privacy-${editorId}`} value="public" checked={privacy === 'public'} onChange={(e) => setPrivacy(e.target.value)} /> Public</label>
                        <label><input type="radio" name={`privacy-${editorId}`} value="mention" checked={privacy === 'mention'} onChange={(e) => setPrivacy(e.target.value)} /> Mention</label>
                    </div>
                )}
            </div>

            {/* Hidden file inputs */}
            <input ref={imageUploadInputRef} type="file" accept="image/*,image/webp,image/gif" onChange={(e) => handleFileUpload(e, 'image')} style={{ display: 'none' }} />
            <input ref={audioUploadInputRef} type="file" accept="audio/*" onChange={(e) => handleFileUpload(e, 'audio')} style={{ display: 'none' }} />
            <input ref={wordUploadInputRef} type="file" accept=".docx" onChange={handleWordUpload} style={{ display: 'none' }} />
        </div>
    );
});
CustomEditor.displayName = 'CustomEditor';


// --- SVG ICONS & MODAL COMPONENTS --- //
const Icon = ({ path }) => ( <svg width={16} height={16} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d={path} /></svg> );

const ICONS = {
    // Formatting
    bold: "M15.6 10.79c.97.67 1.65 1.77 1.65 2.87 0 2.26-1.74 4.1-3.89 4.1H7.5V6.26h6.1c2.05 0 3.71 1.66 3.71 3.71 0 .96-.36 1.84-1.01 2.53v-.01zM10.15 8.2h2.9c.96 0 1.75.79 1.75 1.75s-.79 1.75-1.75 1.75h-2.9V8.2zm3.05 6.4c.96 0 1.75-.79 1.75-1.75s-.79-1.75-1.75-1.75h-3.05v3.5h3.05z",
    italic: "M10 5.5h2.21l-3.42 13H6.58l3.42-13z",
    underline: "M12 18.25c3.31 0 6-2.69 6-6V3.5h-2.5v8.75c0 1.93-1.57 3.5-3.5 3.5s-3.5-1.57-3.5-3.5V3.5H6v8.75c0 3.31 2.69 6 6 6zM5 20.25h14v-2H5v2z",
    strikethrough: "M10 13h4v-2h-4v2zm-6 5h16v-2H4v2zM4 6v2h16V6H4z",
    link: "M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z",
    unlink: "M17 7h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1 0 1.43-.98 2.63-2.29 2.96L21.71 19l-1.41 1.41-3.41-3.41C16.16 17.58 15.13 18 14 18c-2.76 0-5-2.24-5-5s2.24-5 5-5zm-6 5c0 .93.31 1.78.83 2.45L6.71 6.29C5.68 6.84 5 7.85 5 9c0 2.76 2.24 5 5 5 .93 0 1.78-.31 2.45-.83L7.38 8.1A4.95 4.95 0 007 9z",
    heading: "M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zm0-10v2h14V7H7z",
    fontSize: "M9.88 4.21c-.41.06-1.1.2-1.38.29L3.33 16h2.09l1.19-3.4h5.2l1.24 3.4h2.1L9.88 4.21zm-1.07 7.27L10.5 6.4l1.65 5.08H8.81z",
    palette: "M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9c.83 0 1.5-.67 1.5-1.5 0-.39-.15-.74-.39-1.01-.23-.26-.38-.61-.38-.99 0-.83.67-1.5 1.5-1.5H16c2.76 0 5-2.24 5-5 0-4.42-3.58-8-8-8zm-5.5 9c-.83 0-1.5-.67-1.5-1.5S5.67 9 6.5 9 8 9.67 8 10.5 7.33 12 6.5 12zm3-4C8.67 8 8 7.33 8 6.5S8.67 5 9.5 5s1.5.67 1.5 1.5S10.33 8 9.5 8zm5 0c-.83 0-1.5-.67-1.5-1.5S13.67 5 14.5 5s1.5.67 1.5 1.5S15.33 8 14.5 8zm3 4c-.83 0-1.5-.67-1.5-1.5S16.67 9 17.5 9s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z",
    // Alignment & Lists
    alignLeft: "M3 21h18v-2H3v2zm0-4h12v-2H3v2zm0-4h18v-2H3v2zm0-4h12V7H3v2zm0-6v2h18V3H3z",
    alignCenter: "M3 21h18v-2H3v2zm4-4h10v-2H7v2zm-4-4h18v-2H3v2zm4-4h10V7H7v2zM3 3v2h18V3H3z",
    alignRight: "M3 21h18v-2H3v2zm6-4h12v-2H9v2zM3 13h18v-2H3v2zm6-4h12V7H9v2zM3 3v2h18V3H3z",
    listUnordered: "M7 19h14v-2H7v2zm0-6h14v-2H7v2zm0-8v2h14V5H7zM4 19c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm0-6c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm0-6c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z",
    listOrdered: "M2 17h2v.5H3v1h1v.5H2v1h3v-4H2v1zm1-9h1V4H2v1h1v3zm-1 3h1.8L2 13.1v.9h3v-1H3.2L5 11.9v-.9H2v1zm17-7h-5v2h5V3zm0 4h-5v2h5V7zm0 4h-5v2h5v-2zm-5 4h5v2h-5z",
    blockquote: "M6 17h3l2-4V7H5v6h3l-2 4zm8 0h3l2-4V7h-6v6h3l-2 4z",
    // Insertion
    image: "M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z",
    audio: "M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z",
    table: "M20 2H4c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM8 20H4v-4h4v4zm0-6H4v-4h4v4zm0-6H4V4h4v4zm6 12h-4v-4h4v4zm0-6h-4v-4h4v4zm0-6h-4V4h4v4zm6 12h-4v-4h4v4zm0-6h-4v-4h4v4zm0-6h-4V4h4v4z",
    hr: "M20 11H4v2h16z",
    word: "M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm-3.5 12H15l-1.5-2h-3l-1.5 2H7.5V8h2v5.1l1.4-1.6h1.2l1.4 1.6V8h2v8z",
    columns: "M13 3v18h-2V3h2zm-4 0v18H7V3h2zm-4 0v18H3V3h2zm12 0v18h-2V3h2z",
    accordion: "M4 18h16v-2H4v2zm0-5h16v-2H4v2zm0-5h16V6H4v2z",
    // Contextual & Utility
    replace: "M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z",
    trash: "M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z",
    edit: "M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z",
    addSection: "M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z",
    imageAlignLeft: "M3 15v-2h12v2H3zm0 4v-2h18v2H3zm0-8v-2h12v2H3zm0-6V3h18v2H3z",
    imageAlignCenter: "M3 15v-2h18v2H3zm4-4v-2h10v2H7zm0 8v-2h10v2H7zM3 5V3h18v2H3z",
    imageAlignRight: "M9 15v-2h12v2H9zm-6 4v-2h18v2H3zm6-8v-2h12v2H9zM3 5V3h18v2H3z",
    arrowsH: "M20 9H4v2h16V9zM4 15h16v-2H4v2z",
    expand: "M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z",
    compress: "M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z",
    clear: "M16.24 13.66l-1.41-1.41L12 15.09l-2.83-2.84-1.41 1.41L10.59 16.5l-2.83 2.83 1.41 1.41L12 17.91l2.83 2.83 1.41-1.41L13.41 16.5l2.83-2.84zM19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11z",
    code: "M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0l4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z",
    close: "M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"
};

// --- MODAL COMPONENTS --- //
// A single modal wrapper that conditionally renders the correct form based on `type`.
const Modal = ({ onSubmit, onClose, type, data }) => {
    const renderContent = () => {
        switch (type) {
            case 'link': return <ModalLinkForm onSubmit={onSubmit} />;
            case 'image': return <ModalImageForm onSubmit={onSubmit} />;
            case 'audio': return <ModalAudioForm onSubmit={onSubmit} />;
            case 'image-edit': return <ModalImageEditForm onSubmit={onSubmit} initialData={data} />;
            case 'table': return <ModalTableForm onSubmit={onSubmit} />;
            case 'layout': return <ModalLayoutForm onSubmit={onSubmit} />;
            case 'accordion': return <ModalAccordionForm onSubmit={onSubmit} />;
            default: return null;
        }
    };
    return (
        <div className="modalOverlay" onMouseDown={onClose}>
            <div className="modalContent" onMouseDown={e => e.stopPropagation()}>
                <button type="button" className="modalClose" onClick={onClose}><Icon path={ICONS.close} /></button>
                {renderContent()}
            </div>
        </div>
    );
};
// Individual form components for each modal type
const ModalLinkForm = ({ onSubmit }) => (<form onSubmit={e => { e.preventDefault(); onSubmit({ url: e.target.url.value }); }}><h3 className="modalTitle">Insert Hyperlink</h3><input name="url" type="url" placeholder="https://example.com" required autoFocus className="modalInput" /><button type="submit" className="modalButton">Insert</button></form>);
const ModalImageForm = ({ onSubmit }) => (
  <form onSubmit={e => { e.preventDefault(); onSubmit({ url: e.target.url.value, alt: e.target.alt.value }); }}>
    <h3 className="modalTitle">Insert Image from URL</h3>
    <input name="url" type="url" placeholder="https://example.com/image.jpg" required autoFocus className="modalInput" />
    <input name="alt" type="text" placeholder="Alt text (for accessibility)" className="modalInput" />
    <button type="submit" className="modalButton">Insert Image</button>
  </form>
);
const ModalAudioForm = ({ onSubmit }) => (
  <form onSubmit={e => { e.preventDefault(); onSubmit({ url: e.target.url.value }); }}>
    <h3 className="modalTitle">Insert Audio from URL</h3>
    <input name="url" type="url" placeholder="https://example.com/audio.mp3" required autoFocus className="modalInput" />
    <button type="submit" className="modalButton">Insert Audio</button>
  </form>
);
const ModalImageEditForm = ({ onSubmit, initialData }) => (<form onSubmit={e => { e.preventDefault(); onSubmit({ url: e.target.url.value, alt: e.target.alt.value, caption: e.target.caption.value }); }}><h3 className="modalTitle">Edit Image Details</h3><label>Image URL</label><input name="url" type="url" defaultValue={initialData?.url} required autoFocus className="modalInput" /><label>Alt Text</label><input name="alt" type="text" defaultValue={initialData?.alt} placeholder="Alt text (for accessibility)" className="modalInput" /><label>Caption</label><input name="caption" type="text" defaultValue={initialData?.caption} placeholder="Optional caption text" className="modalInput" /><button type="submit" className="modalButton">Save Changes</button></form>);
const ModalTableForm = ({ onSubmit }) => (<form onSubmit={e => { e.preventDefault(); onSubmit({ rows: e.target.rows.value, cols: e.target.cols.value }); }}><h3 className="modalTitle">Create Table</h3><div className="tableInputs"><input name="rows" type="number" defaultValue="3" min="1" max="20" required className="modalInput" /><span>&times;</span><input name="cols" type="number" defaultValue="3" min="1" max="10" required className="modalInput" /></div><button type="submit" className="modalButton">Create Table</button></form>);
const ModalLayoutForm = ({ onSubmit }) => (<form onSubmit={e => { e.preventDefault(); onSubmit({ cols: e.target.cols.value }); }}><h3 className="modalTitle">Insert Columns</h3><label>Number of Columns</label><select name="cols" defaultValue="2" className="modalInput"><option value="2">Two</option><option value="3">Three</option></select><button type="submit" className="modalButton">Insert Layout</button></form>);
const ModalAccordionForm = ({ onSubmit }) => (<form onSubmit={e => { e.preventDefault(); onSubmit({ title: e.target.title.value }); }}><h3 className="modalTitle">Insert Accordion</h3><label>Accordion Title</label><input name="title" type="text" placeholder="Enter title" required autoFocus className="modalInput" /><button type="submit" className="modalButton">Insert Accordion</button></form>);

// --- EMBEDDED STYLES --- //
// This function generates the component's CSS and scopes it to the unique editor instance.
const getEditorStyles = (id) => `
    :root {
        --zporta-border-color: #e5e7eb;
        --zporta-border-light: #dee2e6;
        --zporta-background-light: #ffffff;
        --zporta-background-medium: #f8f9fa;
        --zporta-background-dark: #e9ecef;
        --zporta-text-color: #343a40;
        --zporta-text-light: #6c757d;
        --zporta-primary-light: #e0f2fe;
        --zporta-gold: #FFB606;
        --zporta-dark-blue: #0A2342;
        --zporta-radius-sm: 6px;
        --zporta-radius-md: 8px;
        --zporta-box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
        --zporta-error-color: #e74c3c;
        --zporta-error-bg: #fdecea;
        --overlay-backdrop: rgba(10, 35, 66, 0.78);
        --overlay-blur: 6px;
        --overlay-panel-bg: #fff;
        --overlay-panel-radius: 16px;
    }
    .dark #${id} {
        --zporta-border-color: #374151;
        --zporta-border-light: #4b5563;
        --zporta-background-light: #1f2937;
        --zporta-background-medium: #111827;
        --zporta-background-dark: #374151;
        --zporta-text-color: #d1d5db;
        --zporta-text-light: #9ca3af;
        --zporta-primary-light: #312e81;
        --zporta-error-bg: #451b1b;
        --overlay-panel-bg: #1f2937;
    }

    #${id}.editorContainer { display: flex; flex-direction: column; border: 1px solid var(--zporta-border-color); border-radius: var(--zporta-radius-md); overflow: hidden; background-color: var(--zporta-background-light); color: var(--zporta-text-color); height: 75vh; min-height: 400px; max-height: 90vh; width: 100%; position: relative; font-family: inherit; }
    #${id} .loadingPlaceholder { display: flex; align-items: center; justify-content: center; min-height: 400px; background-color: var(--zporta-background-medium); color: var(--zporta-text-light); border-radius: var(--zporta-radius-md); }
    #${id} .editorArea { flex-grow: 1; position: relative; display: flex; overflow-y: auto; padding: 16px 20px; }
    #${id} .editor { flex-grow: 1; outline: none; line-height: 1.7; box-sizing: border-box; width: 100%; -webkit-overflow-scrolling: touch; }
    #${id} .toolbar { display: flex; align-items: center; flex-wrap: wrap; gap: 4px; padding: 6px; border-bottom: 1px solid var(--zporta-border-color); background: var(--zporta-background-medium); position: sticky; top: 0; z-index: 1500; user-select: none; }
    #${id} .toolbarGroup { display: flex; align-items: center; gap: 2px; padding: 0 6px; }
    #${id} .toolbarGroup:not(:last-child) { border-right: 1px solid var(--zporta-border-color); }
    #${id} .rightAlignedGroup { margin-left: auto; border-right: none; }
    #${id} .toolbar button { display: inline-flex; align-items: center; justify-content: center; height: 34px; width: 34px; border: none; border-radius: var(--zporta-radius-sm); background-color: transparent; color: var(--zporta-text-light); cursor: pointer; transition: all 0.2s ease; }
    #${id} .toolbar button:hover { background-color: var(--zporta-background-dark); color: var(--zporta-dark-blue); }
    .dark #${id} .toolbar button:hover { color: var(--zporta-text-color); }
    #${id} .toolbar button:disabled { opacity: 0.5; cursor: not-allowed; }
    #${id} .toolbar button.active { background-color: var(--zporta-primary-light); color: var(--zporta-dark-blue); }
    .dark #${id} .toolbar button.active { color: #fff; }
    #${id} .colorInputLabel { position: relative; display: inline-flex; align-items: center; justify-content: center; width: 34px; height: 34px; border-radius: var(--zporta-radius-sm); cursor: pointer; color: var(--zporta-text-light); }
    #${id} .colorInputLabel:hover { background-color: var(--zporta-background-dark); }
    #${id} .colorInputLabel input[type="color"] { position: absolute; inset: 0; opacity: 0; cursor: pointer; }
    #${id} .dropdown { position: relative; display: inline-block; }
    #${id} .dropdownContent { visibility: hidden; opacity: 0; position: absolute; top: 100%; left: 0; background-color: var(--zporta-background-light); min-width: 200px; box-shadow: var(--zporta-box-shadow); border: 1px solid var(--zporta-border-color); border-radius: var(--zporta-radius-md); z-index: 1600; overflow: hidden; padding: 4px; transition: all 0.1s ease; }
    #${id} .dropdown:hover .dropdownContent { visibility: visible; opacity: 1; }
    #${id} .dropdownContent a,
    #${id} .dropdownContent button.dropdownItem { color: var(--zporta-text-color); padding: 8px 12px; background: transparent; border: 0; text-align: left; width: 100%; display: block; font-size: 14px; border-radius: 4px; cursor: pointer; }
    #${id} .dropdownContent a:hover,
    #${id} .dropdownContent button.dropdownItem:hover { background-color: var(--zporta-background-medium); }
    #${id} .dropdownContent h2, #${id} .dropdownContent h3, #${id} .dropdownContent h4 { margin: 0; font-size: inherit; font-weight: normal; }
    #${id} .linkPopover { position: absolute; display: flex; align-items: center; gap: 8px; padding: 6px 10px; background: var(--zporta-dark-blue); color: #fff; border-radius: var(--zporta-radius-md); z-index: 110; }
    .dark #${id} .linkPopover { background: var(--zporta-background-medium); }
    #${id} .linkPopover a { color: #fff; text-decoration: underline; font-size: 0.9em; }
    #${id} .linkPopover button { background: transparent; border: none; color: #fff; cursor: pointer; padding: 2px; }
    #${id} .editor:empty:before { content: attr(data-placeholder); color: var(--zporta-text-light); pointer-events: none; position: absolute; }
    #${id} .sourceView { font-family: 'SF Mono', 'Courier New', Courier, monospace; font-size: 14px; border: none; resize: none; background-color: var(--zporta-background-medium); color: var(--zporta-text-color); width: 100%; padding: 16px 20px; box-sizing: border-box; }
    #${id}.isReadonly .editor { background-color: var(--zporta-background-medium); }
    #${id}.isReadonly .toolbar { opacity: 0.6; pointer-events: none; }
    #${id}.fullscreen { position: fixed; inset: 0; width: 100vw; height: 100vh; max-height: 100vh; z-index: 2000; border-radius: 0; border: none; }
    #${id} .editor > :first-child { margin-top: 0; }
    #${id} .editor > :last-child { margin-bottom: 0; }
    #${id} .editor blockquote { border-left: 3px solid var(--zporta-border-color); margin-left: 0; padding-left: 1em; color: var(--zporta-text-light); }
    #${id} .editor hr { border: none; border-top: 1px solid var(--zporta-border-color); margin: 2em 0; }
    #${id} .editor code { background: var(--zporta-background-dark); padding: 0.2em 0.4em; font-size: 85%; border-radius: 4px; font-family: 'SF Mono', monospace; }
    #${id} .editor a { color: var(--zporta-gold); text-decoration: underline; }
    #${id} .editorElementSelected { outline: 2px solid var(--zporta-gold) !important; outline-offset: 2px; box-shadow: 0 0 0 4px color-mix(in srgb, var(--zporta-gold) 25%, transparent); }
    #${id} .imageWrapper { position: relative; display: table; line-height: 1; margin: 1em auto; max-width: 100%; clear: both; }
    #${id} .imageWrapper img { display: block; max-width: 100%; height: auto; user-select: none; border-radius: 4px; }
    #${id} .resizeHandle { position: absolute; bottom: 8px; right: 8px; width: 16px; height: 16px; background-color: #fff; border: 2px solid var(--zporta-gold); border-radius: 50%; cursor: nwse-resize; box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3); z-index: 5; opacity: 0; transition: opacity 0.2s ease; }
    #${id} .imageWrapper:hover .resizeHandle, #${id} .editorElementSelected.imageWrapper .resizeHandle { opacity: 1; }
    #${id} .imageWrapper figcaption { outline: none; padding: 8px 4px; font-size: 0.9em; color: var(--zporta-text-light); text-align: center; min-height: 1.5em; }
    #${id} .imageWrapper figcaption:empty:before { content: attr(data-placeholder); color: var(--zporta-text-light); }
    #${id} .isResizing { opacity: 0.7; }
    #${id} .alignCenter { margin-left: auto; margin-right: auto; }
    #${id} .alignLeft { float: left; margin-right: 1.5em; max-width: 50%; }
    #${id} .alignRight { float: right; margin-left: 1.5em; max-width: 50%; }
    #${id} .alignFull { display: block; float: none; max-width: 100%; margin-left: auto; margin-right: auto; }
    #${id} .alignFull img { width: 100%; }
    #${id} .editor p:has(+ .alignLeft), #${id} .editor p:has(+ .alignRight) { clear: both; }
    /* --- UPDATED AUDIO STYLES --- */
    #${id} .audioWrapper { 
            position: relative; 
            display: table; 
            margin: 1em auto; 
            max-width: 100%; 
            width: 500px; /* Default starting width */
            clear: both;
            background-color: var(--zporta-background-medium); 
            border-radius: var(--zporta-radius-md); 
            padding: 12px;
        }
    #${id} .audioWrapper audio { display: block; width: 100%; }
    #${id} .audioWrapper .resizeHandle { right: -8px; bottom: -8px; } /* Position handle outside the padding */
    #${id} .audioWrapper:hover .resizeHandle, #${id} .editorElementSelected.audioWrapper .resizeHandle { opacity: 1; }
    #${id} .tableWrapper { margin: 1em 0; overflow-x: auto; }
    #${id} .tableWrapper table { width: 100%; border-collapse: collapse; border: 1px solid var(--zporta-border-light); }
    #${id} .tableWrapper td, #${id} .tableWrapper th { border: 1px solid var(--zporta-border-light); padding: 8px; min-width: 50px; position: relative; }
    #${id} .tableWrapper p { margin: 0; }
    #${id} .layoutContainer { display: flex; flex-wrap: wrap; gap: 16px; border: 1px dashed var(--zporta-border-light); padding: 16px; margin: 1em 0; background-color: color-mix(in srgb, var(--zporta-background-medium) 50%, transparent); border-radius: var(--zporta-radius-sm); }
    #${id} .layoutColumn { flex: 1; min-width: 150px; border: 1px dotted var(--zporta-border-light); padding: 10px; background-color: var(--zporta-background-light); outline: none; border-radius: var(--zporta-radius-sm); }
    #${id} .layoutColumn > :first-child { margin-top: 0; }
    #${id} .layoutColumn > :last-child { margin-bottom: 0; }
    #${id} .accordionItem { border: 1px solid var(--zporta-border-color); border-radius: var(--zporta-radius-sm); margin: 1em 0; background-color: var(--zporta-background-light); overflow: visible; }
    #${id} .accordionHeader { padding: 10px 15px; font-weight: 600; background-color: var(--zporta-background-medium); border-bottom: 1px solid var(--zporta-border-color); outline: none; position: relative; padding-left: 36px; }
    /* Accordion Header Icon by variant */
    #${id} .accordionItem .accordionHeader::before { content: '▶'; position: absolute; left: 12px; top: 50%; transform: translateY(-50%); opacity: 0.7; }
    #${id} .accordionItem[data-acc-variant="plus"] .accordionHeader::before { content: '+'; font-weight: 700; }
    #${id} .accordionItem[data-acc-variant="chevron"] .accordionHeader::before { content: '❯'; font-weight: 700; }
    #${id} .accordionItem:last-child .accordionHeader { border-bottom: none; }
    #${id} .accordionContent { padding: 15px; outline: none; border-top: 1px solid var(--zporta-border-color); }
    #${id} .accordionContent:first-of-type { border-top: none; }
    #${id} .accordionContent > :first-child { margin-top: 0; }
    #${id} .accordionContent > :last-child { margin-bottom: 0; }
    #${id} .modalOverlay { position: fixed; inset: 0; background: var(--overlay-backdrop); -webkit-backdrop-filter: blur(var(--overlay-blur)); backdrop-filter: blur(var(--overlay-blur)); display: flex; align-items: center; justify-content: center; z-index: 2100; }
    #${id} .modalContent { background: var(--overlay-panel-bg); padding: 24px; border-radius: var(--overlay-panel-radius); box-shadow: var(--zporta-box-shadow); width: 90%; max-width: 450px; position: relative; color: var(--zporta-text-color); }
    .dark #${id} .modalContent { color: inherit; }
    #${id} .modalClose { position: absolute; top: 8px; right: 8px; background: none; border: none; font-size: 24px; cursor: pointer; color: var(--zporta-text-light); padding: 4px; line-height: 1; }
    #${id} .modalTitle { margin-top: 0; margin-bottom: 24px; font-size: 1.2em; color: var(--zporta-text-color); }
    .dark #${id} .modalTitle { color: #fff; }
    #${id} .modalContent label { font-size: 0.9em; font-weight: 500; margin-bottom: 4px; display: block; }
    #${id} .modalInput { width: 100%; padding: 10px; border: 1px solid var(--zporta-border-color); border-radius: var(--zporta-radius-sm); font-size: 1em; margin-bottom: 16px; background-color: var(--zporta-background-light); color: var(--zporta-text-color); }
    .dark #${id} .modalInput { background-color: var(--zporta-background-dark); border-color: var(--zporta-border-light); }
    #${id} .modalButton { width: 100%; padding: 12px; background: var(--zporta-gold); color: var(--zporta-dark-blue); border: none; border-radius: var(--zporta-radius-sm); font-size: 1em; cursor: pointer; font-weight: 600; }
    #${id} .tableInputs { display: flex; align-items: center; gap: 8px; }
    #${id} .statusBar { padding: 6px 12px; font-size: 0.8em; color: var(--zporta-text-light); border-top: 1px solid var(--zporta-border-color); background: var(--zporta-background-medium); user-select: none; display: flex; justify-content: flex-end; align-items: center; gap: 24px; }
    #${id} .editorUploadError { color: var(--zporta-error-color); font-size: 0.9em; padding: 10px 16px; margin: 0; border-bottom: 1px solid var(--zporta-error-bg); background-color: var(--zporta-error-bg); text-align: center; cursor: pointer; }
    #${id} .privacyToggle { display: flex; flex-wrap: wrap; gap: 16px; font-size: 1em; }
    #${id} .privacyToggle label { display: flex; align-items: center; gap: 6px; cursor: pointer; }
    @media (max-width: 768px) {
        #${id} .toolbar { padding: 4px; gap: 2px; }
        #${id} .toolbarGroup { padding: 0 4px; }
        #${id} .toolbar button { height: 32px; width: 32px; }
        #${id} .editorArea { padding: 12px; }
        #${id} .alignLeft, #${id} .alignRight { float: none; max-width: 100%; margin-left: auto; margin-right: auto; }
    }
    @media (max-width: 480px) {
        #${id} .toolbarGroup:not(.rightAlignedGroup) { border-right: none; }
        #${id} .rightAlignedGroup { margin-left: 0; width: 100%; justify-content: flex-end; }
    }
`;

export default CustomEditor;
