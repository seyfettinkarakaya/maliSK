// Yapıştırılan dağılım tablosunu çözme.
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseAllocationTable } from '../src/app/importer.mjs';

const SAMPLE = `Kod\tDağılım (%)\tSözleşme no
KJM\t30\t123
KGC\t20\t123
AGA\t20\t123
AGH\t10\t123
KRM\t20\t123
KJM\t30\t456
KGC\t20\t456
AGA\t20\t456
AGH\t10\t456
KRM\t20\t456
KJM\t30\t789
KGC\t20\t789
AGA\t20\t789
AGH\t10\t789
KRM\t20\t789`;

test('örnek tablo: 3 sözleşme, 15 satır, hepsi %100', () => {
  const r = parseAllocationTable(SAMPLE);
  assert.equal(r.ok, true);
  assert.equal(r.rows, 15);
  assert.deepEqual(Object.keys(r.contracts), ['123', '456', '789']);
  assert.deepEqual(r.contracts['123'].weights, { KJM: 30, KGC: 20, AGA: 20, AGH: 10, KRM: 20 });
  assert.equal(r.contracts['789'].sum, 100);
});

test('başlıksız, boşluklu, ondalık virgül ve yüzde işareti', () => {
  const r = parseAllocationTable('kjm  %62,5  123\nVEY 37,5 123');
  assert.equal(r.ok, true);
  assert.deepEqual(r.contracts['123'].weights, { KJM: 62.5, VEY: 37.5 });
});

test('sütun sırası başlıktan; sözleşme sütunu yoksa tek sözleşme', () => {
  const a = parseAllocationTable('Sözleşme no;Kod;Oran\n123;KJM;60\n123;AGA;40');
  assert.deepEqual(a.contracts['123'].weights, { KJM: 60, AGA: 40 });
  const b = parseAllocationTable('KJM\t70\nAGA\t30');
  assert.deepEqual(Object.keys(b.contracts), ['1']);
});

test('hatalar ve uyarılar: toplam, bilinmeyen kod, tekrar', () => {
  const r = parseAllocationTable('KJM\t60\t1\nXYZ\t30\t1\nKJM\t5\t1\nbozuk satır', { knownCodes: new Set(['KJM', 'AGA']) });
  assert.equal(r.ok, false);
  assert.match(r.errors.map((e) => e.msg).join(' | '), /toplam %95, 100 olmalı/);
  assert.match(r.errors.map((e) => e.msg).join(' | '), /bir fon kodu değil/);
  assert.match(r.warnings.map((e) => e.msg).join(' | '), /XYZ veride bulunamadı/);
  assert.match(r.warnings.map((e) => e.msg).join(' | '), /iki kez/);
  assert.equal(r.contracts['1'].weights.KJM, 65);
});
