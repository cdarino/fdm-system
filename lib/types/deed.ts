export interface DeedTemplateSettings {
  setting_id: string;
  key: string;
  vendor_name: string;
  vendor_representative: string;
  vendor_rep_title: string;
  vendor_rep_civil_status: string;
  vendor_rep_res_cert_no: string | null;
  vendor_rep_res_cert_date: string | null;
  vendor_rep_res_cert_place: string | null;
  vendor_tin: string | null;
  default_venue: string | null;
  mother_title_number: string | null;
  mother_area_words: string | null;
  mother_area_sqm: string | null;
  spa_doc_no: string | null;
  spa_page_no: string | null;
  spa_book_no: string | null;
  spa_series: string | null;
  spa_notary: string | null;
  updated_at: string;
  updated_by: string | null;
}

export interface UpdateDeedTemplateSettingsInput {
  vendor_name?: string;
  vendor_representative?: string;
  vendor_rep_title?: string;
  vendor_rep_civil_status?: string;
  vendor_rep_res_cert_no?: string | null;
  vendor_rep_res_cert_date?: string | null;
  vendor_rep_res_cert_place?: string | null;
  vendor_tin?: string | null;
  default_venue?: string | null;
  mother_title_number?: string | null;
  mother_area_words?: string | null;
  mother_area_sqm?: string | null;
  spa_doc_no?: string | null;
  spa_page_no?: string | null;
  spa_book_no?: string | null;
  spa_series?: string | null;
  spa_notary?: string | null;
}

export interface DoasDocxParams {
  executionDay: string;
  executionMonth: string;
  executionYear: string;
  executionVenue: string;

  vendorName: string;
  vendorRepresentative: string;
  vendorRepTitle: string;
  vendorRepCivilStatus: string;
  vendorRepResCertNo?: string | null;
  vendorRepResCertDate?: string | null;
  vendorRepResCertPlace?: string | null;
  vendorTin?: string | null;

  vendeeName: string;
  vendeeCivilStatus?: string | null;
  vendeeSpouseName?: string | null;
  vendeeAddress: string;
  vendeeTin?: string | null;
  vendeeIdNumber?: string | null;

  motherTitleNumber?: string | null;
  motherAreaWords?: string | null;
  motherAreaSqm?: string | number | null;
  projectLocation?: string | null;
  spaDocNo?: string | null;
  spaPageNo?: string | null;
  spaBookNo?: string | null;
  spaSeries?: string | null;
  spaNotary?: string | null;

  blockNumber: string | number;
  lotNumber: string | number;
  lotAreaWords?: string | null;
  lotAreaSqm: string | number;
  considerationWords: string;
  considerationAmount: string | number;

  technicalDescription?: string | null;
  boundaryMarkers?: string | null;
}
