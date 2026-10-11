import { z } from 'zod';

export const updateDeedTemplateSettingsSchema = z.object({
  vendor_name: z.string().min(1).optional(),
  vendor_representative: z.string().min(1).optional(),
  vendor_rep_title: z.string().min(1).optional(),
  vendor_rep_civil_status: z.string().min(1).optional(),
  vendor_rep_res_cert_no: z.string().nullable().optional(),
  vendor_rep_res_cert_date: z.string().nullable().optional(),
  vendor_rep_res_cert_place: z.string().nullable().optional(),
  vendor_tin: z.string().nullable().optional(),
  default_venue: z.string().nullable().optional(),
  mother_title_number: z.string().nullable().optional(),
  mother_area_words: z.string().nullable().optional(),
  mother_area_sqm: z.string().nullable().optional(),
  spa_doc_no: z.string().nullable().optional(),
  spa_page_no: z.string().nullable().optional(),
  spa_book_no: z.string().nullable().optional(),
  spa_series: z.string().nullable().optional(),
  spa_notary: z.string().nullable().optional(),
});
