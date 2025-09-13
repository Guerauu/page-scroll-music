interface StoredFile {
  id: string;
  name: string;
  size: number;
  type: string;
  data: Blob;
  lastModified: number;
  addedAt: number;
}

interface StoredMarkers {
  id: string;
  fileName: string;
  markers: Marker[];
  lastModified: number;
}

interface Marker {
  id: string;
  view: number;
  x: number;
  y: number;
  targetView: number;
  targetX: number;
  targetY: number;
  colorIndex: number;
}

class MuseScrollStorage {
  private dbName = 'musescroll-storage';
  private dbVersion = 1;
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => {
        console.error('Error opening IndexedDB:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create files store
        if (!db.objectStoreNames.contains('files')) {
          const filesStore = db.createObjectStore('files', { keyPath: 'id' });
          filesStore.createIndex('name', 'name', { unique: false });
          filesStore.createIndex('addedAt', 'addedAt', { unique: false });
        }

        // Create markers store
        if (!db.objectStoreNames.contains('markers')) {
          const markersStore = db.createObjectStore('markers', { keyPath: 'id' });
          markersStore.createIndex('fileName', 'fileName', { unique: true });
        }
      };
    });
  }

  // Files operations
  async saveFile(file: File): Promise<string> {
    await this.ensureInitialized();
    
    const id = `${file.name}-${file.size}-${file.lastModified}`;
    const storedFile: StoredFile = {
      id,
      name: file.name,
      size: file.size,
      type: file.type,
      data: file,
      lastModified: file.lastModified,
      addedAt: Date.now()
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['files'], 'readwrite');
      const store = transaction.objectStore('files');
      const request = store.put(storedFile);

      request.onsuccess = () => resolve(id);
      request.onerror = () => reject(request.error);
    });
  }

  async getFiles(): Promise<File[]> {
    await this.ensureInitialized();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['files'], 'readonly');
      const store = transaction.objectStore('files');
      const index = store.index('addedAt');
      const request = index.getAll();

      request.onsuccess = () => {
        const storedFiles: StoredFile[] = request.result;
        const files = storedFiles.map(stored => 
          new File([stored.data], stored.name, {
            type: stored.type,
            lastModified: stored.lastModified
          })
        );
        resolve(files);
      };

      request.onerror = () => reject(request.error);
    });
  }

  async deleteFile(file: File): Promise<void> {
    await this.ensureInitialized();
    
    const id = `${file.name}-${file.size}-${file.lastModified}`;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['files'], 'readwrite');
      const store = transaction.objectStore('files');
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // Markers operations
  async saveMarkers(fileName: string, markers: Marker[]): Promise<void> {
    await this.ensureInitialized();

    const id = `markers-${fileName}`;
    const storedMarkers: StoredMarkers = {
      id,
      fileName,
      markers,
      lastModified: Date.now()
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['markers'], 'readwrite');
      const store = transaction.objectStore('markers');
      const request = store.put(storedMarkers);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getMarkers(fileName: string): Promise<Marker[]> {
    await this.ensureInitialized();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['markers'], 'readonly');
      const store = transaction.objectStore('markers');
      const id = `markers-${fileName}`;
      const request = store.get(id);

      request.onsuccess = () => {
        const result = request.result as StoredMarkers | undefined;
        resolve(result?.markers || []);
      };

      request.onerror = () => reject(request.error);
    });
  }

  async deleteMarkers(fileName: string): Promise<void> {
    await this.ensureInitialized();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['markers'], 'readwrite');
      const store = transaction.objectStore('markers');
      const id = `markers-${fileName}`;
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // Migration from localStorage
  async migrateFromLocalStorage(): Promise<void> {
    await this.ensureInitialized();

    try {
      // Migrate files
      const storedFiles = localStorage.getItem('musescroll-files');
      if (storedFiles) {
        const parsedFiles = JSON.parse(storedFiles);
        for (const storedFile of parsedFiles) {
          try {
            // Convert base64 back to File
            const response = await fetch(storedFile.data);
            const blob = await response.blob();
            const file = new File([blob], storedFile.name, {
              type: storedFile.type,
              lastModified: storedFile.lastModified
            });
            await this.saveFile(file);
          } catch (error) {
            console.warn('Error migrating file:', storedFile.name, error);
          }
        }
        localStorage.removeItem('musescroll-files');
        console.log('Files migrated from localStorage to IndexedDB');
      }

      // Migrate markers
      const localStorageKeys = Object.keys(localStorage);
      for (const key of localStorageKeys) {
        if (key.startsWith('markers_')) {
          try {
            const fileName = key.replace('markers_', '');
            const markersData = localStorage.getItem(key);
            if (markersData) {
              const markers = JSON.parse(markersData);
              await this.saveMarkers(fileName, markers);
              localStorage.removeItem(key);
            }
          } catch (error) {
            console.warn('Error migrating markers for key:', key, error);
          }
        }
      }
      console.log('Markers migrated from localStorage to IndexedDB');
      
    } catch (error) {
      console.error('Error during migration:', error);
    }
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.db) {
      await this.init();
    }
  }
}

// Create and export singleton instance
export const storage = new MuseScrollStorage();

// Initialize and migrate on first use
let initPromise: Promise<void> | null = null;

export const initStorage = async (): Promise<void> => {
  if (!initPromise) {
    initPromise = (async () => {
      await storage.init();
      await storage.migrateFromLocalStorage();
    })();
  }
  return initPromise;
};