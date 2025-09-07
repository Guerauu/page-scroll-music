import { useState } from "react";
import { FileUploader } from "@/components/FileUploader";
import { PDFViewer } from "@/components/PDFViewer";
import { Button } from "@/components/ui/button";
import { Music, Github, Heart, ChevronUp, ChevronDown } from "lucide-react";

const Index = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [showViewer, setShowViewer] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);

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
                <h1 className="text-xl font-bold">PartituraViewer</h1>
                <p className="text-sm text-muted-foreground">Visualitzador intel·ligent de partitures</p>
              </div>
            </div>
            
            <Button variant="ghost" size="sm" asChild>
              <a href="https://github.com" target="_blank" rel="noopener noreferrer">
                <Github className="h-4 w-4" />
                Codi Font
              </a>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* File Uploader Section */}
          <div className="bg-card rounded-xl shadow-music-soft p-6">
            <h2 className="text-xl font-semibold mb-4">Afegir Partitures</h2>
            <FileUploader onFileSelect={handleFileSelect} selectedFile={null} />
          </div>

          {/* Files List Section */}
          {uploadedFiles.length > 0 && (
            <div className="bg-card rounded-xl shadow-music-soft p-6">
              <h2 className="text-xl font-semibold mb-4">Les meves Partitures</h2>
              <div className="grid gap-3">
                {uploadedFiles.map((file, index) => (
                  <div key={index} className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg hover:bg-muted/70 transition-colors">
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

      {/* Footer */}
      <footer className="border-t bg-card/50 backdrop-blur-sm mt-16">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            Fet amb <Heart className="h-4 w-4 text-red-500" /> per a la comunitat musical
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
