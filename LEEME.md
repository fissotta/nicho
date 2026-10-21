# NICHO — una corriente de adaptación

Juego tranquilo de un jugador, al estilo *flOw*: eres una bacteria que nada, come y se divide mientras desciende por
ocho ambientes extremos reales. No hay "game over": la idea es mirar cómo un linaje se adapta a cambios de
**temperatura, pH y salinidad** con mecanismos evolutivos reales, con muy poco texto.

## Cómo correrlo
- Mac / Linux: en esta carpeta `python3 tools/serve.py` (o `python3 -m http.server 8000`) y abre http://localhost:8000
- Windows: `python -m http.server 8000`
- GitHub Pages: sube la carpeta a un repo (p. ej. `fissotta/nicho`) y activa Pages en la rama `main`, carpeta raíz. Hay `.nojekyll`.
- HTML + JavaScript puro, sin dependencias ni compilación. Funciona offline, en computador y en celular (táctil).

## Novedades v1.4
- Un poco más rápido (velocidad base +15 %).
- **Turbo estilo slither.io**: mantén el clic (espacio en teclado, botón ⚡ en celular). Gasta mucha energía (ATP): cada ~1 s se consume un nódulo de gen, empezando por el color que menos tienes, y esa adaptación se revierte (el nicho vuelve un paso atrás). Sin nódulos, gasta biomasa y luego tamaño.
- **Multicelulares gigantes y pacíficos** que pasan lentamente lejos (abajo, con su nombre) o muy cerca (arriba, desenfocados), según el ambiente: Volvox, rotíferos y pulgas de agua en la charca; nematodos en el Río Agrio; larvas de mosca de salmuera (Ephydridae) en las termas; peces en Vulcano y en el lago de soda (tilapias de Magadi); el caracol de pie escamoso (*Chrysomallon*) y camarones *Rimicaris* en Kairei; *Artemia* en el salar; tardígrados y nematodos en el permafrost. En la laguna del cráter (pH < 1, 46 °C) no pasa ninguno.

## Novedades v1.3
- **Las bacterias son unicelulares**: ya no se agregan células. Tu bacteria es una sola célula que crece y se vuelve más compleja: se alarga y ensancha, gana doble membrana, ribosomas, un nucleoide (ADN plegado) que crece, gránulos de reserva (PHB, polifosfato), **nódulos de color de los genes que adquieres flotando adentro**, **plásmidos** (anillos de ADN con cada gen nuevo) y **vesículas de membrana** que brotan de la superficie. Cada división deja una hija: si trae una mutación, aparece como un brote junto a tu célula hasta que la selección decide si se impone (barrido) o se pierde.
- **Cianobacteria (nuevo inicio, El Tatio)**: la única que es filamentosa, así que sí suma células al filamento, con heterocistos (fijan N₂) cada seis células, tilacoides, carboxisomas, vesículas de gas y vaina de mucílago. Hace fotosíntesis: la luz la alimenta de a poco. No tiene flagelos al inicio (se desliza).
- **Dos capas nuevas**: Géiseres de El Tatio (4.300 m, Chile; tapetes de cianobacterias hasta ~73 °C, el agua hierve a 86 °C) y la fuente hidrotermal somera de Isla Vulcano (Italia), hogar de la arquea hipertermófila *Pyrococcus furiosus* (óptimo 100 °C). Ahora son 10 mundos.

## Novedades v1.2
- **Elige tu inicio**: neutrófilo (charca), acidófilo (Río Agrio, Copahue), termófilo (Yellowstone) o psicrófilo (salmuera del Ártico). Si no eliges en 30 s, elige el azar. Tu bacteria aparece de golpe en el rincón de esa capa que mejor le acomoda, y desde ahí navegas a los otros nichos (subir ▲ / bajar ▼).
- **Genes por color**: rojas = calor, azules = frío, amarillas = ácido, violetas = alcalino, rosadas = sal, blancas = amplitud de nicho, verdes = defensa. El primer gen de cada tipo da un salto grande; cada bacteria más del mismo color corre tu nicho un poco más en esa dirección (tú eliges qué comer).
- **Guía de color**: las curvas del nicho se tiñen según tu adaptación (rojo si eres termófilo, azul si psicrófilo…). Si te falta tolerancia, la curva se enciende con el color que necesitas y las bacterias de ese color brillan con un anillo. Los portales muestran qué colores te faltan para el nicho de destino.
- **Forma (fenotipo), como en flOw**: células doradas entregan piezas: más flagelos (más rápido, flagelos laterales peritricos), pili tipo IV (la "boca" crece y atrae comida), capa S con ganchos tipo hami (los ciliados no te tragan, algunos fagos rebotan) y célula gigante tipo *Thiomargarita* (más grande, filamento más largo). La cabeza se va aguzando y el brillo crece.
- **Más diversidad**: diplococos, bacilos, vibrios, espirilos, estreptococos, *Stella* (estrella), arqueas cuadradas (*Haloquadratum*) y lobuladas (*Sulfolobus*); virus libres con cola, filamentosos, icosaédricos y en forma de limón.
- **Virus que se degradan**: si un fago no encuentra huésped o se aleja, su cápside se abre y se deshace (UV, proteasas).
- **Oleadas**: de vez en cuando pasa con la corriente una comunidad entera de un mismo color (a menudo del que te falta).
- **Hongos**: micelios con hifas que exudan carbono (rinde el doble) pero te enredan y te frenan; con 3 o más flagelos te enredas menos.

## Controles
- Nadas hacia el cursor o el dedo. Mantener el clic = turbo (cuesta genes). Teclado: WASD o flechas, espacio = turbo. En celular, botón ⚡.
- **N** (o el botón ◎): mapa del nicho. **M**: sonido. **ES/EN**: idioma. **i**: cómo se juega y fuentes.
- Orbe rojo ▼: ambiente más extremo. Orbe azul ▲: volver a la capa anterior. Cuando no se ven, una insignia en el borde de la pantalla y dos flechitas alrededor de tu bacteria apuntan hacia ellos, con el destino, sus condiciones (T, pH, sal), la distancia en µm y un punto de color que anticipa cómo te iría al llegar (verde bien, amarillo estrés, rojo muy difícil).
- El progreso se guarda solo (localStorage).

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

En la v1.3 se agregaron, entre Yellowstone y Kairei: Géiseres de El Tatio (62 °C, pH 7; hasta 86 °C) y la fuente hidrotermal somera de Isla Vulcano (100 °C; *Pyrococcus furiosus*, Fiala & Stetter 1986).

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

Microbial Ecophysiology Lab (Fundación Ciencia & Vida). Versión 1.4 — octubre 2026.
