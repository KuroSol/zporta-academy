import React, { useState, useEffect, useRef } from 'react';
import { 
  FaPlus, FaEdit, FaTrash, FaCopy, FaSave, FaTimes, FaCheck, 
  FaFileAlt, FaEnvelope, FaGraduationCap, FaTrophy, FaMagic 
} from 'react-icons/fa';
import apiClient from '@/api';
import MailMagazineEditor from '../Editor/MailMagazineEditor';
import styles from '@/styles/TemplateManager.module.css';

const TEMPLATE_TYPES = [
  { 
    value: 'thank_attend', 
    label: 'Thank You for Attending',
    icon: FaCheck,
    description: 'Sent when someone attends your guide page',
    defaultSubject: 'Thank you for attending!',
    defaultBody: `<h2>Thank You for Attending!</h2>
<p>Hello {{student_name}},</p>
<p>I really appreciate you taking the time to attend my guide page. Your interest and engagement means a lot!</p>
<p>If you have any questions or would like to learn more, feel free to reach out anytime.</p>
<p>Looking forward to connecting with you again soon!</p>
<p>Best regards,<br/>{{teacher_name}}</p>`
  },
  { 
    value: 'thank_purchase', 
    label: 'Thank You for Purchase',
    icon: FaTrophy,
    description: 'Sent when someone purchases your product',
    defaultSubject: 'Thank you for your purchase!',
    defaultBody: `<h2>Thank You for Your Purchase!</h2>
<p>Hello {{student_name}},</p>
<p>Thank you for purchasing <strong>{{product_name}}</strong>! I'm excited to have you on board.</p>
<p>You now have access to all the course materials. Here's what you can do next:</p>
<ul>
  <li>Start with the first lesson</li>
  <li>Check out the course resources</li>
  <li>Join our community discussions</li>
</ul>
<p>If you have any questions, don't hesitate to reach out!</p>
<p>Best regards,<br/>{{teacher_name}}</p>`
  },
  { 
    value: 'welcome_enroll', 
    label: 'Welcome to Course',
    icon: FaGraduationCap,
    description: 'Sent when someone enrolls in your course',
    defaultSubject: 'Welcome to {{course_name}}!',
    defaultBody: `<h2>Welcome to {{course_name}}!</h2>
<p>Hello {{student_name}},</p>
<p>I'm thrilled to welcome you to <strong>{{course_name}}</strong>! You've taken an important step in your learning journey.</p>
<p><strong>What's Next?</strong></p>
<ol>
  <li>Explore the course curriculum</li>
  <li>Start with the introductory lessons</li>
  <li>Connect with fellow students</li>
  <li>Set your learning goals</li>
</ol>
<p>I'm here to support you every step of the way. Let's make this an amazing learning experience!</p>
<p>To your success,<br/>{{teacher_name}}</p>`
  },
  { 
    value: 'completion', 
    label: 'Course Completion',
    icon: FaTrophy,
    description: 'Sent when someone completes your course',
    defaultSubject: 'Congratulations on completing {{course_name}}!',
    defaultBody: `<h2>🎉 Congratulations on Your Achievement!</h2>
<p>Hello {{student_name}},</p>
<p>I'm incredibly proud to inform you that you've successfully completed <strong>{{course_name}}</strong>!</p>
<p>Your dedication and hard work have paid off. This is a significant milestone in your learning journey.</p>
<p><strong>What's Next?</strong></p>
<ul>
  <li>Download your certificate of completion</li>
  <li>Share your achievement with your network</li>
  <li>Check out our advanced courses</li>
  <li>Leave a review to help other learners</li>
</ul>
<p>Keep up the excellent work, and I hope to see you in future courses!</p>
<p>Congratulations again,<br/>{{teacher_name}}</p>`
  },
  { 
    value: 'custom', 
    label: 'Custom Template',
    icon: FaMagic,
    description: 'Create your own custom template',
    defaultSubject: 'Your custom message',
    defaultBody: `<h2>Your Custom Message</h2>
<p>Hello {{student_name}},</p>
<p>Create your personalized message here...</p>
<p>Best regards,<br/>{{teacher_name}}</p>`
  },
];

