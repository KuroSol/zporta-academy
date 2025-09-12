// src/components/collab/CollaborationZoneSection.js
import React, { useMemo } from 'react';
import { Users, UserPlus } from 'lucide-react';
import { useRouter } from 'next/router';

export default function CollaborationZoneSection({
  isCollabActive,
  setIsInviteModalOpen,
  shareInvites = [],
}) {
  const router = useRouter();
  const hasSharedToken = useMemo(() => {
    if (router?.query && 'shared_token' in router.query) return true;
    if (typeof window !== 'undefined') {
      return new URLSearchParams(window.location.search).has('shared_token');
    }
    return false;
  }, [router?.query]);

  return (
    <div className="flex items-center justify-between p-3 mb-6 bg-blue-50 dark:bg-gray-800 border border-blue-200 dark:border-gray-700 rounded-xl shadow-sm">
      <div className="flex items-center gap-3">
        <div className="flex-shrink-0 p-2 bg-blue-100 dark:bg-blue-900/50 rounded-full">
          <Users className="w-5 h-5 text-blue-600 dark:text-blue-300" />
        </div>
        <div>
          <h3 className="font-semibold text-blue-800 dark:text-blue-200">Collaboration Zone</h3>
          {!hasSharedToken && !isCollabActive && (
            <p className="text-xs text-gray-500 dark:text-gray-400">Invite a user to draw</p>
          )}
          {(hasSharedToken || isCollabActive) && (
            <p className="text-xs text-green-600 dark:text-green-400">Live session active</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        {!hasSharedToken && !isCollabActive && (
          <button
            onClick={() => setIsInviteModalOpen(true)}
            className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-gray-800"
          >
            <UserPlus className="w-4 h-4" />
            <span>Invite</span>
          </button>
        )}
      </div>
    </div>
  );
}
