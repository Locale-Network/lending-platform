'use client';

import { useState, use } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft,
  FileText,
  Shield,
  Download,
  ExternalLink,
  CheckCircle,
  AlertTriangle,
  Info,
} from 'lucide-react';
import Link from 'next/link';
import useSWR from 'swr';
import { PDFViewer, DocumentCard } from '@/components/documents/pdf-viewer';
import LoadingDots from '@/components/ui/loading-dots';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

// Document type labels for display
const documentTypeLabels: Record<string, string> = {
  PPM: 'Private Placement Memorandum',
  SUBSCRIPTION_AGREEMENT: 'Subscription Agreement',
  OPERATING_AGREEMENT: 'Operating Agreement',
  USE_OF_FUNDS: 'Use of Funds',
  RISK_DISCLOSURE: 'Risk Disclosure',
  INVESTOR_QUESTIONNAIRE: 'Investor Questionnaire',
  ACCREDITATION_VERIFICATION: 'Accreditation Verification',
  FINANCIAL_STATEMENTS: 'Financial Statements',
  LEGAL_OPINION: 'Legal Opinion',
  OTHER: 'Other Documents',
};

interface Document {
  id: string;
  title: string;
  description?: string;
  documentType: string;
  version: string;
  storageProvider: string;
  storageHash: string;
  storageUrl: string;
  fileName: string;
  fileSize: number;
  isRequired: boolean;
  effectiveDate?: string;
  displayOrder: number;
}

export default function PoolDocumentsPage({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = use(params);
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);

  // Fetch pool data
  const { data: pool, isLoading: poolLoading } = useSWR(
    `/api/pools/public/${resolvedParams.slug}`,
    fetcher
  );

  // Fetch documents from API
  const { data: documentsData, isLoading: docsLoading } = useSWR(
    `/api/pools/public/${resolvedParams.slug}/documents`,
    fetcher
  );

  const documents: Document[] = documentsData?.documents || [];
  const isLoading = poolLoading || docsLoading;

  // Group documents by type
  const requiredDocs = documents.filter((d) => d.isRequired);
  const optionalDocs = documents.filter((d) => !d.isRequired);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingDots size="md" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="container max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center gap-4 mb-4">
            <Link href={`/explore/pools/${resolvedParams.slug}`}>
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Pool
              </Button>
            </Link>
          </div>
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Shield className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold">Compliance Documents</h1>
                  <p className="text-muted-foreground">
                    {pool?.name || 'Investment Pool'}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-green-600 border-green-600">
                <CheckCircle className="h-3 w-3 mr-1" />
                SEC Reg D 506(b)
              </Badge>
            </div>
          </div>
        </div>
      </div>

      <div className="container max-w-7xl mx-auto px-4 py-8">
        {/* Important Notice */}
        <Card className="mb-8 border-amber-500/50 bg-amber-500/5">
          <CardContent className="flex items-start gap-4 pt-6">
            <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-amber-700 dark:text-amber-400 mb-1">
                Important Investment Disclosure
              </p>
              <p className="text-muted-foreground">
                Please review all required documents carefully before investing. These documents contain
                important information about investment risks, terms, and conditions. Investment in this
                pool is only available to accredited investors under SEC Regulation D Rule 506(b).
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Empty State */}
        {documents.length === 0 ? (
          <Card className="col-span-full flex flex-col items-center justify-center text-center p-12">
            <FileText className="h-16 w-16 text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Documents Available</h3>
            <p className="text-muted-foreground max-w-md">
              Compliance documents for this pool have not been uploaded yet.
              Please check back later or contact the pool administrator.
            </p>
            <Link href={`/explore/pools/${resolvedParams.slug}`} className="mt-6">
              <Button variant="outline">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Pool
              </Button>
            </Link>
          </Card>
        ) : (
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Document List */}
            <div className="lg:col-span-1 space-y-6">
              {/* All Documents */}
              <div>
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  Documents
                  <Badge variant="secondary">{documents.length}</Badge>
                </h2>
                <div className="space-y-3">
                  {documents.map((doc) => (
                    <DocumentCard
                      key={doc.id}
                      title={doc.title}
                      storageProvider={doc.storageProvider}
                      effectiveDate={doc.effectiveDate}
                      onClick={() => setSelectedDocument(doc)}
                    />
                  ))}
                </div>
              </div>

              {/* Storage Info */}
              <Card className="bg-muted/30">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Document Storage</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground space-y-2">
                  <p>
                    All compliance documents are stored on decentralized networks for
                    transparency and immutability.
                  </p>
                  <div className="flex items-center gap-4 pt-2">
                    <div className="flex items-center gap-1">
                      <span>🌐</span>
                      <span>IPFS</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* PDF Viewer */}
            <div className="lg:col-span-2">
              {selectedDocument ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-xl font-semibold">{selectedDocument.title}</h2>
                      <p className="text-sm text-muted-foreground">
                        Version {selectedDocument.version} •{' '}
                        {documentTypeLabels[selectedDocument.documentType] || selectedDocument.documentType}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" asChild>
                        <a href={selectedDocument.storageUrl} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-4 w-4 mr-2" />
                          Open Original
                        </a>
                      </Button>
                      <Button size="sm" asChild>
                        <a href={selectedDocument.storageUrl} download>
                          <Download className="h-4 w-4 mr-2" />
                          Download
                        </a>
                      </Button>
                    </div>
                  </div>
                  <PDFViewer
                    url={selectedDocument.storageUrl}
                    title={selectedDocument.title}
                    storageUrl={selectedDocument.storageUrl}
                    className="h-[700px]"
                  />
                </div>
              ) : (
                <Card className="h-[700px] flex flex-col items-center justify-center text-center p-8">
                  <FileText className="h-16 w-16 text-muted-foreground/30 mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Select a Document</h3>
                  <p className="text-muted-foreground max-w-md">
                    Choose a document from the list to view it here. All documents are stored on
                    decentralized networks and can be verified independently.
                  </p>
                </Card>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
