// ============================================
// BACKUP MANAGEMENT FUNCTIONS
// Add these to admin-app.js
// ============================================

// Open backup modal
function openBackupModal() {
    document.getElementById('backupModal').classList.remove('hidden');
    loadBackupStats();
    loadBackupsList();
}

// Close backup modal
function closeBackupModal() {
    document.getElementById('backupModal').classList.add('hidden');
}

// Load database statistics
async function loadBackupStats() {
    try {
        const response = await fetch('/api/admin/backup/stats', {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        const result = await response.json();
        
        if (result.success) {
            const stats = result.stats;
            document.getElementById('dbPath').textContent = stats.database_path;
            document.getElementById('dbSize').textContent = formatBytes(stats.database_size);
            document.getElementById('dbModified').textContent = new Date(stats.last_modified).toLocaleString();
            document.getElementById('dbRequestCount').textContent = stats.counts.ride_requests;
            document.getElementById('dbUserCount').textContent = stats.counts.admin_users;
            document.getElementById('dbLogCount').textContent = stats.counts.activity_logs;
        }
    } catch (error) {
        console.error('Error loading stats:', error);
        showNotification('Error loading database statistics', 'error');
    }
}

// Load backups list
async function loadBackupsList() {
    try {
        const response = await fetch('/api/admin/backup/list', {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        const result = await response.json();
        
        if (result.success) {
            displayBackups(result.backups);
        }
    } catch (error) {
        console.error('Error loading backups:', error);
        showNotification('Error loading backups list', 'error');
    }
}

// Display backups
function displayBackups(backups) {
    const backupsList = document.getElementById('backupsList');
    
    if (backups.length === 0) {
        backupsList.innerHTML = '<p style="text-align: center; color: #9CA3AF;">No backups found. Create your first backup!</p>';
        return;
    }
    
    backupsList.innerHTML = backups.map(backup => `
        <div class="backup-item" style="background: white; border: 1px solid #E5E7EB; border-radius: 8px; padding: 12px; margin-bottom: 10px;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <div style="flex: 1;">
                    <p style="margin: 0; font-weight: 600; font-size: 14px;">${backup.filename}</p>
                    <p style="margin: 5px 0 0 0; font-size: 12px; color: #6B7280;">
                        ${formatBytes(backup.size)} • 
                        ${new Date(backup.created).toLocaleString()} • 
                        <span style="background: ${backup.type === 'database' ? '#DBEAFE' : '#FEF3C7'}; padding: 2px 6px; border-radius: 3px;">
                            ${backup.type === 'database' ? '💾 Database' : '📄 JSON'}
                        </span>
                    </p>
                </div>
                <div style="display: flex; gap: 8px;">
                    <button onclick="downloadBackup('${backup.filename}')" 
                            style="padding: 6px 12px; background: #10B981; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 13px;">
                        📥 Download
                    </button>
                    ${backup.type === 'database' && currentUser.role === 'super_admin' ? `
                        <button onclick="restoreBackup('${backup.filename}')" 
                                style="padding: 6px 12px; background: #F59E0B; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 13px;">
                            🔄 Restore
                        </button>
                    ` : ''}
                    <button onclick="deleteBackup('${backup.filename}')" 
                            style="padding: 6px 12px; background: #EF4444; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 13px;">
                        🗑️ Delete
                    </button>
                </div>
            </div>
        </div>
    `).join('');
}

// Create backup
async function createBackup() {
    try {
        showNotification('Creating backup...', 'info');
        
        const response = await fetch('/api/admin/backup/create', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        const result = await response.json();
        
        if (result.success) {
            showNotification('Backup created successfully!', 'success');
            loadBackupStats();
            loadBackupsList();
        } else {
            showNotification(result.message || 'Failed to create backup', 'error');
        }
    } catch (error) {
        console.error('Error creating backup:', error);
        showNotification('Error creating backup', 'error');
    }
}

// Export to JSON
async function exportToJSON() {
    try {
        showNotification('Exporting data to JSON...', 'info');
        
        const response = await fetch('/api/admin/backup/export-json', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        const result = await response.json();
        
        if (result.success) {
            showNotification(`JSON export created! ${result.export.counts.ride_requests} ride requests exported.`, 'success');
            loadBackupStats();
            loadBackupsList();
        } else {
            showNotification(result.message || 'Failed to export JSON', 'error');
        }
    } catch (error) {
        console.error('Error exporting JSON:', error);
        showNotification('Error exporting to JSON', 'error');
    }
}

// Download backup
function downloadBackup(filename) {
    const downloadUrl = `/api/admin/backup/download/${filename}?token=${authToken}`;
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showNotification(`Downloading ${filename}...`, 'success');
}

// Delete backup
async function deleteBackup(filename) {
    if (!confirm(`Are you sure you want to delete this backup?\n\n${filename}`)) {
        return;
    }
    
    try {
        const response = await fetch(`/api/admin/backup/${filename}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        const result = await response.json();
        
        if (result.success) {
            showNotification('Backup deleted', 'success');
            loadBackupsList();
        } else {
            showNotification(result.message || 'Failed to delete backup', 'error');
        }
    } catch (error) {
        console.error('Error deleting backup:', error);
        showNotification('Error deleting backup', 'error');
    }
}

// Restore backup
async function restoreBackup(filename) {
    const confirmed = confirm(`⚠️ WARNING: Restore Database?\n\nThis will:\n• Replace ALL current data with this backup\n• Restart the server\n• Require you to login again\n\nAre you absolutely sure you want to restore from:\n${filename}?`);
    
    if (!confirmed) {
        return;
    }
    
    try {
        showNotification('Restoring backup... Server will restart.', 'info');
        
        const response = await fetch(`/api/admin/backup/restore/${filename}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        const result = await response.json();
        
        if (result.success) {
            alert(`Backup restored successfully!\n\nThe server needs to restart.\n\nClick OK and then refresh the page in a few seconds.`);
            
            // Logout and redirect to login
            localStorage.removeItem('adminToken');
            localStorage.removeItem('currentUser');
            window.location.reload();
        } else {
            showNotification(result.message || 'Failed to restore backup', 'error');
        }
    } catch (error) {
        console.error('Error restoring backup:', error);
        showNotification('Error restoring backup', 'error');
    }
}

// Format bytes to human-readable
function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

// Add event listener for backup button
document.addEventListener('DOMContentLoaded', function() {
    const backupBtn = document.getElementById('backupBtn');
    if (backupBtn) {
        backupBtn.addEventListener('click', openBackupModal);
    }
});


