# CONTEXTO COMPLETO — REDIA Editorial App
## Pegar al inicio de cualquier conversación nueva con Claude

---

## QUIÉN SOY

Soy Yojana González (yojanagonzalezsepulveda@gmail.com), trabajo en **REDIA** (redia.pro), el Centro de Inteligencia Acuícola de Chile. REDIA es una plataforma de noticias, directorio y mercado para el sector acuicultor chileno. Operada por HubChile SPA, Putemun, Chiloé.

---

## QUÉ ES REDIA EDITORIAL

Una app HTML standalone (se abre en el navegador con doble clic, sin servidor) que funciona como centro editorial completo. Tiene 5 pestañas:

1. **Bandeja editorial** — informes generados por el worker automático diario
2. **Búsqueda manual** — genera un informe al instante sobre cualquier tema
3. **Crear contenido** — crea contenido propio (noticias, entrevistas, mercado, patrocinado)
4. **Credenciales** — configura todas las integraciones en un solo lugar
5. **Configuración editorial** — ajusta voz, audiencia, estructura, análisis, fuentes, palabras prohibidas

---

## IDENTIDAD VISUAL DE REDIA

- **Colores:** Púrpura `#9333ea` (marca) + Teal `#14b8a6` (acento)
- **Gradiente:** `linear-gradient(135deg, #9333ea, #14b8a6)`
- **Tipografía:** Inter (Google Fonts), pesos 400-900
- **Logo:** "RED" en `#9333ea` + "IA" en `#14b8a6`, peso 900
- **Fondo:** `#f8fafc` (slate-50)
- **Cards:** border-radius 16-24px, sombras sutiles, bordes `#e2e8f0`
- **Texto principal:** `#0f172a` · **Secundario:** `#64748b`

---

## ARCHIVOS DEL PROYECTO

Carpeta local en Mac: `redia_editorial.app/` (también llamada `redia-autonomo/`)

| Archivo | Qué hace |
|---------|----------|
| `bandeja-editorial.html` | **App principal** — todo en uno |
| `worker.js` | Script Node.js — corre automáticamente a las 8am vía GitHub Actions |
| `package.json` | Configuración del worker |
| `.github/workflows/redia-diario.yml` | GitHub Actions — L-V 8am Chile (11:00 UTC) |
| `google-apps-script.js` | Puente entre app y Google Sheets (ya implementado) |
| `INSTALACION.md` | Guía de instalación paso a paso |
| `CONTEXTO_REDIA.md` | Este archivo |

---

## ARQUITECTURA

```
GitHub Actions (8am L-V)
    → worker.js
        → Claude API (busca noticias + genera 3-5 informes)
        → Google Sheets (guarda los informes)
            → bandeja-editorial.html (reviso, edito, apruebo)
                → Publicar en redia.pro / LinkedIn / Facebook
                → Descargar HTML para redia.pro
```

---

## INTEGRACIONES Y CREDENCIALES

### API Anthropic (Claude)
- Búsqueda web + generación de informes
- Costo: ~$15-20 USD/mes para uso normal
- Key: empieza con `sk-ant-...`
- Obtener en: console.anthropic.com → API Keys
- Usada en: GitHub Secrets (worker) + campo en app (búsqueda manual y crear contenido)

### Google Sheets
- Sheet ID: `1YKLsl9kN8P5hKGtFNybdvIjMSwKAFz8Z_6T4gQe3lPk`
- Sheet URL: `https://docs.google.com/spreadsheets/d/1YKLsl9kN8P5hKGtFNybdvIjMSwKAFz8Z_6T4gQe3lPk/edit`
- Apps Script URL (implementada): `https://script.google.com/macros/s/AKfycbyWe1LI6mSqSj8xyJYbIZLC92nVGxG1z2MS71xg7jyb3-XWOxdTv8fNeSbiteG2MoO0/exec`
- Hoja: "Informes" (se crea automáticamente)
- Google account: yojanagonzalezsepulveda@gmail.com

### PocketBase (publicar.redia.pro)
- URL: `https://publicar.redia.pro`
- Panel admin: `publicar.redia.pro/_/`
- Usuario normal (NO admin): info@redia.pro / Redia12#q54dc.
- **Las credenciales de admin las tiene el desarrollador del servidor** — pendiente obtener
- Colección de noticias: `post`
- Campos clave de la colección `post`:
  - `titulo` — título del artículo
  - `descripcion_corta` — bajada
  - `contenido` — cuerpo HTML
  - `tipo` — "noticia", "mercado", "normativa", "tecnologia", "sostenibilidad", "oportunidad", "entrevista", "patrocinado"
  - `publicado` — boolean (true = visible en web)
  - `slug` — URL del artículo
  - `fecha_publicacion` — fecha
  - `Tags` — array de strings
  - `imagen` — archivo de imagen
  - `audio` — archivo de audio
  - `verificationLevel` — 1-4

