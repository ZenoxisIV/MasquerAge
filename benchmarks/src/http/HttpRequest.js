import { performance } from 'perf_hooks';
import http from 'http';

export default class HttpRequest {
    constructor(targetUrl, timeout = 5000) {
        this.targetUrl = targetUrl;
        this.timeout = timeout;
    }

    async sendRequest(method = 'GET', body = null, customHeaders = {}) {
        const timings = {
            http_req_duration: 0,
            data_received: 0,
            data_sent: 0,
        };

        const headers = {
            ...customHeaders,
            'User-Agent': 'MasquerAge',
        };

        if (method === 'POST' && body) {
            const bodyString = JSON.stringify({ data: JSON.stringify(body) });
            headers['Content-Type'] = 'application/json';
            headers['Content-Length'] = Buffer.byteLength(bodyString);
        }

        const options = {
            method,
            headers,
        };

        try {
            const start = performance.now();
            const response = await new Promise((resolve, reject) => {
                const req = http.request(this.targetUrl, options, (res) => {
                    const end = performance.now();
                    let responseSize = 0;
                    let responseData = '';

                    res.on('data', (chunk) => {
                        responseData += chunk;
                        responseSize += chunk.length;
                    });

                    res.on('end', () => {
                        timings.http_req_duration = end - start;
                        timings.data_received = responseSize;
                        resolve({
                            status: res.statusCode,
                            data: responseData,
                            ...timings,
                        });
                    });
                });

                req.on('error', (err) => {
                    reject(err);
                });

                req.setTimeout(this.timeout, () => {
                    req.destroy();
                    resolve({ status: 'timeout', ...timings });
                });

                let bodySize = 0;
                if (method === 'POST' && body) {
                    bodySize = Buffer.byteLength(JSON.stringify(body));
                }
                const headersSize = JSON.stringify(req.getHeaders()).length;
                timings.data_sent = headersSize + bodySize;

                if (method === 'POST' && body) {
                    req.write(JSON.stringify({ data: JSON.stringify(body) }));
                }

                req.end();
            });

            return response;

        } catch (err) {
            console.error('Request failed: ', err.message);
            return { status: 'error', error: err.message, ...timings };
        }
    }
}
