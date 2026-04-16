export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  user: {
    id: number;
    user_name: string;
    first_name: string;
    middle_name: string | null;
    last_name: string;
    email: string | null;
    role: any;
    status: any;
    theme: any;
  };
}
