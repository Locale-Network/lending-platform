'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Download,
  ExternalLink,
  Maximize2,
  Minimize2,
  FileText,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface PDFViewerProps {
  url: string;
  title?: string;
  storageUrl?: string; // Direct link to IPFS/Arweave
  className?: string;
  onError?: () => void;
}

export function PDFViewer({ url, title, storageUrl, className, onError }: PDFViewerProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hasError, setHasError] = useState(false);

  const handleLoad = useCallback(() => {
    setIsLoading(false);
  }, []);

  const handleError = useCallback(() => {
    setIsLoading(false);
    setHasError(true);
    onError?.();
  }, [onError]);

  const toggleFullscreen = useCallback(() => {
    setIsFullscreen((prev) => !prev);
  }, []);

  const handleDownload = useCallback(() => {
    window.open(storageUrl || url, '_blank');
  }, [storageUrl, url]);

  const handleOpenExternal = useCallback(() => {
    window.open(storageUrl || url, '_blank');
  }, [storageUrl, url]);

  if (hasError) {
    return (
      <Card className={cn('flex flex-col items-center justify-center p-8 text-center', className)}>
        <FileText className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="font-semibold mb-2">Unable to load document</h3>
        <p className="text-sm text-muted-foreground mb-4">
          The PDF viewer encountered an error. You can still access the document directly.
        </p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleOpenExternal}>
            <ExternalLink className="h-4 w-4 mr-2" />
            Open Document
          </Button>
          <Button onClick={handleDownload}>
            <Download className="h-4 w-4 mr-2" />
            Download
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <div
      className={cn(
        'relative flex flex-col bg-muted/30 rounded-xl overflow-hidden',
        isFullscreen && 'fixed inset-0 z-50 rounded-none',
        className
      )}
    >
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-card border-b">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          {title && <span className="text-sm font-medium truncate max-w-[200px]">{title}</span>}
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={handleOpenExternal} title="Open in new tab">
            <ExternalLink className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={handleDownload} title="Download">
            <Download className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={toggleFullscreen} title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}>
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* PDF Embed */}
      <div className="relative flex-1 min-h-[500px]">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-muted/50">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="text-sm text-muted-foreground">Loading document...</span>
            </div>
          </div>
        )}
        <iframe
          src={`${url}#toolbar=0&navpanes=0`}
          className="w-full h-full min-h-[500px]"
          title={title || 'PDF Document'}
          onLoad={handleLoad}
          onError={handleError}
        />
      </div>

      {/* Storage info footer */}
      {storageUrl && (
        <div className="px-4 py-2 bg-card border-t">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Stored on decentralized storage</span>
            <a
              href={storageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 hover:text-foreground transition-colors"
            >
              View on IPFS/Arweave
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

// Simplified document card for list view
interface DocumentCardProps {
  title: string;
  description?: string;
  documentType?: string;
  fileSize?: number;
  storageProvider: string;
  storageUrl?: string;
  isRequired?: boolean;
  effectiveDate?: string;
  onClick?: () => void;
}

export function DocumentCard({
  title,
  storageProvider,
  effectiveDate,
  onClick,
}: DocumentCardProps) {
  const getStorageIcon = (provider: string) => {
    switch (provider) {
      case 'IPFS':
        return '🌐';
      case 'ARWEAVE':
        return '🔷';
      default:
        return '📁';
    }
  };

  return (
    <Card
      className="p-4 hover:border-primary/50 hover:shadow-md transition-all cursor-pointer group"
      onClick={onClick}
    >
      <div className="flex items-center gap-4">
        <div className="p-2.5 rounded-lg bg-primary/10 text-primary flex-shrink-0">
          <FileText className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-medium truncate group-hover:text-primary transition-colors">
            {title}
          </h3>
          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
            {effectiveDate && (
              <span>Effective: {new Date(effectiveDate).toLocaleDateString()}</span>
            )}
            <span className="flex items-center gap-1">
              {getStorageIcon(storageProvider)} {storageProvider}
            </span>
          </div>
        </div>
      </div>
    </Card>
  );
}
