// src/components/CollaborationZoneSection.js
import React from 'react';
import { Users, UserPlus, Pencil } from 'lucide-react';

/**
 * CollaborationZoneSection
 * 
 * Props:
 * - isCollabActive: boolean
 * - isDrawingMode: boolean
 * - setIsDrawingMode: (boolean) => void
 * - setIsInviteModalOpen: () => void
 */
export default function CollaborationZoneSection({
  isCollabActive,
  isDrawingMode,
  setIsDrawingMode,
  setIsInviteModalOpen,
  shareInvites = [], 
}) {
  const hasSharedToken = new URLSearchParams(window.location.search).has('shared_token');

  return (
    <div className="p-4 mb-6 bg-blue-50 dark:bg-gray-800 border border-blue-200 dark:border-gray-700 rounded-lg shadow-sm">
      <h3 className="text-lg font-semibold text-blue-800 dark:text-blue-300 flex items-center mb-3">
        <Users className="w-5 h-5 mr-2" />
        Collaboration Zone
      </h3>

      {!hasSharedToken && !isCollabActive && (
        <>
          <p className="text-sm mb-3">
            Invite another enrolled user to share this page in real-time.
          </p>
          <button
            onClick={() => setIsInviteModalOpen(true)}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md shadow-sm"
          >
            <UserPlus className="w-4 h-4 mr-2" />
            Invite User
          </button>
        </>
      )}

      {(hasSharedToken || isCollabActive) && (
        <>
          <p className="text-sm mb-3 text-green-600 dark:text-green-400">
            ✓ Live session active!
          </p>
          <button
            onClick={() => setIsDrawingMode((prev) => !prev)}
            className={`inline-flex items-center px-4 py-2 text-sm rounded-md transition-colors ${
              isDrawingMode ? 'bg-red-500 text-white' : 'bg-green-500 text-white'
            }`}
          >
            <Pencil className="w-4 h-4 mr-2" />
            {isDrawingMode ? 'Stop Drawing' : 'Start Drawing'}
          </button>

          {shareInvites.length > 0 && (
           <section className="mt-4 p-4 bg-white dark:bg-gray-800 rounded-md shadow">
             <h4 className="font-semibold mb-2 text-gray-700 dark:text-gray-300">
               Shared Sessions
             </h4>
             <ul className="space-y-2">
                {shareInvites.map(invite => {
                  // whichever field your serializer is actually returning:
                  const user = invite.invited_user_detail || invite.invited_user || {};
                  return (
                    <li key={invite.id} className="border-b pb-2 last:border-b-0">
                      <p>
                        <strong>Token:</strong> <code>{invite.token}</code>
                      </p>
                      <p>
                        <strong>With:</strong> {user.username ?? '—'} ({user.email ?? '—'})
                      </p>
                      <p>
                        <strong>On:</strong>{" "}
                        {new Date(invite.created_at).toLocaleString()}
                      </p>
                    </li>
                  )
                })}
             </ul>
           </section>
         )}
        </>
      )}
    </div>
  );
}
