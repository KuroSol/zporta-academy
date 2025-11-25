import React, { useState, useEffect, useRef } from 'react';
import { 
  FaPlus, FaEdit, FaTrash, FaSave, FaTimes, FaBolt, FaToggleOn, FaToggleOff,
  FaGraduationCap, FaShoppingCart, FaEye, FaTrophy, FaRobot
} from 'react-icons/fa';
import apiClient from '@/api';
import MailMagazineEditor from '../Editor/MailMagazineEditor';
import styles from '@/styles/AutomationManager.module.css';

const TRIGGER_TYPES = [
  {
    value: 'enrollment',
    label: 'Course Enrollment',
    icon: FaGraduationCap,
    description: 'Triggered when a student enrolls in your course',
    color: '#10b981'
  },
  {
    value: 'purchase',
    label: 'Product Purchase',
    icon: FaShoppingCart,
    description: 'Triggered when someone purchases your product (coming soon)',
    color: '#f59e0b',
    disabled: true
  },
  {
    value: 'guide_attend',
    label: 'Guide Page Visit',
    icon: FaEye,
    description: 'Triggered when someone visits your guide page',
    color: '#3b82f6'
  },
  {
    value: 'course_complete',
    label: 'Course Completion',
    icon: FaTrophy,
    description: 'Triggered when a student completes your course (coming soon)',
    color: '#8b5cf6',
    disabled: true
  },
];

