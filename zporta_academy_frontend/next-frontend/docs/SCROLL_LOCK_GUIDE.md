# Body Scroll Lock System - Usage Guide

## Overview
This app has a **global scroll lock system** that prevents background scrolling when modals, popups, or dialogs are open. It automatically compensates for scrollbar width to prevent layout shift.

## How It Works

### 1. **Automatic Implementation**
The system uses:
- A custom React hook: `useBodyScrollLock`
- Global CSS classes: `modal-open` and `modal-scroll-content`
- Utility functions: `lockBodyScroll()` and `unlockBodyScroll()`

### 2. **Key Features**
✅ Prevents background scroll on all devices (desktop, tablet, mobile)  
✅ Prevents iOS Safari bounce effect  
✅ Compensates for scrollbar width (no layout shift)  
✅ Allows modal content to scroll normally  
✅ Supports multiple modals (uses lock counter)  
✅ SSR-safe (works with Next.js)

---

## Usage Examples

### Method 1: Using the React Hook (Recommended)

```jsx
import { useState } from 'react';
import useBodyScrollLock from '@/hooks/useBodyScrollLock';

function MyModal() {
  const [isOpen, setIsOpen] = useState(false);
  
  // This single line locks the body scroll when modal is open!
  useBodyScrollLock(isOpen);

  return (
    <>
      <button onClick={() => setIsOpen(true)}>Open Modal</button>
      
      {isOpen && (
        <div className="modal-wrapper">
          <div className="modal-scroll-content">
            <h2>My Modal</h2>
            <p>Background won't scroll now!</p>
            <button onClick={() => setIsOpen(false)}>Close</button>
          </div>
        </div>
      )}
    </>
  );
}
```

### Method 2: Using Utility Functions Directly

```jsx
import { lockBodyScroll, unlockBodyScroll } from '@/utils/scrollLock';

function MyComponent() {
  const handleOpenModal = () => {
    lockBodyScroll();
    // ... show modal
  };

  const handleCloseModal = () => {
    unlockBodyScroll();
    // ... hide modal
  };

  return (
    <button onClick={handleOpenModal}>Open</button>
  );
}
```

### Method 3: In Class Components

```jsx
import { Component } from 'react';
import { lockBodyScroll, unlockBodyScroll } from '@/utils/scrollLock';

class MyModal extends Component {
  componentDidMount() {
    if (this.props.isOpen) {
      lockBodyScroll();
    }
  }

  componentDidUpdate(prevProps) {
    if (this.props.isOpen && !prevProps.isOpen) {
      lockBodyScroll();
    } else if (!this.props.isOpen && prevProps.isOpen) {
      unlockBodyScroll();
    }
  }

  componentWillUnmount() {
    unlockBodyScroll();
  }

  render() {
    // ... modal JSX
  }
}
```

---

## CSS Classes

### `modal-open` (Applied to body/html)
Automatically applied when `lockBodyScroll()` is called. Prevents body scrolling.

```css
body.modal-open {
  overflow: hidden !important;
  position: fixed !important;
  width: 100% !important;
}
```

### `modal-scroll-content` (Apply to your modal content)
Ensures your modal/popup content CAN scroll even when body is locked.

```jsx
<div className="modal-scroll-content">
  {/* Your long content that should scroll */}
</div>
```

---

## Real-World Examples

### Example 1: Settings Panel (LessonEditor)
```jsx
const [editingBlockId, setEditingBlockId] = useState(null);

// Lock scroll when settings panel opens
useBodyScrollLock(!!editingBlockId);

return (
  <>
    <button onClick={() => setEditingBlockId('block-123')}>
      Edit Block
    </button>
    
    {editingBlockId && (
      <div className="settings-panel-wrapper">
        <div className="modal-scroll-content">
          {/* Settings form */}
        </div>
      </div>
    )}
  </>
);
```

### Example 2: Multiple Conditions
```jsx
const [isModalOpen, setIsModalOpen] = useState(false);
const [isDrawerOpen, setIsDrawerOpen] = useState(false);

// Lock when either modal OR drawer is open
useBodyScrollLock(isModalOpen || isDrawerOpen);
```

### Example 3: Notification Toast (No scroll lock needed)
```jsx
function Toast() {
  // Don't lock scroll for non-blocking UI elements like toasts
  // Only lock for dialogs, modals, drawers that overlay the page
  return <div className="toast">Saved!</div>;
}
```

---

## Mobile Considerations

### iOS Safari
The system includes special handling for iOS Safari's bounce effect:
- Sets `position: fixed` on body
- Prevents `touchmove` events on background
- Allows scrolling inside `modal-scroll-content` elements

### Android
Works automatically with the `overflow: hidden` approach.

---

## Troubleshooting

### Problem: Modal content won't scroll
**Solution:** Add `modal-scroll-content` class to your scrollable container:
```jsx
<div className="modal-scroll-content">
  {/* Content */}
</div>
```

### Problem: Background still scrolls on mobile
**Solution:** Make sure you're using the hook, not just CSS:
```jsx
useBodyScrollLock(isOpen); // ✅ Good
```

### Problem: Multiple modals cause issues
**Solution:** The system uses a counter, so each modal can independently lock/unlock:
```jsx
useBodyScrollLock(isModal1Open);  // Lock count: 1
useBodyScrollLock(isModal2Open);  // Lock count: 2
// Body unlocks only when both close
```

### Problem: Layout shifts when modal opens
**Solution:** Already handled! The system calculates scrollbar width and adds padding automatically.

---

## Best Practices

1. **Always use the hook for React components:**
   ```jsx
   useBodyScrollLock(isModalOpen);
   ```

2. **Add `modal-scroll-content` to scrollable areas:**
   ```jsx
   <div className="modal-scroll-content">
     <LongContent />
   </div>
   ```

3. **Clean up properly:**
   The hook handles cleanup automatically, but if using utility functions directly:
   ```jsx
   useEffect(() => {
     if (isOpen) lockBodyScroll();
     return () => unlockBodyScroll(); // Always clean up!
   }, [isOpen]);
   ```

4. **Use for blocking UI only:**
   - ✅ Modals, dialogs, drawers
   - ✅ Full-screen overlays
   - ❌ Toasts, tooltips, dropdowns (unless they block interaction)

---

## API Reference

### `useBodyScrollLock(isLocked: boolean)`
React hook that locks/unlocks body scroll.

**Parameters:**
- `isLocked` (boolean): Whether to lock the scroll

**Example:**
```jsx
useBodyScrollLock(isModalOpen);
```

---

### `lockBodyScroll()`
Utility function to lock body scroll. Can be called multiple times (uses counter).

**Example:**
```jsx
import { lockBodyScroll } from '@/utils/scrollLock';
lockBodyScroll();
```

---

### `unlockBodyScroll()`
Utility function to unlock body scroll. Decrements counter.

**Example:**
```jsx
import { unlockBodyScroll } from '@/utils/scrollLock';
unlockBodyScroll();
```

---

## Files Involved

- **Hook:** `src/hooks/useBodyScrollLock.js`
- **Utilities:** `src/utils/scrollLock.js`
- **Global CSS:** `src/styles/globals.css` (`.modal-open`, `.modal-scroll-content`)
- **Example Usage:** `src/components/Editor/LessonEditor.js`

---

## Summary

✨ **Your app now has a production-ready scroll lock system!**

Simply use `useBodyScrollLock(isOpen)` in any component with a modal/popup, and the background will be locked automatically. No more scrolling behind modals! 🎉
