# Validación de la entrega local

## Preparación para pruebas públicas en GitHub Pages · versión 0.5.1 · 2 de noviembre de 2026

- La compilación de Pages genera `site/index.html` e `index.html` autocontenidos, con los cinco módulos integrados y sin solicitudes a recursos externos. Tamaño observado: **149 968 bytes**.
- La suite completa contiene **53 pruebas**. En este entorno local pasaron **44**; las otras **9** no se pudieron completar porque el sandbox bloquea conexiones TCP a `127.0.0.1` (`EACCES`) y creación de enlaces simbólicos (`EPERM`). Los fallos de los lanzadores de Windows resultan del mismo bloqueo al iniciar el servidor. No se ocultan ni se presentan como aprobados.
- Las pruebas de bot, motor, sesión y empaquetado pasaron: **42 de 42**. Incluyen partidas completas de los cuatro niveles y ajustes de retroalimentación del Experto.
- El workflow de GitHub Actions ejecuta `npm test` en un runner Ubuntu antes de desplegar `site/`. La versión de escritorio se revisa al publicar; la prueba con teléfonos físicos queda pendiente.
- Los datos de prueba de cada jugador permanecen en el almacenamiento local de su navegador. El prototipo no recoge automáticamente resultados ni valoraciones.
- La valoración del Experto aparece dentro del resultado final, solo para partidas contra la máquina en nivel Experto. Cada partida la ofrece una sola vez; se puede omitir. Ya no interrumpe las jugadas.

## Retroalimentación local del Experto · versión 0.5.0 · 30 de octubre de 2026

Preferencias activa la retroalimentación del nivel Experto por defecto y permite apagarla. Después de cada jugada no terminal del bot se puede subir el reto, mantenerlo o bajarlo. El ajuste se guarda en las preferencias locales y modifica los límites de búsqueda: 4–24 candidatas y 3–14 respuestas estimadas. No entrena un modelo, no cambia reglas y no envía datos fuera del dispositivo. Se añadió la opción de restablecer el ajuste.

La validación actualizada de esta versión está resumida al inicio del documento. Esta nota histórica registra que el 30 de octubre todavía no se había ejecutado la suite para el flujo de retroalimentación. En 0.5.1, la pregunta se movió al resultado final de la partida.

## Actualización de dificultad Experto · versión 0.4.0 · 30 de octubre de 2026

Se incorporó el nivel Experto y se regeneró el HTML autónomo. El algoritmo hace una búsqueda heurística acotada y respeta la proyección pública del motor; no garantiza una victoria ni equivale a una búsqueda exhaustiva. En esta actualización no se ejecutaron pruebas automatizadas ni una revisión visual. Los resultados históricos que siguen corresponden a las versiones 0.2.0 y 0.3.0, y no validan este cambio.

Última presentación: versión 0.3.0 · 27 de octubre de 2026. Las pruebas funcionales de reglas registradas aquí pertenecen a la versión 0.2.0.

Esta actualización incorpora el perfil de reglas V2 solicitado, tres dificultades y una presentación vintage. Las partidas V1 guardadas mantienen sus reglas originales; es necesario iniciar una partida nueva para aplicar V2.

## Pruebas automáticas de la versión 0.2

Se ejecutó `node --test` con Node.js en Windows. Las pruebas del servidor requieren que el entorno permita abrir y consultar puertos locales.

| Área | Pruebas | Cobertura |
| --- | ---: | --- |
| Motor | 20 | Conservación de cartas, capturas, turnos, puntajes, cierre, rondas, cuatro iguales, cartón, vistas privadas, compatibilidad V1 e invariantes. |
| Máquina | 8 | Tres estrategias, decisiones legales, prioridad de victoria, riesgo de respuesta, protección de ronda y ausencia de acceso a información oculta. |
| Servidor y lanzador | 11 | Loopback, contenido y MIME, salud, métodos HTTP, rutas, enlaces simbólicos, puertos, opciones y reutilización del servidor propio. |
| Sesión | 8 | Recuperación de jugadas y repartos, comandos duplicados, guardados inválidos, fallos de almacenamiento, preferencias, dificultad y procedencia de la ronda. |
| Empaquetado | 5 | HTML autónomo, aislamiento de módulos, resolución de dependencias y rechazo de entradas incompatibles o recursos externos. |

