-- Corrige legenda duplicada/conflitante da imagem reutilizada em "Cardiac Anatomy" (seção "Topography and projection on the thoracic wall").
-- A imagem era descrita como "Diaphragmatic surface" (Fig. 493), mas é a mesma imagem "Sternocostal surface" (Fig. 492) já usada na seção "Great vessels".
-- Ver auditoria de 2026-09-06.
update content_assets
set
  alt_text = 'Gray492 — Sternocostal surface of the heart, referenced here for topographic anatomy (Gray''s Anatomy, 1918)',
  caption = 'Plate 492 — Sternocostal (anterior) surface of the heart, used to illustrate its topographic position on the thoracic wall. Same plate as in ''Great vessels'' above. Gray''s Anatomy, 1918. Public domain.'
where id = 'e8a89260-e938-4900-836f-0eb51494efe2'
returning id, caption;
