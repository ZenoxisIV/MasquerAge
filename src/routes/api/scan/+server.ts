import { json, type RequestHandler } from "@sveltejs/kit";
import { eq } from "drizzle-orm";
import { db } from "$lib/server/db/index";
import { usersTable } from "$lib/server/db/schema";
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

const fetchWithTimeout = (url: string, options: RequestInit, timeout: number = 5000) => {
    return Promise.race([
        fetch(url, options),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Request timeout")), timeout))
    ]);
};

export const POST: RequestHandler = async ({ request }) => {
    try {
        const { data }: { data: string } = await request.json();
        if (!data) return json({ error: "No data provided" }, { status: 400 });

        let parsedData: any;
        try {
            parsedData = JSON.parse(data);
        } catch (error: unknown) {
            logger.error({ error }, "QR Code parsing error");
            return json({ error: "Invalid QR Code format" }, { status: 400 });
        }

        const pcn: string = parsedData.subject.PCN;
        const dateOfBirth: Date = new Date(parsedData.subject.DOB);
        const dobDB: string = new Date(dateOfBirth.getTime() + Math.abs(dateOfBirth.getTimezoneOffset() * 60000))
            .toISOString().split("T")[0];
        const dobMOSIP: string = dobDB.replace(/-/g, "/");

        const queryResult: { uin: string; photo: string | null }[] = await db
            .select({ uin: usersTable.uin, photo: usersTable.photo })
            .from(usersTable)
            .where(eq(usersTable.pcn, pcn))
            .catch((err: unknown) => {
                logger.error({ err }, "Database query error");
                throw new Error("Database query failed");
            });

        if (!queryResult.length) {
            return json({ authStatus: false, error: "Invalid credentials" }, { status: 404 });
        }

        const uin: string = queryResult[0].uin;
        const photo: string | null = queryResult[0].photo;

		// Verify DOB via fastAPI
        const response = await fetchWithTimeout("http://127.0.0.1:3000/dob", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ uin, dob: dobMOSIP })
        }, 5000).catch((err: unknown) => {
            logger.error({ err }, "External API request error");
            throw new Error("Failed to verify DOB");
        });

        if (!response.ok) {
            logger.error({ status: response.status, statusText: response.statusText }, "External API response error");
            return json({ authStatus: false, error: "Verification service unavailable" }, { status: 502 });
        }

        const result: { authStatus: boolean } = await response.json().catch((err: unknown) => {
            logger.error({ err }, "Error parsing API response");
            throw new Error("Invalid API response format");
        });

        if (result.authStatus) {
            const getAge = (birthDate: string | Date): number => {
                const date: Date = birthDate instanceof Date ? birthDate : new Date(birthDate);
                return Math.floor((new Date().getTime() - date.getTime()) / 3.15576e+10);
            };

            return json({ authStatus: true, age: getAge(dobDB), photo });
        } else {
            return json({ authStatus: false, error: "Invalid ID" }, { status: 401 });
        }
    } catch (error: unknown) {
        logger.error({ error }, "Server error");
        return json({ error: "Internal server error" }, { status: 500 });
    }
};