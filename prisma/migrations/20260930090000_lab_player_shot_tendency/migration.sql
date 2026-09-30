-- AddColumn (ME-07A §2.2): tendencia individual de tiro, con valor por
-- defecto explícito "equilibrada" para los registros ya persistidos.
ALTER TABLE "lab_players" ADD COLUMN "shotTendency" TEXT NOT NULL DEFAULT 'equilibrada';
