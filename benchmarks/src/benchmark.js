import MasquerAgeLoadTest from './core/LoadEngine.js';

const options = {
    targetUrl: 'http://20.2.8.144/api/scan',
    vus: 1,
    duration: 24 * 60 * 60 * 1000,
    method: 'POST',
    logLevel: 'info'
}

const process = new MasquerAgeLoadTest(options);
process.run();
