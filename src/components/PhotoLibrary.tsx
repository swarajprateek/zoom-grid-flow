import React, { useRef, useCallback, useState } from "react";
import { Download, Trash2, Upload, Image as ImageIcon, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePhotoLibrary, Photo } from "@/hooks/usePhotoLibrary";
import { usePinchGrid, SIZE_PRESETS } from "@/hooks/usePinchGrid";
import { cn } from "@/lib/utils";

const PhotoLibrary: React.FC = () => {
  const { photos, addPhotos, removePhoto, downloadPhoto } = usePhotoLibrary();
  const { columns, presetIndex, currentPreset, setPresetByIndex, onPinch } = usePinchGrid(1);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const [viewingPhoto, setViewingPhoto] = useState<Photo | null>(null);
  const [showSizeIndicator, setShowSizeIndicator] = useState(false);
  const indicatorTimeout = useRef<ReturnType<typeof setTimeout>>();

  // Show size indicator briefly on pinch/scroll zoom
  const flashIndicator = useCallback(() => {
    setShowSizeIndicator(true);
    clearTimeout(indicatorTimeout.current);
    indicatorTimeout.current = setTimeout(() => setShowSizeIndicator(false), 1200);
  }, []);

  // Touch pinch handling
  const lastDistance = useRef<number | null>(null);
  const prevPresetIndex = useRef(presetIndex);

  React.useEffect(() => {
    if (prevPresetIndex.current !== presetIndex) {
      flashIndicator();
      prevPresetIndex.current = presetIndex;
    }
  }, [presetIndex, flashIndicator]);

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
            {/* 4 size preset buttons */}
            <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/50 p-1">
              {SIZE_PRESETS.map((preset, idx) => (
                <button
                  key={preset.label}
                  onClick={() => setPresetByIndex(idx)}
                  className={cn(
                    "rounded-md px-2.5 py-1 text-xs font-medium transition-all",
                    presetIndex === idx
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  )}
                >
                  {preset.label}
                </button>
              ))}
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

      {/* Floating size indicator on pinch/scroll */}
      <div
        className={cn(
          "fixed left-1/2 top-20 z-50 -translate-x-1/2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-lg transition-all duration-300",
          showSizeIndicator ? "opacity-100 scale-100" : "opacity-0 scale-90 pointer-events-none"
        )}
      >
        {currentPreset.label} · {columns} columns
      </div>

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
                className="group relative aspect-square cursor-pointer overflow-hidden rounded-md bg-muted transition-shadow"
                onClick={() => setViewingPhoto(photo)}
              >
                <img
                  src={photo.thumbnailUrl}
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

      {/* Full-quality lightbox */}
      {viewingPhoto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => setViewingPhoto(null)}
        >
          <div className="absolute right-4 top-4 flex gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 text-white hover:bg-white/20 hover:text-white"
              onClick={(e) => {
                e.stopPropagation();
                downloadPhoto(viewingPhoto);
              }}
            >
              <Download className="h-5 w-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 text-white hover:bg-white/20 hover:text-white"
              onClick={() => setViewingPhoto(null)}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
          <img
            src={viewingPhoto.url}
            alt={viewingPhoto.name}
            className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
          <p className="absolute bottom-6 text-sm text-white/70">{viewingPhoto.name}</p>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t bg-background/80 px-4 py-2 text-center text-xs text-muted-foreground backdrop-blur-md">
        {photos.length} photo{photos.length !== 1 && "s"} · View: {currentPreset.label} ({columns} col) · Pinch or Ctrl+Scroll to resize
      </footer>
    </div>
  );
};

export default PhotoLibrary;
