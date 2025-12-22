'use client';

import { use, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ArrowLeft, FileText, Trash2, ExternalLink, Plus, Loader2 } from 'lucide-react';
import Link from 'next/link';
import useSWR, { mutate } from 'swr';
import { DocumentUpload } from '@/components/documents/document-upload';
import LoadingDots from '@/components/ui/loading-dots';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface Document {
  id: string;
  title: string;
  documentType: string;
  version: string;
  storageProvider: string;
  storageUrl: string;
  fileName: string;
  fileSize: number;
  isRequired: boolean;
  isPublic: boolean;
  effectiveDate: string | null;
  createdAt: string;
}

interface Pool {
  id: string;
  name: string;
  slug: string;
}

const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  PPM: 'Private Placement Memorandum',
  SUBSCRIPTION_AGREEMENT: 'Subscription Agreement',
  OPERATING_AGREEMENT: 'Operating Agreement',
  USE_OF_FUNDS: 'Use of Funds',
  RISK_DISCLOSURE: 'Risk Disclosure',
  INVESTOR_QUESTIONNAIRE: 'Investor Questionnaire',
  ACCREDITATION_VERIFICATION: 'Accreditation Verification',
  FINANCIAL_STATEMENTS: 'Financial Statements',
  LEGAL_OPINION: 'Legal Opinion',
  OTHER: 'Other',
};

export default function PoolDocumentsManagementPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const poolId = resolvedParams.id;

  const [showUpload, setShowUpload] = useState(false);
  const [deleteDocId, setDeleteDocId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Fetch pool data
  const { data: poolData, isLoading: poolLoading } = useSWR<{ pool: Pool }>(
    `/api/pools/${poolId}`,
    fetcher
  );

  // Fetch documents
  const { data: docsData, isLoading: docsLoading } = useSWR<{ documents: Document[] }>(
    `/api/pools/${poolId}/documents`,
    fetcher
  );

  const pool = poolData?.pool;
  const documents = docsData?.documents || [];
  const isLoading = poolLoading || docsLoading;

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleUploadComplete = () => {
    // Refresh document list
    mutate(`/api/pools/${poolId}/documents`);
    setShowUpload(false);
  };

  const handleDelete = async () => {
    if (!deleteDocId) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/pools/${poolId}/documents/${deleteDocId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete document');
      }

      // Refresh document list
      mutate(`/api/pools/${poolId}/documents`);
    } catch (error) {
      console.error('Delete error:', error);
    } finally {
      setIsDeleting(false);
      setDeleteDocId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingDots size="md" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href={`/admin/pools/${poolId}`}>
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Pool
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Compliance Documents</h1>
            <p className="text-muted-foreground">{pool?.name}</p>
          </div>
        </div>
        <Button onClick={() => setShowUpload(!showUpload)}>
          <Plus className="h-4 w-4 mr-2" />
          {showUpload ? 'Cancel' : 'Add Document'}
        </Button>
      </div>

      {/* Upload Section */}
      {showUpload && (
        <Card>
          <CardHeader>
            <CardTitle>Upload New Document</CardTitle>
            <CardDescription>
              Upload a PDF document to IPFS. Documents are stored on decentralized storage for
              transparency and immutability.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DocumentUpload poolId={poolId} onUploadComplete={handleUploadComplete} />
          </CardContent>
        </Card>
      )}

      {/* Documents Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Documents
            <Badge variant="secondary">{documents.length}</Badge>
          </CardTitle>
          <CardDescription>
            Manage compliance documents for this investment pool.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {documents.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p className="text-lg font-medium mb-2">No documents uploaded yet</p>
              <p className="text-sm mb-4">
                Upload compliance documents to make them available to investors.
              </p>
              <Button onClick={() => setShowUpload(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Upload First Document
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Document</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Effective Date</TableHead>
                  <TableHead>Storage</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {documents.map((doc) => (
                  <TableRow key={doc.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded bg-primary/10">
                          <FileText className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">{doc.title}</p>
                          <p className="text-xs text-muted-foreground">{doc.fileName}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {DOCUMENT_TYPE_LABELS[doc.documentType] || doc.documentType}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {doc.effectiveDate
                        ? new Date(doc.effectiveDate).toLocaleDateString()
                        : '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {doc.storageProvider === 'IPFS' ? '🌐' : '🔷'} {doc.storageProvider}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatFileSize(doc.fileSize)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="ghost" size="icon" asChild>
                          <a
                            href={doc.storageUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="View on IPFS"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteDocId(doc.id)}
                          title="Delete document"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Public Documents Link */}
      {pool && documents.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Public Documents Page</p>
                <p className="text-sm text-muted-foreground">
                  View how investors will see your compliance documents.
                </p>
              </div>
              <Button variant="outline" asChild>
                <Link href={`/explore/pools/${pool.slug}/documents`} target="_blank">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  View Public Page
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteDocId} onOpenChange={() => setDeleteDocId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Document</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this document? This will remove the document from the
              database and unpin it from IPFS. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
