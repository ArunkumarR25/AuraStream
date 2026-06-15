/**
 * AURA STREAM - CAMERA UPLOAD BRIDGE (NODE.JS)
 * 
 * Works out-of-the-box in Node.js 18+ (uses native fetch & FormData).
 * Watches a folder for new photos and uploads them to the server.
 */

const fs = require('fs');
const path = require('path');

// ==============================================================================
# CONFIGURATION
// ==============================================================================
// 1. Path to the folder where your camera uploads photos (via FTP, SD card, etc.)
const WATCH_FOLDER = './camera_photos';

// 2. Your API Upload URL (obtained from the dashboard integration panel)
//    Example: "http://localhost:3000/api/upload/your-event-id?secret=your-secret"
const UPLOAD_URL = 'http://localhost:3000/api/upload/replace-this-with-event-id?secret=your-secret';

// 3. File containing the log of already uploaded files (to prevent re-upload on restart)
const HISTORY_FILE = '.uploaded_history.log';
// ==============================================================================

// Ensure watch folder exists
if (!fs.existsSync(WATCH_FOLDER)) {
  fs.mkdirSync(WATCH_FOLDER, { recursive: true });
  console.log(`[+] Created watch folder: ${path.resolve(WATCH_FOLDER)}`);
} else {
  console.log(`[+] Watching folder: ${path.resolve(WATCH_FOLDER)}`);
}

// Load uploaded history
let uploadedFiles = new Set();
if (fs.existsSync(HISTORY_FILE)) {
  const content = fs.readFileSync(HISTORY_FILE, 'utf8');
  uploadedFiles = new Set(content.split('\n').map(line => line.trim()).filter(Boolean));
  console.log(`[*] Loaded ${uploadedFiles.size} previously uploaded files from history.`);
}

function saveToHistory(filePath) {
  fs.appendFileSync(HISTORY_FILE, filePath + '\n', 'utf8');
}

console.log(`[+] API Endpoint: ${UPLOAD_URL}`);
console.log(`[+] History stored in: ${path.resolve(HISTORY_FILE)}`);
console.log('[*] Waiting for new photos... (Press Ctrl+C to stop)');
console.log('------------------------------------------------------------');

// Polling folder every 1.5 seconds (more robust across platforms than fs.watch)
setInterval(async () => {
  try {
    const files = fs.readdirSync(WATCH_FOLDER);
    
    for (const filename of files) {
      if (filename.startsWith('.')) continue; // ignore hidden files
      
      const filePath = path.join(WATCH_FOLDER, filename);
      const absPath = path.resolve(filePath);
      
      // Check if it is a file and has a valid image extension
      const stats = fs.statSync(filePath);
      if (stats.isFile()) {
        const ext = filename.toLowerCase();
        const isValidImage = ['.jpg', '.jpeg', '.png', '.heic', '.heif', '.cr2', '.cr3', '.nef', '.arw'].some(suffix => ext.endsWith(suffix));
        
        if (isValidImage && !uploadedFiles.has(absPath)) {
          console.log(`[*] New file detected: ${filename}. Uploading...`);
          uploadedFiles.add(absPath); // optimistically add to prevent double upload
          
          try {
            // Wait 500ms to ensure file writing is complete
            await new Promise(r => setTimeout(r, 500));
            
            const fileBuffer = fs.readFileSync(filePath);
            const blob = new Blob([fileBuffer], { type: 'image/jpeg' });
            const formData = new FormData();
            formData.append('file', blob, filename);
            
            const response = await fetch(UPLOAD_URL, {
              method: 'POST',
              body: formData
            });
            
            const json = await response.json();
            
            if (response.ok) {
              console.log(`[✓] Successfully uploaded: ${filename}`);
              saveToHistory(absPath);
            } else {
              console.error(`[-] Upload failed for ${filename}. Status: ${response.status}`);
              console.error('    Response:', JSON.stringify(json));
              uploadedFiles.delete(absPath); // remove on failure to allow retry
            }
          } catch (uploadErr) {
            console.error(`[-] Error uploading ${filename}:`, uploadErr.message);
            uploadedFiles.delete(absPath); // remove on failure to allow retry
          }
        }
      }
    }
  } catch (err) {
    console.error('[-] Error in watch loop:', err.message);
  }
}, 1500);
