import QRCode from 'qrcode';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { faker } from '@faker-js/faker';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dirPath = path.join(__dirname, 'qr-codes');

if (fs.existsSync(dirPath)) {
    fs.readdirSync(dirPath).forEach(file => {
        fs.unlinkSync(path.join(dirPath, file));
    });
} else {
    fs.mkdirSync(dirPath, { recursive: true });
}

const numberOfQRCodes = parseInt(process.argv[2], 10) || 5;

const generateFakeUser = () => {
    return {
        bd: faker.date.birthdate({ min: 1970, max: 2000, mode: 'year' }).toISOString().split('T')[0],
        bf: null,
        bt: faker.helpers.arrayElement(["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"]),
        iat: faker.date.between({ from: '2000-01-01T00:00:00Z', to: new Date() }).getTime() / 1000, // Random UNIX timestamp
        id: "ABC1234",
        iss: "national-id.gov.ph",
        ms: faker.helpers.arrayElement(["Single", "Married", "Divorced", "Widowed"]),
        n_f: faker.person.firstName().toUpperCase(),
        n_l: faker.person.lastName().toUpperCase(),
        n_m: faker.person.middleName().toUpperCase(),
        n_s: faker.helpers.maybe(() => faker.person.suffix(), { probability: 0.1 }) || "",
        p: "UklGRuYBAABXRUJQVlA4INoBAAAwCgCdASokACQAPm0wk0akIyGhLjgIAIANiWkAEgT3+8KCyP3hJ4TgJVT3wqFk2bgUa/BJxi7fAj2xuqSxS/ZUuMKy9m/RwY1TAnNpf4aOQYH9kNfK39z+MgAAzRITyREMEC2slCjSu35WvHfRJl00/0m2wFx9pTQuf/kmrRZ/ecSywNt7eJQB4hphKFJetd41jr+i3EuB6mvAANIwDIBUXV5G9gILCHZHp1M8B9PbqeNjDj5VjR4w5AoN+q+9PIvWnryCbwT/s/QFgesiip9nIhb/KyaDjpiU+Yg9nP+sorU2o5u5HaglQVB7CHFKFoZlpzV+c5eAd1lxuEUkb1/pasru7Z4csSkZq+Tqn5lX8Iu7bMvgqDs0qujsAhuGR/Vq7MQ41kZVkn+YmmM+owcpNmLi9vmbqLfFdYWzyqcEAVSx3Ih3vdUK8fR82xJ80IcHntsVg9OlBFvOTqt0yrI/Ik3Bu/tmNu2ttiX7n0/M2IZ8Ldv2pxUgBLa8mm/9s1Vs9uLQpL58Zl0sRlvq83/qujDW4QBF3f5f58jcpQUKicU6Xhfo+p1f757ex17DpVdZlH2xmNs9ygeUqBUcy9/uxYf6B1Abd+OAUmCvJyYusdcH6fvKAdAAAAA=",
        pcn: faker.helpers.weightedArrayElement(
            [
                // 80% chance for successful authentication
                { value: "3802993748914180", weight: 20 },
                { value: "3406730401296927", weight: 20 },
                { value: "1128457229699457", weight: 20 },
                { value: "9328400871640646", weight: 20 },
                { value: faker.string.numeric(16), weight: 20 } // 20% chance for failure
            ]
        ),
        pob: faker.location.city().toUpperCase(),
        s: faker.person.sex().toUpperCase(),
        v: "2.0",
        z: "TU9TSVAgaXMgYXdlc29tZSE="
    };
};


for (let i = 1; i <= numberOfQRCodes; i++) {
    const jsonString = JSON.stringify(generateFakeUser());
    const paddedIndex = String(i).padStart(3, '0');
    const outputPath = path.join(dirPath, `qrcode_${paddedIndex}.png`);
    
    QRCode.toFile(outputPath, jsonString, {
        width: 720,
        height: 720
    }).then(() => {
        console.log(`QR Code ${paddedIndex} saved to`, outputPath);
    }).catch(err => {
        console.error(`Error generating QR Code ${paddedIndex}:`, err);
    });
}
