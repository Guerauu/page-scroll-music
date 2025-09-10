import { useState, useEffect } from "react";
import { FileUploader } from "@/components/FileUploader";
import { PDFViewer } from "@/components/PDFViewer";
import { Button } from "@/components/ui/button";
import { Music, Github, Heart, ChevronUp, ChevronDown, X } from "lucide-react";

interface StoredFile {
  name: string;
  size: number;
  type: string;
  data: string; // base64
  lastModified: number;
}

const Index = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [showViewer, setShowViewer] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  
  // Drag & Drop states
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragStartTime, setDragStartTime] = useState<number | null>(null);
  const [dragTimeout, setDragTimeout] = useState<NodeJS.Timeout | null>(null);

  // Load files from localStorage on component mount
  useEffect(() => {
    const loadStoredFiles = async () => {
      try {
        const storedFiles = localStorage.getItem('musescroll-files');
        if (storedFiles) {
          const parsedFiles: StoredFile[] = JSON.parse(storedFiles);
          const files: File[] = [];
          
          for (const storedFile of parsedFiles) {
            // Convert base64 back to File
            const response = await fetch(storedFile.data);
            const blob = await response.blob();
            const file = new File([blob], storedFile.name, {
              type: storedFile.type,
              lastModified: storedFile.lastModified
            });
            files.push(file);
          }
          
          setUploadedFiles(files);
        }
      } catch (error) {
        console.error('Error loading stored files:', error);
      }
    };

    loadStoredFiles();
  }, []);

  // Save files to localStorage whenever uploadedFiles changes
  useEffect(() => {
    const saveFilesToStorage = async () => {
      try {
        const filesToStore: StoredFile[] = [];
        
        for (const file of uploadedFiles) {
          const reader = new FileReader();
          await new Promise((resolve) => {
            reader.onload = () => {
              filesToStore.push({
                name: file.name,
                size: file.size,
                type: file.type,
                data: reader.result as string,
                lastModified: file.lastModified
              });
              resolve(void 0);
            };
            reader.readAsDataURL(file);
          });
        }
        
        localStorage.setItem('musescroll-files', JSON.stringify(filesToStore));
      } catch (error) {
        console.error('Error saving files to storage:', error);
      }
    };

    if (uploadedFiles.length > 0) {
      saveFilesToStorage();
    } else {
      localStorage.removeItem('musescroll-files');
    }
  }, [uploadedFiles]);

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

  // Drag & Drop functions
  const handleMouseDown = (index: number, e: React.MouseEvent) => {
    e.preventDefault();
    setDragStartTime(Date.now());
    
    const timeout = setTimeout(() => {
      setDraggedIndex(index);
      document.body.style.cursor = 'grabbing';
    }, 2000);
    
    setDragTimeout(timeout);
  };

  const handleMouseUp = () => {
    if (dragTimeout) {
      clearTimeout(dragTimeout);
      setDragTimeout(null);
    }
    setDragStartTime(null);
    setDraggedIndex(null);
    document.body.style.cursor = 'auto';
  };

  const handleTouchStart = (index: number, e: React.TouchEvent) => {
    e.preventDefault();
    setDragStartTime(Date.now());
    
    const timeout = setTimeout(() => {
      setDraggedIndex(index);
      navigator.vibrate?.(100); // Vibration feedback on mobile
    }, 2000);
    
    setDragTimeout(timeout);
  };

  const handleTouchEnd = () => {
    if (dragTimeout) {
      clearTimeout(dragTimeout);
      setDragTimeout(null);
    }
    setDragStartTime(null);
    setDraggedIndex(null);
  };

  const handleDrop = (targetIndex: number) => {
    if (draggedIndex === null || draggedIndex === targetIndex) return;
    
    setUploadedFiles(prev => {
      const newFiles = [...prev];
      const [draggedFile] = newFiles.splice(draggedIndex, 1);
      newFiles.splice(targetIndex, 0, draggedFile);
      return newFiles;
    });
    
    setDraggedIndex(null);
    document.body.style.cursor = 'auto';
  };

  // Clean up timeout on component unmount
  useEffect(() => {
    return () => {
      if (dragTimeout) {
        clearTimeout(dragTimeout);
      }
    };
  }, [dragTimeout]);

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
                    className={`flex items-center gap-3 p-4 rounded-lg transition-colors relative ${
                      draggedIndex === index 
                        ? 'bg-primary/20 border-2 border-primary scale-105 shadow-lg' 
                        : 'bg-muted/50 hover:bg-muted/70'
                    }`}
                    onMouseDown={(e) => handleMouseDown(index, e)}
                    onMouseUp={handleMouseUp}
                    onTouchStart={(e) => handleTouchStart(index, e)}
                    onTouchEnd={handleTouchEnd}
                    onMouseEnter={() => {
                      if (draggedIndex !== null && draggedIndex !== index) {
                        handleDrop(index);
                      }
                    }}
                    style={{ 
                      userSelect: 'none',
                      WebkitUserSelect: 'none',
                      cursor: draggedIndex === index ? 'grabbing' : dragStartTime ? 'grab' : 'default'
                    }}
                  >
                    {/* Drop indicator */}
                    {draggedIndex !== null && draggedIndex !== index && (
                      <div className="absolute inset-0 border-2 border-dashed border-primary/50 rounded-lg bg-primary/5" />
                    )}
                    
                    {/* Long press indicator */}
                    {dragStartTime && draggedIndex === null && (
                      <div className="absolute top-2 right-2">
                        <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                      </div>
                    )}
                    {/* Delete Button */}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFile(index)}
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    >
                      <X className="h-4 w-4" />
                    </Button>

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

                    {/* Play Button */}
                    <Button 
                      variant="music" 
                      size="sm"
                      onClick={() => handleFilePlay(file)}
                    >
                      Tocar
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
