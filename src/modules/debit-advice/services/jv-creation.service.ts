import { Injectable } from "@nestjs/common";
import axios from "axios";

@Injectable()
export class OSHJVService {
    async postToOSHJV(payload: any[]) {
        try {
            const response = await axios.post(
                "http://10.2.0.156:81/ctgi/udp.php?objectcode=u_OSHJV",
                payload,
                {
                    headers: {
                        "Content-Type": "application/json",
                    },
                },
            );

            return response.data;
        } catch (error: any) {
            console.error("OSHJV API Error:", error?.response?.data || error);

            throw error;
        }
    }
}

