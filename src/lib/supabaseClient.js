import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Check if credentials are valid and not placeholders
const isConfigured = 
  supabaseUrl && 
  supabaseUrl !== 'YOUR_SUPABASE_URL' && 
  supabaseAnonKey && 
  supabaseAnonKey !== 'YOUR_SUPABASE_ANON_KEY';

let supabaseClientInstance = null;

// Mock Realtime PubSub system for localStorage simulation
class RealtimeSimulator {
  constructor() {
    this.listeners = [];
  }

  subscribe(channelName, eventType, table, filter, callback) {
    const listener = { channelName, eventType, table, filter, callback };
    this.listeners.push(listener);
    
    // Return unsubscribe function
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  publish(table, eventType, newRecord) {
    this.listeners.forEach(l => {
      if (l.table === table && (l.eventType === '*' || l.eventType === eventType)) {
        // Simple filter check if provided (e.g. event_id=eq.uuid)
        let matchesFilter = true;
        if (l.filter && l.filter.includes('eq.')) {
          const [col, val] = l.filter.split('=eq.');
          if (newRecord[col] !== val) {
            matchesFilter = false;
          }
        }
        if (matchesFilter) {
          l.callback({
            schema: 'public',
            table,
            commit_timestamp: new Date().toISOString(),
            eventType,
            new: newRecord,
            old: eventType === 'DELETE' ? { id: newRecord.id } : {}
          });
        }
      }
    });
  }
}

export const realtimeSimulator = new RealtimeSimulator();

// Custom high-fidelity mock client for LocalStorage
const createMockClient = () => {
  console.warn('⚠️ Supabase URL or Anon Key not configured. Using high-fidelity LocalStorage simulation.');

  // Initialize storage
  if (typeof window !== 'undefined') {
    if (!localStorage.getItem('sb_events')) {
      localStorage.setItem('sb_events', JSON.stringify([
        {
          id: 'mock-event-1',
          photographer_id: 'mock-user-id',
          event_name: 'Chloe & Alexander’s Wedding',
          event_date: '2026-06-20',
          venue: 'The Plaza Hotel, New York',
          created_at: new Date().toISOString()
        },
        {
          id: 'mock-event-2',
          photographer_id: 'mock-user-id',
          event_name: 'Sophia & Marcus’s Nuptials',
          event_date: '2026-07-04',
          venue: 'Villa d’Este, Lake Como, Italy',
          created_at: new Date().toISOString()
        }
      ]));
    }
    
    if (!localStorage.getItem('sb_images')) {
      localStorage.setItem('sb_images', JSON.stringify([
        {
          id: 'img-1',
          event_id: 'mock-event-1',
          storage_path: 'wedding-photos/img-1.jpg',
          public_url: 'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&q=80&w=800',
          created_at: new Date().toISOString()
        },
        {
          id: 'img-2',
          event_id: 'mock-event-1',
          storage_path: 'wedding-photos/img-2.jpg',
          public_url: 'https://images.unsplash.com/photo-1511285560929-80b456fea0bc?auto=format&fit=crop&q=80&w=800',
          created_at: new Date().toISOString()
        },
        {
          id: 'img-3',
          event_id: 'mock-event-1',
          storage_path: 'wedding-photos/img-3.jpg',
          public_url: 'https://images.unsplash.com/photo-1583939003579-730e3918a45a?auto=format&fit=crop&q=80&w=800',
          created_at: new Date().toISOString()
        },
        {
          id: 'img-4',
          event_id: 'mock-event-2',
          storage_path: 'wedding-photos/img-4.jpg',
          public_url: 'https://images.unsplash.com/photo-1465495976277-4387d4b0b4c6?auto=format&fit=crop&q=80&w=800',
          created_at: new Date().toISOString()
        }
      ]));
    }

    if (!localStorage.getItem('sb_user')) {
      localStorage.setItem('sb_user', JSON.stringify({
        id: 'mock-user-id',
        email: 'photographer@luxurywedding.com'
      }));
    }
  }

  const getEvents = () => JSON.parse(localStorage.getItem('sb_events') || '[]');
  const saveEvents = (events) => localStorage.setItem('sb_events', JSON.stringify(events));
  const getImages = () => JSON.parse(localStorage.getItem('sb_images') || '[]');
  const saveImages = (images) => localStorage.setItem('sb_images', JSON.stringify(images));
  const getUser = () => JSON.parse(localStorage.getItem('sb_user') || 'null');

  return {
    auth: {
      async getUser() {
        const user = getUser();
        return { data: { user }, error: null };
      },
      async signUp({ email, password }) {
        const user = { id: 'mock-user-id-' + Math.random().toString(36).substr(2, 9), email };
        localStorage.setItem('sb_user', JSON.stringify(user));
        return { data: { user }, error: null };
      },
      async signInWithPassword({ email, password }) {
        const user = { id: 'mock-user-id', email };
        localStorage.setItem('sb_user', JSON.stringify(user));
        return { data: { user }, error: null };
      },
      async signOut() {
        localStorage.removeItem('sb_user');
        return { error: null };
      },
      onAuthStateChange(callback) {
        // Simple mock handler
        return {
          data: {
            subscription: {
              unsubscribe() {}
            }
          }
        };
      }
    },
    
    from(table) {
      return {
        select(columns = '*') {
          let data = table === 'events' ? getEvents() : getImages();
          
          const chain = {
            data,
            error: null,
            eq(col, val) {
              this.data = this.data.filter(item => item[col] === val);
              return this;
            },
            order(col, { ascending = true } = {}) {
              this.data.sort((a, b) => {
                const valA = a[col];
                const valB = b[col];
                if (valA < valB) return ascending ? -1 : 1;
                if (valA > valB) return ascending ? 1 : -1;
                return 0;
              });
              return this;
            },
            // Emulate Promise behaviour so it can be awaited directly
            then(resolve) {
              resolve({ data: this.data, error: this.error });
            }
          };
          return chain;
        },

        insert(records) {
          const recordsArr = Array.isArray(records) ? records : [records];
          const newRecords = recordsArr.map(rec => ({
            id: rec.id || 'mock-' + Math.random().toString(36).substr(2, 9),
            created_at: new Date().toISOString(),
            ...rec
          }));

          if (table === 'events') {
            const current = getEvents();
            saveEvents([...current, ...newRecords]);
          } else if (table === 'event_images') {
            const current = getImages();
            saveImages([...current, ...newRecords]);
            // Publish realtime insertion
            newRecords.forEach(rec => {
              realtimeSimulator.publish('event_images', 'INSERT', rec);
            });
          }

          return {
            data: newRecords,
            error: null,
            then(resolve) {
              resolve({ data: newRecords, error: null });
            }
          };
        },

        delete() {
          const chain = {
            filters: [],
            eq(col, val) {
              this.filters.push({ col, val });
              return this;
            },
            then(resolve) {
              let current = table === 'events' ? getEvents() : getImages();
              const itemsToDelete = current.filter(item => {
                return this.filters.every(f => item[f.col] === f.val);
              });
              const remaining = current.filter(item => {
                return !this.filters.every(f => item[f.col] === f.val);
              });

              if (table === 'events') {
                saveEvents(remaining);
                // Also clean up images related to these events
                const allImages = getImages();
                const imageIdsToDelete = itemsToDelete.map(e => e.id);
                const remainingImages = allImages.filter(img => !imageIdsToDelete.includes(img.event_id));
                saveImages(remainingImages);
              } else {
                saveImages(remaining);
                itemsToDelete.forEach(rec => {
                  realtimeSimulator.publish('event_images', 'DELETE', rec);
                });
              }

              resolve({ data: itemsToDelete, error: null });
            }
          };
          return chain;
        }
      };
    },

    storage: {
      from(bucket) {
        return {
          async upload(path, file) {
            // Wait 1 second to simulate upload network delay
            await new Promise(resolve => setTimeout(resolve, 800));
            
            // Generate a blob URL as mock storage url
            let url = '';
            if (file instanceof File) {
              url = URL.createObjectURL(file);
            } else {
              url = `https://images.unsplash.com/photo-${1500000000000 + Math.floor(Math.random()*1000000)}?auto=format&fit=crop&q=80&w=800`;
            }

            // Save public URL reference inside memory map
            if (typeof window !== 'undefined') {
              const uploads = JSON.parse(localStorage.getItem('sb_mock_uploads') || '{}');
              uploads[path] = url;
              localStorage.setItem('sb_mock_uploads', JSON.stringify(uploads));
            }

            return { data: { path }, error: null };
          },
          getPublicUrl(path) {
            let publicUrl = '';
            if (typeof window !== 'undefined') {
              const uploads = JSON.parse(localStorage.getItem('sb_mock_uploads') || '{}');
              publicUrl = uploads[path];
            }
            if (!publicUrl) {
              publicUrl = 'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&q=80&w=800';
            }
            return { data: { publicUrl } };
          }
        };
      }
    },

    // Simulate Supabase Realtime Channels
    channel(channelName) {
      const callbacks = [];
      return {
        on(event, filterConfig, callback) {
          callbacks.push({ event, filterConfig, callback });
          return this;
        },
        subscribe(statusCallback) {
          const unsubscribers = callbacks.map(c => {
            const table = c.filterConfig.table;
            const filter = c.filterConfig.filter;
            // Map 'postgres_changes' to the subscription
            return realtimeSimulator.subscribe(
              channelName,
              c.filterConfig.event || '*',
              table,
              filter,
              c.callback
            );
          });

          if (statusCallback) {
            statusCallback('SUBSCRIBED');
          }

          return {
            unsubscribe() {
              unsubscribers.forEach(unsub => unsub());
            }
          };
        }
      };
    }
  };
};

if (isConfigured) {
  supabaseClientInstance = createClient(supabaseUrl, supabaseAnonKey);
} else {
  supabaseClientInstance = createMockClient();
}

export const supabase = supabaseClientInstance;
export const isMockClient = !isConfigured;
