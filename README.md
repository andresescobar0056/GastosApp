# Control de Gastos (PWA)

App web instalable para registrar ingresos, gastos y metas de ahorro.
Frontend en HTML/CSS/JS sin frameworks y backend en PHP 8 + MySQL/MariaDB.

## Estructura

```
index.html, manifest.json, sw.js   App (PWA) y service worker
css/, js/, assets/                 Frontend
backend/api/                       Endpoints JSON (únicos archivos PHP accesibles desde la web)
backend/config/                    Conexión a BD, bootstrap de seguridad, config.php (privado)
backend/controllers/, models/, lib/, middleware/
backend/uploads/                   Imágenes subidas por los usuarios
database.sql                       Esquema completo (instalación desde cero)
migrate_v2.sql                     Migración para bases creadas con la versión anterior
```

## Ejecutar en local (XAMPP)

1. Copia la carpeta del proyecto a `C:\xampp\htdocs\gastos-app`.
2. Arranca **Apache** y **MySQL** desde el panel de XAMPP.
3. En phpMyAdmin (`http://localhost/phpmyadmin`):
   crea la base `control_gastos` (cotejamiento `utf8mb4_unicode_ci`), selecciónala e importa `database.sql`.
   - Si ya tenías la base de la versión anterior, **no** importes `database.sql` (borra los datos):
     ejecuta `migrate_v2.sql` en su lugar.
4. Abre `http://localhost/gastos-app/`.

Con XAMPP no hace falta `config.php`: se usan los valores de `config.example.php` (root sin contraseña).

`server.js` (`node server.js`) solo sirve para ver el diseño: no ejecuta PHP, así que el login no funciona ahí.

## Publicar gratis en InfinityFree

InfinityFree ofrece hosting gratuito con PHP + MySQL, subdominio gratis y HTTPS.

1. **Crea la cuenta y el sitio** en https://www.infinityfree.com → *Create Account* → elige un subdominio
   (p. ej. `misgastos.infinityfreeapp.com`).
2. **Base de datos**: en el panel del sitio → *MySQL Databases* → crea una (p. ej. `gastos`).
   Anota *MySQL Hostname*, *Database Name*, *Username* y *Password* (la del panel de la cuenta de hosting).
3. **Importa el esquema**: botón *phpMyAdmin* junto a la base → pestaña *Importar* → `database.sql`.
4. **Configura las credenciales**: copia `backend/config/config.example.php` como `backend/config/config.php`
   y rellena los datos del paso 2 (`'debug' => false`).
5. **Genera el paquete**: en PowerShell, dentro de la carpeta del proyecto:
   ```powershell
   powershell -ExecutionPolicy Bypass -File .\empaquetar.ps1
   ```
   Crea `deploy\gastos-app.zip` solo con los archivos necesarios (incluye tu `config.php`).
6. **Sube los archivos**: panel → *File Manager* → entra en `htdocs/` → borra el `index2.html` de ejemplo →
   *Upload* → sube el ZIP → clic derecho → *Extract*. (Alternativa: FileZilla con los datos FTP del panel.)
   `index.html` debe quedar directamente dentro de `htdocs/`.
7. **HTTPS**: panel → *SSL Certificates* → solicita el certificado gratuito para tu subdominio si no está activo.
   Sin HTTPS la app funciona, pero no se puede instalar como PWA.
8. Abre `https://tu-subdominio.infinityfreeapp.com` y regístrate.

### Actualizar después de cambios
Sube los archivos modificados y **sube `CACHE_VERSION` en `sw.js`** (`'v5'` → `'v6'`…) para que los
navegadores descarguen la nueva versión.

### Limitaciones del plan gratuito
- Las cuentas sin visitas durante mucho tiempo pueden desactivarse: entra de vez en cuando.
- Usa *Exportar copia de seguridad JSON* (Configuración) y exporta la base desde phpMyAdmin periódicamente.
- InfinityFree añade una comprobación anti-bots con JavaScript: la app funciona normal en el navegador,
  pero la API no se puede llamar desde scripts externos (curl, otras apps).

## Seguridad (resumen)

- Contraseñas con `password_hash`; mínimo 8 caracteres; bloqueo de 15 min tras 5 intentos fallidos.
- Sesión con cookie `HttpOnly` + `SameSite=Lax` (+ `Secure` en HTTPS) y regeneración del ID al iniciar sesión.
- CSRF: toda petición POST exige la cabecera `X-Requested-With` y un `Origin` del mismo host.
- Todas las consultas son preparadas (PDO) y filtradas por `user_id`.
- Las operaciones que mueven dinero se ejecutan en una transacción con bloqueo por usuario:
  el saldo nunca puede quedar negativo (ni al crear, editar o borrar movimientos, ni al abonar a metas).
- Imágenes: se valida el tipo real del contenido (no la extensión), máx. 5MB; la carpeta `uploads/`
  no ejecuta código y solo sirve imágenes.
- El frontend escapa todo dato del usuario y no usa `onclick` con datos interpolados.
- `config.php` está en `.gitignore`: no subas credenciales a un repositorio.
