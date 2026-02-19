import React, { useRef, useCallback } from "react";
import { Download, Trash2, ZoomIn, ZoomOut, Upload, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { usePhotoLibrary } from "@/hooks/usePhotoLibrary";
import { usePinchGrid } from "@/hooks/usePinchGrid";
import { cn } from "@/lib/utils";

const PhotoLibrary: React.FC = () => {
  const { photos, addPhotos, removePhoto, downloadPhoto } = usePhotoLibrary();
  const { columns, setColumns, onPinch, MIN_COLUMNS, MAX_COLUMNS } = usePinchGrid(4);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);

  // Touch pinch handling
  const lastDistance = useRef<number | null>(null);

  const getDistance = (t1: React.Touch, t2: React.Touch) =>
    Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length !== 2) return;
      const dist = getDistance(e.touches[0], e.touches[1]);
      if (lastDistance.current !== null) {
        const delta = dist - lastDistance.current;
        onPinch({ delta: [delta / 150, 0], first: false });
      }
      lastDistance.current = dist;
    },
    [onPinch]
  );

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length === 2) {
        lastDistance.current = getDistance(e.touches[0], e.touches[1]);
        onPinch({ delta: [0, 0], first: true });
      }
    },
    [onPinch]
  );

  const handleTouchEnd = useCallback(() => {
    lastDistance.current = null;
  }, []);

  // Wheel zoom (ctrl+scroll or trackpad pinch)
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = -e.deltaY / 200;
        onPinch({ delta: [delta, 0], first: false });
      }
    },
    [onPinch]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer.files.length) addPhotos(e.dataTransfer.files);
    },
    [addPhotos]
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files?.length) {
        addPhotos(e.target.files);
        e.target.value = "";
      }
    },
    [addPhotos]
  );

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <ImageIcon className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-bold tracking-tight text-foreground">Photo Library</h1>
          </div>
          <div className="flex items-center gap-3">
            {/* Grid size controls */}
            <div className="hidden items-center gap-2 sm:flex">
              <ZoomOut className="h-4 w-4 text-muted-foreground" />
              <Slider
                value={[columns]}
                min={MIN_COLUMNS}
                max={MAX_COLUMNS}
                step={1}
                onValueChange={([v]) => setColumns(v)}
                className="w-28"
              />
              <ZoomIn className="h-4 w-4 text-muted-foreground" />
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleFileChange}
            />
            <Button onClick={() => fileInputRef.current?.click()} size="sm">
              <Upload className="mr-1 h-4 w-4" />
              Upload
            </Button>
          </div>
        </div>
      </header>

      {/* Grid area */}
      <main
        ref={gridRef}
        className="flex-1 px-2 py-4"
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onWheel={handleWheel}
      >
        {photos.length === 0 ? (
          <div
            className="mx-auto flex max-w-md flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed border-muted-foreground/25 px-8 py-24 text-center"
            onClick={() => fileInputRef.current?.click()}
            role="button"
            tabIndex={0}
          >
            <Upload className="h-12 w-12 text-muted-foreground/50" />
            <p className="text-lg font-medium text-muted-foreground">
              Drop photos here or click to upload
            </p>
            <p className="text-sm text-muted-foreground/60">
              Pinch or Ctrl+Scroll to change grid size
            </p>
          </div>
        ) : (
          <div
            className="mx-auto max-w-7xl gap-1.5 transition-all duration-200"
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${columns}, 1fr)`,
            }}
          >
            {photos.map((photo) => (
              <div
                key={photo.id}
                className={cn(
                  "group relative aspect-square cursor-pointer overflow-hidden rounded-md bg-muted transition-shadow",
                  selectedId === photo.id && "ring-2 ring-primary ring-offset-2 ring-offset-background"
                )}
                onClick={() => setSelectedId(selectedId === photo.id ? null : photo.id)}
              >
                <img
                  src={photo.url}
                  alt={photo.name}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
                {/* Hover overlay */}
                <div className="absolute inset-0 flex items-end justify-end gap-1 bg-gradient-to-t from-black/50 to-transparent p-2 opacity-0 transition-opacity group-hover:opacity-100">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-white hover:bg-white/20 hover:text-white"
                    onClick={(e) => {
                      e.stopPropagation();
                      downloadPhoto(photo);
                    }}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-white hover:bg-destructive/80 hover:text-white"
                    onClick={(e) => {
                      e.stopPropagation();
                      removePhoto(photo.id);
                      if (selectedId === photo.id) setSelectedId(null);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Footer info */}
      <footer className="border-t bg-background/80 px-4 py-2 text-center text-xs text-muted-foreground backdrop-blur-md">
        {photos.length} photo{photos.length !== 1 && "s"} · Grid: {columns} columns · Pinch or Ctrl+Scroll to resize
      </footer>
    </div>
  );
};

export default PhotoLibrary;
