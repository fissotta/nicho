# NICHO — una corriente de adaptación

Juego tranquilo de un jugador, al estilo *flOw*: eres una bacteria que nada, come y se divide mientras desciende por
ocho ambientes extremos reales. No hay "game over": la idea es mirar cómo un linaje se adapta a cambios de
**temperatura, pH y salinidad** con mecanismos evolutivos reales, con muy poco texto.

## Cómo correrlo
- Mac / Linux: en esta carpeta `python3 tools/serve.py` (o `python3 -m http.server 8000`) y abre http://localhost:8000
- Windows: `python -m http.server 8000`
- GitHub Pages: sube la carpeta a un repo (p. ej. `fissotta/nicho`) y activa Pages en la rama `main`, carpeta raíz. Hay `.nojekyll`.
- HTML + JavaScript puro, sin dependencias ni compilación. Funciona offline, en computador y en celular (táctil).

## Controles
- Nadas hacia el cursor o el dedo. Clic / toque = impulso. Teclado: WASD o flechas, espacio = impulso.
- **N** (o el botón ◎): mapa del nicho. **M**: sonido. **ES/EN**: idioma. **i**: cómo se juega y fuentes.
- Orbe rojo: ambiente más extremo. Orbe azul: volver a la capa anterior. El progreso se guarda solo (localStorage).

## Qué es real en el juego
| Mecánica | Concepto | Base |
|---|---|---|
| Curvas abajo a la izquierda | Nicho fundamental en 3 ejes; la térmica es asimétrica (cae más rápido sobre el óptimo) | Huey & Kingsolver 1989; Levins 1968 |
| Barra especialista ↔ generalista | Amplitud de nicho con compromiso: más amplitud = menos rendimiento máximo | Levins 1968; Kassen 2002; Bennett & Lenski 2007 |
| Cada división puede mutar (al azar) | La mutación es aleatoria; la selección no | Gerrish & Lenski 1998 |
| La mutación se evalúa en el ambiente que viviste | Barrido selectivo, selección purificadora, deriva | Gerrish & Lenski 1998 |
| Varias mutaciones a la vez: solo una gana | Interferencia clonal | Gerrish & Lenski 1998 |
| Bajo estrés mutas más | Mutagénesis inducida por estrés (respuesta SOS) | — |
| El óptimo se corre un poco solo, y se devuelve | Aclimatación / plasticidad fisiológica (adaptación homeoviscosa) | Sinensky 1974 |
| Eventos lentos (deshielo, pulsos fumarólicos, evaporación…) | Si el cambio es lento, la evolución lo sigue: rescate evolutivo | Bell & Gonzalez 2009; Lindsey et al. 2013 |
| Comer otras bacterias da sus genes | Transferencia horizontal (transformación con ADN de células lisadas) | — |
| Genes: chaperonas, girasa reversa, lípidos tetraéter, bombas de H⁺, antiportador Na⁺/H⁺, ectoína, "salt-in", anticongelantes, desaturasa, CRISPR, cápsula, latencia | Adaptaciones reales de extremófilos | Baker-Austin & Dopson 2007; Oren 2008; Forterre 2002; Barrangou 2007 |
| Ciliados que pastorean | Depredación por tamaño; filamentos largos escapan | Pernthaler 2005 |
| Fagos cuando eres abundante | "Kill the winner" | Thingstad 2000 |
| Última célula → latencia, sube una capa | Dormancia; cuello de botella que selecciona a las variantes más tolerantes | — |

## Las ocho capas (valores del núcleo; la entrada de cada capa es un ecotono más suave)
1. Charca templada — 22 °C, pH 7,2, 0,1 % NaCl
2. Río Agrio Superior, Copahue — 10 °C, pH 2,6 (mediciones de campo MEL 2019–2020), con vertiente caliente de 45 °C
3. Laguna del cráter, Copahue — 45,6 °C, pH 0,84 (medición de campo)
4. Fuente termal ácida, Norris (Yellowstone) — 78 °C, pH 2,5 (*Sulfolobus*)
5. Chimenea hidrotermal, campo Kairei — 105 °C, parche a 122 °C (*Methanopyrus kandleri* 116, Takai et al. 2008)
6. Lago de soda, Magadi (Kenia) — 35 °C, pH 10,5, 18 % sal, con vertientes calientes (*Natronomonas*)
7. Salmuera del Salar de Atacama — 20 °C, pH 7,5, 29 % sal (*Haloquadratum walsbyi*)
8. Salmuera del permafrost, Ártico canadiense — −10 °C, 16 % sal (*Planococcus halocryophilus*, crece a −15 °C)

El mapa del nicho (N) ubica a 15 organismos reales en el plano temperatura × pH y en la banda de sal, junto a tu
linaje y su trayectoria evolutiva.

## Estructura
- `index.html` — pantalla, estilos, capas de interfaz
- `js/data.js` — capas, genes, organismos reales, textos ES/EN y fuentes
- `js/audio.js` — música ambiental generativa (Web Audio): un modo por capa, notas al comer, reverb
- `js/game.js` — nado, nicho y aptitud, mutación/selección, HGT, depredadores, render y mapa del nicho
- `tools/serve.py` — servidor local

## Simplificaciones (a propósito)
- La aptitud es el producto de tres curvas (T, pH, sal); en la naturaleza los ejes interactúan (p. ej., la sal baja el punto de congelación).
- Los genes "adquiridos" tienen efectos grandes para que el viaje sea jugable; las mutaciones son pequeñas y al azar.
- Las presas no se "comen" literalmente en bacterias (salvo depredadoras como *Bdellovibrio*): el juego lo usa como metáfora de transformación natural con ADN libre.

## Fuentes
Lista completa dentro del juego (botón **i**) y en `js/data.js` (`SOURCES`).

Microbial Ecophysiology Lab (Fundación Ciencia & Vida). Versión 1.0 — octubre 2026.