### Gemini (Google AI Studio)
- Para generar imágenes automáticamente
- Tier gratuito disponible en aistudio.google.com/apikey
- Key: empieza con `AIza...`
- Yojana ya tiene su API key de Gemini

### GitHub
- Yojana tiene cuenta en github.com
- Repositorio: `redia-autonomo` (pendiente crear y subir archivos)
- GitHub Actions: gratuito (2000 min/mes)

### LinkedIn
- Publicar desde: Página de empresa REDIA
- Requiere: Access Token + Organization ID de la página
- Configurar en: linkedin.com/developers → crear app
- Pendiente configurar

### Facebook
- Publicar desde: Página de empresa REDIA
- Requiere: Page Access Token + Page ID
- Configurar en: developers.facebook.com → crear app → Pages API
- Pendiente configurar

### YouTube
- No publica video automáticamente (la app genera el guión)
- La app prepara: título, descripción optimizada y tags listos para pegar en YouTube Studio

---

## REDIA.PRO — ESTRUCTURA DE LA WEB

- **Tecnología:** Next.js + React + Vercel
- **Backend:** PocketBase en publicar.redia.pro
- **Secciones:** Inicio · Noticias · Entrevistas · Mercado · Directorio
- **URL:** redia.pro

---

## TIPOS DE CONTENIDO QUE PUBLICA REDIA

1. **Noticias/Informes** — análisis e informes del sector (generados por IA o redacción propia)
2. **Entrevistas** — conversaciones con protagonistas del sector acuícola
3. **Avisos de Mercado** — ofertas, proyectos, alianzas del sector
4. **Contenido patrocinado** — clientes y aliados con tono editorial
5. **Búsqueda automatizada** — el worker genera 3-5 noticias diarias automáticamente

---

## ESPECIES QUE CUBRE REDIA

Salmón Atlántico · Trucha arcoíris · Mitílido/Choritos · Ostra Chilena · Ostra Japonesa · Ostión del Norte · Algas marinas · Erizo de mar · Abalón · Otras especies acuícolas

## FOCOS TEMÁTICOS

Contingencia nacional · Tecnología e innovación · Normativa y regulación · Comunidad y territorio · Medio ambiente · Sostenibilidad · Mercado internacional · Negocios e inversiones · Estadísticas y producción · Fiscalización y sanciones · I+D y ciencia · Empleo · Sanidad acuícola · Exportaciones

---

## REGLAS EDITORIALES (solo para el código, no mostrar en la app)

- **Nunca citar como fuente:** AmiChile ni Intemit (se pueden leer pero nunca referenciar)
- **Palabras prohibidas:** cabe destacar · es importante señalar · en el contexto de · en el marco de · sin lugar a dudas · robusto · transformador · paradigma · sin precedentes · potenciar · sinergia · cabe mencionar · vale la pena señalar
- **El texto debe sonar humano** — no debe parecer generado por IA
- **Audiencia mixta:** pescadores artesanales reconvertidos → técnicos → gerentes → dueños de empresas acuícolas
- **Lenguaje:** técnico pero claro y directo

## FUENTES QUE CONSULTA EL SISTEMA

Aqua.cl · MundoAcuícola · Intesal · SalmonExpert · SERNAPESCA · SUBPESCA · Salmón Chile · FAO · Globefish · Eurofish · IntraFish · UACH · UCT · IFOP · CERMAQ · Mowi Chile · Gobierno Regional Los Lagos · Gobierno Regional Aysén · Municipalidades costeras · SNA · ProChile · El Llanquihue · Diario de Aysén · La Discusión · Mundo Marítimo · Revista Aqua

---

## MÓDULO CREAR CONTENIDO (pestaña 3)

4 modos de creación propia:

**Noticia/Informe propio:**
- Yojana trae notas, ideas o borrador en cualquier formato
- IA lo desarrolla como publicación estratégica REDIA
- Puede buscar en web para enriquecer si falta contexto

**Entrevista:**
- Formato varía: texto, transcripción, notas, Q&A
- IA escribe intro del entrevistado + edita formato periodístico + cierre editorial
- Publicar en colección `post` con tipo "entrevista"

**Aviso de Mercado:**
- Describe oferta, proyecto o alianza
- IA redacta con tono editorial concreto, no publicitario
- Publicar en colección `post` con tipo "mercado"

**Contenido patrocinado:**
- Describe cliente y mensaje
- IA escribe como nota editorial de valor, no como anuncio
- Al final indica "Contenido patrocinado por [cliente]"

---

## FLUJO COMPLETO DE PUBLICACIÓN

