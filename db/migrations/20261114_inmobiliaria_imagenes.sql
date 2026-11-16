-- Imágenes de la inmobiliaria además del logo: banner y principal (nombre del archivo en uploads/inmobiliarias)
ALTER TABLE inmobiliaria
  ADD COLUMN imagenBanner VARCHAR(255) NULL AFTER imagenLogo,
  ADD COLUMN imagenPrincipal VARCHAR(255) NULL AFTER imagenBanner;
