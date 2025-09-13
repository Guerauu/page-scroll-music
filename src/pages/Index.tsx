import { useState, useEffect } from "react";
import { FileUploader } from "@/components/FileUploader";
import { PDFViewer } from "@/components/PDFViewer";
import { Button } from "@/components/ui/button";
import { Music, Github, Heart, ChevronUp, ChevronDown, X } from "lucide-react";
import { storage, initStorage } from "@/lib/storage";
import { toast } from "sonner";

const Index = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [showViewer, setShowViewer] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [isStorageReady, setIsStorageReady] = useState(false);

  // Initialize storage and load files
  useEffect(() => {
    const initializeStorage = async () => {
      try {
        await initStorage();
        const files = await storage.getFiles();
        setUploadedFiles(files);
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
            await storage.saveFile(file);
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

          {/* Files List Section */}
          {uploadedFiles.length > 0 && (
            <div className="bg-card rounded-xl shadow-music-soft p-6">
              <h2 className="text-xl font-semibold mb-4">Les meves Partitures</h2>
                <div className="grid gap-3">
                {uploadedFiles.map((file, index) => (
                  <div 
                    key={index} 
                    className="flex items-center gap-3 p-4 rounded-lg bg-muted/50 hover:bg-muted/70 transition-colors"
                  >
                    {/* File Info */}
                    <div className="flex items-center gap-3 flex-1">
                      <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                        <Music className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium">{file.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {(file.size / 1024 / 1024).toFixed(1)} MB
                        </p>
                      </div>
                    </div>

                    {/* Order Controls */}
                    <div className="flex flex-col gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => moveFileUp(index)}
                        disabled={index === 0}
                        className="h-6 w-6 p-0"
                      >
                        <ChevronUp className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => moveFileDown(index)}
                        disabled={index === uploadedFiles.length - 1}
                        className="h-6 w-6 p-0"
                      >
                        <ChevronDown className="h-3 w-3" />
                      </Button>
                    </div>

                    {/* Play Button */}
                    <Button 
                      variant="music" 
                      size="sm"
                      onClick={() => handleFilePlay(file)}
                    >
                      Tocar
                    </Button>

                    {/* Delete Button - Separated from order controls */}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFile(index)}
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 ml-2"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>

    </div>
  );
};

export default Index;
