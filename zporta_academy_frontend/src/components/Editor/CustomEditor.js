import React, { useRef, useState, useEffect, useImperativeHandle, forwardRef } from 'react';
import './CustomEditor.css';
import mammoth from 'mammoth';
import {
    FaBold, FaItalic, FaUnderline, FaExpand, FaCompress, FaImage, FaLink,
    FaUpload, FaFileWord, FaCode, FaMusic, FaColumns, FaTrashAlt, FaSyncAlt
} from 'react-icons/fa';
import apiClient from '../../api';

const CustomEditor = forwardRef(({
    placeholder = 'Start writing...',
    onSave,
    enablePrivacyToggle = false,
    initialContent,
    mediaCategory = 'course',
    editable = true
}, ref) => {
    const editorRef = useRef(null);
    const imageUploadInputRef = useRef(null);
    const audioUploadInputRef = useRef(null);
    // REMOVED: const replacingElementRef = useRef(null);

    const [isFullscreen, setIsFullscreen] = useState(false);
    const [viewSource, setViewSource] = useState(false);
    const [content, setContent] = useState('');
    const [privacy, setPrivacy] = useState('private');
    const [uploadError, setUploadError] = useState('');
    const [selectedElement, setSelectedElement] = useState(null);
    // --- NEW STATE for tracking replacement target ---
    const [elementToReplaceState, setElementToReplaceState] = useState(null);
    // --- END NEW STATE ---

    useEffect(() => {
      if (initialContent && initialContent !== content) {
          setContent(initialContent);
      }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialContent]);

    useEffect(() => {
      if (!viewSource && editorRef.current) {
          const currentHTML = editorRef.current.innerHTML;
          if (currentHTML !== content) {
               editorRef.current.innerHTML = content;
               addClickListenersToMedia(editorRef.current);
               enableResizingForExistingImages(editorRef.current);
          }
      }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content, viewSource]);

    useImperativeHandle(ref, () => ({
        getContent: () => viewSource ? content : (editorRef.current ? editorRef.current.innerHTML : ''),
        getPrivacy: () => privacy,
        clearEditorSelection: clearSelection
    }));

    const updateContentFromEditor = () => {
      if (editorRef.current && !viewSource) {
          const currentHTML = editorRef.current.innerHTML;
          if (content !== currentHTML) {
               setContent(currentHTML);
          }
      }
    };

    const handleCommand = (command, value = null) => {
        if (!viewSource && editorRef.current) {
            document.execCommand(command, false, value);
            editorRef.current.focus();
            updateContentFromEditor();
        }
    };

    const insertElementAndFocus = (element, makeEditable = false) => {
        if (editorRef.current && !viewSource) {
             clearSelection();
            editorRef.current.focus();
            const selection = window.getSelection();
            if (selection && selection.rangeCount > 0) {
                const range = selection.getRangeAt(0);
                range.deleteContents();

                 if (makeEditable && element.setAttribute) {
                    element.setAttribute('contenteditable', 'true');
                 }
                 if (element.classList.contains('image-wrapper')) {
                     element.setAttribute('data-editable-media', 'true');
                     element.addEventListener('click', handleElementClick);
                 } else if (element.tagName === 'AUDIO') {
                     element.setAttribute('data-editable-media', 'true');
                     element.addEventListener('click', handleElementClick);
                 } else if (element.classList?.contains('editable-layout-container')) {
                    element.addEventListener('click', handleElementClick);
                 }

                range.insertNode(element);

                const rangeAfter = document.createRange();
                rangeAfter.setStartAfter(element);
                rangeAfter.collapse(true);
                selection.removeAllRanges();
                selection.addRange(rangeAfter);

                 if (!makeEditable && (element.classList?.contains('image-wrapper') || element.tagName === 'AUDIO' || element.classList?.contains('editable-layout-container'))) {
                     const space = document.createTextNode('\u00A0');
                     rangeAfter.insertNode(space);
                     rangeAfter.setStartAfter(space);
                     rangeAfter.collapse(true);
                     selection.removeAllRanges();
                     selection.addRange(rangeAfter);
                 }

            } else {
                if (makeEditable && element.setAttribute) {
                   element.setAttribute('contenteditable', 'true');
                }
                 if (element.classList.contains('image-wrapper')) {
                      element.setAttribute('data-editable-media', 'true');
                      element.addEventListener('click', handleElementClick);
                 } else if (element.tagName === 'AUDIO') {
                      element.setAttribute('data-editable-media', 'true');
                      element.addEventListener('click', handleElementClick);
                 } else if (element.classList?.contains('editable-layout-container')) {
                    element.addEventListener('click', handleElementClick);
                 }
                editorRef.current.appendChild(element);
                  if (!makeEditable && (element.classList?.contains('image-wrapper') || element.tagName === 'AUDIO' || element.classList?.contains('editable-layout-container'))) {
                       const space = document.createTextNode('\u00A0');
                       editorRef.current.appendChild(space);
                  }
            }
            updateContentFromEditor();
        }
    };

    // --- Element Selection & Editing ---

     const clearSelection = () => {
        if (selectedElement) {
            selectedElement.classList.remove('editor-element-selected');
            setSelectedElement(null);
        }
        // Also clear replacement target if selection is cleared externally
        if (elementToReplaceState) {
             // Check if the currently selected element IS the one marked for replacement.
             // If so, clearing selection implies cancelling the replacement.
             // This check might need refinement based on exact UX desired.
             // For now, let's clear it unconditionally when selection clears.
             // setElementToReplaceState(null); // Let's NOT clear it here automatically, clear it after upload/cancel only
        }
    };


    const addClickListenersToMedia = (container) => {
      if (!container) return;
      const selector =
          '.image-wrapper[data-editable-media="true"], ' +
          '.audio-wrapper[data-editable-media="true"], ' +
          '.editable-layout-container, ' +
          '.accordion-item[data-editable-block="accordion"]';
 
      container.querySelectorAll(selector).forEach(el => {
          el.removeEventListener('click', handleElementClick);
          el.addEventListener('click', handleElementClick);
      });
  };

    const enableResizingForExistingImages = (container) => {
        if (!container) return;
        container.querySelectorAll('.image-wrapper').forEach(wrapper => {
            const img = wrapper.querySelector('img');
            const handle = wrapper.querySelector('.resize-handle');
            if (img && handle) {
                enableImageResizing(wrapper, img, handle);
            }
        });
    };


    const handleElementClick = (e) => {
      const targetBlock = e.target.closest(
          '[data-editable-media="true"], ' +
          '.editable-layout-container, ' +
          '.accordion-item[data-editable-block="accordion"]'
      );
  
      const targetEditable = e.target.closest('[contenteditable="true"]');
  
      if (window.getSelection()?.type === 'Range') {
          if (selectedElement && !selectedElement.contains(window.getSelection().anchorNode)) {
               clearSelection();
          }
          return;
      }
  
      if (targetEditable && targetEditable !== editorRef.current) {
          const parentBlock = targetEditable.closest('[data-editable-media="true"], .editable-layout-container, .accordion-item[data-editable-block="accordion"]');
  
          if (parentBlock === selectedElement) {
              return;
          } else {
              if (selectedElement) {
                  clearSelection();
              }
              return;
          }
      }
  
      if (targetBlock) {
          e.stopPropagation();
          if (selectedElement === targetBlock) {
              return;
          }
          clearSelection();
          targetBlock.classList.add('editor-element-selected');
          setSelectedElement(targetBlock);
          return;
      }
  
      if (editorRef.current?.contains(e.target) && targetEditable === editorRef.current) {
           clearSelection();
           return;
      }
    };

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (editorRef.current && !editorRef.current.contains(event.target) &&
                 !event.target.closest('.editor-element-actions') &&
                 !event.target.closest('.dropdown-content')
                )
            {
                clearSelection();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [selectedElement]); // Re-run if selectedElement changes might be needed if logic inside depends on it

    const handleDeleteSelectedElement = () => {
        if (selectedElement) {
            const elementToRemove = selectedElement;
            clearSelection();
            elementToRemove.remove();
            updateContentFromEditor();
        }
    };

    // --- MODIFIED: Uses useState (setElementToReplaceState) ---
    const handleReplaceSelectedMedia = () => {
      if (!selectedElement) return;
 
      setElementToReplaceState(selectedElement); // Use state to track
 
      // Check for wrapper classes or specific tags
      if (selectedElement.classList.contains('image-wrapper')) {
           imageUploadInputRef.current?.click();
      } else if (selectedElement.classList.contains('audio-wrapper')) { // Check for wrapper class
           audioUploadInputRef.current?.click();
      } else {
          setElementToReplaceState(null); // Reset state if type is wrong
      }
  };

    // --- Image Handling ---
    const handleImageInsert = (type) => {
        if (viewSource || !editorRef.current) return;
        clearSelection();
        setElementToReplaceState(null); // Ensure not in replace mode
        if (type === 'url') {
            const imageUrl = prompt('Enter image URL:');
            if (imageUrl) {
                const imgWrapper = createResizableImage(imageUrl);
                insertElementAndFocus(imgWrapper);
            }
        } else {
            imageUploadInputRef.current?.click();
        }
    };

    const createResizableImage = (src) => {
        const wrapper = document.createElement('div');
        wrapper.classList.add('image-wrapper');
        wrapper.style.position = 'relative';
        wrapper.style.display = 'inline-block';
        wrapper.setAttribute('contenteditable', 'false');

        const img = document.createElement('img');
        img.src = src;
        img.alt = "User uploaded content";
        img.style.maxWidth = '100%';
        img.style.display = 'block';

        const resizeHandle = document.createElement('div');
        resizeHandle.classList.add('resize-handle');

        wrapper.appendChild(img);
        wrapper.appendChild(resizeHandle);

        wrapper.setAttribute('data-editable-media', 'true');
        wrapper.addEventListener('click', handleElementClick);

        enableImageResizing(wrapper, img, resizeHandle);

        return wrapper;
    };

    const enableImageResizing = (wrapper, img, resizeHandle) => {
        let isResizing = false;
        let startX, startY, startWidth, startHeight;

        const existingMouseMove = wrapper._onMouseMove;
        const existingMouseUp = wrapper._onMouseUp;
        if (existingMouseMove) document.removeEventListener('mousemove', existingMouseMove);
        if (existingMouseUp) document.removeEventListener('mouseup', existingMouseUp);

        const onMouseDown = (e) => {
            e.preventDefault();
            e.stopPropagation();
            isResizing = true;
            startX = e.clientX;
            startY = e.clientY;
            startWidth = img.offsetWidth;
            startHeight = img.offsetHeight;
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
            wrapper.classList.add('is-resizing');
        };

        const onMouseMove = (event) => {
             if (isResizing) {
                 const dx = event.clientX - startX;
                 const newWidth = Math.max(20, startWidth + dx);
                 const aspectRatio = startHeight / startWidth;
                 const newHeight = newWidth * aspectRatio;
                 img.style.width = `${newWidth}px`;
                 img.style.height = `${newHeight}px`;
             }
         };
         wrapper._onMouseMove = onMouseMove;

         const onMouseUp = () => {
             if(isResizing) {
               isResizing = false;
               document.removeEventListener('mousemove', onMouseMove);
               document.removeEventListener('mouseup', onMouseUp);
               wrapper.classList.remove('is-resizing');
               updateContentFromEditor();
             }
         };
         wrapper._onMouseUp = onMouseUp;

         resizeHandle.removeEventListener('mousedown', wrapper._onMouseDown);
         wrapper._onMouseDown = onMouseDown;
         resizeHandle.addEventListener('mousedown', onMouseDown);
    };

    // --- MODIFIED: Reads elementToReplaceState ---
    const handleImageUpload = async (e) => {
        const file = e.target.files[0];
        // Read the state variable at the start of the async function
        const currentElementToReplace = elementToReplaceState;

        if (e?.target) e.target.value = null; // Clear file input early

        if (currentElementToReplace && !currentElementToReplace.classList.contains('image-wrapper')) {
             setElementToReplaceState(null); // Clear state if wrong type stored
             return;
        }

        if (file) {
            setUploadError('');
            const formData = new FormData();
            formData.append('file', file);
            formData.append('media_type', 'image');
            formData.append('media_category', mediaCategory);

            try {
                const response = await apiClient.post('/user_media/upload/', formData);
                const data = response.data;

                if (data.url) {
                    const imgElementToReplace = currentElementToReplace?.querySelector('img');
                    if (imgElementToReplace && editorRef.current?.contains(imgElementToReplace)) {
                        imgElementToReplace.src = data.url;
                        if (!currentElementToReplace.classList.contains('editor-element-selected')) {
                             clearSelection();
                             currentElementToReplace.classList.add('editor-element-selected');
                             setSelectedElement(currentElementToReplace);
                        }
                    } else {
                        const imgWrapper = createResizableImage(data.url);
                        insertElementAndFocus(imgWrapper);
                    }
                    updateContentFromEditor();
                } else {
                    setUploadError(data.error || "Image upload failed (server error).");
                }
            } catch (err) {
                setUploadError(err.response?.data?.error || err.response?.data?.detail || "Image upload network/server error.");
            } finally {
                // Clear the replacement state AFTER the operation
                setElementToReplaceState(null);
            }
        } else {
             // If no file selected (e.g., user cancelled), clear replacement state
             setElementToReplaceState(null);
        }
    };

     // --- Audio Handling ---
     const handleAudioInsert = (type) => {
        if (viewSource || !editorRef.current) return;
        clearSelection();
        setElementToReplaceState(null); // Ensure not in replace mode
        if (type === 'url') {
            const audioUrl = prompt('Enter audio URL:');
            if (audioUrl) {
                const audio = createEditableAudio(audioUrl);
                insertElementAndFocus(audio);
            }
        } else {
            audioUploadInputRef.current?.click();
        }
    };

    const createEditableAudio = (src) => {
      // --- Wrapper Div ---
      const wrapper = document.createElement('div');
      wrapper.classList.add('audio-wrapper');
      wrapper.style.position = 'relative'; // Needed for positioning the handle
      wrapper.style.display = 'inline-block'; // Or 'block'
      wrapper.style.maxWidth = '100%';
      // Note: Removed cursor:pointer from wrapper, handle will have it
      wrapper.setAttribute('data-editable-media', 'true'); // Mark wrapper as selectable target
      wrapper.setAttribute('contenteditable', 'false');
      wrapper.addEventListener('click', handleElementClick); // Attach listener to wrapper

      // --- Select Handle Icon ---
      const handle = document.createElement('span');
      handle.classList.add('select-handle');
      handle.innerHTML = '&#x261A;'; // Example: Black left pointing index ☞ (or use an icon font/SVG)
      handle.setAttribute('title', 'Select Audio');
      // Style this with CSS (see below)

      // --- Audio Element ---
      const audio = document.createElement('audio');
      audio.src = src;
      audio.controls = true;
      audio.style.display = 'block';
      audio.style.maxWidth = '100%';

      // --- Assemble ---
      wrapper.appendChild(handle); // Add handle first or last depending on desired overlap/position
      wrapper.appendChild(audio);

      return wrapper; // Return the wrapper
  };

    // --- MODIFIED: Reads elementToReplaceState ---
    const handleAudioFileUpload = async (e) => {
      const file = e.target.files[0];
      const currentElementToReplaceWrapper = elementToReplaceState; // This is the WRAPPER div
 
      if (e?.target) e.target.value = null;
 
      // Check if we are replacing and if it's the correct wrapper type
      if(currentElementToReplaceWrapper && !currentElementToReplaceWrapper.classList.contains('audio-wrapper')) {
           setElementToReplaceState(null);
          return;
      }
 
      if (file) {
          setUploadError('');
          const formData = new FormData();
          formData.append('file', file);
          formData.append('media_type', 'audio');
          formData.append('media_category', mediaCategory);
 
          try {
              const response = await apiClient.post('/user_media/upload/', formData);
              const data = response.data;
 
              if (data.url) {
                  // Find the actual AUDIO tag inside the wrapper
                  const audioElementToReplace = currentElementToReplaceWrapper?.querySelector('audio');
 
                  if (audioElementToReplace && editorRef.current?.contains(audioElementToReplace)) {
                       audioElementToReplace.src = data.url; // Update the src of the AUDIO tag
                       audioElementToReplace.load();
                       // Keep the WRAPPER selected
                       if (!currentElementToReplaceWrapper.classList.contains('editor-element-selected')) {
                            clearSelection();
                            currentElementToReplaceWrapper.classList.add('editor-element-selected');
                            setSelectedElement(currentElementToReplaceWrapper);
                       }
                   } else {
                       // Insert new if not replacing
                       const audioWrapper = createEditableAudio(data.url); // create function returns wrapper
                       insertElementAndFocus(audioWrapper);
                   }
                   updateContentFromEditor();
               } else {
                   setUploadError(data.error || "Audio upload failed.");
               }
          } catch (err) {
              setUploadError(err.response?.data?.error || err.response?.data?.detail || "Audio upload error.");
          } finally {
               setElementToReplaceState(null); // Clear replacement state
          }
      } else {
          setElementToReplaceState(null);
      }
   };

    // --- Word Import ---
    const handleWordUpload = (e) => {
        const file = e.target.files[0];
         clearSelection();
         setElementToReplaceState(null); // Clear replacement state
        if (file && file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
            const reader = new FileReader();
            reader.onload = (event) => {
                const arrayBuffer = event.target.result;
                mammoth
                    .convertToHtml({ arrayBuffer: arrayBuffer })
                    .then((result) => {
                        if (editorRef.current && !viewSource) {
                            editorRef.current.focus();
                            document.execCommand('insertHTML', false, result.value);
                             addClickListenersToMedia(editorRef.current);
                             enableResizingForExistingImages(editorRef.current);
                            updateContentFromEditor();
                        } else if (viewSource) {
                            setContent(content + result.value);
                        }
                    })
                    .catch((error) => {
                        console.error('Error parsing Word document:', error);
                        setUploadError('Could not import Word document.');
                    });
            };
            reader.readAsArrayBuffer(file);
        } else if (file) {
            setUploadError('Please upload a valid .docx file.');
        }
         if(e?.target) e.target.value = null;
    };

    // --- Layout Insertion ---
    const handleInsertLayout = () => {
      if (viewSource || !editorRef.current) return;
      clearSelection();
      setElementToReplaceState(null); // Clear replacement state

      const columns = prompt("Enter number of columns (e.g., 1, 2, or 3):", "2");
      const numColumns = parseInt(columns, 10);

      if (isNaN(numColumns) || numColumns < 1 || numColumns > 3) {
           alert("Please enter 1, 2, or 3 columns.");
           return;
      }

      const layoutWrapper = document.createElement('div');
      layoutWrapper.classList.add('editable-layout-container');
      layoutWrapper.style.display = 'flex';
      layoutWrapper.style.flexWrap = 'wrap';
      layoutWrapper.style.gap = '10px';
      layoutWrapper.style.border = '1px dashed #ccc';
      layoutWrapper.style.padding = '5px';
      layoutWrapper.style.margin = '10px 0';
      layoutWrapper.setAttribute('contenteditable', 'false');
      layoutWrapper.setAttribute('data-layout-type', `${numColumns}-column`);
      layoutWrapper.addEventListener('click', handleElementClick);

      for (let i = 1; i <= numColumns; i++) {
          const col = document.createElement('div');
          col.classList.add('layout-column');
          col.style.flex = '1';
          col.style.minWidth = numColumns > 1 ? '150px' : '100%';
          col.style.border = '1px dotted #eee';
          col.style.padding = '10px';
          col.innerHTML = `<p>Column ${i} Content...</p>`;
          col.setAttribute('contenteditable', 'true');
          layoutWrapper.appendChild(col);
      }

      insertElementAndFocus(layoutWrapper, false);

      const firstColumn = layoutWrapper.querySelector('.layout-column[contenteditable="true"]');
      if (firstColumn) {
          setTimeout(() => {
               try {
                   const range = document.createRange();
                   const sel = window.getSelection();
                   range.selectNodeContents(firstColumn);
                   sel?.removeAllRanges();
                   sel?.addRange(range);
               } catch (error) {
                   editorRef.current?.focus();
               }
          }, 50);
      } else {
           editorRef.current?.focus();
      }
    };
// Inside CustomEditor component

const handleInsertAccordion = () => {
  if (viewSource || !editorRef.current) return;
  clearSelection();
  setElementToReplaceState(null);

  const defaultTitle = prompt("Enter accordion title:", "Accordion Title");
  if (defaultTitle === null) return;

  const defaultStateInput = prompt("Default display state when viewed? (Enter 'open' or 'closed'):", "closed");
  const defaultState = (defaultStateInput?.toLowerCase() === 'open') ? 'open' : 'closed';

  const accordionItem = document.createElement('div');
  accordionItem.classList.add('accordion-item');
  accordionItem.setAttribute('contenteditable', 'false');
  accordionItem.setAttribute('data-editable-block', 'accordion');
  accordionItem.setAttribute('data-default-state', defaultState);
  accordionItem.addEventListener('click', handleElementClick); // Listener remains on the wrapper

  // *** START: Add Select Handle ***
  const handle = document.createElement('span');
  handle.classList.add('select-handle', 'accordion-select-handle'); // Add specific class
  handle.innerHTML = '&#x261A;'; // Example Icon (Style with CSS)
  handle.setAttribute('title', 'Select Accordion Item');
  handle.setAttribute('contenteditable', 'false'); // Handle is not editable
  accordionItem.appendChild(handle); // Add handle inside the item wrapper
  // *** END: Add Select Handle ***

  const header = document.createElement('div');
  header.classList.add('accordion-header');
  header.setAttribute('contenteditable', 'true');
  header.textContent = defaultTitle || 'Accordion Title';
  header.setAttribute('data-state-cue', defaultState === 'open' ? 'Default: Open' : 'Default: Closed');
  accordionItem.appendChild(header); // Add header AFTER handle

  const contentDiv = document.createElement('div');
  contentDiv.classList.add('accordion-content');
  contentDiv.setAttribute('contenteditable', 'true');
  contentDiv.innerHTML = '<p>Accordion content goes here... <br></p>';
  accordionItem.appendChild(contentDiv); // Add content AFTER header

  insertElementAndFocus(accordionItem, false);

  setTimeout(() => {
      try {
          const range = document.createRange();
          const sel = window.getSelection();
          if (!header || !sel) return;
          range.selectNodeContents(header);
          range.collapse(false);
          sel.removeAllRanges();
          sel.addRange(range);
          header.focus();
      } catch (err) {
          console.error("Focus error after accordion insert:", err);
          editorRef.current?.focus();
      }
  }, 50);

  updateContentFromEditor();
};
// ADD THIS ENTIRE BLOCK
const handleAddAccordionContentSection = () => {
  if (!selectedElement || !selectedElement.classList.contains('accordion-item')) {
      return;
  }

  const newContentDiv = document.createElement('div');
  newContentDiv.classList.add('accordion-content');
  newContentDiv.setAttribute('contenteditable', 'true');
  newContentDiv.innerHTML = '<p>New content section... <br></p>';

  selectedElement.appendChild(newContentDiv);

  setTimeout(() => {
      try {
          const range = document.createRange();
          const sel = window.getSelection();
          if (!newContentDiv || !sel || !newContentDiv.firstChild) return;
          range.setStart(newContentDiv.firstChild, 0);
          range.collapse(true);
          sel.removeAllRanges();
          sel.addRange(range);
          newContentDiv.focus();
      } catch (err) {
          console.error("Focus error after adding content section:", err);
      }
  }, 50);

  updateContentFromEditor();
};
// END OF BLOCK TO ADD
    // --- Toggles ---
    const toggleViewSource = () => {
        if (!viewSource) {
            clearSelection();
            setElementToReplaceState(null); // Clear replace state
            if(editorRef.current) setContent(editorRef.current.innerHTML);
        } else {
            clearSelection();
            setElementToReplaceState(null); // Clear replace state
        }
        setViewSource(!viewSource);
    };

    const toggleFullscreen = () => {
        setIsFullscreen(!isFullscreen);
    };

    // --- Blurring and Saving ---
    // Using onBlur on the container now
    const handleBlur = (e) => {
        const relatedTarget = e.relatedTarget;
        const currentTarget = e.currentTarget; // The editor-container div

        // Check if focus is truly leaving the container and its children
        // Need setTimeout because relatedTarget might be null briefly during focus transition
        setTimeout(() => {
            // Re-check if the newly focused element is still inside the container
            if (!currentTarget.contains(document.activeElement)) {
                 updateContentFromEditor();
                // clearSelection(); // Optionally clear selection on true blur
            }
        }, 0);
    };


    // --- JSX ---
    return (
        // onBlur moved to container div
        <div className={`editor-container ${isFullscreen ? 'fullscreen' : ''}`} onBlur={handleBlur}>
            <div className="toolbar">
                {/* Toolbar Buttons */}
                <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => handleCommand('bold')} title="Bold"><FaBold /></button>
                <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => handleCommand('italic')} title="Italic"><FaItalic /></button>
                <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => handleCommand('underline')} title="Underline"><FaUnderline /></button>
                <select
  onChange={(e) => handleCommand('fontSize', e.target.value)}
  title="Font Size"
  defaultValue="3"
