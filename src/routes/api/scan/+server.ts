import { json, type RequestHandler } from "@sveltejs/kit";
import { eq } from "drizzle-orm";
import { db } from "$lib/server/db/index";
import { usersTable, userDemographicsTable } from "$lib/server/db/schema";
import pino from "pino";

const logger: pino.Logger = pino({
	level: import.meta.env.MODE === "production" ? "info" : "debug",
	transport: import.meta.env.MODE === "development" ? 
		{ 
			target: "pino-pretty", 
			options: { 
				colorize: true,
				levelFirst: true,
				translateTime: true
			}
		} : undefined,
});

function formatPCN(input: string): string {
    if (!/^\d{16}$/.test(input)) {
        throw new Error("Invalid PCN format");
    }
    return input.match(/.{1,4}/g)?.join('-') ?? '';
}

function validateDOB(dob: string): boolean {
    return /^\d{4}-\d{2}-\d{2}$/.test(dob);
}

const fetchWithTimeout = (url: string, options: RequestInit, timeout: number = 5000) => {
    return Promise.race([
        fetch(url, options),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Request timeout")), timeout))
    ]);
};

export const POST: RequestHandler = async ({ request }) => {
    try {
        const { data }: { data: string } = await request.json();
        if (!data) return json({ error: "Invalid ID" }, { status: 400 });

        let parsedData: any;
        try {
            parsedData = JSON.parse(data);
        } catch (error: unknown) {
            logger.warn("QR Code parsing failed");
            return json({ error: "Invalid ID" }, { status: 400 });
        }

        let uin: string = "";
        let dobDB: string = "";
        let photo: string | null = "";

        try {
            if (typeof parsedData === 'number') { // Front QR Processing
                let pcn = formatPCN(parsedData.toString());

                const queryResult = await db
                    .select({ uin: usersTable.uin, dateOfBirth: userDemographicsTable.dateOfBirth, photo: usersTable.photo })
                    .from(usersTable)
                    .innerJoin(userDemographicsTable, eq(usersTable.pcn, userDemographicsTable.pcn))
                    .where(eq(usersTable.pcn, pcn));

                if (queryResult.length === 0) {
                    logger.warn(`Invalid PCN lookup: ${pcn}`);
                    return json({ error: "Invalid ID" }, { status: 400 });
                }

                uin = queryResult[0].uin;
                dobDB = queryResult[0].dateOfBirth;
                photo = queryResult[0].photo;

            } else { // Back QR Processing
                const pcn = formatPCN(parsedData.pcn);

                if (!validateDOB(parsedData.bd)) {
                    return json({ error: "Invalid ID" }, { status: 400 });
                }

                const queryResult = await db
                    .select({ uin: usersTable.uin })
                    .from(usersTable)
                    .where(eq(usersTable.pcn, pcn));

                if (queryResult.length === 0) {
                    logger.warn(`Invalid PCN lookup: ${pcn}`);
                    return json({ error: "Invalid ID" }, { status: 400 });
                }

                uin = queryResult[0].uin;
                dobDB = parsedData.bd;
                photo = parsedData.p;
            }
        } catch (error: unknown) {
            logger.error({ error }, "Database query failed");
            return json({ error: "Invalid ID" }, { status: 400 });
        }

		const dobMOSIP: string = dobDB.replace(/-/g, "/");

        // Verify DOB via FastAPI
        let result: { authStatus: boolean };
		try {
			const response = await fetchWithTimeout("https://mosip-sdk-api.fly.dev/dob/", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ uin, dob: dobMOSIP })
			}, 5000);

			if (!response.ok) {
				logger.warn(`FastAPI returned ${response.status} - ${response.statusText}`);
				return json({ error: "Invalid ID" }, { status: 400 });
			}

			result = await response.json();
		} catch (error: unknown) {
			logger.error("FastAPI request failed or timed out");
			return json({ error: "Invalid ID" }, { status: 400 });
		}

        if (!result.authStatus) {
            logger.warn(`Authentication failed for UIN: ${uin}`);
            return json({ error: "Invalid ID" }, { status: 400 });
        }

        const calculateAge = (birthDate: string | Date): number => {
            const date: Date = birthDate instanceof Date ? birthDate : new Date(birthDate);
            return Math.floor((new Date().getTime() - date.getTime()) / 3.15576e+10);
        };

        return calculateAge(dobDB) >= 35 ? json({ isAdult: true, photo }) : json({ isAdult: false });

    } catch (error: unknown) {
        logger.error({ error }, "Unexpected server error");
        return json({ error: "Invalid ID" }, { status: 400 });
    }
};
