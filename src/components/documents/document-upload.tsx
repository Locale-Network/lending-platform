'use client';

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Upload, FileText, X, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

const DOCUMENT_TYPES = [
  { value: 'PPM', label: 'Private Placement Memorandum' },
  { value: 'SUBSCRIPTION_AGREEMENT', label: 'Subscription Agreement' },
  { value: 'OPERATING_AGREEMENT', label: 'Operating Agreement' },
  { value: 'USE_OF_FUNDS', label: 'Use of Funds' },
  { value: 'RISK_DISCLOSURE', label: 'Risk Disclosure' },
  { value: 'INVESTOR_QUESTIONNAIRE', label: 'Investor Questionnaire' },
  { value: 'ACCREDITATION_VERIFICATION', label: 'Accreditation Verification' },
  { value: 'FINANCIAL_STATEMENTS', label: 'Financial Statements' },
  { value: 'LEGAL_OPINION', label: 'Legal Opinion' },
  { value: 'OTHER', label: 'Other' },
];

interface DocumentUploadProps {
  poolId: string;
  onUploadComplete?: (document: UploadedDocument) => void;
  onError?: (error: string) => void;
}

interface UploadedDocument {
  title: string;
  documentType: string;
  effectiveDate: string;
  fileName: string;
  fileSize: number;
  ipfsHash: string;
  ipfsUrl: string;
  supabaseUrl: string;
}

type UploadStatus = 'idle' | 'uploading' | 'success' | 'error';

export function DocumentUpload({ poolId, onUploadComplete, onError }: DocumentUploadProps) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [documentType, setDocumentType] = useState('');
  const [effectiveDate, setEffectiveDate] = useState('');
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      const selectedFile = acceptedFiles[0];
      setFile(selectedFile);
      // Auto-fill title from filename if empty
      if (!title) {
        setTitle(selectedFile.name.replace(/\.pdf$/i, ''));
      }
      setErrorMessage('');
    }
  }, [title]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
    },
    maxSize: 10 * 1024 * 1024, // 10MB
    multiple: false,
    onDropRejected: (rejections) => {
      const error = rejections[0]?.errors[0];
      if (error?.code === 'file-too-large') {
        setErrorMessage('File is too large. Maximum size is 10MB.');
      } else if (error?.code === 'file-invalid-type') {
        setErrorMessage('Invalid file type. Only PDF files are allowed.');
      } else {
        setErrorMessage('File upload failed.');
      }
    },
  });

  const handleUpload = async () => {
    if (!file || !title || !documentType) {
      setErrorMessage('Please fill in all required fields.');
      return;
    }

    setUploadStatus('uploading');
    setErrorMessage('');

    try {
      // Upload file to storage
      const formData = new FormData();
      formData.append('file', file);
      formData.append('poolId', poolId);

      const uploadResponse = await fetch('/api/documents/upload', {
        method: 'POST',
        body: formData,
      });

      if (!uploadResponse.ok) {
        const error = await uploadResponse.json();
        throw new Error(error.error || 'Upload failed');
      }

      const uploadResult = await uploadResponse.json();

      // Save document metadata to database
      const documentData = {
        title,
        documentType,
        version: '1.0',
        storageProvider: 'IPFS',
        storageHash: uploadResult.ipfs.hash,
        storageUrl: uploadResult.ipfs.url,
        fileName: uploadResult.fileName,
        fileSize: uploadResult.fileSize,
        mimeType: uploadResult.mimeType,
        isRequired: false,
        isPublic: true,
        effectiveDate: effectiveDate || undefined,
        supabaseUrl: uploadResult.supabase.url,
        supabasePath: uploadResult.supabase.path,
      };

      const saveResponse = await fetch(`/api/pools/${poolId}/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(documentData),
      });

      if (!saveResponse.ok) {
        const error = await saveResponse.json();
        throw new Error(error.error || 'Failed to save document');
      }

      setUploadStatus('success');

      // Reset form after short delay
      setTimeout(() => {
        setFile(null);
        setTitle('');
        setDocumentType('');
        setEffectiveDate('');
        setUploadStatus('idle');
      }, 2000);

      onUploadComplete?.({
        title,
        documentType,
        effectiveDate,
        fileName: uploadResult.fileName,
        fileSize: uploadResult.fileSize,
        ipfsHash: uploadResult.ipfs.hash,
        ipfsUrl: uploadResult.ipfs.url,
        supabaseUrl: uploadResult.supabase.url,
      });
    } catch (error) {
      console.error('Upload error:', error);
      setUploadStatus('error');
      const message = error instanceof Error ? error.message : 'Upload failed';
      setErrorMessage(message);
      onError?.(message);
    }
  };

  const handleRemoveFile = () => {
    setFile(null);
    setErrorMessage('');
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-6">
      {/* Dropzone */}
      <div
        {...getRootProps()}
        className={cn(
          'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
          isDragActive
            ? 'border-primary bg-primary/5'
            : 'border-muted-foreground/25 hover:border-primary/50',
          file && 'border-solid border-primary/30 bg-primary/5'
        )}
      >
        <input {...getInputProps()} />
        {file ? (
          <div className="flex items-center justify-center gap-4">
            <div className="p-3 rounded-lg bg-primary/10">
              <FileText className="h-8 w-8 text-primary" />
            </div>
            <div className="text-left">
              <p className="font-medium">{file.name}</p>
              <p className="text-sm text-muted-foreground">{formatFileSize(file.size)}</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                handleRemoveFile();
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            <Upload className="h-10 w-10 mx-auto text-muted-foreground" />
            <p className="text-lg font-medium">
              {isDragActive ? 'Drop the file here' : 'Drag & drop a PDF file'}
            </p>
            <p className="text-sm text-muted-foreground">or click to browse (max 10MB)</p>
          </div>
        )}
      </div>

      {/* Document Details */}
      {file && (
        <Card className="p-6 space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="title">Display Name *</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter document title"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="documentType">Document Type *</Label>
              <Select value={documentType} onValueChange={setDocumentType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {DOCUMENT_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="effectiveDate">Effective Date</Label>
            <Input
              id="effectiveDate"
              type="date"
              value={effectiveDate}
              onChange={(e) => setEffectiveDate(e.target.value)}
            />
          </div>

          {/* Error message */}
          {errorMessage && (
            <div className="flex items-center gap-2 text-destructive text-sm">
              <AlertCircle className="h-4 w-4" />
              {errorMessage}
            </div>
          )}

          {/* Upload button */}
          <Button
            onClick={handleUpload}
            disabled={uploadStatus === 'uploading' || !title || !documentType}
            className="w-full"
          >
            {uploadStatus === 'uploading' && (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            )}
            {uploadStatus === 'success' && <CheckCircle className="h-4 w-4 mr-2" />}
            {uploadStatus === 'uploading'
              ? 'Uploading to IPFS...'
              : uploadStatus === 'success'
                ? 'Upload Complete!'
                : 'Upload Document'}
          </Button>
        </Card>
      )}
    </div>
  );
}