>
  <option value="1">Small</option>
  <option value="3">Normal</option>
  <option value="5">Large</option>
  <option value="7">Extra Large</option>
</select>


                <input type="color" onChange={(e) => handleCommand('foreColor', e.target.value)} title="Font Color" style={{marginLeft: '5px', height: '24px', verticalAlign: 'middle'}}/>
                <select
                    onChange={(e) => {
                        const value = e.target.value;
                        // Reset the select so the option can be chosen again later
                        e.target.selectedIndex = 0;
                        if (value === 'image-url') {
                        handleImageInsert('url');
                        } else if (value === 'image-device') {
                        handleImageInsert('device');
                        } else if (value === 'audio-url') {
                        handleAudioInsert('url');
                        } else if (value === 'audio-device') {
                        handleAudioInsert('device');
                        }
                    }}
                    title="Insert Media"
                    style={{ marginLeft: '5px', height: '34px', verticalAlign: 'middle' }}
                    >
                    <option value="">Insert Media...</option>
                    <option value="image-url">Insert Image from URL</option>
                    <option value="image-device">Upload Image from Device</option>
                    <option value="audio-url">Insert Audio from URL</option>
                    <option value="audio-device">Upload Audio from Device</option>
                    </select>

                 <input ref={imageUploadInputRef} id="imageUploadInput" type="file" accept="image/*" onChange={handleImageUpload} style={{ display: 'none' }} />
                 <input ref={audioUploadInputRef} id="audioUploadInput" type="file" accept="audio/*" onChange={handleAudioFileUpload} style={{ display: 'none' }} />
                 <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={handleInsertLayout} title="Insert Columns"><FaColumns /></button>
                <label className="toolbar-button-label" title="Import from Word (.docx)">
                    <FaFileWord />
                    <input type="file" accept=".docx" onChange={handleWordUpload} style={{ display: 'none' }} />
                </label>
                <button type="button" onClick={toggleViewSource} title={viewSource ? "View Editor" : "View Source"}>
                    <FaCode />
                </button>
                <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={handleInsertAccordion} title="Insert Accordion Item">
                    <span>Acc</span> {/* Placeholder - Use a real icon */}
                </button>
{/* --- Previous Element Actions --- */}
              {selectedElement && (selectedElement.classList.contains('image-wrapper') || selectedElement.classList.contains('audio-wrapper')) && (
                 <span className="editor-element-actions" style={{ marginLeft: '10px', borderLeft: '1px solid #ccc', paddingLeft: '10px' }}>
                     <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={handleReplaceSelectedMedia} title="Replace Media"><FaSyncAlt /></button>
                     <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={handleDeleteSelectedElement} title="Delete Media"><FaTrashAlt /></button>
                 </span>
              )}
             {selectedElement && selectedElement.classList.contains('editable-layout-container') && (
                  <span className="editor-element-actions" style={{ marginLeft: '10px', borderLeft: '1px solid #ccc', paddingLeft: '10px' }}>
                     <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={handleDeleteSelectedElement} title="Delete Layout"><FaTrashAlt /></button>
                 </span>
              )}


                {/* --- Contextual Actions for Accordion --- */}
                {selectedElement && selectedElement.getAttribute('data-editable-block') === 'accordion' && (
                    <span className="editor-element-actions" style={{ marginLeft: '10px', borderLeft: '1px solid #ccc', paddingLeft: '10px' }}>
                         {/* Button to Add Content Section */}
                        <button
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={handleAddAccordionContentSection} // Calls the function from Step 1
                            title="Add Content Section Below"
                            className="toolbar-button" // Use your button styling
                        >
                            <span>+ Section</span> {/* Button Text/Icon */}
                        </button>

                        {/* Delete Button */}
                        <button
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={handleDeleteSelectedElement}
                            title="Delete Accordion Item"
                            className="toolbar-button" // Use your button styling
                        >
                           <FaTrashAlt />
                        </button>
                    </span>
                 )}
                {/* --- End Accordion Actions --- */}

            {/* Fullscreen Toggle etc */}
                <button type="button" onClick={toggleFullscreen} title="Toggle Fullscreen" style={{marginLeft: 'auto'}}>
                    {isFullscreen ? <FaCompress /> : <FaExpand />}
                 </button>
            </div>

            {/* Privacy Toggle }
            {enablePrivacyToggle && (
                <div className="privacy-toggle">
                    <label><input type="radio" name={`privacy-${Math.random()}`} value="private" checked={privacy === 'private'} onChange={() => setPrivacy('private')} /> Private</label>
                    <label><input type="radio" name={`privacy-${Math.random()}`} value="public" checked={privacy === 'public'} onChange={() => setPrivacy('public')} /> Public</label>
                    <label><input type="radio" name={`privacy-${Math.random()}`} value="mention" checked={privacy === 'mention'} onChange={() => setPrivacy('mention')} /> Mention</label>
                </div>
            )}
                */}
             {/* Upload Errors */}
            {uploadError && <p className="editor-upload-error">{uploadError}</p>}

            {/* Editor Area */}
            {viewSource ? (
                <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    className="editor source-view"
                    placeholder={placeholder}
                    style={{ width: '100%', minHeight: '300px', height: 'auto', boxSizing: 'border-box', flexGrow: 1 }}
                />
            ) : (
              <div
              ref={editorRef}
              contentEditable={editable}
              className={`editor wysiwyg-view ${!editable ? 'is-readonly' : ''}`} 
              placeholder={placeholder}
              onClick={handleElementClick} // <<< THIS LINE
              onInput={updateContentFromEditor}
              style={{ minHeight: '300px', border: '1px solid #ccc', padding: '10px', overflowY: 'auto', flexGrow: 1 }}
            ></div>
            )}
        </div>
    );
});

export default CustomEditor;