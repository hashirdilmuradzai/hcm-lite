/**
 * HCM Lite — Announcements Module
 * Admin can create and delete company-wide announcements
 * Employees and Admin can view announcements on their dashboards
 */

const AnnouncementManager = (() => {
  function renderAnnouncementsList(containerId, isAdmin = false) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const announcements = Storage.getAnnouncements();

    if (announcements.length === 0) {
      container.innerHTML = `
        <div class="empty-state" style="padding: var(--space-6) var(--space-4);">
          <div class="empty-state-icon" style="width: 44px; height: 44px;">
            ${UI.ICONS.fileText}
          </div>
          <div class="empty-state-title" style="font-size: var(--font-size-sm);">No announcements yet</div>
          <div class="empty-state-description" style="font-size: var(--font-size-xs);">
            ${isAdmin ? 'Keep your team updated by publishing company notices and news.' : 'Important company notices and updates will appear here.'}
          </div>
        </div>
      `;
      return;
    }

    container.innerHTML = announcements.map(item => `
      <div class="card" style="margin-bottom: var(--space-3); border-left: 3px solid ${item.priority === 'high' ? 'var(--color-error)' : 'var(--color-primary-accent)'};">
        <div class="card-body" style="padding: var(--space-4);">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <strong style="font-size: var(--font-size-sm); color: var(--color-text-main);">${UI.escapeHTML(item.title)}</strong>
              ${item.priority === 'high' ? `<span class="badge badge-error">Urgent</span>` : ''}
            </div>
            ${isAdmin ? `
              <button class="btn-icon-subtle delete-announcement-btn" data-id="${item.id}" title="Delete announcement" style="padding: 2px;">
                ${UI.ICONS.x}
              </button>
            ` : ''}
          </div>
          <p style="font-size: var(--font-size-xs); color: var(--color-text-secondary); line-height: 1.5; margin-bottom: 8px;">
            ${UI.escapeHTML(item.content)}
          </p>
          <div style="display: flex; align-items: center; justify-content: space-between; font-size: 0.7rem; color: var(--color-text-muted);">
            <span>Posted by ${UI.escapeHTML(item.authorName)}</span>
            <span>${item.date}</span>
          </div>
        </div>
      </div>
    `).join('');

    if (isAdmin) {
      container.querySelectorAll('.delete-announcement-btn').forEach(btn => {
        btn.onclick = () => {
          const id = btn.getAttribute('data-id');
          UI.showConfirmModal({
            title: 'Delete Announcement',
            message: 'Are you sure you want to remove this announcement?',
            confirmText: 'Delete',
            isDestructive: true,
            onConfirm: () => {
              Storage.deleteAnnouncement(id);
              renderAnnouncementsList(containerId, true);
              UI.showToast('Announcement deleted.', 'info');
            }
          });
        };
      });
    }
  }

  function showCreateAnnouncementModal(onCreated = () => {}) {
    let modal = document.getElementById('create-announcement-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'create-announcement-modal';
      modal.className = 'modal-backdrop';
      modal.innerHTML = `
        <div class="modal-dialog">
          <div class="modal-header">
            <h3 class="modal-title">Publish Announcement</h3>
            <button class="modal-close" id="close-ann-modal">${UI.ICONS.x}</button>
          </div>
          <form id="create-ann-form">
            <div class="modal-body">
              <div class="form-group">
                <label class="form-label">Title <span class="required">*</span></label>
                <input type="text" id="ann-title" class="form-input" required placeholder="e.g. Annual Company Gala 2026">
              </div>
              <div class="form-group">
                <label class="form-label">Priority</label>
                <select id="ann-priority" class="form-select">
                  <option value="normal">Normal</option>
                  <option value="high">High Priority / Urgent</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Content / Message <span class="required">*</span></label>
                <textarea id="ann-content" class="form-textarea" rows="4" required placeholder="Write your announcement details here..."></textarea>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-outline" id="cancel-ann-btn">Cancel</button>
              <button type="submit" class="btn btn-primary">Publish Announcement</button>
            </div>
          </form>
        </div>
      `;
      document.body.appendChild(modal);
    }

    const closeBtn = modal.querySelector('#close-ann-modal');
    const cancelBtn = modal.querySelector('#cancel-ann-btn');
    const form = modal.querySelector('#create-ann-form');

    const closeModal = () => { modal.classList.remove('active'); form.reset(); };
    closeBtn.onclick = closeModal;
    cancelBtn.onclick = closeModal;

    form.onsubmit = (e) => {
      e.preventDefault();
      const session = Storage.getSession();
      const title = document.getElementById('ann-title').value.trim();
      const priority = document.getElementById('ann-priority').value;
      const content = document.getElementById('ann-content').value.trim();

      Storage.saveAnnouncement({
        title,
        priority,
        content,
        authorName: session ? session.name : 'Management'
      });

      Storage.logActivity('New Announcement', `Published announcement: "${title}"`, 'admin');
      UI.showToast('Announcement published successfully!', 'success');
      closeModal();
      onCreated();
    };

    modal.classList.add('active');
  }

  return {
    renderAnnouncementsList,
    showCreateAnnouncementModal
  };
})();
