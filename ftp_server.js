/**
 * AURA STREAM - FTP UPLOAD GATEWAY
 * 
 * A standalone FTP server that allows cameras (Canon, Nikon, Sony, etc.)
 * to upload photos directly to the website without writing python/node scripts.
 * 
 * Usage:
 *   1. Make sure .env.local has your Supabase URL, Service Role Key, and UPLOAD_SECRET
 *   2. Run: npm run ftp (or node ftp_server.js)
 *   3. Enter the displayed IP, port (2121), username (event_<eventId>), and password in your camera FTP settings.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const FtpSrv = require('ftp-srv');
const { createClient } = require('@supabase/supabase-js');
const ws = require('ws');

// ── 1. Parse .env.local ──────────────────────────────────────────────────────
const envPath = path.join(__dirname, '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split(/\r?\n/).forEach(line => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      const key = match[1];
      let val = match[2] || '';
      if (val.startsWith('"') && val.endsWith('"')) {
        val = val.substring(1, val.length - 1);
      }
      process.env[key] = val;
    }
  });
}

// Ensure required environment variables exist
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const uploadSecret = process.env.UPLOAD_SECRET;

if (!supabaseUrl || !supabaseKey) {
  console.error('[-] Error: Supabase URL or Service Role Key is missing in .env.local!');
  process.exit(1);
}

// ── 2. Initialize Supabase Client ────────────────────────────────────────────
const supabaseAdmin = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
  realtime: { transport: ws }
});

// Create a local directory to temporarily hold FTP uploads before sending to Supabase
const TEMP_FTP_DIR = path.join(__dirname, 'ftp_temp');
if (!fs.existsSync(TEMP_FTP_DIR)) {
  fs.mkdirSync(TEMP_FTP_DIR, { recursive: true });
}

// ── 3. Helper: Get Local IP Address ──────────────────────────────────────────
function getLocalIp() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return '127.0.0.1';
}
const LOCAL_IP = getLocalIp();
const FTP_PORT = 2121;

// ── 4. Initialize FTP Server ─────────────────────────────────────────────────
const ftpServer = new FtpSrv({
  url: `ftp://0.0.0.0:${FTP_PORT}`,
  pasv_url: LOCAL_IP,
  pasv_min: 10000,
  pasv_max: 10100,
  anonymous: false
});

// Authenticate connections
ftpServer.on('login', async ({ connection, username, password }, resolve, reject) => {
  console.log(`[*] Authentication attempt: user="${username}"`);
  
  // Extract eventId from username (accepts event_<eventId> or just the raw eventId)
  let eventId = username;
  if (username.startsWith('event_')) {
    eventId = username.substring(6);
  }

  // Validate global upload secret
  if (uploadSecret && password !== uploadSecret) {
    console.log(`[-] Authentication failed: Invalid secret key for user "${username}"`);
    return reject(new Error('Invalid password / upload secret'));
  }

  try {
    // Validate event exists in Supabase
    const { data: event, error: eventErr } = await supabaseAdmin
      .from('events')
      .select('id, event_name')
      .eq('id', eventId)
      .single();

    if (eventErr || !event) {
      console.log(`[-] Authentication failed: Event "${eventId}" not found in database.`);
      return reject(new Error('Event not found'));
    }

    console.log(`[+] Authenticated successfully for event: "${event.event_name}" (${eventId})`);

    // Assign a workspace folder for this event
    const eventDir = path.join(TEMP_FTP_DIR, eventId);
    if (!fs.existsSync(eventDir)) {
      fs.mkdirSync(eventDir, { recursive: true });
    }

    resolve({ root: eventDir });
  } catch (err) {
    console.error(`[-] Error in authentication database query:`, err.message);
    reject(err);
  }
});

// ── 5. Background Watcher to Upload Finished Files ───────────────────────────
// Periodically checks the temporary directory, detects when writing has finished,
// uploads the file to Supabase, and deletes it from local storage.
const processingFiles = new Set();

setInterval(async () => {
  try {
    if (!fs.existsSync(TEMP_FTP_DIR)) return;
    
    // Read event directories
    const eventDirs = fs.readdirSync(TEMP_FTP_DIR);
    
    for (const eventId of eventDirs) {
      const eventPath = path.join(TEMP_FTP_DIR, eventId);
      if (!fs.statSync(eventPath).isDirectory()) continue;
      
      const files = fs.readdirSync(eventPath);
      for (const filename of files) {
        if (filename.startsWith('.')) continue; // skip hidden files
        
        const filePath = path.join(eventPath, filename);
        
        // Skip if this file is already being processed
        if (processingFiles.has(filePath)) continue;
        
        const fileStat = fs.statSync(filePath);
        
        if (fileStat.isFile()) {
          // Check file extension
          const ext = filename.split('.').pop()?.toLowerCase();
          const isValid = ['jpg', 'jpeg', 'png', 'heic', 'heif', 'cr2', 'cr3', 'nef', 'arw'].includes(ext);
          if (!isValid) continue;

          // Lock file before waiting to prevent other cycles from picking it up
          processingFiles.add(filePath);

          // Verify writing has finished by checking if file size remains stable
          await new Promise(r => setTimeout(r, 600));
          
          if (!fs.existsSync(filePath)) {
            processingFiles.delete(filePath);
            continue;
          }
          
          const fileStatCheck = fs.statSync(filePath);
          
          if (fileStatCheck.size === fileStat.size && fileStat.size > 0) {
            console.log(`[*] File ready for upload: ${filename} (${eventId})`);
            
            try {
              const fileBuffer = fs.readFileSync(filePath);
              const storagePath = `events/${eventId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
              const mimeType = ext === 'png' ? 'image/png' : 'image/jpeg';
              
              // Upload to Supabase Storage
              const { error: uploadErr } = await supabaseAdmin.storage
                .from('wedding-photos')
                .upload(storagePath, fileBuffer, {
                  contentType: mimeType,
                  cacheControl: '3600',
                  upsert: false
                });
                
              if (uploadErr) throw uploadErr;
              
              // Get public URL
              const { data: urlData } = supabaseAdmin.storage
                .from('wedding-photos')
                .getPublicUrl(storagePath);
                
              // Insert DB image record
              const { error: dbErr } = await supabaseAdmin
                .from('event_images')
                .insert({
                  event_id: eventId,
                  storage_path: storagePath,
                  public_url: urlData.publicUrl
                });
                
              if (dbErr) throw dbErr;
              
              console.log(`[✓] Successfully processed and uploaded FTP file: ${filename}`);
              
              // Delete local temp file
              fs.unlinkSync(filePath);
            } catch (err) {
              console.error(`[-] Error uploading FTP file ${filename}:`, err.message);
            } finally {
              processingFiles.delete(filePath);
            }
          } else {
            // File is still being written to, release lock so next cycle checks it again
            processingFiles.delete(filePath);
          }
        }
      }
    }
  } catch (err) {
    console.error(`[-] Watcher error:`, err.message);
  }
}, 1500);

// ── 6. Start the FTP Server ──────────────────────────────────────────────────
ftpServer.listen()
  .then(() => {
    console.log('\n============================================================');
    console.log('             AURA STREAM - FTP UPLOAD GATEWAY               ');
    console.log('============================================================');
    console.log(`[+] FTP Server running on:  ftp://localhost:${FTP_PORT}`);
    console.log(`[+] Your Local Network IP:  ${LOCAL_IP}`);
    console.log('[+] Connection credentials for cameras:');
    console.log(`    - Host/Server:  ${LOCAL_IP}  (or your domain)`);
    console.log(`    - Port:         ${FTP_PORT}`);
    console.log('    - Username:     event_<eventId>');
    console.log(`    - Password:     ${uploadSecret || '(None set)'}`);
    console.log('============================================================\n');
  })
  .catch(err => {
    console.error('[-] Error starting FTP server:', err.message);
  });
