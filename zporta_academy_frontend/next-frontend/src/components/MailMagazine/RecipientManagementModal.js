import React, { useState, useEffect, useCallback } from "react";
import apiClient from "@/api";
import styles from "@/styles/RecipientManagement.module.css";
import {
  FaSearch,
  FaTimes,
  FaUserPlus,
  FaUsers,
  FaSave,
  FaTrash,
  FaPlus,
  FaFolder,
} from "react-icons/fa";

/**
 * Advanced Recipient Management Modal
 * Features:
 * - Real-time search by name/email
 * - Filter by course, email preference, guide status
 * - Bulk add/remove recipients
 * - Saved recipient groups
 * - Dynamic course-based groups
 */
const RecipientManagementModal = ({ magazine, onClose, onSave }) => {
  // UI state
  const [searchText, setSearchText] = useState("");
  const [activeTab, setActiveTab] = useState("available"); // 'available', 'selected', 'groups'
  const [showNewGroupForm, setShowNewGroupForm] = useState(false);

  // Data state
  const [availableStudents, setAvailableStudents] = useState([]);
  const [selectedRecipients, setSelectedRecipients] = useState([]);
  const [recipientGroups, setRecipientGroups] = useState([]);
  const [groupFilter, setGroupFilter] = useState("");
  const [groupMemberSelect, setGroupMemberSelect] = useState({});

  // Filters
  const [filters, setFilters] = useState({
    courseId: "",
  });

  // New group form
  const [newGroup, setNewGroup] = useState({
    name: "",
    description: "",
    isDynamic: false,
    linkedCourse: "",
  });
  const [newGroupMembers, setNewGroupMembers] = useState([]);

  // Loading state
  const [loading, setLoading] = useState(false);
  const [courses, setCourses] = useState([]);

  // Load available students
  const loadAvailableStudents = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchText) params.append("search", searchText);
      if (filters.courseId) params.append("course_id", filters.courseId);

      const { data } = await apiClient.get(
        `/recipient-management/available_students/?${params}`
      );

      // Filter by email preference if specified
      let students = (data.students || []).filter(
        (s) =>
          (s.email_enabled ?? true) &&
          (s.guide_status === "accepted" || !s.guide_status)
      );

      setAvailableStudents(students);
    } catch (error) {
      console.error("Failed to load available students:", error);
      setAvailableStudents([]);
    } finally {
      setLoading(false);
    }
  }, [searchText, filters]);

  // Load recipient groups
  const loadRecipientGroups = useCallback(async () => {
    try {
      const { data } = await apiClient.get("/recipient-groups/");
      setRecipientGroups(data.results || data);
    } catch (error) {
      console.error("Failed to load recipient groups:", error);
    }
  }, []);

  // Load courses for filter dropdown
  const loadCourses = useCallback(async () => {
    try {
      const { data } = await apiClient.get("/courses/my/");
      setCourses(data.results ? data.results : data);
    } catch (error) {
      console.error("Failed to load courses:", error);
    }
  }, []);

  // Load initial data
  useEffect(() => {
    loadAvailableStudents();
    loadRecipientGroups();
    loadCourses();

    // Load current magazine's recipients if exists
    if (magazine?.id) {
      loadMagazineRecipients();
    }
  }, []);

  // Reload when filters change
  useEffect(() => {
    const timer = setTimeout(() => {
      loadAvailableStudents();
    }, 300); // Debounce search
    return () => clearTimeout(timer);
  }, [searchText, filters, loadAvailableStudents]);

  const loadMagazineRecipients = async () => {
    try {
      const { data } = await apiClient.get(
        `/teacher-mail-magazines/${magazine.id}/`
      );
      // Prefer detailed objects when available; fall back to IDs if necessary
      const detailed =
        data.selected_recipients_details || data.selected_recipients || [];
      setSelectedRecipients(detailed);
    } catch (error) {
      console.error("Failed to load magazine recipients:", error);
    }
  };

  // Handlers
  const handleAddRecipient = (student) => {
    if (!selectedRecipients.find((r) => r.id === student.id)) {
      setSelectedRecipients([...selectedRecipients, student]);
    }
  };

  const handleRemoveRecipient = (studentId) => {
    setSelectedRecipients(selectedRecipients.filter((r) => r.id !== studentId));
  };

  const handleAddAll = () => {
    const newRecipients = availableStudents.filter(
      (s) => !selectedRecipients.find((r) => r.id === s.id)
    );
    setSelectedRecipients([...selectedRecipients, ...newRecipients]);
  };

  const handleRemoveAll = () => {
    setSelectedRecipients([]);
  };

  const handleApplyGroup = async (group) => {
    try {
      await apiClient.post(`/recipient-groups/${group.id}/apply_to_magazine/`, {
        magazine_id: magazine.id,
      });
      // Reload recipients from magazine detail to ensure consistent shape
      await loadMagazineRecipients();
    } catch (error) {
      console.error("Failed to apply group:", error);
    }
  };

  const handleSaveNewGroup = async () => {
    if (!newGroup.name.trim()) {
      alert("Please enter a group name");
      return;
    }

    if (newGroup.isDynamic && !newGroup.linkedCourse) {
      alert("Please choose a course for a dynamic group.");
      return;
    }

    // Validate chosen course exists when dynamic
    const courseIdValue = newGroup.linkedCourse;
    const courseIdValid =
      courseIdValue &&
      courses.some((c) => String(c.id) === String(courseIdValue));
    if (newGroup.isDynamic && !courseIdValid) {
      alert("Selected course is not available. Please choose a valid course.");
      return;
    }

    try {
      const groupData = {
        name: newGroup.name,
        description: newGroup.description,
        is_dynamic: newGroup.isDynamic,
        linked_course:
          newGroup.isDynamic && courseIdValid ? Number(courseIdValue) : null,
      };

      const { data } = await apiClient.post("/recipient-groups/", groupData);

      // Add members if not dynamic
      const memberIds = newGroup.isDynamic
        ? []
        : newGroupMembers.length > 0
        ? newGroupMembers
        : selectedRecipients.map((r) => r.id);

      if (!newGroup.isDynamic && memberIds.length > 0) {
        await apiClient.post(`/recipient-groups/${data.id}/add_members/`, {
          member_ids: memberIds,
        });
      }

      setRecipientGroups([...recipientGroups, data]);
      setNewGroup({
        name: "",
        description: "",
        isDynamic: false,
        linkedCourse: "",
      });
      setNewGroupMembers([]);
      setShowNewGroupForm(false);
    } catch (error) {
      console.error("Failed to create group:", error);
      const detail =
        error?.response?.data || "Failed to create recipient group";
      alert(JSON.stringify(detail));
    }
  };

  const handleSaveRecipients = async () => {
    try {
      await apiClient.post(`/recipient-management/bulk_add_recipients/`, {
        magazine_id: magazine.id,
        recipient_ids: selectedRecipients.map((r) => r.id),
      });
      onSave();
    } catch (error) {
      console.error("Failed to save recipients:", error);
      alert("Failed to save recipients");
    }
  };

  const handleDeleteGroup = async (groupId) => {
    if (!confirm("Are you sure you want to delete this group?")) return;

    try {
      await apiClient.delete(`/recipient-groups/${groupId}/`);
      setRecipientGroups(recipientGroups.filter((g) => g.id !== groupId));
    } catch (error) {
      console.error("Failed to delete group:", error);
      alert("Failed to delete group");
    }
  };

  const handleAddMemberToGroup = async (groupId) => {
    const memberId = groupMemberSelect[groupId];
    if (!memberId) return;
    try {
      await apiClient.post(`/recipient-groups/${groupId}/add_members/`, {
        member_ids: [Number(memberId)],
      });
      await loadRecipientGroups();
      setGroupMemberSelect((prev) => ({ ...prev, [groupId]: "" }));
    } catch (error) {
      console.error("Failed to add member to group:", error);
      alert("Failed to add member to group");
    }
  };

  const handleAddSelectedRecipientsToGroup = async (groupId) => {
    const memberIds = selectedRecipients.map((r) => r.id);
    if (memberIds.length === 0) return;
    try {
      await apiClient.post(`/recipient-groups/${groupId}/add_members/`, {
        member_ids: memberIds,
      });
      await loadRecipientGroups();
    } catch (error) {
      console.error("Failed to add selected recipients to group:", error);
      alert("Failed to add selected recipients to group");
    }
  };

  const filteredAvailableStudents = availableStudents.filter((student) => {
    const alreadySelected = selectedRecipients.some((r) => r.id === student.id);
    if (alreadySelected) return false;
    if (groupFilter) {
      const group = recipientGroups.find(
        (g) => String(g.id) === String(groupFilter)
      );
      const memberIds = group?.members_details?.map((m) => m.id) || [];
      return memberIds.includes(student.id);
    }
    return true;
  });

  return (
    <div className={styles.recipientModal}>
      <div className={styles.modalContent}>
        <div className={styles.modalHeader}>
          <h2>Advanced Recipient Management</h2>
          <p className={styles.subtitle}>
            Managing: <strong>{magazine.title}</strong>
          </p>
          <button className={styles.closeButton} onClick={onClose}>
            <FaTimes />
          </button>
        </div>

        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${
              activeTab === "available" ? styles.active : ""
            }`}
            onClick={() => setActiveTab("available")}
          >
            <FaUsers /> Available Students ({filteredAvailableStudents.length})
          </button>
          <button
            className={`${styles.tab} ${
              activeTab === "selected" ? styles.active : ""
            }`}
            onClick={() => setActiveTab("selected")}
          >
            <FaUserPlus /> Selected ({selectedRecipients.length})
          </button>
          <button
            className={`${styles.tab} ${
              activeTab === "groups" ? styles.active : ""
            }`}
            onClick={() => setActiveTab("groups")}
          >
            <FaFolder /> Recipient Groups ({recipientGroups.length})
          </button>
        </div>

        <div className={styles.modalBody}>
          {/* Available Students Tab */}
          {activeTab === "available" && (
            <div className={styles.tabContent}>
              <div className={styles.filterSection}>
                <div className={styles.searchBox}>
                  <FaSearch />
                  <input
                    type="text"
                    placeholder="Search by name, email, or username..."
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                  />
                </div>

                <div className={styles.filterRow}>
                  <select
                    value={filters.courseId}
                    onChange={(e) =>
                      setFilters({ ...filters, courseId: e.target.value })
                    }
                    className={styles.filterSelect}
                  >
                    <option value="">All Courses</option>
                    {courses.map((course) => (
                      <option key={course.id} value={course.id}>
                        {course.title}
                      </option>
                    ))}
                  </select>

                  <select
                    value={groupFilter}
                    onChange={(e) => setGroupFilter(e.target.value)}
                    className={styles.filterSelect}
                  >
                    <option value="">All Groups</option>
                    {recipientGroups.map((group) => (
                      <option key={group.id} value={group.id}>
                        {group.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {loading ? (
                <div className={styles.loadingMessage}>Loading students...</div>
              ) : filteredAvailableStudents.length === 0 ? (
                <div className={styles.emptyMessage}>
                  No students match your search criteria
                </div>
              ) : (
                <>
                  <div className={styles.bulkActions}>
                    <button
                      className={styles.bulkButton}
                      onClick={handleAddAll}
                    >
                      <FaPlus /> Add All ({filteredAvailableStudents.length})
                    </button>
                  </div>

                  <div className={styles.studentsList}>
                    {filteredAvailableStudents.map((student) => {
                      const status = student.guide_status || "none";
                      const statusLabel =
                        status.charAt(0).toUpperCase() + status.slice(1);
                      return (
                        <div key={student.id} className={styles.studentCard}>
                          <div className={styles.studentInfo}>
                            <strong>
                              {student.display_name || student.username}
                            </strong>
                            <span className={styles.studentEmail}>
                              {student.email}
                            </span>
                            <div className={styles.studentMeta}>
                              {student.email_enabled ? (
                                <span className={styles.emailBadge}>
                                  ✓ Email Enabled
                                </span>
                              ) : (
                                <span className={styles.emailBadgeDis}>
                                  ✗ Email Disabled
                                </span>
                              )}
                              <span
                                className={`${styles.statusBadge} ${
                                  styles[status] || ""
                                }`}
                              >
                                {statusLabel}
                              </span>
                            </div>
                          </div>
                          <button
                            className={styles.addButton}
                            onClick={() => handleAddRecipient(student)}
                          >
                            <FaPlus /> Add
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Selected Recipients Tab */}
          {activeTab === "selected" && (
            <div className={styles.tabContent}>
              <div className={styles.bulkActions}>
                <button
                  className={styles.bulkButton}
                  onClick={handleRemoveAll}
                  disabled={selectedRecipients.length === 0}
                >
                  <FaTimes /> Clear All
                </button>
                <span className={styles.recipientCount}>
                  Total: {selectedRecipients.length} recipients
                </span>
              </div>

              {selectedRecipients.length === 0 ? (
                <div className={styles.emptyMessage}>
                  No recipients selected. Use the Available Students tab to add
                  students.
                </div>
              ) : (
                <div className={styles.studentsList}>
                  {selectedRecipients.map((student) => {
                    const status = student.guide_status || "none";
                    const statusLabel =
                      status.charAt(0).toUpperCase() + status.slice(1);
                    return (
                      <div key={student.id} className={styles.studentCard}>
                        <div className={styles.studentInfo}>
                          <strong>
                            {student.display_name || student.username}
                          </strong>
                          <span className={styles.studentEmail}>
                            {student.email}
                          </span>
                          <div className={styles.studentMeta}>
                            {student.email_enabled ? (
                              <span className={styles.emailBadge}>
                                ✓ Email Enabled
                              </span>
                            ) : (
                              <span className={styles.emailBadgeDis}>
                                ✗ Email Disabled
                              </span>
                            )}
                            {status !== "none" && (
                              <span
                                className={`${styles.statusBadge} ${
                                  styles[status] || ""
                                }`}
                              >
                                {statusLabel}
                              </span>
                            )}
                          </div>
                        </div>
                        <button
                          className={styles.removeButton}
                          onClick={() => handleRemoveRecipient(student.id)}
                        >
                          <FaTimes /> Remove
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Recipient Groups Tab */}
          {activeTab === "groups" && (
            <div className={styles.tabContent}>
              {!showNewGroupForm ? (
                <button
                  className={styles.newGroupButton}
                  onClick={() => setShowNewGroupForm(true)}
                >
                  <FaPlus /> Create New Group
                </button>
              ) : (
                <div className={styles.newGroupForm}>
                  <h3>Create New Recipient Group</h3>
                  <input
                    type="text"
                    placeholder="Group name (e.g., 'Premium Students')"
                    value={newGroup.name}
                    onChange={(e) =>
                      setNewGroup({ ...newGroup, name: e.target.value })
                    }
                    className={styles.formInput}
                  />
                  <textarea
                    placeholder="Description (optional)"
                    value={newGroup.description}
                    onChange={(e) =>
                      setNewGroup({ ...newGroup, description: e.target.value })
                    }
                    className={styles.formTextarea}
                  />

                  <div className={styles.checkboxGroup}>
                    <label>
                      <input
                        type="checkbox"
                        checked={newGroup.isDynamic}
                        onChange={(e) =>
                          setNewGroup({
                            ...newGroup,
                            isDynamic: e.target.checked,
                          })
                        }
                      />
                      Make this a dynamic group (auto-include course attendees)
                    </label>
                  </div>

                  {newGroup.isDynamic && (
                    <select
                      value={newGroup.linkedCourse}
                      onChange={(e) =>
                        setNewGroup({
                          ...newGroup,
                          linkedCourse: e.target.value,
                        })
                      }
                      className={styles.filterSelect}
                    >
                      <option value="">
                        Select a course to auto-include attendees
                      </option>
                      {courses.map((course) => (
                        <option key={course.id} value={course.id}>
                          {course.title}
                        </option>
                      ))}
                    </select>
                  )}

                  <div className={styles.formActions}>
                    <button
                      className={styles.primaryButton}
                      onClick={handleSaveNewGroup}
                    >
                      <FaSave /> Save Group
                    </button>
                    <button
                      className={styles.secondaryButton}
                      onClick={() => setShowNewGroupForm(false)}
                    >
                      Cancel
                    </button>
                  </div>

                  {!newGroup.isDynamic && (
                    <div className={styles.groupMemberPicker}>
                      <h4>Select members for this group</h4>
                      <div className={styles.studentsList}>
                        {availableStudents.length === 0 ? (
                          <div className={styles.emptyMessage}>
                            No students available to add.
                          </div>
                        ) : (
                          availableStudents.map((student) => (
                            <label
                              key={student.id}
                              className={styles.studentCard}
                            >
                              <input
                                type="checkbox"
                                checked={newGroupMembers.includes(student.id)}
                                onChange={(e) => {
                                  const checked = e.target.checked;
                                  setNewGroupMembers((prev) =>
                                    checked
                                      ? [...prev, student.id]
                                      : prev.filter((id) => id !== student.id)
                                  );
                                }}
                              />
                              <div className={styles.studentInfo}>
                                <strong>
                                  {student.display_name || student.username}
                                </strong>
                                <span className={styles.studentEmail}>
                                  {student.email}
                                </span>
                              </div>
                            </label>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className={styles.groupsList}>
                {recipientGroups.length === 0 ? (
                  <div className={styles.emptyMessage}>
                    No recipient groups yet. Create one to save and reuse
                    recipient lists.
                  </div>
                ) : (
                  recipientGroups.map((group) => (
                    <div key={group.id} className={styles.groupCard}>
                      <div className={styles.groupInfo}>
                        <strong>{group.name}</strong>
                        {group.description && (
                          <p className={styles.groupDescription}>
                            {group.description}
                          </p>
                        )}
                        <div className={styles.groupMeta}>
                          <span className={styles.memberCount}>
                            {group.members_count || 0} members
                          </span>
                          {group.is_dynamic && (
                            <span className={styles.dynamicBadge}>Dynamic</span>
                          )}
                        </div>
                        {group.members_details &&
                          group.members_details.length > 0 && (
                            <div className={styles.memberList}>
                              {group.members_details.map((member) => (
                                <span
                                  key={member.id}
                                  className={styles.memberPill}
                                >
                                  {member.display_name || member.username}
                                </span>
                              ))}
                            </div>
                          )}
                      </div>
                      <div className={styles.groupActions}>
                        {!group.is_dynamic && (
                          <div className={styles.inlineAdd}>
                            <select
                              value={groupMemberSelect[group.id] || ""}
                              onChange={(e) =>
                                setGroupMemberSelect((prev) => ({
                                  ...prev,
                                  [group.id]: e.target.value,
                                }))
                              }
                              className={styles.filterSelect}
                            >
                              <option value="">Add student...</option>
                              {availableStudents.map((student) => (
                                <option key={student.id} value={student.id}>
                                  {student.display_name || student.username}
                                </option>
                              ))}
                            </select>
                            <button
                              className={styles.applyButton}
                              onClick={() => handleAddMemberToGroup(group.id)}
                              disabled={!groupMemberSelect[group.id]}
                            >
                              Add
                            </button>
                            <button
                              className={styles.bulkButton}
                              onClick={() =>
                                handleAddSelectedRecipientsToGroup(group.id)
                              }
                              disabled={selectedRecipients.length === 0}
                            >
                              Add selected recipients
                            </button>
                          </div>
                        )}
                        <button
                          className={styles.applyButton}
                          onClick={() => handleApplyGroup(group)}
                        >
                          Apply
                        </button>
                        <button
                          className={styles.deleteButton}
                          onClick={() => handleDeleteGroup(group.id)}
                        >
                          <FaTrash />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        <div className={styles.modalFooter}>
          <button className={styles.cancelButton} onClick={onClose}>
            Cancel
          </button>
          <button className={styles.saveButton} onClick={handleSaveRecipients}>
            <FaSave /> Save Recipients & Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default RecipientManagementModal;
