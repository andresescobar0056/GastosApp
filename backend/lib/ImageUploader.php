<?php
/**
 * Subida, validación y borrado de imágenes (fotos de movimientos, metas y avatares).
 * Centraliza la lógica que antes estaba copiada en tres controladores.
 */

require_once __DIR__ . '/../config/response.php';

class ImageUploader {
    public const MAX_BYTES = 5 * 1024 * 1024;

    private const ALLOWED = [
        'image/jpeg' => 'jpg',
        'image/png'  => 'png',
        'image/webp' => 'webp',
    ];

    private const PUBLIC_PREFIX = 'backend/uploads/';

    private static function uploadDir(): string {
        $dir = __DIR__ . '/../uploads/';
        if (!is_dir($dir)) {
            mkdir($dir, 0755, true);
        }
        return $dir;
    }

    /**
     * Procesa un archivo de $_FILES. Devuelve null si no se envió archivo;
     * lanza ApiException si se envió pero es inválido.
     */
    public static function fromUpload(?array $file, string $prefix): ?string {
        if (!$file || !isset($file['error']) || $file['error'] === UPLOAD_ERR_NO_FILE) {
            return null;
        }
        if ($file['error'] === UPLOAD_ERR_INI_SIZE || $file['error'] === UPLOAD_ERR_FORM_SIZE) {
            throw new ApiException('La imagen excede el tamaño máximo permitido (5MB).');
        }
        if ($file['error'] !== UPLOAD_ERR_OK || !is_uploaded_file($file['tmp_name'])) {
            throw new ApiException('No se pudo recibir la imagen. Intenta de nuevo.');
        }
        if ($file['size'] > self::MAX_BYTES) {
            throw new ApiException('La imagen excede el tamaño máximo permitido (5MB).');
        }

        $finfo = new finfo(FILEINFO_MIME_TYPE);
        $ext = self::ALLOWED[$finfo->file($file['tmp_name'])] ?? null;
        if (!$ext) {
            throw new ApiException('Formato de imagen no permitido. Solo JPG, PNG o WEBP.');
        }

        $filename = self::newFilename($prefix, $ext);
        if (!move_uploaded_file($file['tmp_name'], self::uploadDir() . $filename)) {
            throw new ApiException('No se pudo guardar la imagen.', 500);
        }
        return self::PUBLIC_PREFIX . $filename;
    }

    /**
     * Procesa una imagen en base64 (data URL). Comprueba tamaño y tipo MIME real
     * del contenido decodificado, no solo lo que declara la cabecera.
     */
    public static function fromBase64(?string $dataUrl, string $prefix): ?string {
        if (!$dataUrl || !str_starts_with($dataUrl, 'data:image/')) {
            return null;
        }
        $comma = strpos($dataUrl, ',');
        if ($comma === false) {
            throw new ApiException('Imagen inválida.');
        }
        // Tamaño aproximado antes de decodificar (base64 ocupa ~4/3)
        if ((strlen($dataUrl) - $comma) * 3 / 4 > self::MAX_BYTES) {
            throw new ApiException('La imagen excede el tamaño máximo permitido (5MB).');
        }
        $decoded = base64_decode(substr($dataUrl, $comma + 1), true);
        if ($decoded === false || strlen($decoded) > self::MAX_BYTES) {
            throw new ApiException('Imagen inválida o demasiado grande.');
        }

        $finfo = new finfo(FILEINFO_MIME_TYPE);
        $ext = self::ALLOWED[$finfo->buffer($decoded)] ?? null;
        if (!$ext) {
            throw new ApiException('Formato de imagen no permitido. Solo JPG, PNG o WEBP.');
        }

        $filename = self::newFilename($prefix, $ext);
        if (file_put_contents(self::uploadDir() . $filename, $decoded) === false) {
            throw new ApiException('No se pudo guardar la imagen.', 500);
        }
        return self::PUBLIC_PREFIX . $filename;
    }

    /** Toma la imagen de $_FILES[$field] o, si no hay, del base64 enviado en $data[$base64Key]. */
    public static function fromRequest(string $field, array $data, string $base64Key, string $prefix): ?string {
        return self::fromUpload($_FILES[$field] ?? null, $prefix)
            ?? self::fromBase64($data[$base64Key] ?? null, $prefix);
    }

    /**
     * Borra un archivo subido. Solo acepta rutas generadas por esta clase,
     * así que un valor manipulado no puede borrar nada fuera de uploads/.
     */
    public static function delete(?string $publicPath): void {
        if (!$publicPath) {
            return;
        }
        if (!preg_match('#^backend/uploads/([a-z]+_)?[a-f0-9]{32}\.(jpg|png|webp)$#', $publicPath)) {
            return;
        }
        $absolute = self::uploadDir() . basename($publicPath);
        if (is_file($absolute)) {
            @unlink($absolute);
        }
    }

    private static function newFilename(string $prefix, string $ext): string {
        return $prefix . '_' . bin2hex(random_bytes(16)) . '.' . $ext;
    }
}