Resultado: **52 pruebas aprobadas, 0 fallos, 0 omitidas**, en **2,805 segundos** según el registro de Node. El resultado exacto está en `evidencia/pruebas-v0.2.txt`. No es una medición de rendimiento en celulares.

Después del ajuste de texto del tutorial se repitieron las **5 pruebas de empaquetado**, todas aprobadas. Esta repetición no aumenta el número de pruebas distintas de la suite.

Las pruebas incluyen **120 partidas completas simuladas** del motor, con invariantes después de cada acción y un único ganador, y **12 partidas adicionales** de la máquina: cuatro por dificultad.

Casos específicos de las nuevas reglas comprobados automáticamente:

- Exactamente tres cartas del mismo valor al repartir forman una ronda y suman **2 puntos**, incluidos los marcadores de 30 y 38. Una ronda que alcanza 40 termina la partida.
- La caída inmediata por igualdad sobre la primera, segunda o tercera carta original de la ronda rival da la victoria aunque el marcador sea menor de 40.
- Recoger esa carta por suma, por escalera o por igualdad en un turno posterior no activa la victoria especial. La procedencia de ronda se reinicia en cada reparto y ciclo.
- La victoria por caída a la ronda termina una sola vez, incluso si se juega la última carta de la mano; no reparte de nuevo ni ejecuta el conteo del ciclo.
- Cuatro iguales conservan prioridad. Dos rondas que alcanzan 40 en el mismo reparto se resuelven según el asiento que empieza.
- Guardar y recuperar conserva la ronda, su procedencia y la dificultad. Un guardado V1 mantiene el límite anterior de ronda y no obtiene la nueva victoria especial.
- Fácil elige entre acciones legales al azar; Medio prioriza victorias y ganancias inmediatas; Difícil incorpora posibles respuestas y riesgo de exponer la ronda. Ningún nivel recibe la mano rival, el mazo futuro ni la ronda privada del contrario.

## Comprobaciones de interfaz de la versión 0.2

Se comprobó en el navegador integrado, mediante HTTP local:

- Presentación vintage con papel marfil, madera, paño verde y cartas ornamentadas.
- Selección de Fácil y Difícil, descripción de la estrategia e inicio de una partida con el nivel elegido.
- Jugada del participante, respuesta automática de la máquina y conservación del nivel al recargar y continuar.
- Reparto controlado con tres cincos: aviso de ronda en la mano de su propietario y **2 puntos** en el marcador.
- Cambio de participante en el modo de pasar el dispositivo, selección de la caída por igualdad y aviso previo de que esa jugada gana.
- Confirmación de la caída a la ronda: diálogo de victoria con el motivo correcto y marcador final **Joel 2 / Invitado 4**. La victoria no exige ni fabrica un marcador de 40.
- Guardado V1: aviso en el inicio, reglas que conservan la ronda solo por debajo de 30 puntos y ausencia de la victoria especial. El tutorial muestra el aviso de que la partida guardada usa el perfil anterior.
- Recorrido de las **ocho lecciones del tutorial** mediante los controles de la interfaz, con cierre correcto.
- Diseño V2 en ventanas de **360 × 800**, **390 × 844** y **1366 × 900 px**. El ancho del contenido coincidió con el ancho visible del documento: 345, 375 y 1351 px respectivamente, descontada la barra vertical. No se observó desbordamiento horizontal; las cinco cartas y el aviso de ronda encajaron en la mesa.
- HTML autónomo regenerado de **112 824 bytes**, con cinco módulos incorporados. Una copia exacta servida por HTTP local inició una partida en nivel Difícil, permitió realizar una jugada y recibió la respuesta de Don Jacinto. Al recargar y continuar, conservó el nivel y el historial de ambas jugadas. Los registros de errores y advertencias de la consola estuvieron vacíos durante esta comprobación.

