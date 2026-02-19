'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import {
  Globe,
  MapPin,
  Check,
  Loader2,
  AlertCircle,
  ChevronLeft,
  ShieldCheck,
  Info,
} from 'lucide-react';
import {
  ACCREDITATION_METHODS,
  COUNTRIES,
  BLOCKED_COUNTRIES,
  REG_S_CERTIFICATIONS,
  REG_S_CERTIFICATION_KEYS,
  RULE_902K_TEXT,
  type RegSCertificationKey,
} from '@/constants/jurisdiction';

type AllowedState = { stateCode: string; stateName: string };

type JurisdictionStatus = {
  jurisdictionType: string | null;
  jurisdictionCountry: string | null;
  jurisdictionState: string | null;
  jurisdictionCertifiedAt: string | null;
  accreditationMethod: string | null;
  regSCertifications: unknown;
};

type Screen = 'select-type' | 'us-flow' | 'non-us-flow' | 'complete';

interface JurisdictionGateProps {
  status: JurisdictionStatus;
  onComplete: () => void;
}

export default function JurisdictionGate({ status, onComplete }: JurisdictionGateProps) {
  // If already certified, show the completion screen
  const initialScreen: Screen = status.jurisdictionCertifiedAt ? 'complete' : 'select-type';

  const [screen, setScreen] = useState<Screen>(initialScreen);
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  // US flow state
  const [allowedStates, setAllowedStates] = useState<AllowedState[]>([]);
  const [loadingStates, setLoadingStates] = useState(false);
  const [selectedState, setSelectedState] = useState<string>('');
  const [selectedMethod, setSelectedMethod] = useState<string>('');
  const [usCertifyChecked, setUsCertifyChecked] = useState(false);

  // Non-US flow state
  const [selectedCountry, setSelectedCountry] = useState<string>('');
  const [regSChecked, setRegSChecked] = useState<Record<RegSCertificationKey, boolean>>({
    non_us_person: false,
    offshore_transaction: false,
    no_resale_us: false,
    local_law_compliance: false,
  });
  const [showRule902k, setShowRule902k] = useState(false);

  // Load allowed states when entering US flow
  useEffect(() => {
    if (screen === 'us-flow' && allowedStates.length === 0) {
      setLoadingStates(true);
      fetch('/api/allowed-states')
        .then((r) => r.json())
        .then((data) => setAllowedStates(data.states || []))
        .catch(() => toast({ title: 'Error', description: 'Failed to load states', variant: 'destructive' }))
        .finally(() => setLoadingStates(false));
    }
  }, [screen, allowedStates.length, toast]);

  const handleUSSubmit = async () => {
    if (!selectedState || !selectedMethod || !usCertifyChecked) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/investor/accreditation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jurisdictionType: 'US_PERSON',
          state: selectedState,
          method: selectedMethod,
        }),
      });
      if (res.ok) {
        setScreen('complete');
        onComplete();
        toast({ title: 'Jurisdiction Verified', description: 'Your US investor status has been certified.' });
      } else {
        const err = await res.json();
        toast({ title: 'Error', description: err.error || 'Certification failed', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Network error', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleNonUSSubmit = async () => {
    const allChecked = REG_S_CERTIFICATION_KEYS.every((k) => regSChecked[k]);
    if (!selectedCountry || !allChecked) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/investor/accreditation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jurisdictionType: 'NON_US_PERSON',
          country: selectedCountry,
          regSCertifications: REG_S_CERTIFICATION_KEYS,
        }),
      });
      if (res.ok) {
        setScreen('complete');
        onComplete();
        toast({ title: 'Jurisdiction Verified', description: 'Your Reg S certification is complete.' });
      } else {
        const err = await res.json();
        toast({ title: 'Error', description: err.error || 'Certification failed', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Network error', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const nonUsCountries = COUNTRIES.filter(
    (c) => c.code !== 'US' && !(BLOCKED_COUNTRIES as readonly string[]).includes(c.code)
  );

  // ── Screen 1: Select jurisdiction type ────────────────────────────
  if (screen === 'select-type') {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            <CardTitle>Jurisdiction Verification</CardTitle>
          </div>
          <CardDescription>
            Select your investor jurisdiction to proceed with compliance verification.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
            <div className="flex items-start gap-3">
              <Info className="h-5 w-5 text-blue-600 mt-0.5" />
              <p className="text-sm text-blue-800">
                U.S. investors must comply with SEC Regulation D 506(b). Non-U.S. investors
                must comply with SEC Regulation S for offshore transactions.
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <button
              onClick={() => setScreen('us-flow')}
              className="flex flex-col items-center gap-3 rounded-lg border-2 border-border p-6 transition-colors hover:border-primary hover:bg-primary/5"
            >
              <MapPin className="h-8 w-8 text-primary" />
              <div className="text-center">
                <p className="font-semibold">U.S. Person</p>
                <p className="text-xs text-muted-foreground mt-1">
                  I reside in the United States
                </p>
              </div>
            </button>

            <button
              onClick={() => setScreen('non-us-flow')}
              className="flex flex-col items-center gap-3 rounded-lg border-2 border-border p-6 transition-colors hover:border-primary hover:bg-primary/5"
            >
              <Globe className="h-8 w-8 text-primary" />
              <div className="text-center">
                <p className="font-semibold">Non-U.S. Person</p>
                <p className="text-xs text-muted-foreground mt-1">
                  I reside outside the United States
                </p>
              </div>
            </button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // ── Screen 2a: US flow — state + accreditation ────────────────────
  if (screen === 'us-flow') {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => setScreen('select-type')}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <MapPin className="h-5 w-5" />
            <CardTitle>U.S. Investor Verification</CardTitle>
          </div>
          <CardDescription>
            Reg D 506(b) — Select your state and certify accreditation status.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* State selection */}
          <div className="space-y-2">
            <Label htmlFor="state-select">State of Residence</Label>
            {loadingStates ? (
              <div className="flex items-center gap-2 h-10">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm text-muted-foreground">Loading available states...</span>
              </div>
            ) : allowedStates.length === 0 ? (
              <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3">
                <p className="text-sm text-yellow-800">
                  No states are currently available. Please check back later.
                </p>
              </div>
            ) : (
              <select
                id="state-select"
                value={selectedState}
                onChange={(e) => setSelectedState(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Select your state</option>
                {allowedStates.map((s) => (
                  <option key={s.stateCode} value={s.stateCode}>
                    {s.stateName}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Accreditation method */}
          <div className="space-y-3">
            <Label>Accreditation Basis</Label>
            <div className="space-y-2">
              {ACCREDITATION_METHODS.map((method) => (
                <label
                  key={method.value}
                  className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                    selectedMethod === method.value
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <input
                    type="radio"
                    name="accreditation"
                    value={method.value}
                    checked={selectedMethod === method.value}
                    onChange={() => setSelectedMethod(method.value)}
                    className="mt-1"
                  />
                  <div>
                    <span className="text-sm font-medium">{method.label}</span>
                    <p className="text-xs text-muted-foreground mt-0.5">{method.description}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Certification checkbox */}
          <label className="flex items-start gap-2 rounded-lg border border-border p-3 cursor-pointer">
            <input
              type="checkbox"
              checked={usCertifyChecked}
              onChange={(e) => setUsCertifyChecked(e.target.checked)}
              className="mt-0.5"
            />
            <span className="text-xs text-muted-foreground">
              I certify under penalty of law that the information provided above is true and accurate
              to the best of my knowledge.
            </span>
          </label>

          <Button
            onClick={handleUSSubmit}
            disabled={!selectedState || !selectedMethod || !usCertifyChecked || submitting}
            className="w-full"
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Submitting...
              </>
            ) : (
              'Certify & Continue'
            )}
          </Button>
        </CardContent>
      </Card>
    );
  }

  // ── Screen 2b: Non-US flow — country + Reg S certs ────────────────
  if (screen === 'non-us-flow') {
    const allRegSChecked = REG_S_CERTIFICATION_KEYS.every((k) => regSChecked[k]);

    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => setScreen('select-type')}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Globe className="h-5 w-5" />
            <CardTitle>Non-U.S. Investor Verification</CardTitle>
          </div>
          <CardDescription>
            Regulation S — Certify your offshore investor status.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Country selection */}
          <div className="space-y-2">
            <Label htmlFor="country-select">Country of Residence</Label>
            <select
              id="country-select"
              value={selectedCountry}
              onChange={(e) => setSelectedCountry(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Select your country</option>
              {nonUsCountries.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Rule 902(k) toggle */}
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
            <button
              onClick={() => setShowRule902k(!showRule902k)}
              className="flex items-center gap-2 text-sm text-blue-800 font-medium w-full"
            >
              <Info className="h-4 w-4" />
              What is a &quot;U.S. Person&quot; under Rule 902(k)?
              <ChevronLeft className={`h-4 w-4 ml-auto transition-transform ${showRule902k ? '-rotate-90' : ''}`} />
            </button>
            {showRule902k && (
              <p className="text-xs text-blue-700 mt-2 whitespace-pre-line">{RULE_902K_TEXT}</p>
            )}
          </div>

          {/* Reg S certifications */}
          <div className="space-y-3">
            <Label>Required Certifications</Label>
            <div className="space-y-2">
              {REG_S_CERTIFICATION_KEYS.map((key) => {
                const cert = REG_S_CERTIFICATIONS[key];
                return (
                  <label
                    key={key}
                    className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                      regSChecked[key]
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={regSChecked[key]}
                      onChange={(e) =>
                        setRegSChecked((prev) => ({ ...prev, [key]: e.target.checked }))
                      }
                      className="mt-0.5"
                    />
                    <div>
                      <span className="text-sm font-medium">{cert.label}</span>
                      <p className="text-xs text-muted-foreground mt-0.5">{cert.text}</p>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          <Button
            onClick={handleNonUSSubmit}
            disabled={!selectedCountry || !allRegSChecked || submitting}
            className="w-full"
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Submitting...
              </>
            ) : (
              'Certify & Continue'
            )}
          </Button>
        </CardContent>
      </Card>
    );
  }

  // ── Screen 3: Complete ────────────────────────────────────────────
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-green-600" />
          <CardTitle>Jurisdiction Verified</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-lg border border-green-200 bg-green-50 p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
              <Check className="h-5 w-5 text-green-600" />
            </div>
            <div className="flex-1 space-y-2">
              <h4 className="text-sm font-semibold text-green-900">Certification Complete</h4>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary" className="text-xs">
                  {status.jurisdictionType === 'US_PERSON' ? 'U.S. Person' : 'Non-U.S. Person'}
                </Badge>
                {status.jurisdictionType === 'US_PERSON' && status.jurisdictionState && (
                  <Badge variant="secondary" className="text-xs">
                    {status.jurisdictionState}
                  </Badge>
                )}
                {status.jurisdictionType === 'NON_US_PERSON' && status.jurisdictionCountry && (
                  <Badge variant="secondary" className="text-xs">
                    {COUNTRIES.find((c) => c.code === status.jurisdictionCountry)?.name ||
                      status.jurisdictionCountry}
                  </Badge>
                )}
                {status.accreditationMethod && (
                  <Badge variant="secondary" className="text-xs">
                    {status.jurisdictionType === 'US_PERSON'
                      ? ACCREDITATION_METHODS.find((m) => m.value === status.accreditationMethod)?.label ||
                        status.accreditationMethod
                      : 'Reg S'}
                  </Badge>
                )}
              </div>
              {status.jurisdictionCertifiedAt && (
                <p className="text-xs text-green-700">
                  Certified {new Date(status.jurisdictionCertifiedAt).toLocaleDateString()}
                </p>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
