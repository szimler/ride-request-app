const fs = require('fs');
const path = require('path');
const { db } = require('./database');

// Backup Manager Module
class BackupManager {
    constructor() {
        this.dbPath = path.join(__dirname, 'ride_requests.db');
        this.backupDir = path.join(__dirname, 'backups');
        
        // Create backups directory if it doesn't exist
        if (!fs.existsSync(this.backupDir)) {
            fs.mkdirSync(this.backupDir);
        }
    }
    
    // Create a backup with timestamp
    async createBackup(customPath = null) {
        return new Promise((resolve, reject) => {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupFileName = `ride_requests_backup_${timestamp}.db`;
            const backupPath = customPath 
                ? path.join(customPath, backupFileName)
                : path.join(this.backupDir, backupFileName);
            
            try {
                // Ensure destination directory exists
                const destDir = path.dirname(backupPath);
                if (!fs.existsSync(destDir)) {
                    fs.mkdirSync(destDir, { recursive: true });
                }
                
                // Copy database file
                fs.copyFileSync(this.dbPath, backupPath);
                
                const stats = fs.statSync(backupPath);
                
                resolve({
                    success: true,
                    message: 'Backup created successfully',
                    backup: {
                        filename: backupFileName,
                        path: backupPath,
                        size: stats.size,
                        timestamp: new Date().toISOString()
                    }
                });
            } catch (error) {
                reject({
                    success: false,
                    message: `Backup failed: ${error.message}`,
                    error: error.message
                });
            }
        });
    }
    
    // Export to JSON (human-readable format)
    async exportToJSON(customPath = null) {
        return new Promise((resolve, reject) => {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const jsonFileName = `ride_requests_export_${timestamp}.json`;
            const jsonPath = customPath 
                ? path.join(customPath, jsonFileName)
                : path.join(this.backupDir, jsonFileName);
            
            // Gather all data
            const exportData = {
                exported_at: new Date().toISOString(),
                version: '1.0',
                data: {}
            };
            
            // Get all ride requests
            db.all('SELECT * FROM ride_requests ORDER BY created_at DESC', [], (err, requests) => {
                if (err) {
                    return reject({
                        success: false,
                        message: `Export failed: ${err.message}`
                    });
                }
                
                exportData.data.ride_requests = requests;
                
                // Get admin users (without passwords)
                db.all('SELECT id, username, full_name, email, role, is_active, created_at, last_login FROM admin_users', [], (err, users) => {
                    if (err) {
                        return reject({
                            success: false,
                            message: `Export failed: ${err.message}`
                        });
                    }
                    
                    exportData.data.admin_users = users;
                    
                    // Get activity logs
                    db.all('SELECT * FROM activity_logs ORDER BY created_at DESC LIMIT 1000', [], (err, logs) => {
                        if (err) {
                            // Logs might not exist, continue anyway
                            exportData.data.activity_logs = [];
                        } else {
                            exportData.data.activity_logs = logs;
                        }
                        
                        // Write JSON file
                        try {
                            const destDir = path.dirname(jsonPath);
                            if (!fs.existsSync(destDir)) {
                                fs.mkdirSync(destDir, { recursive: true });
                            }
                            
                            fs.writeFileSync(jsonPath, JSON.stringify(exportData, null, 2));
                            const stats = fs.statSync(jsonPath);
                            
                            resolve({
                                success: true,
                                message: 'JSON export created successfully',
                                export: {
                                    filename: jsonFileName,
                                    path: jsonPath,
                                    size: stats.size,
                                    timestamp: new Date().toISOString(),
                                    counts: {
                                        ride_requests: requests.length,
                                        admin_users: users.length,
                                        activity_logs: exportData.data.activity_logs.length
                                    }
                                }
                            });
                        } catch (error) {
                            reject({
                                success: false,
                                message: `Export failed: ${error.message}`
                            });
                        }
                    });
                });
            });
        });
    }
    
    // List all backups
    async listBackups() {
        return new Promise((resolve, reject) => {
            try {
                const files = fs.readdirSync(this.backupDir);
                const backups = files
                    .filter(f => f.endsWith('.db') || f.endsWith('.json'))
                    .map(filename => {
                        const filePath = path.join(this.backupDir, filename);
                        const stats = fs.statSync(filePath);
                        return {
                            filename,
                            path: filePath,
                            size: stats.size,
                            created: stats.birthtime,
                            modified: stats.mtime,
                            type: filename.endsWith('.db') ? 'database' : 'json'
                        };
                    })
                    .sort((a, b) => b.created - a.created);
                
                resolve({
                    success: true,
                    backups,
                    count: backups.length
                });
            } catch (error) {
                reject({
                    success: false,
                    message: `Failed to list backups: ${error.message}`
                });
            }
        });
    }
    
    // Delete a backup
    async deleteBackup(filename) {
        return new Promise((resolve, reject) => {
            try {
                const backupPath = path.join(this.backupDir, filename);
                
                if (!fs.existsSync(backupPath)) {
                    return reject({
                        success: false,
                        message: 'Backup file not found'
                    });
                }
                
                fs.unlinkSync(backupPath);
                
                resolve({
                    success: true,
                    message: 'Backup deleted successfully',
                    filename
                });
            } catch (error) {
                reject({
                    success: false,
                    message: `Failed to delete backup: ${error.message}`
                });
            }
        });
    }
    
    // Restore from backup
    async restoreBackup(filename) {
        return new Promise((resolve, reject) => {
            try {
                const backupPath = path.join(this.backupDir, filename);
                
                if (!fs.existsSync(backupPath)) {
                    return reject({
                        success: false,
                        message: 'Backup file not found'
                    });
                }
                
                if (!filename.endsWith('.db')) {
                    return reject({
                        success: false,
                        message: 'Can only restore .db files (not JSON exports)'
                    });
                }
                
                // Create a backup of current database before restoring
                const currentBackup = `current_before_restore_${Date.now()}.db`;
                fs.copyFileSync(this.dbPath, path.join(this.backupDir, currentBackup));
                
                // Restore the backup
                fs.copyFileSync(backupPath, this.dbPath);
                
                resolve({
                    success: true,
                    message: 'Database restored successfully. Server restart required.',
                    current_backup: currentBackup
                });
            } catch (error) {
                reject({
                    success: false,
                    message: `Failed to restore backup: ${error.message}`
                });
            }
        });
    }
    
    // Get database statistics
    async getStats() {
        return new Promise((resolve, reject) => {
            const stats = fs.statSync(this.dbPath);
            
            db.get('SELECT COUNT(*) as count FROM ride_requests', [], (err, requests) => {
                if (err) return reject({ success: false, message: err.message });
                
                db.get('SELECT COUNT(*) as count FROM admin_users', [], (err, users) => {
                    if (err) return reject({ success: false, message: err.message });
                    
                    db.get('SELECT COUNT(*) as count FROM activity_logs', [], (err, logs) => {
                        // Logs might not exist
                        const logCount = err ? 0 : logs.count;
                        
                        resolve({
                            success: true,
                            stats: {
                                database_size: stats.size,
                                database_path: this.dbPath,
                                last_modified: stats.mtime,
                                counts: {
                                    ride_requests: requests.count,
                                    admin_users: users.count,
                                    activity_logs: logCount
                                }
                            }
                        });
                    });
                });
            });
        });
    }
}

module.exports = new BackupManager();

