'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { FilePicker } from '@/components/ui/file-picker';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Upload, Loader2, Folder } from 'lucide-react';
import {
  DOC_TYPES,
  DOC_TYPE_LABEL,
  PERSONAL_DOC_TYPES,
  PROPERTY_DOC_TYPES,
  type StandardDocType,
} from '@/lib/types/client';
import { DOCUMENT_FILE_ACCEPT, MAX_DOCUMENT_BYTES } from '@/lib/validations/document';

const CUSTOM_TYPE_VALUE = '__custom__';

export interface TargetFolderInfo {
  propertyId: string | null;
  label: string;
  sublabel?: string;
}

interface ClientDocumentUploadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetFolder: TargetFolderInfo | null;
  initialType?: string;
  onUpload: (file: File, documentType: string, propertyId: string | null) => Promise<void>;
}

export function ClientDocumentUploadModal({
  open,
  onOpenChange,
  targetFolder,
  initialType = '',
  onUpload,
}: ClientDocumentUploadModalProps) {
  const [selectedType, setSelectedType] = useState<string>('');
  const [customTypeName, setCustomTypeName] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);

  useEffect(() => {
    if (!open) return;
    if (initialType === CUSTOM_TYPE_VALUE || initialType === 'custom') {
      setSelectedType(CUSTOM_TYPE_VALUE);
      setCustomTypeName('');
    } else if (DOC_TYPES.includes(initialType as StandardDocType)) {
      setSelectedType(initialType);
      setCustomTypeName('');
    } else if (initialType.trim().length > 0) {
      setSelectedType(CUSTOM_TYPE_VALUE);
      setCustomTypeName(initialType);
    } else {
      setSelectedType('');
      setCustomTypeName('');
    }
    setSelectedFile(null);
  }, [open, initialType]);

  const isPersonal = targetFolder?.propertyId === null;
  const availableTypes = isPersonal ? PERSONAL_DOC_TYPES : PROPERTY_DOC_TYPES;
  const isCustom = selectedType === CUSTOM_TYPE_VALUE;
  const finalType = isCustom ? customTypeName.trim() : selectedType;
  const isSubmitDisabled = isUploading || !selectedFile || !finalType;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isSubmitDisabled || !targetFolder) return;

    setIsUploading(true);
    try {
      await onUpload(selectedFile, finalType, targetFolder.propertyId);
      onOpenChange(false);
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-4 w-4 text-primary" />
            Upload Document
          </DialogTitle>
          <DialogDescription>
            {targetFolder ? (
              <span className="inline-flex items-center gap-1.5 pt-1 text-xs text-foreground">
                <Folder className="h-3.5 w-3.5 text-muted-foreground" />
                <span>Folder: <strong>{targetFolder.label}</strong></span>
                {targetFolder.sublabel && (
                  <span className="text-muted-foreground">({targetFolder.sublabel})</span>
                )}
              </span>
            ) : (
              'Select a file and document type to upload.'
            )}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="min-w-0 space-y-4 py-2">
          {/* Document Type Selector */}
          <div className="space-y-1.5">
            <Label htmlFor="upload-doc-type" className="text-xs">Document Type</Label>
            <Select value={selectedType} onValueChange={setSelectedType}>
              <SelectTrigger id="upload-doc-type" className="h-9" aria-label="Document type">
                <SelectValue placeholder="Select document type" />
              </SelectTrigger>
              <SelectContent>
                {availableTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    {DOC_TYPE_LABEL[type]}
                  </SelectItem>
                ))}
                <SelectItem value={CUSTOM_TYPE_VALUE} className="font-medium text-primary">
                  Upload a custom file...
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Custom Type Name Input */}
          {isCustom && (
            <div className="space-y-1.5">
              <Label htmlFor="custom-type-input" className="text-xs">
                Custom Document Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="custom-type-input"
                placeholder="e.g. Barangay Clearance, Tax Declaration, SPA"
                value={customTypeName}
                onChange={(e) => setCustomTypeName(e.target.value)}
                maxLength={100}
                autoFocus
                className="h-9 text-sm"
              />
            </div>
          )}

          {/* File Picker */}
          <div className="min-w-0 space-y-1.5">
            <Label className="text-xs">Document File</Label>
            <FilePicker
              file={selectedFile}
              onFileChange={setSelectedFile}
              accept={DOCUMENT_FILE_ACCEPT}
              maxBytes={MAX_DOCUMENT_BYTES}
              disabled={isUploading}
            />
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={isUploading}
              className="h-9"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitDisabled}
              className="h-9 gap-1.5"
            >
              {isUploading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Upload className="h-3.5 w-3.5" />
              )}
              Upload document
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
