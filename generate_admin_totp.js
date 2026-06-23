import { authenticator } from 'otplib';
import qrcode from 'qrcode';

const secret = authenticator.generateSecret();

console.log("\n=======================================================");
console.log("             CRINAVA ADMIN TOTP SETUP");
console.log("=======================================================\n");
console.log("1. Add this exact line to your .env file:");
console.log(`ADMIN_TOTP_SECRET="${secret}"`);
console.log("\n2. Scan this QR Code with Google Authenticator or Microsoft Authenticator:");

const otpauth = authenticator.keyuri('admin@crinava.com', 'Crinava Control Center', secret);

qrcode.toString(otpauth, { type: 'terminal' }, (err, url) => {
  console.log(url);
  console.log("=======================================================\n");
});