```
Generar informe (automático 8am o manual)
    → Revisar en bandeja editorial
    → Editar si algo no quedó bien (pestaña Editar en cada card)
    → Presionar "Publicar"
        → Seleccionar plataformas (toggles):
            ✓ redia.pro — publica directo en PocketBase
            ✓ LinkedIn — página empresa REDIA (cuando esté configurado)
            ✓ Facebook — página empresa REDIA (cuando esté configurado)
            ✓ YouTube — entrega título, descripción y tags listos
        → Todo incluye link a redia.pro automáticamente
    → Historial registra todo lo publicado
```

---

## ESTADO DEL PROYECTO (16 marzo 2026)

### Completado ✓
- App `bandeja-editorial.html` completa con 5 pestañas
- `worker.js` listo para GitHub
- `google-apps-script.js` implementado en Google Sheets
- Apps Script URL funcionando
- Google Sheet creada
- `.github/workflows/redia-diario.yml` listo
- `INSTALACION.md` completa
- Módulo publicar en redia.pro (botón + modal)
- Módulo publicar en LinkedIn (listo, pendiente credenciales)
- Módulo publicar en Facebook (listo, pendiente credenciales)
- Módulo YouTube (entrega paquete listo)
- Historial de publicaciones
- Pestaña Credenciales centralizada
- Módulo Crear contenido (4 tipos)
- Generación de imágenes con Gemini

### Pendiente ⏳
- Obtener API key de Anthropic (consola caída al momento — probar de nuevo)
- Probar búsqueda manual con API key real
- Crear repositorio `redia-autonomo` en GitHub
- Subir 4 archivos a GitHub
- Configurar 5 GitHub Secrets
- Probar worker con "Run workflow"
- Obtener credenciales admin de PocketBase del desarrollador
- Configurar LinkedIn (crear app en linkedin.com/developers)
- Configurar Facebook (crear app en developers.facebook.com)

---

## PRÓXIMOS PASOS EN ORDEN

1. **console.anthropic.com** → crear API key → cargar $20 USD
2. Abrir `bandeja-editorial.html` → pestaña Búsqueda manual → pegar key → probar
3. Pestaña Credenciales → configurar redia.pro (necesita credenciales admin PocketBase)
4. Probar publicación completa en redia.pro
5. GitHub → crear repositorio `redia-autonomo` (privado)
6. Subir archivos: `worker.js`, `package.json`, `bandeja-editorial.html`, `INSTALACION.md`
7. Crear carpeta `.github/workflows/` y subir `redia-diario.yml`
8. GitHub Settings → Secrets → agregar 5 variables:
   - `ANTHROPIC_API_KEY` = tu key sk-ant-...
   - `POCKETBASE_URL` = https://publicar.redia.pro
   - `POCKETBASE_EMAIL` = email admin PocketBase
   - `POCKETBASE_PASSWORD` = contraseña admin PocketBase
   - `GEMINI_API_KEY` = tu key AIza...
9. GitHub Actions → Run workflow → verificar que termina en verde
10. Verificar que llegan informes a Google Sheets
11. Cuando tenga credenciales admin PocketBase → configurar en app → probar publicación

---

## COSTOS MENSUALES

| Servicio | Costo |
|----------|-------|
| Plan Pro Claude (conversar + desarrollar) | $100 USD/mes (ya pagado) |
| API Anthropic para la app | ~$15-20 USD/mes |
| GitHub Actions | Gratis |
| Google Sheets | Gratis |
| Gemini imágenes | Gratis (tier gratuito) |
| **Total adicional** | **~$15-20 USD/mes** |

---

## CÓMO HACER CAMBIOS

**Cambios editoriales (tono, audiencia, fuentes, palabras prohibidas):**
→ Pestaña "Configuración editorial" en la app — sin tocar código

**Cambios técnicos (nueva funcionalidad, diseño, lógica):**

Opción A — En este chat:
Pegar este documento + describir el cambio en español. Claude genera el archivo actualizado.

Opción B — Claude Code en terminal:
```bash
cd ~/ruta/redia_editorial.app
claude
# Pegar este documento
# Describir el cambio
```

---

## NOTAS IMPORTANTES

- La app es un solo archivo HTML — no requiere servidor, se abre con doble clic
- Todo se guarda en localStorage del navegador (configuración, credenciales, API keys)
- Los informes se guardan en Google Sheets y se sincronizan con la app
- El worker de GitHub Actions es independiente de la app — corre solo cada mañana
- Para usar la búsqueda manual NO se necesita GitHub ni PocketBase — solo la API key de Anthropic

---

*Última actualización: 16 marzo 2026*
*Desarrollado en colaboración con Claude (claude-sonnet-4-20250514 / Anthropic)*
