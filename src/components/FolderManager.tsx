import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter
} from '@/components/ui/dialog';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { 
  Folder, 
  FolderPlus, 
  MoreVertical, 
  Edit, 
  Trash2, 
  ChevronDown, 
  ChevronRight,
  Music,
  ChevronUp,
  X
} from 'lucide-react';
import { toast } from 'sonner';

interface StoredFolder {
  id: string;
  name: string;
  createdAt: number;
  order: number;
}

interface FolderManagerProps {
  folders: StoredFolder[];
  onCreateFolder: (name: string) => void;
  onUpdateFolder: (id: string, name: string) => void;
  onDeleteFolder: (id: string) => void;
  expandedFolders: Set<string>;
  onToggleFolder: (folderId: string) => void;
  uploadedFiles: File[];
  onFilePlay: (file: File) => void;
  onMoveFileUp: (index: number) => void;
  onMoveFileDown: (index: number) => void;
  onRemoveFile: (index: number) => void;
  onMoveFileToFolder: (file: File, targetFolderId?: string) => void;
}

export const FolderManager: React.FC<FolderManagerProps> = ({
  folders,
  onCreateFolder,
  onUpdateFolder,
  onDeleteFolder,
  expandedFolders,
  onToggleFolder,
  uploadedFiles,
  onFilePlay,
  onMoveFileUp,
  onMoveFileDown,
  onRemoveFile,
  onMoveFileToFolder
}) => {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingFolder, setEditingFolder] = useState<StoredFolder | null>(null);
  const [newFolderName, setNewFolderName] = useState('');
  const [editFolderName, setEditFolderName] = useState('');

  const [draggedFile, setDraggedFile] = useState<File | null>(null);

  // Get files by folder
  const getFilesByFolder = (folderId: string | undefined) => {
    return uploadedFiles.filter(file => (file as any).folderId === folderId);
  };

  const handleCreateFolder = () => {
    if (newFolderName.trim()) {
      onCreateFolder(newFolderName.trim());
      setNewFolderName('');
      setIsCreateDialogOpen(false);
      toast.success('Carpeta creada correctament');
    }
  };

  const handleEditFolder = (folder: StoredFolder) => {
    setEditingFolder(folder);
    setEditFolderName(folder.name);
  };

  const handleUpdateFolder = () => {
    if (editingFolder && editFolderName.trim()) {
      onUpdateFolder(editingFolder.id, editFolderName.trim());
      setEditingFolder(null);
      setEditFolderName('');
      toast.success('Carpeta actualitzada');
    }
  };

  const handleDeleteFolder = (folder: StoredFolder) => {
    if (confirm(`Estàs segur que vols eliminar la carpeta "${folder.name}"? Les partitures es mouran a l'arrel.`)) {
      onDeleteFolder(folder.id);
      toast.success('Carpeta eliminada');
    }
  };

  const handleDragStart = (file: File) => {
    setDraggedFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, targetFolderId?: string) => {
    e.preventDefault();
    if (draggedFile) {
      onMoveFileToFolder(draggedFile, targetFolderId);
      setDraggedFile(null);
    }
  };

  const renderFileItem = (file: File, folderId?: string) => {
    const allFiles = uploadedFiles;
    const index = allFiles.findIndex(f => 
      f.name === file.name && f.size === file.size && f.lastModified === file.lastModified
    );
    
    return (
      <div 
        key={`${file.name}-${file.size}-${file.lastModified}`}
        className="flex items-center gap-3 p-4 rounded-lg bg-muted/50 hover:bg-muted/70 transition-colors cursor-move"
        draggable
        onDragStart={() => handleDragStart(file)}
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
            onClick={() => onMoveFileUp(index)}
            disabled={index === 0}
            className="h-6 w-6 p-0"
          >
            <ChevronUp className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onMoveFileDown(index)}
            disabled={index === uploadedFiles.length - 1}
            className="h-6 w-6 p-0"
          >
            <ChevronDown className="h-3 w-3" />
          </Button>
        </div>

        {/* Folder Selector */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <Folder className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="z-50 bg-popover border shadow-lg">
            <DropdownMenuItem 
              onClick={() => onMoveFileToFolder(file, undefined)}
              className={!(file as any).folderId ? 'bg-accent' : ''}
            >
              📁 Sense carpeta
            </DropdownMenuItem>
            {folders.map(folder => (
              <DropdownMenuItem 
                key={folder.id}
                onClick={() => onMoveFileToFolder(file, folder.id)}
                className={(file as any).folderId === folder.id ? 'bg-accent' : ''}
              >
                📁 {folder.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Play Button */}
        <Button 
          variant="default" 
          size="sm"
          onClick={() => onFilePlay(file)}
        >
          Tocar
        </Button>

        {/* Delete Button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onRemoveFile(index)}
          className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 ml-2"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Create Folder Button */}
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Les meves Partitures</h2>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <FolderPlus className="h-4 w-4 mr-2" />
              Nova Carpeta
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Crear Nova Carpeta</DialogTitle>
            </DialogHeader>
            <Input
              placeholder="Nom de la carpeta..."
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleCreateFolder()}
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                Cancel·lar
              </Button>
              <Button onClick={handleCreateFolder} disabled={!newFolderName.trim()}>
                Crear
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Folders List */}
      <div className="space-y-2">
        {folders.map((folder) => {
          const isExpanded = expandedFolders.has(folder.id);
          const folderFiles = getFilesByFolder(folder.id);
          
          return (
            <div key={folder.id} className="border rounded-lg bg-card">
              {/* Folder Header */}
              <div 
                className="flex items-center justify-between p-3 hover:bg-muted/50 transition-colors"
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, folder.id)}
              >
                <div className="flex items-center gap-2 flex-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={() => onToggleFolder(folder.id)}
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </Button>
                  <Folder className="h-5 w-5 text-primary" />
                  {editingFolder?.id === folder.id ? (
                    <div className="flex items-center gap-2 flex-1">
                      <Input
                        value={editFolderName}
                        onChange={(e) => setEditFolderName(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleUpdateFolder()}
                        className="h-8"
                        autoFocus
                      />
                      <Button size="sm" onClick={handleUpdateFolder}>
                        Desar
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => setEditingFolder(null)}
                      >
                        Cancel·lar
                      </Button>
                    </div>
                  ) : (
                    <span 
                      className="font-medium flex-1 cursor-pointer"
                      onClick={() => onToggleFolder(folder.id)}
                    >
                      {folder.name} ({folderFiles.length})
                    </span>
                  )}
                </div>
                
                {editingFolder?.id !== folder.id && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="z-50 bg-popover border shadow-lg">
                      <DropdownMenuItem onClick={() => handleEditFolder(folder)}>
                        <Edit className="h-4 w-4 mr-2" />
                        Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => handleDeleteFolder(folder)}
                        className="text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Eliminar
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
              
              {/* Folder Content */}
              {isExpanded && (
                <div className="px-3 pb-3 pl-8">
                  {folderFiles.length === 0 ? (
                    <div 
                      className="text-sm text-muted-foreground py-4 px-2 border-2 border-dashed border-muted rounded-lg text-center"
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, folder.id)}
                    >
                      Arrossega partitures aquí o no hi ha partitures en aquesta carpeta
                    </div>
                  ) : (
                    <div className="grid gap-3">
                      {folderFiles.map(file => renderFileItem(file, folder.id))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
        
        {/* Root Files (no folder) */}
        <div className="space-y-2">
          <div 
            className="text-sm font-medium text-muted-foreground px-2 py-2 border-2 border-dashed border-muted rounded-lg"
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, undefined)}
          >
            Partitures sense carpeta (arrossega aquí per treure de carpetes)
          </div>
          <div className="pl-2">
            {getFilesByFolder(undefined).length === 0 ? (
              <div className="text-sm text-muted-foreground py-4 px-2 text-center">
                No hi ha partitures sense carpeta
              </div>
            ) : (
              <div className="grid gap-3">
                {getFilesByFolder(undefined).map(file => renderFileItem(file, undefined))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};