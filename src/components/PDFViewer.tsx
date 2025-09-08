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

export const PDFViewer = ({ file, onClose }: PDFViewerProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pdf, setPdf] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [currentView, setCurrentView] = useState(1); // Starts at 1
  const [totalPages, setTotalPages] = useState(0);
  const [scale, setScale] = useState(1.5);
  const [loading, setLoading] = useState(false);

  // Calculate total views: for N pages, we have 2*N - 1 views
  const getTotalViews = () => totalPages > 0 ? 2 * totalPages - 1 : 0;

  useEffect(() => {
    if (!file) return;

    const loadPDF = async () => {
      setLoading(true);
      try {
        const arrayBuffer = await file.arrayBuffer();
        const pdfDoc = await pdfjsLib.getDocument(arrayBuffer).promise;
        setPdf(pdfDoc);
        setTotalPages(pdfDoc.numPages);
        setCurrentView(1);
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
    renderCurrentView();
  }, [pdf, currentView, scale]);

  const renderCurrentView = async () => {
    if (!pdf || !canvasRef.current) return;

    try {
      const canvas = canvasRef.current;
      const context = canvas.getContext("2d");
      
      if (!context) return;

      // Calculate which pages and halves to show
      const { topPage, topHalf, bottomPage, bottomHalf } = getViewConfiguration(currentView);

      // Get the pages we need
      const pages = [];
      const pageNumbers = [topPage, bottomPage].filter((page, index, self) => 
        page <= totalPages && self.indexOf(page) === index
      );

      for (const pageNum of pageNumbers) {
        pages.push({
          page: await pdf.getPage(pageNum),
          pageNumber: pageNum
        });
      }

      if (pages.length === 0) return;

      const viewport = pages[0].page.getViewport({ scale });
      
      // Set canvas size
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      
      // Clear and set white background
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);

      // Create temporary canvases for rendering
      const renderedPages = new Map();
      
      for (const { page, pageNumber } of pages) {
        const tempCanvas = document.createElement('canvas');
        const tempContext = tempCanvas.getContext('2d');
        if (!tempContext) continue;

        const pageViewport = page.getViewport({ scale });
        tempCanvas.height = pageViewport.height;
        tempCanvas.width = pageViewport.width;
        
        tempContext.fillStyle = "#ffffff";
        tempContext.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
        
        await page.render({
          canvasContext: tempContext,
          viewport: pageViewport,
        }).promise;
        
        renderedPages.set(pageNumber, tempCanvas);
      }

      const halfHeight = canvas.height / 2;

      // Draw top half
      if (topPage <= totalPages && renderedPages.has(topPage)) {
        const sourceCanvas = renderedPages.get(topPage);
        const sourceY = topHalf === 'top' ? 0 : halfHeight;
        context.drawImage(
          sourceCanvas,
          0, sourceY, sourceCanvas.width, halfHeight,
          0, 0, canvas.width, halfHeight
        );
      }

      // Draw bottom half
      if (bottomPage <= totalPages && renderedPages.has(bottomPage)) {
        const sourceCanvas = renderedPages.get(bottomPage);
        const sourceY = bottomHalf === 'top' ? 0 : halfHeight;
        context.drawImage(
          sourceCanvas,
          0, sourceY, sourceCanvas.width, halfHeight,
          0, halfHeight, canvas.width, halfHeight
        );
      }

    } catch (error) {
      console.error("Error rendering view:", error);
      toast("Error mostrant la vista");
    }
  };

  const getViewConfiguration = (view: number) => {
    if (view === 1) {
      // Vista 1: A superior + A inferior
      return { topPage: 1, topHalf: 'top' as const, bottomPage: 1, bottomHalf: 'bottom' as const };
    }
    
    // Per a vistes >= 2, calculem la pàgina base
    const pageIndex = Math.floor((view - 2) / 2) + 1; // Pàgina actual (A=1, B=2, C=3...)
    const isEvenView = view % 2 === 0;
    
    if (isEvenView) {
      // Vistes pars (2, 4, 6...): Pàgina següent superior + Pàgina actual inferior
      // Vista 2: B superior + A inferior
      // Vista 4: C superior + B inferior
      return { 
        topPage: pageIndex + 1, 
        topHalf: 'top' as const, 
        bottomPage: pageIndex, 
        bottomHalf: 'bottom' as const 
      };
    } else {
      // Vistes imparells (3, 5, 7...): Pàgina actual superior + Pàgina actual inferior
      // Vista 3: B superior + B inferior
      // Vista 5: C superior + C inferior
      const currentPage = pageIndex + 1;
      return { 
        topPage: currentPage, 
        topHalf: 'top' as const, 
        bottomPage: currentPage, 
        bottomHalf: 'bottom' as const 
      };
    }
  };

  const handleCanvasClick = () => {
    const totalViews = getTotalViews();
    if (currentView < totalViews) {
      setCurrentView(prev => prev + 1);
    }
  };

  const goToPreviousView = () => {
    if (currentView > 1) {
      setCurrentView(prev => prev - 1);
    }
  };

  const goToNextView = () => {
    const totalViews = getTotalViews();
    if (currentView < totalViews) {
      setCurrentView(prev => prev + 1);
    }
  };

  const resetView = () => {
    setCurrentView(1);
    setScale(1.5);
  };

  const zoomIn = () => {
    setScale(prev => Math.min(prev + 0.25, 3));
  };

  const zoomOut = () => {
    setScale(prev => Math.max(prev - 0.25, 0.5));
  };

  const getViewDescription = () => {
    const config = getViewConfiguration(currentView);
    
    // Assegurem que les pàgines existeixen abans de mostrar la descripció
    if (config.topPage > totalPages || config.bottomPage > totalPages) {
      return `Vista ${currentView}`;
    }
    
    const topPageLetter = String.fromCharCode(64 + config.topPage); // A, B, C...
    const bottomPageLetter = String.fromCharCode(64 + config.bottomPage);
    
    if (config.topPage === config.bottomPage) {
      return `Pàg. ${topPageLetter} (sup. + inf.)`;
    } else {
      return `Pàg. ${topPageLetter} (sup.) + Pàg. ${bottomPageLetter} (inf.)`;
    }
  };

  const getCurrentProgress = () => {
    const totalViews = getTotalViews();
    return totalViews > 0 ? ((currentView - 1) / (totalViews - 1)) * 100 : 0;
  };

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
          <span>{getViewDescription()}</span>
          <span>Vista {currentView} de {getTotalViews()}</span>
        </div>
        <Progress value={getCurrentProgress()} className="h-2" />
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
                border: "1px solid hsl(var(--border))"
              }}
            />
            {/* Divider line to show halves */}
            <div className="absolute top-1/2 left-0 right-0 h-px bg-primary/20 pointer-events-none" />
          </div>
        )}
      </div>

      {/* Bottom Controls */}
      <div className="flex items-center justify-center gap-4 p-4 bg-card border-t shadow-music-soft">
        <Button
          variant="outline"
          onClick={goToPreviousView}
          disabled={currentView === 1}
          className="flex items-center gap-2 min-w-32"
        >
          <ChevronLeft className="h-4 w-4" />
          Anterior
        </Button>
        
        <Button
          variant="default"
          onClick={handleCanvasClick}
          className="flex items-center gap-2 min-w-40 bg-gradient-music"
          disabled={currentView === getTotalViews()}
        >
          {currentView < getTotalViews() ? "Següent Vista" : "Final"}
        </Button>
        
        <Button
          variant="outline"
          onClick={goToNextView}
          disabled={currentView === getTotalViews()}
          className="flex items-center gap-2 min-w-32"
        >
          Següent
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};