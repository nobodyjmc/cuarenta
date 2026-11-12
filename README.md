# Cuarenta · Versión 0.12.1

Juego ecuatoriano de cartas para dos participantes en un solo dispositivo. Incluye las reglas de ronda, cuatro dificultades y retroalimentación local para calibrar Experto al final de cada partida, 2 de noviembre de 2026.

## Versión para probar en línea

Esta versión está preparada para GitHub Pages. En cada cambio de `main`, GitHub Actions ejecuta las pruebas, genera `site/index.html` y publica ese directorio junto con `site/assets/`. El comando `npm run prepare:pages` también genera el `index.html` de la raíz, que usa las pistas de `dist/assets/`. Para subir el proyecto y activar Pages, sigue [SUBIR_A_GITHUB.md](SUBIR_A_GITHUB.md). El enlace público aparecerá en **Settings → Pages** después de completar el primer despliegue.

### Guía rápida para el grupo

1. Abre el enlace en Chrome, Edge o Safari desde PC o celular.
2. Prueba **Contra la máquina** en Fácil, Medio, Difícil y Experto. En Experto, valora las jugadas para ajustar el reto.
3. Prueba **Dos jugadores** para pasar el dispositivo entre turnos.
4. Revisa las reglas de ronda: tres iguales al repartir suman 2 puntos; una caída inmediata a una carta de la ronda rival gana la partida.
5. Recarga la página para comprobar que la partida puede continuar en el mismo navegador.

Para informar un error, abre **Issues → Bug report** en el repositorio e incluye dispositivo, navegador, modo/nivel, pasos para reproducir y resultado esperado. Evita publicar datos personales.

### Privacidad y límites de esta prueba

Las partidas, las preferencias y las valoraciones del bot se guardan únicamente en el almacenamiento local de cada navegador. El juego no tiene cuentas, servidor de partidas, analítica ni telemetría; por eso las valoraciones no llegan automáticamente al equipo del proyecto. No hay multijugador en línea todavía. Esta entrega es un prototipo de prueba, no una aplicación publicada en App Store o Play Store.

Las compilaciones de Pages y las pruebas se describen en [VALIDACION.md](VALIDACION.md); la arquitectura y el uso local se explican en el resto de este README.

## Jugar ahora

1. Abre **Jugar_Cuarenta.html** con doble clic en un navegador moderno de escritorio.
2. Elige **Contra la máquina** o **Dos jugadores**.
3. Elige **Fácil, Medio, Difícil o Experto** cuando juegues contra la máquina. En **Ajustes de partida** puedes cambiar los nombres y elegir **2** o **4 puntos** por caída y limpia juntas. Pulsa **Repartir cartas** para empezar.
4. Selecciona una carta y confirma la jugada. Si admite varias capturas, cambia entre las opciones antes de confirmar.
5. En **Vista de la mesa**, elige **Horizontal** o **Vertical** antes de repartir o durante la partida. En el celular, tocar **Horizontal** gira la vista completa del juego y **Vertical** la devuelve a la vista normal. El navegador recuerda tu elección.
6. La mano, las cartas de la mesa, el marcador y el botón de jugar comparten pantalla. Pulsa el trofeo para abrir el historial, el marcador detallado y las reglas.

Las caídas y las victorias tienen un efecto sobre la mesa. Puedes desactivarlo en **Preferencias → Reducir movimiento**. El aviso y las cartas de una ronda solo aparecen en la vista de quien la recibe. Los puntos se suman al marcador.

En **Diseño de mesa** puedes combinar ocho colores con ilustraciones de Quito, Guayaquil, Cuenca, Loja, Manta y Ambato. La vista previa se actualiza al instante. El diseño se guarda en el navegador y aparece en el inicio, en las partidas y en el tutorial. Las cartas se animan al repartir y al entrar a la mesa. Las capturas muestran cuántas cartas se recogieron. El juego respeta la reducción de movimiento del sistema y la de Preferencias.

