import os
import time
import requests
import mimetypes

# ==============================================================================
# CONFIGURATION
# ==============================================================================
# 1. Path to the folder where your camera uploads photos (via FTP, SD card, etc.)
#    Use double backslashes on Windows, e.g., r"C:\Camera\FTP" or "C:\\Camera\\FTP"
WATCH_FOLDER = r"./camera_photos"

# 2. Your API Upload URL (obtained from the dashboard integration panel)
#    Example: "http://localhost:3000/api/upload/your-event-id?secret=your-secret"
UPLOAD_URL = "http://localhost:3000/api/upload/replace-this-with-event-id?secret=your-secret"

# 3. File containing the log of already uploaded files (to prevent re-upload on restart)
HISTORY_FILE = ".uploaded_history.log"
# ==============================================================================

def load_history():
    if not os.path.exists(HISTORY_FILE):
        return set()
    try:
        with open(HISTORY_FILE, "r", encoding="utf-8") as f:
            return set(line.strip() for line in f if line.strip())
    except Exception as e:
        print(f"[-] Error loading history file: {e}")
        return set()

def save_to_history(filepath):
    try:
        with open(HISTORY_FILE, "a", encoding="utf-8") as f:
            f.write(filepath + "\n")
    except Exception as e:
        print(f"[-] Error writing to history file: {e}")

def main():
    print("=" * 60)
    print("           AURA STREAM - CAMERA UPLOAD BRIDGE (PYTHON)")
    print("=" * 60)
    
    # Ensure watch folder exists
    if not os.path.exists(WATCH_FOLDER):
        try:
            os.makedirs(WATCH_FOLDER)
            print(f"[+] Created watch folder: {os.path.abspath(WATCH_FOLDER)}")
        except Exception as e:
            print(f"[-] Error creating watch folder: {e}")
            return
    else:
        print(f"[+] Watching folder: {os.path.abspath(WATCH_FOLDER)}")
        
    print(f"[+] API Endpoint: {UPLOAD_URL}")
    print(f"[+] History stored in: {os.path.abspath(HISTORY_FILE)}")
    print("[*] Waiting for new photos... (Press Ctrl+C to stop)")
    print("-" * 60)

    uploaded_files = load_history()
    print(f"[*] Loaded {len(uploaded_files)} previously uploaded files from history.")

    while True:
        try:
            for filename in os.listdir(WATCH_FOLDER):
                # Ignore hidden files
                if filename.startswith('.'):
                    continue
                
                filepath = os.path.join(WATCH_FOLDER, filename)
                
                # Check if it is a file and a valid image
                if os.path.isfile(filepath):
                    ext = filename.lower()
                    if ext.endswith(('.jpg', '.jpeg', '.png', '.heic', '.heif', '.cr2', '.cr3', '.nef', '.arw')):
                        abs_path = os.path.abspath(filepath)
                        
                        if abs_path not in uploaded_files:
                            print(f"[*] New file detected: {filename}. Uploading...")
                            
                            # Simple retry mechanism
                            success = False
                            for attempt in range(3):
                                try:
                                    # Wait briefly for file to finish writing (especially for FTP uploads)
                                    time.sleep(0.5)
                                    
                                    mime_type, _ = mimetypes.guess_type(filepath)
                                    mime_type = mime_type or 'image/jpeg'
                                    
                                    with open(filepath, 'rb') as img:
                                        files = {'file': (filename, img, mime_type)}
                                        response = requests.post(UPLOAD_URL, files=files, timeout=30)
                                        
                                    if response.ok:
                                        print(f"[✓] Successfully uploaded: {filename}")
                                        uploaded_files.add(abs_path)
                                        save_to_history(abs_path)
                                        success = True
                                        break
                                    else:
                                        print(f"[-] Upload failed for {filename} (Attempt {attempt+1}/3). Status code: {response.status_code}")
                                        print(f"    Response: {response.text}")
                                except Exception as upload_err:
                                    print(f"[-] Error uploading {filename} (Attempt {attempt+1}/3): {upload_err}")
                                time.sleep(2)
                                
                            if not success:
                                print(f"[✗] Failed to upload {filename} after 3 attempts.")
                                
            time.sleep(1.5)
        except KeyboardInterrupt:
            print("\n[*] Bridge stopped. Goodbye!")
            break
        except Exception as e:
            print(f"[-] Error in watch loop: {e}")
            time.sleep(5)

if __name__ == "__main__":
    main()
