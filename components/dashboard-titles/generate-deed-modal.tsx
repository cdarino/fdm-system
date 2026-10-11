'use client';

import { useEffect, useState } from 'react';
import { Download, FileText, Loader2, Sparkles, Building2, User, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  getDeedTemplateSettings,
  updateDeedTemplateSettings,
} from '@/lib/actions/deed-settings';
import { downloadDoasDocx } from '@/lib/reports/docx-doas';
import { numberToWords } from '@/lib/utils/number-to-words';
import type { LandTitle } from '@/lib/types/title';
import type { DeedTemplateSettings } from '@/lib/types/deed';

interface GenerateDeedModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: LandTitle;
}

function getOrdinalDay(day: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = day % 100;
  return day + (s[(v - 20) % 10] || s[v] || s[0]);
}

export function GenerateDeedModal({
  open,
  onOpenChange,
  title,
}: GenerateDeedModalProps) {
  const [isLoadingSettings, setIsLoadingSettings] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [saveAsDefault, setSaveAsDefault] = useState(false);

  // Settings loaded from database
  const [settings, setSettings] = useState<DeedTemplateSettings | null>(null);

  // Form state
  const now = new Date();
  const [day, setDay] = useState(getOrdinalDay(now.getDate()));
  const [month, setMonth] = useState(now.toLocaleString('en-US', { month: 'long' }));
  const [year, setYear] = useState(String(now.getFullYear()));
  const [venue, setVenue] = useState('Davao City');

  const [vendorName, setVendorName] = useState('FIRST DAVAO MILLENNIUM PROPERTY VENTURES SERVICES, INC.');
  const [vendorRep, setVendorRep] = useState('JETRUDE A. GARCIA');
  const [vendorRepTitle, setVendorRepTitle] = useState('Executive Vice-President');
  const [vendorRepCivilStatus, setVendorRepCivilStatus] = useState('single');
  const [vendorTin, setVendorTin] = useState('005-212-468');

  // Lot & Consideration
  const lotArea = title.property?.area_size ?? 150;
  const initialPrice =
    title.property?.area_size && title.property?.price_per_sqm
      ? title.property.area_size * title.property.price_per_sqm
      : 148500;

  const [priceNum, setPriceNum] = useState(
    initialPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  );
  const [priceWords, setPriceWords] = useState(numberToWords(initialPrice));
  const [technicalDescription, setTechnicalDescription] = useState('');

  // Load persistent template settings on open
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setIsLoadingSettings(true);

    getDeedTemplateSettings()
      .then((data) => {
        if (cancelled) return;
        setSettings(data);
        if (data.vendor_name) setVendorName(data.vendor_name);
        if (data.vendor_representative) setVendorRep(data.vendor_representative);
        if (data.vendor_rep_title) setVendorRepTitle(data.vendor_rep_title);
        if (data.vendor_rep_civil_status) setVendorRepCivilStatus(data.vendor_rep_civil_status);
        if (data.vendor_tin) setVendorTin(data.vendor_tin);
        if (data.default_venue) setVenue(data.default_venue);
      })
      .catch((err) => {
        if (!cancelled) {
          toast.error(err instanceof Error ? err.message : 'Failed to load template defaults');
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoadingSettings(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open]);

  // Handle price number changes and re-calculate words
  function handlePriceChange(val: string) {
    setPriceNum(val);
    const numeric = parseFloat(val.replace(/,/g, ''));
    if (!isNaN(numeric) && numeric > 0) {
      setPriceWords(numberToWords(numeric));
    }
  }

  async function handleDownloadDocx() {
    setIsGenerating(true);
    try {
      // Save updated company defaults to database if opted-in
      if (saveAsDefault) {
        await updateDeedTemplateSettings({
          vendor_name: vendorName,
          vendor_representative: vendorRep,
          vendor_rep_title: vendorRepTitle,
          vendor_rep_civil_status: vendorRepCivilStatus,
          vendor_tin: vendorTin,
          default_venue: venue,
        });
        toast.success('Company representative defaults updated in database');
      }

      await downloadDoasDocx({
        executionDay: day,
        executionMonth: month,
        executionYear: year,
        executionVenue: venue,

        vendorName,
        vendorRepresentative: vendorRep,
        vendorRepTitle,
        vendorRepCivilStatus,
        vendorTin,
        vendorRepResCertNo: settings?.vendor_rep_res_cert_no ?? '01665165',
        vendorRepResCertDate: settings?.vendor_rep_res_cert_date ?? 'January 06, 2014',
        vendorRepResCertPlace: settings?.vendor_rep_res_cert_place ?? 'IGACOS',

        vendeeName: title.client?.full_name ?? 'Client Name',
        vendeeCivilStatus: title.client?.civil_status ?? 'single',
        vendeeSpouseName: title.client?.spouse_name ?? null,
        vendeeAddress: title.client?.address ?? 'Davao City',
        vendeeTin: title.client?.tin_number ?? null,

        motherTitleNumber: settings?.mother_title_number ?? 'T-14913 & 14914',
        motherAreaWords: settings?.mother_area_words ?? 'ONE HUNDRED NINETY FOUR THOUSAND FOUR HUNDRED SIXTY SIX',
        motherAreaSqm: settings?.mother_area_sqm ?? '194,466',
        projectLocation: title.property?.location ?? 'Kaputian District, Island Garden City of Samal',
        spaDocNo: settings?.spa_doc_no ?? '349',
        spaPageNo: settings?.spa_page_no ?? '70',
        spaBookNo: settings?.spa_book_no ?? '27',
        spaSeries: settings?.spa_series ?? '2002',
        spaNotary: settings?.spa_notary ?? 'ATTY. RODOLFTON S.J. DE LEON',

        blockNumber: title.property?.block_number ?? '0',
        lotNumber: title.property?.lot_number ?? '0',
        lotAreaWords: numberToWords(Number(lotArea)),
        lotAreaSqm: lotArea,
        considerationWords: priceWords,
        considerationAmount: priceNum,

        technicalDescription: technicalDescription.trim() || null,
      });

      toast.success('Deed of Sale (.docx) downloaded successfully');
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to generate document');
    } finally {
      setIsGenerating(false);
    }
  }

  const clientName = title.client?.full_name ?? 'Client';
  const civilStatus = title.client?.civil_status ?? 'Single';
  const spouse = title.client?.spouse_name;
  const blockNum = title.property?.block_number ?? '—';
  const lotNum = title.property?.lot_number ?? '—';
  const location = title.property?.location ?? 'Property Site';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <FileText className="h-4 w-4" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold">
                Generate Deed of Sale (DOAS)
              </DialogTitle>
              <DialogDescription className="text-xs">
                Generates a Word (.docx) document formatted for legal printing.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {isLoadingSettings ? (
          <div className="flex h-48 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4 py-2 text-xs">
            {/* Summary Context Banner */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-lg border border-border bg-card">
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 font-semibold text-foreground">
                  <User className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>Buyer: {clientName}</span>
                </div>
                <p className="text-muted-foreground">
                  Status: <span className="text-foreground capitalize">{civilStatus}</span>
                  {spouse ? ` • Spouse: ${spouse}` : ''}
                </p>
                <p className="text-muted-foreground truncate">
                  Address: {title.client?.address ?? 'On record'}
                </p>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-1.5 font-semibold text-foreground">
                  <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>Parcel: Block {blockNum}, Lot {lotNum}</span>
                </div>
                <p className="text-muted-foreground">
                  Location: <span className="text-foreground">{location}</span>
                </p>
                <p className="text-muted-foreground">
                  Area: <span className="text-foreground font-medium">{lotArea} sqm</span>
                </p>
              </div>
            </div>

            {/* Execution Date & Venue */}
            <div className="rounded-lg border border-border p-3.5 space-y-3 bg-card">
              <h4 className="font-semibold text-foreground flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                Execution Details & Venue
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">Day</Label>
                  <Input
                    value={day}
                    onChange={(e) => setDay(e.target.value)}
                    placeholder="e.g. 24th"
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <Label className="text-[11px] text-muted-foreground">Month</Label>
                  <Input
                    value={month}
                    onChange={(e) => setMonth(e.target.value)}
                    placeholder="e.g. January"
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">Year</Label>
                  <Input
                    value={year}
                    onChange={(e) => setYear(e.target.value)}
                    placeholder="e.g. 2026"
                    className="h-8 text-xs"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Execution Venue</Label>
                <Input
                  value={venue}
                  onChange={(e) => setVenue(e.target.value)}
                  placeholder="e.g. Davao City"
                  className="h-8 text-xs"
                />
              </div>
            </div>

            {/* FDM Representative & Defaults */}
            <div className="rounded-lg border border-border p-3.5 space-y-3 bg-card">
              <h4 className="font-semibold text-foreground flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                FDM Authorized Representative
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">Representative Name</Label>
                  <Input
                    value={vendorRep}
                    onChange={(e) => setVendorRep(e.target.value)}
                    placeholder="e.g. JETRUDE A. GARCIA"
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">Designation / Title</Label>
                  <Input
                    value={vendorRepTitle}
                    onChange={(e) => setVendorRepTitle(e.target.value)}
                    placeholder="e.g. Executive Vice-President"
                    className="h-8 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">Civil Status</Label>
                  <Input
                    value={vendorRepCivilStatus}
                    onChange={(e) => setVendorRepCivilStatus(e.target.value)}
                    placeholder="e.g. single"
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">Company TIN</Label>
                  <Input
                    value={vendorTin}
                    onChange={(e) => setVendorTin(e.target.value)}
                    placeholder="e.g. 005-212-468"
                    className="h-8 text-xs"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <Checkbox
                  id="save-deed-default"
                  checked={saveAsDefault}
                  onCheckedChange={(checked) => setSaveAsDefault(Boolean(checked))}
                  className="h-3.5 w-3.5"
                />
                <label
                  htmlFor="save-deed-default"
                  className="text-xs text-muted-foreground cursor-pointer select-none"
                >
                  Save representative details as company default for future deeds
                </label>
              </div>
            </div>

            {/* Consideration & Price */}
            <div className="rounded-lg border border-border p-3.5 space-y-3 bg-card">
              <h4 className="font-semibold text-foreground flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
                Consideration & Contract Price
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">Amount (Php)</Label>
                  <Input
                    value={priceNum}
                    onChange={(e) => handlePriceChange(e.target.value)}
                    placeholder="e.g. 148,500.00"
                    className="h-8 text-xs font-mono"
                  />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <Label className="text-[11px] text-muted-foreground">Amount in Words</Label>
                  <Input
                    value={priceWords}
                    onChange={(e) => setPriceWords(e.target.value)}
                    placeholder="e.g. ONE HUNDRED FORTY EIGHT THOUSAND FIVE HUNDRED"
                    className="h-8 text-xs uppercase"
                  />
                </div>
              </div>
            </div>

            {/* Metes and Bounds Note */}
            <div className="rounded-lg border border-border p-3.5 space-y-2 bg-card">
              <Label className="text-xs font-semibold text-foreground">
                Technical Metes and Bounds (Optional)
              </Label>
              <textarea
                value={technicalDescription}
                onChange={(e) => setTechnicalDescription(e.target.value)}
                placeholder="Leave blank to use the standard placeholder bearings. Staff can easily paste or refine surveyor descriptions directly in the downloaded Word (.docx) file."
                rows={3}
                className="w-full rounded-md border border-input bg-transparent px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-mono"
              />
              <p className="text-[11px] text-muted-foreground">
                Tip: Since the file opens in Word, staff can review and paste survey blueprint bearings directly in the docx.
              </p>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-border">
          <Button
            type="button"
            variant="quiet"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={isGenerating}
            className="text-xs"
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleDownloadDocx}
            disabled={isGenerating || isLoadingSettings}
            className="text-xs gap-1.5"
          >
            {isGenerating ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="h-3.5 w-3.5" />
            )}
            Download DOCX
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
