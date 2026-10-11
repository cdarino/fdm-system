'use server';

import { createScope } from '@/lib/actions/action-handler';
import type { ActionResult } from '@/lib/actions/action-result';
import { requireAnyPermission } from '@/lib/actions/auth-guard';
import { stripUndefined } from '@/lib/validations/client';
import { updateDeedTemplateSettingsSchema } from '@/lib/validations/deed-settings';
import type {
  DeedTemplateSettings,
  UpdateDeedTemplateSettingsInput,
} from '@/lib/types/deed';

const deedBase = createScope();
const deedUpdate = createScope(['legal.update']);

export async function getDeedTemplateSettings(): Promise<DeedTemplateSettings> {
  return deedBase.query({
    handler: async (_input, { supabase }) => {
      await requireAnyPermission(['legal.read', 'properties.read', 'system.read']);

      const { data, error } = await supabase
        .from('deed_template_settings')
        .select('*')
        .eq('key', 'default')
        .maybeSingle<DeedTemplateSettings>();

      if (error) {
        throw new Error(`Failed to load deed template settings: ${error.message}`);
      }

      if (!data) {
        return {
          setting_id: 'default',
          key: 'default',
          vendor_name: 'FIRST DAVAO MILLENNIUM PROPERTY VENTURES SERVICES, INC.',
          vendor_representative: 'JETRUDE A. GARCIA',
          vendor_rep_title: 'Executive Vice-President',
          vendor_rep_civil_status: 'single',
          vendor_rep_res_cert_no: '01665165',
          vendor_rep_res_cert_date: 'January 06, 2014',
          vendor_rep_res_cert_place: 'IGACOS',
          vendor_tin: '005-212-468',
          default_venue: 'Davao City',
          mother_title_number: 'T-14913 & 14914',
          mother_area_words: 'ONE HUNDRED NINETY FOUR THOUSAND FOUR HUNDRED SIXTY SIX',
          mother_area_sqm: '194,466',
          spa_doc_no: '349',
          spa_page_no: '70',
          spa_book_no: '27',
          spa_series: '2002',
          spa_notary: 'ATTY. RODOLFTON S.J. DE LEON',
          updated_at: new Date().toISOString(),
          updated_by: null,
        };
      }

      return data;
    },
  });
}

export async function updateDeedTemplateSettings(
  input: UpdateDeedTemplateSettingsInput
): Promise<ActionResult<DeedTemplateSettings>> {
  return deedUpdate.run({
    schema: updateDeedTemplateSettingsSchema,
    input,
    handler: async (validatedInput, { supabase, userId }) => {
      const cleanUpdates = stripUndefined({
        ...validatedInput,
        updated_at: new Date().toISOString(),
        updated_by: userId,
      });

      const { data, error } = await supabase
        .from('deed_template_settings')
        .update(cleanUpdates)
        .eq('key', 'default')
        .select('*')
        .single<DeedTemplateSettings>();

      if (error) {
        throw new Error(`Failed to update deed template settings: ${error.message}`);
      }

      return data;
    },
  });
}
