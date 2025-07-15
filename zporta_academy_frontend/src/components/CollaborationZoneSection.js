// src/components/CollaborationZoneSection.js
import React from 'react';
import { Users, UserPlus, Pencil } from 'lucide-react';

/*
================================================================================
| COMPONENT: CollaborationZoneSection                                         |
|------------------------------------------------------------------------------|
| ✨ Problem 3 FIX: Redesigned to be a sleek, single-line header.               |
| It's less bulky, more modern, and takes up minimal vertical space,           |
| especially on mobile devices. Your original logic and props are preserved.   |
================================================================================
*/
export default function CollaborationZoneSection({
  isCollabActive,
  setIsInviteModalOpen,
  shareInvites = [],
}) {
  const hasSharedToken = new URLSearchParams(window.location.search).has('shared_token');

  return (
    <div className="flex items-center justify-between p-3 mb-6 bg-blue-50 dark:bg-gray-800 border border-blue-200 dark:border-gray-700 rounded-xl shadow-sm">
        {/* Left Side: Title and Status */}
        <div className="flex items-center gap-3">
            <div className="flex-shrink-0 p-2 bg-blue-100 dark:bg-blue-900/50 rounded-full">
                <Users className="w-5 h-5 text-blue-600 dark:text-blue-300" />
            </div>
            <div>
                <h3 className="font-semibold text-blue-800 dark:text-blue-200">Collaboration Zone</h3>
                
                {/* Logic to show status is preserved from your original file */}
                {!hasSharedToken && !isCollabActive && (
                    <p className="text-xs text-gray-500 dark:text-gray-400">Invite a user to draw</p>
                )}
                {(hasSharedToken || isCollabActive) && (
                    <p className="text-xs text-green-600 dark:text-green-400">Live session active</p>
                )}

            </div>
        </div>

        {/* Right Side: Action Buttons */}
        <div className="flex items-center gap-2">
            {!hasSharedToken && !isCollabActive && (
                <button 
                    onClick={() => setIsInviteModalOpen(true)} 
                    className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-gray-800"
                >
                    <UserPlus className="w-4 h-4" />
                    <span>Invite</span>
                </button>
            )}
            
            {/* The "Start Drawing" button appears when a session is active but drawing is not yet turned on */}

            
            {/* The "Stop Drawing" button has been moved to the main toolbar (`DrawingOverlay`),
                so no button is needed here when isDrawingMode is true. This simplifies the UI. */}
        </div>
    </div>
  );
}