Pulsa la nota musical o activa **Preferencias → Música de fondo** para escuchar las versiones instrumentales de *Nuestro Juramento* y *Reminiscencias*. La pista elegida se repite durante la partida y su volumen se ajusta por separado de los efectos de las cartas. La música se pausa al salir de la pestaña. La pista, el volumen y la activación se guardan en el navegador.

Una captura por suma empieza con **exactamente dos cartas numéricas** de la mesa. Por ejemplo, un 6 recoge 2 + 4; A + 2 + 3 no vale aunque dé 6. Después de la suma puedes recoger las cartas consecutivas de la escalera. El motor y el tutorial aplican la misma regla, con las opciones de ronda y caída propias de esta mesa. La mecánica de suma de dos cartas está descrita en el [reglamento del Torneo Internacional de Cuarenta](https://es.scribd.com/document/612816076/REGLAS-DEL-TORNEO-DE-CUARENTA).

Desde el inicio, toca **Aprender a jugar** para hacer ocho retos guiados. Practica dejar una carta, recoger por igualdad o suma, seguir la escalera, hacer caída y limpia, reconocer una ronda y cerrar con 40. En cada reto puedes pedir una **Pista** y volver a intentar la jugada. Al terminar puedes **Jugar en Fácil** contra Don Julio o abrir **Más retos** para practicar las reglas restantes. La práctica usa la variante de puntos de caída y limpia y conserva tu partida guardada.

El archivo contiene todo el juego: no necesita instalación, conexión, cuentas ni recursos externos. Para volver, abre el mismo archivo en el mismo navegador. Si este permite el almacenamiento local, aparece **Continuar partida**. El guardado de archivos locales depende del navegador; mover el HTML, usar modo privado o borrar los datos puede impedir recuperar la partida. El juego avisa si no puede guardar.

La interfaz se adapta a celulares, tabletas y escritorio, y sigue la preferencia de apariencia clara u oscura del sistema. En esta entrega se revisó el diseño en ventanas de 360, 390 y 1366 px; falta validarla en teléfonos Android/iPhone físicos. Algunos móviles no ejecutan HTML desde su visor de archivos: esto todavía no es una aplicación instalable de tienda.

## Otra forma de abrirlo en Windows

**Iniciar_Cuarenta.cmd** abre la versión modular en `http://127.0.0.1:4173`. Mantén la carpeta completa. Requiere Node.js 20 o superior; el lanzador también reconoce el Node incluido con Codex en este equipo. No instala programas. Esta dirección ofrece un origen estable para el guardado en ese navegador.

El servidor escucha únicamente en el equipo local. No habilita conexiones desde otros dispositivos. Si necesitas otro puerto: `powershell -ExecutionPolicy Bypass -File .\Iniciar_Cuarenta.ps1 -Port 4174`. Ese cambio de política se limita al proceso del lanzador.

Para una sesión de servidor con cierre visible, ejecuta `node scripts/serve.mjs` y termina con Ctrl+C. El lanzador de doble clic deja el pequeño servidor en segundo plano hasta que se cierre su proceso o el equipo; el HTML independiente no usa servidor.

## Incluido

- Partida a 40 puntos contra Don Julio, una máquina con cuatro estrategias y nombre personalizable.
- Dos personas en el mismo dispositivo, con una pantalla de entrega que oculta ambas manos entre turnos.
- Baraja de 40 cartas, capturas por igualdad y suma, escalera, caída, limpia, ronda, cartón, límite de 30 por cartón y cierre desde 38.
- Elección previa de caída y limpia juntas por 2 o 4 puntos; reglas fijas durante la partida.
- Opciones de captura explícitas, marcador, registro de jugadas, conteo al acabar cada ciclo y revancha.
- Guardado automático, recuperación, minijuego de aprendizaje, reglas consultables, sonidos opcionales, reducción de movimiento y velocidad de la máquina.
- Diseño de inspiración Apple con tipografía del sistema, azul de acción, jerarquía simple, cartas protagonistas, apariencia clara u oscura automática, controles táctiles y diseño adaptable.

## Presentación: versión 0.3

La versión 0.3 renueva la presentación sin cambiar las reglas de Cuarenta ni las rutas del juego. El inicio da prioridad a elegir modalidad, nivel, nombre y puntos de caída; las cartas y la mesa conservan su protagonismo en una superficie oscura. Botones redondeados, espacios amplios, foco visible, paleta azul y soporte para movimiento reducido completan la interfaz. El modo claro u oscuro se ajusta a la preferencia del dispositivo.

El estilo usa CSS propio y fuentes instaladas en el sistema. Es una referencia visual, no una interfaz oficial ni un producto afiliado a Apple.

## Dificultad Experto: versión 0.4

**Experto** amplía la búsqueda de Difícil: primero prioriza jugadas legales, luego estima respuestas del rival con probabilidades basadas en cartas desconocidas y analiza hasta 12 candidatas, las 8 respuestas más fuertes por escenario y una contra-jugada propia. El cálculo está acotado para mantenerlo utilizable en dispositivos modestos. Usa solo la mano propia, la mesa y la información pública; no consulta la mano rival ni el orden real del mazo. Es una heurística, no un jugador perfecto, y no garantiza la victoria. La dificultad se conserva al reanudar y en una revancha.

**Fácil** elige al azar entre acciones legales. **Medio** prioriza victorias, puntos y cartas recogidas. **Difícil** estima respuestas inmediatas y protege cartas de ronda. El nivel describe la estrategia de la máquina, no una garantía de ganar o perder. El tiempo de respuesta se ajusta por separado en Preferencias.

## Retroalimentación del bot: versión 0.5.1

En Preferencias está activada **Retroalimentación del Experto**. Al terminar una partida contra Experto, la pantalla del resultado pregunta cómo estuvo el reto. Puedes elegir **Demasiado fácil**, **Buen reto** o **Demasiado difícil**, u omitir la valoración. Cada partida muestra la pregunta una sola vez y no interrumpe las jugadas. Las opciones para aumentar o reducir el reto cambian el alcance local de búsqueda; “Buen reto” lo mantiene. La búsqueda estándar considera hasta 12 candidatas y 8 respuestas del rival; el ajuste puede cambiar esos límites entre 4 y 24 candidatas y 3 y 14 respuestas. **Restablecer ajuste** vuelve al valor inicial. El ajuste se guarda en las preferencias de este navegador y no se transmite.

La retroalimentación calibra cuánto explora la heurística; no entrena un modelo de IA ni promete que cada ajuste sea mejor. Puedes apagar las solicitudes en Preferencias. El ajuste solo se usa en Experto y no altera las reglas de Cuarenta.

## Rondas y reglas: versión 0.2

El nuevo perfil **cuarenta-local-v2-combo-2/4** aplica las reglas solicitadas:

- Exactamente tres cartas del mismo valor en un reparto forman una **ronda**: **+2 puntos** automáticos, también a partir de 30 y 38. Si llega a 40, gana. Cuatro iguales tienen prioridad sobre la ronda.
- Si el rival juega una de las tres cartas originales de su ronda y le haces una **caída inmediata por igualdad**, ganas la partida con cualquier marcador. Puede ser su primera, segunda o tercera carta de la ronda.
- No cuenta recogerla por suma, por escalera, en un turno posterior o en otro reparto. Cada reparto registra sus propias rondas.
- Los puntos de la captura se conservan en el marcador; no se inventa un resultado de 40 cuando la victoria es por caída a la ronda. El resultado explica el motivo.
- Si ambos llegan a 40 por ronda en el mismo reparto, tiene prioridad el asiento que empieza. La limpia no cierra desde 38; sí lo hacen la caída y los 2 puntos de una ronda nueva.

La dificultad se guarda con la partida y se conserva en la revancha. Las partidas V1 ya guardadas conservan su reglamento anterior; el inicio avisa cuando ocurre. **Inicia una partida nueva para usar las reglas V2.** No se modifica el SRS histórico: este documento registra la ampliación solicitada.

El resto de reglas permanece: cartón limitado a 30, 2 al siguiente repartidor en empate, sobrantes descartadas y cuatro iguales como victoria directa. Las variantes familiares o de torneo pueden añadirse como otros perfiles. El detalle se consulta dentro del juego.

## Estructura para continuar el desarrollo

| Archivo | Responsabilidad |
| --- | --- |
| `dist/js/engine.js` | Estado serializable, reglas, turnos, revisión de comandos y vista filtrada por jugador. No depende del DOM. |
| `dist/js/bot.js` | Selección de jugadas usando únicamente información visible para ese jugador. |
| `dist/js/session.js` | Sesión en un dispositivo, validación del guardado y persistencia local. |
| `dist/js/cards.js` | Baraja vectorial, reversos y etiquetas de accesibilidad. |
| `dist/js/app.js` | Pantallas, interacción, tutorial y flujo de la partida. |
| `dist/js/tutorial.js` | Retos de aprendizaje y comprobación de jugadas con el motor. |
| `dist/styles.css` | Estilo y adaptación a tamaños de pantalla. |
| `scripts/serve.mjs` | Servidor estático opcional limitado a loopback. |
| `scripts/build-standalone.mjs` | Empaqueta los módulos y estilos en un HTML sin dependencias. |
| `tests/` | Pruebas del motor, sesión, servidor, lanzador y empaquetado. |

Sin paquetes de terceros ni paso de instalación. Con Node.js 20+ disponible:

```powershell
node --test
node scripts/build-standalone.mjs
node scripts/serve.mjs
```

Edita los archivos de `dist/` y vuelve a construir el HTML. No edites solo el HTML generado: los cambios se perderían en el siguiente empaquetado. `dist/index.html` usa módulos y debe abrirse mediante el servidor. Para jugar sin conexión en un solo archivo, ejecuta `npm run build` y abre **Jugar_Cuarenta.html** con doble clic.

## Evolución a dispositivos cercanos

La separación del motor permite conservar reglas y pruebas. El siguiente hito requiere implementar un anfitrión de partida, transporte de comandos y vistas privadas por jugador. No está activado en este prototipo.

1. **Sala en una red local:** un anfitrión valida los comandos y distribuye una vista filtrada a cada participante. Unión por código/QR, identidad de asiento y comprobación de versión de reglas.
2. **Resistencia a desconexiones:** revisiones y comandos con identificador único, rechazo de repetidos, reanudación por asiento y sincronización de una instantánea. Definir qué pasa si se apaga el anfitrión.
3. **Distribución móvil:** decidir PWA mediante HTTPS o contenedor nativo. Probar Android/iOS reales, instalación, suspensión, almacenamiento, área segura, orientación y gestos.
4. **Más modalidades y juego en línea:** añadir equipos de cuatro jugadores, servidor autoritativo remoto, salas y políticas de reconexión. Son ampliaciones con nuevas pruebas, no un interruptor ya implementado.

Para una primera sala cercana se propone Wi-Fi/LAN. Bluetooth y Wi-Fi Direct no están implementados y requieren una decisión de plataforma. El servidor actual no se debe exponer a Internet como servidor de partidas. En un único dispositivo, quien controle el navegador puede inspeccionar el estado local completo; la vista filtrada protege la interfaz y el bot, no constituye seguridad multijugador.

## Alcance y validación

Consulta **VALIDACION.md** para las comprobaciones de esta entrega y sus límites. El SRS original de PC/móvil permanece en la carpeta superior; esta entrega concreta su primera fase local. No incluye cuentas, pagos, rankings, multijugador entre dispositivos, backend de producción ni publicación en tiendas.
