interface StoredFile {
  id: string;
  name: string;
  size: number;
  type: string;
  data: Blob;
  lastModified: number;
  addedAt: number;
  folderId?: string; // Nueva propiedad para asociar archivos con carpetas
}

interface StoredFolder {
  id: string;
  name: string;
  createdAt: number;
  order: number;
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

interface Annotation {
  id: string;
  type: 'oval' | 'wholeNote' | 'repeatStart' | 'repeatEnd' | 'text';
  x: number; // relative position (0-1)
  y: number; // relative position (0-1)
  text?: string; // for text annotations
  page: number; // page number (1-based)
}

interface StoredAnnotations {
  id: string;
  fileName: string;
  annotations: Annotation[];
  lastModified: number;
}

class MuseScrollStorage {
  private dbName = 'musescroll-storage';
  private dbVersion = 2;
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
          filesStore.createIndex('folderId', 'folderId', { unique: false });
        }

        // Create markers store
        if (!db.objectStoreNames.contains('markers')) {
          const markersStore = db.createObjectStore('markers', { keyPath: 'id' });
          markersStore.createIndex('fileName', 'fileName', { unique: true });
        }

        // Create folders store
        if (!db.objectStoreNames.contains('folders')) {
          const foldersStore = db.createObjectStore('folders', { keyPath: 'id' });
          foldersStore.createIndex('order', 'order', { unique: false });
        }

        // Create annotations store
        if (!db.objectStoreNames.contains('annotations')) {
          const annotationsStore = db.createObjectStore('annotations', { keyPath: 'id' });
          annotationsStore.createIndex('fileName', 'fileName', { unique: true });
        }
      };
    });
  }

  // Folders operations
  async createFolder(name: string): Promise<string> {
    await this.ensureInitialized();
    
    const folders = await this.getFolders();
    const maxOrder = folders.length > 0 ? Math.max(...folders.map(f => f.order)) : -1;
    
    const id = `folder-${Date.now()}`;
    const folder: StoredFolder = {
      id,
      name,
      createdAt: Date.now(),
      order: maxOrder + 1
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['folders'], 'readwrite');
      const store = transaction.objectStore('folders');
      const request = store.put(folder);

      request.onsuccess = () => resolve(id);
      request.onerror = () => reject(request.error);
    });
  }

  async getFolders(): Promise<StoredFolder[]> {
    await this.ensureInitialized();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['folders'], 'readonly');
      const store = transaction.objectStore('folders');
      const index = store.index('order');
      const request = index.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async updateFolder(id: string, updates: Partial<StoredFolder>): Promise<void> {
    await this.ensureInitialized();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['folders'], 'readwrite');
      const store = transaction.objectStore('folders');
      
      const getRequest = store.get(id);
      getRequest.onsuccess = () => {
        const folder = getRequest.result;
        if (folder) {
          const updatedFolder = { ...folder, ...updates };
          const putRequest = store.put(updatedFolder);
          putRequest.onsuccess = () => resolve();
          putRequest.onerror = () => reject(putRequest.error);
        } else {
          reject(new Error('Folder not found'));
        }
      };
      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  async deleteFolder(id: string): Promise<void> {
    await this.ensureInitialized();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['folders', 'files'], 'readwrite');
      
      // Delete folder
      const folderStore = transaction.objectStore('folders');
      const deleteFolderRequest = folderStore.delete(id);
      
      // Move files in this folder to root (no folder)
      const filesStore = transaction.objectStore('files');
      const filesIndex = filesStore.index('folderId');
      const getFilesRequest = filesIndex.getAll(id);
      
      getFilesRequest.onsuccess = () => {
        const files = getFilesRequest.result;
        let completed = 0;
        const total = files.length;
        
        if (total === 0) {
          deleteFolderRequest.onsuccess = () => resolve();
          deleteFolderRequest.onerror = () => reject(deleteFolderRequest.error);
          return;
        }
        
        files.forEach(file => {
          delete file.folderId;
          const updateRequest = filesStore.put(file);
          updateRequest.onsuccess = () => {
            completed++;
            if (completed === total) {
              deleteFolderRequest.onsuccess = () => resolve();
              deleteFolderRequest.onerror = () => reject(deleteFolderRequest.error);
            }
          };
          updateRequest.onerror = () => reject(updateRequest.error);
        });
      };
      
      getFilesRequest.onerror = () => reject(getFilesRequest.error);
    });
  }

  // Files operations
  async saveFile(file: File, folderId?: string): Promise<string> {
    await this.ensureInitialized();
    
    const id = `${file.name}-${file.size}-${file.lastModified}`;
    const storedFile: StoredFile = {
      id,
      name: file.name,
      size: file.size,
      type: file.type,
      data: file,
      lastModified: file.lastModified,
      addedAt: Date.now(),
      folderId
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['files'], 'readwrite');
      const store = transaction.objectStore('files');
      const request = store.put(storedFile);

      request.onsuccess = () => resolve(id);
      request.onerror = () => reject(request.error);
    });
  }

  async moveFileToFolder(file: File, folderId?: string): Promise<void> {
    await this.ensureInitialized();
    
    const id = `${file.name}-${file.size}-${file.lastModified}`;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['files'], 'readwrite');
      const store = transaction.objectStore('files');
      
      const getRequest = store.get(id);
      getRequest.onsuccess = () => {
        const storedFile = getRequest.result;
        if (storedFile) {
          storedFile.folderId = folderId;
          const putRequest = store.put(storedFile);
          putRequest.onsuccess = () => resolve();
          putRequest.onerror = () => reject(putRequest.error);
        } else {
          reject(new Error('File not found'));
        }
      };
      getRequest.onerror = () => reject(getRequest.error);
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
        const files = storedFiles.map(stored => {
          const file = new File([stored.data], stored.name, {
            type: stored.type,
            lastModified: stored.lastModified
          });
          // Store folder info in a way we can access it
          (file as any).folderId = stored.folderId;
          return file;
        });
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

  // Annotations operations
  async saveAnnotations(fileName: string, annotations: Annotation[]): Promise<void> {
    await this.ensureInitialized();

    const id = `annotations-${fileName}`;
    const storedAnnotations: StoredAnnotations = {
      id,
      fileName,
      annotations,
      lastModified: Date.now()
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['annotations'], 'readwrite');
      const store = transaction.objectStore('annotations');
      const request = store.put(storedAnnotations);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getAnnotations(fileName: string): Promise<Annotation[]> {
    await this.ensureInitialized();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['annotations'], 'readonly');
      const store = transaction.objectStore('annotations');
      const id = `annotations-${fileName}`;
      const request = store.get(id);

      request.onsuccess = () => {
        const result = request.result as StoredAnnotations | undefined;
        resolve(result?.annotations || []);
      };

      request.onerror = () => reject(request.error);
    });
  }

  async deleteAnnotations(fileName: string): Promise<void> {
    await this.ensureInitialized();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['annotations'], 'readwrite');
      const store = transaction.objectStore('annotations');
      const id = `annotations-${fileName}`;
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