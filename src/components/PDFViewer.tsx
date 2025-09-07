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

type ViewState = "single" | "overlap";

export const PDFViewer = ({ file, onClose }: PDFViewerProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pdf, setPdf] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [viewState, setViewState] = useState<ViewState>("single");
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
        setViewState("single");
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
  }, [pdf, currentPage, viewState, scale]);

  const renderPage = async () => {
    if (!pdf || !canvasRef.current) return;

    try {
      const canvas = canvasRef.current;
      const context = canvas.getContext("2d");
      
      if (!context) return;

      if (viewState === "single") {
        // Render single page
        const page = await pdf.getPage(currentPage);
        const viewport = page.getViewport({ scale });
        
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, canvas.width, canvas.height);
        
        await page.render({
          canvasContext: context,
          viewport: viewport,
          canvas: canvas,
        }).promise;
        
      } else {
        // Render overlap: bottom half of previous page + top half of current page
        const prevPage = await pdf.getPage(currentPage - 1);
        const currPage = await pdf.getPage(currentPage);
        
        const prevViewport = prevPage.getViewport({ scale });
        const currViewport = currPage.getViewport({ scale });
        
        // Set canvas size to accommodate both half pages
        canvas.height = prevViewport.height;
        canvas.width = Math.max(prevViewport.width, currViewport.width);
        
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, canvas.width, canvas.height);
        
        // Create temporary canvases for each page
        const tempCanvas1 = document.createElement('canvas');
        const tempContext1 = tempCanvas1.getContext('2d');
        const tempCanvas2 = document.createElement('canvas');
        const tempContext2 = tempCanvas2.getContext('2d');
        
        if (!tempContext1 || !tempContext2) return;
        
        // Render previous page
        tempCanvas1.height = prevViewport.height;
        tempCanvas1.width = prevViewport.width;
        tempContext1.fillStyle = "#ffffff";
        tempContext1.fillRect(0, 0, tempCanvas1.width, tempCanvas1.height);
        
        await prevPage.render({
          canvasContext: tempContext1,
          viewport: prevViewport,
          canvas: tempCanvas1,
        }).promise;
        
        // Render current page
        tempCanvas2.height = currViewport.height;
        tempCanvas2.width = currViewport.width;
        tempContext2.fillStyle = "#ffffff";
        tempContext2.fillRect(0, 0, tempCanvas2.width, tempCanvas2.height);
        
        await currPage.render({
          canvasContext: tempContext2,
          viewport: currViewport,
          canvas: tempCanvas2,
        }).promise;
        
        // Combine: bottom half of previous page + top half of current page
        const halfHeight = canvas.height / 2;
        
        // Draw bottom half of previous page on top
        context.drawImage(
          tempCanvas1,
          0, halfHeight, tempCanvas1.width, halfHeight,
          0, 0, canvas.width, halfHeight
        );
        
        // Draw top half of current page on bottom
        context.drawImage(
          tempCanvas2,
          0, 0, tempCanvas2.width, halfHeight,
          0, halfHeight, canvas.width, halfHeight
        );
      }
    } catch (error) {
      console.error("Error rendering page:", error);
      toast("Error mostrant la pàgina");
    }
  };

  const handleCanvasClick = () => {
    if (!pdf) return;

    if (viewState === "single") {
      // If not on last page, show overlap with next page
      if (currentPage < totalPages) {
        setCurrentPage(prev => prev + 1);
        setViewState("overlap");
      }
    } else {
      // From overlap, go to single view of current page
      setViewState("single");
    }
  };

  const goToPreviousPage = () => {
    if (viewState === "overlap") {
      setViewState("single");
      setCurrentPage(prev => prev - 1);
    } else if (currentPage > 1) {
      setCurrentPage(prev => prev - 1);
      setViewState("single");
    }
  };

  const goToNextPage = () => {
    if (viewState === "single" && currentPage < totalPages) {
      setCurrentPage(prev => prev + 1);
      setViewState("overlap");
    } else if (viewState === "overlap") {
      setViewState("single");
    }
  };

  const resetView = () => {
    setViewState("single");
    setScale(1.5);
  };

  const zoomIn = () => {
    setScale(prev => Math.min(prev + 0.25, 3));
  };

  const zoomOut = () => {
    setScale(prev => Math.max(prev - 0.25, 0.5));
  };

  const getViewStateLabel = () => {
    if (viewState === "single") return `Pàgina ${currentPage}`;
    return `Pàg. ${currentPage - 1} (inf.) + Pàg. ${currentPage} (sup.)`;
  };

  const getCurrentProgress = () => {
    if (viewState === "single") {
      return ((currentPage - 1) / totalPages) * 100;
    } else {
      return ((currentPage - 1.5) / totalPages) * 100;
    }
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
          <span>{getViewStateLabel()}</span>
          <span>{totalPages} pàgines</span>
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
            {viewState === "overlap" && (
              <div className="absolute top-2 right-2 bg-music-control-active text-primary-foreground px-3 py-1 rounded-full text-sm font-medium shadow-lg">
                Solapament
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
          disabled={currentPage === 1 && viewState === "single"}
          className="flex items-center gap-2 min-w-32"
        >
          <ChevronLeft className="h-4 w-4" />
          Anterior
        </Button>
        
        <Button
          variant="default"
          onClick={handleCanvasClick}
          className="flex items-center gap-2 min-w-40 bg-gradient-music"
          disabled={currentPage === totalPages && viewState === "single"}
        >
          {viewState === "single" && currentPage < totalPages ? "Veure Solapament" : 
           viewState === "overlap" ? "Veure Pàgina Completa" : "Final"}
        </Button>
        
        <Button
          variant="outline"
          onClick={goToNextPage}
          disabled={currentPage === totalPages && viewState === "single"}
          className="flex items-center gap-2 min-w-32"
        >
          Següent
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};