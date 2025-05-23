import path from 'path';
import { fileURLToPath } from 'url';
import { json, type RequestHandler } from "@sveltejs/kit";
import { eq } from "drizzle-orm";
import { db } from "$lib/server/db/index";
import { usersTable, userDemographicsTable } from "$lib/server/db/schema";
import pino from "pino";
import { FASTAPI_URL } from '$env/static/private';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const logFilePath = path.join(__dirname, 'backend_server.log');

const logger: pino.Logger = pino({
    level: import.meta.env.MODE === "production" ? "info" : "debug",
    transport: {
        target: 'pino/file',
        options: {
            destination: logFilePath,
            mkdir: true
        }
    }
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
            logger.error({
                internalCode: "[Node-QRFail]",
                status: 400,
                err: "QR Code parsing failed"
            });
            return json({ error: "Invalid ID" }, { status: 400 });
        }

        let uin: string = "";
        let dobDB: string = "";
        let photo: string | null = "";

        try {
            if (typeof parsedData === 'number') { // Front QR Processing
                let pcn = formatPCN(parsedData.toString());

                logger.info({
                    internalCode: "[Neon-INIT]",
                    msg: "Starting query to Neon..."
                });

                const queryResult = await db
                    .select({ uin: usersTable.uin, dateOfBirth: userDemographicsTable.dateOfBirth, photo: usersTable.photo })
                    .from(usersTable)
                    .innerJoin(userDemographicsTable, eq(usersTable.pcn, userDemographicsTable.pcn))
                    .where(eq(usersTable.pcn, pcn));

                logger.info({
                    internalCode: "[Neon-FIN]",
                    msg: "Done querying to Neon..."
                });

                if (queryResult.length === 0) {
                    logger.warn({
                        internalCode: "[Neon-InvPCN]",
                        status: 400,
                        msg: `Invalid PCN lookup: ${pcn}`
                    });

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

                    logger.info({
                        internalCode: "[Neon-INIT]",
                        msg: "Starting query to Neon..."
                    });

                    const queryResult = await db
                        .select({ uin: usersTable.uin })
                        .from(usersTable)
                        .where(eq(usersTable.pcn, pcn));

                    logger.info({
                        internalCode: "[Neon-FIN]",
                        msg: "Done querying to Neon..."
                    });

                    if (queryResult.length === 0) {
                        logger.warn({
                            internalCode: "[Neon-InvPCN]",
                            status: 400,
                            msg: `Invalid PCN lookup: ${pcn}`
                        });

                        return json({ error: "Invalid ID" }, { status: 400 });
                    }

                    uin = queryResult[0].uin;
                    dobDB = parsedData.bd;
                    photo = parsedData.p;
                }
        } catch (error: unknown) {
            logger.error({
                internalCode: "[Neon-DBFail]",
                status: 500,
                err: error
            });
            return json({ error: "Invalid ID" }, { status: 400 });
        }

        const dobMOSIP: string = dobDB.replace(/-/g, "/");

        // Verify DOB via FastAPI
        let result: { authStatus: boolean, responseTime: string, errorMessages: string};
        try {
            logger.info({
                internalCode: "[FastAPI-INIT]",
                msg: "Sending request to FastAPI..."
            });

            const response = await fetchWithTimeout(FASTAPI_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ uin, dob: dobMOSIP })
            }, 5000);

            if (!response.ok) {
                logger.info({
                    internalCode: "[FastAPI-SDown]",
                    status: response.status,
                    msg: response.statusText
                });
                return json({ error: "Invalid ID" }, { status: 400 });
            }

            result = await response.json();

            logger.info({
                internalCode: "[FastAPI-FIN]",
                msg: "Got response from FastAPI..."
            });
        } catch (error: unknown) {
            logger.error({
                internalCode: "[FastAPI-RTO]",
                status: 408,
                err: error
            });
            return json({ error: "Invalid ID" }, { status: 400 });
        }

        if (!result.authStatus) {
            logger.error({
                internalCode: "[FastAPI-AuthFail]",
                status: 401,
                err: result.errorMessages
            });
            return json({ error: "Invalid ID" }, { status: 400 });
        }

        const calculateAge = (birthDate: string | Date): number => {
            const birth = new Date(birthDate);
            const today = new Date();
          
            let age = today.getFullYear() - birth.getFullYear();
            const monthDiff = today.getMonth() - birth.getMonth();

            if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
                age--;
            }
          
            return age;
          };
          

        const finalResponse = calculateAge(dobDB) >= 35 ? { isAdult: true, photo } : { isAdult: false };

        return json(finalResponse);

    } catch (error: unknown) {
        logger.error({
            internalCode: "[FastAPI-SFail]",
            status: 500,
            err: error
        });
        return json({ error: "Invalid ID" }, { status: 400 });
    }
};