const AutomationManager = () => {
  const [automations, setAutomations] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingAutomation, setEditingAutomation] = useState(null);
  const [feedback, setFeedback] = useState({ type: '', message: '' });
  const [useTemplate, setUseTemplate] = useState(true);
  const editorRef = useRef(null);

  const [formData, setFormData] = useState({
    trigger_type: 'enrollment',
    template: '',
    subject: '',
    body: '',
    specific_course: '',
    is_active: true,
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [automationsRes, templatesRes, coursesRes] = await Promise.all([
        apiClient.get('/automations/'),
        apiClient.get('/templates/'),
        apiClient.get('/courses/my/')
      ]);
      
      setAutomations(automationsRes.data || []);
      setTemplates(templatesRes.data?.filter(t => t.is_active) || []);
      setCourses(coursesRes.data || []);
    } catch (error) {
      console.error('Failed to load data:', error);
      setFeedback({ type: 'error', message: 'Failed to load automation data' });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNew = () => {
    setEditingAutomation(null);
    setFormData({
      trigger_type: 'enrollment',
      template: '',
      subject: '',
      body: '',
      specific_course: '',
      is_active: true,
    });
    setUseTemplate(true);
    editorRef.current?.clear();
    setShowCreateModal(true);
  };

  const handleEdit = (automation) => {
    setEditingAutomation(automation);
    setFormData({
      trigger_type: automation.trigger_type,
      template: automation.template || '',
      subject: automation.subject || '',
      body: automation.body || '',
      specific_course: automation.specific_course || '',
      is_active: automation.is_active,
    });
    setUseTemplate(!!automation.template);
    
    if (!automation.template && automation.body) {
      setTimeout(() => {
        editorRef.current?.setContent(automation.body);
      }, 100);
    }
    
    setShowCreateModal(true);
  };

  const handleDelete = async (automationId) => {
    if (!confirm('Are you sure you want to delete this automation rule?')) return;
    
    try {
      await apiClient.delete(`/automations/${automationId}/`);
      setFeedback({ type: 'success', message: 'Automation deleted successfully' });
      await loadData();
    } catch (error) {
      setFeedback({ type: 'error', message: 'Failed to delete automation' });
    }
  };

  const handleToggleActive = async (automation) => {
    try {
      await apiClient.patch(`/automations/${automation.id}/`, {
        is_active: !automation.is_active
      });
      setFeedback({ 
        type: 'success', 
        message: `Automation ${!automation.is_active ? 'activated' : 'deactivated'} successfully` 
      });
      await loadData();
    } catch (error) {
      setFeedback({ type: 'error', message: 'Failed to update automation status' });
    }
  };

  const handleTemplateChange = (templateId) => {
    if (!templateId) {
      setFormData(prev => ({ ...prev, template: '', subject: '', body: '' }));
      editorRef.current?.clear();
      return;
    }

    const template = templates.find(t => t.id === parseInt(templateId));
    if (template) {
      setFormData(prev => ({
        ...prev,
        template: templateId,
        subject: template.subject,
        body: template.body,
      }));
      
      setTimeout(() => {
        editorRef.current?.setContent(template.body);
      }, 100);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validate based on whether using template or custom content
    if (useTemplate) {
      if (!formData.template) {
        setFeedback({ type: 'error', message: 'Please select a template' });
        return;
      }
    } else {
      const editorContent = editorRef.current?.getContent() || '';
      if (!formData.subject.trim() || !editorContent.trim()) {
        setFeedback({ type: 'error', message: 'Please fill in subject and body' });
        return;
      }
    }

    try {
      const payload = {
        trigger_type: formData.trigger_type,
        is_active: formData.is_active,
        specific_course: formData.specific_course || null,
      };

      if (useTemplate) {
        payload.template = formData.template;
        payload.subject = null;
        payload.body = null;
      } else {
        payload.template = null;
        payload.subject = formData.subject;
        payload.body = editorRef.current?.getContent() || '';
      }

      if (editingAutomation) {
        await apiClient.put(`/automations/${editingAutomation.id}/`, payload);
        setFeedback({ type: 'success', message: 'Automation updated successfully' });
      } else {
        await apiClient.post('/automations/', payload);
        setFeedback({ type: 'success', message: 'Automation created successfully' });
      }

      setShowCreateModal(false);
      await loadData();
    } catch (error) {
      const message = error.response?.data?.detail || 'Failed to save automation';
      setFeedback({ type: 'error', message });
    }
  };

  const getTriggerConfig = (triggerType) => {
    return TRIGGER_TYPES.find(t => t.value === triggerType) || TRIGGER_TYPES[0];
  };

  const getTriggerIcon = (triggerType) => {
    const config = getTriggerConfig(triggerType);
    const IconComponent = config.icon;
    return <IconComponent />;
  };

  return (
    <div className={styles.automationManager}>
      <div className={styles.header}>
        <div>
          <h2>Email Automation Rules</h2>
          <p className={styles.subtitle}>
            Set up automated emails triggered by student actions
          </p>
        </div>
        <button className={styles.createButton} onClick={handleCreateNew}>
          <FaPlus /> Create Automation
        </button>
      </div>

      {feedback.message && (
        <div className={`${styles.feedback} ${styles[feedback.type]}`}>
          {feedback.message}
          <button onClick={() => setFeedback({ type: '', message: '' })} className={styles.closeBtn}>
            <FaTimes />
          </button>
        </div>
      )}

      {loading ? (
        <div className={styles.loading}>Loading automations...</div>
      ) : automations.length === 0 ? (
        <div className={styles.emptyState}>
          <FaRobot size={64} />
          <h3>No Automations Yet</h3>
          <p>Create your first automation rule to automatically send emails when students take actions</p>
          <button className={styles.createButton} onClick={handleCreateNew}>
            <FaPlus /> Create Your First Automation
          </button>
        </div>
      ) : (
        <div className={styles.automationGrid}>
          {automations.map((automation) => {
            const triggerConfig = getTriggerConfig(automation.trigger_type);
            return (
              <div key={automation.id} className={styles.automationCard}>
                <div className={styles.cardHeader}>
                  <div 
                    className={styles.iconWrapper}
                    style={{ backgroundColor: `${triggerConfig.color}20`, color: triggerConfig.color }}
                  >
                    {getTriggerIcon(automation.trigger_type)}
                  </div>
                  <div className={styles.cardTitle}>
                    <h3>{triggerConfig.label}</h3>
                    <span className={styles.triggerDescription}>
                      {automation.specific_course 
                        ? `For: ${automation.course_title || 'Specific Course'}`
                        : 'For: All Courses'}
                    </span>
                  </div>
                  <button
                    className={`${styles.toggleButton} ${automation.is_active ? styles.active : ''}`}
                    onClick={() => handleToggleActive(automation)}
                    title={automation.is_active ? 'Deactivate' : 'Activate'}
                  >
                    {automation.is_active ? <FaToggleOn size={24} /> : <FaToggleOff size={24} />}
                  </button>
                </div>

                <div className={styles.cardContent}>
                  {automation.template ? (
                    <div className={styles.templateInfo}>
                      <FaBolt className={styles.templateIcon} />
                      <div>
                        <strong>Using Template:</strong>
                        <span>{automation.template_name || 'Unknown Template'}</span>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className={styles.subjectLine}>
                        <strong>Subject:</strong> {automation.subject}
                      </div>
                      <div className={styles.bodyPreview}>
                        {automation.body?.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 100)}...
                      </div>
                    </>
                  )}
                </div>

                <div className={styles.cardFooter}>
                  <span className={`${styles.statusBadge} ${automation.is_active ? styles.active : styles.inactive}`}>
                    {automation.is_active ? 'Active' : 'Inactive'}
                  </span>
                  <div className={styles.cardActions}>
                    <button 
                      className={styles.actionBtn} 
                      onClick={() => handleEdit(automation)}
                      title="Edit"
                    >
                      <FaEdit /> Edit
                    </button>
                    <button 
                      className={`${styles.actionBtn} ${styles.deleteBtn}`}
                      onClick={() => handleDelete(automation.id)}
                      title="Delete"
                    >
                      <FaTrash /> Delete
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showCreateModal && (
        <div className={styles.modal} onClick={() => setShowCreateModal(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>{editingAutomation ? 'Edit Automation' : 'Create New Automation'}</h2>
              <button className={styles.closeButton} onClick={() => setShowCreateModal(false)}>
                <FaTimes />
              </button>
            </div>

            <form onSubmit={handleSubmit} className={styles.form}>
              <div className={styles.formGroup}>
                <label>Trigger Event *</label>
                <select
                  value={formData.trigger_type}
                  onChange={(e) => setFormData({ ...formData, trigger_type: e.target.value })}
                  required
                >
                  {TRIGGER_TYPES.map((trigger) => (
                    <option key={trigger.value} value={trigger.value} disabled={trigger.disabled}>
                      {trigger.label} {trigger.disabled ? '(Coming Soon)' : ''}
                    </option>
                  ))}
                </select>
                <small className={styles.helpText}>
                  {getTriggerConfig(formData.trigger_type).description}
                </small>
              </div>

              <div className={styles.formGroup}>
                <label>Target Course (Optional)</label>
                <select
                  value={formData.specific_course}
                  onChange={(e) => setFormData({ ...formData, specific_course: e.target.value })}
                >
                  <option value="">All Courses</option>
                  {courses.map((course) => (
                    <option key={course.id} value={course.id}>
                      {course.title}
                    </option>
                  ))}
                </select>
                <small className={styles.helpText}>
                  Leave empty to apply to all courses, or select a specific course
                </small>
              </div>

              <div className={styles.contentTypeToggle}>
                <button
                  type="button"
                  className={`${styles.toggleOption} ${useTemplate ? styles.active : ''}`}
                  onClick={() => setUseTemplate(true)}
                >
                  <FaBolt /> Use Template
                </button>
                <button
                  type="button"
                  className={`${styles.toggleOption} ${!useTemplate ? styles.active : ''}`}
                  onClick={() => setUseTemplate(false)}
                >
                  <FaEdit /> Custom Content
                </button>
              </div>

              {useTemplate ? (
                <div className={styles.formGroup}>
                  <label>Select Template *</label>
                  <select
                    value={formData.template}
                    onChange={(e) => handleTemplateChange(e.target.value)}
                    required
                  >
                    <option value="">-- Select a template --</option>
                    {templates.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.name} ({template.template_type_display})
                      </option>
                    ))}
                  </select>
                  {templates.length === 0 && (
                    <small className={styles.warningText}>
                      No templates available. Create a template first in the Templates tab.
                    </small>
                  )}
                  {formData.template && (
                    <div className={styles.templatePreview}>
                      <strong>Preview:</strong>
                      <div className={styles.previewSubject}>
                        Subject: {formData.subject}
                      </div>
                      <div 
                        className={styles.previewBody}
                        dangerouslySetInnerHTML={{ __html: formData.body }}
                      />
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <div className={styles.formGroup}>
                    <label>Email Subject *</label>
                    <input
                      type="text"
                      value={formData.subject}
                      onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                      placeholder="Your email subject line"
                      required={!useTemplate}
                    />
                    <small className={styles.helpText}>
                      Use variables: {'{'}{'{'} student_name {'}'}{'}'},  {'{'}{'{'} teacher_name {'}'}{'}'},  {'{'}{'{'} course_name {'}'}{'}'} 
                    </small>
                  </div>

                  <div className={styles.formGroup}>
                    <label>Email Body *</label>
                    <MailMagazineEditor ref={editorRef} />
                    <small className={styles.helpText}>
                      Available variables: {'{'}{'{'} student_name {'}'}{'}'},  {'{'}{'{'} teacher_name {'}'}{'}'},  {'{'}{'{'} course_name {'}'}{'}'} 
                    </small>
                  </div>
                </>
              )}

              <div className={styles.checkboxGroup}>
                <label>
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  />
                  <span>Active (automation will trigger automatically)</span>
                </label>
              </div>

              <div className={styles.formActions}>
                <button type="submit" className={styles.submitBtn}>
                  <FaSave /> {editingAutomation ? 'Update Automation' : 'Create Automation'}
                </button>
                <button 
                  type="button" 
                  className={styles.cancelBtn}
                  onClick={() => setShowCreateModal(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AutomationManager;
