export class SessionTokenResponse {
  access_token: string;
  refresh_token: string;
  user: {
    id: number;
    user_name: string;
    first_name: string;
    last_name: string;
    role_id: number;
    role_name: string;
    user_reset: boolean | null;
  };
  session: {
    id: number;
    device_info: string | null;
    ip_address: string | null;
    last_login: Date | null;
  };
}
