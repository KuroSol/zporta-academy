import React, { useState, useRef, useEffect, forwardRef, useImperativeHandle, useCallback } from 'react';
import { 
  FaBold, FaItalic, FaUnderline, FaLink, FaImage, FaListUl, FaListOl, 
  FaAlignLeft, FaAlignCenter, FaAlignRight, FaCode, FaQuoteRight,
  FaBook, FaGraduationCap, FaClipboardCheck, FaEye, FaNewspaper
} from 'react-icons/fa';
import styles from '@/styles/Editor/MailMagazineEditor.module.css';
import apiClient from '@/api';

const MailMagazineEditor = forwardRef(({ initialContent = '', onChange }, ref) => {
  const editorRef = useRef(null);
  const [content, setContent] = useState(initialContent);
  const [showCodeView, setShowCodeView] = useState(false);
  const [rawHtml, setRawHtml] = useState(initialContent);
  const fileReplaceRef = useRef(null);
  const [selectedImageEl, setSelectedImageEl] = useState(null);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [showPlatformLinkModal, setShowPlatformLinkModal] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkText, setLinkText] = useState('');
  const [platformLinkType, setPlatformLinkType] = useState('lesson'); // lesson, course, quiz
  const [platformItems, setPlatformItems] = useState([]);
  const [userOwnItems, setUserOwnItems] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingItems, setLoadingItems] = useState(false);

  // Lock background scroll when any editor modal is open
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const html = document.documentElement;
    const body = document.body;
    const modalActive = showLinkModal || showPlatformLinkModal;
    if (modalActive) {
      html.style.overflowY = 'hidden';
      html.style.height = '100%';
      body.style.overflowY = 'hidden';
      body.style.height = '100%';
      const scrollBarWidth = window.innerWidth - html.clientWidth;
      if (scrollBarWidth > 0) body.style.paddingRight = scrollBarWidth + 'px';
    } else {
      html.style.overflowY = '';
      html.style.height = '';
      body.style.overflowY = '';
      body.style.height = '';
      body.style.paddingRight = '';
    }
    return () => {
      html.style.overflowY = '';
      html.style.height = '';
      body.style.overflowY = '';
      body.style.height = '';
      body.style.paddingRight = '';
    };
  }, [showLinkModal, showPlatformLinkModal]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const handleKey = (e) => {
      if (e.key === 'Escape') {
        if (showPlatformLinkModal) setShowPlatformLinkModal(false);
        if (showLinkModal) setShowLinkModal(false);
      }
      if (e.key === 'Tab' && (showPlatformLinkModal || showLinkModal)) {
        const modal = document.querySelector(`.${styles.modalContent}`);
        if (!modal) return;
        const focusables = modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
        if (!focusables.length) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', handleKey);
    if (showPlatformLinkModal || showLinkModal) {
      setTimeout(() => {
        const modal = document.querySelector(`.${styles.modalContent}`);
        if (modal) {
          const firstInput = modal.querySelector('input, button, select, textarea');
          if (firstInput) firstInput.focus();
        }
      }, 10);
    }
    return () => document.removeEventListener('keydown', handleKey);
  }, [showPlatformLinkModal, showLinkModal]);

  useEffect(() => {
    if (initialContent && editorRef.current) {
      editorRef.current.innerHTML = initialContent;
      setContent(initialContent);
      setRawHtml(initialContent);
    }
  }, [initialContent]);

  // Expose methods to parent component
  useImperativeHandle(ref, () => ({
    getContent: () => editorRef.current?.innerHTML || '',
    setContent: (html) => {
      if (editorRef.current) {
        editorRef.current.innerHTML = html;
        setContent(html);
      }
    },
    clear: () => {
      if (editorRef.current) {
        editorRef.current.innerHTML = '';
        setContent('');
      }
    }
  }));

  const handleInput = () => {
    const html = editorRef.current?.innerHTML || '';
    setContent(html);
    setRawHtml(html);
    if (onChange) onChange(html);
  };

  // Basic HTML sanitizer to prevent script injection / inline JS
  const sanitizeHtml = (dirty) => {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(dirty, 'text/html');
      // Remove scripts & style tags
      doc.querySelectorAll('script, style').forEach(el => el.remove());
      // Remove event handler attributes and javascript: URLs
      const allowedTags = new Set(['DIV','P','H1','H2','H3','H4','H5','H6','UL','OL','LI','STRONG','EM','B','I','U','BR','SPAN','A','IMG','HR']);
      const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_ELEMENT, null);
      while (walker.nextNode()) {
        const el = walker.currentNode;
        if (!allowedTags.has(el.tagName)) {
          el.replaceWith(...Array.from(el.childNodes));
          continue;
        }
        // Strip event handlers
        Array.from(el.attributes).forEach(attr => {
          const name = attr.name.toLowerCase();
          if (name.startsWith('on')) el.removeAttribute(attr.name);
          if (name === 'href' && /javascript:/i.test(attr.value)) el.removeAttribute('href');
          if (name === 'src' && /javascript:/i.test(attr.value)) el.removeAttribute('src');
        });
      }
      return doc.body.innerHTML;
    } catch (e) {
      console.warn('Sanitize failed, returning original');
      return dirty;
    }
  };

  const toggleCodeView = () => {
    if (!showCodeView) {
      // entering code view – snapshot current sanitized HTML
      setRawHtml(editorRef.current?.innerHTML || '');
    } else {
      // leaving code view – apply sanitized HTML back to editor
      const safe = sanitizeHtml(rawHtml);
      if (editorRef.current) {
        editorRef.current.innerHTML = safe;
        setContent(safe);
        if (onChange) onChange(safe);
      }
    }
    setShowCodeView(v => !v);
  };

  const handleRawChange = (e) => {
    setRawHtml(e.target.value);
  };

  // Image replacement logic: click image to select; show mini overlay
  useEffect(() => {
    if (!editorRef.current) return;
    const handler = (e) => {
      const target = e.target;
      if (target.tagName === 'IMG') {
        setSelectedImageEl(target);
      } else if (!target.closest('.mm-image-overlay')) {
        setSelectedImageEl(null);
      }
    };
    editorRef.current.addEventListener('click', handler);
    return () => editorRef.current?.removeEventListener('click', handler);
  }, []);

  const handleReplaceImageFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !selectedImageEl) return;
    const formData = new FormData();
    formData.append('image', file);
    try {
      const response = await apiClient.post('/lessons/upload-image/', formData, { headers: { 'Content-Type': 'multipart/form-data' }});
      const newUrl = response.data.url;
      selectedImageEl.src = newUrl;
      handleInput();
    } catch (err) {
      alert('Failed to replace image');
    } finally {
      e.target.value = '';
    }
  };

  const execCommand = (command, value = null) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
    handleInput();
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('image', file);

    try {
      const response = await apiClient.post('/lessons/upload-image/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      const imageUrl = response.data.url;
      execCommand('insertHTML', `<img src="${imageUrl}" alt="Magazine image" style="max-width: 100%; height: auto; border-radius: 8px; margin: 10px 0;" />`);
    } catch (error) {
      console.error('Image upload failed:', error);
      alert('Failed to upload image. Please try again.');
    }
  };

  const insertLink = () => {
    if (!linkUrl || !linkText) {
      alert('Please enter both URL and link text');
      return;
    }
    
    execCommand('insertHTML', `<a href="${linkUrl}" style="color: #ffb703; text-decoration: underline;">${linkText}</a>`);
    setShowLinkModal(false);
    setLinkUrl('');
    setLinkText('');
  };

  const searchPlatformItems = useCallback(async (query) => {
    setLoadingItems(true);
    try {
      let endpoint = '';
      switch (platformLinkType) {
        case 'lesson':
          endpoint = '/lessons/';
          break;
        case 'course':
          endpoint = '/courses/';
          break;
        case 'quiz':
          endpoint = '/quizzes/';
          break;
        case 'post':
          endpoint = '/posts/';
          break;
      }
      
      const response = await apiClient.get(endpoint);
      const allItems = response.data.results || response.data || [];
      
      // Filter items by search query on frontend (title or name)
      const filteredItems = query 
        ? allItems.filter(item => {
            const title = (item.title || item.name || '').toLowerCase();
            const content = (item.content || '').toLowerCase();
            const description = (item.description || '').toLowerCase();
            const searchLower = query.toLowerCase();
            return title.includes(searchLower) || 
                   content.includes(searchLower) || 
                   description.includes(searchLower);
          })
        : [];
      
      setPlatformItems(filteredItems);
    } catch (error) {
      console.error('Failed to search platform items:', error);
      setPlatformItems([]);
    } finally {
      setLoadingItems(false);
    }
  }, [platformLinkType]);

  const loadUserOwnItems = useCallback(async () => {
    setLoadingItems(true);
    try {
      let endpoint = '';
      switch (platformLinkType) {
        case 'lesson':
          // Use dedicated user lessons endpoint which includes permalink
          endpoint = '/lessons/my/';
          break;
        case 'course':
          endpoint = '/courses/my/';
          break;
        case 'quiz':
          endpoint = '/quizzes/my/';
          break;
        case 'post':
          endpoint = '/posts/?created_by=me';
          break;
      }
      
      if (endpoint) {
        const response = await apiClient.get(endpoint);
        setUserOwnItems(response.data.results || response.data || []);
      }
    } catch (error) {
      console.error('Failed to load user items:', error);
      setUserOwnItems([]);
    } finally {
      setLoadingItems(false);
    }
  }, [platformLinkType]);

  useEffect(() => {
    if (showPlatformLinkModal) {
      setSearchQuery('');
      setPlatformItems([]);
      setSelectedItem(null);
      loadUserOwnItems();
    } else {
      // Clear all items when modal closes
      setUserOwnItems([]);
      setPlatformItems([]);
      setSelectedItem(null);
    }
  }, [showPlatformLinkModal, platformLinkType, loadUserOwnItems]);

  useEffect(() => {
    if (searchQuery.length >= 2) {
      const timer = setTimeout(() => searchPlatformItems(searchQuery), 300);
      return () => clearTimeout(timer);
    } else if (searchQuery.length === 0) {
      // Clear search results when search is cleared
      setPlatformItems([]);
    }
  }, [searchQuery, searchPlatformItems]);

  const insertPlatformLink = () => {
    if (!selectedItem) {
      alert('Please select an item to link');
      return;
    }

    let url = '';
    let title = selectedItem.title || selectedItem.name || 'View';
    let icon = '';
    
    switch (platformLinkType) {
      case 'lesson':
        if (!selectedItem.permalink) {
          alert('This lesson item is missing a permalink and cannot be linked. Please refresh the list.');
          return;
        }
        url = `/lessons/${selectedItem.permalink}`;
        icon = '📚';
        break;
      case 'course':
        // Course permalink already encodes username/date/subject/title.
        // Use it directly to avoid undefined segments and duplication.
        url = `/courses/${selectedItem.permalink}`;
        icon = '🎓';
        break;
      case 'quiz':
        if (!selectedItem.permalink) {
          alert('This quiz item is missing a permalink and cannot be linked. Please refresh the list.');
          return;
        }
        url = `/quizzes/${selectedItem.permalink}`;
        icon = '📋';
        break;
      case 'post':
        url = `/posts/${selectedItem.permalink}`;
        icon = '📰';
        break;
    }

    const fullUrl = `https://zportaacademy.com${url}`;
    const linkHtml = `<a href="${fullUrl}" style="color: #ffb703; text-decoration: underline; font-weight: 600;">${icon} ${title}</a>`;
    
    execCommand('insertHTML', linkHtml);
    setShowPlatformLinkModal(false);
    setSelectedItem(null);
    setSearchQuery('');
    setPlatformItems([]);
    setUserOwnItems([]);
  };

  const insertTemplate = (template) => {
    const templates = {
      welcome: `
        <h2 style="color: #ffb703; margin-bottom: 16px;">Welcome to Our Learning Community! 🎓</h2>
        <p style="line-height: 1.8; margin-bottom: 16px;">Dear Student,</p>
        <p style="line-height: 1.8; margin-bottom: 16px;">We're excited to have you here! This week, we have some amazing new content for you:</p>
        <ul style="line-height: 2; margin-bottom: 16px;">
          <li>New lessons on [topic]</li>
          <li>Interactive quizzes to test your knowledge</li>
          <li>Upcoming live session on [date]</li>
        </ul>
        <p style="line-height: 1.8; margin-bottom: 16px;">Keep learning and stay motivated!</p>
        <p style="line-height: 1.8;">Best regards,<br/><strong>Your Teacher</strong></p>
      `,
      update: `
        <h2 style="color: #ffb703; margin-bottom: 16px;">Weekly Update 📰</h2>
        <p style="line-height: 1.8; margin-bottom: 16px;">Hello everyone!</p>
        <p style="line-height: 1.8; margin-bottom: 16px;">Here's what's new this week:</p>
        <h3 style="color: #43d9ad; margin: 24px 0 12px;">📚 New Content</h3>
        <p style="line-height: 1.8; margin-bottom: 16px;">[Describe new lessons or materials]</p>
        <h3 style="color: #43d9ad; margin: 24px 0 12px;">🎯 This Week's Focus</h3>
        <p style="line-height: 1.8; margin-bottom: 16px;">[Main topic or goal]</p>
        <h3 style="color: #43d9ad; margin: 24px 0 12px;">💡 Pro Tip</h3>
        <p style="line-height: 1.8; margin-bottom: 16px;">[Study tip or advice]</p>
      `,
      reminder: `
        <h2 style="color: #ffb703; margin-bottom: 16px;">⏰ Friendly Reminder</h2>
        <p style="line-height: 1.8; margin-bottom: 16px;">Hi there!</p>
        <p style="line-height: 1.8; margin-bottom: 16px;">Just a quick reminder about:</p>
        <div style="background: rgba(255, 183, 3, 0.1); border-left: 4px solid #ffb703; padding: 16px; margin: 16px 0; border-radius: 4px;">
          <p style="margin: 0; line-height: 1.8;"><strong>[Event or deadline]</strong></p>
          <p style="margin: 8px 0 0; line-height: 1.8;">Date: [Date and time]</p>
        </div>
        <p style="line-height: 1.8; margin-bottom: 16px;">Don't forget to prepare and join us!</p>
        <p style="line-height: 1.8;">See you there! 👋</p>
      `,
      achievement: `
        <h2 style="color: #ffb703; margin-bottom: 16px;">🎉 Congratulations!</h2>
        <p style="line-height: 1.8; margin-bottom: 16px;">Amazing work!</p>
        <p style="line-height: 1.8; margin-bottom: 16px;">We're proud to share that you've achieved:</p>
        <div style="background: linear-gradient(135deg, rgba(255, 183, 3, 0.2), rgba(67, 217, 173, 0.2)); padding: 24px; border-radius: 12px; margin: 24px 0; text-align: center;">
          <h3 style="color: #43d9ad; margin: 0 0 8px; font-size: 24px;">🏆 [Achievement Name]</h3>
          <p style="margin: 0; line-height: 1.8;">[Description of achievement]</p>
        </div>
        <p style="line-height: 1.8; margin-bottom: 16px;">Keep up the excellent work!</p>
      `
    };

    if (editorRef.current) {
      editorRef.current.innerHTML = templates[template] || '';
      handleInput();
    }
  };

  return (
    <div className={styles.editorContainer}>
      {/* Toolbar */}
      <div className={styles.toolbar}>
        <div className={styles.toolbarGroup}>
          <button type="button" onClick={() => execCommand('bold')} title="Bold">
            <FaBold />
          </button>
          <button type="button" onClick={() => execCommand('italic')} title="Italic">
            <FaItalic />
          </button>
          <button type="button" onClick={() => execCommand('underline')} title="Underline">
            <FaUnderline />
          </button>
          <button type="button" onClick={toggleCodeView} title={showCodeView ? 'Exit Code View' : 'HTML Code View'}>
            <FaCode />
          </button>
        </div>

        <div className={styles.toolbarGroup}>
          <button type="button" onClick={() => execCommand('justifyLeft')} title="Align Left">
            <FaAlignLeft />
          </button>
          <button type="button" onClick={() => execCommand('justifyCenter')} title="Align Center">
            <FaAlignCenter />
          </button>
          <button type="button" onClick={() => execCommand('justifyRight')} title="Align Right">
            <FaAlignRight />
          </button>
        </div>

        <div className={styles.toolbarGroup}>
          <button type="button" onClick={() => execCommand('insertUnorderedList')} title="Bullet List">
            <FaListUl />
          </button>
          <button type="button" onClick={() => execCommand('insertOrderedList')} title="Numbered List">
            <FaListOl />
          </button>
        </div>

        <div className={styles.toolbarGroup}>
          <button type="button" onClick={() => execCommand('formatBlock', 'h2')} title="Heading">
            <strong>H2</strong>
          </button>
          <button type="button" onClick={() => execCommand('formatBlock', 'h3')} title="Subheading">
            <strong>H3</strong>
          </button>
        </div>

        <div className={styles.toolbarGroup}>
          <button type="button" onClick={() => setShowLinkModal(true)} title="Insert Link">
            <FaLink />
          </button>
          <label className={styles.uploadButton} title="Insert Image">
            <FaImage />
            <input 
              type="file" 
              accept="image/*" 
              onChange={handleImageUpload} 
              style={{ display: 'none' }}
            />
          </label>
        </div>

        <div className={styles.toolbarGroup}>
          <button 
            type="button" 
            onClick={() => { setShowPlatformLinkModal(true); setPlatformLinkType('lesson'); }} 
            title="Link to Lesson"
          >
            <FaBook /> Lesson
          </button>
          <button 
            type="button" 
            onClick={() => { setShowPlatformLinkModal(true); setPlatformLinkType('course'); }} 
            title="Link to Course"
          >
            <FaGraduationCap /> Course
          </button>
          <button 
            type="button" 
            onClick={() => { setShowPlatformLinkModal(true); setPlatformLinkType('quiz'); }} 
            title="Link to Quiz"
          >
            <FaClipboardCheck /> Quiz
          </button>
          <button 
            type="button" 
            onClick={() => { setShowPlatformLinkModal(true); setPlatformLinkType('post'); }} 
            title="Link to Post"
          >
            <FaNewspaper /> Post
          </button>
        </div>

        <div className={styles.toolbarGroup}>
          <select 
            onChange={(e) => insertTemplate(e.target.value)} 
            value="" 
            className={styles.templateSelect}
          >
            <option value="">📋 Insert Template</option>
            <option value="welcome">👋 Welcome Message</option>
            <option value="update">📰 Weekly Update</option>
            <option value="reminder">⏰ Reminder</option>
            <option value="achievement">🎉 Achievement</option>
          </select>
        </div>
      </div>

      {/* Editor */}
      {!showCodeView && (
        <div
          ref={editorRef}
          className={styles.editor}
          contentEditable
          onInput={handleInput}
          data-placeholder="Write your mail magazine content here... Use the toolbar above to format text, add links, images, and templates."
        />
      )}
      {showCodeView && (
        <textarea
          className={styles.codeView}
          value={rawHtml}
          onChange={handleRawChange}
          placeholder="Edit raw HTML here. Unsafe tags will be stripped on apply."
          style={{
            width: '100%',
            minHeight: '320px',
            background: '#0b1523',
            color: '#ffb703',
            fontFamily: 'monospace',
            fontSize: '14px',
            padding: '12px',
            border: '1px solid #1e293b',
            borderRadius: '8px'
          }}
        />
      )}

      {selectedImageEl && !showCodeView && (
        <div className="mm-image-overlay" style={{ position: 'absolute', zIndex: 20 }}>
          <div style={{
            position: 'fixed',
            top: '12px',
            right: '12px',
            background: '#142233',
            padding: '8px 12px',
            border: '1px solid #1e293b',
            borderRadius: '6px',
            display: 'flex',
            gap: '8px'
          }}>
            <button type="button" onClick={() => fileReplaceRef.current?.click()} style={{ background:'#ffb703', color:'#0b1523', border:'none', padding:'6px 10px', borderRadius:'4px', cursor:'pointer' }}>Replace Image</button>
            <button type="button" onClick={() => { selectedImageEl.remove(); setSelectedImageEl(null); handleInput(); }} style={{ background:'#1e293b', color:'#fff', border:'none', padding:'6px 10px', borderRadius:'4px', cursor:'pointer' }}>Remove</button>
            <button type="button" onClick={() => setSelectedImageEl(null)} style={{ background:'transparent', color:'#94a3b8', border:'1px solid #1e293b', padding:'6px 10px', borderRadius:'4px', cursor:'pointer' }}>Done</button>
            <input ref={fileReplaceRef} type="file" accept="image/*" style={{ display:'none' }} onChange={handleReplaceImageFile} />
          </div>
        </div>
      )}

      {/* Link Modal */}
      {showLinkModal && (
        <div className={styles.modal} onClick={() => setShowLinkModal(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <h3>Insert Link</h3>
            <input
              type="text"
              placeholder="Link text (e.g., Click here)"
              value={linkText}
              onChange={(e) => setLinkText(e.target.value)}
              className={styles.modalInput}
            />
            <input
              type="url"
              placeholder="URL (e.g., https://example.com)"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              className={styles.modalInput}
            />
            <div className={styles.modalActions}>
              <button type="button" onClick={insertLink} className={styles.primaryBtn}>
                Insert Link
              </button>
              <button type="button" onClick={() => setShowLinkModal(false)} className={styles.secondaryBtn}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Platform Link Modal */}
      {showPlatformLinkModal && (
        <div className={styles.modal} onClick={() => setShowPlatformLinkModal(false)}>
          <div 
            className={styles.modalContent} 
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="platform-link-modal-title"
          >
            <h3 id="platform-link-modal-title">
              {platformLinkType === 'lesson' && <><FaBook /> Link to Lesson</>}
              {platformLinkType === 'course' && <><FaGraduationCap /> Link to Course</>}
              {platformLinkType === 'quiz' && <><FaClipboardCheck /> Link to Quiz</>}
              {platformLinkType === 'post' && <><FaNewspaper /> Link to Post</>}
            </h3>

            <input
              type="text"
              placeholder={`Search all ${platformLinkType}s (type at least 2 characters)...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={styles.modalInput}
            />

            <div className={styles.itemList}>
              {loadingItems ? (
                <p className={styles.emptyText}>Loading...</p>
              ) : (
                <>
                  {/* Show user's own items only when NOT searching */}
                  {searchQuery.length < 2 && userOwnItems.length > 0 && (
                    <>
                      <h4 className={styles.sectionHeader}>Your {platformLinkType}s</h4>
                      {userOwnItems.map((item) => (
                        <div
                          key={item.id}
                          className={`${styles.itemCard} ${selectedItem?.id === item.id ? styles.selected : ''}`}
                          onClick={() => setSelectedItem(item)}
                        >
                          <h4>{item.title || item.name}</h4>
                          {item.description && <p>{item.description?.slice(0, 100)}</p>}
                          {item.content && !item.description && <p>{item.content?.replace(/<[^>]*>/g, '').slice(0, 100)}</p>}
                        </div>
                      ))}
                    </>
                  )}
                  
                  {/* Show search results only when searching */}
                  {searchQuery.length >= 2 && platformItems.length > 0 && (
                    <>
                      <h4 className={styles.sectionHeader}>Search Results</h4>
                      {platformItems.map((item) => (
                        <div
                          key={item.id}
                          className={`${styles.itemCard} ${selectedItem?.id === item.id ? styles.selected : ''}`}
                          onClick={() => setSelectedItem(item)}
                        >
                          <h4>{item.title || item.name}</h4>
                          {item.description && <p>{item.description?.slice(0, 100)}</p>}
                          {item.content && !item.description && <p>{item.content?.replace(/<[^>]*>/g, '').slice(0, 100)}</p>}
                        </div>
                      ))}
                    </>
                  )}
                  
                  {searchQuery.length < 2 && userOwnItems.length === 0 && (
                    <p className={styles.emptyText}>No {platformLinkType}s found. Create some first!</p>
                  )}
                  
                  {searchQuery.length >= 2 && platformItems.length === 0 && (
                    <p className={styles.emptyText}>No search results found</p>
                  )}
                </>
              )}
            </div>

            <div className={styles.modalActions}>
              <button 
                type="button" 
                onClick={insertPlatformLink} 
                className={styles.primaryBtn}
                disabled={!selectedItem}
              >
                Insert Link
              </button>
              <button type="button" onClick={() => setShowPlatformLinkModal(false)} className={styles.secondaryBtn}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

MailMagazineEditor.displayName = 'MailMagazineEditor';

export default MailMagazineEditor;
