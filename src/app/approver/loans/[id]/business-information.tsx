'use client';

import { LoanApplication } from '@prisma/client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, MapPin, Calendar, Briefcase, Globe, Hash, InfoIcon } from 'lucide-react';

interface Props {
  business?: LoanApplication;
}

export default function BusinessInformation({ business }: Props) {
  return (
    <Card className="mx-auto w-full max-w-2xl">
      <CardHeader>
        <CardTitle className="text-xl font-bold sm:text-2xl">
          {business?.businessLegalName ?? 'loading...'}
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex items-start space-x-2">
            <MapPin className="mt-1 h-4 w-4 flex-shrink-0 text-muted-foreground" />
            <span className="text-xs sm:text-sm">
              {business?.businessAddress}, {business?.businessCity}, {business?.businessState}{' '}
              {business?.businessZipCode}
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <Hash className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
            <span className="text-xs sm:text-sm">EIN: {business?.ein ?? 'loading...'}</span>
          </div>
          <div className="flex items-center space-x-2">
            <Calendar className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
            <span className="text-xs sm:text-sm">
              Founded: {business?.businessFoundedYear || 'N/A'}
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <Building2 className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
            <span className="text-xs sm:text-sm">
              {business?.businessLegalStructure ?? 'loading...'}
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <Globe className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
            {business?.businessWebsite ? (
              <a
                href={business?.businessWebsite ?? ''}
                target="_blank"
                rel="noopener noreferrer"
                className="block max-w-[200px] truncate text-xs text-blue-600 hover:underline sm:text-sm"
              >
                {business?.businessWebsite ?? 'loading...'}
              </a>
            ) : (
              <span className="text-xs sm:text-sm">N/A</span>
            )}
          </div>
          <div className="flex items-center space-x-2">
            <Briefcase className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
            <span className="text-xs sm:text-sm">
              {business?.businessPrimaryIndustry ?? 'loading...'}
            </span>
          </div>
        </div>
        <div className="flex items-start space-x-2">
          <InfoIcon className="mt-1 h-4 w-4 flex-shrink-0 text-muted-foreground" />
          <p className="text-xs sm:text-sm">{business?.businessDescription ?? 'loading...'}</p>
        </div>
      </CardContent>
    </Card>
  );
}
