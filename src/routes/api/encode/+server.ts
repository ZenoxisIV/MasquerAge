import { json, type RequestHandler } from "@sveltejs/kit";
import { eq } from "drizzle-orm";
import { db } from "$lib/server/db/index";
import { usersTable, userDemographicsTable } from "$lib/server/db/schema";
import pino from "pino";

const logger: pino.Logger = pino({
    level: import.meta.env.MODE === "production" ? "info" : "debug",
    transport: import.meta.env.MODE === "development"
        ? {
            target: "pino-pretty",
            options: {
                colorize: true,
                levelFirst: true,
                translateTime: true,
            },
        }
        : undefined,
});

const fetchWithTimeout = (url: string, options: RequestInit, timeout: number = 5000): Promise<Response> => {
    return Promise.race([
        fetch(url, options),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Request timeout")), timeout))
    ]);
};

export const GET: RequestHandler = async ({ url }) => {
    try {
        const pcn = url.searchParams.get("pcn");
        const dobDB = url.searchParams.get("dob");

        if (!pcn || !dobDB) {
            return json({ error: "Invalid ID" }, { status: 400 });
        }

        let uin: string = "";
        let photo: string | null = "";

        const queryResult = await db
            .select({ uin: usersTable.uin, photo: usersTable.photo })
            .from(usersTable)
            .innerJoin(userDemographicsTable, eq(usersTable.pcn, userDemographicsTable.pcn))
            .where(eq(usersTable.pcn, pcn));

        if (queryResult.length === 0) {
            logger.warn(`Invalid PCN lookup: ${pcn}`);
            return json({ error: "Invalid ID" }, { status: 400 });
        }

        uin = queryResult[0].uin;
        photo = queryResult[0].photo;
        
        const dobMOSIP = dobDB.split("T")[0].replace(/-/g, '/');

        // Verify DOB via FastAPI
        let result: { authStatus: boolean };
        try {
            const response = await fetchWithTimeout("https://mosip-sdk-api.fly.dev/dob/", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ uin, dob: dobMOSIP })
            }, 10000);

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

        const calculateAge = (dob: string): number => {
            const birthDate = new Date(dob);
            return Math.floor((Date.now() - birthDate.getTime()) / 3.15576e+10);
        };

        return calculateAge(dobDB) >= 35 ? json({ isAdult: true, photo }) : json({ isAdult: false });

    } catch (error: unknown) {
        logger.error({ error }, "Unexpected server error");
        return json({ error: "Invalid ID" }, { status: 400 });
    }
};
