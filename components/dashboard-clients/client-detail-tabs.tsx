'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { ArrowLeft, X, LandPlot, FileText, PlusCircle } from 'lucide-react';
import { ClientDetailProperties } from './client-detail-properties';
import { ClientDetailDocuments } from './client-detail-documents';
import { PropertyAssignmentWizard } from './property-assignment-wizard';

interface ClientDetailTabsProps {
  assignPropertyId?: string;
}

export function ClientDetailTabs({
  assignPropertyId,
}: ClientDetailTabsProps) {
  const [activeTab, setActiveTab] = useState<string>(
    assignPropertyId ? 'assign-property' : 'properties'
  );
  const [isAssignTabRevealed, setIsAssignTabRevealed] = useState<boolean>(
    Boolean(assignPropertyId)
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
            <TabsTrigger variant="line" value="properties" className="gap-2">
              <LandPlot className="h-4 w-4" />
              Property Lots
            </TabsTrigger>
            <TabsTrigger variant="line" value="documents" className="gap-2">
              <FileText className="h-4 w-4" />
              Documents
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
        </div>

        <CardContent className="min-h-0 flex-1 overflow-y-auto p-6">
          <TabsContent value="properties" className="mt-0">
            <ClientDetailProperties onOpenAssignProperty={handleOpenAssign} />
          </TabsContent>

          <TabsContent value="documents" className="mt-0">
            <ClientDetailDocuments />
          </TabsContent>

          {isAssignTabRevealed && (
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
