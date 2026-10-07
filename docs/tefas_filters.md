# TEFAS tür filtresi denemesi

Üretildi: 2026-10-07T20:05:11.724Z · `tools/tefas_filters.mjs`

Her satır: filtre alanı = değer → dönen fon sayısı, adında KATILIM geçen sayısı, örnek adlar.

- **Filtresiz** (20261006): 400 fon, 123 KATILIM

- `fonUnvanTip = KATILIM` → HTTP 200 · 400 fon · 123 KATILIM · KATILIM olmayan örnek: AAJ, ABE, AE1
- `fonUnvanTip = FAIZSIZ` → HTTP 200 · 400 fon · 123 KATILIM · KATILIM olmayan örnek: AAJ, ABE, AE1
- `fonUnvanTip = FAİZSİZ` → HTTP 200 · 400 fon · 123 KATILIM · KATILIM olmayan örnek: AAJ, ABE, AE1
- `fonUnvanTip = K` → HTTP 200 · 400 fon · 123 KATILIM · KATILIM olmayan örnek: AAJ, ABE, AE1
- `fonUnvanTip = F` → HTTP 200 · 400 fon · 123 KATILIM · KATILIM olmayan örnek: AAJ, ABE, AE1
- `fonUnvanTip = Y` → HTTP 200 · 400 fon · 123 KATILIM · KATILIM olmayan örnek: AAJ, ABE, AE1
- `fonUnvanTip = 1` → HTTP 200 · 400 fon · 123 KATILIM · KATILIM olmayan örnek: AAJ, ABE, AE1
- `fonUnvanTip = 2` → HTTP 200 · 400 fon · 123 KATILIM · KATILIM olmayan örnek: AAJ, ABE, AE1
- `fonUnvanTip = 3` → HTTP 200 · 400 fon · 123 KATILIM · KATILIM olmayan örnek: AAJ, ABE, AE1
- `fonUnvanTip = 4` → HTTP 200 · 400 fon · 123 KATILIM · KATILIM olmayan örnek: AAJ, ABE, AE1
- `sFonTurKod = 1` → HTTP 200 · 400 fon · 123 KATILIM · KATILIM olmayan örnek: AAJ, ABE, AE1
- `sFonTurKod = 2` → HTTP 200 · 400 fon · 123 KATILIM · KATILIM olmayan örnek: AAJ, ABE, AE1
- `sFonTurKod = 3` → HTTP 200 · 400 fon · 123 KATILIM · KATILIM olmayan örnek: AAJ, ABE, AE1
- `sFonTurKod = 4` → HTTP 200 · 400 fon · 123 KATILIM · KATILIM olmayan örnek: AAJ, ABE, AE1
- `sFonTurKod = 5` → HTTP 200 · 400 fon · 123 KATILIM · KATILIM olmayan örnek: AAJ, ABE, AE1
- `sFonTurKod = 6` → HTTP 200 · 400 fon · 123 KATILIM · KATILIM olmayan örnek: AAJ, ABE, AE1
- `sFonTurKod = 7` → HTTP 200 · 400 fon · 123 KATILIM · KATILIM olmayan örnek: AAJ, ABE, AE1
- `sFonTurKod = 8` → HTTP 200 · 400 fon · 123 KATILIM · KATILIM olmayan örnek: AAJ, ABE, AE1
- `sFonTurKod = 9` → HTTP 200 · 400 fon · 123 KATILIM · KATILIM olmayan örnek: AAJ, ABE, AE1
- `sFonTurKod = 10` → HTTP 200 · 400 fon · 123 KATILIM · KATILIM olmayan örnek: AAJ, ABE, AE1
- `sFonTurKod = 11` → HTTP 200 · 400 fon · 123 KATILIM · KATILIM olmayan örnek: AAJ, ABE, AE1
- `sFonTurKod = 12` → HTTP 200 · 400 fon · 123 KATILIM · KATILIM olmayan örnek: AAJ, ABE, AE1
- `sFonTurKod = 13` → HTTP 200 · 400 fon · 123 KATILIM · KATILIM olmayan örnek: AAJ, ABE, AE1
- `sFonTurKod = 14` → HTTP 200 · 400 fon · 123 KATILIM · KATILIM olmayan örnek: AAJ, ABE, AE1
- `sFonTurKod = 15` → HTTP 200 · 400 fon · 123 KATILIM · KATILIM olmayan örnek: AAJ, ABE, AE1
- `sFonTurKod = 16` → HTTP 200 · 400 fon · 123 KATILIM · KATILIM olmayan örnek: AAJ, ABE, AE1
- `fonTurKod = 1` → HTTP 200 · 0 fon · 0 KATILIM · Index 0 out of bounds for length 0
- `fonTurKod = 2` → HTTP 200 · 0 fon · 0 KATILIM · Index 0 out of bounds for length 0
- `fonTurKod = 3` → HTTP 200 · 0 fon · 0 KATILIM · Index 0 out of bounds for length 0
- `fonTurKod = 4` → HTTP 200 · 0 fon · 0 KATILIM · Index 0 out of bounds for length 0
- `fonTurKod = 5` → HTTP 200 · 0 fon · 0 KATILIM · Index 0 out of bounds for length 0
- `fonTurKod = 6` → HTTP 200 · 0 fon · 0 KATILIM · Index 0 out of bounds for length 0
- `fonTurKod = 7` → HTTP 200 · 0 fon · 0 KATILIM · Index 0 out of bounds for length 0
- `fonTurKod = 8` → HTTP 200 · 0 fon · 0 KATILIM · Index 0 out of bounds for length 0
- `fonTurKod = 9` → HTTP 200 · 0 fon · 0 KATILIM · Index 0 out of bounds for length 0
- `fonTurKod = 10` → HTTP 200 · 0 fon · 0 KATILIM · Index 0 out of bounds for length 0
- `fonTurKod = 11` → HTTP 200 · 0 fon · 0 KATILIM · Index 0 out of bounds for length 0
- `fonTurKod = 12` → HTTP 200 · 0 fon · 0 KATILIM · Index 0 out of bounds for length 0
- `fonTurKod = 13` → HTTP 200 · 0 fon · 0 KATILIM · Index 0 out of bounds for length 0
- `fonTurKod = 14` → HTTP 200 · 0 fon · 0 KATILIM · Index 0 out of bounds for length 0
- `fonTurKod = 15` → HTTP 200 · 0 fon · 0 KATILIM · Index 0 out of bounds for length 0
- `fonTurKod = 16` → HTTP 200 · 0 fon · 0 KATILIM · Index 0 out of bounds for length 0
- `fonGrup = KATILIM` → HTTP 200 · 400 fon · 123 KATILIM · KATILIM olmayan örnek: AAJ, ABE, AE1
- `fonGrup = K` → HTTP 200 · 400 fon · 123 KATILIM · KATILIM olmayan örnek: AAJ, ABE, AE1
- `fonGrup = 1` → HTTP 200 · 400 fon · 123 KATILIM · KATILIM olmayan örnek: AAJ, ABE, AE1
- `fonGrup = 2` → HTTP 200 · 400 fon · 123 KATILIM · KATILIM olmayan örnek: AAJ, ABE, AE1
