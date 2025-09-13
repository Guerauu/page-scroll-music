import { useState, useEffect } from "react";
import { FileUploader } from "@/components/FileUploader";
import { PDFViewer } from "@/components/PDFViewer";
import { FolderManager } from "@/components/FolderManager";
import { Button } from "@/components/ui/button";
import { Music, Github, Heart, ChevronUp, ChevronDown, X } from "lucide-react";
import { storage, initStorage } from "@/lib/storage";
import { toast } from "sonner";

interface StoredFolder {
  id: string;
  name: string;
  createdAt: number;
  order: number;
}

const Index = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [showViewer, setShowViewer] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [folders, setFolders] = useState<StoredFolder[]>([]);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [isStorageReady, setIsStorageReady] = useState(false);

  // Initialize storage and load files
  useEffect(() => {
    const initializeStorage = async () => {
      try {
        await initStorage();
        const [files, foldersData] = await Promise.all([
          storage.getFiles(),
          storage.getFolders()
        ]);
        setUploadedFiles(files);
        setFolders(foldersData);
        setIsStorageReady(true);
      } catch (error) {
        console.error('Error initializing storage:', error);
        toast.error('Error inicialitzant l\'emmagatzemament');
        setIsStorageReady(true); // Continue even if storage fails
      }
    };

    initializeStorage();
  }, []);

  // Save files whenever uploadedFiles changes (only after storage is ready)
  useEffect(() => {
    if (!isStorageReady) return;

    const saveFiles = async () => {
      try {
        // Get current files in storage
        const currentFiles = await storage.getFiles();
        
        // Find files to remove (in storage but not in uploadedFiles)
        for (const currentFile of currentFiles) {
          const stillExists = uploadedFiles.some(f => 
            f.name === currentFile.name && 
            f.size === currentFile.size && 
            f.lastModified === currentFile.lastModified
          );
          
          if (!stillExists) {
            await storage.deleteFile(currentFile);
          }
        }
        
        // Save new files
        for (const file of uploadedFiles) {
          const alreadyExists = currentFiles.some(f => 
            f.name === file.name && 
            f.size === file.size && 
            f.lastModified === file.lastModified
          );
          
          if (!alreadyExists) {
            await storage.saveFile(file, (file as any).folderId);
          }
        }
      } catch (error) {
        console.error('Error saving files:', error);
        toast.error('Error guardant els fitxers');
      }
    };

    saveFiles();
  }, [uploadedFiles, isStorageReady]);

  const handleFileSelect = (file: File | null) => {
    if (file) {
      setUploadedFiles(prev => {
        const exists = prev.some(f => f.name === file.name && f.size === file.size);
        if (!exists) {
          return [...prev, file];
        }
        return prev;
      });
    }
  };

  const handleFilesSelect = (files: File[]) => {
    setUploadedFiles(prev => {
      const newFiles = [...prev];
      files.forEach(file => {
        const exists = newFiles.some(f => f.name === file.name && f.size === file.size);
        if (!exists) {
          newFiles.push(file);
        }
      });
      return newFiles;
    });
  };

  const handleFilePlay = (file: File) => {
    setSelectedFile(file);
    setShowViewer(true);
  };

  const handleCloseViewer = () => {
    setShowViewer(false);
  };

  const moveFileUp = (index: number) => {
    if (index > 0) {
      setUploadedFiles(prev => {
        const newFiles = [...prev];
        [newFiles[index - 1], newFiles[index]] = [newFiles[index], newFiles[index - 1]];
        return newFiles;
      });
    }
  };

  const moveFileDown = (index: number) => {
    if (index < uploadedFiles.length - 1) {
      setUploadedFiles(prev => {
        const newFiles = [...prev];
        [newFiles[index], newFiles[index + 1]] = [newFiles[index + 1], newFiles[index]];
        return newFiles;
      });
    }
  };

  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  // Folder management functions
  const handleCreateFolder = async (name: string) => {
    try {
      const folderId = await storage.createFolder(name);
      const newFolder: StoredFolder = {
        id: folderId,
        name,
        createdAt: Date.now(),
        order: folders.length
      };
      setFolders(prev => [...prev, newFolder]);
    } catch (error) {
      console.error('Error creating folder:', error);
      toast.error('Error creant la carpeta');
    }
  };

  const handleUpdateFolder = async (id: string, name: string) => {
    try {
      await storage.updateFolder(id, { name });
      setFolders(prev => prev.map(folder => 
        folder.id === id ? { ...folder, name } : folder
      ));
    } catch (error) {
      console.error('Error updating folder:', error);
      toast.error('Error actualitzant la carpeta');
    }
  };

  const handleDeleteFolder = async (id: string) => {
    try {
      await storage.deleteFolder(id);
      setFolders(prev => prev.filter(folder => folder.id !== id));
      setExpandedFolders(prev => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
      });
      
      // Refresh files to reflect changes
      const files = await storage.getFiles();
      setUploadedFiles(files);
    } catch (error) {
      console.error('Error deleting folder:', error);
      toast.error('Error eliminant la carpeta');
    }
  };

  const handleToggleFolder = (folderId: string) => {
    setExpandedFolders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(folderId)) {
        newSet.delete(folderId);
      } else {
        newSet.add(folderId);
      }
      return newSet;
    });
  };

  const handleMoveFileToFolder = async (file: File, targetFolderId?: string) => {
    try {
      await storage.moveFileToFolder(file, targetFolderId);
      
      // Update local state
      setUploadedFiles(prev => prev.map(f => {
        if (f.name === file.name && f.size === file.size && f.lastModified === file.lastModified) {
          (f as any).folderId = targetFolderId;
        }
        return f;
      }));
      
      toast.success('Partitura moguda correctament');
    } catch (error) {
      console.error('Error moving file:', error);
      toast.error('Error movent la partitura');
    }
  };

  // Get files by folder
  const getFilesByFolder = (folderId: string | undefined) => {
    return uploadedFiles.filter(file => (file as any).folderId === folderId);
  };

  // Drag & Drop functions - REMOVED
  // Now using only arrow buttons for reordering

  if (showViewer && selectedFile) {
    return <PDFViewer file={selectedFile} onClose={handleCloseViewer} />;
  }

  return (
    <div className="min-h-screen bg-gradient-subtle">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-music rounded-lg">
                <Music className="h-6 w-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-xl font-bold">MuseScroll</h1>
                <p className="text-sm text-muted-foreground">Visualitzador de partitures</p>
              </div>
            </div>

          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* File Uploader Section */}
          <div className="bg-card rounded-xl shadow-music-soft p-6">
            <h2 className="text-xl font-semibold mb-4">Afegir Partitures</h2>
            <FileUploader 
              onFileSelect={handleFileSelect} 
              onFilesSelect={handleFilesSelect}
              selectedFile={null} 
            />
          </div>

          {/* Files and Folders Section */}
          {(uploadedFiles.length > 0 || folders.length > 0) && (
            <div className="bg-card rounded-xl shadow-music-soft p-6">
              <FolderManager
                folders={folders}
                onCreateFolder={handleCreateFolder}
                onUpdateFolder={handleUpdateFolder}
                onDeleteFolder={handleDeleteFolder}
                expandedFolders={expandedFolders}
                onToggleFolder={handleToggleFolder}
                uploadedFiles={uploadedFiles}
                onFilePlay={handleFilePlay}
                onMoveFileUp={moveFileUp}
                onMoveFileDown={moveFileDown}
                onRemoveFile={removeFile}
                onMoveFileToFolder={handleMoveFileToFolder}
              />
            </div>
          )}
        </div>
      </main>

    </div>
  );
};

export default Index;
