-- Para bases existentes que ya tengan superadminsNotificaciones.
-- Borra los avisos destinados exclusivamente a superadministradores.
DELETE n
FROM `notificaciones` n
INNER JOIN `superadminsNotificaciones` sn ON sn.`idNotificacion` = n.`id`
LEFT JOIN `personasNotificaciones` pn ON pn.`idNotificacion` = n.`id`
WHERE pn.`id` IS NULL;

DROP TABLE `superadminsNotificaciones`;
