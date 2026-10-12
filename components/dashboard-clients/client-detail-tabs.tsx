'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { ArrowLeft, X, LandPlot, FileText, PlusCircle } from 'lucide-react';
import { ClientDetailProperties } from './client-detail-properties';
import { ClientDetailDocuments } from './client-detail-documents';
import { PropertyAssignmentWizard } from './property-assignment-wizard';
import { useClientDetail } from '@/lib/hooks/use-client-detail';

interface ClientDetailTabsProps {
  assignPropertyId?: string;
}

export function ClientDetailTabs({
  assignPropertyId,
}: ClientDetailTabsProps) {
  const { client } = useClientDetail();
  // Inactive and archived clients keep their records but cannot take new lots.
  const canAssign = client.status === 'Active';
  const [activeTab, setActiveTab] = useState<string>(
    assignPropertyId && canAssign ? 'assign-property' : 'documents'
  );
  const [isAssignTabRevealed, setIsAssignTabRevealed] = useState<boolean>(
    Boolean(assignPropertyId) && canAssign
  );

  function handleOpenAssign() {
    setIsAssignTabRevealed(true);
    setActiveTab('assign-property');
  }

  function handleCloseAssign() {
    setIsAssignTabRevealed(false);
    if (activeTab === 'assign-property') {
      setActiveTab('properties');
    }
  }

  return (
    <Card variant="section" className="h-full">
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="flex min-h-0 flex-1 flex-col"
      >
        <div className="border-b border-border px-6 pt-5">
          <TabsList variant="line">
            <TabsTrigger variant="line" value="documents" className="gap-2">
              <FileText className="h-4 w-4" />
              2. Documents
            </TabsTrigger>
            <TabsTrigger variant="line" value="properties" className="gap-2">
              <LandPlot className="h-4 w-4" />
              3. Assigned lots
            </TabsTrigger>
            {isAssignTabRevealed && (
              <div className="relative flex items-center">
                <TabsTrigger variant="line" value="assign-property" className="gap-2 pr-7">
                  <PlusCircle className="h-4 w-4" />
                  Assign Property
                </TabsTrigger>
                <Button
                  size="icon"
                  variant="ghost"
                  className="absolute right-1 top-2 h-5 w-5 text-muted-foreground hover:text-foreground"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCloseAssign();
                  }}
                  aria-label="Close assign property tab"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            )}
          </TabsList>
          <div className="flex flex-wrap items-center justify-between gap-2 py-3">
            <p className="text-xs leading-relaxed text-muted-foreground">
              {activeTab === 'documents' ? 'Check required documents after verifying the client’s identity and contact details.' : activeTab === 'properties' ? 'Review lot assignments and account clearance before starting a title release.' : 'Select an available lot, confirm ownership details, then review the assignment.'}
            </p>
            {activeTab === 'documents' && <Button variant="quiet" size="sm" onClick={() => setActiveTab('properties')}>Next: assigned lots</Button>}
          </div>
        </div>

        <CardContent className="min-h-0 flex-1 overflow-y-auto p-6">
          <TabsContent value="properties" className="mt-0">
            <ClientDetailProperties onOpenAssignProperty={handleOpenAssign} canAssign={canAssign} />
          </TabsContent>

          <TabsContent value="documents" className="mt-0">
            <ClientDetailDocuments />
          </TabsContent>

          {isAssignTabRevealed && canAssign && (
            <TabsContent value="assign-property" className="mt-0 space-y-4">
              <div className="flex items-center justify-between pb-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                  onClick={handleCloseAssign}
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Back to properties
                </Button>
              </div>
              <PropertyAssignmentWizard
                preSelectedPropertyId={assignPropertyId}
                onSuccess={() => {
                  handleCloseAssign();
                }}
              />
            </TabsContent>
          )}
        </CardContent>
      </Tabs>
    </Card>
  );
}