const TemplateManager = () => {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [feedback, setFeedback] = useState({ type: '', message: '' });
  const editorRef = useRef(null);

  const [formData, setFormData] = useState({
    name: '',
    template_type: 'custom',
    subject: '',
    body: '',
    is_active: true,
  });

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const { data } = await apiClient.get('/templates/');
      setTemplates(data || []);
    } catch (error) {
      console.error('Failed to load templates:', error);
      setFeedback({ type: 'error', message: 'Failed to load templates' });
    } finally {
      setLoading(false);
    }
  };

  const handleTemplateTypeChange = (templateType) => {
    const templateConfig = TEMPLATE_TYPES.find(t => t.value === templateType);
    if (templateConfig) {
      setFormData(prev => ({
        ...prev,
        template_type: templateType,
        subject: templateConfig.defaultSubject,
        body: templateConfig.defaultBody,
      }));
      
      // Update editor content
      setTimeout(() => {
        editorRef.current?.setContent(templateConfig.defaultBody);
      }, 100);
    }
  };

  const handleCreateNew = () => {
    setEditingTemplate(null);
    setFormData({
      name: '',
      template_type: 'custom',
      subject: '',
      body: '',
      is_active: true,
    });
    editorRef.current?.clear();
    setShowCreateModal(true);
  };

  const handleEdit = (template) => {
    setEditingTemplate(template);
    setFormData({
      name: template.name,
      template_type: template.template_type,
      subject: template.subject,
      body: template.body,
      is_active: template.is_active,
    });
    setTimeout(() => {
      editorRef.current?.setContent(template.body || '');
    }, 100);
    setShowCreateModal(true);
  };

  const handleDelete = async (templateId) => {
    if (!confirm('Are you sure you want to delete this template?')) return;
    
    try {
      await apiClient.delete(`/templates/${templateId}/`);
      setFeedback({ type: 'success', message: 'Template deleted successfully' });
      await loadTemplates();
    } catch (error) {
      setFeedback({ type: 'error', message: 'Failed to delete template' });
    }
  };

  const handleDuplicate = async (template) => {
    try {
      const duplicateData = {
        name: `${template.name} (Copy)`,
        template_type: template.template_type,
        subject: template.subject,
        body: template.body,
        is_active: true,
      };
      await apiClient.post('/templates/', duplicateData);
      setFeedback({ type: 'success', message: 'Template duplicated successfully' });
      await loadTemplates();
    } catch (error) {
      setFeedback({ type: 'error', message: 'Failed to duplicate template' });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const editorContent = editorRef.current?.getContent() || '';
    if (!formData.name.trim() || !formData.subject.trim() || !editorContent.trim()) {
      setFeedback({ type: 'error', message: 'Please fill in all required fields' });
      return;
    }

    try {
      const payload = {
        ...formData,
        body: editorContent,
      };

      if (editingTemplate) {
        await apiClient.put(`/templates/${editingTemplate.id}/`, payload);
        setFeedback({ type: 'success', message: 'Template updated successfully' });
      } else {
        await apiClient.post('/templates/', payload);
        setFeedback({ type: 'success', message: 'Template created successfully' });
      }

      setShowCreateModal(false);
      await loadTemplates();
    } catch (error) {
      const message = error.response?.data?.detail || 'Failed to save template';
      setFeedback({ type: 'error', message });
    }
  };

  const getTemplateIcon = (templateType) => {
    const config = TEMPLATE_TYPES.find(t => t.value === templateType);
    const IconComponent = config?.icon || FaFileAlt;
    return <IconComponent />;
  };

  const getTemplateLabel = (templateType) => {
    return TEMPLATE_TYPES.find(t => t.value === templateType)?.label || templateType;
  };

  return (
    <div className={styles.templateManager}>
      <div className={styles.header}>
        <div>
          <h2>Email Templates</h2>
          <p className={styles.subtitle}>
            Create reusable email templates for automated messages and quick sending
          </p>
        </div>
        <button className={styles.createButton} onClick={handleCreateNew}>
          <FaPlus /> Create Template
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
        <div className={styles.loading}>Loading templates...</div>
      ) : templates.length === 0 ? (
        <div className={styles.emptyState}>
          <FaEnvelope size={64} />
          <h3>No Templates Yet</h3>
          <p>Create your first email template to get started with automated messaging</p>
          <button className={styles.createButton} onClick={handleCreateNew}>
            <FaPlus /> Create Your First Template
          </button>
        </div>
      ) : (
        <div className={styles.templateGrid}>
          {templates.map((template) => (
            <div key={template.id} className={styles.templateCard}>
              <div className={styles.cardHeader}>
                <div className={styles.iconWrapper}>
                  {getTemplateIcon(template.template_type)}
                </div>
                <div className={styles.cardTitle}>
                  <h3>{template.name}</h3>
                  <span className={styles.templateType}>
                    {getTemplateLabel(template.template_type)}
                  </span>
                </div>
                <span className={`${styles.statusBadge} ${template.is_active ? styles.active : styles.inactive}`}>
                  {template.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>

              <div className={styles.cardContent}>
                <div className={styles.subjectLine}>
                  <strong>Subject:</strong> {template.subject}
                </div>
                <div className={styles.bodyPreview}>
                  {template.body?.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120)}...
                </div>
              </div>

              <div className={styles.cardActions}>
                <button 
                  className={styles.actionBtn} 
                  onClick={() => handleEdit(template)}
                  title="Edit"
                >
                  <FaEdit /> Edit
                </button>
                <button 
                  className={styles.actionBtn} 
                  onClick={() => handleDuplicate(template)}
                  title="Duplicate"
                >
                  <FaCopy /> Duplicate
                </button>
                <button 
                  className={`${styles.actionBtn} ${styles.deleteBtn}`}
                  onClick={() => handleDelete(template.id)}
                  title="Delete"
                >
                  <FaTrash /> Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreateModal && (
        <div className={styles.modal} onClick={() => setShowCreateModal(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>{editingTemplate ? 'Edit Template' : 'Create New Template'}</h2>
              <button className={styles.closeButton} onClick={() => setShowCreateModal(false)}>
                <FaTimes />
              </button>
            </div>

            <form onSubmit={handleSubmit} className={styles.form}>
              <div className={styles.formGroup}>
                <label>Template Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Welcome Email for New Students"
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label>Template Type *</label>
                <select
                  value={formData.template_type}
                  onChange={(e) => handleTemplateTypeChange(e.target.value)}
                  required
                >
                  {TEMPLATE_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
                <small className={styles.helpText}>
                  {TEMPLATE_TYPES.find(t => t.value === formData.template_type)?.description}
                </small>
              </div>

              <div className={styles.formGroup}>
                <label>Email Subject *</label>
                <input
                  type="text"
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  placeholder="Your email subject line"
                  required
                />
                <small className={styles.helpText}>
                  Use variables: {'{'}{'{'} student_name {'}'}{'}'},  {'{'}{'{'} teacher_name {'}'}{'}'},  {'{'}{'{'} course_name {'}'}{'}'} 
                </small>
              </div>

              <div className={styles.formGroup}>
                <label>Email Body *</label>
                <MailMagazineEditor ref={editorRef} />
                <small className={styles.helpText}>
                  Available variables: {'{'}{'{'} student_name {'}'}{'}'},  {'{'}{'{'} teacher_name {'}'}{'}'},  {'{'}{'{'} course_name {'}'}{'}'},  {'{'}{'{'} product_name {'}'}{'}'} 
                </small>
              </div>

              <div className={styles.checkboxGroup}>
                <label>
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  />
                  <span>Active (available for use in automations)</span>
                </label>
              </div>

              <div className={styles.formActions}>
                <button type="submit" className={styles.submitBtn}>
                  <FaSave /> {editingTemplate ? 'Update Template' : 'Create Template'}
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

export default TemplateManager;
