'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { MapPin, Plus, Loader2, Check, X } from 'lucide-react';
import { US_STATES } from '@/constants/jurisdiction';

type AllowedState = {
  id: string;
  stateCode: string;
  stateName: string;
  isActive: boolean;
  createdAt: string;
};

export default function AllowedStatesPage() {
  const { toast } = useToast();
  const [states, setStates] = useState<AllowedState[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);
  const [selectedNewState, setSelectedNewState] = useState('');

  const loadStates = async () => {
    try {
      const res = await fetch('/api/admin/allowed-states');
      if (res.ok) {
        const data = await res.json();
        setStates(data.states);
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to load states', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStates();
  }, []);

  const handleAdd = async () => {
    if (!selectedNewState) return;
    setAdding(true);
    try {
      const res = await fetch('/api/admin/allowed-states', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stateCode: selectedNewState }),
      });
      if (res.ok) {
        toast({ title: 'State Added', description: `${selectedNewState} is now available.` });
        setSelectedNewState('');
        await loadStates();
      } else {
        const err = await res.json();
        toast({ title: 'Error', description: err.error, variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Network error', variant: 'destructive' });
    } finally {
      setAdding(false);
    }
  };

  const handleToggle = async (stateCode: string, isActive: boolean) => {
    setToggling(stateCode);
    try {
      const res = await fetch('/api/admin/allowed-states', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stateCode, isActive: !isActive }),
      });
      if (res.ok) {
        toast({
          title: isActive ? 'State Deactivated' : 'State Activated',
          description: `${stateCode} has been ${isActive ? 'deactivated' : 'activated'}.`,
        });
        await loadStates();
      } else {
        const err = await res.json();
        toast({ title: 'Error', description: err.error, variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Network error', variant: 'destructive' });
    } finally {
      setToggling(null);
    }
  };

  // States not yet added
  const existingCodes = new Set(states.map((s) => s.stateCode));
  const availableToAdd = US_STATES.filter((s) => !existingCodes.has(s.code));

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Allowed States</h1>
          <p className="text-muted-foreground">Manage which US states can access the platform</p>
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Allowed States</h1>
        <p className="text-muted-foreground">Manage which US states can access the platform</p>
      </div>

      {/* Add new state */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            <CardTitle className="text-lg">Add State</CardTitle>
          </div>
          <CardDescription>Enable a new US state for investor access</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <select
              value={selectedNewState}
              onChange={(e) => setSelectedNewState(e.target.value)}
              className="flex h-10 flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Select a state to add</option>
              {availableToAdd.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.name} ({s.code})
                </option>
              ))}
            </select>
            <Button onClick={handleAdd} disabled={!selectedNewState || adding}>
              {adding ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Plus className="mr-2 h-4 w-4" />
                  Add
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* State list */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            <CardTitle className="text-lg">Active States</CardTitle>
          </div>
          <CardDescription>
            {states.filter((s) => s.isActive).length} active / {states.length} total
          </CardDescription>
        </CardHeader>
        <CardContent>
          {states.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No states configured. Add a state above to get started.
            </p>
          ) : (
            <div className="space-y-2">
              {states.map((state) => (
                <div
                  key={state.stateCode}
                  className={`flex items-center justify-between rounded-lg border p-3 ${
                    state.isActive ? 'bg-background' : 'bg-muted/50 opacity-60'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Badge
                      variant={state.isActive ? 'default' : 'secondary'}
                      className="w-10 justify-center"
                    >
                      {state.stateCode}
                    </Badge>
                    <span className="text-sm font-medium">{state.stateName}</span>
                    {state.isActive ? (
                      <Badge className="bg-green-100 text-green-800 text-xs">Active</Badge>
                    ) : (
                      <Badge variant="secondary" className="text-xs">Inactive</Badge>
                    )}
                  </div>
                  <Button
                    variant={state.isActive ? 'outline' : 'default'}
                    size="sm"
                    onClick={() => handleToggle(state.stateCode, state.isActive)}
                    disabled={toggling === state.stateCode}
                  >
                    {toggling === state.stateCode ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : state.isActive ? (
                      <>
                        <X className="mr-1 h-3 w-3" />
                        Deactivate
                      </>
                    ) : (
                      <>
                        <Check className="mr-1 h-3 w-3" />
                        Activate
                      </>
                    )}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