Las capturas `evidencia/v0.2/caida-ronda.jpg` y `evidencia/v0.2/victoria-ronda.jpg` documentan la selección y el resultado del caso especial.

La presentación y adaptación de esta versión se documentan en `evidencia/v0.2/inicio-vintage.jpg`, `inicio-movil-360.jpg`, `mesa-movil-360.jpg`, `mesa-movil-390.jpg` y `mesa-escritorio-1366.jpg`, todas dentro de la misma carpeta.

## Revisión visual de la versión 0.3

La revisión actual se limita a la presentación de inicio y los puntos de quiebre indicados. No modifica ni vuelve a certificar la lógica de juego de la versión 0.2.

- Apariencia de inspiración Apple con fuentes del sistema, azul para acciones y focos, espacios amplios y controles redondeados. El CSS es propio.
- Apariencia clara u oscura según la preferencia del sistema, además de compatibilidad con `prefers-reduced-motion`.
- Menú superior en escritorio y navegación inferior en móvil; en pantalla pequeña, la preparación de la partida aparece antes de la ilustración.
- Ventanas revisadas: 360 × 800, 390 × 844 y 1366 × 900. El contenido midió 345, 375 y 1351 px de ancho respectivamente, descontada la barra vertical; no hubo desbordamiento horizontal.
- El botón **Repartir cartas** quedó dentro de la primera pantalla en los tres tamaños revisados. En celular se mantiene por encima de la navegación inferior.
- Capturas finales: `evidencia/v0.3/inicio-movil-360.png`, `evidencia/v0.3/inicio-movil-390.png` y `evidencia/v0.3/inicio-escritorio-1366.png`.
- El navegador de revisión estaba en modo oscuro. El modo claro está definido por la paleta base y el oscuro por la preferencia del sistema; no se emula un segundo tema de navegador en esta revisión. La compatibilidad en teléfonos físicos, lectores de pantalla y tiendas queda pendiente.

## Comprobaciones de la entrega anterior

La versión 0.1.0, del 16 de octubre de 2026, contó con **33 pruebas aprobadas** registradas en `evidencia/pruebas.txt`. Su revisión de interfaz incluyó:

- Selección, descarte, captura, respuesta automática, marcador y recuperación de una partida.
- Ciclo completo de 40 cartas, diálogo del cartón y comienzo del siguiente ciclo.
- Modo de dos personas, nombres, perfil de 4 puntos y manos ocultas entre turnos.
- Tutorial, reglas, preferencias y controles en pantallas pequeñas.
- HTML autónomo servido por HTTP local, con jugadas y sin errores de JavaScript observados.
- Escritorio de 1366 px y ventanas de 390/360 px sin desbordamiento horizontal.

Estas comprobaciones se conservan como antecedentes y no se presentan como una nueva revisión visual de todos esos recorridos en la versión 0.2.

## Alcance y pendientes

El navegador de automatización bloquea el protocolo `file://`; la apertura directa por doble clic no se pudo verificar con él. Las pruebas automatizadas del empaquetador comprueban que el HTML incorpora sus recursos sin dependencias externas. Los resultados de pruebas y navegador no certifican compatibilidad con todo dispositivo.

- Probar teléfonos y tabletas físicos, especialmente Safari/iOS y Chrome/Android, y accesibilidad con lector de pantalla.
- Confirmar el perfil de reglas con jugadores de la variante objetivo y ampliar los casos reales.
- Evaluar la dificultad con personas y medir el rendimiento en dispositivos móviles.
- Implementar y probar salas, transporte, reconexiones y privacidad por participante antes de anunciar multijugador cercano.
- Definir instalación, distribución, actualizaciones y soporte antes de publicar.

La entrega es un prototipo local funcional. No se considera una versión de producción ni una aplicación nativa publicada.
