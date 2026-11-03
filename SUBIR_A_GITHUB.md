# Publicar Cuarenta para pruebas de grupo

Esta entrega v0.5.0 está preparada para GitHub Pages. La publicación crea un sitio web estático: quienes tengan el enlace pueden jugar desde PC, Android o iPhone con un navegador actualizado. No requiere instalar una aplicación.

## 1. Crear o elegir el repositorio

Usa un repositorio de GitHub al que tengas acceso de escritura. Para pruebas sencillas con invitados, conviene que sea **público**. Si crearás uno nuevo, llámalo `cuarenta` y déjalo vacío, sin README, licencia ni `.gitignore` creados automáticamente.

## 2. Subir los archivos

1. Descarga y extrae `Cuarenta_GitHub_Pages_v0.5.0.zip` en una carpeta de tu computador.
2. Abre PowerShell en esa carpeta, donde deben verse `index.html`, `package.json`, `dist` y `.github`.
3. Si es un repositorio nuevo y vacío, ejecuta estos comandos, reemplazando `TU_USUARIO` por tu usuario de GitHub:

   ```powershell
   git init -b main
   git add .
   git commit -m "Publicar Cuarenta v0.5.0 para pruebas"
   git remote add origin https://github.com/TU_USUARIO/cuarenta.git
   git push -u origin main
   ```

   Si el repositorio ya contiene archivos o historial, copia el contenido de esta carpeta dentro de tu clon existente y crea un commit normal. No inicialices un segundo historial ni fuerces el push.

## 3. Activar GitHub Pages

1. En GitHub, abre el repositorio y ve a **Settings → Pages**.
2. En **Build and deployment → Source**, selecciona **GitHub Actions**.
3. Abre **Actions** y espera a que termine el flujo **Validate and deploy Cuarenta to GitHub Pages**. Se ejecuta al subir cambios a `main` y también puede iniciarse manualmente.
4. Cuando la ejecución finalice correctamente, GitHub mostrará el enlace en **Settings → Pages**. Para un repositorio de proyecto llamado `cuarenta`, suele tener el formato `https://TU_USUARIO.github.io/cuarenta/`.
5. Comparte ese enlace con el grupo. Si acabas de publicar, espera un momento y vuelve a cargarlo.

El flujo ejecuta `npm test`, prepara una página autocontenida y despliega el directorio `site`. Si la ejecución falla, abre el registro del paso rojo en **Actions**, corrige la causa y vuelve a subir el cambio.

## Qué pueden probar los participantes

- Contra la máquina en Fácil, Medio, Difícil y Experto.
- Retroalimentación de dificultad del bot en Experto.
- Dos personas pasando el mismo dispositivo.
- Ronda, caída a ronda, limpia, cartón, marcador, guardado local y reanudación.
- Pantallas de inicio y juego en PC y móvil.

Las partidas y preferencias viven en el almacenamiento local de cada navegador. No hay cuentas, servidor de juego ni multijugador en línea en esta versión. El guardado no se comparte entre los dispositivos de un grupo.

## Recolección de comentarios

Activa **Issues** en la configuración del repositorio y comparte con el grupo cómo reportar errores. La plantilla **Bug report** pide dispositivo, navegador, modo, pasos para reproducir y resultado esperado. Pide que no incluyan nombres reales, datos privados, contraseñas ni capturas con información personal.

## Validación de esta entrega

La compilación local generó la página de 149 KB sin recursos externos. El núcleo del juego, las sesiones, las reglas, las dificultades y la versión autocontenida pasaron 42 pruebas. En este entorno Windows, 9 de las 53 pruebas totales no pudieron completarse por restricciones del entorno al abrir sockets locales o crear enlaces simbólicos; el flujo de GitHub las vuelve a ejecutar en Ubuntu antes de publicar. La validación visual en teléfonos físicos sigue pendiente; el grupo podrá ayudar a cubrirla.
