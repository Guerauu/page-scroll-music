import { useEffect, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import "pdfjs-dist/build/pdf.worker.min.mjs";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, RotateCcw, Menu, X, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

// Set worker path
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

interface Marker {
  id: string;
  view: number;
  x: number; // posició x relativa (0-1) origen
  y: number; // posició y relativa (0-1) origen
  targetView: number;
  targetX: number; // posició x relativa (0-1) destí
  targetY: number; // posició y relativa (0-1) destí
  colorIndex: number;
}

interface PDFViewerProps {
  file: File | null;
  onClose: () => void;
}

export const PDFViewer = ({ file, onClose }: PDFViewerProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [pdf, setPdf] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [currentView, setCurrentView] = useState(1); // Starts at 1
  const [totalPages, setTotalPages] = useState(0);
  const [scale, setScale] = useState(1.5);
  const [loading, setLoading] = useState(false);
  
  // Marker states
  const [markers, setMarkers] = useState<Marker[]>([]);
  const [isMarkersMenuOpen, setIsMarkersMenuOpen] = useState(false);
  const [insertMode, setInsertMode] = useState<'none' | 'origin' | 'target'>('none');
  const [pendingOrigin, setPendingOrigin] = useState<{view: number, x: number, y: number} | null>(null);

  // Calculate total views: for N pages, we have 2*N - 1 views
  const getTotalViews = () => totalPages > 0 ? 2 * totalPages - 1 : 0;

  // Load markers from localStorage
  useEffect(() => {
    if (!file) return;
    const savedMarkers = localStorage.getItem(`markers_${file.name}`);
    if (savedMarkers) {
      try {
        setMarkers(JSON.parse(savedMarkers));
      } catch (error) {
        console.error("Error loading markers:", error);
      }
    }
  }, [file]);

  // Save markers to localStorage
  useEffect(() => {
    if (!file || markers.length === 0) return;
    localStorage.setItem(`markers_${file.name}`, JSON.stringify(markers));
  }, [markers, file]);

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
  }, [pdf, currentView, scale, markers]);

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
        const sourceY = bottomHalf === 'bottom' ? halfHeight : 0;
        context.drawImage(
          sourceCanvas,
          0, sourceY, sourceCanvas.width, halfHeight,
          0, halfHeight, canvas.width, halfHeight
        );
      }

      // Draw markers for current view
      renderMarkers(context, canvas.width, canvas.height);

    } catch (error) {
      console.error("Error rendering view:", error);
      toast("Error mostrant la vista");
    }
  };

  const renderMarkers = (context: CanvasRenderingContext2D, canvasWidth: number, canvasHeight: number) => {
    // Colors vius utilitzant variables CSS del sistema de disseny
    const markerColors = [
      '220 98% 61%',  // Blau
      '159 84% 39%',  // Verd
      '32 95% 44%',   // Groc
      '24 95% 53%',   // Taronja
      '0 84% 60%',    // Vermell
      '258 90% 66%',  // Púrpura
      '189 85% 43%',  // Cian
      '84 81% 44%',   // Lima
      '328 86% 70%',  // Rosa
      '239 84% 67%'   // Índigo
    ];
    
    // Marcadors d'origen (vista actual)
    const originMarkers = markers.filter(marker => marker.view === currentView);
    
    originMarkers.forEach((marker) => {
      const x = marker.x * canvasWidth;
      const y = marker.y * canvasHeight;
      
      // Draw vertical line (1cm ≈ 37.8 pixels at 96 DPI)
      const lineHeight = Math.min(37.8, canvasHeight * 0.1);
      const colorHSL = markerColors[marker.colorIndex % markerColors.length];
      
      context.strokeStyle = `hsl(${colorHSL})`;
      context.lineWidth = 3;
      context.beginPath();
      context.moveTo(x, y - lineHeight / 2);
      context.lineTo(x, y + lineHeight / 2);
      context.stroke();
    });

    // Marcadors de destí (marcadors que apunten a la vista actual)
    const targetMarkers = markers.filter(marker => marker.targetView === currentView);
    
    targetMarkers.forEach((marker) => {
      // Trobar l'índex del marcador original per mantenir el mateix color
      // const originalIndex = markers.findIndex(m => m.id === marker.id);
      // const colorHSL = markerColors[originalIndex % markerColors.length];
      const colorHSL = markerColors[marker.colorIndex % markerColors.length];
      
      // Posició del marcador de destí: on va clicar l'usuari
      const x = marker.targetX * canvasWidth;
      const y = marker.targetY * canvasHeight;
      
      // Draw vertical line
      const lineHeight = Math.min(37.8, canvasHeight * 0.1);
      
      context.strokeStyle = `hsl(${colorHSL})`;
      context.lineWidth = 3;
      context.beginPath();
      context.moveTo(x, y - lineHeight / 2);
      context.lineTo(x, y + lineHeight / 2);
      context.stroke();
    });
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
      // Vistes pars (2, 4, 6...): Primera meitat de la següent + segona meitat de l'actual
      // Vista 2: B superior + A inferior
      // Vista 4: C superior + B inferior
      return { 
        topPage: pageIndex + 1, 
        topHalf: 'top' as const, 
        bottomPage: pageIndex, 
        bottomHalf: 'bottom' as const 
      };
    } else {
      // Vistes imparells (3, 5, 7...): Primera meitat de l'actual + segona meitat de l'actual
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

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = e.currentTarget;
    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    
    // Convert to relative coordinates
    const relativeX = clickX / rect.width;
    const relativeY = clickY / rect.height;
    
    // Check if we're in insert mode
    if (insertMode === 'origin') {
      setPendingOrigin({ view: currentView, x: relativeX, y: relativeY });
      setInsertMode('target');
      toast("Marcador d'origen col·locat. Ara clica on vols anar.");
      return;
    }
    
    if (insertMode === 'target' && pendingOrigin) {
      const newMarker: Marker = {
        id: Date.now().toString(),
        view: pendingOrigin.view,
        x: pendingOrigin.x,
        y: pendingOrigin.y,
        targetView: currentView,
        targetX: relativeX,
        targetY: relativeY,
        colorIndex: markers.length
      };
      setMarkers(prev => [...prev, newMarker]);
      setPendingOrigin(null);
      setInsertMode('none');
      toast("Marcador creat correctament!");
      return;
    }
    
    // Check if we clicked on a marker
    const clickedMarker = markers.find(marker => {
      if (marker.view !== currentView) return false;
      
      const markerX = marker.x * rect.width;
      const markerY = marker.y * rect.height;
      const distance = Math.sqrt(Math.pow(clickX - markerX, 2) + Math.pow(clickY - markerY, 2));
      
      return distance <= 20; // 20px clickable radius
    });
    
    if (clickedMarker) {
      setCurrentView(clickedMarker.targetView);
      return;
    }
    
    // Normal navigation
    const isRightHalf = clickX > rect.width / 2;
    if (isRightHalf) {
      goToNextView();
    } else {
      goToPreviousView();
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

  const startMarkerInsertion = () => {
    setInsertMode('origin');
    toast("Clica on vols col·locar el marcador d'origen");
  };

  const cancelMarkerInsertion = () => {
    setInsertMode('none');
    setPendingOrigin(null);
    toast("Inserció de marcador cancel·lada");
  };

  const deleteMarker = (markerId: string) => {
    setMarkers(prev => prev.filter(marker => marker.id !== markerId));
    toast("Marcador eliminat");
  };

  if (!file) return null;

  return (
    <div className="flex h-screen bg-music-surface">
      {/* Floating Menu Button */}
      <Button
        variant="outline"
        size="sm"
        className="fixed top-4 right-4 z-50 shadow-lg"
        onClick={() => setIsMarkersMenuOpen(!isMarkersMenuOpen)}
      >
        {isMarkersMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
      </Button>

      {/* Markers Menu */}
      <div className={`fixed left-0 top-0 h-full w-80 bg-card border-r shadow-lg transition-transform duration-300 z-40 ${
        isMarkersMenuOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <div className="p-4 border-b">
          <h3 className="font-semibold">Marcadors de Repetició</h3>
        </div>
        
        <div className="p-4 space-y-4">
          {/* Insert Marker Button */}
          <div className="space-y-2">
            {insertMode === 'none' ? (
              <Button onClick={startMarkerInsertion} className="w-full">
                <Plus className="h-4 w-4 mr-2" />
                Inserir Marcador
              </Button>
            ) : (
              <div className="space-y-2">
                <div className="text-sm text-muted-foreground">
                  {insertMode === 'origin' ? 'Clica on vols col·locar l\'origen' : 'Clica on vols anar (destí)'}
                </div>
                <Button onClick={cancelMarkerInsertion} variant="outline" className="w-full">
                  Cancel·lar
                </Button>
              </div>
            )}
          </div>

          {/* Markers List */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Marcadors existents:</h4>
            {markers.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hi ha marcadors</p>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {markers.map(marker => (
                  <div key={marker.id} className="flex items-center justify-between p-2 bg-muted rounded">
                    <div className="text-sm">
                      <div>Vista {marker.view} → Vista {marker.targetView}</div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteMarker(marker.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-col flex-1">
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

      {/* Progress Slider */}
      <div className="px-4 py-2 bg-muted/50">
        <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
          <span>{getViewDescription()}</span>
          <span>Vista {currentView} de {getTotalViews()}</span>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={goToPreviousView}
            disabled={currentView <= 1}
            className="h-8 w-8 p-0"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Slider 
            value={[currentView]} 
            onValueChange={(value) => setCurrentView(value[0])}
            max={getTotalViews()} 
            min={1} 
            step={1} 
            className="h-2 flex-1"
          />
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={goToNextView}
            disabled={currentView >= getTotalViews()}
            className="h-8 w-8 p-0"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

        {/* PDF Canvas Container */}
        <div ref={containerRef} className="flex-1 flex items-center justify-center p-4 overflow-auto">
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
      </div>
    </div>
  );
};