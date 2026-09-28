-- CreateTable
CREATE TABLE "lab_teams" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lab_teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lab_players" (
    "teamId" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "age" INTEGER NOT NULL,
    "positionLabel" TEXT NOT NULL,
    "template" TEXT NOT NULL,
    "heightCm" INTEGER NOT NULL,
    "weightKg" INTEGER NOT NULL,
    "wingspanCm" INTEGER NOT NULL,
    "standingReachCm" INTEGER NOT NULL,
    "attributes" JSONB NOT NULL,
    "pnrTendency" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lab_players_pkey" PRIMARY KEY ("teamId","id")
);

-- AddForeignKey
ALTER TABLE "lab_players" ADD CONSTRAINT "lab_players_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "lab_teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
