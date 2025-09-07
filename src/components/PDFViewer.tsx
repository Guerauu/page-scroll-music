import { useEffect, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import "pdfjs-dist/build/pdf.worker.min.mjs";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, RotateCcw } from "lucide-react";
import { toast } from "sonner";

// Set worker path
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

interface PDFViewerProps {
  file: File | null;
  onClose: () => void;
}

type ViewMode = "full" | "top-half" | "bottom-half";

export const PDFViewer = ({ file, onClose }: PDFViewerProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pdf, setPdf] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [viewMode, setViewMode] = useState<ViewMode>("full");
  const [scale, setScale] = useState(1.5);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!file) return;

    const loadPDF = async () => {
      setLoading(true);
      try {
        const arrayBuffer = await file.arrayBuffer();
        const pdfDoc = await pdfjsLib.getDocument(arrayBuffer).promise;
        setPdf(pdfDoc);
        setTotalPages(pdfDoc.numPages);
        setCurrentPage(1);
        setViewMode("full");
        toast("Partitura carregada correctament!");
      } catch (error) {
        console.error("Error loading PDF:", error);
        toast("Error carregant la partitura");
      } finally {
        setLoading(false);
      }
    };

    loadPDF();
  }, [file]);

  useEffect(() => {
    if (!pdf || !canvasRef.current) return;

    renderPage();
  }, [pdf, currentPage, viewMode, scale]);

  const renderPage = async () => {
    if (!pdf || !canvasRef.current) return;

    try {
      const page = await pdf.getPage(currentPage);
      const canvas = canvasRef.current;
      const context = canvas.getContext("2d");
      
      if (!context) return;

      const viewport = page.getViewport({ scale });
      
      // Configure canvas size
      canvas.height = viewport.height;
      canvas.width = viewport.width;

      // Clear canvas
      context.clearRect(0, 0, canvas.width, canvas.height);
      
      // Set white background
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);

      // Render the page
      const renderContext = {
        canvasContext: context,
        viewport: viewport,
        canvas: canvas,
      };

      await page.render(renderContext).promise;

      // Apply view mode clipping
      if (viewMode !== "full") {
        const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
        context.clearRect(0, 0, canvas.width, canvas.height);
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, canvas.width, canvas.height);

        if (viewMode === "top-half") {
          context.putImageData(imageData, 0, 0, 0, 0, canvas.width, canvas.height / 2);
        } else if (viewMode === "bottom-half") {
          context.putImageData(imageData, 0, -canvas.height / 2, 0, canvas.height / 2, canvas.width, canvas.height / 2);
        }
      }
    } catch (error) {
      console.error("Error rendering page:", error);
      toast("Error mostrant la pàgina");
    }
  };

  const handleCanvasClick = () => {
    if (!pdf) return;

    if (viewMode === "full") {
      setViewMode("top-half");
    } else if (viewMode === "top-half") {
      setViewMode("bottom-half");
    } else if (viewMode === "bottom-half") {
      // Go to next page if available, otherwise stay on bottom half
      if (currentPage < totalPages) {
        setCurrentPage(prev => prev + 1);
        setViewMode("full");
      }
    }
  };

  const goToPreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(prev => prev - 1);
      setViewMode("full");
    }
  };

  const goToNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(prev => prev + 1);
      setViewMode("full");
    }
  };

  const resetView = () => {
    setViewMode("full");
    setScale(1.5);
  };

  const zoomIn = () => {
    setScale(prev => Math.min(prev + 0.25, 3));
  };

  const zoomOut = () => {
    setScale(prev => Math.max(prev - 0.25, 0.5));
  };

  const getViewModeLabel = () => {
    if (viewMode === "full") return "Pàgina completa";
    if (viewMode === "top-half") return "Meitat superior";
    return "Meitat inferior";
  };

  const progress = totalPages > 0 ? ((currentPage - 1) / totalPages) * 100 + (viewMode === "bottom-half" ? 50 : viewMode === "top-half" ? 25 : 0) : 0;

  if (!file) return null;

  return (
    <div className="flex flex-col h-screen bg-music-surface">
      {/* Header Controls */}
      <div className="flex items-center justify-between p-4 bg-card border-b shadow-music-soft">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onClose}>
            ← Tornar
          </Button>
          <div className="text-sm font-medium text-muted-foreground">
            {file.name}
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={zoomOut}>
            <ZoomOut className="h-4 w-4" />
          </Button>
          <div className="text-sm font-mono min-w-12 text-center">
            {Math.round(scale * 100)}%
          </div>
          <Button variant="outline" size="sm" onClick={zoomIn}>
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={resetView}>
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="px-4 py-2 bg-muted/50">
        <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
          <span>{getViewModeLabel()}</span>
          <span>Pàgina {currentPage} de {totalPages}</span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      {/* PDF Canvas Container */}
      <div className="flex-1 flex items-center justify-center p-4 overflow-auto">
        {loading ? (
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Carregant partitura...</p>
          </div>
        ) : (
          <div className="relative">
            <canvas
              ref={canvasRef}
              onClick={handleCanvasClick}
              className="max-w-full max-h-full shadow-music-medium rounded-lg cursor-pointer transition-transform hover:scale-[1.02]"
              style={{ 
                filter: viewMode !== "full" ? "none" : "none",
                border: "1px solid hsl(var(--border))"
              }}
            />
            {viewMode !== "full" && (
              <div className="absolute top-2 right-2 bg-music-control-active text-primary-foreground px-3 py-1 rounded-full text-sm font-medium shadow-lg">
                {viewMode === "top-half" ? "Superior" : "Inferior"}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom Controls */}
      <div className="flex items-center justify-center gap-4 p-4 bg-card border-t shadow-music-soft">
        <Button
          variant="outline"
          onClick={goToPreviousPage}
          disabled={currentPage === 1}
          className="flex items-center gap-2 min-w-32"
        >
          <ChevronLeft className="h-4 w-4" />
          Anterior
        </Button>
        
        <Button
          variant="default"
          onClick={handleCanvasClick}
          className="flex items-center gap-2 min-w-40 bg-gradient-music"
        >
          {viewMode === "full" ? "Veure Superior" : 
           viewMode === "top-half" ? "Veure Inferior" : "Següent Pàgina"}
        </Button>
        
        <Button
          variant="outline"
          onClick={goToNextPage}
          disabled={currentPage === totalPages}
          className="flex items-center gap-2 min-w-32"
        >
          Següent
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};