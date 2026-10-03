export type TitleStatus = 'Processing' | 'Ready for Release' | 'Released' | string;

export interface LandTitle {
  title_id: string;
  property_id: string;
  client_id: string;
  title_number: string | null;
  status: TitleStatus;
  created_at: string;
  updated_at: string;
  client?: {
    client_id: string;
    full_name: string;
    status: string;
    address: string | null;
  } | null;
}

export interface CreateLandTitleInput {
  property_id: string;
  client_id: string;
  title_number?: string | null;
  status?: TitleStatus;
}

export interface UpdateLandTitleInput {
  title_number?: string | null;
  status?: TitleStatus;
}
