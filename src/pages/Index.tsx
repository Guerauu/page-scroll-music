import { useState } from "react";
import { FileUploader } from "@/components/FileUploader";
import { PDFViewer } from "@/components/PDFViewer";
import { Button } from "@/components/ui/button";
import { Music, Github, Heart } from "lucide-react";

const Index = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [showViewer, setShowViewer] = useState(false);

  const handleFileSelect = (file: File | null) => {
    setSelectedFile(file);
    if (file) {
      setShowViewer(true);
    }
  };

  const handleCloseViewer = () => {
    setShowViewer(false);
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
      <main className="container mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <h2 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-music bg-clip-text text-transparent">
            Llegeix Partitures com mai abans
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
            Navegació intel·ligent per mitges pàgines. Perfect per a músics que necessiten més temps per llegir sense perdre el compàs.
          </p>
          
          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto mb-12">
            <div className="p-6 bg-card rounded-xl shadow-music-soft">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4 mx-auto">
                <span className="text-2xl">👆</span>
              </div>
              <h3 className="font-semibold mb-2">Navegació Intel·ligent</h3>
              <p className="text-sm text-muted-foreground">
                Clica per veure primer la meitat superior, després la inferior, i finalment la següent pàgina
              </p>
            </div>
            
            <div className="p-6 bg-card rounded-xl shadow-music-soft">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4 mx-auto">
                <span className="text-2xl">📱</span>
              </div>
              <h3 className="font-semibold mb-2">Optimitzat per Tablets</h3>
              <p className="text-sm text-muted-foreground">
                Dissenyat específicament per a la lectura musical en dispositius tàctils
              </p>
            </div>
            
            <div className="p-6 bg-card rounded-xl shadow-music-soft">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4 mx-auto">
                <span className="text-2xl">🎵</span>
              </div>
              <h3 className="font-semibold mb-2">Fet per Músics</h3>
              <p className="text-sm text-muted-foreground">
                Soluciona el problema de no tenir temps per passar pàgina mentre toques
              </p>
            </div>
          </div>
        </div>

        <FileUploader onFileSelect={handleFileSelect} selectedFile={selectedFile} />

        {selectedFile && (
          <div className="text-center mt-8">
            <Button 
              size="lg" 
              variant="music"
              onClick={() => setShowViewer(true)}
              className="shadow-music-medium"
            >
              Obrir Partitura
            </Button>
          </div>
        )}
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
