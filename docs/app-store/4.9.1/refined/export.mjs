import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(root, '../../../..');
const generated = process.argv[2];
if (!generated) throw new Error('Pass the directory containing the original generated images.');
const images = [
  ['01-crm', 'exec-a4376745-f63f-47a4-86fc-2a7e3ccaaaef.png', 'CRM'],
  ['02-copilot', 'exec-87e31902-d138-47d5-86a3-909abff4fb3b.png', 'Copilot'],
  ['03-notificaciones', 'exec-3e76c027-bc94-42a1-96b6-0c18fcba5520.png', 'Notificaciones'],
  ['04-space', 'exec-b79b2dcb-c7db-490c-9cdc-d22963906e6c.png', 'Agenda'],
  ['05-intelligence', 'exec-854c2214-f963-41da-aa78-6fe6d56e9ecc.png', 'Intelligence'],
  ['06-expediente', 'exec-9d141207-74b2-49b2-b6b1-93f25194d5a9.png', 'Expediente'],
];
await fs.mkdir(path.join(root, 'screenshots'), { recursive: true });
const masters = path.join(repo, 'output/app-store-refined/masters');
await fs.mkdir(masters, { recursive: true });
const exports = [];
for (const [name, source, label] of images) {
  const input = path.join(generated, source);
  await fs.copyFile(input, path.join(masters, `${name}.png`));
  const output = path.join(root, 'screenshots', `${name}.jpg`);
  // Format conversion only; no compositing, repainting, or UI alterations.
  await sharp(input).resize(1206, 2622, { fit: 'fill' }).removeAlpha().toColourspace('srgb').jpeg({ quality: 97, chromaSubsampling: '4:4:4' }).toFile(output);
  const metadata = await sharp(output).metadata();
  if (metadata.width !== 1206 || metadata.height !== 2622 || metadata.hasAlpha) throw new Error(`Invalid export: ${name}`);
  exports.push({ name, label, file: `screenshots/${name}.jpg`, width: metadata.width, height: metadata.height, format: metadata.format, source });
}
await fs.writeFile(path.join(root, 'manifest.json'), JSON.stringify({
  app: 'Stratos AI', version: '4.9.1', locale: 'es-MX', theme: 'light',
  method: 'Real demo UI captures composed with the built-in image_gen tool.',
  palette: 'Blue, white and mint-green backgrounds; original app UI colors preserved.',
  typography: 'AI-rendered geometric marketing typography inspired by Montserrat.',
  notifications: 'Illustrative examples based on implemented task reminder features; not captures of delivered pushes.',
  exports
}, null, 2) + '\n');
console.log(JSON.stringify(exports.map(({name,width,height,format})=>({name,width,height,format})), null, 2));
